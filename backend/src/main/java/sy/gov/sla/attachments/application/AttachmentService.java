package sy.gov.sla.attachments.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.attachments.api.AttachmentDto;
import sy.gov.sla.attachments.domain.Attachment;
import sy.gov.sla.attachments.domain.AttachmentScopeType;
import sy.gov.sla.attachments.infrastructure.AttachmentRepository;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.exception.ForbiddenException;
import sy.gov.sla.common.exception.NotFoundException;
import sy.gov.sla.execution.application.ExecutionService;
import sy.gov.sla.execution.api.ExecutionFileDto;
import sy.gov.sla.litigationregistration.application.CaseStagePort;
import sy.gov.sla.litigationregistration.application.CaseStagePort.StageInfo;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

/**
 * orchestration للمرفقات (D-035, D-036). Phase 6.
 *
 * يفصل بين:
 *  - حفظ البايتات (AttachmentStoragePort)
 *  - تسجيل البيانات الوصفية (AttachmentRepository)
 *  - فحص الصلاحيات (AuthorizationService + CaseStagePort + ExecutionService)
 *
 * يحترم D-023: لا وصول مباشر إلى repos الوحدات الأخرى.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class AttachmentService {

    private final AttachmentRepository repo;
    private final AttachmentStoragePort storage;
    private final AuthorizationService authorizationService;
    private final CaseStagePort caseStagePort;
    private final ExecutionService executionService;

    // ========== Upload ==========

    public AttachmentDto uploadToStage(Long stageId, MultipartFile file, Long actorUserId) {
        StageInfo stage = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        requireWriteAccessToStage(ctx, stage);
        return storeAndPersist(AttachmentScopeType.CASE_STAGE, stageId, file, actorUserId);
    }

    public AttachmentDto uploadToExecutionFile(Long executionFileId, MultipartFile file, Long actorUserId) {
        ExecutionFileDto ef = executionService.getFile(executionFileId, actorUserId); // enforces read scope
        requireWriteAccessToExecutionFile(actorUserId, ef);
        return storeAndPersist(AttachmentScopeType.EXECUTION_FILE, executionFileId, file, actorUserId);
    }

    // ========== List (read scope) ==========

    @Transactional(readOnly = true)
    public List<AttachmentDto> listForStage(Long stageId, Long actorUserId) {
        StageInfo stage = caseStagePort.find(stageId)
                .orElseThrow(() -> new NotFoundException("Stage not found: " + stageId));
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        authorizationService.requireReadAccessToCase(ctx, stage.branchId(), stage.departmentId(),
                stage.currentOwnerUserId());
        return repo.findByAttachmentScopeTypeAndScopeIdAndActiveTrueOrderByUploadedAtDesc(
                AttachmentScopeType.CASE_STAGE, stageId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<AttachmentDto> listForExecutionFile(Long executionFileId, Long actorUserId) {
        executionService.getFile(executionFileId, actorUserId); // enforces read scope
        return repo.findByAttachmentScopeTypeAndScopeIdAndActiveTrueOrderByUploadedAtDesc(
                AttachmentScopeType.EXECUTION_FILE, executionFileId).stream().map(this::toDto).toList();
    }

    // ========== Download ==========

    /** يُحقّق الصلاحية ثم يفتح stream للقراءة. على المستدعي إغلاقه. */
    @Transactional(readOnly = true)
    public DownloadHandle prepareDownload(Long attachmentId, Long actorUserId) {
        Attachment a = repo.findById(attachmentId)
                .orElseThrow(() -> new NotFoundException("Attachment not found: " + attachmentId));
        if (!a.isActive()) {
            throw new NotFoundException("Attachment not found: " + attachmentId);
        }
        verifyReadAccessToScope(a.getAttachmentScopeType(), a.getScopeId(), actorUserId);
        try {
            InputStream in = storage.open(a.getStorageKey());
            return new DownloadHandle(a.getOriginalFilename(), a.getContentType(),
                    a.getFileSizeBytes(), in);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot open attachment storage: " + a.getStorageKey(), e);
        }
    }

    public record DownloadHandle(String filename, String contentType, long size, InputStream stream) {}

    // ========== Internals ==========

    private AttachmentDto storeAndPersist(AttachmentScopeType type, Long scopeId,
                                          MultipartFile file, Long actorUserId) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("EMPTY_FILE", "Uploaded file is empty");
        }
        if (file.getSize() > 50L * 1024L * 1024L) { // hard cap 50MB in Phase 6
            throw new BadRequestException("FILE_TOO_LARGE", "Uploaded file exceeds 50MB limit");
        }
        try {
            byte[] bytes = file.getBytes();
            String checksum = sha256(bytes);
            String key = storage.store(new java.io.ByteArrayInputStream(bytes),
                    file.getOriginalFilename() == null ? "file" : file.getOriginalFilename());
            String contentType = file.getContentType();
            if (contentType == null || contentType.isBlank()) contentType = "application/octet-stream";
            Attachment a = Attachment.builder()
                    .attachmentScopeType(type)
                    .scopeId(scopeId)
                    .originalFilename(file.getOriginalFilename() == null ? "file" : file.getOriginalFilename())
                    .contentType(contentType)
                    .fileSizeBytes(bytes.length)
                    .storageKey(key)
                    .uploadedByUserId(actorUserId)
                    .uploadedAt(Instant.now())
                    .checksumSha256(checksum)
                    .active(true)
                    .build();
            a = repo.save(a);
            return toDto(a);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot store uploaded attachment", e);
        }
    }

    private void verifyReadAccessToScope(AttachmentScopeType type, Long scopeId, Long actorUserId) {
        switch (type) {
            case CASE_STAGE -> {
                StageInfo s = caseStagePort.find(scopeId)
                        .orElseThrow(() -> new NotFoundException("Stage not found: " + scopeId));
                AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
                authorizationService.requireReadAccessToCase(ctx, s.branchId(), s.departmentId(), s.currentOwnerUserId());
            }
            case EXECUTION_FILE -> { executionService.getFile(scopeId, actorUserId); }
            case EXECUTION_STEP -> { executionService.getFileForStep(scopeId, actorUserId); }
        }
    }

    /**
     * صلاحية رفع مرفق على CaseStage:
     *  - SECTION_HEAD أو ADMIN_CLERK لقسم/فرع المرحلة، أو
     *  - المحامي المالك للدعوى (currentOwnerUserId == actor).
     * (D-036)
     */
    private void requireWriteAccessToStage(AuthorizationContext ctx, StageInfo s) {
        boolean section = ctx.isSectionHeadOf(s.branchId(), s.departmentId());
        boolean clerk = ctx.isAdminClerkOf(s.branchId(), s.departmentId());
        boolean owner = s.currentOwnerUserId() != null
                && s.currentOwnerUserId().equals(ctx.userId());
        if (!(section || clerk || owner)) {
            throw new ForbiddenException("Not allowed to upload attachments to this stage");
        }
    }

    /**
     * صلاحية رفع مرفق على ExecutionFile:
     *  - SECTION_HEAD أو ADMIN_CLERK لقسم/فرع الملف، أو
     *  - assigned_user_id == actor.
     * (D-036)
     */
    private void requireWriteAccessToExecutionFile(Long actorUserId, ExecutionFileDto ef) {
        AuthorizationContext ctx = authorizationService.loadContext(actorUserId);
        boolean section = ctx.isSectionHeadOf(ef.branchId(), ef.departmentId());
        boolean clerk = ctx.isAdminClerkOf(ef.branchId(), ef.departmentId());
        boolean assigned = ef.assignedUserId() != null
                && ef.assignedUserId().equals(actorUserId);
        // لا تكفي عضوية BRANCH_HEAD أو CENTRAL للكتابة على المرفقات (احترامًا للمسؤولية التشغيلية).
        if (!(section || clerk || assigned)) {
            throw new ForbiddenException("Not allowed to upload attachments to this execution file");
        }
    }

    private AttachmentDto toDto(Attachment a) {
        return new AttachmentDto(a.getId(), a.getAttachmentScopeType(), a.getScopeId(),
                a.getOriginalFilename(), a.getContentType(), a.getFileSizeBytes(),
                a.getUploadedByUserId(), a.getUploadedAt(), a.getChecksumSha256(), a.isActive());
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}

