# Roadmap — Treasury Tracker / Empowered Vote Financials

## Milestones

- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — Phases 1-4 (shipped 2026-04-22)
- ✅ **v1.1 Texas Municipal Financial Transparency** — Phases 5-7 (shipped 2026-05-02)
- 🚧 **v1.2 Collin County Completion & Data Quality** — Phases 8-10 (in progress)

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

### 🚧 v1.2 Collin County Completion & Data Quality (In Progress — Phases 8-10)

**Milestone Goal:** Fix department attribution in PDF-extracted budgets, surface and complete revenue data for all loaded TX cities, and expand coverage to 6 remaining Collin County cities.

---

### Phase 8: Data Quality

**Goal:** PDF-extracted budgets for Allen, Prosper, Celina, Frisco, and Plano show correct department names instead of "Unknown", and dense ACFR pages no longer cause JSON truncation failures.

**Depends on:** Phase 7 (PDF/Haiku pipeline established and in production)

**Requirements:** DQ-01, DQ-02, DQ-03, DQ-04

**Success Criteria** (what must be TRUE when phase completes):
1. Budget rows in Allen, Prosper, and Celina are attributed to named departments (not "Unknown") for the majority of their budget data
2. Budget rows in Frisco and Plano are attributed to named departments (not "Unknown") for the majority of their budget data
3. Running `bulkLoadPDF.js` against a dense statistical ACFR completes with exit code 0 or 1 — exit code 2 JSON truncation no longer occurs on operating budget pages
4. Re-extracted data replaces prior "Unknown" rows — old incorrect attributions are not left in the database alongside corrected rows

**Plans:** TBD

Plans:
- [ ] 08-01-PLAN.md — Extend bulkLoadPDF.js to track ACFR section headings across pages; carry department context forward when rows lack explicit headers
- [ ] 08-02-PLAN.md — Fix JSON truncation: implement chunked extraction or increase max_tokens for dense pages; add page-size guard
- [ ] 08-03-PLAN.md — Re-extract and reload Allen, Prosper, Celina, Frisco, Plano; verify department attribution in app

---

### Phase 9: Revenue Completion

**Goal:** Citizens can view revenue data for all six loaded TX cities — Plano, McKinney, Frisco, and Allen (already loaded) are verified correct in the app, and Prosper and Celina revenue data is loaded and visible.

**Depends on:** Phase 8 (operating budget quality fixes complete; Prosper/Celina data is clean before adding revenue layer)

**Requirements:** REV-01, REV-02, REV-03, REV-04, REV-05, REV-06

**Success Criteria** (what must be TRUE when phase completes):
1. Plano revenue data (FY2018–2024) appears correctly in the app's revenue view with valid amounts and category hierarchy
2. McKinney revenue data (FY2021–2025) appears correctly in the app's revenue view with valid amounts and category hierarchy
3. Frisco revenue data (FY2026) appears correctly in the app's revenue view with valid amounts and category hierarchy
4. Allen revenue data (FY2026) appears correctly in the app's revenue view with valid amounts and category hierarchy
5. Prosper and Celina each have at least one fiscal year of revenue data loaded and visible in the app

**Plans:** TBD

Plans:
- [ ] 09-01-PLAN.md — Verify Plano/McKinney/Frisco/Allen revenue in app: inspect DB rows, confirm UI renders revenue tab with correct totals and hierarchy
- [ ] 09-02-PLAN.md — Extract and load Prosper revenue from ACFR PDF; verify in app
- [ ] 09-03-PLAN.md — Extract and load Celina revenue from ACFR PDF; verify in app

---

### Phase 10: Collin County Expansion

**Goal:** Citizens can view operating budget data for the 6 remaining Collin County cities — Garland, Richardson, Wylie, Sachse, Murphy, and Princeton — each loaded from their ACFR PDFs via the existing Haiku vision pipeline.

**Depends on:** Phase 8 (improved PDF pipeline with correct department attribution reduces rework for new cities)

**Requirements:** COL-01, COL-02, COL-03, COL-04, COL-05, COL-06

**Success Criteria** (what must be TRUE when phase completes):
1. Garland and Richardson each have at least one fiscal year of operating budget data visible in the app with named departments
2. Wylie and Sachse each have at least one fiscal year of operating budget data visible in the app with named departments
3. Murphy and Princeton each have at least one fiscal year of operating budget data visible in the app with named departments
4. Each city has a seeded `data_sources` row and was loaded using `bulkLoadPDF.js` without city-specific code changes
5. ACFRs for all 6 cities are sourced and documented (URL or local path recorded in data_sources or a reference file)

**Plans:** TBD

Plans:
- [ ] 10-01-PLAN.md — Source ACFRs for all 6 cities; seed data_sources rows; dry-run pipeline against each PDF
- [ ] 10-02-PLAN.md — Live load Garland and Richardson; verify in app
- [ ] 10-03-PLAN.md — Live load Wylie, Sachse, Murphy, and Princeton; verify in app

---

## Progress

**Execution Order:** 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Donate Button | v1.0 | 1/1 | Complete | 2026-04-21 |
| 2. Data Layer Audit | v1.0 | 1/1 | Complete | 2026-04-21 |
| 3. Webhook Backend | v1.0 | 5/5 | Complete | 2026-04-22 |
| 4. Live Feedback UI | v1.0 | 2/2 | Complete | 2026-04-22 |
| 5. Dallas Socrata | v1.1 | 3/3 | Complete | 2026-05-01 |
| 6. XLSX Pipeline | v1.1 | 3/3 | Complete | 2026-05-01 |
| 7. PDF/Haiku Vision | v1.1 | 3/3 | Complete | 2026-05-02 |
| 8. Data Quality | v1.2 | 0/3 | Not started | - |
| 9. Revenue Completion | v1.2 | 0/3 | Not started | - |
| 10. Collin County Expansion | v1.2 | 0/3 | Not started | - |

---

*Roadmap created: 2026-04-21*
*Last updated: 2026-05-03 — v1.2 roadmap added (Phases 8-10); v1.1 phases collapsed to details block*
