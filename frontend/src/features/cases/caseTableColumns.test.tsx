// Phase 2 (Damascus registers) — per-register column-set rendering.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  DEFAULT_COLUMNS,
  CASSATION_COLUMNS,
  EXTERNAL_DISPUTES_COLUMNS,
  type CaseColumnSet,
  type CaseRowContext,
} from './caseTableColumns';
import type { CaseStage, LitigationCase } from '@/shared/types/domain';

function stage(over: Partial<CaseStage> = {}): CaseStage {
  return {
    id: 99, litigationCaseId: 7, stageType: 'SINGLE_INSTANCE',
    branchId: 1, departmentId: 59, courtId: 5, chamberName: 'الغرفة الجزائية الأولى',
    stageBasisNumber: '654', stageYear: 2026,
    assignedLawyerUserId: null, assignedLawyerFullName: null, stageStatus: 'REGISTERED',
    parentStageId: null, readOnly: false,
    firstHearingDate: '2026-06-06', firstPostponementReason: 'تدقيق',
    startedAt: '2026-06-06T00:00:00Z', endedAt: null,
    ...over,
  };
}

function lc(over: Partial<LitigationCase> = {}): LitigationCase {
  return {
    id: 7, publicEntityName: 'السورية للاتصالات', publicEntityPosition: 'PLAINTIFF',
    opponentName: 'سمير البدور', originalBasisNumber: '654', basisYear: 2026,
    originalRegistrationDate: '2026-06-06',
    createdBranchId: 1, createdDepartmentId: 59, createdCourtId: 5,
    chamberName: 'الغرفة الجزائية الأولى', courtType: 'GENERAL',
    currentStageId: 99, currentOwnerUserId: null, currentOwnerFullName: null,
    lifecycleStatus: 'ACTIVE', createdByUserId: 1,
    createdAt: '2026-06-06T00:00:00Z', updatedAt: '2026-06-06T00:00:00Z',
    lastHearingDate: '2026-06-06',
    circulationNumber: '43', capacity: 'طاعن', appealResult: 'قبول الطعن موضوعاً',
    stages: [stage()],
    ...over,
  };
}

function renderSet(set: CaseColumnSet, c: LitigationCase, ctx: CaseRowContext) {
  return render(
    <table>
      <thead><tr>{set.head()}</tr></thead>
      <tbody><tr>{set.row(c, ctx)}</tr></tbody>
    </table>,
  );
}

describe('DEFAULT_COLUMNS', () => {
  it('renders the classic case columns and fires onOpen', () => {
    const onOpen = vi.fn();
    renderSet(DEFAULT_COLUMNS, lc(), { onOpen });
    expect(screen.getByText('رقم الأساس')).toBeInTheDocument();
    expect(screen.getByText('قائمة')).toBeInTheDocument(); // caseSimpleStatus
    fireEvent.click(screen.getByText('فتح'));
    expect(onOpen).toHaveBeenCalledWith(7);
  });

  it('shows the admin delete button when onDelete is provided', () => {
    const onDelete = vi.fn();
    renderSet(DEFAULT_COLUMNS, lc(), { onOpen: vi.fn(), onDelete });
    fireEvent.click(screen.getByTestId('case-delete'));
    expect(onDelete).toHaveBeenCalledWith(7, '654');
  });
});

describe('CASSATION_COLUMNS', () => {
  it('renders the cassation-specific columns and values', () => {
    renderSet(CASSATION_COLUMNS, lc(), { onOpen: vi.fn() });
    for (const h of ['رقم المتداول', 'صفتها', 'الغرفة', 'نتيجة الطعن'])
      expect(screen.getByText(h)).toBeInTheDocument();
    const body = within(screen.getAllByRole('rowgroup')[1]);
    expect(body.getByText('43')).toBeInTheDocument();
    expect(body.getByText('طاعن')).toBeInTheDocument();
    expect(body.getByText('قبول الطعن موضوعاً')).toBeInTheDocument();
  });

  it('falls back to — for missing cassation fields', () => {
    renderSet(CASSATION_COLUMNS, lc({ circulationNumber: null, capacity: null, appealResult: null, chamberName: null }),
      { onOpen: vi.fn() });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });
});

describe('EXTERNAL_DISPUTES_COLUMNS', () => {
  it('shows الجلسة and the current stage postponement reason', () => {
    renderSet(EXTERNAL_DISPUTES_COLUMNS, lc(), { onOpen: vi.fn() });
    expect(screen.getByText('سبب التأجيل')).toBeInTheDocument();
    const body = within(screen.getAllByRole('rowgroup')[1]);
    expect(body.getByText('تدقيق')).toBeInTheDocument();
  });

  it('falls back to — when the current stage is not found', () => {
    renderSet(EXTERNAL_DISPUTES_COLUMNS, lc({ currentStageId: 12345 }), { onOpen: vi.fn() });
    const body = within(screen.getAllByRole('rowgroup')[1]);
    expect(body.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
