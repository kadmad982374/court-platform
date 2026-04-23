import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { visibleItems } from '@/features/navigation/navItems';
import { cn } from '@/shared/lib/cn';
import { useMemo } from 'react';

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-out drawer for mobile navigation.
 * Closes on route change, Escape key, and backdrop tap.
 */
export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const items = useMemo(() => visibleItems(user?.roles ?? []), [user]);

  // Group by section (same logic as desktop Sidebar).
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      const k = it.section ?? '';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  // Close on route change.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides in from the end side (right in RTL) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="القائمة الرئيسية"
        className={cn(
          'fixed inset-y-0 end-0 z-50 flex w-72 flex-col bg-white shadow-xl',
          'transform transition-transform duration-250 ease-in-out md:hidden',
          open ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <span className="text-sm font-semibold text-brand-700">القائمة</span>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3">
          {grouped.map(([section, list]) => (
            <div key={section} className="mb-4">
              {section && (
                <div className="mb-1 px-2 text-xs font-semibold uppercase text-slate-400">
                  {section}
                </div>
              )}
              <ul className="space-y-1">
                {list.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      end
                      className={({ isActive }) =>
                        cn(
                          'block rounded px-3 py-2.5 text-sm transition-colors',
                          isActive
                            ? 'bg-brand-50 font-medium text-brand-700'
                            : 'text-slate-700 hover:bg-slate-100',
                        )
                      }
                    >
                      {it.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}


