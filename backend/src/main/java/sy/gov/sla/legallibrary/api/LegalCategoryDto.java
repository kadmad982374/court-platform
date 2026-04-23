package sy.gov.sla.legallibrary.api;

public record LegalCategoryDto(
        Long id,
        String code,
        String nameAr,
        Long parentId,
        boolean active,
        int sortOrder
) {}

