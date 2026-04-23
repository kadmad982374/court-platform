// Shared API/domain TypeScript types — mirror backend records exactly.
//
// Phase 9 expansion: cases / stages / progression / decisions / resolved register / execution.
// Fixes from Phase 8:
//   - DelegatedPermission shape was wrong; corrected here without touching backend.

// ============================================================
// Roles & memberships
// ============================================================

/** Backend role enum (sy.gov.sla.access.domain.RoleType). */
export type RoleCode =
  | 'CENTRAL_SUPERVISOR'
  | 'BRANCH_HEAD'
  | 'SECTION_HEAD'
  | 'ADMIN_CLERK'
  | 'STATE_LAWYER'
  | 'READ_ONLY_SUPERVISOR'
  | 'SPECIAL_INSPECTOR';

export const ALL_ROLES: RoleCode[] = [
  'CENTRAL_SUPERVISOR',
  'BRANCH_HEAD',
  'SECTION_HEAD',
  'ADMIN_CLERK',
  'STATE_LAWYER',
  'READ_ONLY_SUPERVISOR',
  'SPECIAL_INSPECTOR',
];

export const ROLE_LABEL_AR: Record<RoleCode, string> = {
  CENTRAL_SUPERVISOR:   'مشرف مركزي',
  BRANCH_HEAD:          'رئيس فرع',
  SECTION_HEAD:         'رئيس قسم',
  ADMIN_CLERK:          'موظف إداري',
  STATE_LAWYER:         'محامي الدولة',
  READ_ONLY_SUPERVISOR: 'مشرف قراءة فقط',
  SPECIAL_INSPECTOR:    'مفتش خاص',
};

export type MembershipType = 'SECTION_HEAD' | 'ADMIN_CLERK' | 'STATE_LAWYER' | 'BRANCH_HEAD';

/** UI sub-phase B — admin select tuples + Arabic labels. */
export const MEMBERSHIP_TYPES: readonly MembershipType[] = [
  'SECTION_HEAD', 'ADMIN_CLERK', 'STATE_LAWYER', 'BRANCH_HEAD',
] as const;
export const MEMBERSHIP_TYPE_LABEL_AR: Record<MembershipType, string> = {
  SECTION_HEAD: 'رئيس قسم',
  ADMIN_CLERK:  'موظف إداري',
  STATE_LAWYER: 'محامي الدولة',
  BRANCH_HEAD:  'رئيس فرع',
};

/** Backend access.domain.DelegatedPermissionCode. */
export type DelegatedPermissionCode =
  | 'CREATE_CASE'
  | 'EDIT_CASE_BASIC_DATA'
  | 'ASSIGN_LAWYER'
  | 'CORRECT_FINALIZED_CASE'
  | 'DIRECT_FINALIZE_CASE'
  | 'MANAGE_COURT_ACCESS'
  | 'PROMOTE_TO_APPEAL'
  | 'PROMOTE_TO_EXECUTION'
  | 'ADD_EXECUTION_STEP';

/** UI sub-phase B — admin select tuple + Arabic labels. */
export const DELEGATED_PERMISSION_CODES: readonly DelegatedPermissionCode[] = [
  'CREATE_CASE', 'EDIT_CASE_BASIC_DATA', 'ASSIGN_LAWYER',
  'CORRECT_FINALIZED_CASE', 'DIRECT_FINALIZE_CASE',
  'MANAGE_COURT_ACCESS', 'PROMOTE_TO_APPEAL',
  'PROMOTE_TO_EXECUTION', 'ADD_EXECUTION_STEP',
] as const;
export const DELEGATED_PERMISSION_LABEL_AR: Record<DelegatedPermissionCode, string> = {
  CREATE_CASE:            'إنشاء دعوى',
  EDIT_CASE_BASIC_DATA:   'تعديل البيانات الأساسية للدعوى',
  ASSIGN_LAWYER:          'إسناد محامٍ',
  CORRECT_FINALIZED_CASE: 'تصحيح دعوى مفصولة',
  DIRECT_FINALIZE_CASE:   'فصل مباشر للدعوى',
  MANAGE_COURT_ACCESS:    'إدارة الوصول للمحاكم',
  PROMOTE_TO_APPEAL:      'ترقية إلى الاستئناف',
  PROMOTE_TO_EXECUTION:   'ترقية إلى التنفيذ',
  ADD_EXECUTION_STEP:     'إضافة خطوة تنفيذية',
};

