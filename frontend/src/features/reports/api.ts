// PR-13 (customer feedback A-2 / Q-B / Q-F).

import { http } from '@/shared/api/http';

export interface CurrencyTotal {
  currencyCode: string;
  /** Money quantity is a JSON number on the wire; widen to string-safe. */
  total: number | string;
}

export interface CaseSummary {
  totalCases: number;
  byLifecycle: Record<string, number>;
  byDecisionType: Record<string, number>;
  adjudgedTotalsByCurrency: CurrencyTotal[];
}

export async function getCaseSummary(): Promise<CaseSummary> {
  const r = await http.get<CaseSummary>('/reports/case-summary');
  return r.data;
}
