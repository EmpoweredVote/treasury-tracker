---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: California City Expansion
status: planning
last_updated: "2026-06-03T00:00:00.000Z"
last_activity: 2026-06-03
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-03)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Phase 26 — Sacramento CA Data Load

## Current Position

Phase: 26 — Sacramento CA Data Load
Plan: —
Status: Not started — roadmap defined, awaiting first plan
Last activity: 2026-06-03 — v1.6 roadmap created (Phases 26–30)

Progress: [ Phase 26 ] [ Phase 27 ] [ Phase 28 ] [ Phase 29 ] [ Phase 30 ]
          [  pending  ] [  pending  ] [  pending  ] [  pending  ] [  pending  ]

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
- CA (3 + LA County): Los Angeles, San Francisco, San Diego, LA County
- OR (3): Portland (FY2022–FY2026 operating + revenue, 635,749 population, 41 enrichment rows), Gresham (FY2023–FY2026 operating + revenue, 111,507 population, 33 enrichment rows), Troutdale (FY2019–FY2026 operating + revenue, 15,749 population, 26 enrichment rows)

### CA PDF Extraction Notes (from Research)

- Sacramento: `loadSacramentoCSV.js` already exists — fastest phase in milestone; FY label "FY2024/25" → integer 2025
- Oakland: pdfplumber; biennial budget (one PDF = 2 FYs); fund name is "General Purpose Fund" (GPF), NOT "General Fund"
- San Jose: pdfplumber; 400+ page PDFs — use targeted page-range extraction; 100+ funds, enterprise funds (Airport, Wastewater, Water) to filter
- Long Beach: pdfplumber; non-standard FY Oct–Sep; Port of Long Beach (~$760M) is a SEPARATE entity — exclude entirely
- Fresno: pdfplumber; enterprise funds (~$899M) exceed General Fund (~$483M) — apply fund filter
- Riverside: pdfplumber; biennial budget; RPU municipal electric utility — large enterprise fund; do NOT confuse with Riverside County
- Bakersfield: pdfplumber or pdftotext; investigate `budget.bakersfieldcity.us` SODA endpoint first before defaulting to PDF

### Population Source (CA cities)

Census `sub-est2024_06.csv` (SUMLEV=162, California sub-county estimates) — same methodology as TX and OR.

Values (2024 estimates): Sacramento ~536K, Oakland ~444K, San Jose ~997K, Long Beach ~451K, Fresno ~550K, Riverside ~324K, Bakersfield ~417K

### Enrichment Cost Estimate (v1.6)

~315 enrichment calls across 7 cities (7 × ~45 categories avg) ≈ $0.06 total — well under $5 threshold.

### Known Tech Debt (carried from v1.5)

- `data_source_id` FK null on some budget rows (SF/SD/LA Rev FY2026) — pre-existing loader pattern, no UI impact
- SD FY2026 absent from source CSV — update `fiscal_years: [2025]` → `[2025, 2026]` when SD publishes FY2026 adopted data
- Portland revenue budget (Vol 2, fund-level) deferred per D-03 — requires a new phase if/when prioritized
- Phase 07 verification (07-VERIFICATION.md) — human_needed, pre-v1.5, shipped milestone
- Phase 14 verification (14-VERIFICATION.md) — human_needed, pre-v1.5, shipped milestone
- Phase 22 Troutdale app spot-check (22-VERIFICATION.md) — deferred
- Phase 25 LA County app spot-check (25-VERIFICATION.md) — deferred

### API Cost Threshold

$5 per run — estimate before running AI enrichment or PDF extraction.

## Session Continuity

Last session: 2026-06-03
Stopped at: Roadmap defined for v1.6
Resume file: None

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| (v1.6 not started) | - | - | - |

## Decisions

(No v1.6 decisions yet)

## Deferred Items

Items deferred at v1.5 milestone close (2026-06-04):

| Category | Item | Status |
|----------|------|--------|
| verification | Phase 07 (07-VERIFICATION.md) | human_needed — pre-v1.5, shipped milestone |
| verification | Phase 14 (14-VERIFICATION.md) | human_needed — pre-v1.5, shipped milestone |
| verification | Phase 22 (22-VERIFICATION.md) | human_needed — Troutdale app spot-check deferred |
| verification | Phase 25 (25-VERIFICATION.md) | human_needed — LA County app spot-check deferred |
