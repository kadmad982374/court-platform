package sy.gov.sla.identity.application;

/**
 * منفذ خارجي لإرسال OTP. التنفيذ الحقيقي (SMS) يُترك لمزود لاحق.
 * في التطوير: تنفيذ Logging يكفي. (D-013)
 */
public interface OtpDispatcher {
    void dispatch(String mobileNumber, String code);
}

