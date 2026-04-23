import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/shared/ui/Button';
import { ROLE_LABEL_AR } from '@/shared/types/domain';

export function Header() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  const roleLabel = user?.roles?.[0] ? ROLE_LABEL_AR[user.roles[0]] : null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-brand-700">إدارة قضايا الدولة</div>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="text-end text-sm">
            <div className="font-medium text-slate-800">{user.fullName}</div>
            {roleLabel && <div className="text-xs text-slate-500">{roleLabel}</div>}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          disabled={signingOut}
          aria-label="تسجيل الخروج"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>خروج</span>
        </Button>
      </div>
    </header>
  );
}

