// PR-13 (customer feedback A-2 / Q-B / Q-F).
//
// Pie chart + money totals widget. Reused on the dashboard (home) AND the
// cases page per Q-B. The slices follow the customer's example pie:
//   نشطة (Active) / مفصولة بدون قرار (Resolved no-decision) /
//   لصالح الدولة / ضد الدولة / صلح / غير نهائي.
//
// "Active" = ACTIVE + IN_APPEAL + IN_EXECUTION (case is still in motion).
// The four decision-type slices come from finalized stages; the
// "مفصولة بدون قرار" slice catches CLOSED cases that lack a decision row
// yet (rare — usually only ARCHIVED / data-cleanup cases).

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getCaseSummary, type CaseSummary } from './api';
import { Card, CardBody, CardHeader, CardTitle } from '@/shared/ui/Card';
import { Spinner } from '@/shared/ui/Spinner';
import { extractApiErrorMessage } from '@/shared/lib/apiError';

const SLICE_COLORS = {
  active:        '#2563eb', // blue-600
  resolved:      '#64748b', // slate-500
  forEntity:     '#16a34a', // green-600
  againstEntity: '#dc2626', // red-600
  settlement:    '#f59e0b', // amber-500
  nonFinal:      '#a855f7', // purple-500
} as const;

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

function buildSlices(s: CaseSummary): Slice[] {
  const lc = s.byLifecycle;
  const dt = s.byDecisionType;

  const active = (lc.ACTIVE ?? 0) + (lc.IN_APPEAL ?? 0) + (lc.IN_EXECUTION ?? 0) + (lc.NEW ?? 0);
  const closed = lc.CLOSED ?? 0;
  const decided = (dt.FOR_ENTITY ?? 0) + (dt.AGAINST_ENTITY ?? 0)
                + (dt.SETTLEMENT ?? 0) + (dt.NON_FINAL ?? 0);
  const resolvedNoDecision = Math.max(0, closed - decided);

  return [
    { key: 'active',        label: 'نشطة',                value: active,             color: SLICE_COLORS.active        },
    { key: 'forEntity',     label: 'لصالح الدولة',         value: dt.FOR_ENTITY ?? 0, color: SLICE_COLORS.forEntity     },
    { key: 'againstEntity', label: 'ضد الدولة',            value: dt.AGAINST_ENTITY ?? 0, color: SLICE_COLORS.againstEntity },
    { key: 'settlement',    label: 'صلح',                 value: dt.SETTLEMENT ?? 0, color: SLICE_COLORS.settlement    },
    { key: 'nonFinal',      label: 'غير نهائي',            value: dt.NON_FINAL ?? 0,  color: SLICE_COLORS.nonFinal      },
    { key: 'resolved',      label: 'مفصولة بدون قرار',     value: resolvedNoDecision, color: SLICE_COLORS.resolved      },
  ].filter((s) => s.value > 0);
}

function formatMoney(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('ar-SY', { maximumFractionDigits: 2 });
}

export function CaseSummaryWidget({ compact = false }: { compact?: boolean }) {
  const q = useQuery({
    queryKey: ['reports', 'case-summary'],
    queryFn: () => getCaseSummary(),
    staleTime: 30_000,
  });

  const slices = useMemo(() => (q.data ? buildSlices(q.data) : []), [q.data]);
  const total = q.data?.totalCases ?? 0;

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
                  >
                    {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      `${v} (${total > 0 ? Math.round((v / total) * 100) : 0}٪)`, name,
                    ]}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-slate-700">
                <span className="text-slate-500">إجمالي الدعاوى:</span>{' '}
                <strong>{total.toLocaleString('ar-SY')}</strong>
              </p>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-600">
                  مجاميع المبالغ المحكوم بها (Q-F)
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

              <p className="pt-2 text-[10px] text-slate-400">
                المبلغ المحكوم به فقط (Q-F) — مبلغ الصلح والمصاريف غير مشمولة.
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
