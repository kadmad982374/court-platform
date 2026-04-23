# /todo

Backlog folder for audit findings and planned work.

## Files

- **[findings.md](findings.md)** — Full audit backlog from the 2026-04-23 read-only validation pipeline. 64 actionable items across 8 phases + 6 blocking decisions. Check items off as they land.
- **[blueprint_gap_analysis.md](blueprint_gap_analysis.md)** — 2026-04-23 compliance review against `docs/project/FINAL_ARABIC_BLUEPRINT_STATE_LITIGATION_SYSTEM.md` (customer requirements). 66 blueprint items checked: 37 aligned, 17 partial, 7 missing, 5 diverge. Feeds a proposed Phase 9 (P9-01..P9-22) for the main backlog.

## Conventions

- Phases map 1:1 to orchestrator pipelines. Completing a phase = one merged PR + one `memory-keeper` WRITE.
- Item IDs (`P1-01`, `P2-03`, etc.) are stable — reference them in commit messages / PR titles for traceability.
- Severity emoji: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low.
- When a phase completes, update `findings.md` (check off items), update the decision numbers in `.claude/project_knowledge_base.md` (§10), and let memory-keeper record the closure.

## Not a project management tool

This is a lightweight local todo file. If project tracking grows beyond ~100 items, migrate to an issue tracker (GitHub Issues, Linear, Jira) and leave a pointer here.
