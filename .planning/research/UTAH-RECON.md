# v2.5 Utah Municipal Expansion — Data Source Recon

*Recon date: 2026-06-17 (inline, no subagents). Decides the data-source architecture before the roadmap locks — same recon-before-roadmap discipline used for v2.0 federal.*

## Bottom line

Utah has a genuine uniform statewide source that is **better than CA's SCO ByTheNumbers in one respect** (expense + revenue + payroll for every entity in a single table) and **current** (not stale): the Utah State Auditor's **Transparent Utah** data, canonically a **public Google BigQuery dataset**. The catch is access: querying BigQuery needs a Google Cloud project (free-tier covers our volume; the data itself is public CC BY 4.0). A zero-auth fallback exists but is staler/more manual.

## Sources evaluated

### 1. PRIMARY — Utah State Auditor BigQuery dataset (current, uniform, all entities/years)

- **Table:** `ut-sao-transparency-prod.transaction.transaction` (the live system behind transparent.utah.gov; documented in the Super User Resource Center's example SQL scripts).
- **Columns:** `entity_name`, `entity_id`, `amount`, `fiscal_year`, `fund1-4`, `org1-10`, `cat1-7`, `program1-7`, `function1-7`, `description`, `vendor_name`, `title`, `account_number`, `type`, `govt_lvl`.
- **Transaction types:** `EX` = expense, `RV` = revenue, `PY` = payroll/compensation. **All three of our needs (op budget, revenue, salaries) come from one table.**
- **Coverage:** ~1,000 Utah public entities (state, counties, municipalities, school + special districts), FY2009→present, ~250M records. All 10 target cities + 5 counties are in scope (cities/counties are first-class entities).
- **Basis:** transaction-level **actuals** (not adopted budget). Consistent with our existing CA county/city loads, which are SCO all-governmental-funds actuals — Utah will be the same "actuals by fund/category, all-funds basis" model.
- **License:** CC BY 4.0 (attribution).
- **Access:** BigQuery public dataset — requires a GCP project to run queries. Our queries (filter to 15 entities) are tiny → well within BQ's 1 TB/month free tier → **$0**. Query via `bq` CLI, the BQ REST API, or a service account.
- **Category tree:** build the icicle from `fund` → `cat`/`function` → `org`/`account`. Loader is **new tooling** (BQ-based), unlike CA's HTTP SCO loader — but it's one clean, well-typed table.

### 2. CROSS-CHECK — opendata.utah.gov (Socrata, zero-auth, but STALE)

- Per-year datasets, reusable with our existing `bulkLoadBudget.js` Socrata loader **with zero new code**:
  - Local Government **Expense**: 2011 (3b73-szmk), 2014 (789m-7ay2), 2016 (7esq-urvs), 2017 (d76d-jfka), 2018 (wpez-un6k), 2019 (a87n-mpag)
  - Local Government **Revenue**: 2017 (5e6y-2vqy), 2018 (3rtj-7gms), 2019 (3ha5-9nm8)
  - **Government Payroll – All Years** (i8mu-kc5s)
- **Limitation:** stops at **FY2019** (~6 years stale). Same underlying Transparent Utah data → ideal as a **zero-auth validation cross-check** for FY2017–2019, not as the live source.

### 3. COMPENSATION — Transparent Utah Compensation Downloader (no-auth CSV)

- Per-entity, per-fiscal-year employee-compensation CSV download (names-free totals consistent with our public-record-only safety line). Backstop to the BQ `PY` rows.

### 4. RECONCILIATION / FALLBACK — per-city & per-county ACFRs (current, per-entity PDFs)

- Salt Lake City, Provo, Salt Lake County, etc. publish ACFRs (Provo back to 2007; SLC investor-relations page). Used for the verification phase's basis-matched reconciliation (the Ventura-County precedent from v2.4), and as a per-entity fallback for any field/year the API can't serve.

## Key decision this raises (for Chris)

**Can we use BigQuery?** It's the only path to *current, uniform* Utah data across all 15 entities + all three data types. It needs a GCP project (free-tier → $0, data is public). If GCP isn't available, the fallback is Socrata (FY≤2019) + per-entity CSV/PDF for current years — more manual and per-city, closer to the early TX/OR PDF era than the CA pipeline.

## Risks / watch-items

- **BQ access setup** is the one real prerequisite (GCP project + auth). Validate before Phase 1 commits to the BQ loader.
- **Actuals, not adopted budget** — label consistently with the CA all-funds precedent; ACFR reconciliation confirms basis.
- **Category-tree shape** — `fund/cat/function/org` is richer than SCO; pick the cleanest 2–3 levels for the icicle (avoid reflexive deep icicles — ground rule 3).
- **Per-year population** for per-capita — Census vintage like prior milestones (BQ has no population).
- **Entity-name matching** — confirm each city/county's exact `entity_name` string in BQ at plan time (e.g. "Salt Lake City" vs "Salt Lake City Corporation").

## Pipeline reuse vs new tooling

- **New:** a BigQuery-based loader (`loadUtahTransparency.js` or similar) that queries the transaction table per entity/year/type and writes op/rev/salary trees + durable source attribution.
- **Reused as-is:** `seedCountyLinks.js` (county entity + city linking), enrichment authoring pattern (inline, $0), the verification/source-chain-audit pattern, `bulkLoadBudget.js` (only for the Socrata FY≤2019 cross-check).
