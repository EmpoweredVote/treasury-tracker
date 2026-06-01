---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Oregon Expansion
status: executing
last_updated: "2026-06-01T19:00:00.000Z"
last_activity: 2026-06-01 -- Phase 21 Plan 02 complete (Gresham revenue load fully verified)
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
  percent: 50
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Milestone complete

## Current Position

Phase: 21 COMPLETE
Plan: 2 of 2 complete
Status: Phase 21 complete; Phase 22 (Troutdale OR Budget Load) is next
Last activity: 2026-06-01 -- Phase 21 Plan 02 complete (Gresham revenue load fully verified)

Progress: [█████████░] 90%

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
- OR (2): Portland (FY2022–FY2026 operating + revenue, 635,749 population, 41 enrichment rows), Gresham (FY2023–FY2026 operating + revenue, 111,507 population, 33 enrichment rows — 23 operating + 10 revenue)

### Known Tech Debt

- `data_source_id` FK null on some budget rows (SF/SD/LA Rev FY2026) — pre-existing loader pattern, no UI impact
- SD FY2026 absent from source CSV — update `fiscal_years: [2025]` → `[2025, 2026]` in SD data_source rows when SD publishes FY2026 adopted data
- Portland revenue budget (Vol 2, fund-level) deferred per D-03 — requires a new phase if/when prioritized

### Decisions (Phase 21 Plan 01)

- Revenue section detection uses `s.startswith('Resources ')` fallback — FY2024-2026 PDFs have "Resources Proposed Approved Adopted" on one line, not standalone "Resources"
- OCR split-number fix: `r'^\d{1,3},'` condition (handles FY2023 `N,NNN,NNN` splits like `2 0,175,800`)
- NORMALIZE dict covers 3 FY2023 name variants: Internal Service Charges, Li censes & Permits, In ternal Payments
- SANITY_MAX gated on operating mode — revenue FY2026 ~$512M legitimately exceeds $500M cap

### Decisions (Phase 21 Plan 02)

- Enrichment decision RUN: 4 of 10 revenue categories opaque to non-finance citizens ("Internal Svc Chrg", "Financing Proceeds", "Interfund Transfers", "Utility License Fees") — ~$0.01 cost, well under $5 threshold
- UI auto-discovery confirmed: no frontend changes needed — App.tsx available_datasets pattern auto-shows Money In tab for dataset_type='revenue' rows

### API Cost Threshold

$5 per run — estimate before running AI enrichment or PDF extraction.

## Session Continuity

Last session: 2026-06-01T19:00:00.000Z
Stopped at: Phase 21 complete (Plan 02 done); Phase 22 (Troutdale OR Budget Load) is next
Resume file: None
