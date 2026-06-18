# Phase 68: Utah BigQuery Source Setup + Loader - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the one piece of new tooling for the v2.5 Utah milestone: **BigQuery access** + a reusable **`loadUtahTransparency.js`** loader, proven on one pilot city via a **zero-write dry-run**. Phases 69–73 (city budgets, county budgets + linking, salaries, enrichment, verification) all reuse what this phase builds.

**In scope:** establish authenticated BigQuery access to the Utah State Auditor's public table; confirm each of the 15 target entities' exact `entity_name` string + record an entity→municipality mapping (UTSRC-01); build the loader that queries per entity/FY/type, builds a function/purpose-first category tree, and writes operating + revenue with durable source attribution + never-overwrite guard; prove it on one pilot city dry-run (UTSRC-02).

**Out of scope (later phases):** actually loading the 10 cities (69), county budgets + linking (70), salaries/`PY` loading (71), enrichment (72), verification/UAT (73). No production writes in this phase.
</domain>

<decisions>
## Implementation Decisions

### BigQuery Access
- **D-01:** Authenticate with the **Empowered Vote Google Workspace account** (`chris@empowered.vote`), not a personal account — org-owned ownership of the Cloud project. Create a **free BigQuery sandbox project** under it ($0, no billing/credit card; 1 TB/month query free tier covers our tiny 15-entity queries).
- **D-02:** **Fallback** if the EV Workspace org restricts Cloud-project creation: fall back to a personal Google account sandbox (same flow). The planner should surface this as the first thing to verify, since it gates everything.
- **D-03:** The Google Cloud SDK (`gcloud`/`bq`) is **NOT installed** on this machine and there is **no `@google-cloud/bigquery` Node dependency** — Phase 68 must install access tooling from scratch. Authentication is a one-time interactive `gcloud auth login` (run by Chris via the `! gcloud auth login` session pattern).
- **D-04:** Loader stays **JavaScript** like every other loader in `scripts/`. Mechanism (Node `@google-cloud/bigquery` client via Application Default Credentials, vs. shelling `bq query --format=json` into the loader) is the planner's call — recommend the Node client for consistency with the existing JS loader ecosystem.

### Category-Tree Shape
- **D-05:** **Function/purpose-first**, consistent with BOTH the Federal tracker (function lens default — "what it's for") and the CA SCO loader (`category → subcategory → line`). Top level = functional/purpose categories (Public Safety, Public Works, Parks & Rec, General Government…), then a second level (sub-function/category), then line items. **2–3 levels max; NO reflexive deep icicle** (ground rule 3).
- **D-06:** Map to Utah's `function1-7` columns if they carry a clean functional classification; the **researcher must inspect the actual transaction data** to confirm which column (`function` vs `cat`) is cleanest/best-populated. **Department/org (`org1-10`) is the fallback** if function is sparse.
- **D-07:** Tree written in the existing compact JSON shape (`{n, a, c}` parent / `{n, a, i}` items) consumed by `treasury_sync_city_budget` — same as `bulkLoadStateController.js`.

