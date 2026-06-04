# Roadmap — Treasury Tracker / Empowered Vote Financials

## Milestones

- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — Phases 1-4 (shipped 2026-04-22)
- ✅ **v1.1 Texas Municipal Financial Transparency** — Phases 5-7 (shipped 2026-05-02)
- ✅ **v1.2 Collin County Completion & Data Quality** — Phases 8-10 (shipped 2026-05-21)
- ✅ **v1.3 Revenue Completion & Per-Capita Context** — Phases 11-14 (shipped 2026-05-22)
- ✅ **v1.4 Geographic Expansion** — Phases 15-16 (shipped 2026-05-22)
- ✅ **v1.5 Oregon Expansion** — Phases 17-25 (shipped 2026-06-04)
- 📋 **v1.6 California City Expansion** — Phases 26-30 (in progress)

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

Plans:

- [x] 05-01-PLAN.md — Idempotent seeder for Dallas operating + revenue `data_sources` rows
- [x] 05-02-PLAN.md — Generic Socrata budget loader (`bulkLoadBudget.js`) calling `treasury_sync_budget_tree`
- [x] 05-03-PLAN.md — Live load Dallas FY2025 + FY2026 operating + revenue, verify in app + idempotency

### Phase 6: XLSX Pipeline (COMPLETE — 2026-05-01)

**Goal:** Citizens can view check register and payroll data for Plano, McKinney, and Frisco, loaded via a generic XLSX download pipeline.

Plans:

- [x] 06-01-PLAN.md — Build generic bulkLoadXLSX.js (download, parse, SHA-256 dedup, treasury_sync_transactions RPC)
- [x] 06-02-PLAN.md — Investigate sources + idempotent seedXLSXDataSources.js for Plano, McKinney (transactions + payroll), Frisco
- [x] 06-03-PLAN.md — Live load all seeded sources, verify idempotency + force-reload, confirm data visible in app

### Phase 7: PDF/Haiku Vision Pipeline (COMPLETE — 2026-05-02)

**Goal:** Citizens can view budget data for Allen, Prosper, and Celina, extracted from ACFR PDFs using a Claude Haiku vision pipeline.

Plans:

- [x] 07-01-PLAN.md — PDF rendering foundation: install pdftoimg-js + @napi-rs/canvas, scaffold bulkLoadPDF.js
- [x] 07-02-PLAN.md — Haiku vision extraction + treasury_sync_budget_tree RPC integration
- [x] 07-03-PLAN.md — Seed Allen/Prosper/Celina data_sources, dry-run + live-load all three ACFRs

</details>

---

<details>
<summary>✅ v1.2 Collin County Completion & Data Quality (Phases 8-10) — SHIPPED 2026-05-21</summary>

Fixed PDF department attribution, loaded revenue for 4 TX cities, added 5 Collin County cities via pdftotext parsers. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

- [x] Phase 8: Data Quality (3/3 plans) — completed 2026-05-04
- [x] Phase 9: Revenue Completion (3/3 plans) — completed 2026-05-04
- [x] Phase 10: Collin County Expansion (3/3 plans) — completed 2026-05-21

</details>

---

<details>
<summary>✅ v1.3 Revenue Completion & Per-Capita Context (Phases 11-14) — SHIPPED 2026-05-22</summary>

Closed all deferred v1.2 data work: Prosper + Celina revenue via pdftotext, Richardson operating budget, enrichment for 5 Collin County cities, TX population data with per-capita display. See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) (planned) or .planning/phases/11-14 for full execution history.

- [x] Phase 11: Population Schema, Census Data Load, and Per-Capita Display (3/3 plans) — completed 2026-05-21
- [x] Phase 12: Prosper and Celina Revenue via pdftotext (3/3 plans) — completed 2026-05-22
- [x] Phase 13: Richardson Operating Budget (1/1 plan) — completed 2026-05-22
- [x] Phase 14: Category Enrichment — 5 Collin County Cities (2/2 plans) — completed 2026-05-22

</details>

---

<details>
<summary>✅ v1.4 Geographic Expansion (Phases 15-16) — SHIPPED 2026-05-22</summary>

First non-TX cities launched: LA, SF, SD operating + revenue budgets with per-capita and enrichment. See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md).

- [x] Phase 15: Los Angeles Socrata Budget Load + Enrichment (3/3 plans) — completed 2026-05-22
- [x] Phase 16: California Cities Expansion (SF, SD, LA Revenue) (5/5 plans) — completed 2026-05-22

