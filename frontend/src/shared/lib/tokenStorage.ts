// Token storage abstraction.
//
// Phase 8 default: localStorage. Refresh-token rotation per backend D-019:
// each refresh returns a fresh refreshToken; the old one is revoked server-side.
//
// Centralized here so swapping to httpOnly cookies later (D-043+) requires only
// changing this single module.

const ACCESS_KEY  = 'sla.accessToken';
const REFRESH_KEY = 'sla.refreshToken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Optional, returned by backend (`expiresInSeconds`). Not strictly required. */
  expiresInSeconds?: number;
}

const subscribers = new Set<() => void>();
function emit() { subscribers.forEach((cb) => cb()); }

export const tokenStorage = {
  get(): TokenPair | null {
    try {
      const a = localStorage.getItem(ACCESS_KEY);
      const r = localStorage.getItem(REFRESH_KEY);
      if (!a || !r) return null;
      return { accessToken: a, refreshToken: r };
    } catch {
      return null;
    }
  },
  getAccess(): string | null {
    try { return localStorage.getItem(ACCESS_KEY); } catch { return null; }
  },
  getRefresh(): string | null {
    try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  set(pair: TokenPair): void {
    try {
      localStorage.setItem(ACCESS_KEY, pair.accessToken);
      localStorage.setItem(REFRESH_KEY, pair.refreshToken);
    } catch { /* storage disabled — tokens become per-tab memory only */ }
    emit();
  },
  clear(): void {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch { /* ignore */ }
    emit();
  },
  subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },
};

