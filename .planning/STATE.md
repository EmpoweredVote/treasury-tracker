# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v1.4 COMPLETE — Phase 16 (SF, SD, LA Revenue) shipped 2026-05-22; next: Phase 17 expansion (Long Beach, San Jose, Sacramento, or first non-CA city)

## Current Position

Phase: 16 of 16+ (Phase 16 COMPLETE)
Plan: 5 of 5 complete
Status: Phase 16 COMPLETE — v1.4 milestone complete
Last activity: 2026-05-22 — Completed 16-05-PLAN.md (CA cities enrichment + human verification)

Progress: v1.4 ████████████████████ Phase 15 100% — Phase 16 █████ 5/5 plans complete

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

### Additional Decisions (Phase 16 Plan 05)

- SF: 53 enrichment rows (municipality_id=a98fa397-e459-4a9b-b37c-214d6af275b6), FY2025+FY2026 operating+revenue covered
- SD: 61 enrichment rows (municipality_id=1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2), FY2025 only (FY2026 absent in source CSV)
- LA Revenue enrichment: no-op — all LA revenue department names matched existing Phase 15-03 enrichment via name_key deduplication; 70 Phase 15-03 rows preserved, 0 new rows added
- Total Phase 16 enrichment API cost: ~$0.43 (well under $5 threshold; ~60% above $0.27 RESEARCH.md estimate due to more distinct category names)
- No --year 2026 follow-up runs needed — Step E confirmed 0 unenriched depth-0 categories across all 3 cities × 2 fiscal years
- Human verification approved at treasurytracker.empowered.vote on 2026-05-22 — SF and SD visible in city picker, all descriptions present, per-capita labeled "2024 Census estimate"

### Additional Decisions (Phase 16 Plan 04)

- treasury.budgets: 8 new CA rows loaded — SF (op+rev FY2025/FY2026), SD (op+rev FY2025), LA Revenue (FY2025/FY2026)
- SD FY2026 confirmed absent — empty budget_cycle in live CSV; Plan 16-05 enriches SD FY2025 only
- LA Operating FY2026 category_rows is 519 (vs 442 in Phase 15-02) — total_budget exact, drift is pre-existing (not caused by Plan 16-04 LA Revenue loads)
- Supabase execute_sql RPC not available — use supabase.schema('treasury').from(...) with count:exact for DB verification
- New budget_ids for Plan 16-05: SF Op 2025=58049b08, SF Op 2026=d308f4e1, SF Rev 2025=55ef294b, SF Rev 2026=efa6c216, SD Op 2025=fbe493a3, SD Rev 2025=9a2389a8, LA Rev 2025=89bf4c59, LA Rev 2026=0424364d

### Additional Decisions (Phase 16 Plan 03)

- seedCaliforniaCities.js: dataset_id+municipality_id fallback lookup REMOVED — SF Op + SF Rev share xdgd-c79v + SF muni_id, SD Op + Rev share budget_operating_datasd + SD muni_id; fallback would collide. Primary name lookup sufficient for Phase 16 (no pre-existing rows to rename).
- SF municipality id: a98fa397-e459-4a9b-b37c-214d6af275b6 (pop=827526, year=2024)
- SD municipality id: 1ee32637-1f2e-4a91-a7c1-1cd976dd4aa2 (pop=1404452, year=2024)
- SF Operating data_source id: 86ba2211-8730-4d60-b265-869e22902e48
- SF Revenue data_source id: 663ca6af-509c-4b44-a964-7df0da3446af
- SD Operating data_source id: 5548ecff-4197-483d-a324-cec466ce524f
- SD Revenue data_source id: fa69d8ed-20a6-4a5b-bde8-0224542534c9
- LA Revenue data_source id: 993fdef9-9270-4d71-9a8c-b1a4dfaf9c39

### Additional Decisions (Phase 16 Plan 02)

- SD CSV (seshat.datasd.org) is fully double-quoted — all fields including headers are wrapped in `"..."`. Quote-aware parseCSV() in loadSanDiegoCSV.js handles this; naive split(',') does not.
- FY26 budget_cycle is BLANK in the live SD CSV (not 'proposed' or 'adopted'). FY25 correctly has 'adopted'/'proposed'. Plan 16-03 MUST use fiscal_years=[2025] only until SD labels FY26 rows.
- SD CSV total: 548,811 rows, FY2011–FY2026. FY25 adopted: 33,436 rows (1,098 revenue 4xxxxx + 32,338 operating 5xxxxx).
- loadSanDiegoCSV.js filters to api_type='csv_download' sources — bulkLoadBudget.js uses api_type='socrata'. The two loaders are mutually exclusive by api_type.

### Additional Decisions (Phase 16 Plan 01)

- where_extra caller supplies the leading AND — more flexible (allows OR, parentheses); matches column_mapping per-dataset contract
- fiscal_year_type defaults to 'string' (backward-compatible); only 'integer' triggers unquoted branch
- Store where_extra as raw unencoded string in column_mapping — URLSearchParams encodes it automatically in fetchSocrataPage
- No new CLI flags — these are column_mapping runtime keys, not operator options

### Additional Decisions (Phase 15 Plan 01)

- LA pre-existing row 'LA City Budget & Expenditures' renamed to 'Los Angeles Operating Budget' via fallback upsert by dataset_id+municipality_id — id=01c50191 preserved
- LA municipality id: 391bf791-1c1f-424f-a7a5-1b698c79093f
- LA data_sources id: 01c50191-831e-4c88-82ef-e62a2e200e2b
- Revenue dataset 6cbx-e2fd intentionally excluded — only through FY2022, summary-level only
- base_url must be controllerdata.lacity.org (NOT data.lacity.org) — two separate Socrata portals

### Additional Decisions (Phase 15 Plan 02)

- treasury.budgets column is `total_budget` (NOT `total_amount`) — plan SQL templates reference wrong column name; actual data verified correctly
- treasury_sync_budget_tree RPC matches budget rows by municipality_id+fiscal_year+dataset_type (not data_source_id); pre-existing LA rows updated in-place
- LA FY2025 budget_id: 5a85c4a6-456f-49ba-af63-771dd0dde3a5 (total_budget=$19,855,424,569)
- LA FY2026 budget_id: c24fec94-e886-4c47-ab1d-2cd7a505c4d1 (total_budget=$21,431,295,120)
- 58 depth-0 categories for FY2025, 56 for FY2026 — ready for enrichCategories.js
- Socrata counts matched RESEARCH.md exactly: FY2025=3,786 rows, FY2026=3,306 rows

### Roadmap Evolution

- Phase 15 added: Los Angeles Socrata budget load + enrichment (extends Socrata pipeline from Phase 5 + enrichment from Phase 14 to LA)

## Session Continuity

Last session: 2026-05-22
Stopped at: Completed 16-05-PLAN.md (CA cities enrichment + human verification — Phase 16 COMPLETE)
Resume file: None
