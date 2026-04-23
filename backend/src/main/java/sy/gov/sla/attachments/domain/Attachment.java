package sy.gov.sla.attachments.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * مرفق موحَّد. Phase 6 (D-036).
 *
 * كائن غير قابل للتعديل عمليًا في Phase 6: لا API لـ update/delete، لكن نُبقي
 * `is_active` للاستخدام المستقبلي (soft-deactivation تحت قرار جديد).
 *
 * كل الحقول الحساسة `updatable=false` لمنع تعديل بالمصادفة عبر JPA dirty tracking.
 */
@Entity
@Table(name = "attachments")
@Getter @NoArgsConstructor @AllArgsConstructor @Builder
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", updatable = false)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "attachment_scope_type", nullable = false, length = 32, updatable = false)
    private AttachmentScopeType attachmentScopeType;

    @Column(name = "scope_id", nullable = false, updatable = false)
    private Long scopeId;

    @Column(name = "original_filename", nullable = false, length = 255, updatable = false)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 128, updatable = false)
    private String contentType;

    @Column(name = "file_size_bytes", nullable = false, updatable = false)
    private long fileSizeBytes;

    @Column(name = "storage_key", nullable = false, length = 512, updatable = false, unique = true)
    private String storageKey;

    @Column(name = "uploaded_by_user_id", nullable = false, updatable = false)
    private Long uploadedByUserId;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    @Column(name = "checksum_sha256", length = 64, updatable = false)
    private String checksumSha256;

    @Column(name = "is_active", nullable = false)
    @Setter
    private boolean active;
}

