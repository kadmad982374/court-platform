package sy.gov.sla.litigationregistration.infrastructure;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import sy.gov.sla.litigationregistration.domain.LitigationCase;

import java.time.LocalDate;

public interface LitigationCaseRepository
        extends JpaRepository<LitigationCase, Long>, JpaSpecificationExecutor<LitigationCase> {
    Page<LitigationCase> findAll(Pageable pageable);

    /**
     * Set litigation_cases.last_hearing_date = :date when :date is later than
     * the current value (or current value is NULL). Single SQL — bypasses JPA
     * dirty-checking and does not touch @Version, so it is safe to call from
     * services that don't already have the case loaded in their persistence
     * context (e.g. HearingProgressionService).
     *
     * @return rows affected (0 if the existing value is already >= :date)
     */
    @Modifying
    @Query("UPDATE LitigationCase c SET c.lastHearingDate = :date " +
           "WHERE c.id = :caseId " +
           "AND (c.lastHearingDate IS NULL OR c.lastHearingDate < :date)")
    int bumpLastHearingDate(@Param("caseId") Long caseId, @Param("date") LocalDate date);
}
