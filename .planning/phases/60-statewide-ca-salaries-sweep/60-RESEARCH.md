# Phase 60: Statewide CA Salaries Sweep — Research

**Researched:** 2026-06-16 (inline, no subagent — token-spend policy)
**Question answered:** "What do I need to know to PLAN this phase well?"
**Requirements:** SAL-04, SAL-05, SAL-06

This phase reuses the v2.2 GCC salaries pipeline wholesale. The only open questions were the
**target-DB state** (ROADMAP precondition) and the **sweep shape** for a multi-county cohort;
both are resolved below against the live code + the production database. **One small new tool is
expected** (a non-OC CA sweep wrapper); no new source or RPC.

---

## Precondition (ROADMAP flag) — confirm salary state against production → RESOLVED

The ROADMAP warned: *"salary state MUST be confirmed against the production/ev-accounts DB first
(local shows only Bloomington IN)."* Confirmed against the production Supabase project
`kxsdzaojfaibhuzmclfq` (the same DB the loaders write to and the app reads):

- **Salaries live in `treasury.budgets` with `dataset_type='salaries'`** (a Department→Position tree),
  NOT in the employee-detail `treasury.salaries` table (that table holds only Bloomington IN's
  detailed payroll — a separate model, irrelevant here).
- Current `dataset_type='salaries'` coverage: **36 CA cities, FY2009–2026**, comprising all **34 OC
  cities** (the v2.2 `sweepOCSalaries.js` run, FY2009–2024, 16 rows each) plus partial **Los Angeles**
  (FY2017–2026) and **Los Angeles County** (FY2021–2025).
- The "local shows only Bloomington" note referred to a local-dev DB. **Production has the OC sweep.**
  The target DB, source, loader, and write structure are all confirmed.

**Conclusion:** SC#1's spike gate is about *source coverage* (does GCC carry each target city?), not
about finding the data target — the target is settled.

---

## Source + loader mechanics (from Phase 55 spike + live code) → CONFIRMED

- **Source:** CA State Controller — Government Compensation in California (GCC),
  `https://gcc.sco.ca.gov/RawExport/{YEAR}_City.zip` — one statewide City ZIP per year, no paywall,
  static. Years available: **2009–2024**. (`scripts/loadCASalaries.js:55`, `sweepOCSalaries.js:44-45`)
- **Fetch quirk:** Node's built-in fetch gets HTTP 403; the loaders shell out to `curl` with a browser
  UA (`loadCASalaries.js:266`). Keep that.
- **No names ever** (D-01 from the Phase 55 spike): GCC city rows have no name columns; the loader
  builds an aggregated Department→Position tree only.
- **Total Comp = TotalWages + TotalRetirementAndHealthContribution** (D-02).
- **Write path:** `supabase.rpc('treasury_sync_city_budget', { p_dataset_type: 'salaries', ... })`
  (`loadCASalaries.js:431-434`) — the SAME RPC + durable-source mechanism the budget loaders use.
- **Source label:** `'CA State Controller — Government Compensation in California (publicpay.ca.gov)'`
  (`loadCASalaries.js:73`).
- **Gap policy (D-06):** a city missing from a year's CSV simply produces no row for that year — a
  documented gap, not an error (`sweepOCSalaries.js:338` treats a source gap as non-fatal).

---

## Sweep shape for a multi-county cohort → DECISION: generalize the download-once sweep

`scripts/sweepOCSalaries.js` is the right pattern but is hard-pinned to Orange County:
- It reads its city set **from the DB** by `county_id = OC_COUNTY_ID` and `entity_type='city'`
  (`:309-314`) — not hard-coded names.
- It downloads **each year's statewide ZIP exactly once**, then inner-loops cities (`:331-382`).
  This is essential: the per-city `loadCASalaries.js` re-downloads the (large) statewide ZIP on every
  call — sweeping 98 cities × 16 years that way = ~1,568 ZIP downloads. The OC sweep does 16.
