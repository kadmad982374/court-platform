// Frontend permission helpers for hiding/disabling UI actions.
//
// IMPORTANT: These helpers are *visual-only*. The real authoritative checks live
// in the backend (D-021/D-024/D-027/D-030/D-036/D-037/D-038/D-042). The UI
// hides controls that the user can't use; if the backend rejects anyway, the
// caller surfaces the error.
//
// Mapping summary (per PROJECT_ASSUMPTIONS_AND_DECISIONS.md):
//   - D-024  rollover/finalize → assigned lawyer of the stage only.
//   - D-027  promote-to-appeal → SECTION_HEAD, OR ADMIN_CLERK with PROMOTE_TO_APPEAL.
//   - D-030  promote-to-execution → SECTION_HEAD, OR ADMIN_CLERK with PROMOTE_TO_EXECUTION.
//   - D-031  ExecutionStep is append-only.
//   - D-032  After promote-to-execution, ownership = ExecutionFile.assignedUserId.
//            Only the assignedUserId can add execution steps (lawyer-style ownership),
//            OR an ADMIN_CLERK with ADD_EXECUTION_STEP delegation.

import type {
  CaseStage,
  CurrentUser,
  DelegatedPermissionCode,
  ExecutionFile,
  RoleCode,
  Stage,
} from '@/shared/types/domain';

export function hasRole(user: CurrentUser | null, role: RoleCode): boolean {
  return !!user && user.roles.includes(role);
}

export function hasAnyRole(user: CurrentUser | null, roles: readonly RoleCode[]): boolean {
  if (!user) return false;
  if (roles.length === 0) return true;
  return user.roles.some((r) => roles.includes(r));
}

/** Active, granted delegated permission. */
export function hasDelegatedPermission(
  user: CurrentUser | null,
  code: DelegatedPermissionCode,
): boolean {
  if (!user) return false;
  return user.delegatedPermissions.some((p) => p.code === code && p.granted);
}

export function isAssignedLawyerOfStage(
  user: CurrentUser | null,
  stage: Pick<CaseStage | Stage, 'assignedLawyerUserId'> | null | undefined,
): boolean {
  if (!user || !stage) return false;
  return stage.assignedLawyerUserId != null && stage.assignedLawyerUserId === user.id;
}

export function isAssignedToExecutionFile(
  user: CurrentUser | null,
  file: Pick<ExecutionFile, 'assignedUserId'> | null | undefined,
): boolean {
  if (!user || !file) return false;
  return file.assignedUserId != null && file.assignedUserId === user.id;
}

// ---------- Action gates ----------

/** D-024 — only the assigned lawyer rolls over hearings or finalizes. */
export function canRolloverHearing(
  user: CurrentUser | null,
  stage: Pick<CaseStage | Stage, 'assignedLawyerUserId' | 'stageStatus' | 'readOnly'> | null,
): boolean {
  if (!stage || stage.readOnly) return false;
  if (stage.stageStatus === 'FINALIZED' || stage.stageStatus === 'ARCHIVED'
      || stage.stageStatus === 'PROMOTED_TO_APPEAL'
      || stage.stageStatus === 'PROMOTED_TO_EXECUTION') return false;
  return isAssignedLawyerOfStage(user, stage);
}

export function canFinalizeStage(
  user: CurrentUser | null,
  stage: Pick<CaseStage | Stage, 'assignedLawyerUserId' | 'stageStatus' | 'readOnly'> | null,
): boolean {
  if (!stage || stage.readOnly) return false;
  if (stage.stageStatus === 'FINALIZED' || stage.stageStatus === 'ARCHIVED'
      || stage.stageStatus === 'PROMOTED_TO_APPEAL'
      || stage.stageStatus === 'PROMOTED_TO_EXECUTION') return false;
  return isAssignedLawyerOfStage(user, stage);
}

/** D-027 — SECTION_HEAD, OR ADMIN_CLERK with PROMOTE_TO_APPEAL delegation. */
export function canPromoteToAppeal(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (hasRole(user, 'SECTION_HEAD')) return true;
  if (hasRole(user, 'ADMIN_CLERK') && hasDelegatedPermission(user, 'PROMOTE_TO_APPEAL')) return true;
  return false;
}

/**
 * Customer feedback round-2: "نقل الملف إلى الصلح".
 * Same gate as canPromoteToAppeal — we reuse the PROMOTE_TO_APPEAL delegation
 * for clerks rather than introducing a new code, since the trust level is
 * identical and the customer treats both as administrative file transfers.
 */
export function canPromoteToConciliation(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (hasRole(user, 'SECTION_HEAD')) return true;
  if (hasRole(user, 'ADMIN_CLERK') && hasDelegatedPermission(user, 'PROMOTE_TO_APPEAL')) return true;
  return false;
}

/** D-030 — SECTION_HEAD, OR ADMIN_CLERK with PROMOTE_TO_EXECUTION delegation. */
export function canPromoteToExecution(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (hasRole(user, 'SECTION_HEAD')) return true;
  if (hasRole(user, 'ADMIN_CLERK') && hasDelegatedPermission(user, 'PROMOTE_TO_EXECUTION')) return true;
  return false;
}

