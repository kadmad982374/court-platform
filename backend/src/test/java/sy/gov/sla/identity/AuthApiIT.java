package sy.gov.sla.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.support.AbstractIntegrationTest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class AuthApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired ObjectMapper om;

    @BeforeEach
    void setupUser() {
        try {
            Long id = authService.createUser("alice", "Alice", "0911111111",
                    "Password!1", null, null);
            authService.assignRole(id, RoleType.CENTRAL_SUPERVISOR);
        } catch (Exception ignored) {
            // already created from a previous test in the same context.
        }
    }

    @Test
    void loginReturnsTokenPair_andUsersMeWorks() throws Exception {
        String body = """
                {"username":"alice","password":"Password!1"}
                """;
        var result = mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();
        JsonNode json = om.readTree(result.getResponse().getContentAsString());
        String access = json.get("accessToken").asText();

        mvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"))
                .andExpect(jsonPath("$.roles[0]").value("CENTRAL_SUPERVISOR"));
    }

    @Test
    void loginWithBadPasswordIsUnauthorized() throws Exception {
        String body = """
                {"username":"alice","password":"wrong"}
                """;
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void usersMeWithoutTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshAndLogoutFlow() throws Exception {
        String loginBody = "{\"username\":\"alice\",\"password\":\"Password!1\"}";
        var loginResp = mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(loginBody))
                .andExpect(status().isOk()).andReturn();
        String refresh = om.readTree(loginResp.getResponse().getContentAsString())
                .get("refreshToken").asText();

        var refreshResp = mvc.perform(post("/api/v1/auth/refresh-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String newRefresh = om.readTree(refreshResp.getResponse().getContentAsString())
                .get("refreshToken").asText();

        mvc.perform(post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + newRefresh + "\"}"))
                .andExpect(status().isOk());

        // The old refresh was rotated -> already revoked.
        mvc.perform(post("/api/v1/auth/refresh-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"refreshToken\":\"" + refresh + "\"}"))
                .andExpect(status().isUnauthorized());
    }
}

