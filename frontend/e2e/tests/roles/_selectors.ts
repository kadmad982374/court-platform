/**
 * Centralised selector + Arabic-label constants for the role-journey suite.
 *
 * Keeping them here makes the per-role specs read like a checklist and lets
 * us update Arabic copy / testids in ONE place.
 *
 * Selector priority (per UI_PLAYWRIGHT_ROLE_E2E_REPORT plan):
 *   1) data-testid (only on existing surfaces — assign-lawyer)
 *   2) getByRole + Arabic accessible name
 *   3) href patterns
 */

/** data-testid values that already exist in the UI today. */
export const TID = {
  assignLawyerSection: 'assign-lawyer-section',
  assignLawyerSubmit:  'assign-lawyer-submit',
  assignLawyerSuccess: 'assign-lawyer-success',
  assignLawyerError:   'assign-lawyer-error',
  currentOwnerLabel:   'current-owner-label',
} as const;

/** Arabic UI strings used as accessible names in `getByRole`. */
export const AR = {
  // Sidebar labels (navItems.ts)
  navHome:           /^الصفحة الرئيسية$/,
  navProfile:        /^ملفي الشخصي$/,
  navNotifications:  /^الإشعارات$/,
  navCases:          /^الدعاوى$/,
  navResolved:       /^سجل الفصل$/,
  navExecution:      /^التنفيذ$/,
  navLegalLibrary:   /^المكتبة القانونية$/,
  navPublicEntities: /^دليل الجهات العامة$/,
  navCirculars:      /^التعاميم$/,

  // Page titles / card titles
  pageBasicInfo:     'المعلومات الأساسية',
  pageCreateCase:    /إنشاء دعوى/,
  btnCreateCaseSubmit: /قيد الدعوى/,
  btnLogin:          /دخول/,
  btnRollover:       /^ترحيل الجلسة$/,
  btnFinalize:       /^فصل المرحلة$/,
  btnCancel:         /إلغاء|إغلاق/,

  // Gating messages
  msgNoCreateCase:   /لا تملك صلاحية إنشاء دعوى/,
  msgUnauthorized:   /غير مصرح|غير مخول|FORBIDDEN/i,

  // Cases list row action
  btnOpen:           /^فتح$/,
} as const;

/** Stable URL fragments. */
export const URL = {
  login:           '/login',
  dashboard:       '/dashboard',
  profile:         '/profile',
  cases:           '/cases',
  newCase:         '/cases/new',
  notifications:   '/notifications',
  resolved:        '/resolved-register',
  execution:       '/execution-files',
  legalLibrary:    '/legal-library',
  publicEntities:  '/public-entities',
  circulars:       '/circulars',
} as const;

