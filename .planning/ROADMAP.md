# Roadmap — Treasury Tracker / Empowered Vote Financials

## Milestones

- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — Phases 1-4 (shipped 2026-04-22)
- ✅ **v1.1 Texas Municipal Financial Transparency** — Phases 5-7 (shipped 2026-05-02)
- ✅ **v1.2 Collin County Completion & Data Quality** — Phases 8-10 (shipped 2026-05-21)
- 🚧 **v1.3 Revenue Completion & Per-Capita Context** — Phases 11-14 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 GiveButter Real-Time Donation Feedback (Phases 1-4) — SHIPPED 2026-04-22</summary>

### Phase 1: Donate Button (COMPLETE)

**Goal:** Donate button visible on financials.empowered.vote, opens GiveButter campaign in new tab.
**Status:** Shipped (pre-GSD)

Plans:
- [x] Phase 1 complete (pre-GSD planning)

### Phase 2: Data Layer Audit (COMPLETE)

**Goal:** Confirm how the frontend reads financial data and define the exact atomic update contract for the webhook backend.
**Status:** Complete — 2026-04-21

Plans:
- [x] 02-01-PLAN.md — Audit pre-aggregation pattern + produce Phase 3 technical contract

### Phase 3: Webhook Backend (COMPLETE)

**Goal:** Build the GiveButter → Supabase Edge Function → Postgres RPC pipeline that atomically writes donation events and updates pre-aggregated budget totals.
**Status:** Complete — 2026-04-22

Plans:
- [x] 03-01-PLAN.md — Schema migration: add external_id + source columns + dedup index
- [x] 03-02-PLAN.md — Postgres RPC function: treasury.record_givebutter_donation
- [x] 03-03-PLAN.md — loadEVFinances.js: source tagging + webhook row preservation
- [x] 03-04-PLAN.md — Edge Function: create + deploy givebutter-webhook
- [x] 03-05-PLAN.md — Go-live: register webhook + $1 test + validate all three criteria

### Phase 4: Live Feedback UI (COMPLETE)

**Goal:** Add window focus listener and animated counter on financials.empowered.vote to re-fetch and display updated revenue when donor returns from GiveButter.
**Status:** Complete — 2026-04-22

Plans:
- [x] 04-01-PLAN.md — useAnimatedCounter hook + visibilitychange → silent revenue refetch in App.tsx
- [x] 04-02-PLAN.md — Wire animated count-up + green-glow settle into PlainLanguageSummary and DatasetTabs revenue displays

</details>

---

<details>
<summary>✅ v1.1 Texas Municipal Financial Transparency (Phases 5-7) — SHIPPED 2026-05-02</summary>

### Phase 5: Dallas Socrata Integration (COMPLETE — 2026-05-01)

**Goal:** Citizens can view Dallas operating and revenue budget data in the app, loaded via a generic Socrata SODA pipeline reusable for any future city.

**Depends on:** Phase 4 (existing treasury schema and app infrastructure)

**Requirements:** DAL-01, DAL-02, DAL-03, DAL-04, DAL-05, DAL-06

**Success Criteria** (what must be TRUE when phase completes):
1. Dallas operating budget FY2025 and FY2026 are visible in the app with correct category breakdowns and dollar amounts
2. Dallas revenue budget FY2025 and FY2026 are visible in the app with correct department/source hierarchy
3. `bulkLoadBudget.js` can be pointed at any Socrata city by changing only the `data_sources` row — no code changes required
4. Re-running the loader does not create duplicate budget rows (idempotent via upsert or truncate-reload strategy)
5. `data_sources` rows exist for both Dallas datasets with correct `api_type`, dataset IDs, and column mapping JSON

Plans:
- [x] 05-01-PLAN.md — Idempotent seeder for Dallas operating + revenue `data_sources` rows
- [x] 05-02-PLAN.md — Generic Socrata budget loader (`bulkLoadBudget.js`) calling `treasury_sync_budget_tree`
- [x] 05-03-PLAN.md — Live load Dallas FY2025 + FY2026 operating + revenue, verify in app + idempotency

### Phase 6: XLSX Pipeline (COMPLETE — 2026-05-01)

**Goal:** Citizens can view check register and payroll data for Plano, McKinney, and Frisco, loaded via a generic XLSX download pipeline that is idempotent and reusable for any city with an Excel export.

**Depends on:** Phase 5 (established loader patterns and data_sources schema conventions)

**Requirements:** XLSX-01, XLSX-02, XLSX-03, XLSX-04, XLSX-05, XLSX-06, XLSX-07

**Success Criteria** (what must be TRUE when phase completes):
1. Plano, McKinney, and Frisco each have at least one loaded dataset visible in the app (check register transactions)
2. McKinney payroll data is loaded and visible under a `salaries` dataset type
3. Re-running `bulkLoadXLSX.js` against any of these cities does not create duplicate rows
4. `data_sources` rows exist for all XLSX sources with `api_type = 'xlsx_download'`, download URL, and column mapping
5. The loader accepts only a city config (data_sources row) — no city-specific code branches

