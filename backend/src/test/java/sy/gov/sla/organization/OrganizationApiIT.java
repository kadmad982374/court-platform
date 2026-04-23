package sy.gov.sla.organization;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sy.gov.sla.support.AbstractIntegrationTest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;

@AutoConfigureMockMvc
class OrganizationApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;

    @Test
    void anonymousIsRejectedOnProtectedEndpoint() throws Exception {
        mvc.perform(get("/api/v1/branches"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    void authenticatedListsAll14Branches() throws Exception {
        mvc.perform(get("/api/v1/branches").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(14));
    }

    @Test
    @WithMockUser
    void branchHasFourDepartments() throws Exception {
        mvc.perform(get("/api/v1/branches/1/departments").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
    }

    @Test
    @WithMockUser
    void courtsCanBeFilteredByBranchAndDepartmentType() throws Exception {
        mvc.perform(get("/api/v1/courts")
                .param("branchId", "1")
                .param("departmentType", "FIRST_INSTANCE")
                .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
}

