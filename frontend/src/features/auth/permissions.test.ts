import { describe, expect, it } from 'vitest';
import {
  canAccessAdminUsers,
  canAddExecutionStep,
  canAssignLawyerForCase,
  canCreateCase,
  canEditCaseBasicData,
  canFinalizeStage,
  canPromoteToAppeal,
  canPromoteToExecution,
  canRolloverHearing,
  canUploadExecutionFileAttachment,
  canUploadStageAttachment,
  hasDelegatedPermission,
  isAssignedLawyerOfStage,
} from './permissions';
import type {
  CurrentUser,
  DepartmentMembership,
  ExecutionFile,
  CaseStage,
  RoleCode,
  DelegatedPermission,
} from '@/shared/types/domain';

function user(
  roles: RoleCode[],
  delegated: Partial<DelegatedPermission>[] = [],
  id = 42,
  memberships: Partial<DepartmentMembership>[] = [],
): CurrentUser {
  return {
    id, username: 'u', fullName: 'U', mobileNumber: '0', active: true,
    defaultBranchId: 1, defaultDepartmentId: 1,
    roles,
    departmentMemberships: memberships.map((m, i) => ({
      id: i, userId: id, branchId: m.branchId ?? 1, departmentId: m.departmentId ?? 1,
      membershipType: m.membershipType ?? 'STATE_LAWYER',
      primary: m.primary ?? false, active: m.active ?? true,
    })),
    courtAccess: [],
    delegatedPermissions: delegated.map((d, i) => ({
      id: i, userId: id, code: d.code ?? 'CREATE_CASE',
      granted: d.granted ?? true, grantedByUserId: null, grantedAt: null,
    })),
  };
}

function stage(over: Partial<CaseStage> = {}): CaseStage {
  return {
    id: 1, litigationCaseId: 10, stageType: 'FIRST_INSTANCE',
    branchId: 1, departmentId: 1, courtId: 1, chamberName: null,
    stageBasisNumber: '1/2026', stageYear: 2026,
    assignedLawyerUserId: 42, stageStatus: 'ASSIGNED',
    parentStageId: null, readOnly: false,
    firstHearingDate: null, firstPostponementReason: null,
    startedAt: null, endedAt: null,
    ...over,
  };
}

function file(over: Partial<ExecutionFile> = {}): ExecutionFile {
  return {
    id: 1, litigationCaseId: 10, sourceStageId: 5,
    enforcingEntityName: 'X', executedAgainstName: 'Y',
    executionFileType: 'A', executionFileNumber: '1', executionYear: 2026,
    branchId: 1, departmentId: 1, assignedUserId: 42,
    status: 'OPEN', createdByUserId: 1,
    createdAt: '', updatedAt: '', ...over,
  };
}

