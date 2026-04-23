import * as React from 'react';
import { cn } from '@/shared/lib/cn';

export function Table(props: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table {...props} className={cn('min-w-full text-start text-sm', props.className)} />
    </div>
  );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn('bg-slate-50 text-xs uppercase text-slate-500', props.className)} />;
}
export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn('divide-y divide-slate-100', props.className)} />;
}
export function TR(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn('hover:bg-slate-50', props.className)} />;
}
export function TH(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" {...props} className={cn('px-3 py-2 text-start font-medium', props.className)} />;
}
export function TD(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={cn('px-3 py-2 align-top text-slate-700', props.className)} />;
}

