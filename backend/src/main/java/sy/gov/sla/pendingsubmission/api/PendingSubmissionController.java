package sy.gov.sla.pendingsubmission.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.pendingsubmission.application.PendingSubmissionService;
import sy.gov.sla.security.SecurityUtils;

/**
 * REST لسجل «تحت الرفع» (طلب العميل #3).
 *   GET  /api/v1/pending-submissions?q=&page=&size=
 *   POST /api/v1/pending-submissions
 *   PUT  /api/v1/pending-submissions/{id}
 * الصلاحيات مفروضة في الـ Service (نطاق القراءة + إضافة/تعديل للقسم).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/pending-submissions")
public class PendingSubmissionController {

    private final PendingSubmissionService service;

    @GetMapping
    public PageResponse<PendingSubmissionDto> list(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.list(q, page, size, actor);
    }

    @PostMapping
    public PendingSubmissionDto create(@Valid @RequestBody CreatePendingSubmissionRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.create(req, actor);
    }

    @PutMapping("/{id}")
    public PendingSubmissionDto update(@PathVariable("id") Long id,
                                       @Valid @RequestBody UpdatePendingSubmissionRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.update(id, req, actor);
    }
}
