import { http } from '@/shared/api/http';
import { tokenStorage } from '@/shared/lib/tokenStorage';
import type {
  CurrentUser,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TokenPairResponse,
} from '@/shared/types/domain';

export async function login(username: string, password: string): Promise<TokenPairResponse> {
  const r = await http.post<TokenPairResponse>('/auth/login', { username, password });
  tokenStorage.set({
    accessToken: r.data.accessToken,
    refreshToken: r.data.refreshToken,
    expiresInSeconds: r.data.expiresInSeconds,
  });
  return r.data;
}

/** Best-effort logout: revoke refresh token server-side, then clear local. */
export async function logout(): Promise<void> {
  const refreshToken = tokenStorage.getRefresh();
  try {
    if (refreshToken) {
      await http.post('/auth/logout', { refreshToken });
    }
  } catch {
    // backend may 4xx if already revoked — ignore: we always clear locally.
  } finally {
    tokenStorage.clear();
  }
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const r = await http.get<CurrentUser>('/users/me');
  return r.data;
}

// Phase 11 — public password recovery (existing backend endpoints, public).
export async function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  await http.post('/auth/forgot-password', body);
}

export async function resetPassword(body: ResetPasswordRequest): Promise<void> {
  await http.post('/auth/reset-password', body);
}
