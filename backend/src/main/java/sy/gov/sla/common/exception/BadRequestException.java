package sy.gov.sla.common.exception;

import org.springframework.http.HttpStatus;

public class BadRequestException extends AppException {
    public BadRequestException(String code, String message) {
        super(HttpStatus.BAD_REQUEST, code, message);
    }
    public BadRequestException(String message) {
        this("BAD_REQUEST", message);
    }
}

