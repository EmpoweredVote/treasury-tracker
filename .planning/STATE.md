# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v1.3 — Phase 11: Population Schema, Census Data Load, and Per-Capita Display

## Current Position

Phase: 12 of 14 (Prosper & Celina Revenue)
Plan: 1 of 3 complete (12-01 done)
Status: In progress — 12-01 complete, 12-02 and 12-03 pending
Last activity: 2026-05-21 — Completed 12-01: Prosper revenue FY2023/FY2024/FY2025 loaded

Progress: v1.3 ████████░░░░░░░░░░░░ 44% (4/9 plans complete)

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

### Additional Decisions (Phase 12 Plan 01)

- Parse GF Budget-and-Actual statement for Prosper revenue (not all-funds governmental table) — avoids split-page alignment issue
- Expected totals = GF actual from REVENUES header row: FY2023=$23,634,916, FY2024=$20,579,402, FY2025=$23,102,540
- Overflow guard (>105% REVENUES total) blocks garbled continuation lines from adjacent all-funds table
- FY2024/FY2025 yield 5 items (vs FY2023 9) due to two-column PDF layout in those ACFRs — within tolerance
- processProsperjRevenuePDF.js is reference implementation for processCelinaRevenuePDF.js

### Blockers/Concerns

- Phase 12 (Richardson): cor.net blocked HTTP in v1.2 — manual browser URL sourcing required before loader can be built; verify URL is accessible before committing time
- Prosper FY2024/FY2025 only yield 5 of ~10 revenue line items due to two-column PDF layout; 20% tolerance gate passes but detail is partial (not a blocker for display)

### Additional Decisions (Phase 11)

- mcp__supabase-local__apply_migration: use for DDL migrations instead of Supabase Dashboard manual paste — faster, no human gate
- population column is `bigint` in DB (not `integer` as assumed in research) — no impact on loader

## Session Continuity

Last session: 2026-05-21
Stopped at: Phase 12 Plan 01 complete (Prosper revenue FY2023/FY2024/FY2025 loaded)
Resume file: None