describe('permissions', () => {
  it('hasDelegatedPermission', () => {
    const u = user(['ADMIN_CLERK'], [{ code: 'PROMOTE_TO_APPEAL', granted: true }]);
    expect(hasDelegatedPermission(u, 'PROMOTE_TO_APPEAL')).toBe(true);
    expect(hasDelegatedPermission(u, 'PROMOTE_TO_EXECUTION')).toBe(false);
    expect(hasDelegatedPermission(null, 'PROMOTE_TO_APPEAL')).toBe(false);
  });

  it('isAssignedLawyerOfStage matches by userId', () => {
    expect(isAssignedLawyerOfStage(user(['STATE_LAWYER'], [], 42), stage())).toBe(true);
    expect(isAssignedLawyerOfStage(user(['STATE_LAWYER'], [], 99), stage())).toBe(false);
    expect(isAssignedLawyerOfStage(user(['STATE_LAWYER']), stage({ assignedLawyerUserId: null }))).toBe(false);
  });

  it('canRolloverHearing only the assigned lawyer on a writable, in-progress stage', () => {
    const lawyer = user(['STATE_LAWYER'], [], 42);
    expect(canRolloverHearing(lawyer, stage())).toBe(true);
    expect(canRolloverHearing(lawyer, stage({ stageStatus: 'FINALIZED' }))).toBe(false);
    expect(canRolloverHearing(lawyer, stage({ readOnly: true }))).toBe(false);
    expect(canRolloverHearing(user(['SECTION_HEAD'], [], 99), stage())).toBe(false);
  });

  it('canFinalizeStage: same gating as rollover (D-024)', () => {
    const lawyer = user(['STATE_LAWYER'], [], 42);
    expect(canFinalizeStage(lawyer, stage())).toBe(true);
    expect(canFinalizeStage(lawyer, stage({ stageStatus: 'PROMOTED_TO_APPEAL' }))).toBe(false);
  });

  it('canPromoteToAppeal: SECTION_HEAD or ADMIN_CLERK+PROMOTE_TO_APPEAL', () => {
    expect(canPromoteToAppeal(user(['SECTION_HEAD']))).toBe(true);
    expect(canPromoteToAppeal(user(['ADMIN_CLERK'], [{ code: 'PROMOTE_TO_APPEAL', granted: true }]))).toBe(true);
    expect(canPromoteToAppeal(user(['ADMIN_CLERK']))).toBe(false);
    expect(canPromoteToAppeal(user(['STATE_LAWYER']))).toBe(false);
    expect(canPromoteToAppeal(user(['BRANCH_HEAD']))).toBe(false);
  });

  it('canPromoteToExecution: SECTION_HEAD or ADMIN_CLERK+PROMOTE_TO_EXECUTION', () => {
    expect(canPromoteToExecution(user(['SECTION_HEAD']))).toBe(true);
    expect(canPromoteToExecution(user(['ADMIN_CLERK'], [{ code: 'PROMOTE_TO_EXECUTION', granted: true }]))).toBe(true);
    expect(canPromoteToExecution(user(['ADMIN_CLERK']))).toBe(false);
    expect(canPromoteToExecution(user(['CENTRAL_SUPERVISOR']))).toBe(false);
  });

  it('canAddExecutionStep: assignedUserId, or ADMIN_CLERK+ADD_EXECUTION_STEP, only on open files', () => {
    expect(canAddExecutionStep(user(['STATE_LAWYER'], [], 42), file())).toBe(true);
    expect(canAddExecutionStep(user(['STATE_LAWYER'], [], 99), file())).toBe(false);
    expect(canAddExecutionStep(user(['ADMIN_CLERK'], [{ code: 'ADD_EXECUTION_STEP', granted: true }], 99), file())).toBe(true);
    expect(canAddExecutionStep(user(['STATE_LAWYER'], [], 42), file({ status: 'CLOSED' }))).toBe(false);
    expect(canAddExecutionStep(user(['SECTION_HEAD'], [], 99), file())).toBe(false);
  });

  // ---------- D-036 attachment upload visibility ----------

  it('canUploadStageAttachment: assigned lawyer of stage', () => {
    const lawyer = user(['STATE_LAWYER'], [], 42);
    expect(canUploadStageAttachment(lawyer, stage({ assignedLawyerUserId: 42 }))).toBe(true);
  });

  it('canUploadStageAttachment: SECTION_HEAD/ADMIN_CLERK with active membership in (branch, dept)', () => {
    const head = user(['SECTION_HEAD'], [], 99, [
      { branchId: 1, departmentId: 1, membershipType: 'SECTION_HEAD', active: true },
    ]);
    expect(canUploadStageAttachment(head, stage({ assignedLawyerUserId: 42, branchId: 1, departmentId: 1 }))).toBe(true);

    const clerk = user(['ADMIN_CLERK'], [], 100, [
      { branchId: 1, departmentId: 1, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canUploadStageAttachment(clerk, stage({ assignedLawyerUserId: 42, branchId: 1, departmentId: 1 }))).toBe(true);
  });

  it('canUploadStageAttachment: false for unrelated lawyer or inactive/wrong-dept membership', () => {
    const otherLawyer = user(['STATE_LAWYER'], [], 99);
    expect(canUploadStageAttachment(otherLawyer, stage({ assignedLawyerUserId: 42 }))).toBe(false);

    const wrongDept = user(['SECTION_HEAD'], [], 99, [
      { branchId: 1, departmentId: 2, membershipType: 'SECTION_HEAD', active: true },
    ]);
    expect(canUploadStageAttachment(wrongDept, stage({ assignedLawyerUserId: 42, branchId: 1, departmentId: 1 }))).toBe(false);

    const inactive = user(['SECTION_HEAD'], [], 99, [
      { branchId: 1, departmentId: 1, membershipType: 'SECTION_HEAD', active: false },
    ]);
    expect(canUploadStageAttachment(inactive, stage({ branchId: 1, departmentId: 1 }))).toBe(false);
  });

  it('canUploadExecutionFileAttachment: assignedUserId or in-dept SECTION_HEAD/ADMIN_CLERK', () => {
    expect(canUploadExecutionFileAttachment(user(['STATE_LAWYER'], [], 42), file({ assignedUserId: 42 }))).toBe(true);
    const head = user(['SECTION_HEAD'], [], 99, [
      { branchId: 1, departmentId: 1, membershipType: 'SECTION_HEAD', active: true },
    ]);
    expect(canUploadExecutionFileAttachment(head, file({ assignedUserId: 42, branchId: 1, departmentId: 1 }))).toBe(true);
    expect(canUploadExecutionFileAttachment(user(['STATE_LAWYER'], [], 99), file({ assignedUserId: 42 }))).toBe(false);
  });

  // ---------- Phase 11 — admin gates ----------

  it('canCreateCase: SECTION_HEAD member, OR ADMIN_CLERK member with CREATE_CASE delegation', () => {
    const head = user(['SECTION_HEAD'], [], 1, [
      { branchId: 1, departmentId: 2, membershipType: 'SECTION_HEAD', active: true },
    ]);
    expect(canCreateCase(head)).toBe(true);

    const clerkNoDeleg = user(['ADMIN_CLERK'], [], 2, [
      { branchId: 1, departmentId: 2, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canCreateCase(clerkNoDeleg)).toBe(false);

    const clerkOk = user(['ADMIN_CLERK'], [{ code: 'CREATE_CASE', granted: true }], 3, [
      { branchId: 1, departmentId: 2, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canCreateCase(clerkOk)).toBe(true);

    const lawyer = user(['STATE_LAWYER'], [], 4, [
      { branchId: 1, departmentId: 2, membershipType: 'STATE_LAWYER', active: true },
    ]);
    expect(canCreateCase(lawyer)).toBe(false);

    expect(canCreateCase(null)).toBe(false);
  });

  it('canEditCaseBasicData: must match the case (branch, dept) — backend D-021/D-004 mirror', () => {
    const head = user(['SECTION_HEAD'], [], 1, [
      { branchId: 1, departmentId: 2, membershipType: 'SECTION_HEAD', active: true },
    ]);
    expect(canEditCaseBasicData(head, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(true);
    expect(canEditCaseBasicData(head, { createdBranchId: 1, createdDepartmentId: 9 })).toBe(false);

    const clerk = user(['ADMIN_CLERK'], [{ code: 'EDIT_CASE_BASIC_DATA', granted: true }], 2, [
      { branchId: 1, departmentId: 2, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canEditCaseBasicData(clerk, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(true);

    const clerkNoDeleg = user(['ADMIN_CLERK'], [], 3, [
      { branchId: 1, departmentId: 2, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canEditCaseBasicData(clerkNoDeleg, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);

    const lawyer = user(['STATE_LAWYER'], [], 4, [
      { branchId: 1, departmentId: 2, membershipType: 'STATE_LAWYER', active: true },
    ]);
    expect(canEditCaseBasicData(lawyer, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);

    expect(canEditCaseBasicData(null, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);
    expect(canEditCaseBasicData(head, null)).toBe(false);
  });

  // ---------- Mini-Phase A — Assign Lawyer (D-046) ----------

  it('canAssignLawyerForCase: SECTION_HEAD of (branch, dept), or ADMIN_CLERK + ASSIGN_LAWYER', () => {
    const head = user(['SECTION_HEAD'], [], 1, [
      { branchId: 1, departmentId: 2, membershipType: 'SECTION_HEAD', active: true },
    ]);
    expect(canAssignLawyerForCase(head, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(true);
    expect(canAssignLawyerForCase(head, { createdBranchId: 1, createdDepartmentId: 9 })).toBe(false);

    const clerkOk = user(['ADMIN_CLERK'], [{ code: 'ASSIGN_LAWYER', granted: true }], 2, [
      { branchId: 1, departmentId: 2, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canAssignLawyerForCase(clerkOk, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(true);

    const clerkNoDeleg = user(['ADMIN_CLERK'], [], 3, [
      { branchId: 1, departmentId: 2, membershipType: 'ADMIN_CLERK', active: true },
    ]);
    expect(canAssignLawyerForCase(clerkNoDeleg, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);

    // Other roles never see the section, even with the delegation bit set.
    const lawyer = user(['STATE_LAWYER'], [{ code: 'ASSIGN_LAWYER', granted: true }], 4, [
      { branchId: 1, departmentId: 2, membershipType: 'STATE_LAWYER', active: true },
    ]);
    expect(canAssignLawyerForCase(lawyer, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);

    const branchHead = user(['BRANCH_HEAD'], [], 5, [
      { branchId: 1, departmentId: null as unknown as number,
        membershipType: 'BRANCH_HEAD', active: true },
    ]);
    expect(canAssignLawyerForCase(branchHead, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);

    const central = user(['CENTRAL_SUPERVISOR'], [], 6, []);
    expect(canAssignLawyerForCase(central, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);

    expect(canAssignLawyerForCase(null, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);
    expect(canAssignLawyerForCase(head, null)).toBe(false);

    // Inactive membership should be rejected.
    const inactiveHead = user(['SECTION_HEAD'], [], 7, [
      { branchId: 1, departmentId: 2, membershipType: 'SECTION_HEAD', active: false },
    ]);
    expect(canAssignLawyerForCase(inactiveHead, { createdBranchId: 1, createdDepartmentId: 2 })).toBe(false);
  });

  it('canAccessAdminUsers — only CENTRAL_SUPERVISOR (UI sub-phase B)', () => {
    expect(canAccessAdminUsers(user(['CENTRAL_SUPERVISOR']))).toBe(true);
    for (const r of ['BRANCH_HEAD','SECTION_HEAD','ADMIN_CLERK','STATE_LAWYER','READ_ONLY_SUPERVISOR','SPECIAL_INSPECTOR'] as const) {
      expect(canAccessAdminUsers(user([r]))).toBe(false);
    }
    expect(canAccessAdminUsers(null)).toBe(false);
  });
});
