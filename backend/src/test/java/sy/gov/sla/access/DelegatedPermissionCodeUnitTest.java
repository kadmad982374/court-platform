package sy.gov.sla.access;

import org.junit.jupiter.api.Test;
import sy.gov.sla.access.domain.DelegatedPermissionCode;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * يضمن أن enum DelegatedPermissionCode يحتوي القيم المتوقعة فقط بعد إضافة PROMOTE_TO_APPEAL.
 * مرجع: D-027.
 */
class DelegatedPermissionCodeUnitTest {

    @Test
    void containsAllExpectedValuesIncludingPromoteToAppeal() {
        assertThat(DelegatedPermissionCode.values()).containsExactlyInAnyOrder(
                DelegatedPermissionCode.CREATE_CASE,
                DelegatedPermissionCode.EDIT_CASE_BASIC_DATA,
                DelegatedPermissionCode.ASSIGN_LAWYER,
                DelegatedPermissionCode.CORRECT_FINALIZED_CASE,
                DelegatedPermissionCode.DIRECT_FINALIZE_CASE,
                DelegatedPermissionCode.MANAGE_COURT_ACCESS,
                DelegatedPermissionCode.PROMOTE_TO_APPEAL,
                DelegatedPermissionCode.PROMOTE_TO_EXECUTION,
                DelegatedPermissionCode.ADD_EXECUTION_STEP
        );
    }
}