// ============================================================
// Auth / current user
// ============================================================

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  mobileNumber: string;
  active: boolean;
  defaultBranchId: number | null;
  defaultDepartmentId: number | null;
  roles: RoleCode[];
  departmentMemberships: DepartmentMembership[];
  courtAccess: CourtAccess[];
  delegatedPermissions: DelegatedPermission[];
}

export interface DepartmentMembership {
  id: number;
  userId: number;
  branchId: number;
  departmentId: number | null;
  membershipType: MembershipType;
  primary: boolean;
  active: boolean;
}

export interface CourtAccess {
  id: number;
  userId: number;
  courtId: number;
  grantedByUserId: number | null;
  grantedAt: string;
  active: boolean;
}

/**
 * Phase 9 fix: backend `DelegatedPermissionDto` uses `code`, `grantedByUserId`,
 * `grantedAt`. (Phase 8 declaration `permissionCode` was wrong — corrected here,
 * backend left untouched.)
 */
export interface DelegatedPermission {
  id: number;
  userId: number;
  code: DelegatedPermissionCode;
  granted: boolean;
  grantedByUserId: number | null;
  grantedAt: string | null;
}

// ============================================================
// Generic envelope + error
// ============================================================

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  status?: number;
  timestamp?: string;
  details?: Record<string, unknown>;
}

// ============================================================
// Phase 7 read-only domain (kept from Phase 8)
// ============================================================

export interface LegalCategory {
  id: number; code: string; nameAr: string;
  parentId: number | null; active: boolean; sortOrder: number;
}
export interface LegalLibraryItem {
  id: number; categoryId: number; title: string;
  summary: string | null; bodyText: string;
  keywords: string | null; sourceReference: string | null;
  publishedAt: string | null; active: boolean;
  createdAt: string; updatedAt: string;
}
export interface PublicEntityCategory {
  id: number; code: string; nameAr: string;
  parentId: number | null; active: boolean; sortOrder: number;
}
export interface PublicEntityItem {
  id: number; categoryId: number; nameAr: string;
  shortDescription: string | null; detailsText: string | null;
  keywords: string | null; referenceCode: string | null;
  active: boolean; createdAt: string; updatedAt: string;
}
export type CircularSourceType = 'MINISTRY_OF_JUSTICE' | 'STATE_LITIGATION_ADMINISTRATION';
export const CIRCULAR_SOURCE_LABEL_AR: Record<CircularSourceType, string> = {
  MINISTRY_OF_JUSTICE:             'وزارة العدل',
  STATE_LITIGATION_ADMINISTRATION: 'إدارة قضايا الدولة',
};
export interface Circular {
  id: number; sourceType: CircularSourceType; title: string;
  summary: string | null; bodyText: string; issueDate: string;
  referenceNumber: string | null; keywords: string | null;
  active: boolean; createdAt: string; updatedAt: string;
}

// ============================================================
// Phase 2 — litigation registration
// ============================================================

export type PublicEntityPosition = 'PLAINTIFF' | 'DEFENDANT';
export const PUBLIC_ENTITY_POSITION_LABEL_AR: Record<PublicEntityPosition, string> = {
  PLAINTIFF: 'مدعية',
  DEFENDANT: 'مدّعى عليها',
};

export type StageType = 'CONCILIATION' | 'FIRST_INSTANCE' | 'APPEAL';
export const STAGE_TYPE_LABEL_AR: Record<StageType, string> = {
  CONCILIATION:   'مصالحة',
  FIRST_INSTANCE: 'بداية',
  APPEAL:         'استئناف',
};

export type StageStatus =
  | 'REGISTERED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'FINALIZED'
  | 'PROMOTED_TO_APPEAL'
  | 'PROMOTED_TO_EXECUTION'
  | 'ARCHIVED';