/**
 * PR-12 (customer feedback Q-E, stricter than the original D-2 default):
 * step-level activity is reserved for the user assigned to the execution
 * file (the lawyer working it). ADMIN_CLERK is now banned regardless of any
 * ADD_EXECUTION_STEP delegation, and SECTION_HEAD/BRANCH_HEAD never had a
 * path. Backend re-validates with 403.
 */
export function canAddExecutionStep(
  user: CurrentUser | null,
  file: Pick<ExecutionFile, 'assignedUserId' | 'status'> | null,
): boolean {
  if (!user || !file) return false;
  if (file.status === 'CLOSED' || file.status === 'ARCHIVED') return false;
  return isAssignedToExecutionFile(user, file);
}

/**
 * PR-12 (customer feedback C-7 / D-2): step-level visibility is narrower
 * than file-level. Managers see only the file row — never the step
 * timeline. Read-paths allowed: the assigned lawyer, or supervisors
 * (CENTRAL_SUPERVISOR / READ_ONLY_SUPERVISOR / SPECIAL_INSPECTOR).
 */
export function canViewExecutionSteps(
  user: CurrentUser | null,
  file: Pick<ExecutionFile, 'assignedUserId'> | null,
): boolean {
  if (!user || !file) return false;
  if (isAssignedToExecutionFile(user, file)) return true;
  return hasRole(user, 'CENTRAL_SUPERVISOR')
      || hasRole(user, 'READ_ONLY_SUPERVISOR')
      || hasRole(user, 'SPECIAL_INSPECTOR');
}

/**
 * Phase 11 — Create-case (D-004 + backend `requireCaseManagement(..., CREATE_CASE)`).
 *
 * Backend gate: SECTION_HEAD of the target (branch, dept) → allowed; ADMIN_CLERK
 * of the target (branch, dept) WITH `CREATE_CASE` delegation → allowed.
 *
 * Visual-only client gate (the screen filters branches/departments to the user's
 * own memberships anyway): show the "+ إنشاء دعوى" entry-point if the user is at
 * least a SECTION_HEAD member somewhere, OR an ADMIN_CLERK member somewhere with
 * `CREATE_CASE` delegation. Backend re-validates per (branchId, departmentId).
 */
export function canCreateCase(user: CurrentUser | null): boolean {
  if (!user) return false;
  const isSectionHeadMember = user.departmentMemberships.some(
    (m) => m.active && m.membershipType === 'SECTION_HEAD',
  );
  if (isSectionHeadMember) return true;
  const isClerkMember = user.departmentMemberships.some(
    (m) => m.active && m.membershipType === 'ADMIN_CLERK',
  );
  return isClerkMember && hasDelegatedPermission(user, 'CREATE_CASE');
}

/**
 * Edit-case-basic-data — SECTION_HEAD ONLY.
 *
 * Customer feedback round-2 (PR-15a): the ADMIN_CLERK path is removed.
 * Clerks can no longer edit basic case data, even with the legacy
 * EDIT_CASE_BASIC_DATA delegation. Only the section head of the case's
 * (createdBranchId, createdDepartmentId) is allowed.
 *
 * Backend authority is final — `LitigationCaseService.updateBasicData`
 * is tightened to match.
 */
export function canEditCaseBasicData(
  user: CurrentUser | null,
  caseRef: { createdBranchId: number; createdDepartmentId: number } | null,
): boolean {
  if (!user || !caseRef) return false;
  return user.departmentMemberships.some(
    (m) =>
      m.active &&
      m.branchId === caseRef.createdBranchId &&
      m.departmentId === caseRef.createdDepartmentId &&
      m.membershipType === 'SECTION_HEAD',
  );
}

/**
 * True if the user has an active SECTION_HEAD or ADMIN_CLERK membership
 * in (branchId, departmentId). This is a conservative client-side hint;
 * backend re-checks D-036 unconditionally.
 */
function hasSectionHeadOrClerkMembership(
  user: CurrentUser | null, branchId: number, departmentId: number,
): boolean {
  if (!user) return false;
  return user.departmentMemberships.some(
    (m) =>
      m.active &&
      m.branchId === branchId &&
      m.departmentId === departmentId &&
      (m.membershipType === 'SECTION_HEAD' || m.membershipType === 'ADMIN_CLERK'),
  );
}

/**
 * D-036 — Stage attachment upload allowed for the assigned lawyer
 * OR a SECTION_HEAD/ADMIN_CLERK in the stage's (branchId, departmentId).
 */
export function canUploadStageAttachment(
  user: CurrentUser | null,
  stage: Pick<CaseStage, 'branchId' | 'departmentId' | 'assignedLawyerUserId'> | null,
): boolean {
  if (!user || !stage) return false;
  if (stage.assignedLawyerUserId != null && stage.assignedLawyerUserId === user.id) return true;
  return hasSectionHeadOrClerkMembership(user, stage.branchId, stage.departmentId);
}

