# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Milestone v1.1 — Texas Municipal Financial Transparency (Phase 7: PDF/Haiku Vision Pipeline)

## Current Position

Phase: 7 of 7 (PDF/Haiku Vision Pipeline)
Plan: 0 of 4 complete
Status: Not started
Last activity: 2026-05-01 — Completed Phase 6 XLSX Pipeline (all 3 plans done, 506,580 rows loaded)

Progress: ███████████████░  (15/19 plans complete — v1.0 done, Phases 5-6 all 6 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 9 (v1.0)
- Average duration: ~30 min/plan (estimated)
- Total execution time: ~4.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 Donate Button | 1/1 | — | — |
| 2 Data Layer Audit | 1/1 | — | — |
| 3 Webhook Backend | 5/5 | — | — |
| 4 Live Feedback UI | 2/2 | — | — |

*Updated after each plan completion*

## Accumulated Context

### Decisions (v1.1 relevant)
- Dallas municipality_id: `17ce5baf-277d-41c9-a3f6-2e44f9def106` (confirmed via quick task 001)
- `bulkLoadBudget.js` follows `bulkLoadTransactions.js` pattern — column_mapping in data_sources, no hardcoded city logic
- PDF extraction model: `claude-haiku-4-5-20251001` — cost-effective for high-volume page processing
- PDF pipeline validates: Transparent Motivations project uses identical PDF → PNG → Haiku approach
- XLSX dedup: `source_row_id` from row hash preferred over position+date
- `treasury.data_sources` has NO unique constraint on `name` — only PK (id) is unique; idempotent seeding requires select-by-name then insert/update pattern
- Dallas Operating Budget data_sources id: `443a5578-568c-4684-8d47-43ef5f10e773` (dataset e2fs-y4nb)
- Dallas Revenue Budget data_sources id: `493449a0-d4fd-43aa-b989-71f758edf2e6` (dataset rtn4-pmj9)
- `treasury_sync_budget_tree` is the correct RPC (bare `treasury_sync_budget` does not exist)
- Socrata fiscal year fields are strings — WHERE clause must quote: `bfy='2025'` not `bfy=2025`
- `bulkLoadBudget.js` verified: Dallas Operating FY2025 = 1,062 rows / $4.38B; Dallas Revenue FY2025 = 853 rows / $4.13B
- XLSX loader uses exceljs@4.4.0 (NOT xlsx/SheetJS — CVE-2023-30533); ExcelJS row.values.slice(1) required (1-indexed)
- XLSX dedup: SHA-256 of full row with sorted keys as `rid` — deterministic across re-downloads
- XLSX data_sources: one row per city+dataset+FY; fiscal year stored as `fiscal_years:[YYYY]` array; URL stored in `base_url`
- XLSX data_sources unique constraint: `(municipality_id, api_type, COALESCE(dataset_id,''), dataset_type)` — set `dataset_id='fyYYYY'` per row
- Frisco XLSX headers at row 5 (header_row:5 in column_mapping); McKinney payroll employee names redacted (employee_number used as vendor)
- Plano uses manual export (file:// URL in base_url, column_mapping TBD — inspect headers after download)

### Blockers / Concerns
- `treasury_sync_budget` (bare, without _tree) does not exist — confirmed; always use `treasury_sync_budget_tree`
- PDF rendering library not yet chosen — needs Node/system capability check before Phase 7

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Create treasury tracker entries for every municipality in Collin County, Texas | 2026-05-01 | 9584b2a | [001-create-treasury-tracker-entries-for-ever](./quick/001-create-treasury-tracker-entries-for-ever/) |

## Session Continuity

Last session: 2026-05-01
Stopped at: Phase 6 complete — XLSX pipeline shipped, McKinney + Frisco visible in app; Phase 7 (PDF/Haiku) is next
Resume file: None
