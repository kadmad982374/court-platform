package sy.gov.sla.phase7;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.support.AbstractIntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phase 7 — يغطي السيناريوهات 1..17:
 *  Legal Library (1..6) / Public Entities (7..11) / Circulars (12..17).
 *
 * يعتمد على بيانات seed المُحمَّلة بواسطة V17/V18/V19.
 */
@AutoConfigureMockMvc
class KnowledgeDirectoryCircularsIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired ObjectMapper om;

    String token;

    @BeforeEach
    void seedUser() throws Exception {
        try {
            Long uid = authService.createUser("p7user", "P7 User",
                    "0966677777", "Password!1", null, null);
            // أي مستخدم مصادق عليه يكفي لقراءة Phase 7 (D-042) — لا حاجة لـ role.
        } catch (Exception ignored) { /* user already exists between tests */ }
        token = login("p7user");
    }

    private String login(String u) throws Exception {
        MvcResult r = mvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(r.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private String auth() { return "Bearer " + token; }

    // =========================== Legal Library ===========================

    @Test
    void test1_listCategoriesSucceeds() throws Exception {
        mvc.perform(get("/api/v1/legal-library/categories").header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7));
    }

    @Test
    void test2_listItemsWithPagination() throws Exception {
        MvcResult r = mvc.perform(get("/api/v1/legal-library/items")
                        .param("page", "0").param("size", "3")
                        .header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        JsonNode page = om.readTree(r.getResponse().getContentAsString());
        assertThat(page.get("content").size()).isEqualTo(3);
        assertThat(page.get("size").asInt()).isEqualTo(3);
        assertThat(page.get("totalElements").asLong()).isGreaterThanOrEqualTo(7L);
    }

    @Test
    void test3_filterByCategoryWorks() throws Exception {
        // أحضر id لفئة CIVIL_LAW
        MvcResult cats = mvc.perform(get("/api/v1/legal-library/categories")
                        .header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        long civilId = -1;
        for (JsonNode c : om.readTree(cats.getResponse().getContentAsString())) {
            if ("CIVIL_LAW".equals(c.get("code").asText())) {
                civilId = c.get("id").asLong();
                break;
            }
        }
        assertThat(civilId).isPositive();

        long finalCivilId = civilId;
        mvc.perform(get("/api/v1/legal-library/items")
                        .param("categoryId", String.valueOf(finalCivilId))
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void test4_textSearchWorks() throws Exception {
        mvc.perform(get("/api/v1/legal-library/items")
                        .param("q", "البينات")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void test5_getByIdWorks() throws Exception {
        MvcResult r = mvc.perform(get("/api/v1/legal-library/items")
                        .param("size", "1").header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        long id = om.readTree(r.getResponse().getContentAsString())
                .get("content").get(0).get("id").asLong();

        mvc.perform(get("/api/v1/legal-library/items/" + id).header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) id));
    }

    @Test
    void test6_anonymousRejectedOnLegalLibrary() throws Exception {
        mvc.perform(get("/api/v1/legal-library/items"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/legal-library/categories"))
                .andExpect(status().isUnauthorized());
    }

    // =========================== Public Entities ===========================

    @Test
    void test7_listPublicEntitiesSucceeds() throws Exception {
        MvcResult r = mvc.perform(get("/api/v1/public-entities")
                        .param("size", "100").header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        JsonNode page = om.readTree(r.getResponse().getContentAsString());
        // 9 وزارات في seed.
        assertThat(page.get("totalElements").asLong()).isGreaterThanOrEqualTo(9L);
    }

    @Test
    void test8_filterPublicEntitiesByCategoryWorks() throws Exception {
        MvcResult cats = mvc.perform(get("/api/v1/public-entities/categories")
                        .header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        long ministriesId = -1;
        for (JsonNode c : om.readTree(cats.getResponse().getContentAsString())) {
            if ("MINISTRIES".equals(c.get("code").asText())) {
                ministriesId = c.get("id").asLong();
                break;
            }
        }
        assertThat(ministriesId).isPositive();

        mvc.perform(get("/api/v1/public-entities")
                        .param("categoryId", String.valueOf(ministriesId))
                        .param("size", "50")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(9)));
    }

    @Test
    void test9_publicEntitiesTextSearchWorks() throws Exception {
        mvc.perform(get("/api/v1/public-entities")
                        .param("q", "العدل")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void test10_getPublicEntityById() throws Exception {
        MvcResult r = mvc.perform(get("/api/v1/public-entities").param("size", "1")
                        .header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        long id = om.readTree(r.getResponse().getContentAsString())
                .get("content").get(0).get("id").asLong();
        mvc.perform(get("/api/v1/public-entities/" + id).header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) id));
    }

    @Test
    void test11_anonymousRejectedOnPublicEntities() throws Exception {
        mvc.perform(get("/api/v1/public-entities"))
                .andExpect(status().isUnauthorized());
    }

    // =========================== Circulars ===========================

    @Test
    void test12_listCircularsSucceeds() throws Exception {
        mvc.perform(get("/api/v1/circulars").header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThanOrEqualTo(4)));
    }

    @Test
    void test13_filterBySourceTypeWorks() throws Exception {
        mvc.perform(get("/api/v1/circulars")
                        .param("sourceType", "MINISTRY_OF_JUSTICE")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        mvc.perform(get("/api/v1/circulars")
                        .param("sourceType", "STATE_LITIGATION_ADMINISTRATION")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void test14_filterByIssueDateRange() throws Exception {
        // 2024 فقط — يعطي تعميمَي وزارة العدل من seed.
        mvc.perform(get("/api/v1/circulars")
                        .param("issueDateFrom", "2024-01-01")
                        .param("issueDateTo", "2024-12-31")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        // النصف الأول من 2025.
        mvc.perform(get("/api/v1/circulars")
                        .param("issueDateFrom", "2025-01-01")
                        .param("issueDateTo", "2025-06-30")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        // مدى مقلوب يُرفض.
        mvc.perform(get("/api/v1/circulars")
                        .param("issueDateFrom", "2025-06-30")
                        .param("issueDateTo", "2025-01-01")
                        .header("Authorization", auth()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void test15_circularsTextSearchWorks() throws Exception {
        mvc.perform(get("/api/v1/circulars")
                        .param("q", "أرشفة")
                        .header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void test16_getCircularById() throws Exception {
        MvcResult r = mvc.perform(get("/api/v1/circulars").param("size", "1")
                        .header("Authorization", auth()))
                .andExpect(status().isOk()).andReturn();
        long id = om.readTree(r.getResponse().getContentAsString())
                .get("content").get(0).get("id").asLong();
        mvc.perform(get("/api/v1/circulars/" + id).header("Authorization", auth()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) id));
    }

    @Test
    void test17_anonymousRejectedOnCirculars() throws Exception {
        mvc.perform(get("/api/v1/circulars"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/circulars/1"))
                .andExpect(status().isUnauthorized());
    }
}

