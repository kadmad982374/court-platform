// Mini-Phase A — Assign Lawyer (D-046).
//
// Component-level tests. We mock the two network calls to keep this hermetic:
//   * @/shared/api/users  → listAssignableLawyers
//   * ./api               → assignLawyer
// We also mock the Auth context so we can drive the visibility gate.
//
// We render with a fresh QueryClient per test (no retries) to keep the suite
// deterministic.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { AssignLawyerSection, lawyerLabel } from './AssignLawyerSection';
import type { CurrentUser, LitigationCase } from '@/shared/types/domain';

// ---------- mocks ----------

vi.mock('@/shared/api/users', () => ({
  listAssignableLawyers: vi.fn(),
}));
vi.mock('./api', () => ({
  assignLawyer: vi.fn(),
}));

const mockedAuth = vi.hoisted(() => ({ user: null as CurrentUser | null }));
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => mockedAuth,
}));

import { listAssignableLawyers } from '@/shared/api/users';
import { assignLawyer } from './api';

// ---------- helpers ----------

function makeUser(over: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 1, username: 'u', fullName: 'U', mobileNumber: '0', active: true,
    defaultBranchId: 1, defaultDepartmentId: 2,
    roles: ['SECTION_HEAD'],
    departmentMemberships: [
      { id: 1, userId: 1, branchId: 1, departmentId: 2,
        membershipType: 'SECTION_HEAD', primary: true, active: true },
    ],
    courtAccess: [],
    delegatedPermissions: [],
    ...over,
  };
}

function makeCase(over: Partial<LitigationCase> = {}): LitigationCase {
  return {
    id: 100,
    publicEntityName: 'X', publicEntityPosition: 'PLAINTIFF', opponentName: 'Y',
    originalBasisNumber: '1', basisYear: 2026, originalRegistrationDate: '2026-01-01',
    createdBranchId: 1, createdDepartmentId: 2, createdCourtId: 1, chamberName: null,
    currentStageId: 10, currentOwnerUserId: null, lifecycleStatus: 'NEW',
    createdByUserId: 1, createdAt: '', updatedAt: '', stages: [],
    ...over,
  };
}

function wrap(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockedAuth.user = null;
});

// ============================================================
// pure helper
// ============================================================
describe('lawyerLabel', () => {
  it('returns the resolved fullName when found', () => {
    expect(
      lawyerLabel(7, [{ id: 7, fullName: 'أحمد', username: 'a', active: true }]),
    ).toBe('أحمد');
  });
  it('falls back to #id when not in list', () => {
    expect(lawyerLabel(7, [])).toBe('#7');
    expect(lawyerLabel(7, undefined)).toBe('#7');
  });
  it('returns the empty-owner placeholder when null', () => {
    expect(lawyerLabel(null, [])).toBe('— (لا مالك)');
  });
});

// ============================================================
// component visibility gate
// ============================================================
describe('AssignLawyerSection visibility', () => {
  it('hides for unauthorized users (e.g., STATE_LAWYER)', () => {
    mockedAuth.user = makeUser({
      roles: ['STATE_LAWYER'],
      departmentMemberships: [
        { id: 1, userId: 1, branchId: 1, departmentId: 2,
          membershipType: 'STATE_LAWYER', primary: true, active: true },
      ],
    });
    wrap(<AssignLawyerSection litigationCase={makeCase()} />);
    expect(screen.queryByTestId('assign-lawyer-section')).toBeNull();
    expect(listAssignableLawyers).not.toHaveBeenCalled();
  });

  it('shows for SECTION_HEAD of the case (branch, dept)', async () => {
    mockedAuth.user = makeUser();
    (listAssignableLawyers as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue([
        { id: 7, fullName: 'أحمد', username: 'a', active: true },
        { id: 8, fullName: 'زياد', username: 'z', active: true },
      ]);
    wrap(<AssignLawyerSection litigationCase={makeCase()} />);
    expect(screen.getByTestId('assign-lawyer-section')).not.toBeNull();
    await waitFor(() => {
      expect(listAssignableLawyers).toHaveBeenCalled();
    });
    const callArgs = (listAssignableLawyers as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe(1);
    expect(callArgs[1]).toBe(2);
  });

  it('shows for ADMIN_CLERK with ASSIGN_LAWYER delegation', () => {
    mockedAuth.user = makeUser({
      roles: ['ADMIN_CLERK'],
      departmentMemberships: [
        { id: 1, userId: 1, branchId: 1, departmentId: 2,
          membershipType: 'ADMIN_CLERK', primary: true, active: true },
      ],
      delegatedPermissions: [
        { id: 1, userId: 1, code: 'ASSIGN_LAWYER',
          granted: true, grantedByUserId: null, grantedAt: null },
      ],
    });
    wrap(<AssignLawyerSection litigationCase={makeCase()} />);
    expect(screen.getByTestId('assign-lawyer-section')).not.toBeNull();
  });

  it('hides for ADMIN_CLERK without ASSIGN_LAWYER delegation', () => {
    mockedAuth.user = makeUser({
      roles: ['ADMIN_CLERK'],
      departmentMemberships: [
        { id: 1, userId: 1, branchId: 1, departmentId: 2,
          membershipType: 'ADMIN_CLERK', primary: true, active: true },
      ],
    });
    wrap(<AssignLawyerSection litigationCase={makeCase()} />);
    expect(screen.queryByTestId('assign-lawyer-section')).toBeNull();
  });
});

// ============================================================
// list loading + assignment success/failure
// ============================================================
describe('AssignLawyerSection behavior', () => {
  it('renders the fetched list and submits the picked lawyerUserId', async () => {
    mockedAuth.user = makeUser();
    (listAssignableLawyers as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue([
        { id: 7, fullName: 'أحمد', username: 'a', active: true },
        { id: 8, fullName: 'زياد', username: 'z', active: true },
      ]);
    (assignLawyer as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue(makeCase({ currentOwnerUserId: 7 }));

    wrap(<AssignLawyerSection litigationCase={makeCase()} />);

    // Wait until the lawyer options are rendered.
    const select = await screen.findByLabelText('lawyer-picker') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
    });

    fireEvent.change(select, { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('assign-lawyer-submit'));

    await waitFor(() => expect(assignLawyer).toHaveBeenCalledWith(100, 7));
    await waitFor(() => {
      expect(screen.queryByTestId('assign-lawyer-success')).not.toBeNull();
    });
  });

  it('surfaces a backend error message on failure', async () => {
    mockedAuth.user = makeUser();
    (listAssignableLawyers as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValue([{ id: 7, fullName: 'أحمد', username: 'a', active: true }]);
    (assignLawyer as unknown as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('boom'));

    wrap(<AssignLawyerSection litigationCase={makeCase()} />);
    const select = await screen.findByLabelText('lawyer-picker') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.querySelectorAll('option').length).toBeGreaterThan(1);
    });
    fireEvent.change(select, { target: { value: '7' } });
    fireEvent.click(screen.getByTestId('assign-lawyer-submit'));

    await waitFor(() => {
      expect(screen.queryByTestId('assign-lawyer-error')).not.toBeNull();
    });
  });
});