export const STAGE_STATUS_LABEL_AR: Record<StageStatus, string> = {
  REGISTERED:            'مسجَّلة',
  ASSIGNED:              'مُسنَدة',
  IN_PROGRESS:           'قيد المتابعة',
  FINALIZED:             'مفصولة',
  PROMOTED_TO_APPEAL:    'مُرقّاة إلى الاستئناف',
  PROMOTED_TO_EXECUTION: 'مُرقّاة إلى التنفيذ',
  ARCHIVED:              'مؤرشفة',
};

export type LifecycleStatus = 'NEW' | 'ACTIVE' | 'IN_APPEAL' | 'IN_EXECUTION' | 'CLOSED';
export const LIFECYCLE_LABEL_AR: Record<LifecycleStatus, string> = {
  NEW:          'جديدة',
  ACTIVE:       'فعّالة',
  IN_APPEAL:    'في الاستئناف',
  IN_EXECUTION: 'في التنفيذ',
  CLOSED:       'مغلقة',
};

export interface CaseStage {
  id: number;
  litigationCaseId: number;
  stageType: StageType;
  branchId: number;
  departmentId: number;
  courtId: number;
  chamberName: string | null;
  stageBasisNumber: string;
  stageYear: number;
  assignedLawyerUserId: number | null;
  stageStatus: StageStatus;
  parentStageId: number | null;
  readOnly: boolean;
  firstHearingDate: string | null;
  firstPostponementReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
}

export interface LitigationCase {
  id: number;
  publicEntityName: string;
  publicEntityPosition: PublicEntityPosition;
  opponentName: string;
  originalBasisNumber: string;
  basisYear: number;
  originalRegistrationDate: string;
  createdBranchId: number;
  createdDepartmentId: number;
  createdCourtId: number;
  chamberName: string | null;
  currentStageId: number | null;
  currentOwnerUserId: number | null;
  lifecycleStatus: LifecycleStatus;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  stages: CaseStage[];
}

// ============================================================
// Phase 3 — progression + finalization
// ============================================================

export type EntryType = 'INITIAL' | 'ROLLOVER' | 'FINALIZED';
export const ENTRY_TYPE_LABEL_AR: Record<EntryType, string> = {
  INITIAL:   'تعيين أول',
  ROLLOVER:  'ترحيل',
  FINALIZED: 'فصل',
};

export interface Stage {
  id: number;
  litigationCaseId: number;
  stageType: StageType;
  branchId: number;
  departmentId: number;
  courtId: number;
  assignedLawyerUserId: number | null;
  stageStatus: StageStatus;
  readOnly: boolean;
  endedAt: string | null;
}

export interface StageProgression {
  stageId: number;
  caseId: number;
  latestStageStatus: StageStatus;
  previousHearingDate: string | null;
  previousPostponementReasonCode: string | null;
  previousPostponementReasonLabel: string | null;
  currentHearingDate: string | null;
  currentPostponementReasonCode: string | null;
  currentPostponementReasonLabel: string | null;
}

export interface HearingProgressionEntry {
  id: number;
  caseStageId: number;
  hearingDate: string;
  postponementReasonCode: string | null;
  postponementReasonLabel: string | null;
  enteredByUserId: number | null;
  entryType: EntryType;
  createdAt: string;
}

export interface RolloverHearingRequest {
  nextHearingDate: string;          // ISO yyyy-MM-dd
  postponementReasonCode: string;
}

export type DecisionType = 'FOR_ENTITY' | 'AGAINST_ENTITY' | 'SETTLEMENT' | 'NON_FINAL';
export const DECISION_TYPE_LABEL_AR: Record<DecisionType, string> = {
  FOR_ENTITY:     'لصالح الجهة',
  AGAINST_ENTITY: 'ضد الجهة',
  SETTLEMENT:     'تسوية',
  NON_FINAL:      'غير قاطع',
};

export interface CaseDecision {
  id: number;
  caseStageId: number;
  decisionNumber: string;
  decisionDate: string;
  decisionType: DecisionType;
  adjudgedAmount: string | null;
  currencyCode: string | null;
  summaryNotes: string | null;
  finalizedByUserId: number;
  finalizedAt: string;
}

export interface FinalizeRequest {
  decisionNumber: string;
  decisionDate: string;
  decisionType: DecisionType;
  adjudgedAmount?: string | null;
  currencyCode?: string | null;
  summaryNotes?: string | null;
}

