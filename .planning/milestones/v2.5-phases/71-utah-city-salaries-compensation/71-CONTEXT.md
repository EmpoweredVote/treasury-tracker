# Phase 71: Utah City Salaries / Compensation - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Load **names-free employee-compensation** trees for the **10 Utah cities** from Transparent Utah's
payroll data (`type='PY'`), every available complete fiscal year, all-funds basis, every row durably
sourced — as **Department → Wages/Benefits** total-compensation icicles (no individual people). Reconcile
≥1 city against the Transparent Utah Compensation Downloader at ~$0 delta. Reuses the Phase 68–70
`loadUtahTransparency.js` loader, extended to handle the `PY` type. Serial main-tree, $0.

**In scope:** extend the loader to load `PY`→`salaries` for the 10 cities (USAL-01); a 2-level
department→comp-category tree; an automated names-free (PII-exclusion) guard; per-city coverage/gaps
documented; one city reconciled.

**Out of scope (later/never):** the 5 county governments' salaries (a possible follow-up, not required by
USAL-01 which is cities-only); any individual-level disclosure (names, titles, hourly_rate, gender — see
D-71-01); enrichment of the new salary categories (Phase 72); full verification/UAT (Phase 73). City/county
budget rows (operating/revenue) are untouched. Runs in parallel with Phase 70 (now complete).
</domain>

<decisions>
## Implementation Decisions

### Names-free disclosure posture (USAL-01 safety line)
- **D-71-01: Aggregate-only, names-free, with an AUTOMATED guard.** The Transparent Utah `transaction`
  table carries individual PII columns — confirmed by live probe 2026-06-19: `vendor_name`, `dba_name`,
  `vendor_code`, `title`, `hourly_rate`, `gender`, `account_number`, `contract_name`, `contract_number`,
  `description`, `ref_id`. The salary loader MUST query **only** `org1`, `cat1`, and `SUM(amount)` (no PII
  column ever projected, grouped, or written) and MUST include a **unit test that fails** if any PII column
  name appears in the PY query or in the emitted tree. Rationale (discussed): the data is lawful public
  record (Utah publishes it via the Compensation Downloader), so this is a **mission/optics** choice, not a
  legal one — Treasury Tracker answers "where does public money go?" structurally (department/category),
  not "who earns what." Re-hosting a polished, EV-branded, SEO-indexed copy of named salaries would make
  individuals far more findable and reframe the tool as surveillance. Aggregation keeps the accountability
  value (Police comp = $16M, Fire = $12.7M) without exposing individuals. This also matches the
  pre-existing ground rule (USAL-01 "names-free … public-record-only safety line"; federal-tracker parity).

### Salary tree shape
- **D-71-02: 2-level icicle — top = `org1` (full department string), leaf = `cat1` (Wages / Benefits).**
  Probe (Provo FY2024): `cat1` has just two values — **Wages** ($65.1M) and **Benefits** ($27.8M); `org1`
  is the department/division string ("Fire - Administration", "Police - Patrol (Shifts)", "Energy - Electric
  Operations"). Keep the **full `org1` string** as the department node — do NOT split on " - " (avoids
  formatting fragility across 10 cities). This is intentionally a **2-level** tree (department → comp
  category), NOT the 3-level `fund1→org1→cat1` budget shape — the existing 3-level `buildTree` would emit a
  redundant third level for the 2-value `cat1`, so the planner should build a 2-level salary tree (a small
  salary-specific builder, or a 2-level mode) rather than force-fit `TREE_OPTS`. `dataset_type='salaries'`
  (`typeToDataset` already maps `PY`→`salaries`). ≤3 levels (ground rule 3).

### Fund scope
- **D-71-03: All-funds, including enterprise/utility employees.** Consistent with the all-funds basis used
  for city + county budgets (Phases 69/70). Enterprise-fund staff (e.g. "Energy - Electric Operations",
  Water) are included in the comp total — this reflects the full municipal workforce. The PY query therefore
  groups by `org1, cat1` across **all funds** (no `fund1` filter, no `fund1` in the tree).

### Reconciliation (USAL-01: ≥1 city at ~$0 delta)
- **D-71-04: Reconciliation city = Claude's discretion.** Provo is the strong default — it's the
  penny-exact budget canary (69-02) and its FY2024 PY is already known from the probe (~$65.1M wages +
  ~$27.8M benefits = ~$92.9M total comp). Basis = all-funds total compensation (Wages + Benefits) matched
  against the Transparent Utah Compensation Downloader for the same entity/FY. Penny-exact not required —
  document any explainable variance (same posture as the budget ACFR reconciliations).

### Carried Forward (locked — from Phases 68–70, confirmed by DB/probe 2026-06-19)
- **Reuse `loadUtahTransparency.js`** — it currently **skips** `PY` (`main` bails with a warning even though
  `typeToDataset('PY')='salaries'`). The extension removes that skip and adds the PY query + 2-level builder.
- **`--entity-type` defaults to `city`** — cities are loaded as `city` (this phase is cities-only), so no
  `--entity-type` change is needed here; just `--type PY`.
- **Display-name mapping (`toDisplayName`)** — invoke per city with the raw Transparent Utah `entity_name`
  (e.g. `--entity "Provo City"`); the loader resolves it to the display name ("Provo"). See
  `[[project_utah_loader_entity_type_and_display_names]]`.
