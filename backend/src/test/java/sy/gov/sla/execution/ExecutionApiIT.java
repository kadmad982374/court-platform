package sy.gov.sla.execution;

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

/**
 * Phase 5 — execution module integration tests.
 * يغطي السيناريوهات 1..12 من برومبت Phase 5.
 */
@AutoConfigureMockMvc
class ExecutionApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserCourtAccessRepository courtAccessRepo;
    @Autowired UserDelegatedPermissionRepository delegationRepo;
    @Autowired DepartmentRepository deptRepo;
    @Autowired CourtRepository courtRepo;
    @Autowired ObjectMapper om;

    Long sectionHeadId, lawyerId, otherBranchHeadId, clerkId;
    Long branchId = 1L;
    Long otherBranchId = 2L;
    Long deptId, courtId, otherDeptId;
    String headTok, lawTok, otherHeadTok, clerkTok;

    @BeforeEach
    void seed() throws Exception {
        try {
            sectionHeadId = authService.createUser("p5head", "P5 Head", "0966411111",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);
            lawyerId = authService.createUser("p5law", "P5 Lawyer", "0966422222",
                    "Password!1", null, null);
            authService.assignRole(lawyerId, RoleType.STATE_LAWYER);
            otherBranchHeadId = authService.createUser("p5head2", "Other Head", "0966433333",
                    "Password!1", null, null);
            authService.assignRole(otherBranchHeadId, RoleType.SECTION_HEAD);
            clerkId = authService.createUser("p5clerk", "P5 Clerk", "0966444444",
                    "Password!1", null, null);
            authService.assignRole(clerkId, RoleType.ADMIN_CLERK);

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
            membershipRepo.save(UserDepartmentMembership.builder().userId(clerkId)
                    .branchId(branchId).departmentId(deptId)
                    .membershipType(MembershipType.ADMIN_CLERK).primary(true).active(true).build());
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
        }
        headTok = login("p5head");
        lawTok = login("p5law");
        otherHeadTok = login("p5head2");
        clerkTok = login("p5clerk");
    }

    private String login(String u) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }

    /** ينشئ دعوى FIRST_INSTANCE، يُسند لها محاميًا، ويفصلها (FOR_ENTITY افتراضيًا). */
    private long createCaseAndFinalize(String basis) throws Exception {
        String body = ("{"
                + "\"publicEntityName\":\"وزارة المالية\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"شركة س\","
                + "\"originalBasisNumber\":\"" + basis + "\","
                + "\"basisYear\":2026,"
                + "\"originalRegistrationDate\":\"2026-01-15\","
                + "\"branchId\":" + branchId + ",\"departmentId\":" + deptId + ",\"courtId\":" + courtId + ","
                + "\"chamberName\":\"غ1\","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"S-" + basis + "\","
                + "\"stageYear\":2026,"
                + "\"firstHearingDate\":\"2026-02-01\","
                + "\"firstPostponementReason\":\"تعيين أول\""
                + "}");
        var resp = mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        long caseId = om.readTree(resp.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lawyerUserId\":" + lawyerId + "}"))
                .andExpect(status().isOk());

        var stages = mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                        .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        long stageId = om.readTree(stages.getResponse().getContentAsString()).get(0).get("id").asLong();

        String fin = "{\"decisionNumber\":\"D-" + basis + "\",\"decisionDate\":\"2026-04-12\",\"decisionType\":\"FOR_ENTITY\"}";
        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                        .header("Authorization", "Bearer " + lawTok)
                        .contentType(MediaType.APPLICATION_JSON).content(fin))
                .andExpect(status().isOk());
        return caseId;
    }

    private String promoteBody(String number) {
        return "{"
                + "\"enforcingEntityName\":\"وزارة المالية\","
                + "\"executedAgainstName\":\"شركة س\","
                + "\"executionFileType\":\"حكم نهائي\","
                + "\"executionFileNumber\":\"" + number + "\","
                + "\"executionYear\":2026"
                + "}";
    }

    // ===== 1) promote-to-execution success + lifecycle + ExecutionFile linkage =====
    @Test
    void test1_promoteToExecutionSuccess_linksCaseAndSourceStage_andSetsLifecycle() throws Exception {
        long caseId = createCaseAndFinalize("EX-1-" + System.nanoTime());

        long prevStageId = om.readTree(mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).get(0).get("id").asLong();

        var resp = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-1-" + System.nanoTime())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andReturn();
        JsonNode ef = om.readTree(resp.getResponse().getContentAsString());
        assertThat(ef.get("litigationCaseId").asLong()).isEqualTo(caseId);
        assertThat(ef.get("sourceStageId").asLong()).isEqualTo(prevStageId);
        assertThat(ef.get("branchId").asLong()).isEqualTo(branchId);
        assertThat(ef.has("departmentId")).isTrue();

        // 2) lifecycle
        var caseResp = mvc.perform(get("/api/v1/cases/" + caseId)
                .header("Authorization", "Bearer " + headTok)).andExpect(status().isOk()).andReturn();
        JsonNode c = om.readTree(caseResp.getResponse().getContentAsString());
        assertThat(c.get("lifecycleStatus").asText()).isEqualTo("IN_EXECUTION");
        // current_stage_id يبقى مشيرًا للمرحلة السابقة (D-034) — لا يتغيّر
        assertThat(c.get("currentStageId").asLong()).isEqualTo(prevStageId);
        assertThat(c.get("currentOwnerUserId").isNull()).isTrue();

        // المرحلة السابقة: read_only + PROMOTED_TO_EXECUTION
        var prev = mvc.perform(get("/api/v1/stages/" + prevStageId)
                .header("Authorization", "Bearer " + headTok)).andExpect(status().isOk()).andReturn();
        JsonNode prevJson = om.readTree(prev.getResponse().getContentAsString());
        assertThat(prevJson.get("readOnly").asBoolean()).isTrue();
        assertThat(prevJson.get("stageStatus").asText()).isEqualTo("PROMOTED_TO_EXECUTION");
    }

    // ===== 4 + 5) GET list/get respect scope =====
    @Test
    void test4and5_listAndGetRespectScope() throws Exception {
        long caseId = createCaseAndFinalize("EX-2-" + System.nanoTime());
        var resp = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-2-" + System.nanoTime())))
                .andExpect(status().isOk()).andReturn();
        long efId = om.readTree(resp.getResponse().getContentAsString()).get("id").asLong();

        // section head لنفس القسم يرى الملف في القائمة
        var list = mvc.perform(get("/api/v1/execution-files?year=2026")
                .header("Authorization", "Bearer " + headTok)).andExpect(status().isOk()).andReturn();
        boolean found = false;
        for (JsonNode n : om.readTree(list.getResponse().getContentAsString()))
            if (n.get("id").asLong() == efId) found = true;
        assertThat(found).isTrue();

        // GET single لنفس الـ section head: 200
        mvc.perform(get("/api/v1/execution-files/" + efId)
                .header("Authorization", "Bearer " + headTok)).andExpect(status().isOk());

        // section head في فرع آخر لا يرى الملف في القائمة
        var otherList = mvc.perform(get("/api/v1/execution-files?year=2026")
                .header("Authorization", "Bearer " + otherHeadTok)).andExpect(status().isOk()).andReturn();
        for (JsonNode n : om.readTree(otherList.getResponse().getContentAsString()))
            assertThat(n.get("id").asLong()).isNotEqualTo(efId);

        // GET single من فرع آخر: 403
        mvc.perform(get("/api/v1/execution-files/" + efId)
                .header("Authorization", "Bearer " + otherHeadTok)).andExpect(status().isForbidden());
    }

    // ===== 6 + 7) addStep success + ordering =====
    @Test
    void test6and7_addStepAndListOrdered() throws Exception {
        long caseId = createCaseAndFinalize("EX-3-" + System.nanoTime());
        var p = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-3-" + System.nanoTime())))
                .andExpect(status().isOk()).andReturn();
        long efId = om.readTree(p.getResponse().getContentAsString()).get("id").asLong();

        // إضافة ثلاث خطوات بترتيب غير زمني
        addStep(efId, headTok, "2026-05-10", "NOTICE_REQUEST", "طلب تبليغ");
        addStep(efId, headTok, "2026-05-05", "NOTICE_ISSUED",  "تم التبليغ");
        addStep(efId, headTok, "2026-05-15", "SEIZURE_REQUEST", "طلب حجز");

        var arr = om.readTree(mvc.perform(get("/api/v1/execution-files/" + efId + "/steps")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(arr.size()).isEqualTo(3);
        // مرتَّبة تصاعديًا حسب step_date
        assertThat(arr.get(0).get("stepDate").asText()).isEqualTo("2026-05-05");
        assertThat(arr.get(1).get("stepDate").asText()).isEqualTo("2026-05-10");
        assertThat(arr.get(2).get("stepDate").asText()).isEqualTo("2026-05-15");
    }

    private void addStep(long efId, String tok, String date, String type, String desc) throws Exception {
        String body = "{\"stepDate\":\"" + date + "\",\"stepType\":\"" + type
                + "\",\"stepDescription\":\"" + desc + "\"}";
        mvc.perform(post("/api/v1/execution-files/" + efId + "/steps")
                .header("Authorization", "Bearer " + tok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
    }

    // ===== 8) append-only: no PUT/DELETE endpoints exist =====
    @Test
    void test8_noUpdateOrDeleteOnSteps() throws Exception {
        long caseId = createCaseAndFinalize("EX-4-" + System.nanoTime());
        var p = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-4-" + System.nanoTime())))
                .andExpect(status().isOk()).andReturn();
        long efId = om.readTree(p.getResponse().getContentAsString()).get("id").asLong();
        addStep(efId, headTok, "2026-05-10", "ADMIN_ACTION", "إجراء");

        // PUT/DELETE على /steps/{...} يجب أن يُرفض (405 Method Not Allowed أو 404).
        var put = mvc.perform(put("/api/v1/execution-files/" + efId + "/steps/1")
                .header("Authorization", "Bearer " + headTok)).andReturn();
        int putStatus = put.getResponse().getStatus();
        assertThat(putStatus).isIn(404, 405);

        var del = mvc.perform(delete("/api/v1/execution-files/" + efId + "/steps/1")
                .header("Authorization", "Bearer " + headTok)).andReturn();
        int delStatus = del.getResponse().getStatus();
        assertThat(delStatus).isIn(404, 405);
    }

    // ===== 9) promote rejected from unauthorized roles =====
    @Test
    void test9_promoteRejectedFromUnauthorizedRoles() throws Exception {
        long caseId = createCaseAndFinalize("EX-5-" + System.nanoTime());
        // المحامي (حتى لو مالك) لا يستطيع
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-5-" + System.nanoTime())))
                .andExpect(status().isForbidden());
        // section head من فرع آخر لا يستطيع
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                .header("Authorization", "Bearer " + otherHeadTok)
                .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-5b-" + System.nanoTime())))
                .andExpect(status().isForbidden());
        // ADMIN_CLERK بدون التفويض PROMOTE_TO_EXECUTION لا يستطيع
        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                .header("Authorization", "Bearer " + clerkTok)
                .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-5c-" + System.nanoTime())))
                .andExpect(status().isForbidden());
    }

    // ===== 10) addStep rejected from unauthorized roles =====
    @Test
    void test10_addStepRejectedFromUnauthorizedRoles() throws Exception {
        long caseId = createCaseAndFinalize("EX-6-" + System.nanoTime());
        var p = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-6-" + System.nanoTime())))
                .andExpect(status().isOk()).andReturn();
        long efId = om.readTree(p.getResponse().getContentAsString()).get("id").asLong();

        // section head من فرع آخر مرفوض
        String body = "{\"stepDate\":\"2026-05-10\",\"stepType\":\"ADMIN_ACTION\",\"stepDescription\":\"x\"}";
        mvc.perform(post("/api/v1/execution-files/" + efId + "/steps")
                .header("Authorization", "Bearer " + otherHeadTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());

        // ADMIN_CLERK بدون التفويض ADD_EXECUTION_STEP مرفوض
        mvc.perform(post("/api/v1/execution-files/" + efId + "/steps")
                .header("Authorization", "Bearer " + clerkTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    // ===== 11 + 12) hearing history preserved + no new HearingProgressionEntry =====
    @Test
    void test11and12_hearingHistoryPreservedAndExecutionDoesNotTouchIt() throws Exception {
        long caseId = createCaseAndFinalize("EX-7-" + System.nanoTime());
        long prevStageId = om.readTree(mvc.perform(get("/api/v1/cases/" + caseId + "/stages")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).get(0).get("id").asLong();

        int beforeSize = om.readTree(mvc.perform(get("/api/v1/stages/" + prevStageId + "/hearing-history")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).size();

        // promote-to-execution + add multiple steps
        var p = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-7-" + System.nanoTime())))
                .andExpect(status().isOk()).andReturn();
        long efId = om.readTree(p.getResponse().getContentAsString()).get("id").asLong();
        addStep(efId, headTok, "2026-05-10", "ADMIN_ACTION", "إجراء 1");
        addStep(efId, headTok, "2026-05-11", "ADMIN_ACTION", "إجراء 2");

        int afterSize = om.readTree(mvc.perform(get("/api/v1/stages/" + prevStageId + "/hearing-history")
                .header("Authorization", "Bearer " + headTok)).andReturn()
                .getResponse().getContentAsString()).size();
        assertThat(afterSize).isEqualTo(beforeSize);
    }

    // ===== Bonus: invalid lifecycle =====
    @Test
    void test_promoteRejectedWhenStageNotFinalized() throws Exception {
        // إنشاء دعوى بدون فصل
        String body = ("{"
                + "\"publicEntityName\":\"وزارة\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"خصم\","
                + "\"originalBasisNumber\":\"NF-EX-" + System.nanoTime() + "\","
                + "\"basisYear\":2026,\"originalRegistrationDate\":\"2026-01-15\","
                + "\"branchId\":" + branchId + ",\"departmentId\":" + deptId + ",\"courtId\":" + courtId + ","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"S-NF-EX-" + System.nanoTime() + "\","
                + "\"stageYear\":2026,\"firstHearingDate\":\"2026-02-01\","
                + "\"firstPostponementReason\":\"تعيين أول\""
                + "}");
        var r = mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        long caseId = om.readTree(r.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON).content(promoteBody("E-NF-" + System.nanoTime())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("STAGE_NOT_FINALIZED"));
    }

    // ===== Bonus: anonymous rejected =====
    @Test
    void test_anonymousRejected() throws Exception {
        mvc.perform(get("/api/v1/execution-files")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/execution-files/1")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/cases/1/promote-to-execution")
                .contentType(MediaType.APPLICATION_JSON).content(promoteBody("X")))
                .andExpect(status().isUnauthorized());
    }
}

