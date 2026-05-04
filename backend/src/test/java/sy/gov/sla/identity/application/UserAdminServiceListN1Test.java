package sy.gov.sla.identity.application;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import sy.gov.sla.access.application.AuthorizationContext;
import sy.gov.sla.access.application.AuthorizationService;
import sy.gov.sla.access.domain.Role;
import sy.gov.sla.access.domain.RoleType;
import sy.gov.sla.access.domain.UserRole;
import sy.gov.sla.access.infrastructure.RoleRepository;
import sy.gov.sla.access.infrastructure.UserCourtAccessRepository;
import sy.gov.sla.access.infrastructure.UserDelegatedPermissionRepository;
import sy.gov.sla.access.infrastructure.UserDepartmentMembershipRepository;
import sy.gov.sla.access.infrastructure.UserRoleRepository;
import sy.gov.sla.common.api.PageResponse;
import sy.gov.sla.identity.api.UserSummaryDto;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.organization.infrastructure.BranchRepository;
import sy.gov.sla.organization.infrastructure.DepartmentRepository;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * P3-02 regression guard — proves {@code list} batches role lookups using
 *   1× roleRepository.findAll()                  (was: N× — once per user)
 *   1× userRoleRepository.findByUserIdIn(ids)    (was: N× — findByUserId per row)
 * and never falls back to the per-row {@code rolesOf(userId)} path.
 */
@ExtendWith(MockitoExtension.class)
class UserAdminServiceListN1Test {

    @Mock private UserRepository userRepository;
    @Mock private UserRoleRepository userRoleRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private UserDepartmentMembershipRepository membershipRepo;
    @Mock private UserCourtAccessRepository courtAccessRepo;
    @Mock private UserDelegatedPermissionRepository delegatedRepo;
    @Mock private BranchRepository branchRepo;
    @Mock private DepartmentRepository departmentRepo;
    @Mock private AuthorizationService authorizationService;
    @Mock private PasswordEncoder passwordEncoder;

    @InjectMocks private UserAdminService service;

    private static AuthorizationContext centralCtx() {
        return new AuthorizationContext(
                /* userId */ 1L,
                Set.of(RoleType.CENTRAL_SUPERVISOR),
                Set.of(),
                Set.of(),
                Set.of());
    }

    private static User user(Long id, String username) {
        return User.builder()
                .id(id)
                .username(username)
                .fullName("Full " + username)
                .mobileNumber("0000" + id)
                .passwordHash("h")
                .active(true)
                .locked(false)
                .createdAt(Instant.now())
                .build();
    }

    private static Role role(Long id, RoleType t) {
        return Role.builder().id(id).type(t).nameAr(t.name()).build();
    }

    private static UserRole userRole(Long userId, Long roleId) {
        return UserRole.builder().id(roleId * 100 + userId).userId(userId).roleId(roleId).build();
    }

    @Test
    void list_with_3_users_makes_at_most_one_findAll_and_one_findByUserIdIn_call() {
        when(authorizationService.loadContext(anyLong())).thenReturn(centralCtx());

        Page<User> page = new PageImpl<>(
                List.of(user(1L, "alice"), user(2L, "bob"), user(3L, "carol")),
                PageRequest.of(0, 20),
                3);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(page);

        // Two roles in the system; user 1 has STATE_LAWYER, user 2 has ADMIN_CLERK,
        // user 3 has both. Asserts the in-memory groupBy works for multi-role users.
        when(roleRepository.findAll()).thenReturn(List.of(
                role(11L, RoleType.STATE_LAWYER),
                role(12L, RoleType.ADMIN_CLERK)));
        when(userRoleRepository.findByUserIdIn(List.of(1L, 2L, 3L))).thenReturn(List.of(
                userRole(1L, 11L),
                userRole(2L, 12L),
                userRole(3L, 11L),
                userRole(3L, 12L)));

        PageResponse<UserSummaryDto> result = service.list(
                /* role */ null, /* branchId */ null, /* departmentId */ null,
                /* active */ null, /* q */ null,
                0, 20, /* actorUserId */ 99L);

        // Roles were resolved correctly.
        assertThat(result.content()).hasSize(3);
        assertThat(result.content().get(0).roles()).containsExactly(RoleType.STATE_LAWYER);
        assertThat(result.content().get(1).roles()).containsExactly(RoleType.ADMIN_CLERK);
        assertThat(result.content().get(2).roles())
                .containsExactlyInAnyOrder(RoleType.STATE_LAWYER, RoleType.ADMIN_CLERK);

        // ===== Regression guards =====
        // roleRepository.findAll: once total — NOT once per user as before.
        verify(roleRepository, times(1)).findAll();
        // userRoleRepository.findByUserIdIn: once total.
        verify(userRoleRepository, times(1)).findByUserIdIn(List.of(1L, 2L, 3L));
        // userRoleRepository.findByUserId: NEVER inside the list path.
        verify(userRoleRepository, never()).findByUserId(anyLong());
    }

    @Test
    void list_with_empty_page_skips_role_lookups_entirely() {
        when(authorizationService.loadContext(anyLong())).thenReturn(centralCtx());
        Page<User> empty = new PageImpl<>(List.of(), PageRequest.of(0, 20), 0);
        when(userRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(empty);

        service.list(null, null, null, null, null, 0, 20, 99L);

        verify(roleRepository, never()).findAll();
        verify(userRoleRepository, never()).findByUserIdIn(any());
        verify(userRoleRepository, never()).findByUserId(anyLong());
    }
}
