// Phase 2 (Damascus registers) — per-register table column sets.
//
// The cases list table renders a different column set depending on the
// "active register type" (resolved from the applied filter's departmentId →
// its DepartmentType in CasesListPage). Three sets are exported:
//
//   - DEFAULT             : the classic case register (also used by
//                           ADMINISTRATIVE_JUDICIARY — "like a normal case").
//   - CASSATION           : قسم النقض columns (رقم المتداول / الجهة / صفتها /
//                           الخصم / الغرفة / أساس / نتيجة الطعن).
//   - EXTERNAL_DISPUTES   : المنازعات الخارجية columns (consumed by the
//                           ExternalDisputesPage which hard-filters to the
//                           Damascus EXTERNAL_DISPUTES department).
//
// Each set exposes a `head` (header cells) and a `row` renderer so the host
// page keeps full control of the surrounding <Table>/<TBody> and pagination.

import { TD, TH } from '@/shared/ui/Table';
import {
  caseSimpleStatus,
  PUBLIC_ENTITY_POSITION_LABEL_AR,
  type LitigationCase,
} from '@/shared/types/domain';

/** Context handed to a row renderer so it can build the action cell. */
export interface CaseRowContext {
  /** Navigate to the case detail page. */
  onOpen: (id: number) => void;
  /** Admin-only hard delete (CasesListPage). Omit to hide the delete button. */
  onDelete?: (id: number, basisNumber: string) => void;
  /** True while a delete mutation is in flight (disables the button). */
  deleting?: boolean;
}

export interface CaseColumnSet {
  /** Header cells (rendered inside a single <TR> in <THead>). */
  head: () => JSX.Element;
  /** Body cells for one case (rendered inside a single <TR> in <TBody>). */
  row: (c: LitigationCase, ctx: CaseRowContext) => JSX.Element;
}

const DASH = '—';

/** The latest hearing's chamber/court label for the CASSATION register. */
function chamberLabel(c: LitigationCase): string {
  return c.chamberName ?? DASH;
}

/** Action cell — "فتح" plus optional admin "حذف", reused across all sets. */
function ActionCell({ c, ctx }: { c: LitigationCase; ctx: CaseRowContext }) {
  return (
    <TD className="text-end">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => ctx.onOpen(c.id)}
          className="inline-flex h-8 items-center rounded border border-brand-600 bg-white px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          فتح
        </button>
        {ctx.onDelete && (
          <button
            type="button"
            disabled={ctx.deleting}
            onClick={() => ctx.onDelete!(c.id, c.originalBasisNumber)}
            data-testid="case-delete"
            className="inline-flex h-8 items-center rounded bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            حذف
          </button>
        )}
      </div>
    </TD>
  );
}

// ──────────────────────────────────────────────────────────────
// DEFAULT — the classic case register (also ADMINISTRATIVE_JUDICIARY).
// ──────────────────────────────────────────────────────────────
export const DEFAULT_COLUMNS: CaseColumnSet = {
  head: () => (
    <>
      <TH>رقم الأساس</TH>
      <TH>السنة</TH>
      <TH>الجهة العامة</TH>
      <TH>الصفة</TH>
      <TH>الخصم</TH>
      <TH>تاريخ الجلسة</TH>
      <TH>الحالة</TH>
      <TH className="text-end">إجراء</TH>
    </>
  ),
  row: (c, ctx) => (
    <>
      <TD>{c.originalBasisNumber}</TD>
      <TD>{c.basisYear}</TD>
      <TD>{c.publicEntityName}</TD>
      <TD>{PUBLIC_ENTITY_POSITION_LABEL_AR[c.publicEntityPosition]}</TD>
      <TD>{c.opponentName}</TD>
      <TD>{c.lastHearingDate ?? DASH}</TD>
      <TD>{caseSimpleStatus(c)}</TD>
      <ActionCell c={c} ctx={ctx} />
    </>
  ),
};

// ──────────────────────────────────────────────────────────────
// CASSATION — قسم النقض.
//   رقم المتداول · الجهة · صفتها · الخصم · الغرفة · أساس · نتيجة الطعن · إجراء
// ──────────────────────────────────────────────────────────────
export const CASSATION_COLUMNS: CaseColumnSet = {
  head: () => (
    <>
      <TH>رقم المتداول</TH>
      <TH>الجهة</TH>
      <TH>صفتها</TH>
      <TH>الخصم</TH>
      <TH>الغرفة</TH>
      <TH>أساس</TH>
      <TH>نتيجة الطعن</TH>
      <TH className="text-end">إجراء</TH>
    </>
  ),
  row: (c, ctx) => (
    <>
      <TD>{c.circulationNumber ?? DASH}</TD>
      <TD>{c.publicEntityName}</TD>
      <TD>{c.capacity ?? DASH}</TD>
      <TD>{c.opponentName}</TD>
      <TD>{chamberLabel(c)}</TD>
      <TD>{c.originalBasisNumber}</TD>
      <TD>{c.appealResult ?? DASH}</TD>
      <ActionCell c={c} ctx={ctx} />
    </>
  ),
};

// ──────────────────────────────────────────────────────────────
// EXTERNAL_DISPUTES — المنازعات الخارجية.
//   رقم المتداول · الجهة · صفتها · الخصم · الجلسة · سبب التأجيل · إجراء
//
// "سبب التأجيل" is the latest hearing's postponement reason. The list DTO
// does not carry it directly, so we fall back to the current stage's
// `firstPostponementReason` when available, else '—'.
// ──────────────────────────────────────────────────────────────
function latestPostponementReason(c: LitigationCase): string {
  const current = c.stages?.find((s) => s.id === c.currentStageId);
  return current?.firstPostponementReason ?? DASH;
}

export const EXTERNAL_DISPUTES_COLUMNS: CaseColumnSet = {
  head: () => (
    <>
      <TH>رقم المتداول</TH>
      <TH>الجهة</TH>
      <TH>صفتها</TH>
      <TH>الخصم</TH>
      <TH>الجلسة</TH>
      <TH>سبب التأجيل</TH>
      <TH className="text-end">إجراء</TH>
    </>
  ),
  row: (c, ctx) => (
    <>
      <TD>{c.circulationNumber ?? DASH}</TD>
      <TD>{c.publicEntityName}</TD>
      <TD>{c.capacity ?? DASH}</TD>
      <TD>{c.opponentName}</TD>
      <TD>{c.lastHearingDate ?? DASH}</TD>
      <TD>{latestPostponementReason(c)}</TD>
      <ActionCell c={c} ctx={ctx} />
    </>
  ),
};