</details>

---

<details>
<summary>✅ v1.5 Oregon Expansion (Phases 17-25) — SHIPPED 2026-06-04</summary>

### Phase 17: Portland OR Budget Load (COMPLETE — 2026-05-31)

**Goal:** Citizens can view Portland, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. (Revenue budget deferred to a follow-up per D-03 — Portland publishes revenue only in PDF Vol 2 at fund level, more complex than the bureau-level operating tables.)

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 17-01-PLAN.md — Foundation: verify pdfplumber, download + inspect Vol 1 PDFs, seed Portland municipality + operating data_source, add OR:'Oregon' label

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — extractPortland.py + processPortland.js PDF→treasury_sync_budget_tree pipeline (dry-run validated)
- [x] 17-03-PLAN.md — loadORPopulation.js: Census FIPS-41 population load (635,749)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-04-PLAN.md — Live load operating budget, enrich categories, human-verify in app, write 17-VERIFICATION.md

### Phase 18: Portland Historical Operating Budget (COMPLETE — 2026-05-31)

**Goal:** Portland operating budget data extended to FY2022–FY2024 so citizens can see historical spending trends.

**Status:** Complete — executed directly from 18-RESEARCH.md (no formal plan files; processPortland.js run unchanged against historical PDFs)

### Phase 19: Portland Revenue Budget (COMPLETE — 2026-05-31)

**Goal:** Portland revenue budget (Vol 2, fund-level) loaded for FY2022–FY2026 so citizens can see both spending and revenue sides.

**Status:** Complete — executed directly from 19-RESEARCH.md (extract_revenue() added to extractPortland.py; --revenue flag added to processPortland.js)

### Phase 20: Gresham OR Budget Load (COMPLETE — 2026-06-01)

**Goal:** Citizens can view Gresham, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. Gresham is the second-largest city in Multnomah County (~115,000 pop), completing the county's two major cities.

**Depends on:** Phase 17

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Foundation: verify pdfplumber, create docs/Gresham/ + download 4 PDFs (FY2023–FY2026), inspect FY2023-24 All Funds structure, seed Gresham municipality (pop 111,507)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02-PLAN.md — extractGresham.py (text-line parser, NOT extract_tables) + processGresham.js → treasury_sync_budget_tree pipeline (dry-run validated, all 4 PDFs)
- [x] 20-03-PLAN.md — loadORPopulation.js: two-constant edit to add Gresham (Census 111,507)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-04-PLAN.md — Live load operating budget FY2023–FY2026, enrich categories, human-verify in app, write 20-VERIFICATION.md

### Phase 21: Gresham OR Revenue Load (COMPLETE — 2026-06-01)

**Goal:** Citizens can view Gresham, OR revenue (Money In) data alongside the existing operating budget. Revenue rows are extracted from the Resources section of the same 4 adopted budget PDFs (FY2023-FY2026) already used for phase 20.

**Depends on:** Phase 20

**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 21-01-PLAN.md — Add extract_revenue() + --mode to extractGresham.py and --revenue pipeline to processGresham.js; validate all 4 FYs via dry-run

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-02-PLAN.md — Live-load revenue FY2023-FY2026, DB-verify (no collision, no Beginning Balance), conditional enrichment, human-verify Money In tab, write 21-VERIFICATION.md

---

### Phase 22: Troutdale OR Budget Load

**Goal:** Citizens can view Troutdale, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. Troutdale (15,749 pop, Census 2024) is the third-largest incorporated city in Multnomah County. Revenue (Money In) is folded into this phase per D-01.

**Depends on:** Phase 20

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 22-01-PLAN.md — Download Troutdale PDFs, create extractTroutdale.py (General Fund operating + All Funds revenue), seed Troutdale municipality (pop 15,749)

**Wave 2** *(blocked on Wave 1)*

- [x] 22-02-PLAN.md — Create processTroutdale.js loader ($30M sanity cap, --revenue mode); dry-run all FYs and resolve D-02 FY depth

**Wave 3** *(blocked on Wave 2)*

- [x] 22-03-PLAN.md — Live-load operating + revenue, loadORPopulation.js Troutdale edit, conditional enrichment, human-verify, write 22-VERIFICATION.md

---

