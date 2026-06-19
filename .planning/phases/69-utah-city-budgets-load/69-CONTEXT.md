# Phase 69: Utah City Budgets Load - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Load operating (`EX`→operating) + revenue (`RV`→revenue) for all **10 Utah cities** from Transparent Utah
via the Phase-68 loader (`loadUtahTransparency.js`), every available complete fiscal year, all-funds basis,
every row durably sourced, with population for per-capita. Canary one city, then sweep. Serial main-tree, $0.

**In scope:** the 10 cities' op+rev loads (UCITY-01/02); a fund-based icicle tree; single-vintage population
for per-capita; spot-check reconciliation for ≥2 cities.

**Out of scope (later phases):** county-gov budgets + city→county linking (70); salaries/`PY` (71); enrichment (72);
full verification/UAT (73). The 5 county entities + Utah state node do NOT exist yet (created in 70) — Phase 69
loads cities as standalone municipalities; county linking is Phase 70's job.
</domain>

<decisions>
## Implementation Decisions

### D-69-01: Icicle tree = `fund1 → org1 → cat1` (CHANGED from the 68-03 pilot)
The Phase-68 pilot used `org1` as a flat ~200-category top level — too wide and utility-dominated. **Restructure the
tree to 3 levels: top = `fund1` (the fund), sub = `org1` (department), leaf = `cat1` (expense object).** Rationale:
`function1` is ~70% NULL (unusable); `fund1` is legible and citizen-meaningful (General Fund, Power, Water, Airport, Debt
Service…) and **naturally separates enterprise utilities from the governmental General Fund**. Fund cardinality varies
(Provo 34, SLC 125) but the icicle sorts by amount so the long tail is fine. **Loader change required:** `fetchFromBigQuery`
must `SELECT fund1, org1, cat1, SUM(amount) … GROUP BY fund1, org1, cat1`; `buildTree` maps top=`fund1`, sub=`org1`,
item=`cat1`. This supersedes the `--source-column=org1` default from 68-03 for the Utah city load. Keep ≤3 levels (ground rule 3).

### D-69-02: All-funds basis, fund-separated (NOT split into separate datasets)
Keep the **all-funds basis** (matches the ROADMAP success criteria + the ACFR reconciliation basis used across CA county
loads). Enterprise vs governmental visibility comes for free from the `fund1` top level (D-69-01) — do NOT create separate
governmental/enterprise datasets or change the basis. Label consistently as all-funds; reconcile FY totals against the
city's published ACFR on an all-funds basis (SC#4).

### D-69-03: Population = single recent Census vintage per city
Per-capita needs population (the loader passes 0 today). Source **one recent Census/ACS population per city**, stored with
its `population_year`, mirroring the existing `scripts/loadTXPopulation.js` / `loadORPopulation.js` / `loadMAPopulation.js`
pattern (build a Utah equivalent or extend one). NOT a per-year series (Utah BQ carries no population; single vintage is the
established prior-milestone pattern). $0.

