package sy.gov.sla.circulars.api;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.circulars.application.CircularsService;
import sy.gov.sla.circulars.domain.CircularSourceType;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.security.SecurityUtils;

import java.time.LocalDate;

/**
 * Phase 7 — Circulars read-only APIs (D-040, D-042).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/circulars")
public class CircularsController {

    private final CircularsService service;

    @GetMapping
    public PageResponse<CircularDto> list(
            @RequestParam(value = "sourceType", required = false) CircularSourceType sourceType,
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "issueDateFrom", required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issueDateFrom,
            @RequestParam(value = "issueDateTo", required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate issueDateTo,
            @RequestParam(value = "active", required = false) Boolean active,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        SecurityUtils.currentUserOrThrow();
        return service.list(sourceType, q, issueDateFrom, issueDateTo, active, page, size);
    }

    @GetMapping("/{id}")
    public CircularDto get(@PathVariable("id") Long id) {
        SecurityUtils.currentUserOrThrow();
        return service.get(id);
    }
}

