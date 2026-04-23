package sy.gov.sla.litigationprogression.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * سجل ترحيل جلسة (append-only). مرجع: الوظيفية §6.5، التقنية §5.3، D-022.
 *
 * كل الأعمدة معلَّمة {@code updatable=false} لمنع أي تعديل ضمني عبر JPA dirty tracking.
 * المنطق التطبيقي يفرض كذلك عدم وجود مسار update/delete على هذا الكيان.
 */
@Entity
@Table(name = "hearing_progression_entries")
@Getter @NoArgsConstructor @AllArgsConstructor @Builder
public class HearingProgressionEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Long id;

    @Column(name = "case_stage_id", nullable = false, updatable = false)
    private Long caseStageId;

    @Column(name = "hearing_date", nullable = false, updatable = false)
    private LocalDate hearingDate;

    /** Code من جدول postponement_reasons (إلزامي للـ INITIAL/ROLLOVER، يجوز null للـ FINALIZED ولِـ legacy backfill). */
    @Column(name = "postponement_reason_code", length = 64, updatable = false)
    private String postponementReasonCode;

    /** Snapshot نصي للسبب لحظة الإدخال — مرجع تاريخي حتى لو تغيّر الـ code label لاحقًا. */
    @Column(name = "postponement_reason_label", nullable = false, length = 200, updatable = false)
    private String postponementReasonLabel;

    @Column(name = "entered_by_user_id", nullable = false, updatable = false)
    private Long enteredByUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 16, updatable = false)
    private EntryType entryType;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}