### D-69-04: FY range = FY2014–FY2025 (complete years); canary = Salt Lake City
Load **FY2014 through FY2025** — the complete years. **Exclude FY2026: it is the in-progress/partial year** (Utah FY =
Jul–Jun; probed Provo FY2026 = $288M / 314k rows vs FY2025 $329M / 437k rows). **Canary Salt Lake City first** (largest,
125 funds → hardest stress test of the fund-top tree, and a SC#4 reconciliation target); verify its tree/total/sourcing,
THEN sweep the other 9. Provo is already dry-run-proven from 68-03.

### Carried Forward (locked — from Phase 68 + the CA pipeline)
- **Never-overwrite guard** (`findConflictingBudget`): pre-skip any `(muni, fy, dataset)` row from a different `data_source`.
  Utah cities are expected all-new (no custom-source collisions), but the guard stays on. Confirm none of the 10 pre-exist.
- **Source attribution:** `data_source_name = 'Transparent Utah'`; `source_url` = the durable `transparent.utah.gov` portal
  (no entity_id exists for a deep link — D-08 finalized in 68-03); `source_date` computed once per run.
- **Exact `entity_name` strings + city→county mapping:** `docs/utah-entity-mapping.md` (the 15-entity source of record).
- **Runs serial on the main tree** (needs gitignored `.env` for Supabase + live ADC for BigQuery); no worktree isolation. $0.
- **Utah municipal fiscal year** July 1–June 30 → `fiscal_year_start_month = 7` (confirm per city if any differ).

### Claude's Discretion
- Exact loader refactor for the 3-level fund tree (D-69-01) — planner/executor's implementation call.
- Census vintage choice (latest decennial vs latest ACS 5-yr) for D-69-03 — pick the most recent reliable per-city figure.
- Sweep ordering of the remaining 9 after the SLC canary.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `docs/utah-entity-mapping.md` — the 15 exact `entity_name` strings, `govt_lvl`, FY coverage, city→county linkage (read FIRST).
- `docs/utah-bigquery-access.md` — the working BigQuery access recipe (gcloud PATH, ADC, $0 free-tier discipline).
- `scripts/loadUtahTransparency.js` — the loader to extend for D-69-01 (currently org1→cat1; make it fund1→org1→cat1).
- `.planning/phases/68-utah-bigquery-source-setup-loader/68-03-SUMMARY.md` — the live-recon record (column findings, dry-run proof, the org1-width tuning note that drove D-69-01).
- `scripts/bulkLoadStateController.js` — the CA analog (never-overwrite guard, RPC contract, population backfill).
- `scripts/loadTXPopulation.js` (+ `loadORPopulation.js`, `loadMAPopulation.js`) — the population-loader pattern for D-69-03.
- `.planning/REQUIREMENTS.md` (UCITY-01/02) and `.planning/ROADMAP.md` §"Phase 69" — requirements + success criteria.
</canonical_refs>

<code_context>
## Existing Code Insights

- **`loadUtahTransparency.js`** — proven on Provo (68-03). Needs the D-69-01 3-level fund tree refactor; everything else
  (RPC call, never-overwrite guard, source attribution, dry-run path) is intact. Run with `--entity "<exact name>" --fy <y> [--dry-run]`.
- **`treasury_sync_city_budget` / `treasury_ensure_municipality` RPCs** — established write contract; `dataset_type` = operating/revenue.
- **Population loaders** (`loadTXPopulation.js` et al.) — the analog for D-69-03; municipality population set via `treasury_ensure_municipality` / an update, never lowering a non-zero to 0.
- **Entity visibility** — a city appears in the app once its first `treasury.budgets` row lands (production reads `ev-accounts-api.onrender.com/api/treasury/cities`). No Utah state/county parent needed for cities to render (that's Phase 70 linking).
</code_context>

<specifics>
## Specific Ideas
- The fund-top tree (D-69-01) was chosen specifically because it answers BOTH the "org1 is too wide" UX problem AND the "enterprise utilities swamp the operating picture" concern in one data-driven move — no manual curation, $0.
- "$0 / free-tier non-negotiable" carries from Phase 68: column-project + filter `entity_name`/`fiscal_year`/`type`; a broad single-FY scan is ~20-26 GB so stay filtered.
</specifics>

<deferred>
## Deferred Ideas
- **Curated functional rollup** (map fund/org → ~12 standard buckets like Public Safety/Public Works) — best citizen UX but needs a hand-built per-city mapping; candidate for the enrichment phase (72) or a future pass, NOT Phase 69.
- **FY2026 (partial current year)** — revisit once Utah's FY2026 data is complete; load + relabel then.
- **Per-year population series** — deferred in favor of a single vintage (D-69-03).
</deferred>

---

*Phase: 69-utah-city-budgets-load*
*Context gathered: 2026-06-19*
