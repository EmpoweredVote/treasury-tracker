---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: — Oregon Expansion
status: planning
last_updated: "2026-05-31T14:37:22.551Z"
last_activity: 2026-05-23 — v1.4 milestone archived
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
  percent: 75
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v1.4 COMPLETE — planning v1.5 (next city expansion or feature work)

## Current Position

Phase: 17+ (v1.5 not yet planned)
Plan: Not started
Status: Ready to plan v1.5
Last activity: 2026-05-23 — v1.4 milestone archived

Progress: v1.4 COMPLETE ████████████████████ Phases 1–16 all shipped

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

### Known Tech Debt

- `EntitySwitcher.tsx` `STATE_LABELS`: only covers `{IN: 'Indiana', CA: 'California'}` — TX cities show as "TX" not "Texas" in city picker
- `data_source_id` FK null on some budget rows (SF/SD/LA Rev FY2026) — pre-existing loader pattern, no UI impact
- SD FY2026 absent from source CSV — update `fiscal_years: [2025]` → `[2025, 2026]` in SD data_source rows when SD publishes FY2026 adopted data

### API Cost Threshold

$5 per run — estimate before running AI enrichment or PDF extraction.

## Session Continuity

Last session: 2026-05-31T14:37:22.541Z
Stopped at: Phase 17 context gathered
Resume file: .planning/phases/17-portland-or-budget-load/17-CONTEXT.md
