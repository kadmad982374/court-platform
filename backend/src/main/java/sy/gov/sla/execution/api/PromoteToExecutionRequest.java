package sy.gov.sla.execution.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * طلب إنشاء ملف تنفيذي من دعوى قائمة. مرجع: Phase 5.
 *
 * كل الحقول مُلزمة (snapshot نصي للأطراف على غرار D-011 الذي يلتقط
 * أسماء الجهات نصًا في لحظة الإنشاء).
 */
public record PromoteToExecutionRequest(
        @NotBlank @Size(max = 200) String enforcingEntityName,
        @NotBlank @Size(max = 200) String executedAgainstName,
        @NotBlank @Size(max = 64)  String executionFileType,
        @NotBlank @Size(max = 64)  String executionFileNumber,
        @NotNull  Integer executionYear
) {}

