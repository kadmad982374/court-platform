import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { config } from '@/shared/config/env';
import { tokenStorage } from '@/shared/lib/tokenStorage';
import type { TokenPairResponse } from '@/shared/types/domain';

/**
 * Phase 8 — single shared axios instance.
 *
 * - Auth header is injected from tokenStorage.
 * - 401 ⇒ try `POST /auth/refresh-token` exactly once, then replay the request.
 * - Concurrent 401s share the same in-flight refresh promise (no thundering herd).
 * - On refresh failure ⇒ tokens are cleared; the AuthContext subscriber redirects to /login.
 *
 * Endpoints that must NOT trigger refresh logic:
 *   - /auth/login
 *   - /auth/refresh-token
 *   - /auth/logout
 *   - /auth/forgot-password
 *   - /auth/reset-password
 */

const AUTH_BYPASS = [
  '/auth/login',
  '/auth/refresh-token',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function isAuthBypass(url?: string): boolean {
  if (!url) return false;
  return AUTH_BYPASS.some((p) => url.endsWith(p));
}

export const http = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  // Backend sets statelesss session; we don't rely on cookies in Phase 8.
  withCredentials: false,
});

// ----- Request: inject Authorization -----
http.interceptors.request.use((req: InternalAxiosRequestConfig) => {
  const access = tokenStorage.getAccess();
  if (access && !isAuthBypass(req.url)) {
    req.headers = req.headers ?? {};
    (req.headers as Record<string, string>).Authorization = `Bearer ${access}`;
  }
  return req;
});

// ----- Response: refresh on 401 -----
let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    const resp = await axios.post<TokenPairResponse>(
      `${config.apiBaseUrl}/auth/refresh-token`,
      { refreshToken: refresh },
      { headers: { 'Content-Type': 'application/json' } },
    );
    tokenStorage.set({
      accessToken: resp.data.accessToken,
      refreshToken: resp.data.refreshToken,
      expiresInSeconds: resp.data.expiresInSeconds,
    });
    return resp.data.accessToken;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

http.interceptors.response.use(
  (resp) => resp,
  async (err: AxiosError) => {
    const original = err.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = err.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retried &&
      !isAuthBypass(original.url)
    ) {
      original._retried = true;
      refreshInFlight = refreshInFlight ?? performRefresh();
      const newToken = await refreshInFlight;
      refreshInFlight = null;

      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return http.request(original);
      }
      // Refresh failed — surface the original 401 so AuthContext can redirect.
    }
    return Promise.reject(err);
  },
);

/** Convenience wrapper for typed GETs. */
export async function apiGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const r = await http.get<T>(url, { params });
  return r.data;
}

