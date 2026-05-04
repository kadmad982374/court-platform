-- ============================================================
-- V26: Optimistic-locking version columns (PR-3 / D-050)
-- ============================================================
-- Adds a `version BIGINT NOT NULL DEFAULT 0` column to the four hot mutable
-- entities so JPA's @Version mechanism can detect concurrent writes:
--
--   * users            — concurrent login flows + admin patches + (P1-06) lockout counter
--   * litigation_cases — concurrent assignLawyer / lifecycle transitions
--   * case_stages      — concurrent promote-to-appeal + hearing entries
--   * execution_files  — concurrent status / assigned-user changes
--
-- Postgres 11+ implements `ADD COLUMN ... DEFAULT <constant>` as a metadata-only
-- operation (no full table rewrite), so this is fast and safe even on large
-- tables. Existing rows backfill to 0; new rows are managed by Hibernate.
--
-- Idempotent: every ALTER uses `IF NOT EXISTS`.
-- Reversible: drop the columns; entities still work (Hibernate falls back to
--   no-op without @Version), but lost-update races return.
-- ============================================================

ALTER TABLE users            ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE litigation_cases ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE case_stages      ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE execution_files  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
