package sy.gov.sla.common.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;

class AppExceptionTest {

    @Test
    void appException_carries_status_code_and_message() {
        AppException ex = new AppException(HttpStatus.I_AM_A_TEAPOT, "TEAPOT", "I am a teapot");

        assertThat(ex.status()).isEqualTo(HttpStatus.I_AM_A_TEAPOT);
        assertThat(ex.code()).isEqualTo("TEAPOT");
        assertThat(ex.getMessage()).isEqualTo("I am a teapot");
    }

    @Test
    void appException_is_a_RuntimeException() {
        assertThat(new AppException(HttpStatus.OK, "C", "m"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void badRequest_default_code() {
        BadRequestException ex = new BadRequestException("missing field");

        assertThat(ex.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ex.code()).isEqualTo("BAD_REQUEST");
        assertThat(ex.getMessage()).isEqualTo("missing field");
    }

    @Test
    void badRequest_custom_code() {
        BadRequestException ex = new BadRequestException("DUPLICATE_FIELD", "username already taken");

        assertThat(ex.status()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(ex.code()).isEqualTo("DUPLICATE_FIELD");
        assertThat(ex.getMessage()).isEqualTo("username already taken");
    }

    @Test
    void notFound_uses_NOT_FOUND_code_and_404() {
        NotFoundException ex = new NotFoundException("case 1234 not found");

        assertThat(ex.status()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(ex.code()).isEqualTo("NOT_FOUND");
        assertThat(ex.getMessage()).isEqualTo("case 1234 not found");
    }

    @Test
    void conflict_carries_custom_code() {
        ConflictException ex = new ConflictException("USER_ALREADY_EXISTS", "username taken");

        assertThat(ex.status()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(ex.code()).isEqualTo("USER_ALREADY_EXISTS");
    }

    @Test
    void forbidden_default_code() {
        ForbiddenException ex = new ForbiddenException("nope");

        assertThat(ex.status()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.code()).isEqualTo("FORBIDDEN");
        assertThat(ex.getMessage()).isEqualTo("nope");
    }

    @Test
    void forbidden_custom_code() {
        ForbiddenException ex = new ForbiddenException(
                "BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD",
                "BRANCH_HEAD cannot grant the BRANCH_HEAD role");

        assertThat(ex.status()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(ex.code()).isEqualTo("BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD");
    }
}
