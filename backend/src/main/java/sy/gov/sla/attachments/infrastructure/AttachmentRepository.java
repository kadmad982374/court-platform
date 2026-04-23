package sy.gov.sla.attachments.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;
import sy.gov.sla.attachments.domain.Attachment;
import sy.gov.sla.attachments.domain.AttachmentScopeType;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByAttachmentScopeTypeAndScopeIdAndActiveTrueOrderByUploadedAtDesc(
            AttachmentScopeType type, Long scopeId);
}

