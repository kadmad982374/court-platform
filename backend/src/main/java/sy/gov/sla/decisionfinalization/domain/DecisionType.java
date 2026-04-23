package sy.gov.sla.decisionfinalization.domain;

/**
 * نوع القرار الحصري. مرجع: D-009.
 * لا يجوز إضافة أي قيمة أخرى.
 */
public enum DecisionType {
    FOR_ENTITY,
    AGAINST_ENTITY,
    SETTLEMENT,
    NON_FINAL
}

