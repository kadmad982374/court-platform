package sy.gov.sla.identity.bootstrap;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.identity.infrastructure.UserRepository;

/**
 * يُنشئ مستخدم CENTRAL_SUPERVISOR ابتدائيًا إن لم يكن موجودًا، لتمكين تسجيل دخول أولي.
 * مرجع: D-018 (مضاف في PROJECT_ASSUMPTIONS_AND_DECISIONS).
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class BootstrapAdminRunner {

    /** P8b-01: explicit ordering — admin must be created BEFORE the dev-seed
     *  runner attempts to insert dev users that reference admin's password hash. */
    @Bean
    @Order(10)
    public ApplicationRunner bootstrapAdminApplicationRunner(BootstrapAdminProperties props,
                                                             UserRepository userRepository,
                                                             AuthService authService) {
        return args -> {
            if (!props.enabled()) {
                log.info("Bootstrap admin disabled");
                return;
            }
            if (userRepository.findByUsername(props.username()).isPresent()) {
                log.info("Bootstrap admin '{}' already exists", props.username());
                return;
            }
            Long id = authService.createUser(
                    props.username(), props.fullName(), props.mobileNumber(),
                    props.initialPassword(), null, null);
            authService.assignRole(id, RoleType.CENTRAL_SUPERVISOR);
            log.warn("Bootstrap CENTRAL_SUPERVISOR created: username='{}' (CHANGE PASSWORD!)", props.username());
            UserActionLog.system("bootstrap admin '{}' created (id #{}) — MUST change password on first login",
                    props.username(), id);
        };
    }
}

