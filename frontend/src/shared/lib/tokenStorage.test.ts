// Unit tests for the token storage abstraction.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tokenStorage } from './tokenStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('tokenStorage', () => {
  it('returns null when nothing is stored', () => {
    expect(tokenStorage.get()).toBeNull();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it('persists and retrieves a token pair', () => {
    tokenStorage.set({ accessToken: 'a-1', refreshToken: 'r-1' });
    expect(tokenStorage.get()).toEqual({ accessToken: 'a-1', refreshToken: 'r-1' });
    expect(tokenStorage.getAccess()).toBe('a-1');
    expect(tokenStorage.getRefresh()).toBe('r-1');
  });

  it('returns null from get() when only one half is present', () => {
    tokenStorage.set({ accessToken: 'a-1', refreshToken: 'r-1' });
    localStorage.removeItem('sla.refreshToken');
    expect(tokenStorage.get()).toBeNull();
  });

  it('clear() removes both tokens', () => {
    tokenStorage.set({ accessToken: 'a-1', refreshToken: 'r-1' });
    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
    expect(tokenStorage.getAccess()).toBeNull();
    expect(tokenStorage.getRefresh()).toBeNull();
  });

  it('notifies subscribers on set and clear, and stops after unsubscribe', () => {
    const cb = vi.fn();
    const unsub = tokenStorage.subscribe(cb);

    tokenStorage.set({ accessToken: 'a', refreshToken: 'r' });
    tokenStorage.clear();
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
    tokenStorage.set({ accessToken: 'a2', refreshToken: 'r2' });
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

