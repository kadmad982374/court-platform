package sy.gov.sla.attachments.api;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import sy.gov.sla.attachments.application.AttachmentService;
import sy.gov.sla.security.SecurityUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class AttachmentController {

    private final AttachmentService service;

    // ===== Stage attachments =====
    @PostMapping(value = "/stages/{stageId}/attachments",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentDto uploadStage(@PathVariable("stageId") Long stageId,
                                     @RequestPart("file") MultipartFile file) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.uploadToStage(stageId, file, actor);
    }

    @GetMapping("/stages/{stageId}/attachments")
    public List<AttachmentDto> listStage(@PathVariable("stageId") Long stageId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listForStage(stageId, actor);
    }

    // ===== Execution-file attachments =====
    @PostMapping(value = "/execution-files/{id}/attachments",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AttachmentDto uploadExecutionFile(@PathVariable("id") Long id,
                                             @RequestPart("file") MultipartFile file) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.uploadToExecutionFile(id, file, actor);
    }

    @GetMapping("/execution-files/{id}/attachments")
    public List<AttachmentDto> listExecutionFile(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listForExecutionFile(id, actor);
    }

    // ===== Download =====
    /**
     * P2-03: every download is served as opaque {@code application/octet-stream}
     *        with {@code Content-Disposition: attachment} and the browser's
     *        sniff-and-render heuristics suppressed via {@code X-Content-Type-Options: nosniff}.
     *        Together this means a stored file (even a legitimate PNG) cannot be
     *        rendered inline by a victim's browser if the URL is shared.
     */
    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<InputStreamResource> download(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        var h = service.prepareDownload(id, actor);
        String encoded = URLEncoder.encode(h.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename*=UTF-8''" + encoded);
        headers.add("X-Content-Type-Options", "nosniff");
        // Always octet-stream — never trust the stored type for what the browser does with it.
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        return ResponseEntity.ok()
                .headers(headers)
                .contentLength(h.size())
                .body(new InputStreamResource(h.stream()));
    }
}