### Source Attribution
- **D-08:** The source chip on each Utah figure links to the **per-entity Transparent Utah page** (that specific city/county's revenue + expense overview) — mirrors CA's durable per-entity page choice. The **researcher confirms the exact `entity_id`-keyed URL pattern** (e.g. a `transparent.utah.gov` entity-details deep link). Use the durable human page, NOT the BigQuery table or a versioned/API endpoint.
- **D-09:** Source label = **"Transparent Utah"** (Utah State Auditor); data is **CC BY 4.0** — carry attribution. `source_date` computed **once per run** (not per-entity), overridable via flag — same as the CA loader.

### Pilot City + FY Scope
- **D-10:** **Pilot city = Claude's discretion** — pick whichever of the 10 has the cleanest, most complete Transparent Utah data for the zero-write dry-run (Salt Lake City = largest/headline; Provo = clean award-winning ACFR for easy reconciliation — both are reasonable).
- **D-11:** **Load all available fiscal years (FY2009→present)** per entity — Transparent Utah data starts at FY2009. Matches the deep-history parity standard set in CA (FY2003→present). Document any sparse/incomplete early years rather than loading noise.

### Carried Forward (from the CA pipeline — locked, not re-discussed)
- **Never-overwrite guard:** pre-skip any `(municipality_id, fiscal_year, dataset_type)` row whose existing `data_source` differs from this run — never overwrite a richer custom-source load. `treasury_sync_city_budget` is NOT source-safe on its own; the guard lives in the loader.
- **Durable page `source_url`** (not API/table endpoint) + `source_date` once per run.
- **Utah municipal fiscal year:** July 1–June 30 → `fiscal_year_start_month = 7` (researcher/planner to confirm against an entity's actual data; cities may differ).
- **Basis:** transaction-level **actuals / all-governmental-funds** (Utah `amount` summed per the chosen tree), consistent with existing CA county loads — labeled accordingly; ACFR reconciliation (Phase 73) confirms basis.
- **Free only; $0** (BQ sandbox); AI cost gate $5.

### Claude's Discretion
- Pilot city selection (D-10).
- Loader auth mechanism: Node BQ client vs `bq` CLI (D-04).
- Exact BigQuery SQL (column projection + `entity_name`/`fiscal_year`/`type` filters to keep scanned bytes tiny and stay in free tier).
- Which functional column becomes the tree top level, pending data inspection (D-06).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data source (the decider — read first)
- `.planning/research/UTAH-RECON.md` — full data-source recon: the BigQuery table `ut-sao-transparency-prod.transaction.transaction`, its columns (`entity_name, entity_id, amount, fiscal_year, fund1-4, org1-10, cat1-7, program1-7, function1-7, description, vendor_name, title, account_number, type, govt_lvl`), the `EX`/`RV`/`PY` type codes, free-tier access model, Socrata cross-check (FY≤2019), and ACFR fallback.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — UTSRC-01 (BQ access + entity-name mapping) and UTSRC-02 (reusable loader) are this phase's requirements; full v2.5 scope + out-of-scope.
- `.planning/ROADMAP.md` §"Phase 68" — goal, dependencies, success criteria, plan shape (2 plans: 68-01 access+mapping, 68-02 loader+dry-run).

### Loader pattern to mirror (the analog)
- `scripts/bulkLoadStateController.js` — the closest analog: external uniform source → `category→subcategory_1→line` tree → `treasury_sync_city_budget` RPC with `p_data_source_name`/`p_source_url`/`p_source_date`; the never-overwrite guard (`findConflictingBudget`), `treasury_ensure_municipality`, population backfill (never lower non-zero to 0), `--dry-run` collision pre-pass, `source-date` computed once. `loadUtahTransparency.js` swaps the Socrata HTTP fetch for a BigQuery query and keeps the rest of this contract.
- `scripts/loadCountyBudget.js`, `scripts/loadCASalaries.js` — secondary analogs for the downstream county-budget (Phase 70) and salary/`PY` (Phase 71) reuse; not required for Phase 68 itself.

### External (Utah, public)
- Transparent Utah Super User SQL reference: `old.transparent.utah.gov/superuser_scripts.php` — documents the BigQuery table + example queries.
- Per-entity source page pattern: `transparent.utah.gov` entity-details (exact URL pattern to be confirmed by the researcher, keyed by `entity_id`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/bulkLoadStateController.js`** — copy its structure wholesale: tree builder, `treasury_sync_city_budget` RPC call, `treasury_ensure_municipality`, `findConflictingBudget` never-overwrite guard, population backfill, dry-run collision pre-pass, once-per-run `source_date`. Replace `fetchAllPages` (Socrata) with a BigQuery query function.
- **`treasury_ensure_municipality` / `treasury_sync_city_budget` RPCs** — the write contract is already established; Utah uses the same `dataset_type` of `operating`/`revenue` (salaries handled later in Phase 71, see `loadCASalaries.js`).
- **Supabase client bootstrap** (`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` from `.env`) — identical across loaders; scripts run on the **main tree** (need the gitignored `.env`, no worktree isolation).

### Established Patterns
- **Never-overwrite guard lives in the loader, not the RPC** — `treasury_sync_city_budget` overwrites + keeps a stale `data_source` label, so the pre-skip guard is mandatory (`[[project_sync_city_budget_not_source_safe]]`).
- **Compact JSON tree** (`{n,a,c}`/`{n,a,i}`), children sorted by amount desc, zero-value rows skipped.
- **Per-year population** persisted on the municipality; BQ has NO population → use **Census vintage** (the CA feed carried population; Utah won't, so population is a separate input — researcher/planner decide source, likely Census, mirroring `loadTXPopulation.js`/`loadMAPopulation.js`).

### Integration Points
- The US entity appears in the app automatically once the first `treasury.budgets` row lands; same will hold for Utah cities (no feature flag). A **Utah state node** must exist as the breadcrumb parent (created in Phase 70, not 68).
- Production app reads `ev-accounts-api.onrender.com/api/treasury/cities`; entity visibility is gated on `treasury.budgets` metadata rows.
</code_context>

<specifics>
## Specific Ideas

- "Use the same general approach we use for Federal or CA" (Chris) — the explicit driver behind D-05: function/purpose-first tree, no novel scheme. Consistency with the existing trackers is a stated value.
- $0 / free-tier is non-negotiable (Empowered Vote is an unfunded nonprofit) — the BQ sandbox path was chosen specifically because it needs no credit card.
</specifics>

<deferred>
## Deferred Ideas

- **Salaries/`PY` tree shape + names-free safety line** — Phase 71's concern; the loader's `PY` path is designed when 71 is planned (the `EX`/`RV` op+rev tree is what Phase 68 proves). Mirror `loadCASalaries.js` (names-free Dept→Position total-comp).
- **Socrata FY≤2019 cross-check** — using `bulkLoadBudget.js` against opendata.utah.gov as an independent validation of the BQ pull for FY2017–2019; a verification nicety, candidate for Phase 73, not Phase 68.
- **Generalizing the loader to all ~1,000 Utah entities** (school/special districts, more cities) — future milestone; the loader is built parameterized so it generalizes, but scope stays the 10 cities + 5 counties.

None of the above are Phase 68 scope — discussion stayed within the source-setup/loader boundary.
</deferred>

---

*Phase: 68-utah-bigquery-source-setup-loader*
*Context gathered: 2026-06-17*
