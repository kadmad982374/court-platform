// Customer feedback round-2 (PR-15a iteration):
// Plain year dropdown. The earlier wheel/roller variants were too clever —
// the customer asked for a basic "let me pick the year, no fancy stuff".
//
// Range: 1990 → current year (the customer doesn't want future years).
// Empty value = no filter ("الكل").

import { useMemo } from 'react';
import { cn } from '@/shared/lib/cn';

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_MIN  = 1990;

interface Props {
  value: string | number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
  className?: string;
}

export function ScrollYearPicker({
  value,
  onChange,
  min = DEFAULT_MIN,
  max = CURRENT_YEAR,
  ariaLabel = 'السنة',
  className,
}: Props) {
  // Newest first so the most-recent year is right under "الكل".
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = max; y >= min; y--) out.push(y);
    return out;
  }, [min, max]);

  const stringValue =
    value == null || value === '' ? '' : String(value);

  return (
    <select
      aria-label={ariaLabel}
      value={stringValue}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === '' ? undefined : Number(v));
      }}
      className={cn(
        'flex h-10 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        className,
      )}
    >
      <option value="">الكل</option>
      {years.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}
