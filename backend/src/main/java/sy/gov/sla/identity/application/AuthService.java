package sy.gov.sla.identity.application;

import lombok.RequiredArgsConstructor;
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
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

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

    public TokenPairResponse login(LoginRequest req) {
        User user = userRepository.findByUsername(req.username())
                .orElseThrow(() -> {
                    UserActionLog.system("login failed — reason={}, username={}", "INVALID_CREDENTIALS", req.username());
                    return new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                            "INVALID_CREDENTIALS", "Invalid credentials");
                });
        if (!user.isActive() || user.isLocked()) {
            UserActionLog.system("login failed — reason={}, username={}", "ACCOUNT_DISABLED", req.username());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "ACCOUNT_DISABLED", "Account disabled or locked");
        }
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            UserActionLog.system("login failed — reason={}, username={}", "INVALID_CREDENTIALS", req.username());
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS", "Invalid credentials");
        }
        user.setLastLoginAt(Instant.now());
        TokenPairResponse tokens = issueTokens(user);
        UserActionLog.action("signed in");
        return tokens;
    }

    public TokenPairResponse refresh(RefreshTokenRequest req) {
        String hash = sha256(req.refreshToken());
        RefreshToken rt = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> {
                    UserActionLog.system("refresh rejected — reason={}", "INVALID_REFRESH_TOKEN");
                    return new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                            "INVALID_REFRESH_TOKEN", "Invalid refresh token");
                });
        if (rt.isRevoked() || rt.getExpiresAt().isBefore(Instant.now())) {
            UserActionLog.system("refresh rejected — reason={}", "INVALID_REFRESH_TOKEN");
            throw new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "INVALID_REFRESH_TOKEN", "Invalid refresh token");
        }
        // Rotate: revoke old, issue new
        rt.setRevoked(true);
        rt.setRevokedAt(Instant.now());
        User user = userRepository.findById(rt.getUserId())
                .orElseThrow(() -> {
                    UserActionLog.system("refresh rejected — reason={}", "INVALID_REFRESH_TOKEN");
                    return new AppException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                            "INVALID_REFRESH_TOKEN", "Invalid refresh token");
                });
        TokenPairResponse tokens = issueTokens(user);
        UserActionLog.action("refreshed session");
        return tokens;
    }

    public void logout(LogoutRequest req) {
        String hash = sha256(req.refreshToken());
        refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
            rt.setRevoked(true);
            rt.setRevokedAt(Instant.now());
            UserActionLog.action("signed out");
        });
    }

    public void forgotPassword(ForgotPasswordRequest req) {
        // لا نكشف وجود/عدم وجود الرقم. ننشئ كود فقط إن وُجد.
        userRepository.findByMobileNumber(req.mobileNumber()).ifPresent(user -> {
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
            UserActionLog.system("password reset code issued to mobile={}", req.mobileNumber());
        });
    }

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
            UserActionLog.system("password reset failed — reason=INVALID_OTP, mobile={}", req.mobileNumber());
            throw new BadRequestException("INVALID_OTP", "Invalid code or mobile");
        }
        match.setConsumed(true);
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        // إبطال جميع refresh tokens عند تغيير كلمة المرور.
        refreshTokenRepository.findAll().stream()
                .filter(rt -> rt.getUserId().equals(user.getId()) && !rt.isRevoked())
                .forEach(rt -> { rt.setRevoked(true); rt.setRevokedAt(Instant.now()); });
        UserActionLog.system("password reset completed for user id={}", user.getId());
    }

    private TokenPairResponse issueTokens(User user) {
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

