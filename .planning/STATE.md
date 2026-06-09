---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: California State Budget + Deep Icicles
status: executing
last_updated: "2026-06-09T15:37:24.730Z"
last_activity: 2026-06-09 -- Phase 36 planning complete
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 15
  completed_plans: 11
  percent: 73
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-06)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Phase 36 — selective city retrofit

## Current Position

Phase: 36
Plan: Not started
Status: Ready to execute
Last activity: 2026-06-09 -- Phase 36 planning complete

```
Progress: [██████████] 100%
```

## Phase Overview

| Phase | Name | Depends on | Status |
|-------|------|------------|--------|
| 32 | State Entity Infrastructure | nothing | Complete (2026-06-07) |
| 33 | CA State Budget Data | Phase 32 | Complete (2026-06-07) |
| 34 | 3-Level Tree Infrastructure (ev-accounts-api) | Phase 32 | Ready to plan |
| 35 | CA State 3-Level Icicle Pilot | Phases 33 + 34 | Not started |
| 36 | Selective City Retrofit | Phase 35 | Not started |

**Critical path:** Phase 32 → Phase 34 → Phase 35
**Parallel opportunity:** Phase 33 and Phase 34 can run simultaneously after Phase 32 (different repos, no file overlap)

## Accumulated Context

### Loaders Available

- `bulkLoadBudget.js` — generic Socrata SODA loader; supports `fiscal_year_type: 'integer'` and `where_extra` WHERE fragment in column_mapping
- `loadSacramentoCSV.js` — ArcGIS CSV loader for Sacramento; already written, seed + run
- `loadSanDiegoCSV.js` — CSV download loader for seshat.datasd.org double-quoted format
- `enrichCategories.js` — AI enrichment pipeline; `--city`, `--state`, `--year` flags; idempotent via name_key upsert
- `bulkLoadXLSX.js` — XLSX check register / payroll loader
- `bulkLoadPDF.js` — Claude Haiku vision PDF pipeline for ACFR budget extraction
- pdfplumber Python extractor — used for Portland, Gresham, Troutdale OR; primary tool for CA PDF cities

### Seeded Cities (active in DB)

- TX (14): Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton, Longview
- CA (12 + LA County): Los Angeles, San Francisco, San Diego, Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana, LA County
- OR (3): Portland (FY2022–FY2026 operating + revenue, 635,749 population, 41 enrichment rows), Gresham (FY2023–FY2026 operating + revenue, 111,507 population, 33 enrichment rows), Troutdale (FY2019–FY2026 operating + revenue, 15,749 population, 26 enrichment rows)

### v1.7 Architecture Notes

**CA State data source — NO Socrata API:**

- Primary: LAO historical Excel (openpyxl, FY1985–FY2026, machine-readable) — HIGH confidence
- Fallback: ebudget.ca.gov Enacted Budget Summary PDF (pdfplumber) — MEDIUM confidence
- Do NOT use Open FISCal CKAN (151 department CSVs per FY, disproportionate engineering cost)
- Load General Fund only (~$212B FY2025-26) — all-funds (~$495B) inflates by $280B+ federal pass-through

**3-Level tree shape (new):**

- Current 2-level: `{ n, a, c: [{ n, a, i: [...] }] }` — category → items
- New 3-level: `{ n, a, c: [{ n, a, c: [{ n, a, i: [...] }] }] }` — program → dept → items
- RPC must walk adaptively: branch nodes have `c`, leaf nodes have `i`, never both
- Backward compat: `department IS NULL` in DB → 2-level response from categories API

**Phase 34 is in ev-accounts-api repo (separate repo):**

- Must locate `treasury_sync_budget_tree` RPC function body before writing code
- Must run `SELECT category, subcategory, department FROM treasury.budget_line_items LIMIT 20` before writing RPC update — department column current state is unconfirmed

**EntitySwitcher circular nesting risk:**

- A CA state entity defaults to nested under "CALIFORNIA" header — creates "California > States > California" loop
- Fix: pre-filter state entities before building the byState map; render as separate top section

**Enrichment prompt for state entities:**

- Default `enrichCategories.js` prompt uses city-level framing — wrong for CA state program areas
- Must add `--entity-type state` flag or equivalent to switch to policy/program framing

**Frontend is unchanged in v1.7:**

