# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-03)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Milestone v1.2 — Phase 8: Data Quality (in progress)

## Current Position

Phase: 8 of 10 (Data Quality)
Plan: 3 of 3 in current phase
Status: Phase complete — pending verification
Last activity: 2026-05-04 — Completed 08-03: Frisco FY2026 and Plano FY2019/2020/2022 re-extracted; phase execution complete

Progress: [██████████░░░░░░░░░░] 50% (10/20 plans complete)

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
- Exit code 2 (JSON truncation on dense pages) — FIXED in 08-01: max_tokens raised to 8192, stop_reason guard returns confidence=0 without retry
- "Unknown" department dominance — FIXED in 08-01: section_heading prompt + currentSection carry-forward across pages
- max_tokens=8192: dense ACFR page ~40 rows × ~200 tokens ≈ 8000; 64k unnecessary/costly
- section_heading via prompt injection (not row-value heuristics); currentSection scoped per processPDF call
- Frisco Operating Budget FY2026 data_source: id=de4a6008 (seeded 2026-05-04)
- pdftoimg-js v2: scale 2.08 ≈ 150 DPI; cache key = SHA-256 of full PDF buffer
- Haiku model: `claude-haiku-4-5-20251001`; malformed JSON → confidence=0 flagged (not retry)
- `treasury.data_sources` no unique constraint on `name` — select-by-name then insert/update pattern
- `treasury_sync_budget` (bare) does not exist — always use `treasury_sync_budget_tree`
- pct_unknown is the re-extraction success metric, not total row count (Haiku is non-deterministic; row counts differ between runs)
- Allen and Prosper FY2025 were already clean (0% Unknown) before 08-02; Celina's single Unknown row covering $207M (17.9% of dollars) resolved by re-extraction
- Plano FY2023–2026 skipped in 08-03 — already 99.9% clean (1 unknown row/year), ~$20 API cost not justified for unfunded nonprofit
- Sequential PDF runs for same city share rate limit and disk cache — preferred over parallel for cost control
- Exit code 2 on Plano FY2022 accepted — flagged page was "Budget Assumption Matrix" projection data, not operating budget; main load succeeded

### Blockers / Concerns

- Phase 8 (DQ): Need to audit how many rows per city are currently "Unknown" before deciding re-load strategy
- Phase 10 (COL): ACFRs for Murphy and Princeton (small cities) may not be publicly available in structured PDF form — confirm during 10-01

### Quick Tasks Completed

| # | Description | Date | Commit |
|---|-------------|------|--------|
| 001 | Create treasury tracker entries for every municipality in Collin County, Texas | 2026-05-01 | 9584b2a |

## Session Continuity

Last session: 2026-05-04
Stopped at: Completed 08-03-PLAN.md — Frisco/Plano re-extracted; Phase 8 execution complete; ready for Phase 9
Resume file: None
