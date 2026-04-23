/**
 * Frozen IDs from the V22 demo seed (DEMO_SEED_RUNTIME_VERIFICATION.md).
 *
 * Keep in sync with V22__demo_seed.sql. Never use raw numeric IDs in
 * specs — import from here so a future re-numbering can be done in one place.
 */
export const SEED = {
  /** Case 1 — DEMO-FRESH-001, lifecycle=NEW, no current owner. */
  CASE_FRESH: 1,
  /** Case 2 — DEMO-ASSIGNED-002, owned by lawyer_fi_dam. */
  CASE_OWNED_BY_LAWYER: 2,
  /** Case 3 — DEMO-FINALIZED-003, finalized FOR_ENTITY. */
  CASE_FINALIZED: 3,
  /** Case 4 — DEMO-IN-EXECUTION-004, has live execution file. */
  CASE_IN_EXECUTION: 4,
  /** Case 5 — DEMO-APPEAL-FINAL-005 (V24): appeal FINALIZED, is_read_only=FALSE.
   *  lifecycle=IN_APPEAL — promote-to-execution is ALLOWED on first run.
   *  Subsequent runs receive 409 STAGE_ALREADY_PROMOTED (handled by test). */
  CASE_APPEAL_READY: 5,
  STAGE_OWNED_BY_LAWYER: 2,
  /** Execution file 1 — attached to CASE_IN_EXECUTION. */
  EXEC_FILE: 1,
} as const;

