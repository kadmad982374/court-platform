package sy.gov.sla.litigationprogression.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import sy.gov.sla.litigationprogression.application.HearingProgressionService;
import sy.gov.sla.security.SecurityUtils;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/stages")
public class StagesController {

    private final HearingProgressionService service;

    @GetMapping("/{stageId}")
    public StageDto getStage(@PathVariable("stageId") Long stageId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.getStage(stageId, actor);
    }

    @GetMapping("/{stageId}/progression")
    public StageProgressionDto getProgression(@PathVariable("stageId") Long stageId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.getProgression(stageId, actor);
    }

    @GetMapping("/{stageId}/hearing-history")
    public List<HearingProgressionEntryDto> getHistory(@PathVariable("stageId") Long stageId) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.getHearingHistory(stageId, actor);
    }

    @PostMapping("/{stageId}/rollover-hearing")
    public HearingProgressionEntryDto rollover(@PathVariable("stageId") Long stageId,
                                               @Valid @RequestBody RolloverHearingRequest req) {
        Long actor = SecurityUtils.currentUserOrThrow().userId();
        return service.rolloverHearing(stageId, req, actor);
    }
}

