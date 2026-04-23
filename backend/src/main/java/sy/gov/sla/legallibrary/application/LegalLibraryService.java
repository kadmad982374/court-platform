package sy.gov.sla.legallibrary.application;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.legallibrary.api.LegalCategoryDto;
import sy.gov.sla.legallibrary.api.LegalLibraryItemDto;
import sy.gov.sla.legallibrary.domain.LegalCategory;
import sy.gov.sla.legallibrary.domain.LegalLibraryItem;
import sy.gov.sla.legallibrary.infrastructure.LegalCategoryRepository;
import sy.gov.sla.legallibrary.infrastructure.LegalLibraryItemRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * خدمة قراءة المكتبة القانونية. Phase 7 (D-040, D-041, D-042).
 *
 * - قراءة فقط لأي مستخدم مصادق عليه (D-042).
 * - بحث نصي بسيط ILIKE على title/summary/body/keywords (D-041) — لا full-text engine.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LegalLibraryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final LegalCategoryRepository categoryRepo;
    private final LegalLibraryItemRepository itemRepo;

    public List<LegalCategoryDto> listCategories(Boolean activeOnly) {
        List<LegalCategory> list = (activeOnly != null && activeOnly)
                ? categoryRepo.findAllByActiveTrueOrderBySortOrderAscIdAsc()
                : categoryRepo.findAllByOrderBySortOrderAscIdAsc();
        return list.stream().map(this::toCategoryDto).toList();
    }

    public PageResponse<LegalLibraryItemDto> listItems(Long categoryId, String q, Boolean active,
                                                       int page, int size) {
        if (size <= 0) size = DEFAULT_PAGE_SIZE;
        if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;
        if (page < 0) page = 0;

        Pageable pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "publishedAt").and(Sort.by(Sort.Direction.DESC, "id")));

        Specification<LegalLibraryItem> spec = buildSpec(categoryId, q, active);
        Page<LegalLibraryItem> p = itemRepo.findAll(spec, pageable);

        List<LegalLibraryItemDto> content = p.getContent().stream().map(this::toItemDto).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }

    public LegalLibraryItemDto getItem(Long id) {
        LegalLibraryItem it = itemRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Legal library item not found: " + id));
        return toItemDto(it);
    }

    private Specification<LegalLibraryItem> buildSpec(Long categoryId, String q, Boolean active) {
        return (root, query, cb) -> {
            List<Predicate> ands = new ArrayList<>();
            if (categoryId != null) {
                ands.add(cb.equal(root.get("categoryId"), categoryId));
            }
            if (active != null) {
                ands.add(cb.equal(root.get("active"), active));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.trim().toLowerCase() + "%";
                Predicate inTitle    = cb.like(cb.lower(root.get("title")), pattern);
                Predicate inSummary  = cb.like(cb.lower(cb.coalesce(root.get("summary"), "")), pattern);
                Predicate inBody     = cb.like(cb.lower(root.get("bodyText")), pattern);
                Predicate inKeywords = cb.like(cb.lower(cb.coalesce(root.get("keywords"), "")), pattern);
                ands.add(cb.or(inTitle, inSummary, inBody, inKeywords));
            }
            return ands.isEmpty() ? cb.conjunction() : cb.and(ands.toArray(new Predicate[0]));
        };
    }

    private LegalCategoryDto toCategoryDto(LegalCategory c) {
        return new LegalCategoryDto(c.getId(), c.getCode(), c.getNameAr(),
                c.getParentId(), c.isActive(), c.getSortOrder());
    }

    private LegalLibraryItemDto toItemDto(LegalLibraryItem it) {
        return new LegalLibraryItemDto(it.getId(), it.getCategoryId(), it.getTitle(),
                it.getSummary(), it.getBodyText(), it.getKeywords(),
                it.getSourceReference(), it.getPublishedAt(), it.isActive(),
                it.getCreatedAt(), it.getUpdatedAt());
    }
}

