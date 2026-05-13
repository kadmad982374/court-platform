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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-slate-50">
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none fixed left-1/2 top-1/2 z-0 h-auto w-[min(60vmin,520px)] max-w-none -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.06] [mix-blend-mode:multiply]"
      />
      <div className="relative z-10 flex h-full w-full flex-col">
        <Header onMenuToggle={toggleMobileNav} />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <Outlet />
          </main>
        </div>
        <MobileSidebar open={mobileNavOpen} onClose={closeMobileNav} />
      </div>
    </div>
  );
}
