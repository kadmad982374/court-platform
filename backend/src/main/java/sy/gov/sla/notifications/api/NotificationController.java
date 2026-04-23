package sy.gov.sla.notifications.api;

import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.notifications.application.NotificationService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    @GetMapping
    public List<NotificationDto> list(
            @RequestParam(value = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.listMine(actor, page, size);
    }

    @PatchMapping("/{id}/read")
    public NotificationDto markRead(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.markRead(id, actor);
    }
}

