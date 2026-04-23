package sy.gov.sla.publicentitydirectory.api;

public record PublicEntityCategoryDto(
        Long id,
        String code,
        String nameAr,
        Long parentId,
        boolean active,
        int sortOrder
) {}