### Phase 23: OR All Funds Consistency — Requirements Extraction (Portland + Gresham + Troutdale)

**Goal:** Resolve the scope mismatch between the Budget tab (~$330M departmental operating) and Money In tab (~$512M All Funds Resources) for Oregon cities. Both sides of the financial picture should use the same "All Funds" scope so totals balance and citizens aren't misled by an apparent surplus that is actually an accounting artifact.

**Problem:** Money In already uses the All Funds Resources section (~10 categories, all funds combined). The Budget tab uses the departmental operating budget (a subset). Displaying them together implies the city brings in $512M and only spends $330M, which looks like a $180M windfall but is actually just mismatched scopes — the same $180M appears on the Requirements side of the same All Funds page.

**Approach:** Extract the Requirements column from the "Resources and Requirements — All Funds" page in each OR city's adopted budget PDF (the same page already used for revenue extraction). Store as `dataset_type='all_funds_requirements'`. Show as the primary Budget tab total, with the existing departmental operating breakdown as a drill-down detail. The frontend headline + gap-explanation label are data-driven (D-04) — any city/year with the data gets them; TX/CA unchanged.

**Scope:** Portland (Vol 1, FY2022–FY2026), Gresham (FY2023–FY2026), Troutdale (FY2019–FY2026, D-05 confirmed) — full end-to-end (D-01): data extraction + DB load + frontend display change.

**Depends on:** Phases 19, 21

**Plans:** 4/4 plans complete
Plans:
**Wave 1** *(three independent city pipelines, parallel)*

- [x] 23-01-PLAN.md — Gresham: extract_requirements() + processGresham.js --requirements; live-load FY2023–FY2026 (~$897M FY2026)
- [x] 23-02-PLAN.md — Portland: table-based multi-page extract_requirements() (Vol 1, D-07) + processPortland.js --requirements; live-load FY2022–FY2026
- [x] 23-03-PLAN.md — Troutdale: extract_requirements() (RESOURCES→REQUIREMENTS gate flip, D-05) + processTroutdale.js --requirements; live-load FY2019–FY2026 (~$81M FY2026)

**Wave 2** *(blocked on Wave 1 — needs all_funds_requirements rows in DB to verify)*

- [x] 23-04-PLAN.md — Frontend: dataset_type union + App.tsx detection/load/prop/operatingTotal override/tab-filter + PlainLanguageSummary headline override + gap-explanation label (D-02/D-03/D-04); human-verify all OR + TX/CA cities

---

### Phase 24: Los Angeles Data Refresh

**Goal:** Improve the quality, accuracy, and completeness of Los Angeles financial data. Fix the suspicious FY2025 revenue figure (~$44.6B — likely enterprise fund bleed), backfill real expenditure actuals for FY2021–2024 from the LA Controller dataset, add department-level category trees for FY2017–2020 (currently totals-only), repair orphaned data_source_id FK references, and improve plain-language section summaries using existing enrichment data — no new AI API calls.

**Depends on:** Phase 15

**Plans:** 4/4 plans complete
Plans:
**Wave 1** *(three independent fixes, no file overlap, fully parallel)*

- [x] 24-01-PLAN.md — Revenue accuracy: LA_REVENUE actual_amount_column → null; reload FY2025/FY2026 revenue (~$44.6B → ~$10.2B)
- [x] 24-02-PLAN.md — Operating fix: where_extra adopted>0 filter + fiscal_years 2017-2026; reload FY2017-2026 (enterprise-bleed fix + FY2021-24 actuals + FY2017-20 trees + orphaned FK repair)
- [x] 24-03-PLAN.md — Summaries UI: surface enrichment.description (2-3 sentences) in PlainLanguageSummary; zero AI spend, zero DB writes

---

### Phase 25: LA County Data Completion + County-City Linking (COMPLETE — 2026-06-02)

**Goal:** Citizens can view LA County government's full budget (Money In and Money Out) with accurate FY2021–2024 coverage from the CA State Controller county-specific datasets. The current "LA County" data in the DB was loaded from the city-aggregated datasets (not the county government's own budget) and is mislabeled — this phase re-loads from the correct county sources (uctr-c2j8 + emxv-k8xv), fixes population (currently 0), and repairs orphaned data_source_id FKs. Additionally, a `county_id` FK is added to the municipalities schema and populated for all LA County cities (plus San Diego, Sacramento, Berkeley, Fremont), enabling the first county-city relationship in the app — cities show a "Los Angeles County →" context link, and the county page shows which incorporated cities have budget data.

