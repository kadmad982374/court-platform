package sy.gov.sla.common.exception;

import org.springframework.http.HttpStatus;

public class ForbiddenException extends AppException {
    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
    /** Mini-Phase B — allow domain-specific 403 codes (e.g. BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD). */
    public ForbiddenException(String code, String message) {
        super(HttpStatus.FORBIDDEN, code, message);
    }
}