// ============================================================
// Phase 4 — resolved register + appeal transition
// ============================================================

export interface ResolvedRegisterEntry {
  caseId: number;
  stageId: number;
  decisionId: number;
  publicEntityName: string;
  publicEntityPosition: string;
  opponentName: string;
  branchId: number;
  branchName: string;
  departmentId: number;
  departmentType: string;
  courtId: number;
  courtName: string;
  stageBasisNumber: string;
  stageYear: number;
  decisionNumber: string;
  decisionDate: string;
  decisionType: string;
  adjudgedAmount: string | null;
  currencyCode: string | null;
  summaryNotes: string | null;
  lifecycleStatus: string;
  stageStatus: string;
}

export interface PromoteToAppealResponse {
  caseId: number;
  previousStageId: number;
  newAppealStageId: number;
  lifecycleStatus: string;
}

// ============================================================
// Phase 5 — execution
// ============================================================

export type ExecutionFileStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';
export const EXECUTION_FILE_STATUS_LABEL_AR: Record<ExecutionFileStatus, string> = {
  OPEN:        'مفتوح',
  IN_PROGRESS: 'قيد التنفيذ',
  CLOSED:      'مغلق',
  ARCHIVED:    'مؤرشف',
};

export type ExecutionStepType =
  | 'NOTICE_REQUEST'
  | 'NOTICE_ISSUED'
  | 'SEIZURE_REQUEST'
  | 'SEIZURE_PLACED'
  | 'PAYMENT_RECORDED'
  | 'ADMIN_ACTION'
  | 'CLOSURE'
  | 'OTHER';
export const EXECUTION_STEP_TYPE_LABEL_AR: Record<ExecutionStepType, string> = {
  NOTICE_REQUEST:    'طلب تبليغ',
  NOTICE_ISSUED:     'تبليغ صادر',
  SEIZURE_REQUEST:   'طلب حجز',
  SEIZURE_PLACED:    'حجز مُوقَّع',
  PAYMENT_RECORDED:  'تسجيل سداد',
  ADMIN_ACTION:      'إجراء إداري',
  CLOSURE:           'إغلاق',
  OTHER:             'أخرى',
};