**Depends on:** Phase 24

**Key data facts:**
- LA County municipality: `f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1`, population = 0 (fix to 10,014,009, year 2020)
- County datasets uctr-c2j8 (operating) + emxv-k8xv (revenue) have data through FY2024 only — FY2025/FY2026 return 0 rows (D-02 resolved)
- FY2025 operating row (~$44.1B, wrong-sourced) disposition decided via checkpoint in 25-01
- Stale city-aggregate data_source rows: `c68cc1d2-...`, `1f2e2694-...` (deleted + replaced)
- All 88 LA County cities already in DB; only 3 new county rows needed (San Diego/Sacramento/Alameda — linking only)
- ev-accounts-api `/api/treasury/cities` must return county_id (verified before UI work — highest risk)

**Plans:** 3 plans (2 waves)
Plans:
**Wave 1** *(data + schema, no file overlap, parallel)*

- [x] 25-01-PLAN.md — Data re-load: clear stale operating/revenue + orphaned data_sources, reload FY2021-2024 from county datasets, fix population, resolve FY2025 operating disposition (decision checkpoint)
- [x] 25-02-PLAN.md — Schema + linking: add `county_id UUID REFERENCES treasury.municipalities(id)` via MCP migration; seed 3 county rows + link 88 LA cities and 4 other-CA cities; update Municipality type

**Wave 2** *(blocked on 25-02 county_id data + type)*

- [x] 25-03-PLAN.md — UI: verify ev-accounts-api returns county_id; county breadcrumb chip on city pages; CitiesInCountyPanel (Available now / Coming soon) on county pages

</details>

---

## v1.6 California City Expansion (Phases 26–30)

**Milestone goal:** Add 7 new California cities with full operating and revenue budget data, expanding CA coverage beyond LA/SF/SD, and close two carry-forward items from v1.5. All data loaded via PDF/CSV — no Socrata SODA API calls.

**Requirements:** 11 discrete requirements (DATA-01–07, ENRICH-01, POPUL-01, CARRY-01, CARRY-02) | All covered ✓

### Phase 26: Sacramento CA Data Load

**Goal:** Sacramento is visible in the app with correct operating and revenue budget data, enrichment, and per-capita display
**Depends on:** Nothing (loadSacramentoCSV.js already written)
**Requirements:** DATA-01, ENRICH-01 (Sacramento), POPUL-01 (Sacramento)
**Success Criteria** (what must be TRUE):
  1. "Sacramento" appears in the city picker at treasurytracker.empowered.vote under "California"
  2. Operating budget tab shows a total in the ~$1.6B range for the latest available FY
  3. Revenue / Money In tab shows data with at least one fiscal year populated
  4. Per-capita ($/resident) displays correctly using ~536K population
  5. Category enrichment descriptions are visible (not empty) for top operating categories
**Plans:** TBD
**UI hint:** yes

### Phase 27: Carry-forwards — Longview TX Revenue + STATE_LABELS

**Goal:** Longview TX shows Money In data in the app and state group headers display full names everywhere in the city picker
**Depends on:** Nothing (independent carry-forwards)
**Requirements:** CARRY-01, CARRY-02
**Success Criteria** (what must be TRUE):
  1. Longview TX city page shows a Money In tab with revenue categories populated
  2. City picker state group headers display "California", "Texas", and "Oregon" (not abbreviations)
  3. Longview revenue categories have enrichment descriptions visible
**Plans:** TBD

### Phase 28: Oakland + San Jose CA Data Load

**Goal:** Oakland and San Jose are visible in the app with operating and revenue budget data, covering both fiscal years of Oakland's biennial budget and General-Fund-scoped data for San Jose
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-02, DATA-03, ENRICH-01 (Oakland + San Jose), POPUL-01 (Oakland + San Jose)
**Success Criteria** (what must be TRUE):
  1. "Oakland" and "San Jose" appear in the city picker under "California"
  2. Oakland operating budget shows data for at least 2 fiscal years (biennial); totals in the ~$2.1B/year range
  3. San Jose operating budget tab shows a total in the ~$1.7–1.9B General Fund range (enterprise funds filtered or documented)
  4. Both cities show Revenue / Money In tabs with at least one fiscal year populated
  5. Per-capita displays correctly for Oakland (~444K) and San Jose (~997K)
  6. Enrichment descriptions visible for top categories in both cities
