# Phase 59: Remaining CA Cities History + Linking — Research

**Researched:** 2026-06-16 (inline, no subagent — token-spend policy)
**Question answered:** "What do I need to know to PLAN this phase well?"
**Requirements:** HIST-02, ENR-02

This phase reuses the Phase 52-hardened pipeline and the Phase 58 LA-County parity
pattern wholesale. Two CONTEXT research flags gated the load shape and the SF
representation; both are resolved below against the live code. **No new tooling is
required.**

---

## Research flag D-04 — can `bulkLoadStateController.js` target individual cities? → RESOLVED: YES

`scripts/bulkLoadStateController.js` already supports a `--city <entity_name>` filter
(added alongside the `--county` arg):

- `main()` parses `city: { type: 'string' }` (line 184) → `const cityFilter = values.city || null` (line 194).
- The SCO `$where` clause is city-scoped when `--city` is set (lines 218–220):
  ```js
  const where = cityFilter
    ? `entity_name='${cityFilter}' AND fiscal_year='${fy}'`
    : `county='${county}' AND fiscal_year='${fy}'`;
  ```
  When `--city` is present the **county field is ignored** — the query targets exactly
  one `entity_name`. `--county` then only affects the log line, so it can be omitted
  (it defaults to "Los Angeles", harmless).

**Conclusion (gates D-01/D-04):** load each target city with its own
`--city "<name>"` invocation. This is genuinely city-targeted — it does NOT pull the
rest of the county. Full-county SCO expansion stays deferred to v2.4 exactly as
CONTEXT D-04 requires. **No `--city` filter needs to be added — it exists.**

**One caveat to resolve per-city at execute time:** `entity_name` must match SCO's
spelling, and SCO's expenditures dataset (`ju3w-4gxp`) may contain a county-level
`entity_name` that collides with a city name (e.g. "Riverside", "Fresno", "San
Francisco" exist as both a city and a county). The `--city` `$where` filters on
`entity_name` alone, so a dry-run per city (`--dry-run --list-cities`) MUST confirm
exactly the intended city's rows return with plausible totals before any real load.
The loader's own `findCityMunicipality` only matches `entity_type='city'`, so even
if SCO returns a county row, it would attach to the wrong muni only if a same-named
city muni doesn't exist — every target here already exists as a city muni, so the
dry-run is the guard. If a county-level row sneaks in, narrow with an exact-match
check at execute time.

The same never-overwrite collision policy (`findConflictingBudget`, lines 87–101)
and durable-source write (`treasury_sync_city_budget` with `p_source_url = ds.pageUrl`,
`p_source_date`, lines 159–169) apply unchanged. The loader writes
`data_source = "CA State Controller - Expenditures/Revenues"` (line 41), so any city
whose custom rows carry a *different* `data_source` is SKIP-logged and preserved —
the layer-beneath guarantee (D-01) is structural, not best-effort.

---

## Research flag D-07 — how does the app render a city==county (San Francisco)? → RESOLVED: keep SF a single city node, NO separate county node

The breadcrumb and Cities-in-County panel are both driven purely off
`municipalities.county_id`. There is **no special-case for a consolidated
city-county** anywhere in the render path:

- **Breadcrumb** (`src/App.tsx:539–564`, `jurisdictionParents`): for a `city` the
  chain is `[federal, state, county]` where
  `county = municipalities.find(m => m.id === selectedEntity.county_id)`. The county
  hop appears **only** when `county_id` is set and resolves to a node.
- **Cities-in-County panel** (`src/components/CitiesInCountyPanel.tsx:16–18`): lists
  every `m` where `m.county_id === county.id && m.entity_type === 'city'`.

If San Francisco the city were linked to a separate "San Francisco County" node, the
breadcrumb would render the redundant chain **US / California / San Francisco County /
San Francisco**, and the "Cities in San Francisco County" panel would list a single
city — itself. That is exactly the self-nested confusion CONTEXT D-07 warns against.

**Conclusion (final shape for SF):**
- **Do NOT create a "San Francisco County" entity.** SF stays a single
  `entity_type='city'` municipality with **`county_id = NULL`** (its current state).
- Breadcrumb then renders cleanly: **US / California / San Francisco** (no redundant
  county hop) — correct, because SF *is* its own county; there is no separate county
  level to traverse.
- No Cities-in-County panel for SF (correct — SF is sui generis; there is no county
  directory to populate).
- **Optional, recommended for honesty:** rename the muni `name` to
  **"City and County of San Francisco"** so the page/breadcrumb label states the
  consolidated status explicitly. This is a display nicety, not a structural change
  (`county_id` stays NULL either way). Left to executor discretion.

**Impact on CONTEXT D-05.** D-05 literally lists **5** county nodes to create
(Kern, Fresno, Riverside, Santa Clara, **San Francisco**). The D-07 resolution
removes San Francisco from that list: **create 4 county nodes** (Kern, Fresno,
Riverside, Santa Clara) and handle SF as the combined node above. This is the
documented reconciliation of the D-05/D-07 tension the CONTEXT explicitly flagged.

**Impact on success criterion #3** ("the 7 unlinked CA cities are linked via
`county_id`"): of the 7 NULL-county records, the **Test** record is deleted (D-08,
criterion #2), **5** cities get a real `county_id` (Bakersfield→Kern, Fresno→Fresno,
Oakland→Alameda, Riverside→Riverside, San Jose→Santa Clara), and **San Francisco** is
resolved as the consolidated combined node (no separate county to link to). All 7 are
accounted for; SF's "link" is its combined-node representation, documented as such.

