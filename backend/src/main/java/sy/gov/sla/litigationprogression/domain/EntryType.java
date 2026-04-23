package sy.gov.sla.litigationprogression.domain;

/**
 * نوع entry في سجل الترحيل (append-only).
 *
 * - INITIAL: قيد أول للجلسة (تأتي من Phase 2 backfill أو حالات حدية مستقبلية).
 * - ROLLOVER: ترحيل جلسة من قبل المحامي المُسنَد.
 * - FINALIZED: لحظة الفصل (تُلحق آليًا من DecisionFinalizationService).
 */
public enum EntryType {
    INITIAL,
    ROLLOVER,
    FINALIZED
}

