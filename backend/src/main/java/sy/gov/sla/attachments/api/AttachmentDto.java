package sy.gov.sla.attachments.api;

import sy.gov.sla.attachments.domain.AttachmentScopeType;

import java.time.Instant;

public record AttachmentDto(
        Long id,
        AttachmentScopeType attachmentScopeType,
        Long scopeId,
        String originalFilename,
        String contentType,
        long fileSizeBytes,
        Long uploadedByUserId,
        Instant uploadedAt,
        String checksumSha256,
        boolean active
) {}