- `BudgetIcicle.tsx` already renders arbitrary depth via `navigationPath` — no changes needed
- `App.tsx`, `dataLoader.ts`, `BudgetCategory` recursive type — all unchanged
- Only data shape and API response change; icicle rendering is depth-agnostic

### Retrofit Candidate Guidance

Source data audit required before any loader work in Phase 36. Target cities most likely to have genuine dept/subdept structure:

- Portland OR (bureaus → programs → activities) — likely candidate
- San Francisco (departments → programs) — may have genuine 3rd level in Socrata
- Dallas (departments → divisions) — check Socrata column set

Only retrofit where source has a natural 3rd level. Do not synthesize.

### Population Source (CA state)

~39,500,000 (2024 Census estimate, California total resident population)

### API Cost Threshold

$5 per run — estimate before running AI enrichment or PDF extraction. CA state enrichment: ~50-60 program categories × $0.0002/call ≈ $0.01–0.02 total.

### Known Tech Debt (carried from v1.6)

- `data_source_id` FK null on some budget rows (SF/SD/LA Rev FY2026) — pre-existing loader pattern, no UI impact
- SD FY2026 absent from source CSV — update `fiscal_years: [2025]` → `[2025, 2026]` when SD publishes FY2026 adopted data
- Portland revenue budget (Vol 2, fund-level) deferred per D-03 — requires a new phase if/when prioritized
- Phase 07 verification (07-VERIFICATION.md) — human_needed, pre-v1.5, shipped milestone
- Phase 14 verification (14-VERIFICATION.md) — human_needed, pre-v1.5, shipped milestone
- Phase 22 Troutdale app spot-check (22-VERIFICATION.md) — deferred
- Phase 25 LA County app spot-check (25-VERIFICATION.md) — deferred
- Oakland revenue (OpenGov embedded chart format — not extractable via pdfplumber) — deferred from v1.6
- Fresno + Riverside revenue (no extractable GF revenue section in PDFs) — deferred from v1.6
- San Jose FY2016–2020 (older PDF format) — deferred from v1.6

## Session Continuity

Last session: 2026-06-09T14:44:36.084Z
Stopped at: Phase 36 context gathered
Resume file: .planning/phases/36-selective-city-retrofit/36-CONTEXT.md

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 32 | 4 plans | ~60m | DB migration, TS types, EntitySwitcher UI |
| Phase 33 P01 | 15m | 2 tasks | CA state seed + LAO Excel download |
| Phase 33 P02 | 25m | 2 tasks | extractCA.py + processCA.js, FY2022-2026 loaded |
| Phase 33 P03 | 15m | 2 tasks | enrichCategories.js state case + CA FY2026 enrichment |
| Bonus | — | ~4 sessions | All 50 US states: processXX.js + processXXRevenue.js for every state |
| Phase 35 P03 | 45 | 3 tasks | 3 files |

## Decisions

| Decision | Context |
|----------|---------|
| All 50 US states loaded (bonus) | state budget scripts written + run for all 50 states; data in DB as foundation for future state icicle views |
| No Agent/Workflow tool for state loading | StructuredOutput failures + $5-15 API cost per failed run; all work done directly in main conversation |
| No income tax states: omit category | WA TN WY SD AK FL TX NV — income tax category omitted from revenue scripts |
| No sales tax states: omit category | MT DE AK OR NH — sales tax category omitted from revenue scripts |
| AK: use Unrestricted General Fund | Oil Production Tax + PF Earnings Transfer are dominant revenue categories |
| VT: K-12 via Education Fund not GF | GF is small (~$2.5-2.7B); no K-12 Education spending category in GF |
| All state data: confidence = 'estimated' | Web-researched figures; mark all with confidence: 'estimated' |

## Deferred Items

Items deferred at v1.6 milestone close (2026-06-06):

| Category | Item | Status |
|----------|------|--------|
| verification | Phase 07 (07-VERIFICATION.md) | human_needed — pre-v1.5, shipped milestone |
| verification | Phase 14 (14-VERIFICATION.md) | human_needed — pre-v1.5, shipped milestone |
| verification | Phase 22 (22-VERIFICATION.md) | human_needed — Troutdale app spot-check deferred |
| verification | Phase 25 (25-VERIFICATION.md) | human_needed — LA County app spot-check deferred |
| data | Oakland revenue | OpenGov embedded chart format — not extractable via pdfplumber |
| data | Fresno + Riverside revenue | No extractable GF revenue section in PDFs |
| data | San Jose FY2016–2020 | Older PDF format — requires investigation |