export interface ExecutionFile {
  id: number;
  litigationCaseId: number;
  sourceStageId: number;
  enforcingEntityName: string;
  executedAgainstName: string;
  executionFileType: string;
  executionFileNumber: string;
  executionYear: number;
  branchId: number;
  departmentId: number;
  assignedUserId: number | null;
  status: ExecutionFileStatus;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStep {
  id: number;
  executionFileId: number;
  stepDate: string;
  stepType: ExecutionStepType;
  stepDescription: string;
  createdByUserId: number;
  createdAt: string;
}

export interface AddExecutionStepRequest {
  stepDate: string;
  stepType: ExecutionStepType;
  stepDescription: string;
}

export interface PromoteToExecutionRequest {
  enforcingEntityName: string;
  executedAgainstName: string;
  executionFileType: string;
  executionFileNumber: string;
  executionYear: number;
}

// ============================================================
// Phase 6 — attachments / reminders / notifications  (Phase 10 UI binding)
// ============================================================

/** Backend `sy.gov.sla.attachments.domain.AttachmentScopeType`. */
export type AttachmentScopeType = 'CASE_STAGE' | 'EXECUTION_FILE' | 'EXECUTION_STEP';

export const ATTACHMENT_SCOPE_LABEL_AR: Record<AttachmentScopeType, string> = {
  CASE_STAGE:     'مرحلة دعوى',
  EXECUTION_FILE: 'ملف تنفيذي',
  EXECUTION_STEP: 'خطوة تنفيذية',
};

/** Mirrors backend `AttachmentDto` (record). `active` is `is_active`. */
export interface Attachment {
  id: number;
  attachmentScopeType: AttachmentScopeType;
  scopeId: number;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByUserId: number;
  uploadedAt: string;
  checksumSha256: string;
  active: boolean;
}

/** Backend `sy.gov.sla.reminders.domain.ReminderStatus`. */
export type ReminderStatus = 'PENDING' | 'DONE' | 'CANCELLED';
export const REMINDER_STATUS_LABEL_AR: Record<ReminderStatus, string> = {
  PENDING:   'قيد الانتظار',
  DONE:      'منجز',
  CANCELLED: 'ملغى',
};

/** Mirrors backend `ReminderDto` (record). */
export interface Reminder {
  id: number;
  litigationCaseId: number;
  caseStageId: number | null;
  ownerUserId: number;
  reminderAt: string;          // ISO-8601 instant
  reminderText: string;
  status: ReminderStatus;
  createdAt: string;
}

export interface CreateReminderRequest {
  reminderAt: string;          // ISO instant (with timezone)
  reminderText: string;        // ≤ 500 chars
  caseStageId?: number | null;
}

export interface UpdateReminderStatusRequest {
  status: ReminderStatus;
}

/**
 * Mirrors backend `NotificationDto` (record).
 *
 * NOTE: Jackson serializes record component `read` as JSON `"read"` (not
 * `"isRead"`). `notificationType` is a free string in Phase 6 (`CASE_REGISTERED`
 * or `LAWYER_ASSIGNED`).
 */
export interface Notification {
  id: number;
  recipientUserId: number;
  notificationType: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  read: boolean;
  createdAt: string;
  readAt: string | null;
}

// ============================================================
// Phase 11 — organization lookups (read-only — used by admin screens)
// ============================================================

export type DepartmentType = 'CONCILIATION' | 'FIRST_INSTANCE' | 'APPEAL' | 'EXECUTION';

export const DEPARTMENT_TYPE_LABEL_AR: Record<DepartmentType, string> = {
  CONCILIATION:   'مصالحة',
  FIRST_INSTANCE: 'بداية',
  APPEAL:         'استئناف',
  EXECUTION:      'تنفيذ',
};

/** Mirrors backend `BranchDto`. */
export interface Branch {
  id: number;
  code: string;
  nameAr: string;
  provinceName: string;
  active: boolean;
}

/** Mirrors backend `DepartmentDto`. */
export interface Department {
  id: number;
  branchId: number;
  type: DepartmentType;
  nameAr: string;
  active: boolean;
}

/** Mirrors backend `CourtDto`. */
export interface Court {
  id: number;
  branchId: number;
  departmentType: DepartmentType;
  nameAr: string;
  chamberSupport: boolean;
  active: boolean;
}

// ============================================================
// Phase 11 — case create / update / assign-lawyer request shapes
// (mirror backend `CreateCaseRequest`, `UpdateBasicDataRequest`,
//  `AssignLawyerRequest`).
// ============================================================

export interface CreateCaseRequest {
  publicEntityName: string;
  publicEntityPosition: PublicEntityPosition;
  opponentName: string;
  originalBasisNumber: string;
  basisYear: number;
  originalRegistrationDate: string;        // ISO yyyy-MM-dd
  branchId: number;
  departmentId: number;
  courtId: number;
  chamberName?: string | null;
  stageType: StageType;
  stageBasisNumber: string;
  stageYear: number;
  firstHearingDate: string;                // ISO yyyy-MM-dd
  firstPostponementReason: string;
}

/**
 * UpdateBasicDataRequest — every field optional. Backend updates only what is sent.
 * Forbidden: originalRegistrationDate (D-006), ownership, stage status.
 */
export interface UpdateCaseBasicDataRequest {
  publicEntityName?: string | null;
  publicEntityPosition?: PublicEntityPosition | null;
  opponentName?: string | null;
  originalBasisNumber?: string | null;
  basisYear?: number | null;
  courtId?: number | null;
  chamberName?: string | null;
  stageBasisNumber?: string | null;
  stageYear?: number | null;
  firstHearingDate?: string | null;
  firstPostponementReason?: string | null;
}

export interface AssignLawyerRequest {
  lawyerUserId: number;
}

// ============================================================
// Phase 11 — auth password recovery (existing backend endpoints)
// ============================================================

export interface ForgotPasswordRequest {
  mobileNumber: string;
}

export interface ResetPasswordRequest {
  mobileNumber: string;
  code: string;
  newPassword: string;
}