Plans:
- [x] 06-01-PLAN.md — Build generic bulkLoadXLSX.js (download, parse, SHA-256 dedup, treasury_sync_transactions RPC)
- [x] 06-02-PLAN.md — Investigate sources + idempotent seedXLSXDataSources.js for Plano, McKinney (transactions + payroll), Frisco
- [x] 06-03-PLAN.md — Live load all seeded sources, verify idempotency + force-reload, confirm data visible in app

### Phase 7: PDF/Haiku Vision Pipeline (COMPLETE — 2026-05-02)

**Goal:** Citizens can view budget data for Allen, Prosper, and Celina, extracted from ACFR PDFs using a Claude Haiku vision pipeline that surfaces extraction confidence and flags uncertain pages for human review.

**Depends on:** Phase 6 (loader conventions established; XLSX phase confirms treasury schema handles multiple city types)

**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, PDF-08

**Success Criteria** (what must be TRUE when phase completes):
1. Allen, Prosper, and Celina each have at least one fiscal year of budget data visible in the app, sourced from their ACFR PDFs
2. Running the pipeline against a new PDF (any of the three cities) completes without manual intervention for well-formed ACFR pages
3. Low-confidence pages produce a flagged entry in the review log rather than silently corrupting or skipping data
4. The pipeline accepts `--city`, `--pdf`, and `--fiscal-year` parameters and requires no code changes to run against a new city's ACFR
5. Extracted JSON is validated against the expected schema before loading — malformed Haiku output is rejected with a clear error, not silently written

Plans:
- [x] 07-01-PLAN.md — PDF rendering foundation: install pdftoimg-js + @napi-rs/canvas, scaffold bulkLoadPDF.js, render PDF pages to PNG with SHA-256-keyed disk cache
- [x] 07-02-PLAN.md — Haiku vision extraction + treasury_sync_budget_tree RPC integration: full per-page pipeline with confidence threshold, JSONL review log, tiered exit codes (0/1/2)
- [x] 07-03-PLAN.md — Seed Allen/Prosper/Celina data_sources, dry-run + live-load all three ACFRs, verify in app (human checkpoint)

</details>

---

<details>
<summary>✅ v1.2 Collin County Completion & Data Quality (Phases 8-10) — SHIPPED 2026-05-21</summary>

Fixed PDF department attribution, loaded revenue for 4 TX cities, added 5 Collin County cities via pdftotext parsers. 13/16 requirements shipped. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

- [x] Phase 8: Data Quality (3/3 plans) — completed 2026-05-04
- [x] Phase 9: Revenue Completion (3/3 plans) — completed 2026-05-04
- [x] Phase 10: Collin County Expansion (3/3 plans) — completed 2026-05-21

</details>

---

### 🚧 v1.3 Revenue Completion & Per-Capita Context (In Progress — Phase 11 complete 2026-05-21)

**Milestone Goal:** Close out all deferred v1.2 data work and add population-based per-capita spending display so citizens can compare cities of different sizes.

### Phase 11: Population Schema, Census Data Load, and Per-Capita Display

**Goal:** Citizens can see per-capita spending ($/resident) for all TX cities, labeled with the population year source.

**Depends on:** Phase 10 (all TX cities loaded; frontend per-capita display already built, gated on population > 0 in DB)

**Requirements:** POP-01, POP-02, POP-03

**Success Criteria** (what must be TRUE when phase completes):
1. All 12 TX cities show a per-capita spending figure ($/resident) in the app for their most recent fiscal year
2. Each per-capita figure is labeled with its population source year (e.g., "Based on 2024 Census estimate")
3. Celina and Princeton show populations consistent with 2024 vintage estimates (Celina >= 60k, Princeton >= 25k) — confirming 2020 Census data was not used
4. `municipalities` table has a `population_year` column and all 12 TX city rows have non-null population and population_year values
5. Re-running `loadTXPopulation.js` does not corrupt existing population values (idempotent upsert)

**Plans:** 3 plans

Plans:
- [x] 11-01-PLAN.md — Schema migration: add `population_year` INTEGER column to `treasury.municipalities` (EV-Accounts repo migration 194 + apply via Supabase Dashboard)
- [x] 11-02-PLAN.md — Build `loadTXPopulation.js` Census CSV loader + update EV-Accounts `treasuryService.ts` (CityRow/TreasuryCity/mapCity/SELECTs) to expose population_year
- [x] 11-03-PLAN.md — Thread population_year through frontend (budget.ts/PlainLanguageSummary/QuickFactsRow), execute live load, push both repos, human-verify $/resident label for 12 TX cities in production

### Phase 12: Prosper and Celina Revenue via pdftotext

**Goal:** Citizens can see revenue data for Prosper and Celina, extracted via pdftotext targeting the "STATEMENT OF REVENUES" section and validated against published ACFR totals before display is enabled.

**Depends on:** Phase 11 (population loaded; per-capita revenue display for Prosper/Celina depends on revenue validation passing)