---

## D-01 thin-vs-rich classification (apply Phase 58 judgment)

Layer SCO all-governmental-funds FY2003→latest BENEATH the custom years for the
**thin** cities (recent-only and/or operating-only — the Long Beach / West Hollywood
pattern). Leave the **rich** cities custom-only (the Los Angeles pattern — layering an
all-funds seam beneath decent custom data misleads more than it helps).

| City | County | Current custom data | Classification | Action |
|------|--------|---------------------|----------------|--------|
| San Francisco | (self) | custom FY2025–26 | **THIN** → layer | SCO layer + basis note + combined node |
| Oakland | Alameda | GP-fund op only FY2024–25 | **THIN** → layer | SCO layer (adds revenue too, D-03) + basis note |
| Fresno | Fresno | GF op only FY2020–26 | **THIN** → layer | SCO layer (adds revenue, D-03) + basis note |
| Riverside | Riverside | GF op only FY2023–26 | **THIN** → layer | SCO layer (adds revenue, D-03) + basis note |
| Bakersfield | Kern | custom FY2025–26 | **THIN** → layer | SCO layer + basis note |
| San Diego | San Diego | custom FY2025 only | **THIN** → layer | SCO layer + basis note |
| Berkeley | Alameda | custom FY2012–15 | **THIN** → layer | SCO layer + basis note |
| San Jose | Santa Clara | GF op+rev FY2021–25 | **RICH** → leave | link only, no SCO layer |
| Fremont | Alameda | op+rev FY2019–26 | **RICH** → leave | already linked; no SCO layer |
| Sacramento | Sacramento | op+rev FY2013–26 | **RICH** → leave | already linked; no SCO layer |

So **7 cities get the SCO layer** (SF, Oakland, Fresno, Riverside, Bakersfield, San
Diego, Berkeley); **3 stay custom-only** (San Jose, Fremont, Sacramento). Each layered
city whose series ends up mixed-basis (SCO all-funds beneath GF/custom recent years)
gets a sourced basis note (D-02). This is the planner's applied judgment — the executor
may adjust a borderline call after the per-city dry-run reveals the real SCO floor, but
must record any deviation.

**D-03 revenue completion is free:** the SCO layer carries BOTH expenditures and
revenues, so the op-only cities (Fresno, Oakland, Riverside) gain FY2003–latest revenue
history from the same layer — no separate revenue effort.

---

## County linking + entities (D-05/D-06) — `seedCountyLinks.js`

`scripts/seedCountyLinks.js` creates a linking-only county node (pop 0, no budget) and
links member cities idempotently. Confirmed behavior (read 2026-06-16):
- Reuses an existing county entity, never duplicates (Alameda already exists).
- Links a city only where `county_id` is NULL or already this county; a city linked to
  a *different* county is reported and NOT repointed without `--force` (lines 144–152).
- Never touches budget data (links are orthogonal to the history load).
- Derives membership from the SCO `county` field — it links every NULL-county DB city
  in that county's SCO membership, so a per-county **dry-run is mandatory** to confirm
  only the intended city appears in the "Would link" list (our DB only holds the named
  cohort + already-linked OC/LA cohorts, so the blast radius is the target city).

**Linking plan (D-06):**
| Command | Creates node | Links |
|---------|-------------|-------|
| `seedCountyLinks --county "Kern"` | Kern County (new) | Bakersfield |
| `seedCountyLinks --county "Fresno"` | Fresno County (new) | Fresno |
| `seedCountyLinks --county "Riverside"` | Riverside County (new) | Riverside |
| `seedCountyLinks --county "Santa Clara"` | Santa Clara County (new) | San Jose |
| `seedCountyLinks --county "Alameda"` | reuses existing | Oakland (Berkeley/Fremont already linked → reported) |
| — (no command) | — | **San Francisco: NO node; county_id stays NULL (D-07)** |

