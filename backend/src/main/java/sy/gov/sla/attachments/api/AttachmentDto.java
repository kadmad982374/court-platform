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
        // Display-side enrichment so the UI can show the uploader's name
        // instead of the raw user id (nullable when the user row is missing).
        String uploadedByFullName,
        Instant uploadedAt,
        String checksumSha256,
        boolean active
) {}

