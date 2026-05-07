package sy.gov.sla.litigationregistration.domain;

/**
 * Customer feedback round-2: court type for the originating court of a case.
 * Surfaced on the create-case form ("نوع المحكمة"). Examples are not stage
 * types — they're the legal/jurisdictional flavour of the court.
 */
public enum CourtType {
    /** مستعجل */
    URGENT,
    /** بحري */
    MARITIME,
    /** مصرفي */
    BANKING,
    /** عمالي */
    LABOR,
    /** عادي */
    GENERAL,
    /** تأمين */
    INSURANCE,
    /** جمركي */
    CUSTOMS,
    /** إدارية */
    ADMINISTRATIVE
}