- It writes a per-run results JSON (covered/gapped cities) (`:423`) — exactly the coverage artifact
  SC#4 wants.

**Decision:** add a minimal `scripts/sweepCASalaries.js` that mirrors `sweepOCSalaries.js` but selects
the target cohort = **all non-OC CA `entity_type='city'` municipalities** (configurable via an optional
`--county "<Name>"` filter and `--dry-run`). Reuse the download-once-per-year loop, the tree-build, the
`treasury_sync_city_budget('salaries')` write, the never-overwrite behavior, and the results-JSON
emitter verbatim. Leaving the proven OC sweep untouched avoids regression risk.

---

## Target cohort (verified against the live DB 2026-06-16)

- **98 non-OC CA `entity_type='city'` municipalities.** Of these only **Los Angeles** has any salaries
  today (partial FY2017–2026); the other **97 have zero**.
- Breakdown: **88 LA County cities** (Phase 58 cohort) + **10 other-county cities** (Berkeley, Fremont,
  Sacramento, San Diego, Bakersfield, Fresno, Oakland, Riverside, San Jose, San Francisco — the Phase 59
  cohort).
- The **12 named custom-source cities** (LA, Long Beach, West Hollywood, SF, San Diego, San Jose, etc. —
  "salaries + enrichment only", Chris decision 2026-06-16) are a subset spread across these 98. The
  sweep covers them all; SAL-05's "88 LA County + 12 named" is satisfied by sweeping the full non-OC set.

---

## Idempotency / never-overwrite → CONFIRMED safe to re-run

`treasury_sync_city_budget` keys on (municipality_id, fiscal_year, dataset_type). Re-running the sweep
re-writes same-source salaries rows with identical data (idempotent) and never disturbs a different
data_source. Los Angeles's existing FY2017–2026 salaries (whatever their source) are preserved; the
sweep adds GCC years it lacks. Dry-run first per the runbook.

---

## Spike-gate design (SC#1) — what "confirm coverage before writes" means

Download a sample GCC year ZIP (e.g., 2024 and an early year like 2009) and confirm a representative
slice of the target cohort (a few LA County cities + each of the 10 other-county cities + LA) appears in
`EmployerName`, with city-scale totals. Cities absent from the sample are flagged as expected gaps, not
blockers. This is read-only and gates the real sweep — mirrors the Phase 59 dry-run-gate discipline.

---

## Reconciliation (SC#3) — the Irvine-style check

Pick one swept city with a published total-compensation figure (e.g., Los Angeles or a large LA County
city) and confirm its latest GCC year (2024) total compensation reconciles to the published GCC/city
figure at ~$0 delta — the same check v2.2 used for Irvine. Light, sampled (D-09 carry-forward).

---

## Verification depth (carry-forward Phase 58/59 D-09)

Light inline checks only: spike-gate coverage confirmation, sampled FY-reach + source label on a swept
city, one reconciliation, per-city coverage/gap documentation, and a live-app spot-check for one city.
Formal multi-city reconciliation + full source-chain audit + Chris UAT remain **Phase 62**.

---

## Plan shape (3 plans, 3 waves)

1. **60-01 — Spike gate (SC#1):** read-only GCC coverage confirmation for the target cohort + author the
   `sweepCASalaries.js` wrapper (dry-run capable). Gates 60-02.
2. **60-02 — Statewide sweep (SC#2):** dry-run then real sweep of the 98 non-OC CA cities, FY2009–2024,
   via `sweepCASalaries.js`; never-overwrite; emit coverage results JSON.
3. **60-03 — Reconciliation + coverage docs (SC#3, SC#4):** one sample-city ~$0-delta reconciliation;
   per-city coverage/gap table; live-app spot-check.

---
*Phase: 60-statewide-ca-salaries-sweep*
*Researched: 2026-06-16 (inline)*
