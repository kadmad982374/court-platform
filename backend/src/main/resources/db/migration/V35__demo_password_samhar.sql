-- ============================================================
-- V35: Client feedback — change the demo password to `samhar_rr`.
-- ============================================================
-- Sets every seeded demo account's password to `samhar_rr` (BCrypt,
-- strength 10 — matches SecurityConfig's BCryptPasswordEncoder). The
-- hash below was produced with the application's own BCrypt and verified
-- with checkpw(). It replaces the previous shared password (ChangeMe!2026).
--
-- Also clears any lock / must-change-password state so the demo accounts
-- log straight in with the new password.
--
-- Idempotent: re-running simply re-applies the same hash.
--
-- ⚠️  DEMO/DEV ONLY — REMOVE BEFORE DEPLOYING TO PRODUCTION. ⚠️
--     (Production provisions real credentials; it must NOT ship a known
--      shared password. See docs/project/FINAL_PRODUCTION_BLOCKERS.md.)
-- ============================================================

UPDATE users
   SET password_hash        = '$2a$10$9uwLCUk97cOu9hXm3e5V4OIUFLvgKCpNKq8sRySIZWhG9.yOTiigW',
       must_change_password = FALSE,
       is_locked            = FALSE,
       failed_login_count   = 0,
       locked_until         = NULL;
