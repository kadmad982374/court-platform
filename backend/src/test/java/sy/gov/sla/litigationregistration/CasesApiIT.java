package sy.gov.sla.litigationregistration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.*;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.CourtRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;
import sy.gov.sla.support.AbstractIntegrationTest;

import java.time.Instant;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class CasesApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserCourtAccessRepository courtAccessRepo;
    @Autowired DepartmentRepository deptRepo;
    @Autowired CourtRepository courtRepo;
    @Autowired ObjectMapper om;
    @Autowired AuthorizationService authorizationService; // ensures port wired

    Long sectionHeadId, lawyerInDeptId, lawyerOutsideId, otherSectionHeadId;
    Long branchId = 1L;
    Long otherBranchId = 2L;
    Long firstInstanceDeptId, firstInstanceCourtId;
    Long otherBranchCourtId;
    String headToken, lawyerToken, otherHeadToken;

    @BeforeEach
    void seed() throws Exception {
        try {
            sectionHeadId = authService.createUser("p2head", "P2 Head", "0944111111",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);

            lawyerInDeptId = authService.createUser("p2law1", "P2 Lawyer", "0944222222",
                    "Password!1", null, null);
            authService.assignRole(lawyerInDeptId, RoleType.STATE_LAWYER);

            lawyerOutsideId = authService.createUser("p2law2", "P2 Lawyer outside", "0944333333",
                    "Password!1", null, null);
            authService.assignRole(lawyerOutsideId, RoleType.STATE_LAWYER);

            otherSectionHeadId = authService.createUser("p2head2", "Other Head", "0944444444",
                    "Password!1", null, null);
            authService.assignRole(otherSectionHeadId, RoleType.SECTION_HEAD);

            firstInstanceDeptId = deptRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            firstInstanceCourtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
            otherBranchCourtId = courtRepo.findByBranchIdAndDepartmentType(otherBranchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();

            membershipRepo.save(UserDepartmentMembership.builder().userId(sectionHeadId)
                    .branchId(branchId).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerInDeptId)
                    .branchId(branchId).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            // lawyerOutside is in OTHER branch, not in our dept.
            Long otherDeptId = deptRepo.findByBranchIdAndType(otherBranchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerOutsideId)
                    .branchId(otherBranchId).departmentId(otherDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(otherSectionHeadId)
                    .branchId(otherBranchId).departmentId(otherDeptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());

            // Grant lawyerInDept court access to firstInstanceCourtId.
            courtAccessRepo.save(UserCourtAccess.builder().userId(lawyerInDeptId)
                    .courtId(firstInstanceCourtId).grantedByUserId(sectionHeadId)
                    .grantedAt(Instant.now()).active(true).build());
        } catch (Exception ignored) {
            // re-using existing rows from another test in same context; keep going.
            firstInstanceDeptId = deptRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            firstInstanceCourtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
            otherBranchCourtId = courtRepo.findByBranchIdAndDepartmentType(otherBranchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
            sectionHeadId = idOf("p2head");
            lawyerInDeptId = idOf("p2law1");
            lawyerOutsideId = idOf("p2law2");
            otherSectionHeadId = idOf("p2head2");
        }
        headToken = login("p2head");
        lawyerToken = login("p2law1");
        otherHeadToken = login("p2head2");
    }

    private String login(String u) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private Long idOf(String username) throws Exception {
        String tok = login(username);
        var me = mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + tok)).andReturn();
        return om.readTree(me.getResponse().getContentAsString()).get("id").asLong();
    }

    private String createBody(Long branch, Long dept, Long court, String basis) {
        return ("{"
                + "\"publicEntityName\":\"وزارة العدل\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"أحمد\","
                + "\"originalBasisNumber\":\"" + basis + "\","
                + "\"basisYear\":2026,"
                + "\"originalRegistrationDate\":\"2026-04-01\","
                + "\"branchId\":" + branch + ","
                + "\"departmentId\":" + dept + ","
                + "\"courtId\":" + court + ","
                + "\"chamberName\":\"الغرفة الأولى\","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"" + basis + "\","
                + "\"stageYear\":2026,"
                + "\"firstHearingDate\":\"2026-05-01\","
                + "\"firstPostponementReason\":\"تبليغ الأطراف\""
                + "}");
    }

    private Long createCaseAsHead() throws Exception {
        var resp = mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody(branchId, firstInstanceDeptId, firstInstanceCourtId,
                        "B-" + System.nanoTime())))
                .andExpect(status().isCreated()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test
    void createCaseSucceeds() throws Exception {
        mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody(branchId, firstInstanceDeptId, firstInstanceCourtId,
                        "OK-" + System.nanoTime())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.lifecycleStatus").value("NEW"))
                .andExpect(jsonPath("$.stages.length()").value(1))
                .andExpect(jsonPath("$.stages[0].stageStatus").value("REGISTERED"))
                .andExpect(jsonPath("$.stages[0].firstPostponementReason").value("تبليغ الأطراف"));
    }

    @Test
    void createCaseRejectedWhenCourtNotInBranch() throws Exception {
        mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody(branchId, firstInstanceDeptId, otherBranchCourtId,
                        "BAD-" + System.nanoTime())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INCONSISTENT_SCOPE"));
    }

    @Test
    void updateBasicDataSucceeds_butCannotChangeOriginalRegistrationDate() throws Exception {
        Long caseId = createCaseAsHead();
        // No field for original_registration_date in UpdateBasicDataRequest -> immutable by design.
        // Update opponent name + basis year:
        String body = "{\"opponentName\":\"خالد المُعدَّل\",\"basisYear\":2027}";
        var resp = mvc.perform(put("/api/v1/cases/" + caseId + "/basic-data")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        JsonNode j = om.readTree(resp.getResponse().getContentAsString());
        org.assertj.core.api.Assertions.assertThat(j.get("opponentName").asText()).isEqualTo("خالد المُعدَّل");
        org.assertj.core.api.Assertions.assertThat(j.get("basisYear").asInt()).isEqualTo(2027);
        org.assertj.core.api.Assertions.assertThat(j.get("originalRegistrationDate").asText()).isEqualTo("2026-04-01");
    }

    @Test
    void assignLawyerSucceeds_andOwnershipIsSet() throws Exception {
        Long caseId = createCaseAsHead();
        String body = "{\"lawyerUserId\":" + lawyerInDeptId + "}";
        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentOwnerUserId").value(lawyerInDeptId))
                .andExpect(jsonPath("$.lifecycleStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.stages[0].stageStatus").value("ASSIGNED"));
    }

    @Test
    void assignLawyerRejectedWhenNoCourtAccess() throws Exception {
        Long caseId = createCaseAsHead();
        // Create a fresh lawyer in same dept WITHOUT court access.
        Long noAccessLawyer = authService.createUser("p2lawNoAccess", "L NoAcc", "0944555555",
                "Password!1", null, null);
        authService.assignRole(noAccessLawyer, RoleType.STATE_LAWYER);
        membershipRepo.save(UserDepartmentMembership.builder().userId(noAccessLawyer)
                .branchId(branchId).departmentId(firstInstanceDeptId)
                .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());

        String body = "{\"lawyerUserId\":" + noAccessLawyer + "}";
        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void assignLawyerRejectedWhenLawyerOutsideDepartment() throws Exception {
        Long caseId = createCaseAsHead();
        String body = "{\"lawyerUserId\":" + lawyerOutsideId + "}";
        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    void otherSectionHeadCannotReadOurCase() throws Exception {
        Long caseId = createCaseAsHead();
        mvc.perform(get("/api/v1/cases/" + caseId).header("Authorization", "Bearer " + otherHeadToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void lawyerSeesOnlyAssignedCases() throws Exception {
        Long c1 = createCaseAsHead();
        Long c2 = createCaseAsHead();
        // assign c1 only.
        mvc.perform(post("/api/v1/cases/" + c1 + "/assign-lawyer")
                .header("Authorization", "Bearer " + headToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"lawyerUserId\":" + lawyerInDeptId + "}"))
                .andExpect(status().isOk());

        var resp = mvc.perform(get("/api/v1/cases?size=100")
                .header("Authorization", "Bearer " + lawyerToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode j = om.readTree(resp.getResponse().getContentAsString());
        // ensure c1 appears, c2 does not
        boolean hasC1 = false, hasC2 = false;
        for (JsonNode n : j.get("content")) {
            long id = n.get("id").asLong();
            if (id == c1) hasC1 = true;
            if (id == c2) hasC2 = true;
        }
        org.assertj.core.api.Assertions.assertThat(hasC1).isTrue();
        org.assertj.core.api.Assertions.assertThat(hasC2).isFalse();

        // and direct fetch of c2 is forbidden for lawyer.
        mvc.perform(get("/api/v1/cases/" + c2).header("Authorization", "Bearer " + lawyerToken))
                .andExpect(status().isForbidden());
        // direct fetch of c1 OK.
        mvc.perform(get("/api/v1/cases/" + c1).header("Authorization", "Bearer " + lawyerToken))
                .andExpect(status().isOk());
    }

    @Test
    void anonymousCannotAccessCases() throws Exception {
        mvc.perform(get("/api/v1/cases")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/cases").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }
}

