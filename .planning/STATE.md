# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-01)

**Core value:** Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Milestone v1.1 complete — all requirements done; ready for audit or v1.2 planning

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Milestone v1.2 started — defining requirements
Last activity: 2026-05-03 — Milestone v1.2 Collin County Completion & Data Quality initialized

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

### Decisions (Phase 7 Plan 01)
- pdftoimg-js v2 exports `pdfToImg` (not `convertPDF`) — use `pdfToImg(Uint8Array, { pages: 'all', imgType: 'png', scale: 2.08 })`
- pdfToImg returns base64 DataURL strings (not Buffer/path arrays) — strip `data:image/png;base64,` prefix before writing PNG
- pdftoimg-js v2 has no concurrency parameter — RENDER_CONCURRENCY=2 is for a chunked approach if OOM occurs on 200+ page PDFs
- Scale 2.08 ≈ 150 DPI (from 72 DPI PDF baseline); Celina pages ~3MB each — sufficient for Haiku extraction
- Cache key: SHA-256 of full PDF buffer → `cache/pdf-render/<hex>/page-NNN.png` (3-digit zero-padded)
- pdfjs font warning "TT: undefined function: 32" is benign — rendering unaffected
- @napi-rs/canvas loads correctly on Windows + Node 24 (pre-built win32-x64-msvc binary, no node-gyp)

### Decisions (Phase 7 Plan 03)
- `p_triggered_by` must be `'bulk_load'` (not `'pdf_haiku_load'`) — `sync_logs_triggered_by_check` DB constraint accepts: webhook, manual, bulk_load
- Exit code 2 (JSON truncation on dense statistical ACFR pages) is accepted disposition — these are not operating budget pages
- `data_source_id` in `treasury.budgets` is NULL by design — `treasury_sync_budget_tree` keys on (municipality_id, fiscal_year, dataset_type)
- RPC errors surface inside `data.error` payload (not PostgREST top-level) — defensive check added to bulkLoadPDF.js

### Decisions (Phase 7 Plan 02)
- EXTRACTION_PROMPT verbatim from research — classify page_type first, extract rows from budget_table pages only
- maxRetries: 0 on Anthropic client — manual retry loop (3 attempts, 1s/2s/4s + jitter)
- malformed Haiku JSON → confidence=0 flagged page (not retry) — schema violations are not transient
- haikuFatal flag accumulates null returns; pipeline continues to maximize data recovery
- Ad-hoc --pdf mode requires --dry-run until Plan 03 seeder creates data_sources row
- Windows Node 24 fix: await setTimeout(50ms) before process.exit on --list to prevent libuv UV_HANDLE_CLOSING assertion

### Blockers / Concerns
- `treasury_sync_budget` (bare, without _tree) does not exist — confirmed; always use `treasury_sync_budget_tree`
- "Unknown" department dominance in PDF-extracted budgets — ACFR section headings not tracked across pages; v1.2 improvement opportunity
- JSON truncation on dense statistical pages causes exit code 2 on all PDF loads — accepted disposition; fix deferred to v1.2 (chunked extraction or higher max_tokens)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Create treasury tracker entries for every municipality in Collin County, Texas | 2026-05-01 | 9584b2a | [001-create-treasury-tracker-entries-for-ever](./quick/001-create-treasury-tracker-entries-for-ever/) |

## Session Continuity

Last session: 2026-05-02
Stopped at: Completed 07-03-PLAN.md — Allen/Prosper/Celina FY2025 ACFR data loaded and operator-verified; Phase 7 complete
Resume file: None
