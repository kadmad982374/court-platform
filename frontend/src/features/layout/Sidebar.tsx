import { NavLink } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { visibleItems } from '@/features/navigation/navItems';
import { cn } from '@/shared/lib/cn';
import { useMemo } from 'react';

export function Sidebar() {
  const { user } = useAuth();
  const items = useMemo(() => visibleItems(user?.roles ?? []), [user]);

  // Group by section, preserving order of first appearance.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const it of items) {
      const k = it.section ?? '';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white md:block">
      <nav aria-label="القائمة الرئيسية" className="p-3">
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
                        'block rounded px-3 py-2 text-sm transition-colors',
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
  );
}

