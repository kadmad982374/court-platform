package sy.gov.sla.publicentitydirectory.application;

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
import sy.gov.sla.publicentitydirectory.api.PublicEntityCategoryDto;
import sy.gov.sla.publicentitydirectory.api.PublicEntityItemDto;
import sy.gov.sla.publicentitydirectory.domain.PublicEntityCategory;
import sy.gov.sla.publicentitydirectory.domain.PublicEntityItem;
import sy.gov.sla.publicentitydirectory.infrastructure.PublicEntityCategoryRepository;
import sy.gov.sla.publicentitydirectory.infrastructure.PublicEntityItemRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * خدمة قراءة دليل الجهات العامة. Phase 7 (D-040, D-041, D-042).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PublicEntityDirectoryService {

    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_PAGE_SIZE = 20;

    private final PublicEntityCategoryRepository categoryRepo;
    private final PublicEntityItemRepository itemRepo;

    public List<PublicEntityCategoryDto> listCategories(Boolean activeOnly) {
        List<PublicEntityCategory> list = (activeOnly != null && activeOnly)
                ? categoryRepo.findAllByActiveTrueOrderBySortOrderAscIdAsc()
                : categoryRepo.findAllByOrderBySortOrderAscIdAsc();
        return list.stream().map(this::toCategoryDto).toList();
    }

    public PageResponse<PublicEntityItemDto> listItems(Long categoryId, String q, Boolean active,
                                                       int page, int size) {
        if (size <= 0) size = DEFAULT_PAGE_SIZE;
        if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;
        if (page < 0) page = 0;
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "id"));

        Specification<PublicEntityItem> spec = (root, query, cb) -> {
            List<Predicate> ands = new ArrayList<>();
            if (categoryId != null) ands.add(cb.equal(root.get("categoryId"), categoryId));
            if (active != null) ands.add(cb.equal(root.get("active"), active));
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.trim().toLowerCase() + "%";
                ands.add(cb.or(
                        cb.like(cb.lower(root.get("nameAr")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("shortDescription"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("detailsText"), "")), pattern),
                        cb.like(cb.lower(cb.coalesce(root.get("keywords"), "")), pattern)
                ));
            }
            return ands.isEmpty() ? cb.conjunction() : cb.and(ands.toArray(new Predicate[0]));
        };

        Page<PublicEntityItem> p = itemRepo.findAll(spec, pageable);
        List<PublicEntityItemDto> content = p.getContent().stream().map(this::toItemDto).toList();
        return new PageResponse<>(content, p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }

    public PublicEntityItemDto getItem(Long id) {
        PublicEntityItem it = itemRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Public entity not found: " + id));
        return toItemDto(it);
    }

    private PublicEntityCategoryDto toCategoryDto(PublicEntityCategory c) {
        return new PublicEntityCategoryDto(c.getId(), c.getCode(), c.getNameAr(),
                c.getParentId(), c.isActive(), c.getSortOrder());
    }

    private PublicEntityItemDto toItemDto(PublicEntityItem it) {
        return new PublicEntityItemDto(it.getId(), it.getCategoryId(), it.getNameAr(),
                it.getShortDescription(), it.getDetailsText(), it.getKeywords(),
                it.getReferenceCode(), it.isActive(), it.getCreatedAt(), it.getUpdatedAt());
    }
}

