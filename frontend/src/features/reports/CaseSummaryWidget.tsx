// PR-13 / PR-13b / customer feedback round-3.
//
// Pie chart + money totals widget. Reused on the dashboard (home) AND the
// cases page per Q-B.
//
// Round-3 simplification: the customer asked for a binary view that mirrors
// the cases-list "الحالة" column (قائمة / محسومة), instead of the prior
// 6-slice break-down by outcome. We still consume `byCurrentOutcome` from
// the backend (mutually-exclusive per case) and aggregate it into two
// buckets:
//   - قائمة  = ACTIVE (case has no final decision yet)
//   - محسومة = sum of FOR_ENTITY + AGAINST_ENTITY + SETTLEMENT + NON_FINAL
//             + RESOLVED_NO_DECISION (every case that reached some final
//             outcome).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getCaseSummary, type CaseSummary } from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';
import { useAuth } from '@/features/auth/AuthContext';
import { hasRole } from '@/features/auth/permissions';

const SLICE_COLORS = {
  open:   '#2563eb', // blue-600
  closed: '#64748b', // slate-500
} as const;

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

function buildSlices(s: CaseSummary): Slice[] {
  const o = s.byCurrentOutcome ?? {};
  const openCount = o.ACTIVE ?? 0;
  const closedCount =
      (o.FOR_ENTITY            ?? 0)
    + (o.AGAINST_ENTITY        ?? 0)
    + (o.SETTLEMENT            ?? 0)
    + (o.NON_FINAL             ?? 0)
    + (o.RESOLVED_NO_DECISION  ?? 0);
  return [
    { key: 'open',   label: 'قائمة',  value: openCount,   color: SLICE_COLORS.open   },
    { key: 'closed', label: 'محسومة', value: closedCount, color: SLICE_COLORS.closed },
  ].filter((s) => s.value > 0);
}

/**
 * Custom pie label rendered inside each slice. Shows the percentage so the
 * user doesn't need to hover. Hidden for tiny slices (< ~5%) to keep the
 * label legible.
 */
function renderSliceLabel(props: {
  cx?: number; cy?: number; midAngle?: number;
  innerRadius?: number; outerRadius?: number; percent?: number;
}): React.ReactNode {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (cx == null || cy == null || midAngle == null
      || innerRadius == null || outerRadius == null || percent == null) {
    return null;
  }
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const RAD = Math.PI / 180;
  const x = cx + radius * Math.cos(-midAngle * RAD);
  const y = cy + radius * Math.sin(-midAngle * RAD);
  return (
    <text
      x={x} y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 600 }}
    >
      {Math.round(percent * 100)}٪
    </text>
  );
}

function formatMoney(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('ar-SY', { maximumFractionDigits: 2 });
}

export function CaseSummaryWidget({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  // Customer feedback round-3 — hide the stats widget for state lawyers.
  // It mixes scopes that don't matter to a lawyer working their own cases.
  const hidden = hasRole(user, 'STATE_LAWYER');

  const q = useQuery({
    queryKey: ['reports', 'case-summary'],
    queryFn: () => getCaseSummary(),
    staleTime: 30_000,
    enabled: !hidden,
  });

  const slices = useMemo(() => (q.data ? buildSlices(q.data) : []), [q.data]);
  const total = q.data?.totalCases ?? 0;
  // PR-13b: tooltip percentage now matches the visual wedge — slices sum to
  // total because byCurrentOutcome is mutually exclusive. Falls back to the
  // slice sum if backend ever returns inconsistent data.
  const sliceSum = slices.reduce((acc, s) => acc + s.value, 0);
  const denom = sliceSum > 0 ? sliceSum : total;

  if (hidden) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>إحصائيات الدعاوى</CardTitle>
      </CardHeader>
      <CardBody>
        {q.isLoading && <Spinner className="text-brand-600" />}
        {q.isError && (
          <p className="text-sm text-red-600">
            {extractApiErrorMessage(q.error, 'تعذّر تحميل الإحصائيات.')}
          </p>
        )}
        {q.data && total === 0 && (
          <p className="text-sm text-slate-500">لا توجد دعاوى ضمن نطاقك.</p>
        )}
        {q.data && total > 0 && (
          <div className={compact ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4 lg:grid-cols-2'}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={compact ? 40 : 50}
                    outerRadius={compact ? 75 : 90}
                    paddingAngle={2}
                    isAnimationActive={false}
                    label={renderSliceLabel}
                    labelLine={false}
                  >
                    {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${v} (${denom > 0 ? Math.round((v / denom) * 100) : 0}٪)`, name,
                    ]}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-slate-700">
                <span className="text-slate-500">إجمالي الدعاوى القائمة:</span>{' '}
                <strong>{total.toLocaleString('ar-SY')}</strong>
              </p>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">
                  مجموع المبالغ المحكوم بها
                </p>
                {q.data.adjudgedTotalsByCurrency.length === 0 ? (
                  <p className="text-xs text-slate-400">لا توجد مبالغ مسجَّلة.</p>
                ) : (
                  <ul className="space-y-1">
                    {q.data.adjudgedTotalsByCurrency.map((t) => (
                      <li key={t.currencyCode} className="flex justify-between text-slate-700">
                        <span className="text-slate-500">{t.currencyCode}</span>
                        <span><strong>{formatMoney(t.total)}</strong></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
