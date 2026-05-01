# Roadmap — Treasury Tracker / Empowered Vote Financials

## Milestones

- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — Phases 1-4 (shipped 2026-04-22)
- 🚧 **v1.1 Texas Municipal Financial Transparency** — Phases 5-7 (in progress)

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

### 🚧 v1.1 Texas Municipal Financial Transparency (In Progress)

**Milestone Goal:** Load real financial data for Texas cities using three progressively capable ingestion pipelines — Socrata API, XLSX download, and PDF/Haiku vision extraction.

---

### Phase 5: Dallas Socrata Integration

**Goal:** Citizens can view Dallas operating and revenue budget data in the app, loaded via a generic Socrata SODA pipeline reusable for any future city.

**Depends on:** Phase 4 (existing treasury schema and app infrastructure)

**Requirements:** DAL-01, DAL-02, DAL-03, DAL-04, DAL-05, DAL-06

**Technical context:**
- Dallas municipality_id: `17ce5baf-277d-41c9-a3f6-2e44f9def106`
- Operating budget dataset: `e2fs-y4nb` — fields: `bfy, ftyp, fundtype, appr, appropriation, svc, service, objectgroup, budcurr, encbfy, expbfy, encexp`
- Revenue budget dataset: `rtn4-pmj9` — fields: `bfy, ftyp, fundtype, department, rsrc, revsource, budcurr, revbfy`
- Operating column mapping: `budcurr` → approved_amount, `expbfy` → actual_amount; hierarchy: `service` → `objectgroup`
- Revenue column mapping: `budcurr` → approved_amount, `revbfy` → actual_amount; hierarchy: `department` → `revsource`
- Loader follows `bulkLoadTransactions.js` pattern: `data_sources.column_mapping` JSON drives field names, `treasury_sync_budget` RPC handles upsert
- `bulkLoadBudget.js` must be generic — no hardcoded Dallas logic; column mapping lives entirely in `data_sources`

**Success Criteria** (what must be TRUE when phase completes):
1. Dallas operating budget FY2025 and FY2026 are visible in the app with correct category breakdowns and dollar amounts
2. Dallas revenue budget FY2025 and FY2026 are visible in the app with correct department/source hierarchy
3. `bulkLoadBudget.js` can be pointed at any Socrata city by changing only the `data_sources` row — no code changes required
4. Re-running the loader does not create duplicate budget rows (idempotent via upsert or truncate-reload strategy)
5. `data_sources` rows exist for both Dallas datasets with correct `api_type`, dataset IDs, and column mapping JSON

**Plans:** TBD

Plans:
- [ ] 05-01: Create `data_sources` rows for Dallas operating + revenue datasets
- [ ] 05-02: Write `bulkLoadBudget.js` with generic Socrata pagination + `treasury_sync_budget` RPC call
- [ ] 05-03: Load Dallas FY2025 + FY2026 operating and revenue budgets, verify in app

---

### Phase 6: XLSX Pipeline

**Goal:** Citizens can view check register and payroll data for Plano, McKinney, and Frisco, loaded via a generic XLSX download pipeline that is idempotent and reusable for any city with an Excel export.

**Depends on:** Phase 5 (established loader patterns and data_sources schema conventions)

**Requirements:** XLSX-01, XLSX-02, XLSX-03, XLSX-04, XLSX-05, XLSX-06, XLSX-07

**Technical context:**
- Plano: `checkregister.plano.gov` Excel export — `dataset_type = 'transactions'`
- McKinney: direct XLSX download from `mckinneytexas.org` Traditional Finances page — transactions + payroll (`dataset_type = 'salaries'`)
- Frisco: `friscotexas.gov/1276/Check-Register` XLSX — `dataset_type = 'transactions'`
- `data_sources.api_type = 'xlsx_download'`; column mapping JSON stored in `data_sources` row same as Socrata pattern
- Dedup strategy: `source_row_id` derived from row hash (preferred) or position+date composite; prevents re-run duplicates

