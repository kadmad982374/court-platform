-- ============================================================
-- V27: Auth hardening (PR-4)
-- ============================================================
-- Adds the columns needed for:
--   * P1-01  refresh-token family-wide revocation on reuse
--   * P1-06  login lockout (5 fails / 15 min → 30 min lock)
--   * D-049  must-change-password on first login
--
-- All operations are additive and idempotent. Existing rows backfill via
-- DEFAULT; the only constraint promotion (family_id NOT NULL) is gated by a
-- backfill step.
-- ============================================================

-- ── 1) refresh_tokens.family_id (P1-01) ──────────────────────
-- A "family" groups every refresh token in a rotation chain. On rotate, the
-- new RT inherits the predecessor's family_id. If a revoked RT is ever
-- replayed, AuthService.refresh() revokes the WHOLE family — kicks the
-- attacker out of every active session derived from the leaked token.

ALTER TABLE refresh_tokens
    ADD COLUMN IF NOT EXISTS family_id UUID;

-- Backfill: each existing RT becomes its own family (no historical chains
-- to reconstruct — pre-V27 rotations created independent rows).
UPDATE refresh_tokens
   SET family_id = gen_random_uuid()
 WHERE family_id IS NULL;

ALTER TABLE refresh_tokens
    ALTER COLUMN family_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS ix_refresh_tokens_user_revoked ON refresh_tokens(user_id, revoked);

-- ── 2) users — login lockout (P1-06) ─────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS failed_login_count   INT          NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until         TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

-- ── 3) users.must_change_password (D-049) ────────────────────
-- Defaults FALSE for existing users (they presumably already chose their own
-- password). Bootstrap admin + admin-created users will set TRUE explicitly.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
