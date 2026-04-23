import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  /** Phase 11 — optional right-aligned actions (RTL = start in our layout). */
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, className, actions }: PageHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3', className)}>
      <div>
        <h1 className="text-lg font-semibold text-slate-800 sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
