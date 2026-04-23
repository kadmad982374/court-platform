package sy.gov.sla.identity.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.identity.application.UserAdminService;
import sy.gov.sla.security.SecurityUtils;

import java.net.URI;
import java.util.Map;

/**
 * Mini-Phase B — User administration endpoints (D-047 / D-048).
 *
 * <p>All endpoints require {@code CENTRAL_SUPERVISOR} (enforced inside the
 * service). The paginated GET is selected via Spring's {@code params}
 * discriminator: when the {@code membershipType} query parameter is
 * absent, this controller's {@link #list} handler runs; when present, the
 * existing Mini-Phase A {@code UsersController.listAssignableLawyers}
 * handler runs.</p>
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/users")
public class UsersAdminController {

    private final UserAdminService service;

    @PostMapping
    public ResponseEntity<Map<String, Long>> create(@Valid @RequestBody CreateUserRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        Long id = service.create(body, actor);
        return ResponseEntity.created(URI.create("/api/v1/users/" + id))
                .body(Map.of("id", id));
    }

    @GetMapping(value = "/{id:\\d+}")
    public UserAdminDto get(@PathVariable("id") Long id) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.get(id, actor);
    }

    @PatchMapping("/{id:\\d+}")
    public UserAdminDto patch(@PathVariable("id") Long id,
                              @Valid @RequestBody UpdateUserRequest body) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.patch(id, body, actor);
    }

    /**
     * Paginated user search for administrators.
     * Active when the {@code membershipType} parameter is <em>absent</em>
     * (the Mini-Phase A handler in {@code UsersController} owns the case
     * where it is present).
     */
    @GetMapping(params = "!membershipType")
    public PageResponse<UserSummaryDto> list(
            @RequestParam(value = "role",         required = false) String roleRaw,
            @RequestParam(value = "branchId",     required = false) Long branchId,
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "active",       required = false) Boolean active,
            @RequestParam(value = "q",            required = false) String q,
            @RequestParam(value = "page",         required = false, defaultValue = "0") int page,
            @RequestParam(value = "size",         required = false, defaultValue = "20") int size) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        RoleType role = parseRole(roleRaw);
        return service.list(role, branchId, departmentId, active, q, page, size, actor);
    }

    private static RoleType parseRole(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return RoleType.valueOf(raw);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("INVALID_ROLE", "Unknown role: " + raw);
        }
    }
}

