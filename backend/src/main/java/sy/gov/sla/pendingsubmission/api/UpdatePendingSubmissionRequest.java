package sy.gov.sla.pendingsubmission.api;

import jakarta.validation.constraints.Size;

/**
 * تحديث سجل «تحت الرفع». الحقول كلها اختيارية؛ يُحدَّث المُمرَّر منها فقط.
 * الفرع/القسم غير قابلين للتعديل بعد الإنشاء.
 */
public record UpdatePendingSubmissionRequest(
        @Size(max = 64)  String incomingNumber,
        @Size(max = 64)  String letterNumber,
        @Size(max = 200) String publicEntityName,
        @Size(max = 200) String opponentName,
        @Size(max = 500) String subject,
        @Size(max = 1000) String notes
) {}
