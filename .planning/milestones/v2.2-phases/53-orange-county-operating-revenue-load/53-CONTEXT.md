# Phase 53: Orange County Operating + Revenue Load - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Source:** Inline (executes the Phase 52 runbook — no new research needed)

<domain>
## Phase Boundary

Execute **Step 1 (bulk load: operating + revenue)** of `docs/socal-county-onboarding.md`
against **Orange County**, then **Step 4 (verify)** the load. This loads operating
(expenditures) + revenue budgets for all 34 OC cities for FY2003–2024 from the SCO
ByTheNumbers feed using the already-shipped, hardened `scripts/bulkLoadStateController.js`,
auto-creating the 32 net-new city records with per-year populations.

Scope is the **data load + verification only**. The county-entity seed, city linking
(`seedCountyLinks.js`), and category enrichment (Steps 2–3 of the runbook) are explicitly
**Phase 54** (OC-03/04/05). No new code is written this phase — it runs the existing
pipeline. New cities surface in the app automatically once their datasets + populations
exist (per Phase 52 — no frontend work).

</domain>

<decisions>
## Implementation Decisions

### Fiscal-year range
- **D-01:** Load FY **2003 through 2024** (22 years, per the ROADMAP goal). The loader
  defaults to `[2023]` when no `--fy` is passed (`bulkLoadStateController.js:196`), so every
  year MUST be passed explicitly as a repeated `--fy`. Years with no SCO data for a city are
  handled gracefully (the loader logs "No data found" and continues — `:223`).

### Datasets
- **D-02:** Load **both** operating (expenditures) and revenue in the single run. The loader
  defaults `types` to `['expenditures', 'revenues']` (`:197`), satisfying OC-01 + OC-02 in one
  command.

### Source attribution + populations (inherited, locked)
- **D-03:** `--source-date 2026-06-14` (the fetch date). Budgets persist the durable
  ByTheNumbers dataset PAGE url + this fetch date via `treasury_sync_city_budget` (Phase 52
  locked convention #1). Created cities get the feed's per-year `estimated_population`
  (convention #2).

### Collision policy — Anaheim & Santa Ana untouched
- **D-04:** Anaheim and Santa Ana already hold custom-sourced budget data. The loader's
  never-overwrite collision pre-pass SKIPs them and logs
  `SKIP <city> (CA) — existing <source> data preserved` (convention #3). The expected result
  is **32 net-new cities created/loaded, 2 skipped**. Linking Anaheim/Santa Ana to the county
  is Phase 54, not here.

### Dry-run-first discipline
- **D-05:** Every write step is preceded by a `--dry-run --list-cities` pass that is read and
  confirmed before the real load (runbook prerequisite). The dry-run must list the OC cities and
  classify Anaheim/Santa Ana as SKIP before any write occurs.

### Chunked submit strategy (canary → 2-year chunks)
- **D-06:** Do NOT run all 22 fiscal years in one command. A single full run is ~450k Socrata-fetch +
  RPC-write rows (extrapolated from Phase 52's Ventura figures: ~6k rows for 10 cities × 1 year) and
  would exceed the executor's 600s command timeout, risking a partial load that looks complete.
  Instead: **canary** one recent year (FY2024), **verify it end-to-end**, then **backfill FY2003–2023
  in ~2-year submits**. Re-running a chunk is safe — `treasury_sync_city_budget` upserts on
  (municipality, fiscal_year, dataset_type) so a ByTheNumbers chunk is idempotent, and the collision
  pre-pass still protects other-source cities. The strict "all 34 cities" completeness check moves to
  the final verify (latest years may lag); the canary validates the *mechanism*, not completeness.

### Claude's Discretion
- Which city/year to spot-check totals against the ByTheNumbers source for success criterion #4.
- Exact verification SQL/probe mechanics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The runbook (the procedure this phase executes)
- `docs/socal-county-onboarding.md` — Step 1 (bulk load) is this phase; Step 4 (verify) closes
  it. Steps 2–3 (seed/link/enrich) are Phase 54. Section "Locked conventions" lists the three
  rules (source attribution, population, never-overwrite) that MUST hold.

### Pipeline core (shipped in Phase 52 — run, do not edit)
- `scripts/bulkLoadStateController.js` — `--county`, `--fy` (multiple, default `[2023]`),
  `--source-date` (default today), `--dry-run`, `--list-cities`; both datasets load by default;
  collision pre-pass SKIP-logs existing-source cities.
- Socrata datasets: `ju3w-4gxp` (expenditures → operating), `rrtv-rsj9` (revenues → revenue),
  host `bythenumbers.sco.ca.gov`.

### Phase 52 closeout
- `.planning/phases/52-socal-bulk-pipeline-hardening/52-04-SUMMARY.md` — runbook + Ventura
  dry-run validation proving the pipeline generalizes with zero writes.

</canonical_refs>

<specifics>
## Specific Ideas

- "One command" loads OC: `node scripts/bulkLoadStateController.js --county "Orange" --fy 2003 … --fy 2024 --source-date 2026-06-14`.
- County name passed to the loader must be exactly `"Orange"` (no "County" suffix) — matches the
  SCO `county` field.
- Expected dry-run shape mirrors the Ventura validation: N cities found per dataset, feed
  populations listed, "would import" with Anaheim/Santa Ana as SKIP.

</specifics>

<deferred>
## Deferred Ideas

- Orange County entity seed + linking all 34 cities (breadcrumb / Cities-in-County panel) → **Phase 54** (OC-03, OC-05).
- Category enrichment for OC cities → **Phase 54** (OC-04), cost-gated at $5.
- Backfilling the always-sourced standard to other existing city data → future milestone.

</deferred>

---

*Phase: 53-orange-county-operating-revenue-load*
*Context gathered: 2026-06-14 (inline — executes the Phase 52 runbook)*
