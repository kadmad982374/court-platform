package sy.gov.sla.common.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import sy.gov.sla.common.exception.AppException;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * P7-03 — Unit tests for {@link GlobalExceptionHandler}.
 * Covers all @ExceptionHandler branches: AppException, validation, malformed body,
 * AccessDeniedException, AuthenticationException, NoResourceFoundException,
 * HttpRequestMethodNotSupportedException, generic Exception.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("AppException → status + code from exception, message preserved")
    void appException_maps_to_its_status_and_code() {
        AppException ex = new AppException(HttpStatus.CONFLICT, "DUPLICATE_USER", "username taken");

        ResponseEntity<ApiError> resp = handler.handleApp(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        ApiError body = resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.code()).isEqualTo("DUPLICATE_USER");
        assertThat(body.message()).isEqualTo("username taken");
        assertThat(body.details()).isEmpty();
        assertThat(body.timestamp()).isNotNull();
    }

    @Test
    @DisplayName("MethodArgumentNotValidException → 400 with field-level details")
    void validation_returns_400_with_field_details() throws Exception {
        BindingResult br = new BeanPropertyBindingResult(new Object(), "target");
        br.rejectValue("username", "NotBlank", "must not be blank");
        br.rejectValue("password", "Size", "size must be between 8 and 64");
        MethodParameter param = methodParameter();
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(param, br);

        ResponseEntity<ApiError> resp = handler.handleValidation(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        ApiError body = resp.getBody();
        assertThat(body).isNotNull();
        assertThat(body.code()).isEqualTo("VALIDATION_ERROR");
        assertThat(body.details()).hasSize(2);
        assertThat(body.details())
                .extracting(ApiError.FieldErrorEntry::field)
                .containsExactlyInAnyOrder("username", "password");
        assertThat(body.details())
                .extracting(ApiError.FieldErrorEntry::message)
                .containsExactlyInAnyOrder("must not be blank", "size must be between 8 and 64");
    }

    @Test
    @DisplayName("validation with null defaultMessage falls back to 'invalid'")
    void validation_with_null_message_falls_back() throws Exception {
        BindingResult br = new BeanPropertyBindingResult(new Object(), "target");
        // reject with explicit null defaultMessage
        br.rejectValue("field", "code", null, null, null);
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(methodParameter(), br);

        ResponseEntity<ApiError> resp = handler.handleValidation(ex);

        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().details()).hasSize(1);
        assertThat(resp.getBody().details().get(0).message()).isEqualTo("invalid");
    }

    @Test
    @DisplayName("HttpMessageNotReadableException → 400 INVALID_REQUEST_BODY")
    void malformed_body_returns_400() {
        HttpMessageNotReadableException ex =
                new HttpMessageNotReadableException("bad json", (org.springframework.http.HttpInputMessage) null);

        ResponseEntity<ApiError> resp = handler.handleNotReadable(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().code()).isEqualTo("INVALID_REQUEST_BODY");
    }

    @Test
    @DisplayName("AccessDeniedException → 403 FORBIDDEN")
    void access_denied_returns_403() {
        ResponseEntity<ApiError> resp = handler.handleAccessDenied(new AccessDeniedException("nope"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().code()).isEqualTo("FORBIDDEN");
        assertThat(resp.getBody().message()).doesNotContain("nope"); // generic message, no leak
    }

    @Test
    @DisplayName("AuthenticationException → 401 UNAUTHENTICATED")
    void auth_exception_returns_401() {
        AuthenticationException ex = new AuthenticationException("bad creds") {};

        ResponseEntity<ApiError> resp = handler.handleAuth(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().code()).isEqualTo("UNAUTHENTICATED");
        assertThat(resp.getBody().message()).doesNotContain("bad creds");
    }

    @Test
    @DisplayName("NoResourceFoundException → 404 NOT_FOUND (P8b-02 regression guard)")
    void no_resource_returns_404() {
        NoResourceFoundException ex = new NoResourceFoundException(
                org.springframework.http.HttpMethod.GET, "/missing");

        ResponseEntity<ApiError> resp = handler.handleNoResource(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().code()).isEqualTo("NOT_FOUND");
    }

    @Test
    @DisplayName("HttpRequestMethodNotSupportedException → 405 METHOD_NOT_ALLOWED (P8b-02 regression guard)")
    void method_not_supported_returns_405() {
        HttpRequestMethodNotSupportedException ex =
                new HttpRequestMethodNotSupportedException("DELETE");

        ResponseEntity<ApiError> resp = handler.handleMethodNotAllowed(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().code()).isEqualTo("METHOD_NOT_ALLOWED");
    }

    @Test
    @DisplayName("generic Exception → 500 with safe message (no internals leaked)")
    void unknown_exception_returns_500_without_leak() {
        ResponseEntity<ApiError> resp = handler.handleGeneric(
                new IllegalStateException("internal db timeout at line 42"));

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().code()).isEqualTo("INTERNAL_ERROR");
        assertThat(resp.getBody().message()).isEqualTo("Unexpected error");
        assertThat(resp.getBody().message()).doesNotContain("line 42");
    }

    /** Helper: reflection-based MethodParameter for MethodArgumentNotValidException ctor. */
    private static MethodParameter methodParameter() throws Exception {
        Method m = GlobalExceptionHandlerTest.class.getDeclaredMethod("dummyForReflection", String.class);
        return new MethodParameter(m, 0);
    }

    @SuppressWarnings("unused")
    private void dummyForReflection(String s) { /* used only by reflection above */ }
}