**Success Criteria** (what must be TRUE when phase completes):
1. Plano, McKinney, and Frisco each have at least one loaded dataset visible in the app (check register transactions)
2. McKinney payroll data is loaded and visible under a `salaries` dataset type
3. Re-running `bulkLoadXLSX.js` against any of these cities does not create duplicate rows
4. `data_sources` rows exist for all XLSX sources with `api_type = 'xlsx_download'`, download URL, and column mapping
5. The loader accepts only a city config (data_sources row) — no city-specific code branches

**Plans:** TBD

Plans:
- [ ] 06-01: Write `bulkLoadXLSX.js` with XLSX download, parse, dedup, and treasury schema load
- [ ] 06-02: Create `data_sources` rows for Plano, McKinney (transactions + payroll), Frisco
- [ ] 06-03: Load all three cities, verify dedup behavior, confirm data visible in app

---

### Phase 7: PDF/Haiku Vision Pipeline

**Goal:** Citizens can view budget data for Allen, Prosper, and Celina, extracted from ACFR PDFs using a Claude Haiku vision pipeline that surfaces extraction confidence and flags uncertain pages for human review.

**Depends on:** Phase 6 (loader conventions established; XLSX phase confirms treasury schema handles multiple city types)

**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, PDF-08

**Technical context:**
- PDF → PNG rendering using available Node/system library (e.g., `pdf2pic`, `pdfjs-dist`, or system `pdftoppm`)
- Each page PNG sent to Claude Haiku vision API: model `claude-haiku-4-5-20251001` (cost-effective for high-volume page processing)
- Extraction prompt targets GFOA ACFR budget tables; returns structured JSON: `{ department, category, approved_amount, actual_amount, fiscal_year }`
- Validated JSON loaded to `treasury.budgets` + `treasury.budget_categories` via `treasury_sync_budget` RPC (same as Phase 5)
- Pipeline parameterized: accepts `--city`, `--pdf` (path or URL), `--fiscal-year`
- Confidence logging: each page logs a confidence score; pages below threshold flagged in a review log rather than silently dropped
- Approach validated by Transparent Motivations project using identical PDF → PNG → Haiku pattern

**Success Criteria** (what must be TRUE when phase completes):
1. Allen, Prosper, and Celina each have at least one fiscal year of budget data visible in the app, sourced from their ACFR PDFs
2. Running the pipeline against a new PDF (any of the three cities) completes without manual intervention for well-formed ACFR pages
3. Low-confidence pages produce a flagged entry in the review log rather than silently corrupting or skipping data
4. The pipeline accepts `--city`, `--pdf`, and `--fiscal-year` parameters and requires no code changes to run against a new city's ACFR
5. Extracted JSON is validated against the expected schema before loading — malformed Haiku output is rejected with a clear error, not silently written

**Plans:** TBD

Plans:
- [ ] 07-01: PDF → PNG rendering script (parameterized, all pages of a given PDF)
- [ ] 07-02: Haiku vision extraction script — prompt engineering for ACFR tables + confidence logging
- [ ] 07-03: Validated JSON → treasury schema loader (reuse `treasury_sync_budget` RPC)
- [ ] 07-04: Load Allen, Prosper, Celina ACFRs; verify data in app; confirm review log for low-confidence pages

---

## Progress

**Execution Order:** 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Donate Button | v1.0 | 1/1 | Complete | 2026-04-21 |
| 2. Data Layer Audit | v1.0 | 1/1 | Complete | 2026-04-21 |
| 3. Webhook Backend | v1.0 | 5/5 | Complete | 2026-04-22 |
| 4. Live Feedback UI | v1.0 | 2/2 | Complete | 2026-04-22 |
| 5. Dallas Socrata | v1.1 | 0/3 | Not started | - |
| 6. XLSX Pipeline | v1.1 | 0/3 | Not started | - |
| 7. PDF/Haiku Vision | v1.1 | 0/4 | Not started | - |

---

*Roadmap created: 2026-04-21*
*Last updated: 2026-05-01 — v1.1 phases 5-7 added (Texas Municipal Financial Transparency)*
