package sy.gov.sla.identity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import sy.gov.sla.access.domain.DelegatedPermissionCode;
import sy.gov.sla.access.domain.MembershipType;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.access.domain.UserDelegatedPermission;
import sy.gov.sla.access.domain.UserDepartmentMembership;
import sy.gov.sla.access.infrastructure.UserDelegatedPermissionRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;
import sy.gov.sla.support.AbstractIntegrationTest;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Mini-Phase A — Assign Lawyer (D-046).
 *
 * Integration tests for {@code GET /api/v1/users} listing assignable lawyers.
 *
 * Reference:
 *   docs/project/BACKEND_GAP_PHASE11_ASSIGN_LAWYER.md
 *   docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-046)
 */
@AutoConfigureMockMvc
class AssignableLawyersApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired AuthService authService;
    @Autowired UserRepository userRepo;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserDelegatedPermissionRepository delegatedRepo;
    @Autowired DepartmentRepository deptRepo;

    static final long BRANCH_ID = 1L;        // DAMASCUS (V4 seed)
    static final long OTHER_BRANCH_ID = 2L;  // RURAL_DAMASCUS

    Long firstInstanceDeptId;
    Long appealDeptId;
    Long otherDeptId;

    Long sectionHeadId;
    Long clerkWithDelegId;
    Long clerkNoDelegId;
    Long branchHeadId;
    Long centralSupervisorId;
    Long stateLawyerCallerId;

    Long lawyerActive1Id;
    Long lawyerActive2Id;
    Long lawyerInactiveId;       // user.isActive=false
    Long lawyerOtherDeptId;      // active but in APPEAL dept of same branch

    String headTok, clerkOkTok, clerkNoDelegTok, branchHeadTok, centralTok, stateLawyerTok;

    @BeforeEach
    void seed() throws Exception {
        try {
            // ---- callers ----
            sectionHeadId = authService.createUser("a-head", "A Head", "0950000001",
                    "Password!1", null, null);
            authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);

            clerkWithDelegId = authService.createUser("a-clerk-ok", "A Clerk OK", "0950000002",
                    "Password!1", null, null);
            authService.assignRole(clerkWithDelegId, RoleType.ADMIN_CLERK);

            clerkNoDelegId = authService.createUser("a-clerk-no", "A Clerk NoDeleg", "0950000003",
                    "Password!1", null, null);
            authService.assignRole(clerkNoDelegId, RoleType.ADMIN_CLERK);

            branchHeadId = authService.createUser("a-branchhead", "A BranchHead", "0950000004",
                    "Password!1", null, null);
            authService.assignRole(branchHeadId, RoleType.BRANCH_HEAD);

            centralSupervisorId = authService.createUser("a-central", "A Central", "0950000005",
                    "Password!1", null, null);
            authService.assignRole(centralSupervisorId, RoleType.CENTRAL_SUPERVISOR);

            stateLawyerCallerId = authService.createUser("a-caller-lawyer", "A Lawyer Caller",
                    "0950000006", "Password!1", null, null);
            authService.assignRole(stateLawyerCallerId, RoleType.STATE_LAWYER);

            // ---- subjects (lawyers in scope) ----
            lawyerActive1Id = authService.createUser("a-l-active1", "أحمد", "0950000010",
                    "Password!1", null, null);
            authService.assignRole(lawyerActive1Id, RoleType.STATE_LAWYER);

            lawyerActive2Id = authService.createUser("a-l-active2", "زياد", "0950000011",
                    "Password!1", null, null);
            authService.assignRole(lawyerActive2Id, RoleType.STATE_LAWYER);

            lawyerInactiveId = authService.createUser("a-l-inactive", "حسن المعطّل", "0950000012",
                    "Password!1", null, null);
            authService.assignRole(lawyerInactiveId, RoleType.STATE_LAWYER);
            // mark user inactive
            User inactive = userRepo.findById(lawyerInactiveId).orElseThrow();
            inactive.setActive(false);
            userRepo.save(inactive);

            lawyerOtherDeptId = authService.createUser("a-l-otherdept", "Other Dept Lawyer",
                    "0950000013", "Password!1", null, null);
            authService.assignRole(lawyerOtherDeptId, RoleType.STATE_LAWYER);

            // ---- departments (V4/V5 seed) ----
            firstInstanceDeptId = deptRepo.findByBranchIdAndType(BRANCH_ID, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            appealDeptId = deptRepo.findByBranchIdAndType(BRANCH_ID, DepartmentType.APPEAL)
                    .orElseThrow().getId();
            otherDeptId = deptRepo.findByBranchIdAndType(OTHER_BRANCH_ID, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();

            // ---- memberships ----
            // Caller memberships in the target dept.
            membershipRepo.save(UserDepartmentMembership.builder().userId(sectionHeadId)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(clerkWithDelegId)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.ADMIN_CLERK).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(clerkNoDelegId)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.ADMIN_CLERK).primary(true).active(true).build());

            // BRANCH_HEAD callers don't get a section-head membership; only branch-level.
            membershipRepo.save(UserDepartmentMembership.builder().userId(branchHeadId)
                    .branchId(BRANCH_ID).departmentId(null)
                    .membershipType(MembershipType.BRANCH_HEAD).primary(true).active(true).build());

            // Caller-lawyer membership (irrelevant to the access check, just realistic).
            membershipRepo.save(UserDepartmentMembership.builder().userId(stateLawyerCallerId)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());

            // Subjects' memberships (active=true on the membership row in all cases;
            // the inactive subject is filtered out via user.is_active=false).
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerActive1Id)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerActive2Id)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerInactiveId)
                    .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());
            membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerOtherDeptId)
                    .branchId(BRANCH_ID).departmentId(appealDeptId)
                    .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());

            // Grant ASSIGN_LAWYER only to clerkWithDelegId.
            delegatedRepo.save(UserDelegatedPermission.builder()
                    .userId(clerkWithDelegId)
                    .permissionCode(DelegatedPermissionCode.ASSIGN_LAWYER)
                    .granted(true)
                    .grantedByUserId(sectionHeadId)
                    .grantedAt(Instant.now())
                    .build());
        } catch (Exception ignored) {
            // Re-using rows from a previous test in the same Spring context.
            firstInstanceDeptId = deptRepo.findByBranchIdAndType(BRANCH_ID, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();
            appealDeptId = deptRepo.findByBranchIdAndType(BRANCH_ID, DepartmentType.APPEAL)
                    .orElseThrow().getId();
            otherDeptId = deptRepo.findByBranchIdAndType(OTHER_BRANCH_ID, DepartmentType.FIRST_INSTANCE)
                    .orElseThrow().getId();

            sectionHeadId       = idOf("a-head");
            clerkWithDelegId    = idOf("a-clerk-ok");
            clerkNoDelegId      = idOf("a-clerk-no");
            branchHeadId        = idOf("a-branchhead");
            centralSupervisorId = idOf("a-central");
            stateLawyerCallerId = idOf("a-caller-lawyer");
            lawyerActive1Id     = idOf("a-l-active1");
            lawyerActive2Id     = idOf("a-l-active2");
            lawyerInactiveId    = idOf("a-l-inactive");
            lawyerOtherDeptId   = idOf("a-l-otherdept");
        }
        headTok        = login("a-head");
        clerkOkTok     = login("a-clerk-ok");
        clerkNoDelegTok= login("a-clerk-no");
        branchHeadTok  = login("a-branchhead");
        centralTok     = login("a-central");
        stateLawyerTok = login("a-caller-lawyer");
    }

    private String login(String u) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private Long idOf(String username) {
        return userRepo.findByUsername(username).orElseThrow().getId();
    }

    private String url(Long branchId, Long departmentId) {
        return "/api/v1/users?branchId=" + branchId + "&departmentId=" + departmentId
                + "&membershipType=STATE_LAWYER&activeOnly=true";
    }

    // ============================================================
    // 1) SECTION_HEAD of the dept succeeds and sees only matching lawyers
    // ============================================================
    @Test
    void sectionHead_inDept_succeeds_andListsActiveLawyersOnly() throws Exception {
        var resp = mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode arr = om.readTree(resp.getResponse().getContentAsString());
        assertThat(arr.isArray()).isTrue();

        boolean hasA1 = false, hasA2 = false, hasInactive = false, hasOther = false;
        for (JsonNode n : arr) {
            long id = n.get("id").asLong();
            if (id == lawyerActive1Id)  hasA1 = true;
            if (id == lawyerActive2Id)  hasA2 = true;
            if (id == lawyerInactiveId) hasInactive = true;
            if (id == lawyerOtherDeptId) hasOther = true;
            // Conservative response shape (no leakage).
            assertThat(n.has("mobileNumber")).isFalse();
            assertThat(n.has("delegatedPermissions")).isFalse();
            assertThat(n.has("memberships")).isFalse();
            assertThat(n.has("passwordHash")).isFalse();
            assertThat(n.has("fullName")).isTrue();
            assertThat(n.has("username")).isTrue();
            assertThat(n.has("active")).isTrue();
        }
        assertThat(hasA1).isTrue();
        assertThat(hasA2).isTrue();
        assertThat(hasInactive).as("activeOnly=true must exclude inactive users").isFalse();
        assertThat(hasOther).as("departmentId filter must exclude other-dept lawyers").isFalse();
    }

    // ============================================================
    // 2) ADMIN_CLERK with ASSIGN_LAWYER delegation succeeds
    // ============================================================
    @Test
    void adminClerk_withAssignLawyerDelegation_succeeds() throws Exception {
        mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + clerkOkTok))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").exists());
    }

    // ============================================================
    // 3) ADMIN_CLERK without delegation is rejected (403)
    // ============================================================
    @Test
    void adminClerk_withoutAssignLawyerDelegation_isForbidden() throws Exception {
        mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + clerkNoDelegTok))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 4) BRANCH_HEAD is rejected (403) — D-046 narrow scope
    // ============================================================
    @Test
    void branchHead_isForbidden() throws Exception {
        mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + branchHeadTok))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 5) CENTRAL_SUPERVISOR is rejected (403) — D-046 narrow scope:
    //    central does NOT operate the day-to-day assignment flow.
    // ============================================================
    @Test
    void centralSupervisor_isForbidden() throws Exception {
        mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + centralTok))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 6) activeOnly=true excludes the inactive user
    //    (also checked in test 1; this isolates the rule explicitly).
    // ============================================================
    @Test
    void activeOnly_excludesInactiveUsers() throws Exception {
        var resp = mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk())
                .andReturn();
        for (JsonNode n : om.readTree(resp.getResponse().getContentAsString())) {
            assertThat(n.get("active").asBoolean())
                    .as("activeOnly=true must only return active=true rows")
                    .isTrue();
            assertThat(n.get("id").asLong()).isNotEqualTo(lawyerInactiveId);
        }
    }

    // ============================================================
    // 7) departmentId filter is honored — APPEAL lawyer never appears
    //    when querying FIRST_INSTANCE
    // ============================================================
    @Test
    void departmentFilter_excludesOtherDepartments() throws Exception {
        var resp = mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode n : om.readTree(resp.getResponse().getContentAsString())) {
            assertThat(n.get("id").asLong()).isNotEqualTo(lawyerOtherDeptId);
        }
    }

    // ============================================================
    // 8) Only membershipType=STATE_LAWYER is supported in Mini-Phase A.
    //    Anything else → 400 INVALID/UNSUPPORTED.
    // ============================================================
    @Test
    void unsupportedMembershipType_isRejected_with400() throws Exception {
        mvc.perform(get("/api/v1/users?branchId=" + BRANCH_ID
                        + "&departmentId=" + firstInstanceDeptId
                        + "&membershipType=SECTION_HEAD&activeOnly=true")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEMBERSHIP_TYPE"));
    }

    // ============================================================
    // Bonus checks (kept tight to the documented contract)
    // ============================================================
    @Test
    void missingBranchId_isBadRequest() throws Exception {
        mvc.perform(get("/api/v1/users?departmentId=" + firstInstanceDeptId
                        + "&membershipType=STATE_LAWYER&activeOnly=true")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MISSING_PARAMETER"));
    }

    @Test
    void missingDepartmentId_isBadRequest() throws Exception {
        mvc.perform(get("/api/v1/users?branchId=" + BRANCH_ID
                        + "&membershipType=STATE_LAWYER&activeOnly=true")
                .header("Authorization", "Bearer " + headTok))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MISSING_PARAMETER"));
    }

    @Test
    void anonymous_isUnauthorized() throws Exception {
        mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void stateLawyerCaller_isForbidden() throws Exception {
        mvc.perform(get(url(BRANCH_ID, firstInstanceDeptId))
                .header("Authorization", "Bearer " + stateLawyerTok))
                .andExpect(status().isForbidden());
    }
}

