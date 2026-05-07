package sy.gov.sla.notifications.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.notifications.application.BroadcastService;
import sy.gov.sla.notifications.application.NotificationService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;
    private final BroadcastService broadcastService;

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

    /**
     * PR-14 (customer feedback A-1 / Q-G expansion) — list state-lawyer
     * recipients reachable by the caller (filtered to a branch / department
     * if provided). Used by the broadcast composer's recipient picker.
     */
    @GetMapping("/broadcast/recipients")
    public List<BroadcastRecipientDto> listBroadcastRecipients(
            @RequestParam(value = "branchId",     required = false) Long branchId,
            @RequestParam(value = "departmentId", required = false) Long departmentId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return broadcastService.listEligibleRecipients(actor, branchId, departmentId);
    }

    /**
     * Customer feedback round-2 (PR-15a iteration) — preview the union of
     * lawyers reachable by an arbitrary combination of branches, sections, and
     * named user ids. Used by the new accumulative compose UI to show an
     * accurate live recipient count. Each id is auth-checked against the
     * caller's broadcast reach.
     */
    @GetMapping("/broadcast/recipients-union")
    public List<BroadcastRecipientDto> listBroadcastRecipientsUnion(
            @RequestParam(value = "branchIds",     required = false) List<Long> branchIds,
            @RequestParam(value = "departmentIds", required = false) List<Long> departmentIds,
            @RequestParam(value = "userIds",       required = false) List<Long> userIds) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return broadcastService.listEligibleRecipientsUnion(
                actor, branchIds, departmentIds, userIds);
    }

    /**
     * PR-14 (customer feedback A-1 / Q-G expansion) — fan-out a broadcast to
     * every state lawyer matching the (scope, branchId, departmentId, userIds)
     * tuple. Sender role and scope are re-validated server-side.
     */
    @PostMapping("/broadcast")
    public BroadcastResultDto broadcast(@Valid @RequestBody BroadcastRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return broadcastService.broadcast(actor, req);
    }
}

