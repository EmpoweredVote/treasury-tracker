# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v1.3 — Phase 11: Population Schema, Census Data Load, and Per-Capita Display

## Current Position

Phase: 11 of 14 (Population & Per-Capita)
Plan: None — ready to plan
Status: Roadmap created (2026-05-21); ready to plan Phase 11
Last activity: 2026-05-21 — v1.3 roadmap created (phases 11-14 defined)

Progress: v1.3 ░░░░░░░░░░░░░░░░░░░░ 0% (0/9 plans complete)

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

### Blockers/Concerns

- Phase 12 (Richardson): cor.net blocked HTTP in v1.2 — manual browser URL sourcing required before loader can be built; verify URL is accessible before committing time
- Phase 12 (Revenue): pdftotext extraction quality for Prosper/Celina revenue unknown until attempted — validate against ACFR before enabling display

## Session Continuity

Last session: 2026-05-21
Stopped at: v1.3 roadmap created; phases 11-14 defined and written to ROADMAP.md
Resume file: None — run `/gsd:plan-phase 11` to begin
