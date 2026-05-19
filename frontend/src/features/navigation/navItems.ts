import { ALL_ROLES, type CurrentUser, type RoleCode } from '@/shared/types/domain';
import { canViewExecution } from '@/features/auth/permissions';

export interface NavItem {
  /** React Router path. */
  to: string;
  /** Arabic label rendered in the sidebar. */
  label: string;
  /** Roles allowed to see this item. Empty = visible to any authenticated user. */
  allowedRoles: readonly RoleCode[];
  /** Optional grouping; rendered as a section header. */
  section?: string;
  /**
   * Optional finer-grained gate evaluated AFTER the role check. Used when
   * role alone is too coarse — e.g. to hide the execution-files entries
   * for SECTION_HEADs whose section is not EXECUTION (customer feedback
   * round-3).
   */
  visible?: (user: CurrentUser | null) => boolean;
}

/**
 * Phase 8 — navigation foundation.
 *
 * Only the items listed here are wired in the router. Heavy business areas
 * (cases / hearings / execution / resolved register / attachments) intentionally
 * have NO entries — they will be added in Phase 9+ together with their pages.
 */
export const NAV_ITEMS: NavItem[] = [
  // ---- General (any authenticated user) ----
  { to: '/dashboard',       label: 'الصفحة الرئيسية', allowedRoles: ALL_ROLES, section: 'عام' },
  { to: '/profile',         label: 'ملفي الشخصي',     allowedRoles: ALL_ROLES, section: 'عام' },

  // ---- Business (Phase 9) ----
  // D-021/D-025/D-031: backend enforces scope; UI shows what server returns.
  { to: '/cases',             label: 'الدعاوى',     allowedRoles: ALL_ROLES, section: 'الأعمال' },
  { to: '/resolved-register', label: 'سجل الفصل',  allowedRoles: ALL_ROLES, section: 'الأعمال' },
  // Customer feedback round-3: hide execution entries for users that have no
  // path into the execution module (e.g. SECTION_HEAD of FIRST_INSTANCE).
  // Backend re-validates with NO_EXECUTION_ACCESS.
  { to: '/execution-files',   label: 'التنفيذ',     allowedRoles: ALL_ROLES, section: 'الأعمال',
    visible: canViewExecution },
  // PR-12 (customer feedback E-3): "الملفات المنفّذة" — execution files whose
  // execution is fully done (status=CLOSED). Backed by the same page; the
  // status query-string drives the view.
  { to: '/execution-files?status=CLOSED', label: 'الملفات المنفّذة',
    allowedRoles: ALL_ROLES, section: 'الأعمال', visible: canViewExecution },

  // ---- Knowledge directory (Phase 7 read-only modules, D-042) ----
  { to: '/legal-library',   label: 'المكتبة القانونية', allowedRoles: ALL_ROLES, section: 'مرجعيات' },
  { to: '/public-entities', label: 'دليل الجهات العامة', allowedRoles: ALL_ROLES, section: 'مرجعيات' },
  { to: '/circulars',       label: 'التعاميم',          allowedRoles: ALL_ROLES, section: 'مرجعيات' },

  // ---- Phase 10 — notifications inbox (D-038) ----
  // Reminders/Attachments are intentionally NOT top-level nav entries — they
  // live as sections inside their host pages (case / stage / execution file).
  { to: '/notifications',   label: 'الإشعارات',          allowedRoles: ALL_ROLES, section: 'عام' },
  // PR-14 (customer feedback A-1 / Q-G expansion) — broadcast composer.
  // Sidebar entry restricted by ROLE; backend re-validates membership scope.
  // ADMIN_CLERK members never see this even though they may share a (branch,
  // dept) with a SECTION_HEAD — only CENTRAL_SUPERVISOR / BRANCH_HEAD /
  // SECTION_HEAD may broadcast.
  { to: '/notifications/broadcast', label: 'إرسال إشعار',
    allowedRoles: ['CENTRAL_SUPERVISOR', 'BRANCH_HEAD', 'SECTION_HEAD'], section: 'عام' },

  // ---- UI sub-phase B — `/admin/users` minimal (D-047 / D-048) ----
  // Conservative visibility: CENTRAL_SUPERVISOR only. Section-head /
  // branch-head narrower admin surfaces remain out of scope for this phase
  // (see docs/project-ui/UI_ADMIN_USERS_SUBPHASE_B.md §"Out of scope").
  { to: '/admin/users',     label: 'إدارة المستخدمين',
    allowedRoles: ['CENTRAL_SUPERVISOR'], section: 'الإدارة' },
];

/**
 * Filter nav items by the current user's roles. Kept for backwards
 * compatibility with the existing test suite — callers that have a full
 * `CurrentUser` object should prefer {@link visibleItemsForUser} so that
 * predicate-based gates (e.g. `canViewExecution`) are also applied.
 */
export function visibleItems(userRoles: RoleCode[]): NavItem[] {
  return NAV_ITEMS.filter((it) => {
    if (it.allowedRoles.length === 0) return true;
    return it.allowedRoles.some((r) => userRoles.includes(r));
  });
}

/**
 * Filter nav items by both the role list AND any per-user predicate. This
 * is the version Sidebar / MobileSidebar should call so that visibility can
 * key off membership shape (e.g. "is this user in an EXECUTION dept?").
 */
export function visibleItemsForUser(user: CurrentUser | null): NavItem[] {
  const roles = user?.roles ?? [];
  return NAV_ITEMS.filter((it) => {
    const roleOk = it.allowedRoles.length === 0
        || it.allowedRoles.some((r) => roles.includes(r));
    if (!roleOk) return false;
    if (it.visible && !it.visible(user)) return false;
    return true;
  });
}
