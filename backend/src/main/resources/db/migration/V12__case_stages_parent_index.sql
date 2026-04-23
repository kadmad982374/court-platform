-- V12: index for fast parent_stage_id lookup (Phase 4 — appeal chain navigation)

CREATE INDEX ix_cs_parent ON case_stages(parent_stage_id) WHERE parent_stage_id IS NOT NULL;

