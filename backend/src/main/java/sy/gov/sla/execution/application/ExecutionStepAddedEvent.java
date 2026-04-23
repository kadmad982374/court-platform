package sy.gov.sla.execution.application;

import sy.gov.sla.execution.domain.ExecutionStepType;

import java.time.Instant;

/**
 * يُنشر بعد commit ناجح لإضافة خطوة تنفيذية. مرجع: D-031.
 */
public record ExecutionStepAddedEvent(
        Long executionFileId,
        Long stepId,
        ExecutionStepType stepType,
        Long actorUserId,
        Instant occurredAt
) {}