- **FY range = FY2014–FY2025; exclude partial FY2026** (D-69-04).
- **Never-overwrite guard** (`findConflictingBudget`/`neverOverwriteDecision`): a pre-existing different-source
  `(muni, fy, 'salaries')` row is skipped untouched. Salaries are expected all-new; guard stays on.
- **Source attribution:** `data_source_name='Transparent Utah'`, CC BY 4.0, durable `transparent.utah.gov`
  `source_url`, `source_date` computed once per run.
- **Exact `entity_name` match, never LIKE** (decoys: North/South Ogden, Washington Terrace, etc.).
- **Serial main-tree** (gitignored `.env` for Supabase + live gcloud ADC for BigQuery); $0 (column-projected +
  entity/FY/type-filtered queries).

### Claude's Discretion
- Reconciliation city + exact basis-matching method (D-71-04; Provo recommended).
- Whether the 2-level salary tree is a new `buildSalaryTree()` helper or a 2-level mode on `buildTree` —
  planner's call; the shape (D-71-02) is locked.
- Exact form of the PII-exclusion unit test (string assertion on the query + tree-key scan) — the requirement
  (D-71-01: it must fail on any PII column) is locked.
- Per-city sweep ordering and how coverage/gaps are documented.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (read FIRST)
- `.planning/REQUIREMENTS.md` (USAL-01) — the salaries requirement + reconciliation expectation.
- `.planning/ROADMAP.md` §"Phase 71" — goal + 4 success criteria (1 plan, parallel with Phase 70).

### Mapping & source
- `docs/utah-entity-mapping.md` — the 10 cities' exact `entity_name` strings + PY row counts (e.g. SLC PY
  2,646,452 rows, Provo 58,678) + decoy warning.
- `docs/utah-bigquery-access.md` — BigQuery access recipe (gcloud PATH, ADC, $0 discipline, reauth caveat).

### Loader & precedents to extend
- `scripts/loadUtahTransparency.js` — the loader to extend for `PY` (it currently SKIPs PY in `main`;
  `typeToDataset`, `buildTree`, `findConflictingBudget`, `toDisplayName`, `--entity-type`, source attribution
  all reusable). The PY path must SELECT only `org1, cat1, SUM(amount)` (D-71-01) and build a 2-level tree
  (D-71-02).
- `scripts/loadUtahTransparency.test.mjs` — existing offline unit tests; the new PII-exclusion guard test
  lands here.

### Prior context (decisions inherited)
- `.planning/phases/70-utah-county-budgets-linking/70-CONTEXT.md` — `--entity-type`, display-name fix,
  never-overwrite, source locks.
- `.planning/phases/69-utah-city-budgets-load/69-CONTEXT.md` — D-69-04 (FY range), all-funds basis.

### App rendering
- The app already renders a `dataset_type='salaries'` view (built for CA GCC salaries). The planner should
  confirm the Utah salaries tree renders the same way once `salaries` rows exist for a UT city (expected:
  data-driven, no new UI).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`loadUtahTransparency.js`** — proven on EX/RV for cities (69) and counties (70). The only new work is the
  `PY` path: remove the `if (type === 'PY') skip`, add the aggregate-only PY query + 2-level tree.
- **`buildTree` / compact `{n,a,c}`/`{n,a,i}` shape** — reusable for the leaf items; salaries need a 2-level
  variant (department → comp-category) rather than the 3-level fund tree.
- **Never-overwrite guard, source attribution, `toDisplayName`, `--entity-type`** — all reused unchanged.

### Established Patterns
- **`treasury_ensure_municipality` keys on name+state+entity_type** — cities already exist (entity_type=city,
  display names); the salary load reuses those rows (no new municipalities). See
  `[[project_utah_loader_entity_type_and_display_names]]`.
- **`treasury_sync_city_budget` is NOT source-safe** — the loader's pre-skip guard protects existing data
  (`[[project_sync_city_budget_not_source_safe]]`).
- **All-funds aggregation = GROUP BY (no fund filter)** — same as cities/counties; for PY, GROUP BY org1, cat1.

### Integration Points
- A city's salaries view becomes visible once its first `(muni, fy, 'salaries')` `treasury.budgets` row lands.
- Production app reads `ev-accounts-api.onrender.com/api/treasury/...`.

</code_context>

<specifics>
## Specific Ideas
- The PII-column finding is concrete and load-bearing: live probe 2026-06-19 showed `vendor_name`, `title`,
  `hourly_rate`, `gender`, `account_number`, etc. exist on the same table. The names-free guarantee is
  therefore an explicit exclusion + automated guard (D-71-01), not an assumption that PY is pre-aggregated.
- Provo FY2024 PY observed totals (probe): Wages $65,125,717 + Benefits $27,820,236 — a useful reconciliation
  cross-check baseline.

</specifics>

<deferred>
## Deferred Ideas
- **County-government salaries** (the 5 counties' `PY`) — not required by USAL-01 (cities-only). Candidate
  follow-up; the loader fix here (PY path + names-free guard) would make it a small add later.
- **Named individual compensation disclosure** — explicitly considered and declined for this phase (D-71-01).
  If EV ever decides individual disclosure serves the mission, it is a deliberate FUTURE phase with its own
  UI + policy decision — not folded in here.
- **Curated functional rollup** of departments (map org1 → standard buckets) — deferred to enrichment (72) or
  a future pass, same as the budget icicles.

</deferred>

---

*Phase: 71-utah-city-salaries-compensation*
*Context gathered: 2026-06-19*
