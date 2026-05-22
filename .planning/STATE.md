# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v1.3 complete — ready for milestone audit

## Current Position

Phase: 15 of 15 (Los Angeles Socrata Budget Load + Enrichment)
Plan: 1 of 3 in current phase
Status: In progress — Plan 15-01 complete (LA municipality + data_sources seeded)
Last activity: 2026-05-22 — Completed 15-01-PLAN.md (seed LA data sources)

Progress: v1.4 ████░░░░░░░░░░░░░░░░ 33% (1/3 plans complete in phase 15)

## Accumulated Context

### Key Technical Decisions Carried Forward

- `bulkLoadPDF.js`: max_tokens=8192; stop_reason guard; section_heading cross-page context; datasetType param in buildExtractionPrompt
- Future Prosper/Celina revenue path: pdftotext targeting "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES" section (processRevenuePDF.js pattern)
- pdftotext-parser pattern: processLongviewBudget.js / processGarlandBudget.js as reference implementations
- Richardson TX: cor.net blocks HTTP; manually browse https://www.cor.net/departments/budget to get PDF URL
- Population schema decision: Path A (add `population_year` column to existing `municipalities` table) — zero frontend changes, one migration, valid for v1.3
- Census source: `sub-est2024_48.csv` (TX vintage 2024), filter `SUMLEV === '162'`, use `POPESTIMATE2024` column — unauthenticated download, no API key
- Name normalization required: Census names include suffixes ("Prosper town", "Celina city") — must strip before matching to municipalities.name
- Per-capita restricted to most recent FY for v1.3 — one population vintage across FY2018-FY2026 creates false trends for fast-growing cities
- Cost gating rule: estimate API cost before running; stop and get approval if >$5

### Seeded Infrastructure (ready for v1.3)

- Prosper Revenue FY2023/FY2024/FY2025 data_source rows (last_synced_at=null)
- Celina Revenue FY2025 data_source row (id=0e2e54c5, last_synced_at=null)
- Richardson Operating Budget FY2025/FY2026 placeholder data_source rows (placeholder URLs)

### Additional Decisions (Phase 12 Plans 01 and 03)

- Prosper revenue now captures ALL governmental fund B&A schedules (not just GF) — expected totals: FY2023=$83,186,603, FY2024=$101,863,293, FY2025=$108,416,768
- Capital Projects Fund (no annual B&A) is derived as: all-funds total − sum of B&A fund actuals
- extractAllFundsTotal: prefer FIRST 2-column row over 3-column candidates — avoids expenditure totals that appear later with higher values
- FY2023 ACFR: Impact Fees / Debt Service / Parks Dedication / TIRZ 1 missing from B&A section detection (REVENUES header has no $ on same line); lumped into Capital Projects derived remainder
- Overflow guard (>105% REVENUES total) blocks garbled continuation lines from adjacent all-funds table
- Celina wide-table: position-based column detection (Total Governmental column at char pos >= 130); sanity check rejects total < GF
- Celina GF actuals sum exactly to $68,888,029 (exact ACFR match); adopted_amount (total gov) has 8% over-estimate for ~3 rows with misaligned continuation
- budget_categories table stores line items (not budgets.hierarchy which is always empty); RPC rows_inserted = budget_categories rows

### Additional Decisions (Phase 14)

- enrichCategories.js: run --dry-run first, then live sequentially (no --force); idempotent — avoids re-billing API calls on re-run
- dark:text-ev-gray-300 fix applied to App.tsx category description paragraph (ev-gray-600 fails contrast on dark bg)
- enrichCategories.js: always specify --year flag for non-2025 fiscal years (Sachse FY2026, Princeton FY2026 need --year 2026)
- Sachse had 19 depth-0 categories (not ~9 estimated) — actual city budget has more granular dept structure; all enriched correctly

### Additional Decisions (Phase 13)

- Richardson XLSX uses 4 distinct formats across years — dispatched via FY_CONFIG.format key
- Old format (FY2018-2022): Fund column is integer 11, uses Total DEPTNAME aggregated rows
- New formats (FY2024+): account prefix 0110- filters GF; -767- account codes are transfers-out (excluded)
- FY2023 unavailable from city — gap in series is expected
- actual_amount populated from prior-year actuals column where available in sheet

### Blockers/Concerns

- Prosper FY2024/FY2025 only yield 5 of ~10 revenue line items due to two-column PDF layout; 20% tolerance gate passes but detail is partial (not a blocker for display)

### Additional Decisions (Phase 11)

- mcp__supabase-local__apply_migration: use for DDL migrations instead of Supabase Dashboard manual paste — faster, no human gate
- population column is `bigint` in DB (not `integer` as assumed in research) — no impact on loader

### Additional Decisions (Phase 15 Plan 01)

- LA pre-existing row 'LA City Budget & Expenditures' renamed to 'Los Angeles Operating Budget' via fallback upsert by dataset_id+municipality_id — id=01c50191 preserved
- LA municipality id: 391bf791-1c1f-424f-a7a5-1b698c79093f
- LA data_sources id: 01c50191-831e-4c88-82ef-e62a2e200e2b
- Revenue dataset 6cbx-e2fd intentionally excluded — only through FY2022, summary-level only
- base_url must be controllerdata.lacity.org (NOT data.lacity.org) — two separate Socrata portals

### Roadmap Evolution

- Phase 15 added: Los Angeles Socrata budget load + enrichment (extends Socrata pipeline from Phase 5 + enrichment from Phase 14 to LA)

## Session Continuity

Last session: 2026-05-22
Stopped at: Completed 15-01-PLAN.md (seed LA data sources)
Resume file: None
