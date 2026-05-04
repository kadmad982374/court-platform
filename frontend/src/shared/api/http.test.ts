// Unit tests for the shared axios instance and 401-refresh interceptor.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { http, apiGet } from './http';
import { tokenStorage } from '@/shared/lib/tokenStorage';

/**
 * Override the axios adapter on BOTH the shared `http` instance and the global
 * `axios` instance, so we capture:
 *   1. Normal requests (go through `http`).
 *   2. The refresh-token call inside `performRefresh()` which uses the global
 *      `axios.post(...)` directly — this is intentional in http.ts to avoid
 *      recursive interceptor invocation, but it means our adapter has to be
 *      set on `axios.defaults` too.
 */
type CannedResponse = { status: number; data: unknown };
let queue: CannedResponse[] = [];
let captured: Array<{ url?: string; method?: string; headers?: Record<string, unknown>; data?: unknown }> = [];

const originalHttpAdapter = http.defaults.adapter;
const originalAxiosAdapter = axios.defaults.adapter;

const adapter = async (config: import('axios').InternalAxiosRequestConfig) => {
  captured.push({
    url: config.url,
    method: config.method,
    headers: config.headers as unknown as Record<string, unknown>,
    data: config.data,
  });
  const next = queue.shift() ?? { status: 200, data: { ok: true } };
  if (next.status >= 400) {
    const err = new Error(`HTTP ${next.status}`) as Error & {
      isAxiosError: boolean;
      response: { status: number; data: unknown };
      config: typeof config;
    };
    err.isAxiosError = true;
    err.response = { status: next.status, data: next.data };
    err.config = config;
    throw err;
  }
  return {
    data: next.data,
    status: next.status,
    statusText: 'OK',
    headers: {},
    config,
  };
};

beforeEach(() => {
  tokenStorage.clear();
  queue = [];
  captured = [];
  http.defaults.adapter = adapter;
  axios.defaults.adapter = adapter;
});

afterEach(() => {
  vi.restoreAllMocks();
  http.defaults.adapter = originalHttpAdapter;
  axios.defaults.adapter = originalAxiosAdapter;
});

describe('http request interceptor', () => {
  it('injects Authorization Bearer header when access token exists', async () => {
    tokenStorage.set({ accessToken: 'tk-1', refreshToken: 'rf-1' });

    await http.get('/users/me');

    expect(captured).toHaveLength(1);
    expect(captured[0].headers?.Authorization).toBe('Bearer tk-1');
  });

  it('omits Authorization header when no token is stored', async () => {
    await http.get('/public/health');

    expect(captured[0].headers?.Authorization).toBeUndefined();
  });

  it.each([
    '/auth/login',
    '/auth/refresh-token',
    '/auth/logout',
    '/auth/forgot-password',
    '/auth/reset-password',
  ])('does NOT inject Authorization for AUTH_BYPASS endpoint %s', async (path) => {
    tokenStorage.set({ accessToken: 'should-not-leak', refreshToken: 'rf-1' });

    await http.post(path, { x: 1 });

    expect(captured[0].headers?.Authorization).toBeUndefined();
  });
});

describe('http response 401 interceptor', () => {
  it('on 401 → refreshes token, retries original request with new bearer', async () => {
    tokenStorage.set({ accessToken: 'old', refreshToken: 'rf-old' });
    // Sequence: 1st call /users/me → 401, 2nd call /auth/refresh-token → 200, 3rd retry /users/me → 200.
    queue = [
      { status: 401, data: { code: 'UNAUTHENTICATED' } },
      { status: 200, data: { accessToken: 'new', refreshToken: 'rf-new', expiresInSeconds: 1800 } },
      { status: 200, data: { id: 1, username: 'alice' } },
    ];

    const r = await http.get('/users/me');

    expect(r.data).toEqual({ id: 1, username: 'alice' });
    expect(captured).toHaveLength(3);
    expect(captured[0].url).toBe('/users/me');
    expect(captured[1].url).toContain('/auth/refresh-token');
    // retry uses the freshly-rotated token
    expect(captured[2].headers?.Authorization).toBe('Bearer new');
    // tokenStorage updated
    expect(tokenStorage.getAccess()).toBe('new');
    expect(tokenStorage.getRefresh()).toBe('rf-new');
  });

  it('on 401 → if no refresh token present, surfaces the original 401', async () => {
    // No tokens stored.
    queue = [{ status: 401, data: { code: 'UNAUTHENTICATED' } }];

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });
    // No refresh attempt should have been made.
    expect(captured.filter((c) => c.url?.includes('/auth/refresh-token'))).toHaveLength(0);
  });

  it('on 401 → if refresh ALSO fails, clears tokens and rejects', async () => {
    tokenStorage.set({ accessToken: 'old', refreshToken: 'rf-old' });
    queue = [
      { status: 401, data: { code: 'UNAUTHENTICATED' } },
      { status: 401, data: { code: 'REFRESH_REUSED' } },
    ];

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });
    expect(tokenStorage.get()).toBeNull();
  });

  it('a single retried request does NOT re-trigger refresh on a second 401', async () => {
    tokenStorage.set({ accessToken: 'old', refreshToken: 'rf-old' });
    queue = [
      { status: 401, data: {} },
      { status: 200, data: { accessToken: 'new', refreshToken: 'rf-new' } },
      { status: 401, data: {} }, // retry also 401 — must not refresh-loop
    ];

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });
    // exactly: first call + refresh + retry = 3 captured. NO second refresh.
    expect(captured).toHaveLength(3);
  });
});

describe('apiGet wrapper', () => {
  it('returns response.data directly', async () => {
    queue = [{ status: 200, data: { items: [1, 2, 3] } }];
    const result = await apiGet<{ items: number[] }>('/x');
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('passes params through', async () => {
    queue = [{ status: 200, data: {} }];
    await apiGet('/x', { page: 2, q: 'foo' });
    // axios serializes params; we just confirm the request was made
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('/x');
  });
});
