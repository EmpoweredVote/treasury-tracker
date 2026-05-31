---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Oregon Expansion
status: milestone_complete
last_updated: 2026-05-31T18:24:14.229Z
last_activity: 2026-05-31 -- Phase 17 complete (Portland OR budget load, enrichment, verification)
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 8
  completed_plans: 47
  percent: 100
stopped_at: Milestone complete (Phase 17 was final phase)
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Milestone complete

## Current Position

Phase: 17
Plan: Not started
Status: Milestone complete
Last activity: 2026-05-31

Progress: v1.5 COMPLETE ████████████████████ Phases 1–17 all shipped

## Accumulated Context

### Loaders Available

- `bulkLoadBudget.js` — generic Socrata SODA loader; supports `fiscal_year_type: 'integer'` and `where_extra` WHERE fragment in column_mapping
- `loadSanDiegoCSV.js` — CSV download loader for seshat.datasd.org double-quoted format
- `enrichCategories.js` — AI enrichment pipeline; `--city`, `--state`, `--year` flags; idempotent via name_key upsert
- `bulkLoadXLSX.js` — XLSX check register / payroll loader
- `bulkLoadPDF.js` — Claude Haiku vision PDF pipeline for ACFR budget extraction

### Seeded Cities (active in DB)

- TX (13): Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton
- CA (3): Los Angeles, San Francisco, San Diego
- OR (1): Portland (FY2025+FY2026 operating, 635,749 population, 41 enrichment rows)

### Known Tech Debt

- `data_source_id` FK null on some budget rows (SF/SD/LA Rev FY2026) — pre-existing loader pattern, no UI impact
- SD FY2026 absent from source CSV — update `fiscal_years: [2025]` → `[2025, 2026]` in SD data_source rows when SD publishes FY2026 adopted data
- Portland revenue budget (Vol 2, fund-level) deferred per D-03 — requires a new phase if/when prioritized

### API Cost Threshold

$5 per run — estimate before running AI enrichment or PDF extraction.

## Session Continuity

Last session: 2026-05-31T00:00:00Z
Stopped at: Phase 17 complete — all 4 plans done, 17-VERIFICATION.md filed
Resume file: None (phase 17 complete)