**Plans:** TBD
**UI hint:** yes

### Phase 29: Long Beach + Bakersfield CA Data Load

**Goal:** Long Beach and Bakersfield are visible in the app with operating and revenue budget data; Port of Long Beach excluded, Long Beach non-standard FY documented
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-04, DATA-07, ENRICH-01 (Long Beach + Bakersfield), POPUL-01 (Long Beach + Bakersfield)
**Success Criteria** (what must be TRUE):
  1. "Long Beach" and "Bakersfield" appear in the city picker under "California"
  2. Long Beach operating budget total is in the ~$1.5B General Fund range (Port of LB excluded; Oct–Sep FY documented in seeder)
  3. Bakersfield operating budget total is in the ~$765M range
  4. Both cities show Revenue / Money In tabs with at least one fiscal year populated
  5. Per-capita displays correctly for Long Beach (~451K) and Bakersfield (~417K)
  6. Enrichment descriptions visible for top categories in both cities
**Plans:** TBD
**UI hint:** yes

### Phase 30: Fresno + Riverside CA Data Load

**Goal:** Fresno and Riverside are visible in the app with operating and revenue budget data; Fresno enterprise funds filtered, Riverside biennial budget covers both fiscal years
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-05, DATA-06, ENRICH-01 (Fresno + Riverside), POPUL-01 (Fresno + Riverside)
**Success Criteria** (what must be TRUE):
  1. "Fresno" and "Riverside" appear in the city picker under "California"
  2. Fresno operating budget total reflects ~$483M General Fund (enterprise funds filtered; not the ~$2.0B all-funds figure)
  3. Riverside operating budget shows data for at least 2 fiscal years (biennial); totals in the ~$1.45B/year range (RPU utility filtered or documented)
  4. Both cities show Revenue / Money In tabs with at least one fiscal year populated
  5. Per-capita displays correctly for Fresno (~550K) and Riverside (~324K)
  6. Enrichment descriptions visible for top categories in both cities
**Plans:** TBD
**UI hint:** yes

---

## Progress

**Execution Order:** Sequential phases 1→16 (all complete)

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
| 12. Prosper + Celina Revenue | v1.3 | 3/3 | Complete | 2026-05-22 |
| 13. Richardson Operating Budget | v1.3 | 1/1 | Complete | 2026-05-22 |
| 14. Category Enrichment (5 cities) | v1.3 | 2/2 | Complete | 2026-05-22 |
| 15. Los Angeles Socrata + Enrichment | v1.4 | 3/3 | Complete | 2026-05-22 |
| 16. California Cities Expansion | v1.4 | 5/5 | Complete | 2026-05-22 |
| 17. Portland OR Budget Load | v1.5 | 4/4 | Complete | 2026-05-31 |
| 18. Portland Historical Operating | v1.5 | — | Complete | 2026-05-31 |
| 19. Portland Revenue Budget | v1.5 | — | Complete | 2026-05-31 |
| 20. Gresham OR Budget Load | v1.5 | 4/4 | Complete    | 2026-06-01 |
| 21. Gresham OR Revenue Load | v1.5 | 2/2 | Complete    | 2026-06-01 |
| 22. Troutdale OR Budget Load | v1.5 | 3/3 | Complete    | 2026-06-02 |
| 23. OR All Funds Consistency | v1.5 | 4/4 | Complete | 2026-06-03 |
| 24. Los Angeles Data Refresh | v1.5 | 4/4 | Complete    | 2026-06-03 |
| 25. LA County Data Completion + County-City Linking | v1.5 | 3/3 | Complete | 2026-06-03 |
| 26. Sacramento CA Data Load | v1.6 | 0/? | Not started | - |
| 27. Carry-forwards (Longview + STATE_LABELS) | v1.6 | 0/? | Not started | - |
| 28. Oakland + San Jose CA Data Load | v1.6 | 0/? | Not started | - |
| 29. Long Beach + Bakersfield CA Data Load | v1.6 | 0/? | Not started | - |
| 30. Fresno + Riverside CA Data Load | v1.6 | 0/? | Not started | - |

---

*Roadmap created: 2026-04-21*
*Last updated: 2026-06-03 — v1.6 roadmap added (Phases 26–30, California City Expansion)*
