// PR-7 — Arabic translations for backend error CODES.
//
// The backend returns stable codes (e.g. INVALID_CREDENTIALS, DISALLOWED_FILE_TYPE)
// alongside English message text intended for developer/log consumption. The
// UI is Arabic-first; this map is what the user actually sees.
//
// Adding a new code: prefer a clear, calm sentence — no "Error:" prefix, no
// "Please contact support" boilerplate. The backend code is stable; if a code
// here is missing the helper falls through to body.message.

export const AR_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  // ── Authentication / Sessions ─────────────────────────────
  INVALID_CREDENTIALS:        'بيانات الدخول غير صحيحة.',
  ACCOUNT_LOCKED:             'الحساب مقفل مؤقتاً بسبب محاولات فاشلة متعددة. حاول مرة أخرى بعد قليل.',
  ACCOUNT_DISABLED:           'الحساب معطل. تواصل مع المسؤول.',
  INVALID_REFRESH_TOKEN:      'انتهت صلاحية الجلسة. الرجاء تسجيل الدخول من جديد.',
  UNAUTHENTICATED:            'الرجاء تسجيل الدخول للمتابعة.',
  RATE_LIMIT_EXCEEDED:        'محاولات متعددة. الرجاء الانتظار قبل المحاولة مرة أخرى.',
  BAD_OLD_PASSWORD:           'كلمة المرور الحالية غير صحيحة.',
  WEAK_PASSWORD:              'كلمة المرور الجديدة لا تستوفي الشروط (٨ خانات على الأقل، ومختلفة عن السابقة).',
  INVALID_OTP:                'رمز التحقق غير صحيح أو منتهي الصلاحية.',

  // ── Authorisation ─────────────────────────────────────────
  FORBIDDEN:                  'ليست لديك صلاحية للوصول إلى هذا المحتوى.',
  COURT_OUTSIDE_SCOPE:        'المحكمة خارج نطاق صلاحياتك.',
  BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD:
                              'لا يمكن لرئيس الفرع منح أو سحب صلاحية رئيس فرع.',

  // ── Generic request shape ─────────────────────────────────
  VALIDATION_ERROR:           'تحقق من الحقول الموسومة باللون الأحمر.',
  INVALID_REQUEST_BODY:       'بنية الطلب غير صحيحة.',
  MISSING_PARAMETER:          'بعض المعلومات المطلوبة ناقصة.',
  NOT_FOUND:                  'العنصر المطلوب غير موجود.',
  METHOD_NOT_ALLOWED:         'الطريقة غير مدعومة على هذا المسار.',
  INTERNAL_ERROR:             'حدث خطأ غير متوقع. الرجاء المحاولة لاحقاً.',

  // ── User / Role / Membership administration ───────────────
  USERNAME_TAKEN:             'اسم المستخدم مستخدم بالفعل.',
  MOBILE_TAKEN:               'رقم الجوال مستخدم بالفعل.',
  ROLE_NOT_FOUND:             'الدور غير موجود.',
  INVALID_ROLE:               'الدور غير معروف.',
  DUPLICATE_MEMBERSHIP:       'عضوية مكررة لهذا المستخدم في نفس القسم.',
  INVALID_MEMBERSHIP:         'نوع العضوية غير صالح.',
  TARGET_HAS_NO_DEPARTMENT:   'المستخدم المستهدف ليس عضواً نشطاً في قسم.',
  INVALID_BRANCH:             'الفرع غير موجود.',
  BRANCH_DEPT_MISMATCH:       'الفرع والقسم غير متطابقين.',
  INVALID_COURT:              'المحكمة غير موجودة.',
  COURT_ACCESS_DUPLICATE:     'صلاحية الوصول لهذه المحكمة ممنوحة مسبقاً.',

  // ── Cases / Stages ────────────────────────────────────────
  STAGE_READ_ONLY:            'لا يمكن تعديل مرحلة منتهية أو مغلقة.',
  STAGE_FINALIZED:            'المرحلة منتهية ولا تقبل تعديلاً.',
  STAGE_ALREADY_FINALIZED:    'المرحلة منتهية مسبقاً.',
  NO_CURRENT_STAGE:           'لا توجد مرحلة جارية لهذه الدعوى.',
  STAGE_NOT_FOUND:            'المرحلة غير موجودة.',
  STAGE_CASE_MISMATCH:        'المرحلة لا تنتمي للدعوى المحددة.',
  STAGE_NOT_FINALIZED:        'يجب إنهاء المرحلة قبل المتابعة.',
  ALREADY_APPEAL_STAGE:       'هذه مرحلة استئناف بالفعل.',
  STAGE_ALREADY_PROMOTED:     'تم ترقية هذه المرحلة مسبقاً.',
  INVALID_LIFECYCLE_FOR_APPEAL:
                              'حالة الدعوى لا تسمح بالاستئناف الآن.',
  INVALID_POSTPONEMENT_REASON:'سبب التأجيل غير صالح.',
  INACTIVE_POSTPONEMENT_REASON:
                              'سبب التأجيل غير مفعل حالياً.',
  INVALID_TRANSITION:         'لا يمكن تنفيذ هذه العملية على الحالة الحالية.',

  // ── Decisions ─────────────────────────────────────────────
  DECISION_EXISTS:            'يوجد قرار مسجّل لهذه المرحلة بالفعل.',
  AMOUNT_CURRENCY_INCONSISTENT:
                              'المبلغ المحكوم به والعملة غير متناسقين.',

  // ── Execution ─────────────────────────────────────────────
  INVALID_LIFECYCLE_FOR_EXECUTION:
                              'حالة الدعوى لا تسمح بالتنفيذ.',
  EXECUTION_FILE_NUMBER_DUPLICATE:
                              'رقم الملف التنفيذي مستخدم بالفعل في هذا الفرع.',
  NO_EXECUTION_DEPARTMENT_IN_BRANCH:
                              'لا يوجد قسم تنفيذ مفعّل في هذا الفرع.',

  // ── Attachments ───────────────────────────────────────────
  EMPTY_FILE:                 'الملف فارغ.',
  FILE_TOO_LARGE:             'حجم الملف يتجاوز ٥٠ ميجابايت.',
  DISALLOWED_FILE_TYPE:       'نوع الملف غير مدعوم. الأنواع المقبولة: PDF, DOCX, XLSX, PNG, JPEG.',

  // ── Misc ──────────────────────────────────────────────────
  INVALID_DATE_RANGE:         'نطاق التاريخ غير صالح.',
};
