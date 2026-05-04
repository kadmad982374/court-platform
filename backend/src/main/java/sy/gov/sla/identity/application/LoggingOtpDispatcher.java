package sy.gov.sla.identity.application;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Demo/dev OTP dispatcher — writes a metadata-only line to the log so a tester
 * can find the code by tailing the backend log. Uses a separate logger
 * ({@code sy.gov.sla.OTP_DELIVERY}) so it can be routed/redacted in logback.
 *
 * P1-07: never log the full mobile number or the code in plaintext. The code
 * is fetched server-side at OTP-handover time (out-of-band channel) — this
 * logger only confirms a code was issued and indicates which mobile suffix
 * received it for support diagnostics.
 */
@Component
@Slf4j
public class LoggingOtpDispatcher implements OtpDispatcher {

    private static final org.slf4j.Logger OTP_LOG =
            org.slf4j.LoggerFactory.getLogger("sy.gov.sla.OTP_DELIVERY");

    @Override
    public void dispatch(String mobileNumber, String code) {
        // P1-07: NEVER log the OTP code or full mobile number.
        // Mobile suffix (last 4 digits) is enough for support to correlate
        // with a complaining user without revealing the number to anyone
        // tailing logs.
        OTP_LOG.info("[OTP] code-issued mobile_suffix=****{} length={}",
                lastFour(mobileNumber), code.length());
    }

    private static String lastFour(String mobile) {
        if (mobile == null) return "????";
        String digits = mobile.replaceAll("\\D", "");
        return digits.length() <= 4 ? digits : digits.substring(digits.length() - 4);
    }
}

