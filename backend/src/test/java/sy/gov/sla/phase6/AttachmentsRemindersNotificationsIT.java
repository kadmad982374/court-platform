package sy.gov.sla.phase6;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sy.gov.sla.access.domain.*;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
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
 * Phase 6 — يغطي السيناريوهات 1..17 من برومبت Phase 6:
 *   Attachments (1..7), Reminders (8..12), Notifications (13..17).
 */
@AutoConfigureMockMvc
class AttachmentsRemindersNotificationsIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired AuthService authService;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserCourtAccessRepository courtAccessRepo;
    @Autowired DepartmentRepository deptRepo;
    @Autowired CourtRepository courtRepo;
    @Autowired ObjectMapper om;

    Long sectionHeadId, lawyerId, otherBranchHeadId;
    Long branchId = 1L;
    Long otherBranchId = 2L;
    Long deptId, courtId, otherDeptId;
    String headTok, lawTok, otherHeadTok;

    @BeforeEach
    void seed() throws Exception {
        try {
            sectionHeadId = authService.createUser("p6head", "P6 Head", "0966611111",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);
            lawyerId = authService.createUser("p6law", "P6 Lawyer", "0966622222",
                    "Password!1", null, null);
            authService.assignRole(lawyerId, RoleType.STATE_LAWYER);
            otherBranchHeadId = authService.createUser("p6head2", "Other Head", "0966633333",
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
        }
        headTok = login("p6head");
        lawTok  = login("p6law");
        otherHeadTok = login("p6head2");
    }

    private String login(String u) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }

    /** ينشئ دعوى ويُعيد caseId + stageId. (إسناد المحامي اختياري بحسب assign) */
    private long[] createCase(String basis, boolean assign) throws Exception {
        String body = ("{"
                + "\"publicEntityName\":\"وزارة\","
                + "\"publicEntityPosition\":\"PLAINTIFF\","
                + "\"opponentName\":\"خصم\","
                + "\"originalBasisNumber\":\"" + basis + "\","
                + "\"basisYear\":2026,"
                + "\"originalRegistrationDate\":\"2026-02-01\","
                + "\"branchId\":" + branchId + ",\"departmentId\":" + deptId + ",\"courtId\":" + courtId + ","
                + "\"stageType\":\"FIRST_INSTANCE\","
                + "\"stageBasisNumber\":\"S-" + basis + "\","
                + "\"stageYear\":2026,"
                + "\"firstHearingDate\":\"2026-03-01\","
                + "\"firstPostponementReason\":\"تعيين أول\""
                + "}");
        var r = mvc.perform(post("/api/v1/cases").header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn();
        long caseId = om.readTree(r.getResponse().getContentAsString()).get("id").asLong();
        long stageId = om.readTree(r.getResponse().getContentAsString())
                .get("stages").get(0).get("id").asLong();
        if (assign) {
            mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                    .header("Authorization", "Bearer " + headTok)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"lawyerUserId\":" + lawyerId + "}"))
                    .andExpect(status().isOk());
        }
        return new long[]{caseId, stageId};
    }

    private long createPromoteToExecution(String basis) throws Exception {
        long[] cs = createCase(basis, true);
        long caseId = cs[0];
        long stageId = cs[1];
        // فصل
        String fin = "{\"decisionNumber\":\"D-" + basis + "\",\"decisionDate\":\"2026-04-12\",\"decisionType\":\"FOR_ENTITY\"}";
        mvc.perform(post("/api/v1/stages/" + stageId + "/finalize")
                        .header("Authorization", "Bearer " + lawTok)
                        .contentType(MediaType.APPLICATION_JSON).content(fin))
                .andExpect(status().isOk());
        // ترقية
        String pb = "{\"enforcingEntityName\":\"وزارة\",\"executedAgainstName\":\"خصم\","
                + "\"executionFileType\":\"حكم\",\"executionFileNumber\":\"E-" + basis + "\",\"executionYear\":2026}";
        var r = mvc.perform(post("/api/v1/cases/" + caseId + "/promote-to-execution")
                        .header("Authorization", "Bearer " + headTok)
                        .contentType(MediaType.APPLICATION_JSON).content(pb))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(r.getResponse().getContentAsString()).get("id").asLong();
    }

    // =================== Attachments ===================

    @Test
    void test1and2_uploadAndListStageAttachment() throws Exception {
        long stageId = createCase("AT-1-" + System.nanoTime(), false)[1];
        MockMultipartFile file = new MockMultipartFile("file", "report.pdf",
                "application/pdf", "PDF-CONTENT".getBytes());

        var up = mvc.perform(multipart("/api/v1/stages/" + stageId + "/attachments")
                .file(file).header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode att = om.readTree(up.getResponse().getContentAsString());
        assertThat(att.get("originalFilename").asText()).isEqualTo("report.pdf");
        assertThat(att.get("attachmentScopeType").asText()).isEqualTo("CASE_STAGE");

        var list = mvc.perform(get("/api/v1/stages/" + stageId + "/attachments")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = om.readTree(list.getResponse().getContentAsString());
        assertThat(arr.size()).isEqualTo(1);
        assertThat(arr.get(0).get("id").asLong()).isEqualTo(att.get("id").asLong());
    }

    @Test
    void test3_uploadAndListRejectedOutOfScope() throws Exception {
        long stageId = createCase("AT-2-" + System.nanoTime(), false)[1];
        MockMultipartFile file = new MockMultipartFile("file", "x.txt",
                "text/plain", "X".getBytes());

        // section head من فرع آخر يُرفض على الرفع
        mvc.perform(multipart("/api/v1/stages/" + stageId + "/attachments")
                .file(file).header("Authorization", "Bearer " + otherHeadTok))
                .andExpect(status().isForbidden());

        // قراءة من فرع آخر مرفوضة
        mvc.perform(get("/api/v1/stages/" + stageId + "/attachments")
                .header("Authorization", "Bearer " + otherHeadTok))
                .andExpect(status().isForbidden());
    }

    @Test
    void test4and5_uploadAndListExecutionFileAttachment() throws Exception {
        long efId = createPromoteToExecution("AT-3-" + System.nanoTime());
        MockMultipartFile file = new MockMultipartFile("file", "ef.pdf",
                "application/pdf", new byte[]{1, 2, 3});

        var up = mvc.perform(multipart("/api/v1/execution-files/" + efId + "/attachments")
                .file(file).header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        long attId = om.readTree(up.getResponse().getContentAsString()).get("id").asLong();
        assertThat(attId).isPositive();

        var list = mvc.perform(get("/api/v1/execution-files/" + efId + "/attachments")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        assertThat(om.readTree(list.getResponse().getContentAsString()).size()).isEqualTo(1);
    }

    @Test
    void test6and7_downloadAttachmentInScopeAndRejectedOutOfScope() throws Exception {
        long stageId = createCase("AT-4-" + System.nanoTime(), false)[1];
        byte[] payload = "DOWNLOAD-ME".getBytes();
        MockMultipartFile file = new MockMultipartFile("file", "d.bin",
                "application/octet-stream", payload);
        var up = mvc.perform(multipart("/api/v1/stages/" + stageId + "/attachments")
                .file(file).header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        long attId = om.readTree(up.getResponse().getContentAsString()).get("id").asLong();

        // داخل النطاق: 200 + bytes صحيحة
        MvcResult dl = mvc.perform(get("/api/v1/attachments/" + attId + "/download")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("d.bin")))
                .andReturn();
        assertThat(dl.getResponse().getContentAsByteArray()).isEqualTo(payload);

        // خارج النطاق: 403
        mvc.perform(get("/api/v1/attachments/" + attId + "/download")
                .header("Authorization", "Bearer " + otherHeadTok))
                .andExpect(status().isForbidden());
    }

    // =================== Reminders ===================

    @Test
    void test8_createReminderSuccess() throws Exception {
        long caseId = createCase("RM-1-" + System.nanoTime(), true)[0];
        String body = "{\"reminderAt\":\"2026-05-01T10:00:00Z\",\"reminderText\":\"اتصل بالخصم\"}";
        var r = mvc.perform(post("/api/v1/cases/" + caseId + "/reminders")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn();
        JsonNode dto = om.readTree(r.getResponse().getContentAsString());
        assertThat(dto.get("status").asText()).isEqualTo("PENDING");
        assertThat(dto.get("ownerUserId").asLong()).isEqualTo(lawyerId);
    }

    @Test
    void test9_listReminders() throws Exception {
        long caseId = createCase("RM-2-" + System.nanoTime(), true)[0];
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/v1/cases/" + caseId + "/reminders")
                    .header("Authorization", "Bearer " + lawTok)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"reminderAt\":\"2026-05-0" + (i + 1) + "T10:00:00Z\",\"reminderText\":\"r" + i + "\"}"))
                    .andExpect(status().isOk());
        }
        var list = mvc.perform(get("/api/v1/cases/" + caseId + "/reminders")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk()).andReturn();
        assertThat(om.readTree(list.getResponse().getContentAsString()).size()).isEqualTo(3);
    }

    @Test
    void test10_createReminderRejectedOutOfScope() throws Exception {
        long caseId = createCase("RM-3-" + System.nanoTime(), true)[0];
        String body = "{\"reminderAt\":\"2026-05-01T10:00:00Z\",\"reminderText\":\"x\"}";
        mvc.perform(post("/api/v1/cases/" + caseId + "/reminders")
                .header("Authorization", "Bearer " + otherHeadTok)
                .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/cases/" + caseId + "/reminders")
                .header("Authorization", "Bearer " + otherHeadTok))
                .andExpect(status().isForbidden());
    }

    @Test
    void test11_updateReminderStatusByOwner() throws Exception {
        long caseId = createCase("RM-4-" + System.nanoTime(), true)[0];
        var r = mvc.perform(post("/api/v1/cases/" + caseId + "/reminders")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reminderAt\":\"2026-05-01T10:00:00Z\",\"reminderText\":\"اتصال\"}"))
                .andExpect(status().isOk()).andReturn();
        long rid = om.readTree(r.getResponse().getContentAsString()).get("id").asLong();

        mvc.perform(patch("/api/v1/reminders/" + rid + "/status")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DONE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    @Test
    void test12_updateReminderStatusRejectedForNonOwner() throws Exception {
        long caseId = createCase("RM-5-" + System.nanoTime(), true)[0];
        var r = mvc.perform(post("/api/v1/cases/" + caseId + "/reminders")
                .header("Authorization", "Bearer " + lawTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reminderAt\":\"2026-05-01T10:00:00Z\",\"reminderText\":\"x\"}"))
                .andExpect(status().isOk()).andReturn();
        long rid = om.readTree(r.getResponse().getContentAsString()).get("id").asLong();

        // section head لا يملك التذكير حتى لو ضمن نطاق الدعوى → 403
        mvc.perform(patch("/api/v1/reminders/" + rid + "/status")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DONE\"}"))
                .andExpect(status().isForbidden());

        // section head من فرع آخر → 403
        mvc.perform(patch("/api/v1/reminders/" + rid + "/status")
                .header("Authorization", "Bearer " + otherHeadTok)
                .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"DONE\"}"))
                .andExpect(status().isForbidden());
    }

    // =================== Notifications ===================

    @Test
    void test13_caseRegisteredGeneratesNotificationForSectionHead() throws Exception {
        // اقرأ قائمة قبلية لرئيس القسم
        int before = listMyNotifications(headTok).size();
        createCase("NT-1-" + System.nanoTime(), false);
        // بعد commit الدعوى يُنشأ إشعار CASE_REGISTERED للـ section head
        var arr = listMyNotifications(headTok);
        assertThat(arr.size()).isGreaterThan(before);
        boolean found = false;
        for (JsonNode n : arr) {
            if ("CASE_REGISTERED".equals(n.get("notificationType").asText())) found = true;
        }
        assertThat(found).isTrue();
    }

    @Test
    void test14_lawyerAssignedGeneratesNotificationForLawyer() throws Exception {
        int before = listMyNotifications(lawTok).size();
        long caseId = createCase("NT-2-" + System.nanoTime(), false)[0];
        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"lawyerUserId\":" + lawyerId + "}"))
                .andExpect(status().isOk());

        var arr = listMyNotifications(lawTok);
        assertThat(arr.size()).isGreaterThan(before);
        boolean found = false;
        for (JsonNode n : arr) {
            if ("LAWYER_ASSIGNED".equals(n.get("notificationType").asText())
                    && n.get("relatedEntityId").asLong() == caseId) found = true;
        }
        assertThat(found).isTrue();
    }

    @Test
    void test15_listNotificationsReturnsOnlyMine() throws Exception {
        // جلسة جديدة + إسناد المحامي ⇒ يولّد LAWYER_ASSIGNED للمحامي فقط
        long caseId = createCase("NT-3-" + System.nanoTime(), true)[0];

        // إشعارات الـ section head لا يجب أن تتضمن LAWYER_ASSIGNED للحالة هذه
        var headArr = listMyNotifications(headTok);
        for (JsonNode n : headArr) {
            if ("LAWYER_ASSIGNED".equals(n.get("notificationType").asText())) {
                assertThat(n.get("recipientUserId").asLong()).isEqualTo(sectionHeadId);
                assertThat(n.get("relatedEntityId").asLong()).isNotEqualTo(caseId);
            }
            assertThat(n.get("recipientUserId").asLong()).isEqualTo(sectionHeadId);
        }

        // المحامي يرى فقط إشعاراته
        var lawArr = listMyNotifications(lawTok);
        for (JsonNode n : lawArr) {
            assertThat(n.get("recipientUserId").asLong()).isEqualTo(lawyerId);
        }
    }

    @Test
    void test16and17_markReadOwnVsForeign() throws Exception {
        long caseId = createCase("NT-4-" + System.nanoTime(), false)[0];
        mvc.perform(post("/api/v1/cases/" + caseId + "/assign-lawyer")
                .header("Authorization", "Bearer " + headTok)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"lawyerUserId\":" + lawyerId + "}"))
                .andExpect(status().isOk());

        // إشعار المحامي
        var lawArr = listMyNotifications(lawTok);
        long lawyerNotifId = -1;
        for (JsonNode n : lawArr) {
            if ("LAWYER_ASSIGNED".equals(n.get("notificationType").asText())
                    && n.get("relatedEntityId").asLong() == caseId) {
                lawyerNotifId = n.get("id").asLong();
                break;
            }
        }
        assertThat(lawyerNotifId).isPositive();

        // 16) المحامي يستطيع تعليمه مقروءًا
        mvc.perform(patch("/api/v1/notifications/" + lawyerNotifId + "/read")
                .header("Authorization", "Bearer " + lawTok))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));

        // 17) section head لا يستطيع تعليم إشعار مستخدم آخر
        mvc.perform(patch("/api/v1/notifications/" + lawyerNotifId + "/read")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isForbidden());
    }

    private com.fasterxml.jackson.databind.JsonNode listMyNotifications(String tok) throws Exception {
        var r = mvc.perform(get("/api/v1/notifications").header("Authorization", "Bearer " + tok))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(r.getResponse().getContentAsString());
    }
}

