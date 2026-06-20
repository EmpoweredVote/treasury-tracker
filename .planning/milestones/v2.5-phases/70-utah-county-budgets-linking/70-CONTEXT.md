# Phase 70: Utah County Budgets + Linking - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Load operating (`EX`→operating) + revenue (`RV`→revenue) for the **5 Utah county governments**
(Salt Lake, Utah, Davis, Weber, Washington) onto their own `entity_type='county'` entities — every
available complete fiscal year, all-funds basis, every row durably sourced, with county population for
per-capita — and **link all 10 cities** US→Utah→county→city so the breadcrumb chip + Cities-in-County
panel render. Serial main-tree, $0. Reuses the Phase-68/69 loader + the `seedCountyLinks.js` pattern.

**In scope:** seed the 5 county entities (UCO-02); link the 10 cities via `county_id` (UCO-02); load the
5 counties' op+rev via `loadUtahTransparency.js` (UCO-01); county population for per-capita. 2 plans —
70-01 seed+link, 70-02 county-budget load. Runs in parallel with Phase 71.

**Out of scope (later phases):** city/county salaries/`PY` (71); enrichment of the new county categories (72);
full verification/ACFR reconciliation/UAT (73). City budget rows are **untouched** (never-overwrite). The
Utah state node is **not created here** — it already exists (DB-confirmed) and is reused as the breadcrumb parent.
</domain>

<decisions>
## Implementation Decisions

### Tree shape & basis
- **D-70-01: County icicle = `fund1 → org1 → cat1`, unchanged from D-69-01.** Counties carry the same
  Transparent Utah columns; the county fund mix (General Fund, Health, Municipal Services District, Debt
  Service, Capital Projects, enterprise funds) separates legibly under the `fund1` top level exactly like
  the cities, and the icicle sorts by amount so the fund tail self-manages. Same all-funds basis, same
  `loadUtahTransparency.js` tree builder (`TREE_OPTS = {topCol:'fund1', subCol:'org1', itemCol:'cat1'}`),
  no new tuning. Reconcile county FY totals on an all-funds basis (Phase 73). $0.

### County→city linking (UCO-02)
- **D-70-02: Membership comes from `docs/utah-entity-mapping.md` — NOT any API.** `seedCountyLinks.js`
  currently derives membership from the CA SCO ByTheNumbers Socrata dataset, which does not exist for Utah.
  Generalize the script with an explicit member-city list (e.g. a `--cities "A,B,C"` flag) that bypasses the
  SCO fetch when provided — mirroring how the non-SCO Massachusetts load was handled (`seedMACountyLinks.js`
  precedent). Invoke per county from the authoritative mapping:
  - **Salt Lake County** → Salt Lake City, Sandy City, West Jordan City, West Valley City
  - **Utah County** → Provo City, Orem City, Lehi City
  - **Davis County** → Layton City
  - **Weber County** → Ogden City
  - **Washington County** → St. George City

  All 10 cities map cleanly to exactly one of the 5 counties — **no orphans**. The county entities are seeded
  with `entity_type='county'`, `state='UT'` (via `treasury_ensure_municipality`, as `seedCountyLinks.js` already
  does). Cities are linked by setting `municipalities.county_id`; the never-relink/`--force` guard is kept.

### County population (per-capita)
- **D-70-03: Extend `loadUTPopulation.js` to set county population.** Cities used the Census sub-county
  *places* file (SUMLEV 162, `sub-est2024_49.csv`). Counties need the Census **county** file
  (co-est, **SUMLEV 050**, state FIPS **49**), at **vintage 2024** to match the cities (so per-capita is
  comparable across the hierarchy). Reuse the existing never-lower-a-non-zero-to-0 guard and the
  `treasury_ensure_municipality`/update path. Add a `--counties` mode (or a sibling loader) — implementation
  is the planner's call, but the vintage (2024) and source (Census co-est, SUMLEV 050, FIPS 49) are locked.

