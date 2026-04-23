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
import sy.gov.sla.access.infrastructure.UserRoleRepository;
import sy.gov.sla.identity.application.AuthService;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.domain.Court;
import sy.gov.sla.organization.domain.DepartmentType;
import sy.gov.sla.organization.infrastructure.CourtRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;
import sy.gov.sla.support.AbstractIntegrationTest;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Mini-Phase B — Backend integration tests for User / Role / Membership /
 * Delegation / Court-Access administration (D-047 / D-048).
 *
 * Reference:
 *   docs/project/BACKEND_GAP_PHASE11_USER_ADMIN.md
 *   docs/project/PROJECT_ASSUMPTIONS_AND_DECISIONS.md (D-047, D-048)
 */
@AutoConfigureMockMvc
class UserAdminApiIT extends AbstractIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired AuthService authService;
    @Autowired UserRepository userRepo;
    @Autowired UserRoleRepository userRoleRepo;
    @Autowired UserDepartmentMembershipRepository membershipRepo;
    @Autowired UserDelegatedPermissionRepository delegatedRepo;
    @Autowired DepartmentRepository deptRepo;
    @Autowired CourtRepository courtRepo;

    static final long BRANCH_ID = 1L;        // DAMASCUS (V4 seed)
    static final long OTHER_BRANCH_ID = 2L;  // RURAL_DAMASCUS

    Long firstInstanceDeptId;
    Long otherBranchDeptId;

    Long centralId;
    Long branchHeadId;
    Long branchHeadOtherId;
    Long sectionHeadId;
    Long clerkId;          // active ADMIN_CLERK in section head's dept
    Long lawyerId;         // STATE_LAWYER target
    String centralTok, branchHeadTok, branchHeadOtherTok, sectionHeadTok, clerkTok, lawyerTok;

    /** Unique slug per test invocation → avoids cross-context conflicts. */
    String slug;

    @BeforeEach
    void seed() throws Exception {
        slug = "b-" + Long.toHexString(System.nanoTime() & 0xFFFFFFL);

        firstInstanceDeptId = deptRepo.findByBranchIdAndType(BRANCH_ID, DepartmentType.FIRST_INSTANCE)
                .orElseThrow().getId();
        otherBranchDeptId = deptRepo.findByBranchIdAndType(OTHER_BRANCH_ID, DepartmentType.FIRST_INSTANCE)
                .orElseThrow().getId();

        centralId      = createUser(slug + "-central", "Central B", "Password!1");
        authService.assignRole(centralId, RoleType.CENTRAL_SUPERVISOR);

        branchHeadId   = createUser(slug + "-bhead", "BHead B", "Password!1");
        authService.assignRole(branchHeadId, RoleType.BRANCH_HEAD);
        membershipRepo.save(UserDepartmentMembership.builder().userId(branchHeadId)
                .branchId(BRANCH_ID).departmentId(null)
                .membershipType(MembershipType.BRANCH_HEAD).primary(true).active(true).build());

        branchHeadOtherId = createUser(slug + "-bhead2", "BHead2 B", "Password!1");
        authService.assignRole(branchHeadOtherId, RoleType.BRANCH_HEAD);
        membershipRepo.save(UserDepartmentMembership.builder().userId(branchHeadOtherId)
                .branchId(OTHER_BRANCH_ID).departmentId(null)
                .membershipType(MembershipType.BRANCH_HEAD).primary(true).active(true).build());

        sectionHeadId  = createUser(slug + "-shead", "SHead B", "Password!1");
        authService.assignRole(sectionHeadId, RoleType.SECTION_HEAD);
        membershipRepo.save(UserDepartmentMembership.builder().userId(sectionHeadId)
                .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                .membershipType(MembershipType.SECTION_HEAD).primary(true).active(true).build());

        clerkId = createUser(slug + "-clerk", "Clerk B", "Password!1");
        authService.assignRole(clerkId, RoleType.ADMIN_CLERK);
        membershipRepo.save(UserDepartmentMembership.builder().userId(clerkId)
                .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                .membershipType(MembershipType.ADMIN_CLERK).primary(true).active(true).build());

        lawyerId = createUser(slug + "-lawyer", "Lawyer B", "Password!1");
        authService.assignRole(lawyerId, RoleType.STATE_LAWYER);
        membershipRepo.save(UserDepartmentMembership.builder().userId(lawyerId)
                .branchId(BRANCH_ID).departmentId(firstInstanceDeptId)
                .membershipType(MembershipType.STATE_LAWYER).primary(true).active(true).build());

        centralTok         = login(slug + "-central");
        branchHeadTok      = login(slug + "-bhead");
        branchHeadOtherTok = login(slug + "-bhead2");
        sectionHeadTok     = login(slug + "-shead");
        clerkTok           = login(slug + "-clerk");
        lawyerTok          = login(slug + "-lawyer");
    }

    private Long createUser(String username, String fullName, String pwd) {
        // Use a unique mobile for each call (Syrian 09XXXXXXXX format).
        // Take last 8 digits of nanoTime, ensure they fit.
        long n = System.nanoTime() & 0x7FFFFFFFL;
        String mobile = "09" + String.format("%08d", n % 100_000_000L);
        return authService.createUser(username, fullName, mobile, pwd, null, null);
    }

    private String login(String username) throws Exception {
        var resp = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + username + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk()).andReturn();
        return om.readTree(resp.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private static String tok(String t) { return "Bearer " + t; }

    private static String uniqueMobile() {
        long n = System.nanoTime() & 0x7FFFFFFFL;
        return "09" + String.format("%08d", n % 100_000_000L);
    }

    // ============================================================
    // 1) CENTRAL_SUPERVISOR can create a user; the new user can log in.
    // ============================================================
    @Test
    void central_createsUser_andUserCanLogIn() throws Exception {
        String u = slug + "-new1";
        String body = "{\"username\":\"" + u + "\",\"fullName\":\"New One\","
                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                + "\"initialPassword\":\"Password!1\"}";
        mvc.perform(post("/api/v1/users").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists());

        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isOk());
    }

    // ============================================================
    // 2) Non-central caller cannot create a user.
    // ============================================================
    @Test
    void nonCentral_cannotCreateUser() throws Exception {
        String body = "{\"username\":\"" + slug + "-x\",\"fullName\":\"x\","
                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                + "\"initialPassword\":\"Password!1\"}";
        for (String t : new String[]{ branchHeadTok, sectionHeadTok, clerkTok, lawyerTok }) {
            mvc.perform(post("/api/v1/users").header("Authorization", tok(t))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isForbidden());
        }
    }

    // ============================================================
    // 3) Duplicate username → 409 USERNAME_TAKEN.
    // ============================================================
    @Test
    void create_duplicateUsername_returnsConflict() throws Exception {
        String u = slug + "-dup";
        String body1 = "{\"username\":\"" + u + "\",\"fullName\":\"a\","
                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                + "\"initialPassword\":\"Password!1\"}";
        mvc.perform(post("/api/v1/users").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body1))
                .andExpect(status().isCreated());
        String body2 = "{\"username\":\"" + u + "\",\"fullName\":\"b\","
                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                + "\"initialPassword\":\"Password!1\"}";
        mvc.perform(post("/api/v1/users").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body2))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    // ============================================================
    // 4) Weak / forbidden password → 400 WEAK_PASSWORD.
    // ============================================================
    @Test
    void create_weakPassword_returnsBadRequest() throws Exception {
        // bean-validation rejects <8 chars before the service runs (VALIDATION_ERROR);
        // so test the explicit forbidden seed literal instead.
        String body = "{\"username\":\"" + slug + "-weak\",\"fullName\":\"x\","
                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                + "\"initialPassword\":\"ChangeMe!2026\"}";
        mvc.perform(post("/api/v1/users").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("WEAK_PASSWORD"));
    }

    // ============================================================
    // 5) Invalid branch/department combination → 400 BRANCH_DEPT_MISMATCH.
    // ============================================================
    @Test
    void create_branchDeptMismatch_returnsBadRequest() throws Exception {
        // department of OTHER branch but branchId points to BRANCH_ID
        String body = "{\"username\":\"" + slug + "-bd\",\"fullName\":\"x\","
                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                + "\"initialPassword\":\"Password!1\","
                + "\"defaultBranchId\":" + BRANCH_ID + ","
                + "\"defaultDepartmentId\":" + otherBranchDeptId + "}";
        mvc.perform(post("/api/v1/users").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BRANCH_DEPT_MISMATCH"));
    }

    // ============================================================
    // 6) PATCH active=false blocks login.
    // ============================================================
    @Test
    void patchActiveFalse_blocksLogin() throws Exception {
        String u = slug + "-pa";
        Long id = authService.createUser(u, "Patch A", uniqueMobile(), "Password!1", null, null);
        mvc.perform(patch("/api/v1/users/" + id).header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + u + "\",\"password\":\"Password!1\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
    }

    // ============================================================
    // 7) PATCH fullName + mobileNumber works; other fields ignored.
    // ============================================================
    @Test
    void patchUser_updatesFullNameAndMobile() throws Exception {
        Long id = authService.createUser(slug + "-pn", "Old Name", uniqueMobile(), "Password!1", null, null);
        String newMobile = uniqueMobile();
        String body = "{\"fullName\":\"New Name\",\"mobileNumber\":\"" + newMobile + "\"}";
        mvc.perform(patch("/api/v1/users/" + id).header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("New Name"))
                .andExpect(jsonPath("$.mobileNumber").value(newMobile));
    }

    // ============================================================
    // 8) GET /users paginated + filter by role works.
    // ============================================================
    @Test
    void listUsers_paginated_filteredByRole() throws Exception {
        var resp = mvc.perform(get("/api/v1/users?role=STATE_LAWYER&page=0&size=10")
                        .header("Authorization", tok(centralTok)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(10))
                .andReturn();
        JsonNode content = om.readTree(resp.getResponse().getContentAsString()).get("content");
        boolean foundLawyer = false;
        for (JsonNode n : content) {
            if (n.get("id").asLong() == lawyerId) foundLawyer = true;
            JsonNode roles = n.get("roles");
            assertThat(roles).isNotNull();
            // every returned row must include STATE_LAWYER among its roles
            boolean hasRole = false;
            for (JsonNode r : roles) {
                if ("STATE_LAWYER".equals(r.asText())) { hasRole = true; break; }
            }
            assertThat(hasRole).as("filter must restrict to STATE_LAWYER").isTrue();
        }
        assertThat(foundLawyer).isTrue();
    }

    // ============================================================
    // 9) Non-central GET /users → 403.
    // ============================================================
    @Test
    void listUsers_nonCentral_isForbidden() throws Exception {
        mvc.perform(get("/api/v1/users?page=0&size=5").header("Authorization", tok(branchHeadTok)))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 10) GET /users with membershipType still routes to D-046 endpoint
    //     (regression for params-based dispatch).
    // ============================================================
    @Test
    void listUsers_withMembershipType_routesToAssignableLawyers() throws Exception {
        // Section head of FIRST_INSTANCE @ BRANCH_ID can call the lawyer endpoint.
        mvc.perform(get("/api/v1/users?branchId=" + BRANCH_ID + "&departmentId="
                        + firstInstanceDeptId + "&membershipType=STATE_LAWYER")
                        .header("Authorization", tok(sectionHeadTok)))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.startsWith("[")));
    }

    // ============================================================
    // 11) Assign role: idempotent + revoke.
    // ============================================================
    @Test
    void assignRole_idempotent_andRevoke() throws Exception {
        Long id = authService.createUser(slug + "-r", "R", uniqueMobile(), "Password!1", null, null);

        mvc.perform(post("/api/v1/users/" + id + "/roles").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"SECTION_HEAD\"}"))
                .andExpect(status().isNoContent());
        // idempotent
        mvc.perform(post("/api/v1/users/" + id + "/roles").header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"SECTION_HEAD\"}"))
                .andExpect(status().isNoContent());

        mvc.perform(delete("/api/v1/users/" + id + "/roles/SECTION_HEAD")
                        .header("Authorization", tok(centralTok)))
                .andExpect(status().isNoContent());
        // second revoke → 404
        mvc.perform(delete("/api/v1/users/" + id + "/roles/SECTION_HEAD")
                        .header("Authorization", tok(centralTok)))
                .andExpect(status().isNotFound());
    }

    // ============================================================
    // 12) Invalid role string → 400.
    // ============================================================
    @Test
    void assignRole_invalid_returnsBadRequest() throws Exception {
        mvc.perform(post("/api/v1/users/" + lawyerId + "/roles")
                        .header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"NOT_A_ROLE\"}"))
                .andExpect(status().isBadRequest());
    }

    // ============================================================
    // 13) D-048: BRANCH_HEAD cannot grant or revoke BRANCH_HEAD role.
    // ============================================================
    @Test
    void d048_branchHead_cannotGrantBranchHead_role() throws Exception {
        Long id = authService.createUser(slug + "-bh", "BH target", uniqueMobile(), "Password!1", null, null);
        mvc.perform(post("/api/v1/users/" + id + "/roles").header("Authorization", tok(branchHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"BRANCH_HEAD\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("BRANCH_HEAD_CANNOT_GRANT_BRANCH_HEAD"));
    }

    // ============================================================
    // 14) Section head cannot manage roles at all in Mini-Phase B.
    // ============================================================
    @Test
    void sectionHead_cannotAssignRoles() throws Exception {
        mvc.perform(post("/api/v1/users/" + lawyerId + "/roles")
                        .header("Authorization", tok(sectionHeadTok))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"STATE_LAWYER\"}"))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 15) Membership add: BRANCH_HEAD type requires null departmentId.
    // ============================================================
    @Test
    void addMembership_branchHeadTypeRequiresNullDepartment() throws Exception {
        Long id = authService.createUser(slug + "-m", "M", uniqueMobile(), "Password!1", null, null);
        String body = "{\"branchId\":" + BRANCH_ID + ",\"departmentId\":" + firstInstanceDeptId
                + ",\"membershipType\":\"BRANCH_HEAD\",\"primary\":true,\"active\":true}";
        mvc.perform(post("/api/v1/users/" + id + "/department-memberships")
                        .header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MEMBERSHIP"));
    }

    // ============================================================
    // 16) Membership add: branch/dept mismatch is rejected.
    // ============================================================
    @Test
    void addMembership_branchDeptMismatch() throws Exception {
        Long id = authService.createUser(slug + "-m2", "M2", uniqueMobile(), "Password!1", null, null);
        String body = "{\"branchId\":" + BRANCH_ID + ",\"departmentId\":" + otherBranchDeptId
                + ",\"membershipType\":\"STATE_LAWYER\",\"primary\":false,\"active\":true}";
        mvc.perform(post("/api/v1/users/" + id + "/department-memberships")
                        .header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BRANCH_DEPT_MISMATCH"));
    }

    // ============================================================
    // 17) Membership add: duplicate detection.
    // ============================================================
    @Test
    void addMembership_duplicate_returnsConflict() throws Exception {
        Long id = authService.createUser(slug + "-m3", "M3", uniqueMobile(), "Password!1", null, null);
        String body = "{\"branchId\":" + BRANCH_ID + ",\"departmentId\":" + firstInstanceDeptId
                + ",\"membershipType\":\"STATE_LAWYER\",\"primary\":false,\"active\":true}";
        mvc.perform(post("/api/v1/users/" + id + "/department-memberships")
                        .header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/users/" + id + "/department-memberships")
                        .header("Authorization", tok(centralTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_MEMBERSHIP"));
    }

    // ============================================================
    // 18) BRANCH_HEAD can manage memberships only within own branch.
    // ============================================================
    @Test
    void branchHead_membershipScope() throws Exception {
        Long id = authService.createUser(slug + "-mb", "MB", uniqueMobile(), "Password!1", null, null);
        // own branch — STATE_LAWYER membership → OK
        String okBody = "{\"branchId\":" + BRANCH_ID + ",\"departmentId\":" + firstInstanceDeptId
                + ",\"membershipType\":\"STATE_LAWYER\",\"primary\":false,\"active\":true}";
        mvc.perform(post("/api/v1/users/" + id + "/department-memberships")
                        .header("Authorization", tok(branchHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(okBody))
                .andExpect(status().isCreated());

        // OTHER branch — forbidden for our branch head
        String otherBody = "{\"branchId\":" + OTHER_BRANCH_ID + ",\"departmentId\":" + otherBranchDeptId
                + ",\"membershipType\":\"STATE_LAWYER\",\"primary\":false,\"active\":true}";
        mvc.perform(post("/api/v1/users/" + id + "/department-memberships")
                        .header("Authorization", tok(branchHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(otherBody))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 19) Section head can grant a delegation only on a clerk in own dept.
    // ============================================================
    @Test
    void sectionHead_canGrantDelegationToClerkInOwnDept_only() throws Exception {
        // OK: clerkId is ADMIN_CLERK in the section head's department.
        String body = "{\"code\":\"ASSIGN_LAWYER\",\"granted\":true}";
        mvc.perform(post("/api/v1/users/" + clerkId + "/delegated-permissions")
                        .header("Authorization", tok(sectionHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.granted").value(true));
        // Forbidden: target is the lawyer (not a clerk in this dept).
        mvc.perform(post("/api/v1/users/" + lawyerId + "/delegated-permissions")
                        .header("Authorization", tok(sectionHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 20) Court-access grant + revoke + duplicate handling.
    // ============================================================
    @Test
    void courtAccess_grant_revoke_duplicate() throws Exception {
        // Pick (or create) a court in BRANCH_ID.
        Court court = courtRepo.findByBranchId(BRANCH_ID).stream().findFirst().orElseGet(() ->
                courtRepo.save(Court.builder()
                        .branchId(BRANCH_ID).departmentType(DepartmentType.FIRST_INSTANCE)
                        .nameAr("محكمة اختبار " + slug).chamberSupport(false).active(true).build()));

        String grantBody = "{\"courtId\":" + court.getId() + "}";
        // section head grants for the lawyer in own dept
        var resp = mvc.perform(post("/api/v1/users/" + lawyerId + "/court-access")
                        .header("Authorization", tok(sectionHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(grantBody))
                .andExpect(status().isCreated())
                .andReturn();
        long caId = om.readTree(resp.getResponse().getContentAsString()).get("id").asLong();

        // duplicate active row → 409 COURT_ACCESS_DUPLICATE
        mvc.perform(post("/api/v1/users/" + lawyerId + "/court-access")
                        .header("Authorization", tok(sectionHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(grantBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COURT_ACCESS_DUPLICATE"));

        // revoke (logical delete)
        mvc.perform(delete("/api/v1/users/" + lawyerId + "/court-access/" + caId)
                        .header("Authorization", tok(sectionHeadTok)))
                .andExpect(status().isNoContent());

        // re-grant after revoke is allowed
        mvc.perform(post("/api/v1/users/" + lawyerId + "/court-access")
                        .header("Authorization", tok(sectionHeadTok))
                        .contentType(MediaType.APPLICATION_JSON).content(grantBody))
                .andExpect(status().isCreated());
    }

    // ============================================================
    // 21) Court-access grant by unrelated section head → 403.
    // ============================================================
    @Test
    void courtAccess_unauthorized_isForbidden() throws Exception {
        Court court = courtRepo.findByBranchId(BRANCH_ID).stream().findFirst().orElseGet(() ->
                courtRepo.save(Court.builder()
                        .branchId(BRANCH_ID).departmentType(DepartmentType.FIRST_INSTANCE)
                        .nameAr("محكمة اختبار 2 " + slug).chamberSupport(false).active(true).build()));
        String grantBody = "{\"courtId\":" + court.getId() + "}";
        // clerk has no MANAGE_COURT_ACCESS delegation
        mvc.perform(post("/api/v1/users/" + lawyerId + "/court-access")
                        .header("Authorization", tok(clerkTok))
                        .contentType(MediaType.APPLICATION_JSON).content(grantBody))
                .andExpect(status().isForbidden());
    }

    // ============================================================
    // 22) anonymous → 401 on any admin endpoint.
    // ============================================================
    @Test
    void anonymous_isUnauthorized() throws Exception {
        mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"x\",\"fullName\":\"x\","
                                + "\"mobileNumber\":\"" + uniqueMobile() + "\","
                                + "\"initialPassword\":\"Password!1\"}"))
                .andExpect(status().isUnauthorized());
    }
}

