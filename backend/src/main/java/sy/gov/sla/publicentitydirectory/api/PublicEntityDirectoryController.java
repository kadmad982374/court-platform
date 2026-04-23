package sy.gov.sla.publicentitydirectory.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.publicentitydirectory.application.PublicEntityDirectoryService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

/**
 * Phase 7 — Public Entity Directory read-only APIs (D-040, D-042).
 *
 * Endpoint للفئات أُضيف بشكل اختياري لتسهيل التصفّح الهرمي للفئات
 * (ورد ذكره صراحةً في تعليمات Phase 7 كاحتمال موثَّق).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/public-entities")
public class PublicEntityDirectoryController {

    private final PublicEntityDirectoryService service;

    @GetMapping("/categories")
    public List<PublicEntityCategoryDto> listCategories(
            @RequestParam(value = "active", required = false) Boolean active) {
        SecurityUtils.currentUserOrThrow();
        return service.listCategories(active);
    }

    @GetMapping
    public PageResponse<PublicEntityItemDto> list(
            @RequestParam(value = "categoryId", required = false) Long categoryId,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "active", required = false) Boolean active,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        SecurityUtils.currentUserOrThrow();
        return service.listItems(categoryId, q, active, page, size);
    }

    @GetMapping("/{id}")
    public PublicEntityItemDto get(@PathVariable("id") Long id) {
        SecurityUtils.currentUserOrThrow();
        return service.getItem(id);
    }
}

