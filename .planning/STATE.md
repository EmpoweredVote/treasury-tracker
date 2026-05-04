# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Milestone v1.2 — Phase 8: Data Quality (ready to plan)

## Current Position

Phase: 8 of 10 (Data Quality)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-05-03 — v1.2 roadmap created; Phases 8-10 defined

Progress: [███████░░░░░░░░░░░░░] 35% (7/19 plans complete — v1.2 plans TBD, using 3/phase estimate)

## Performance Metrics

**Velocity:**
- Total plans completed: 18 (v1.0 + v1.1)
- Average duration: ~30 min/plan (estimated)
- Total execution time: ~9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 Donate Button | 1/1 | — | — |
| 2 Data Layer Audit | 1/1 | — | — |
| 3 Webhook Backend | 5/5 | — | — |
| 4 Live Feedback UI | 2/2 | — | — |
| 5 Dallas Socrata | 3/3 | — | — |
| 6 XLSX Pipeline | 3/3 | — | — |
| 7 PDF/Haiku Vision | 3/3 | — | — |

*Updated after each plan completion*

## Accumulated Context

### Key Decisions Relevant to v1.2

- `bulkLoadPDF.js` pipeline: `p_triggered_by` must be `'bulk_load'`; RPC is `treasury_sync_budget_tree`
- Exit code 2 (JSON truncation on dense pages) accepted in v1.1 — targeted fix is DQ-04 in Phase 8
- "Unknown" department dominance root cause: ACFR section headings not tracked across pages — Phase 8 fix
- pdftoimg-js v2: scale 2.08 ≈ 150 DPI; cache key = SHA-256 of full PDF buffer
- Haiku model: `claude-haiku-4-5-20251001`; malformed JSON → confidence=0 flagged (not retry)
- `treasury.data_sources` no unique constraint on `name` — select-by-name then insert/update pattern
- `treasury_sync_budget` (bare) does not exist — always use `treasury_sync_budget_tree`

### Blockers / Concerns

- Phase 8 (DQ): Need to audit how many rows per city are currently "Unknown" before deciding re-load strategy
- Phase 10 (COL): ACFRs for Murphy and Princeton (small cities) may not be publicly available in structured PDF form — confirm during 10-01

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 001 | Create treasury tracker entries for every municipality in Collin County, Texas | 2026-05-01 | 9584b2a |

## Session Continuity

Last session: 2026-05-03
Stopped at: v1.2 roadmap created — ready to plan Phase 8
Resume file: None
