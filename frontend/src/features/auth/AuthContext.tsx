import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { tokenStorage } from '@/shared/lib/tokenStorage';
import { fetchCurrentUser, login as loginApi, logout as logoutApi } from './api';
import type { CurrentUser, RoleCode } from '@/shared/types/domain';

type Status = 'bootstrapping' | 'anonymous' | 'authenticated' | 'error';

interface AuthState {
  status: Status;
  user: CurrentUser | null;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasAnyRole: (roles: readonly RoleCode[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'bootstrapping',
    user: null,
    error: null,
  });

  const loadUser = useCallback(async () => {
    if (!tokenStorage.getAccess() && !tokenStorage.getRefresh()) {
      setState({ status: 'anonymous', user: null, error: null });
      return;
    }
    try {
      const user = await fetchCurrentUser();
      setState({ status: 'authenticated', user, error: null });
    } catch {
      // Either no token, or refresh ultimately failed → anonymous.
      tokenStorage.clear();
      setState({ status: 'anonymous', user: null, error: null });
    }
  }, []);

  // Initial bootstrap.
  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  // Cross-tab sync: if another tab clears tokens, this tab signs out.
  useEffect(() => {
    return tokenStorage.subscribe(() => {
      if (!tokenStorage.getAccess()) {
        setState((s) => (s.status === 'authenticated' ? { ...s, status: 'anonymous', user: null } : s));
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (username, password) => {
        await loginApi(username, password);
        await loadUser();
      },
      logout: async () => {
        await logoutApi();
        setState({ status: 'anonymous', user: null, error: null });
      },
      refreshUser: loadUser,
      hasAnyRole: (roles) => {
        if (!state.user) return false;
        if (roles.length === 0) return true;
        return state.user.roles.some((r) => roles.includes(r));
      },
    }),
    [state, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

