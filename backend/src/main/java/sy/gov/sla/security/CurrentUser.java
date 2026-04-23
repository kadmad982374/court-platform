package sy.gov.sla.security;

/**
 * يمثل المستخدم الحالي المصادَق عليه في طبقة الـ Application/Service.
 * Principal للـ Spring Security.
 */
public record CurrentUser(Long userId, String username) {}

