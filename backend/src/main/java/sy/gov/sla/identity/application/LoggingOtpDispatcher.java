package sy.gov.sla.identity.application;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class LoggingOtpDispatcher implements OtpDispatcher {
    @Override
    public void dispatch(String mobileNumber, String code) {
        log.info("[OTP] mobile={} code={}", mobileNumber, code);
    }
}

