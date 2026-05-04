package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sy.gov.sla.access.domain.Role;
import sy.gov.sla.access.domain.UserRole;
import sy.gov.sla.access.infrastructure.RoleRepository;
import sy.gov.sla.access.infrastructure.UserRoleRepository;
import sy.gov.sla.common.exception.AppException;
import sy.gov.sla.common.exception.BadRequestException;
import sy.gov.sla.common.logging.UserActionLog;
import sy.gov.sla.identity.api.*;
import sy.gov.sla.identity.domain.PasswordResetCode;
import sy.gov.sla.identity.domain.RefreshToken;
import sy.gov.sla.identity.domain.User;
import sy.gov.sla.identity.infrastructure.PasswordResetCodeRepository;
import sy.gov.sla.identity.infrastructure.RefreshTokenRepository;
import sy.gov.sla.identity.infrastructure.UserRepository;
import sy.gov.sla.security.JwtProperties;
import sy.gov.sla.security.JwtService;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    /** P1-06: lockout policy parameters. */
    private static final int LOCKOUT_THRESHOLD = 5;
    private static final Duration LOCKOUT_WINDOW = Duration.ofMinutes(15);
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(30);

    /** P1-08: bcrypt-priced filler used when forgotPassword sees an unknown mobile. */
    private static final String DUMMY_PWD_FOR_TIMING = "constant-time-dummy-password";

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetCodeRepository resetRepo;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final OtpProperties otpProperties;
    private final OtpDispatcher otpDispatcher;

    private static final SecureRandom RANDOM = new SecureRandom();

    // ==========================================================
    // LOGIN  (P1-06 lockout + P1-08-style timing-mask)
    // ==========================================================
    public TokenPairResponse login(LoginRequest req) {
        Optional<User> userOpt = userRepository.findByUsername(req.username());

        if (userOpt.isEmpty()) {
            // Constant-time-ish dummy hash so attackers can't time-distinguish
            // "user exists with bad pwd" from "user does not exist".
            passwordEncoder.matches(req.password(), passwordEncoder.encode(DUMMY_PWD_FOR_TIMING));
            UserActionLog.system("login failed — reason={}, username={}", "INVALID_CREDENTIALS", req.username());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS", "Invalid credentials");
        }
        User user = userOpt.get();

        // ── P1-06: hard lockout window check ─────────────────────
        Instant now = Instant.now();
        if (user.getLockedUntil() != null && now.isBefore(user.getLockedUntil())) {
            UserActionLog.system("login refused — reason=ACCOUNT_LOCKED, username={}, until={}",
                    req.username(), user.getLockedUntil());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "ACCOUNT_LOCKED", "Account is temporarily locked. Try again later.");
        }

        if (!user.isActive() || user.isLocked()) {
            UserActionLog.system("login failed — reason={}, username={}", "ACCOUNT_DISABLED", req.username());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "ACCOUNT_DISABLED", "Account disabled or locked");
        }

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            registerFailedLogin(user, now);
            UserActionLog.system("login failed — reason={}, username={}", "INVALID_CREDENTIALS", req.username());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS", "Invalid credentials");
        }

        // ── Successful login: reset counters, issue tokens ──────
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        TokenPairResponse tokens = issueTokensNewFamily(user);

        try {
            MDC.put("username", user.getUsername());
            MDC.put("userId", String.valueOf(user.getId()));
            UserActionLog.action("signed in");
        } finally {
            MDC.remove("username");
            MDC.remove("userId");
        }
        return tokens;
    }

    /** P1-06: increment failed count with rolling window; lock when threshold crossed. */
    private void registerFailedLogin(User user, Instant now) {
        // Roll the window: if last failure was > LOCKOUT_WINDOW ago, reset count.
        Instant lastFail = user.getLastFailedLoginAt();
        if (lastFail == null || lastFail.isBefore(now.minus(LOCKOUT_WINDOW))) {
            user.setFailedLoginCount(0);
        }
        user.setFailedLoginCount(user.getFailedLoginCount() + 1);
        user.setLastFailedLoginAt(now);
        if (user.getFailedLoginCount() >= LOCKOUT_THRESHOLD) {
            user.setLockedUntil(now.plus(LOCKOUT_DURATION));
            UserActionLog.system("account locked — username={}, until={}",
                    user.getUsername(), user.getLockedUntil());
        }
    }

    // ==========================================================
    // REFRESH  (P1-01 family revocation + P1-02 active/locked recheck)
    // ==========================================================
    public TokenPairResponse refresh(RefreshTokenRequest req) {
        String hash = sha256(req.refreshToken());
        RefreshToken rt = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> {
                    UserActionLog.system("refresh rejected — reason={}", "INVALID_REFRESH_TOKEN");
                    return new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                            "INVALID_REFRESH_TOKEN", "Invalid refresh token");
                });

        // P1-01: replay of a revoked RT → revoke the entire family.
        // This is the "leaked refresh token" detection path. If the legitimate user has
        // already rotated and an attacker replays the leaked predecessor, every active
        // session in that chain is invalidated — the attacker cannot keep using rotations.
        if (rt.isRevoked()) {
            int killed = revokeFamily(rt.getFamilyId(), rt.getUserId());
            UserActionLog.system("refresh rejected — reason=REVOKED_REPLAY, family={}, family_kills={}",
                    rt.getFamilyId(), killed);
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_REFRESH_TOKEN", "Invalid refresh token");
        }
        if (rt.getExpiresAt().isBefore(Instant.now())) {
            UserActionLog.system("refresh rejected — reason=EXPIRED");
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_REFRESH_TOKEN", "Invalid refresh token");
        }

        User user = userRepository.findById(rt.getUserId())
                .orElseThrow(() -> new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                        "INVALID_REFRESH_TOKEN", "Invalid refresh token"));

        // P1-02: deactivated/locked accounts cannot rotate sessions.
        if (!user.isActive() || user.isLocked()
                || (user.getLockedUntil() != null && Instant.now().isBefore(user.getLockedUntil()))) {
            UserActionLog.system("refresh refused — reason=ACCOUNT_DISABLED, user_id={}", user.getId());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "ACCOUNT_DISABLED", "Account disabled or locked");
        }

        // Rotate: revoke this RT, issue new RT in the SAME family.
        rt.setRevoked(true);
        rt.setRevokedAt(Instant.now());
        TokenPairResponse tokens = issueTokensInFamily(user, rt.getFamilyId());
        UserActionLog.action("refreshed session");
        return tokens;
    }

    /** P1-01: revoke every non-revoked RT sharing a family_id. Returns how many were killed. */
    private int revokeFamily(UUID familyId, Long userIdForLog) {
        List<RefreshToken> alive = refreshTokenRepository.findByFamilyIdAndRevokedFalse(familyId);
        Instant now = Instant.now();
        for (RefreshToken r : alive) {
            r.setRevoked(true);
            r.setRevokedAt(now);
        }
        return alive.size();
    }

    // ==========================================================
    // LOGOUT
    // ==========================================================
    public void logout(LogoutRequest req) {
        String hash = sha256(req.refreshToken());
        refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
            rt.setRevoked(true);
            rt.setRevokedAt(Instant.now());
            UserActionLog.action("signed out");
        });
    }

    // ==========================================================
    // FORGOT PASSWORD  (P1-07 OTP scrub + P1-08 timing mask)
    // ==========================================================
    public void forgotPassword(ForgotPasswordRequest req) {
        Optional<User> userOpt = userRepository.findByMobileNumber(req.mobileNumber());

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String code = generateNumericCode(otpProperties.length());
            String hash = sha256(code);
            Instant now = Instant.now();
            resetRepo.save(PasswordResetCode.builder()
                    .userId(user.getId())
                    .codeHash(hash)
                    .issuedAt(now)
                    .expiresAt(now.plusSeconds(otpProperties.ttlMinutes() * 60L))
                    .attempts(0)
                    .consumed(false)
                    .build());
            otpDispatcher.dispatch(req.mobileNumber(), code);
        } else {
            // P1-08: dummy bcrypt to mask user-existence timing oracle.
            passwordEncoder.encode(DUMMY_PWD_FOR_TIMING);
        }

        // P1-07: do NOT log the mobile number or whether the user existed.
        // This log line is identical for both branches.
        UserActionLog.system("password-reset requested");
    }

    // ==========================================================
    // RESET PASSWORD  (P1-10 — repo method, no findAll())
    // ==========================================================
    public void resetPassword(ResetPasswordRequest req) {
        User user = userRepository.findByMobileNumber(req.mobileNumber())
                .orElseThrow(() -> new BadRequestException("INVALID_OTP", "Invalid code or mobile"));
        var codes = resetRepo.findByUserIdAndConsumedFalse(user.getId());
        Instant now = Instant.now();
        String hash = sha256(req.code());
        PasswordResetCode match = null;
        for (var c : codes) {
            if (c.getExpiresAt().isBefore(now)) continue;
            if (c.getAttempts() >= otpProperties.maxAttempts()) continue;
            if (c.getCodeHash().equals(hash)) { match = c; break; }
            c.setAttempts(c.getAttempts() + 1);
        }
        if (match == null) {
            UserActionLog.system("password reset failed — reason=INVALID_OTP, user_id={}", user.getId());
            throw new BadRequestException("INVALID_OTP", "Invalid code or mobile");
        }
        match.setConsumed(true);
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        // D-049: a successful reset clears the must-change flag.
        user.setMustChangePassword(false);
        // P1-06: a successful reset wipes the lockout state.
        user.setFailedLoginCount(0);
        user.setLockedUntil(null);

        // P1-10: targeted query instead of findAll() + filter.
        Instant revokedAt = Instant.now();
        for (RefreshToken rt : refreshTokenRepository.findByUserIdAndRevokedFalse(user.getId())) {
            rt.setRevoked(true);
            rt.setRevokedAt(revokedAt);
        }
        UserActionLog.system("password reset completed for user id={}", user.getId());
    }

    // ==========================================================
    // CHANGE PASSWORD  (D-049 — authenticated)
    // ==========================================================
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                        "UNAUTHENTICATED", "Authentication required"));
        if (!passwordEncoder.matches(req.oldPassword(), user.getPasswordHash())) {
            UserActionLog.system("change-password failed — reason=BAD_OLD_PASSWORD, user_id={}", userId);
            throw new BadRequestException("BAD_OLD_PASSWORD", "Current password is incorrect");
        }
        if (req.newPassword() == null || req.newPassword().length() < 8) {
            throw new BadRequestException("WEAK_PASSWORD",
                    "New password must be at least 8 characters");
        }
        if (passwordEncoder.matches(req.newPassword(), user.getPasswordHash())) {
            throw new BadRequestException("WEAK_PASSWORD",
                    "New password must be different from current");
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setMustChangePassword(false);
        // Revoke all active refresh-token sessions; user will sign back in fresh.
        Instant now = Instant.now();
        for (RefreshToken rt : refreshTokenRepository.findByUserIdAndRevokedFalse(userId)) {
            rt.setRevoked(true);
            rt.setRevokedAt(now);
        }
        UserActionLog.action("changed password");
    }

    // ==========================================================
    // Internal: token issuance (with family tracking)
    // ==========================================================
    private TokenPairResponse issueTokensNewFamily(User user) {
        return issueTokensInFamily(user, UUID.randomUUID());
    }

    private TokenPairResponse issueTokensInFamily(User user, UUID familyId) {
        List<String> roleNames = userRoleRepository.findByUserId(user.getId()).stream()
                .map(UserRole::getRoleId)
                .map(roleRepository::findById)
                .filter(java.util.Optional::isPresent)
                .map(o -> o.get().getType().name())
                .toList();
        String access = jwtService.generateAccessToken(user.getId(), user.getUsername(), roleNames);

        String refreshPlain = UUID.randomUUID().toString() + "-" + UUID.randomUUID();
        Instant now = Instant.now();
        RefreshToken rt = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(refreshPlain))
                .familyId(familyId)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(jwtProperties.refreshTokenTtlDays() * 86400L))
                .revoked(false)
                .build();
        refreshTokenRepository.save(rt);
        return new TokenPairResponse(access, refreshPlain, jwtProperties.accessTokenTtlMinutes() * 60L);
    }

    private static String generateNumericCode(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) sb.append(RANDOM.nextInt(10));
        return sb.toString();
    }

    static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(s.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** يُستخدم في bootstrap وفي tests لإنشاء مستخدم. */
    @Roles("internal")
    public Long createUser(String username, String fullName, String mobile, String rawPassword,
                           Long defaultBranchId, Long defaultDepartmentId) {
        if (userRepository.existsByUsername(username)) {
            throw new BadRequestException("USERNAME_TAKEN", "Username already taken");
        }
        User u = User.builder()
                .username(username)
                .fullName(fullName)
                .mobileNumber(mobile)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .active(true)
                .locked(false)
                .defaultBranchId(defaultBranchId)
                .defaultDepartmentId(defaultDepartmentId)
                .createdAt(Instant.now())
                // D-049: admin-created users must change password on first login.
                .mustChangePassword(true)
                .build();
        return userRepository.save(u).getId();
    }

    public void assignRole(Long userId, sy.gov.sla.access.domain.RoleType role) {
        Role r = roleRepository.findByType(role)
                .orElseThrow(() -> new BadRequestException("ROLE_NOT_FOUND", "Role not found"));
        boolean exists = userRoleRepository.findByUserId(userId).stream()
                .anyMatch(ur -> ur.getRoleId().equals(r.getId()));
        if (!exists) {
            userRoleRepository.save(UserRole.builder().userId(userId).roleId(r.getId()).build());
        }
    }

    /** مجرد marker توضيحي. */
    @java.lang.annotation.Retention(java.lang.annotation.RetentionPolicy.SOURCE)
    private @interface Roles { String value(); }
}