`scripts/loadCountyBudget.js` is **NOT used** this phase — county-government budgets for
all 5/4 new nodes are deferred to v2.4. The linking-only nodes intentionally have no
budget (matching the existing Alameda/Sacramento/San Diego precedent).

---

## Data hygiene (D-08) — the "Test" record

The record literally named "Test" (NULL budget, NULL county, NULL population) is the
"1 budget-less city" of success criterion #2. It is a test artifact, not a real city.
Before deletion, confirm it has zero dependent rows (no `treasury.budgets`, no salaries,
no `county_id` references). If clean → delete. If unexpectedly it has dependents →
fall back to documenting it with a reason (not expected). This honestly resolves
criterion #2.

---

## Basis-note mechanism (D-02) — extend `src/data/cityBasisNotes.ts`

Phase 58 shipped the exact mechanism to reuse — no new UI:
- `src/data/cityBasisNotes.ts` — a map keyed `"${name}|${state}"` (e.g. `"Fresno|CA"`).
  A city absent from the map renders no note (additive — pure-SCO cities, rich
  custom-only cities, counties, federal are unaffected). Entry shape =
  `ComparabilitySource` (title/text/source_name/source_url/source_date) — every entry
  carries a SourceChip (always-sourced).
- `src/components/federal/ComparabilityNote.tsx` + `src/components/dashboard/SourceChip.tsx`
  render it. No render-site change is expected beyond confirming the lookup key is hit
  for each newly mixed-basis city.

Add an entry for each layered city that ends up mixed-basis (SCO all-funds FY2003–2024
beneath its GF/custom recent years): **San Francisco, Oakland, Fresno, Riverside,
Bakersfield, San Diego, Berkeley** — adjust to the actual mixed set after the load (a
city whose custom years SCO fully subsumes, or which had no surviving custom rows on a
different basis, needs no note). Reuse the existing Long Beach / West Hollywood entry
text as the template; cite the durable `/d/ju3w-4gxp` page URL + `source_date 2026-06-16`.

---

## Load shape & sequencing (locked conventions, from the runbook)

`docs/socal-county-onboarding.md` locked conventions (do not regress):
1. **Durable source** — `source_url` = ByTheNumbers dataset PAGE url
   (`/d/ju3w-4gxp` expenditures, `/d/rrtv-rsj9` revenues), never `/resource/*.json`;
   `source_date` = fetch date (`--source-date 2026-06-16`).
2. **Population backfill-only** — SCO per-year `estimated_population` fills 0/NULL; never
   lowers a non-zero population.
3. **Never overwrite custom data** — different-source (fiscal_year, dataset) rows are
   SKIP-logged and preserved.

SCO ByTheNumbers covers ~**FY2003–FY2024**. **Always dry-run first** per the runbook.
Per-city loads are small (one city × ~22 years), so command-timeout risk is far lower
than the 58-01 full-county runs; still pin `--source-date 2026-06-16` and load in
year-chunks if any single submit is slow. Writes are idempotent on
(municipality_id, fiscal_year, dataset_type) — any chunk is safe to re-run.

---

## Plan decomposition (mirrors Phase 58: load → link → note → verify)

| Plan | Scope | Wave | Depends on | Reqs |
|------|-------|------|-----------|------|
| 59-01 | Layer SCO FY2003 op+rev beneath the 7 thin custom cities (`--city` loads), preserving custom years | 1 | — | HIST-02 |
| 59-02 | Create 4 county nodes + link 5 cities (SF combined node, no SF node) + delete Test record | 1 | — | ENR-02 |
| 59-03 | Add basis notes for the newly mixed-basis cities (extend `cityBasisNotes.ts`) | 2 | 59-01 | HIST-02 |
| 59-04 | Light inline verification (FY reach, source chips, links/breadcrumb live, custom untouched, Test gone) | 3 | 59-01,59-02,59-03 | HIST-02, ENR-02 |

59-01 (budgets) and 59-02 (municipalities) touch different tables/columns and are
independent → both wave 1. 59-03 depends on 59-01 (the mixed set is known only after the
layer lands). 59-04 verifies everything.

**Out of scope (do not let scope creep in):** full-county SCO expansion of any touched
county; county-government budgets for the new nodes; salaries (Phase 60); enrichment
(Phase 61); formal ACFR reconciliation + source-chain audit + UAT (Phase 62).

## RESEARCH COMPLETE
