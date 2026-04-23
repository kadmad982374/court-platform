package sy.gov.sla.litigationprogression.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sy.gov.sla.litigationprogression.domain.PostponementReason;
import sy.gov.sla.litigationprogression.infrastructure.PostponementReasonRepository;

import java.util.Comparator;
import java.util.List;

/**
 * يكشف قائمة أسباب التأجيل المعيارية للواجهة كي تَعرضها كقائمة منسدلة
 * بدل إجبار المستخدم على كتابة الرمز يدويًا.
 *
 * مرجع: الوظيفية §6.5، D-008، D-022 — الجدول مُدار عبر Flyway seed
 * (V8__postponement_reasons.sql) وكل المستخدمين المُصادَقين يمكنهم القراءة.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/postponement-reasons")
public class PostponementReasonController {

    private final PostponementReasonRepository repository;

    @GetMapping
    public List<PostponementReasonDto> list(
            @RequestParam(value = "activeOnly", required = false, defaultValue = "true") boolean activeOnly
    ) {
        return repository.findAll().stream()
                .filter(r -> !activeOnly || r.isActive())
                .sorted(Comparator.comparing(PostponementReason::getLabelAr))
                .map(r -> new PostponementReasonDto(r.getCode(), r.getLabelAr(), r.isActive()))
                .toList();
    }
}

