import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50">
      <Header onMenuToggle={toggleMobileNav} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <Outlet />
        </main>
      </div>
      <MobileSidebar open={mobileNavOpen} onClose={closeMobileNav} />
    </div>
  );
}
