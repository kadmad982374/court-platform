package sy.gov.sla.stagetransition;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sy.gov.sla.access.domain.*;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
import sy.gov.sla.access.infrastructure.UserDelegatedPermissionRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.CourtRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;
import sy.gov.sla.support.AbstractIntegrationTest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class ResolvedRegisterAndAppealIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserCourtAccessRepository courtAccessRepo;
    @Autowired UserDelegatedPermissionRepository delegationRepo;
    @Autowired DepartmentRepository deptRepo;
    @Autowired CourtRepository courtRepo;
    @Autowired ObjectMapper om;

    Long sectionHeadId, lawyerId, otherBranchHeadId;
    Long branchId = 1L;
    Long otherBranchId = 2L;
    Long deptId, courtId;
    Long otherDeptId;
    String headTok, lawTok, otherHeadTok;

    @BeforeEach
    void seed() throws Exception {
        try {
            sectionHeadId = authService.createUser("p4head", "P4 Head", "0966111111",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);
            lawyerId = authService.createUser("p4law", "P4 Lawyer", "0966222222",
                    "Password!1", null, null);
            authService.assignRole(lawyerId, RoleType.STATE_LAWYER);
            otherBranchHeadId = authService.createUser("p4head2", "Other Head", "0966333333",
                    "Password!1", null, null);
            authService.assignRole(otherBranchHeadId, RoleType.SECTION_HEAD);

            deptId = deptRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            courtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
            otherDeptId = deptRepo.findByBranchIdAndType(otherBranchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();

            membershipRepo.save(UserDepartmentMembership.builder().userId(sectionHeadId)
                    .branchId(branchId).departmentId(deptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerId)
                    .branchId(branchId).departmentId(deptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(otherBranchHeadId)
                    .branchId(otherBranchId).departmentId(otherDeptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());
            courtAccessRepo.save(UserCourtAccess.builder().userId(lawyerId)
                    .courtId(courtId).grantedByUserId(sectionHeadId)
                    .grantedAt(Instant.now()).active(true).build());
        } catch (Exception ignored) {
            deptId = deptRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            courtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
            otherDeptId = deptRepo.findByBranchIdAndType(otherBranchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            sectionHeadId = idOf("p4head");
            lawyerId = idOf("p4law");
            otherBranchHeadId = idOf("p4head2");
        }
        headTok = login("p4head");
        lawTok = login("p4law");
        otherHeadTok = login("p4head2");
    }

    private String login(String u) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }
    private Long idOf(String u) throws Exception {
        var me = mvc.perform(get("/api/v1/users/me").header("Authorization", "Bearer " + login(u))).andReturn();
        return om.readTree(me.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createCaseAndFinalize(String basis, String decisionDate, String decisionType) throws Exception {
        // create
        String body = ("{"
                + "\"publicEntityName\":\"وزارة العدل\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"خصم\","
                + "\"originalBasisNumber\":\"" + basis + "\","
                + "\"basisYear\":2026,"
                + "\"originalRegistrationDate\":\"2026-01-15\","
                + "\"branchId\":" + branchId + ",\"departmentId\":" + deptId + ",\"courtId\":" + courtId + ","
                + "\"chamberName\":\"غ1\","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"S-" + basis + "\","
                + "\"stageYear\":2026,"
                + "\"firstHearingDate\":\"2026-02-01\","
                + "\"firstPostponementReason\":\"تبليغ الأطراف\""
                + "}");
        var resp = mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        long caseId = om.readTree(resp.getResponse().getContentAsString()).get("id").asLong();

        // assign
        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"lawyerUserId\":" + lawyerId + "}"))
                .andExpect(status().isOk());

        // get current stage id
        var stages = mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        long stageId = om.readTree(stages.getResponse().getContentAsString()).get(0).get("id").asLong();

        // finalize
        String fin = "{\"decisionNumber\":\"D-" + basis + "\",\"decisionDate\":\"" + decisionDate
                + "\",\"decisionType\":\"" + decisionType + "\"}";
        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON).content(fin))
                .andExpect(status().isOk());
        return caseId;
    }

    // ========== Resolved Register tests ==========

    @Test
    void test1_finalizedCaseAppearsInResolvedRegisterByDecisionMonth() throws Exception {
        long caseId = createCaseAndFinalize("RR-1-" + System.nanoTime(), "2026-04-12", "AGAINST_ENTITY");
        var resp = mvc.perform(get("/api/v1/resolved-register?year=2026&month=4")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(resp.getResponse().getContentAsString());
        boolean found = false;
        for (JsonNode n : arr) if (n.get("caseId").asLong() == caseId) found = true;
        assertThat(found).isTrue();
    }

    @Test
    void test2_filterByMonthExcludesOtherMonths() throws Exception {
        long c1 = createCaseAndFinalize("RR-2-" + System.nanoTime(), "2026-03-10", "FOR_ENTITY");
        long c2 = createCaseAndFinalize("RR-3-" + System.nanoTime(), "2026-05-10", "FOR_ENTITY");
        var resp = mvc.perform(get("/api/v1/resolved-register?year=2026&month=3")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(resp.getResponse().getContentAsString());
        boolean has1 = false, has2 = false;
        for (JsonNode n : arr) {
            long id = n.get("caseId").asLong();
            if (id == c1) has1 = true;
            if (id == c2) has2 = true;
        }
        assertThat(has1).isTrue();
        assertThat(has2).isFalse();
    }

    @Test
    void test3_decisionTypeFilterWorks() throws Exception {
        long c1 = createCaseAndFinalize("RR-4-" + System.nanoTime(), "2026-06-01", "AGAINST_ENTITY");
        long c2 = createCaseAndFinalize("RR-5-" + System.nanoTime(), "2026-06-02", "SETTLEMENT");
        var resp = mvc.perform(get("/api/v1/resolved-register?year=2026&month=6&decisionType=AGAINST_ENTITY")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(resp.getResponse().getContentAsString());
        boolean has1 = false, has2 = false;
        for (JsonNode n : arr) {
            long id = n.get("caseId").asLong();
            if (id == c1) has1 = true;
            if (id == c2) has2 = true;
        }
        assertThat(has1).isTrue();
        assertThat(has2).isFalse();
    }

    @Test
    void test4_otherBranchHeadCannotSeeOurResolvedCases() throws Exception {
        long caseId = createCaseAndFinalize("RR-S-" + System.nanoTime(), "2026-07-01", "FOR_ENTITY");
        var resp = mvc.perform(get("/api/v1/resolved-register?year=2026&month=7")
                .header("Authorization", "Bearer " + otherHeadTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(resp.getResponse().getContentAsString());
        for (JsonNode n : arr) {
            assertThat(n.get("caseId").asLong()).isNotEqualTo(caseId);
        }
    }

    @Test
    void test5_anonymousIsRejected() throws Exception {
        mvc.perform(get("/api/v1/resolved-register?year=2026&month=4"))
                .andExpect(status().isUnauthorized());
    }

    // ========== Promote-to-appeal tests ==========

    @Test
    void test6_promoteToAppealSuccess_setsLifecycleAndCurrentStage() throws Exception {
        long caseId = createCaseAndFinalize("AP-1-" + System.nanoTime(), "2026-04-20", "AGAINST_ENTITY");

        // capture previous stage id
        long prevStageId = om.readTree(mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).get(0).get("id").asLong();

        var resp = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lifecycleStatus").value("IN_APPEAL"))
                .andReturn();
        JsonNode r = om.readTree(resp.getResponse().getContentAsString());
        assertThat(r.get("previousStageId").asLong()).isEqualTo(prevStageId);
        long newStageId = r.get("newAppealStageId").asLong();

        // case should now show IN_APPEAL and current_stage_id = new
        var caseResp = mvc.perform(get("/api/v1/cases/" + caseId)
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode c = om.readTree(caseResp.getResponse().getContentAsString());
        assertThat(c.get("lifecycleStatus").asText()).isEqualTo("IN_APPEAL");
        assertThat(c.get("currentStageId").asLong()).isEqualTo(newStageId);

        // previous stage now read-only + PROMOTED_TO_APPEAL
        var prev = mvc.perform(get("/api/v1/stages/" + prevStageId)
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode prevJson = om.readTree(prev.getResponse().getContentAsString());
        assertThat(prevJson.get("readOnly").asBoolean()).isTrue();
        assertThat(prevJson.get("stageStatus").asText()).isEqualTo("PROMOTED_TO_APPEAL");

        // new stage: APPEAL with parent_stage_id set
        // (the case stages list now contains 2 stages — verify parent linkage via /cases/{id})
        // CaseStageDto exposes parentStageId (built earlier in Phase 2 dto)
        boolean foundAppeal = false;
        for (JsonNode s : c.get("stages")) {
            if (s.get("id").asLong() == newStageId) {
                assertThat(s.get("stageType").asText()).isEqualTo("APPEAL");
                assertThat(s.get("parentStageId").asLong()).isEqualTo(prevStageId);
                foundAppeal = true;
            }
        }
        assertThat(foundAppeal).isTrue();
    }

    @Test
    void test7_hearingHistoryOfPreviousStageIsPreserved() throws Exception {
        long caseId = createCaseAndFinalize("AP-2-" + System.nanoTime(), "2026-04-22", "AGAINST_ENTITY");
        long prevStageId = om.readTree(mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).get(0).get("id").asLong();

        // capture history size before
        int beforeSize = om.readTree(mvc.perform(get("/api/v1/stages/" + prevStageId + "/hearing-history")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).size();

        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk());

        int afterSize = om.readTree(mvc.perform(get("/api/v1/stages/" + prevStageId + "/hearing-history")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).size();
        assertThat(afterSize).isEqualTo(beforeSize);
    }

    @Test
    void test8_newAppealStageHasIndependentEmptyHistory() throws Exception {
        long caseId = createCaseAndFinalize("AP-3-" + System.nanoTime(), "2026-04-23", "FOR_ENTITY");
        var resp = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        long newStageId = om.readTree(resp.getResponse().getContentAsString()).get("newAppealStageId").asLong();

        var hist = mvc.perform(get("/api/v1/stages/" + newStageId + "/hearing-history")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        // The new APPEAL stage has its own (empty) hearing-history — no copying.
        JsonNode arr = om.readTree(hist.getResponse().getContentAsString());
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(0);
    }

    @Test
    void test9_promoteRejectedFromUnauthorizedRoles() throws Exception {
        long caseId = createCaseAndFinalize("AP-4-" + System.nanoTime(), "2026-04-24", "AGAINST_ENTITY");
        // lawyer (even owner) cannot promote
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isForbidden());
        // section head from another branch cannot promote either
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + otherHeadTok))
                .andExpect(status().isForbidden());
    }

    @Test
    void test10_promoteRejectedWhenStageIsAlreadyAppeal() throws Exception {
        long caseId = createCaseAndFinalize("AP-5-" + System.nanoTime(), "2026-04-25", "AGAINST_ENTITY");
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk());
        // Now current stage is APPEAL (and not finalized) — promote again must fail
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isBadRequest()); // STAGE_NOT_FINALIZED first
    }

    @Test
    void test11_promoteRejectedWhenCaseHasNoFinalizedStage() throws Exception {
        // create + assign but DO NOT finalize
        String body = ("{"
                + "\"publicEntityName\":\"وزارة العدل\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"خصم\","
                + "\"originalBasisNumber\":\"NF-" + System.nanoTime() + "\","
                + "\"basisYear\":2026,"
                + "\"originalRegistrationDate\":\"2026-01-15\","
                + "\"branchId\":" + branchId + ",\"departmentId\":" + deptId + ",\"courtId\":" + courtId + ","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"S-NF-" + System.nanoTime() + "\","
                + "\"stageYear\":2026,"
                + "\"firstHearingDate\":\"2026-02-01\","
                + "\"firstPostponementReason\":\"تبليغ الأطراف\""
                + "}");
        var resp = mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        long caseId = om.readTree(resp.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-appeal")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("STAGE_NOT_FINALIZED"));
    }
}

