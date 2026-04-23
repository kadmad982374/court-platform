import { ALL_ROLES, type RoleCode } from '@/shared/types/domain';

export interface NavItem {
  /** React Router path. */
  to: string;
  /** Arabic label rendered in the sidebar. */
  label: string;
  /** Roles allowed to see this item. Empty = visible to any authenticated user. */
  allowedRoles: readonly RoleCode[];
  /** Optional grouping; rendered as a section header. */
  section?: string;
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
  { to: '/execution-files',   label: 'التنفيذ',     allowedRoles: ALL_ROLES, section: 'الأعمال' },

  // ---- Knowledge directory (Phase 7 read-only modules, D-042) ----
  { to: '/legal-library',   label: 'المكتبة القانونية', allowedRoles: ALL_ROLES, section: 'مرجعيات' },
  { to: '/public-entities', label: 'دليل الجهات العامة', allowedRoles: ALL_ROLES, section: 'مرجعيات' },
  { to: '/circulars',       label: 'التعاميم',          allowedRoles: ALL_ROLES, section: 'مرجعيات' },

  // ---- Phase 10 — notifications inbox (D-038) ----
  // Reminders/Attachments are intentionally NOT top-level nav entries — they
  // live as sections inside their host pages (case / stage / execution file).
  { to: '/notifications',   label: 'الإشعارات',          allowedRoles: ALL_ROLES, section: 'عام' },

  // ---- UI sub-phase B — `/admin/users` minimal (D-047 / D-048) ----
  // Conservative visibility: CENTRAL_SUPERVISOR only. Section-head /
  // branch-head narrower admin surfaces remain out of scope for this phase
  // (see docs/project-ui/UI_ADMIN_USERS_SUBPHASE_B.md §"Out of scope").
  { to: '/admin/users',     label: 'إدارة المستخدمين',
    allowedRoles: ['CENTRAL_SUPERVISOR'], section: 'الإدارة' },
];

/** Filter nav items by the current user's roles. */
export function visibleItems(userRoles: RoleCode[]): NavItem[] {
  return NAV_ITEMS.filter((it) => {
    if (it.allowedRoles.length === 0) return true;
    return it.allowedRoles.some((r) => userRoles.includes(r));
  });
}
