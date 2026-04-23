import * as React from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from './Button';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Footer is rendered on the start side (RTL = right). */
  footer?: React.ReactNode;
}

/**
 * Minimal accessible modal — no portal lib, single-purpose.
 * Closes on Escape and backdrop click.
 */
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-w-lg rounded border border-slate-200 bg-white shadow-lg',
          'flex max-h-[90vh] flex-col',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-start gap-2 border-t border-slate-200 px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

