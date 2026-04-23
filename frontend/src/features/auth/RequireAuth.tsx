import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spinner } from '@/shared/ui/Spinner';
import type { RoleCode } from '@/shared/types/domain';

interface RequireAuthProps {
  /** If provided, user must hold at least one of these roles to enter. */
  anyOf?: readonly RoleCode[];
}

/**
 * Route guard:
 *   - while bootstrapping → splash
 *   - anonymous → redirect to /login (preserves attempted path)
 *   - authenticated but missing required role → /dashboard (no business escalation in Phase 8)
 */
export function RequireAuth({ anyOf }: RequireAuthProps) {
  const { status, hasAnyRole } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (anyOf && anyOf.length > 0 && !hasAnyRole(anyOf)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

