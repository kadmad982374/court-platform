package sy.gov.sla.common.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import sy.gov.sla.common.exception.AppException;

import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiError> handleApp(AppException ex) {
        return ResponseEntity.status(ex.status())
                .body(ApiError.of(ex.code(), ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
        List<ApiError.FieldErrorEntry> details = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiError.FieldErrorEntry(fe.getField(),
                        fe.getDefaultMessage() == null ? "invalid" : fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest()
                .body(ApiError.of("VALIDATION_ERROR", "Validation failed", details));
    }

    /**
     * Mini-Phase B — return 400 (instead of 500) for malformed JSON bodies,
     * including unknown enum values such as {@code "role":"NOT_A_ROLE"}.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> handleNotReadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
                .body(ApiError.of("INVALID_REQUEST_BODY", "Request body is invalid or malformed"));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiError.of("FORBIDDEN", "Access denied"));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiError> handleAuth(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiError.of("UNAUTHENTICATED", "Authentication required"));
    }

    /** Unknown URL — map Spring's default 500 for missing static resources to a clean 404. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiError.of("NOT_FOUND", "Endpoint not found"));
    }

    /** Wrong HTTP method on a known path — return 405 instead of 500. */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiError> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(ApiError.of("METHOD_NOT_ALLOWED", "HTTP method not supported for this endpoint"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric(Exception ex) {
        log.error("Unhandled exception in request handler", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiError.of("INTERNAL_ERROR", "Unexpected error"));
    }
}

