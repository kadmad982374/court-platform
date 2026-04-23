package sy.gov.sla.legallibrary.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.legallibrary.application.LegalLibraryService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

/**
 * Phase 7 — Legal Library read-only APIs (D-040, D-042).
 * Any authenticated user may read.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/legal-library")
public class LegalLibraryController {

    private final LegalLibraryService service;

    @GetMapping("/categories")
    public List<LegalCategoryDto> listCategories(
            @RequestParam(value = "active", required = false) Boolean active) {
        SecurityUtils.currentUserOrThrow();
        return service.listCategories(active);
    }

    @GetMapping("/items")
    public PageResponse<LegalLibraryItemDto> listItems(
            @RequestParam(value = "categoryId", required = false) Long categoryId,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "active", required = false) Boolean active,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        SecurityUtils.currentUserOrThrow();
        return service.listItems(categoryId, q, active, page, size);
    }

    @GetMapping("/items/{id}")
    public LegalLibraryItemDto getItem(@PathVariable("id") Long id) {
        SecurityUtils.currentUserOrThrow();
        return service.getItem(id);
    }
}

