package sy.gov.sla.circulars.application;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.circulars.api.CircularDto;
import sy.gov.sla.circulars.domain.Circular;
import sy.gov.sla.circulars.domain.CircularSourceType;
import sy.gov.sla.circulars.infrastructure.CircularRepository;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.NotFoundException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * خدمة قراءة التعاميم/القرارات. Phase 7 (D-040, D-041, D-042).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CircularsService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final CircularRepository repo;

    public PageResponse<CircularDto> list(CircularSourceType sourceType, String q,
                                          LocalDate issueDateFrom, LocalDate issueDateTo,
                                          Boolean active, int page, int size) {
        if (size <= 0) size = DEFAULT_PAGE_SIZE;
        if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;
        if (page < 0) page = 0;
        if (issueDateFrom != null && issueDateTo != null && issueDateFrom.isAfter(issueDateTo)) {
            throw new BadRequestException("INVALID_DATE_RANGE",
                    "issueDateFrom must be <= issueDateTo");
        }
        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "issueDate").and(Sort.by(Sort.Direction.DESC, "id")));

        Specification<Circular> spec = (root, query, cb) -> {
            List<Predicate> ands = new ArrayList<>();
            if (sourceType != null) ands.add(cb.equal(root.get("sourceType"), sourceType));
            if (active != null)     ands.add(cb.equal(root.get("active"), active));
            if (issueDateFrom != null) ands.add(cb.greaterThanOrEqualTo(root.get("issueDate"), issueDateFrom));
            if (issueDateTo   != null) ands.add(cb.lessThanOrEqualTo(root.get("issueDate"), issueDateTo));
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.trim().toLowerCase() + "%";
                ands.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("summary"), "")), pattern),
                        cb.like(cb.lower(root.get("bodyText")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("keywords"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("referenceNumber"), "")), pattern)
                ));
            }
            return ands.isEmpty() ? cb.conjunction() : cb.and(ands.toArray(new Predicate[0]));
        };

        Page<Circular> p = repo.findAll(spec, pageable);
        List<CircularDto> content = p.getContent().stream().map(this::toDto).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }

    public CircularDto get(Long id) {
        Circular c = repo.findById(id)
                .orElseThrow(() -> new NotFoundException("Circular not found: " + id));
        return toDto(c);
    }

    private CircularDto toDto(Circular c) {
        return new CircularDto(c.getId(), c.getSourceType(), c.getTitle(), c.getSummary(),
                c.getBodyText(), c.getIssueDate(), c.getReferenceNumber(), c.getKeywords(),
                c.isActive(), c.getCreatedAt(), c.getUpdatedAt());
    }
}

