package sy.gov.sla.litigationprogression.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.litigationprogression.domain.HearingProgressionEntry;

import java.util.List;

/**
 * Append-only repository. لا تُضاف أي طريقة تعديل أو حذف.
 * (deleteById المتوارثة من JpaRepository موجودة بحكم الإطار،
 * لكن لا تُستهلك من أي خدمة في الكود.)
 */
public interface HearingProgressionEntryRepository extends JpaRepository<HearingProgressionEntry, Long> {

    List<HearingProgressionEntry> findByCaseStageIdOrderByCreatedAtAsc(Long caseStageId);

    /** آخر entry تأسيس/ترحيل (غير FINALIZED) — لاستخراج "previous" hearing. */
    @org.springframework.data.jpa.repository.Query(
            "SELECT h FROM HearingProgressionEntry h " +
                    "WHERE h.caseStageId = :stageId AND h.entryType <> sy.gov.sla.litigationprogression.domain.EntryType.FINALIZED " +
                    "ORDER BY h.createdAt DESC")
    List<HearingProgressionEntry> findLatestNonFinalized(@org.springframework.data.repository.query.Param("stageId") Long stageId,
                                                         org.springframework.data.domain.Pageable pageable);
}