### Loader entity_type fix (REQUIRED — prevents a duplicate-entity bug)
- **D-70-04: Add an `--entity-type` flag to `loadUtahTransparency.js` (default `city`), set `county` for the
  county load.** **Verified bug:** `treasury_ensure_municipality` matches on `name AND state AND entity_type`,
  and `importEntityData` calls it **unconditionally with `p_entity_type:'city'`**. Loading "Salt Lake County"
  would therefore NOT match the seeded `county`-typed row → it would **INSERT a duplicate `city`-typed
  "Salt Lake County" phantom** and land the budget on it, leaving the real county entity directory-only.
  The flag must flow through to the `treasury_ensure_municipality` call so county loads reuse the seeded
  `county` row. **Sequencing:** 70-01 seeds the 5 county entities (`entity_type=county`) + links cities FIRST;
  70-02 then runs `loadUtahTransparency.js --entity "<X> County" --entity-type county` per county.

### Carried Forward (locked — from Phases 68/69 + the CA pipeline, confirmed by DB probe 2026-06-19)
- **Utah state node ALREADY EXISTS** — `treasury.municipalities` row `name='Utah'`, `state='UT'`,
  `entity_type='state'`, population 3,271,616 (year 2024), id `740cffee-3111-44c0-9473-a77acb6c42f8`.
  **Reuse it as the breadcrumb parent; do NOT create or re-seed it.** (No `seedUTState.js` needed; the
  state-level estimated budget on it from `processUT.js` is a separate `data_source` and is out of scope.)
- **State linkage is via the `state='UT'` field** already present on all 10 city rows (and the county rows we
  seed); **county linkage is via `county_id`.** The US→Utah→county→city chain resolves from these two fields —
  no explicit parent_id wiring needed.
- **`CitiesInCountyPanel.tsx` + breadcrumb panels are existing, data-driven** (built for CA Phases 63/64) —
  they render automatically once the county entities exist, carry budgets, and `county_id` is set. No new UI.
- **FY range = FY2014–FY2025; exclude partial FY2026** (D-69-04 / D-11). The 5 counties also cover FY2014–FY2026
  per the mapping doc.
- **Never-overwrite guard** (`findConflictingBudget` / `neverOverwriteDecision`): pre-skip any
  `(muni, fy, dataset)` row from a different `data_source`. Counties are expected all-new; the guard stays on.
- **Source attribution:** `data_source_name='Transparent Utah'` (Utah State Auditor), CC BY 4.0; `source_url`
  = the durable `transparent.utah.gov` portal (no per-entity deep link / `entity_id`); `source_date` computed
  once per run. Same as the city load.
- **Exact `entity_name` match, never `LIKE`** — counties are `Salt Lake County`, `Utah County`, `Davis County`,
  `Weber County`, `Washington County` (`govt_lvl='County'`). Decoys exist (Davis School District, etc.).
- **Utah fiscal year** = Jul 1–Jun 30 → `fiscal_year_start_month = 7` (confirm per county if any differ).
- **Runs serial on the main tree** (needs gitignored `.env` for Supabase + live ADC for BigQuery); no worktree
  isolation. Free-tier / $0 (column-projected, `entity_name`/`fiscal_year`/`type`-filtered BQ queries).

### Claude's Discretion
- Exact mechanism for the `--cities` / membership-list flag in `seedCountyLinks.js` (D-70-02) vs a thin
  `seedUTCountyLinks.js` variant — planner's call; the membership data is locked above.
- Whether D-70-03 county population is a `--counties` mode on `loadUTPopulation.js` or a sibling script.
- County-load sweep ordering (e.g. Salt Lake County canary first as the largest, then the other 4).
- Exact BigQuery SQL projection/filters to keep scanned bytes tiny.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Mapping & requirements (read FIRST)
- `docs/utah-entity-mapping.md` — the 5 county exact `entity_name` strings, `govt_lvl`, FY coverage, and the
  authoritative city→county membership table that drives D-70-02 linking (read FIRST).
- `.planning/REQUIREMENTS.md` (UCO-01, UCO-02) and `.planning/ROADMAP.md` §"Phase 70" — requirements + success criteria.

### Loader & linking scripts to extend
- `scripts/loadUtahTransparency.js` — the loader to extend for D-70-04 (`importEntityData` line ~199–203 hardcodes
  `p_entity_type:'city'`; add the `--entity-type` flag). Tree shape already correct (fund1→org1→cat1).
