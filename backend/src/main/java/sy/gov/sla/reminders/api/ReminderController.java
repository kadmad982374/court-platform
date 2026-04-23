package sy.gov.sla.reminders.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.reminders.application.ReminderService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ReminderController {

    private final ReminderService service;

    @PostMapping("/cases/{id}/reminders")
    public ReminderDto create(@PathVariable("id") Long caseId,
                              @Valid @RequestBody CreateReminderRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.create(caseId, req, actor);
    }

    @GetMapping("/cases/{id}/reminders")
    public List<ReminderDto> list(@PathVariable("id") Long caseId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.list(caseId, actor);
    }

    @PatchMapping("/reminders/{id}/status")
    public ReminderDto updateStatus(@PathVariable("id") Long id,
                                    @Valid @RequestBody UpdateReminderStatusRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.updateStatus(id, req.status(), actor);
    }
}

