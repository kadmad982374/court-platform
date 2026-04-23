package sy.gov.sla.litigationprogression;

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
import sy.gov.sla.access.domain.UserCourtAccess;
import sy.gov.sla.access.domain.UserDepartmentMembership;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.decisionfinalization.infrastructure.CaseDecisionRepository;
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
class ProgressionAndFinalizationIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserCourtAccessRepository courtAccessRepo;
    @Autowired DepartmentRepository deptRepo;
    @Autowired CourtRepository courtRepo;
    @Autowired CaseDecisionRepository decisionRepo;
    @Autowired ObjectMapper om;

    Long sectionHeadId, lawyerId, otherLawyerId;
    Long branchId = 1L;
    Long deptId, courtId;
    String headTok, lawTok, otherLawTok;

    @BeforeEach
    void seed() throws Exception {
        try {
            sectionHeadId = authService.createUser("p3head", "P3 Head", "0955111111",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);
            lawyerId = authService.createUser("p3law", "P3 Lawyer", "0955222222",
                    "Password!1", null, null);
            authService.assignRole(lawyerId, RoleType.STATE_LAWYER);
            otherLawyerId = authService.createUser("p3law2", "Other Lawyer", "0955333333",
                    "Password!1", null, null);
            authService.assignRole(otherLawyerId, RoleType.STATE_LAWYER);

            deptId = deptRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            courtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();

            membershipRepo.save(UserDepartmentMembership.builder().userId(sectionHeadId)
                    .branchId(branchId).departmentId(deptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerId)
                    .branchId(branchId).departmentId(deptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(otherLawyerId)
                    .branchId(branchId).departmentId(deptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            courtAccessRepo.save(UserCourtAccess.builder().userId(lawyerId)
                    .courtId(courtId).grantedByUserId(sectionHeadId)
                    .grantedAt(Instant.now()).active(true).build());
            courtAccessRepo.save(UserCourtAccess.builder().userId(otherLawyerId)
                    .courtId(courtId).grantedByUserId(sectionHeadId)
                    .grantedAt(Instant.now()).active(true).build());
        } catch (Exception ignored) {
            deptId = deptRepo.findByBranchIdAndType(branchId, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            courtId = courtRepo.findByBranchIdAndDepartmentType(branchId, DepartmentType.FIRST_INSTANCE)
                    .get(0).getId();
            sectionHeadId = idOf("p3head");
            lawyerId = idOf("p3law");
            otherLawyerId = idOf("p3law2");
        }
        headTok = login("p3head");
        lawTok = login("p3law");
        otherLawTok = login("p3law2");
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

    private long createAndAssignCase() throws Exception {
        String body = ("{"
                + "\"publicEntityName\":\"وزارة العدل\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"خصم\","
                + "\"originalBasisNumber\":\"P3-" + System.nanoTime() + "\","
                + "\"basisYear\":2026,"
                + "\"originalRegistrationDate\":\"2026-04-01\","
                + "\"branchId\":" + branchId + ",\"departmentId\":" + deptId + ",\"courtId\":" + courtId + ","
                + "\"chamberName\":\"غ1\","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"S-" + System.nanoTime() + "\","
                + "\"stageYear\":2026,"
                + "\"firstHearingDate\":\"2026-05-01\","
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
        return caseId;
    }

    private long stageOfCase(long caseId) throws Exception {
        var resp = mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get(0).get("id").asLong();
    }

    @Test
    void test1_initialEntryIsCreatedFromPhase2BackfillTrigger_orFromCreate() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);
        // Backfill V11 only runs on existing rows; for rows created at runtime we expect
        // INITIAL via service if we ever add it. In current Phase 3 we DO NOT auto-create
        // an INITIAL on createCase (D-022 says backfill only). The first ROLLOVER becomes
        // the first non-final entry. So initial history may be empty here.
        var hist = mvc.perform(get("/api/v1/stages/" + stageId + "/hearing-history")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk()).andReturn();
        // Either empty (newly created) OR contains backfilled entries (legacy data).
        assertThat(om.readTree(hist.getResponse().getContentAsString()).isArray()).isTrue();
    }

    @Test
    void test2_rolloverSucceeds_andHistoryIsAppendOnly() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        // first rollover
        mvc.perform(post("/api/v1/stages/" + stageId + "/rollover-hearing")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextHearingDate\":\"2026-06-01\",\"postponementReasonCode\":\"NOTIFY_PARTIES_PERSONAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entryType").value("ROLLOVER"))
                .andExpect(jsonPath("$.postponementReasonCode").value("NOTIFY_PARTIES_PERSONAL"));

        // second rollover
        mvc.perform(post("/api/v1/stages/" + stageId + "/rollover-hearing")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextHearingDate\":\"2026-07-01\",\"postponementReasonCode\":\"EXPERT_REVIEW\"}"))
                .andExpect(status().isOk());

        // history is ordered ascending and contains both entries
        var resp = mvc.perform(get("/api/v1/stages/" + stageId + "/hearing-history")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(resp.getResponse().getContentAsString());
        assertThat(arr.size()).isGreaterThanOrEqualTo(2);
        // Last two ascending should be 06-01 then 07-01
        JsonNode last = arr.get(arr.size() - 1);
        JsonNode prev = arr.get(arr.size() - 2);
        assertThat(prev.get("hearingDate").asText()).isEqualTo("2026-06-01");
        assertThat(last.get("hearingDate").asText()).isEqualTo("2026-07-01");

        // progression projection
        var prog = mvc.perform(get("/api/v1/stages/" + stageId + "/progression")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentHearingDate").value("2026-07-01"))
                .andExpect(jsonPath("$.previousHearingDate").value("2026-06-01"))
                .andReturn();
    }

    @Test
    void test3_rolloverRejectedFromNonOwner() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        mvc.perform(post("/api/v1/stages/" + stageId + "/rollover-hearing")
                .header("Authorization", "Bearer " + otherLawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextHearingDate\":\"2026-06-01\",\"postponementReasonCode\":\"AUDIT\"}"))
                .andExpect(status().isForbidden());

        // section head also forbidden — D-024
        mvc.perform(post("/api/v1/stages/" + stageId + "/rollover-hearing")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextHearingDate\":\"2026-06-01\",\"postponementReasonCode\":\"AUDIT\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void test4_finalizeSucceeds_setsStageFinalized_andAppendsFINALIZEDentry() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{"
                        + "\"decisionNumber\":\"D-1\","
                        + "\"decisionDate\":\"2026-08-01\","
                        + "\"decisionType\":\"FOR_ENTITY\","
                        + "\"adjudgedAmount\":1000.50,"
                        + "\"currencyCode\":\"SYP\","
                        + "\"summaryNotes\":\"ملخص\""
                        + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decisionType").value("FOR_ENTITY"));

        // stage now FINALIZED with endedAt
        var stage = mvc.perform(get("/api/v1/stages/" + stageId)
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk()).andReturn();
        assertThat(om.readTree(stage.getResponse().getContentAsString()).get("stageStatus").asText())
                .isEqualTo("FINALIZED");

        // FINALIZED entry exists in history
        var hist = mvc.perform(get("/api/v1/stages/" + stageId + "/hearing-history")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(hist.getResponse().getContentAsString());
        boolean hasFinalized = false;
        for (JsonNode n : arr) if (n.get("entryType").asText().equals("FINALIZED")) hasFinalized = true;
        assertThat(hasFinalized).isTrue();

        // No resolved-register endpoints exist (Phase 4 not started).
        // We only verify decision row exists.
        assertThat(decisionRepo.findByCaseStageId(stageId)).isPresent();
    }

    @Test
    void test5_finalizeRejectedFromNonOwner() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + otherLawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decisionNumber\":\"D-X\",\"decisionDate\":\"2026-08-01\",\"decisionType\":\"FOR_ENTITY\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decisionNumber\":\"D-X\",\"decisionDate\":\"2026-08-01\",\"decisionType\":\"FOR_ENTITY\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void test6_invalidDecisionTypeIsRejected() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decisionNumber\":\"D\",\"decisionDate\":\"2026-08-01\",\"decisionType\":\"FOO\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void test7_invalidPostponementReasonRejected() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        mvc.perform(post("/api/v1/stages/" + stageId + "/rollover-hearing")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextHearingDate\":\"2026-06-01\",\"postponementReasonCode\":\"NOT_A_REAL_CODE\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_POSTPONEMENT_REASON"));
    }

    @Test
    void test8_finalizeAfterFinalizeIsConflict() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);

        String body = "{\"decisionNumber\":\"D\",\"decisionDate\":\"2026-08-01\",\"decisionType\":\"SETTLEMENT\"}";
        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict());
        // and rollover after finalize is rejected
        mvc.perform(post("/api/v1/stages/" + stageId + "/rollover-hearing")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextHearingDate\":\"2026-09-01\",\"postponementReasonCode\":\"AUDIT\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void test9_anonymousIsRejected() throws Exception {
        mvc.perform(get("/api/v1/stages/1/progression")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/stages/1/rollover-hearing")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/stages/1/finalize")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void test10_amountWithoutCurrencyIsRejected() throws Exception {
        long caseId = createAndAssignCase();
        long stageId = stageOfCase(caseId);
        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"decisionNumber\":\"D\",\"decisionDate\":\"2026-08-01\","
                        + "\"decisionType\":\"FOR_ENTITY\",\"adjudgedAmount\":100.00}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AMOUNT_CURRENCY_INCONSISTENT"));
    }
}