- `scripts/seedCountyLinks.js` — generalize for D-70-02 (its `fetchCountyCityNames` is CA-SCO-only; needs an
  explicit member-city list path). Already seeds `entity_type=county` + sets `county_id` idempotently.
- `scripts/seedMACountyLinks.js`, `scripts/seedLACountyLinks.js` — non-SCO / per-state linking precedents.
- `scripts/loadUTPopulation.js` — the city population loader to extend for D-70-03 (counties: co-est SUMLEV 050, FIPS 49, vintage 2024).
- `scripts/loadCountyBudget.js` — the CA county-budget analog (entity_type=county reuse, `--county`/`--entity` flags, all-funds basis).

### Prior context (decisions inherited)
- `.planning/phases/69-utah-city-budgets-load/69-CONTEXT.md` — D-69-01 (fund tree), D-69-03 (population pattern), D-69-04 (FY range).
- `.planning/phases/68-utah-bigquery-source-setup-loader/68-CONTEXT.md` — D-08/09 (source attribution), D-19 (exact entity_name), never-overwrite guard.
- `docs/utah-bigquery-access.md` — BigQuery access recipe (gcloud PATH, ADC, $0 discipline).

### Database contract
- `treasury_ensure_municipality` RPC — matches on `name+state+entity_type` (drives the D-70-04 fix); `treasury_sync_city_budget` — write contract (`dataset_type` operating/revenue).
- `src/components/CitiesInCountyPanel.tsx` — the data-driven panel that renders once county_id + county entities + budgets exist (no change expected).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`loadUtahTransparency.js`** — proven on the 10 cities (Phase 69). Reuse wholesale for counties; only the
  `--entity-type` flag (D-70-04) is new. Run `--entity "<X> County" --entity-type county --fy <y> [--dry-run]`.
- **`seedCountyLinks.js`** — idempotent county seed (`entity_type=county`) + `county_id` linking with `--force`
  guard. Only its membership source needs a Utah path (D-70-02).
- **`loadUTPopulation.js`** — city population loader (Census places, vintage 2024); extend for counties (D-70-03).
- **`CitiesInCountyPanel.tsx` + breadcrumb panels** — existing, data-driven; render automatically for Utah.

### Established Patterns
- **Never-overwrite guard lives in the loader, not the RPC** (`treasury_sync_city_budget` is not source-safe;
  `[[project_sync_city_budget_not_source_safe]]`).
- **Compact JSON tree** (`{n,a,c}`/`{n,a,i}`), children sorted by amount desc, zero-value rows skipped.
- **`treasury_ensure_municipality` keys on `name+state+entity_type`** — the basis for the D-70-04 fix (a `city`-typed
  call will not match a `county`-typed row and silently inserts a duplicate).

### Integration Points
- A county entity becomes visible/renders icicle+summary once its first `treasury.budgets` row lands (70-02);
  before that it would be directory-only. Cities-in-County + breadcrumb render once `county_id` is set (70-01).
- Production app reads `ev-accounts-api.onrender.com/api/treasury/cities`.

</code_context>

<specifics>
## Specific Ideas
- The D-70-04 loader bug was found by reading the live `treasury_ensure_municipality` definition + the loader's
  unconditional `p_entity_type:'city'` call — surfaced during discussion, not assumed. It is a correctness fix
  (prevents a phantom city + directory-only county), not a preference.
- "Use the same general approach we use for Federal or CA" (Chris, Phase 68) — drives the reuse-everything posture:
  no new tree scheme, no new UI, no new source. Counties mirror cities exactly except entity_type + population file.

</specifics>

<deferred>
## Deferred Ideas
- **Curated functional rollup** for the icicle (map fund/org → ~12 standard buckets) — deferred to enrichment (72)
  or a future pass, same as Phase 69.
- **FY2026 (partial current year)** — load + relabel once Utah's FY2026 county data is complete.
- **Counties whose only member city isn't in the 10** — N/A here; all 5 counties have ≥1 loaded member city.

</deferred>

---

*Phase: 70-utah-county-budgets-linking*
*Context gathered: 2026-06-19*