/**
 * D-036 — Execution-file attachment upload allowed for the assignedUserId
 * OR a SECTION_HEAD/ADMIN_CLERK in the file's (branchId, departmentId).
 */
export function canUploadExecutionFileAttachment(
  user: CurrentUser | null,
  file: Pick<ExecutionFile, 'branchId' | 'departmentId' | 'assignedUserId'> | null,
): boolean {
  if (!user || !file) return false;
  if (isAssignedToExecutionFile(user, file)) return true;
  return hasSectionHeadOrClerkMembership(user, file.branchId, file.departmentId);
}

/**
 * Mini-Phase A — Assign Lawyer (D-046).
 *
 * Visual-only gate for {@code AssignLawyerSection}. Backend authority:
 *   - SECTION_HEAD with active membership in the case's
 *     (createdBranchId, createdDepartmentId) → allowed.
 *   - ADMIN_CLERK with active membership in the case's
 *     (createdBranchId, createdDepartmentId) AND
 *     ASSIGN_LAWYER delegation → allowed.
 *   - Anyone else → hidden in UI; backend re-validates with 403.
 *
 * Reference:
 *   docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
 *   docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
 */
export function canAssignLawyerForCase(
  user: CurrentUser | null,
  caseRef: { createdBranchId: number; createdDepartmentId: number } | null,
): boolean {
  if (!user || !caseRef) return false;
  const inDept = (mt: 'SECTION_HEAD' | 'ADMIN_CLERK') =>
    user.departmentMemberships.some(
      (m) =>
        m.active &&
        m.branchId === caseRef.createdBranchId &&
        m.departmentId === caseRef.createdDepartmentId &&
        m.membershipType === mt,
    );
  if (inDept('SECTION_HEAD')) return true;
  return inDept('ADMIN_CLERK') && hasDelegatedPermission(user, 'ASSIGN_LAWYER');
}

/**
 * Correct-finalized-case — SECTION_HEAD ONLY.
 *
 * Q-D rule (customer): correction rights are anchored to the CURRENT
 * stage's (branch, dept). After promotion the previous stage becomes
 * read-only and rights move to the destination dept's section head.
 *
 * Customer feedback round-2 (PR-15a): clerks are blocked from editing
 * basic data anywhere — including finalized-case correction in the
 * resolved register. Only the SECTION_HEAD of the stage's (branch, dept)
 * may correct finalized cases.
 *
 * Visual gate (backend re-validates):
 *   - Stage MUST be FINALIZED and NOT read-only.
 *   - Actor must be SECTION_HEAD of the stage's (branch, dept).
 */
export function canCorrectFinalizedCase(
  user: CurrentUser | null,
  stage: Pick<CaseStage | Stage, 'branchId' | 'departmentId' | 'stageStatus' | 'readOnly'> | null,
): boolean {
  if (!user || !stage) return false;
  if (stage.readOnly) return false;
  if (stage.stageStatus !== 'FINALIZED') return false;
  return user.departmentMemberships.some(
    (m) =>
      m.active &&
      m.branchId === stage.branchId &&
      m.departmentId === stage.departmentId &&
      m.membershipType === 'SECTION_HEAD',
  );
}

/**
 * PR-14 (customer feedback A-1 / Q-G expansion) — visual gate for the
 * broadcast composer. Backend re-validates scope per request.
 *
 * Allowed senders:
 *  - CENTRAL_SUPERVISOR (admin) → can broadcast to ALL / BRANCH / DEPARTMENT / USERS.
 *  - BRANCH_HEAD (any active membership of type BRANCH_HEAD) → own branch.
 *  - SECTION_HEAD (any active membership of type SECTION_HEAD) → own department.
 *
 * READ_ONLY_SUPERVISOR / SPECIAL_INSPECTOR / ADMIN_CLERK / STATE_LAWYER → false.
 */
export function canBroadcastNotification(user: CurrentUser | null): boolean {
  if (!user) return false;
  if (hasRole(user, 'CENTRAL_SUPERVISOR')) return true;
  return user.departmentMemberships.some(
    (m) => m.active
        && (m.membershipType === 'BRANCH_HEAD'
         || m.membershipType === 'SECTION_HEAD'),
  );
}

/**
 * UI sub-phase B — `/admin/users` minimal.
 *
 * Visual-only gate for the `/admin/users` route + sidebar entry.
 * Conservative policy chosen for this minimal phase:
 *   - Only `CENTRAL_SUPERVISOR` sees the admin nav entry and route.
 *   - SECTION_HEAD/BRANCH_HEAD narrower sub-surfaces that the backend
 *     allows (per-section delegations / per-branch memberships) are
 *     intentionally NOT exposed here; they keep using the existing
 *     per-case helpers (canAssignLawyerForCase, etc.). Tracked in
 *     `docs/project-ui/UI_ADMIN_USERS_SUBPHASE_B.md` §"Out of scope".
 *
 * Backend remains the only authority. Even if this returns true, every
 * admin endpoint re-checks roles per request (D-047 / D-048).
 */
export function canAccessAdminUsers(user: CurrentUser | null): boolean {
  return hasRole(user, 'CENTRAL_SUPERVISOR');
}