**Requirements:** REV-01, REV-02, REV-03, REV-04

**Success Criteria** (what must be TRUE when phase completes):
1. Prosper revenue data is visible in the app for FY2023, FY2024, and FY2025 with correct fund/source breakdowns
2. Celina revenue data is visible in the app for FY2025 with correct fund/source breakdowns
3. Prosper revenue totals match ACFR published figures within 20% tolerance — validation result documented before data_source last_synced_at is set
4. Celina revenue totals match ACFR published figures within 20% tolerance — validation result documented before data_source last_synced_at is set
5. Per-capita revenue figures for Prosper and Celina are visible in the app (unlocked by both population load and revenue validation passing)

**Plans:** 3 plans

Plans:
- [x] 12-01-PLAN.md — Look up FY2023/FY2024 expected totals from ACFRs; build `processProsperjRevenuePDF.js` with validation gate; fix corrupted data_source URLs; run all 3 FYs
- [x] 12-02-PLAN.md — Human verify Prosper revenue data visible in app for loaded FYs; confirm per-capita displaying; document validation results
- [x] 12-03-PLAN.md — Build `processCelinaRevenuePDF.js`; run FY2025; validate against $129,568,278 expected total; human verify Celina revenue and per-capita in app

### Phase 13: Richardson Operating Budget

**Goal:** Citizens can see Richardson TX operating budget data in the app, loaded after manually sourcing the PDF URL from cor.net.

**Depends on:** Phase 10 (Collin County pdftotext parser pattern established; Richardson placeholder data_source rows already seeded)

**Requirements:** COL-01

**Success Criteria** (what must be TRUE when phase completes):
1. Richardson TX operating budget is visible in the app for at least one fiscal year (FY2025 or FY2026) with correct department/category breakdowns
2. `processRichardsonBudget.js` follows the processGarlandBudget.js pattern and requires no city-specific logic outside its own file
3. Richardson data_source rows have last_synced_at set (no longer null) confirming successful load
4. Re-running the loader does not create duplicate budget rows

Plans:
- [x] 13-01-PLAN.md — Manually source Richardson PDF URL from cor.net/departments/budget; build `processRichardsonBudget.js` following processGarlandBudget.js pattern; load FY2025 and FY2026; verify in app

### Phase 14: Category Enrichment — 5 Collin County Cities

**Goal:** Citizens see plain-language category descriptions for Garland, Wylie, Sachse, Murphy, and Princeton — the 5 cities loaded in v1.2 whose enrichment was deferred.

**Depends on:** Phase 10 (operating budget data loaded for all 5 cities; enrichment infrastructure operational from prior phases)

**Requirements:** ENR-01, ENR-02, ENR-03, ENR-04, ENR-05

**Success Criteria** (what must be TRUE when phase completes):
1. Every budget category for Garland, Wylie, Sachse, Murphy, and Princeton displays a short plain-language description in the app (no blank description fields)
2. Enrichment records in the DB have correct municipality_id values (not NULL/universal) — preventing bleed into other cities
3. Re-running enrichment for any of the 5 cities does not create duplicate enrichment rows
4. Enrichment covers all fiscal years currently loaded for each city

Plans:
- [ ] 14-01-PLAN.md — Run category enrichment for Garland and Wylie; verify descriptions visible in app and municipality_id scoped correctly
- [ ] 14-02-PLAN.md — Run category enrichment for Sachse, Murphy, and Princeton; verify descriptions visible in app and municipality_id scoped correctly

---

## Progress

**Execution Order:** 11 → 12 → 13 → 14 (13 and 14 can run in parallel after 11 completes)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Donate Button | v1.0 | 1/1 | Complete | 2026-04-21 |
| 2. Data Layer Audit | v1.0 | 1/1 | Complete | 2026-04-21 |
| 3. Webhook Backend | v1.0 | 5/5 | Complete | 2026-04-22 |
| 4. Live Feedback UI | v1.0 | 2/2 | Complete | 2026-04-22 |
| 5. Dallas Socrata | v1.1 | 3/3 | Complete | 2026-05-01 |
| 6. XLSX Pipeline | v1.1 | 3/3 | Complete | 2026-05-01 |
| 7. PDF/Haiku Vision | v1.1 | 3/3 | Complete | 2026-05-02 |
| 8. Data Quality | v1.2 | 3/3 | Complete | 2026-05-04 |
| 9. Revenue Completion | v1.2 | 3/3 | Complete | 2026-05-04 |
| 10. Collin County Expansion | v1.2 | 3/3 | Complete | 2026-05-21 |
| 11. Population & Per-Capita | v1.3 | 3/3 | Complete | 2026-05-21 |
| 12. Prosper + Celina Revenue | v1.3 | 0/3 | Not started | - |
| 13. Richardson Operating Budget | v1.3 | 0/1 | Not started | - |
| 14. Category Enrichment (5 cities) | v1.3 | 0/2 | Not started | - |

---

*Roadmap created: 2026-04-21*
*Last updated: 2026-05-21 — Phase 12 plans created*
