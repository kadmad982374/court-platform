package sy.gov.sla.access;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.access.domain.UserDepartmentMembership;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.organization.infrastructure.CourtRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.support.AbstractIntegrationTest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class AccessControlApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired DepartmentRepository departmentRepo;
    @Autowired CourtRepository courtRepo;
    @Autowired ObjectMapper om;

    Long sectionHeadId;
    Long lawyerId;
    Long branchId;
    Long firstInstanceDeptId;
    Long firstInstanceCourtId;
    String headToken;

    @BeforeEach
    void seed() throws Exception {
        try {
            sectionHeadId = authService.createUser("head1", "Head", "0922222222",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);
            lawyerId = authService.createUser("lawyer1", "Lawyer", "0933333333",
                    "Password!1", null, null);
            authService.assignRole(lawyerId, RoleType.STATE_LAWYER);

            branchId = 1L; // Damascus from seed.
            firstInstanceDeptId = departmentRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            firstInstanceCourtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();

            membershipRepo.save(UserDepartmentMembership.builder()
                    .userId(sectionHeadId).branchId(branchId).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder()
                    .userId(lawyerId).branchId(branchId).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
        } catch (Exception ignored) {
            // re-use existing
            sectionHeadId = sectionHeadId == null ? findIdByLogin("head1", "Password!1") : sectionHeadId;
            lawyerId = lawyerId == null ? findIdByLogin("lawyer1", "Password!1") : lawyerId;
            branchId = 1L;
            firstInstanceDeptId = departmentRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            firstInstanceCourtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
        }
        headToken = login("head1", "Password!1");
    }

    private Long findIdByLogin(String u, String p) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u + "\",\"password\":\"" + p + "\"}"))
                .andReturn();
        // Decode JWT 'sub' is hard here; rely on /me
        String tok = om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
        var me = mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + tok)).andReturn();
        return om.readTree(me.getResponse().getContentAsString()).get("id").asLong();
    }

    private String login(String u, String p) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u + "\",\"password\":\"" + p + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }

    @Test
    void sectionHeadCanGrantCourtAccessToLawyerInSameDepartment() throws Exception {
        String body = "{\"entries\":[{\"courtId\":" + firstInstanceCourtId + ",\"active\":true}]}";
        mvc.perform(put("/api/v1/users/" + lawyerId + "/court-access")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].courtId").value(firstInstanceCourtId))
                .andExpect(jsonPath("$[0].active").value(true));
    }

    @Test
    void sectionHeadCannotGrantCourtAccessOutsideHisBranch() throws Exception {
        Long otherCourt = courtRepo.findByBranchIdAndDepartmentType(2L, DepartmentType.FIRST_INSTANCE)
                .get(0).getId();
        String body = "{\"entries\":[{\"courtId\":" + otherCourt + ",\"active\":true}]}";
        mvc.perform(put("/api/v1/users/" + lawyerId + "/court-access")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void departmentMembershipsAreReturnedForOwnUser() throws Exception {
        String lawyerToken = login("lawyer1", "Password!1");
        mvc.perform(get("/api/v1/users/" + lawyerId + "/department-memberships")
                .header("Authorization", "Bearer " + lawyerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].membershipType").value("STATE_LAWYER"));
    }

    @Test
    void delegatedPermissionsRequireTargetToBeAdminClerkInActorScope() throws Exception {
        // lawyer is STATE_LAWYER, not ADMIN_CLERK -> should be forbidden.
        String body = "{\"entries\":[{\"code\":\"CREATE_CASE\",\"granted\":false}]}";
        mvc.perform(put("/api/v1/users/" + lawyerId + "/delegated-permissions")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void protectedEndpointsRejectAnonymous() throws Exception {
        mvc.perform(get("/api/v1/users/" + lawyerId + "/department-memberships"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/users/" + lawyerId + "/court-access")
                .contentType(MediaType.APPLICATION_JSON).content("{\"entries\":[]}"))
                .andExpect(status().isUnauthorized());
    }
}

