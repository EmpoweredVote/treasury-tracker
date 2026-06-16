# Phase 55: Statewide City Salaries Integration - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning
**Source:** Inline discussion (4 gray areas — names policy, headline figure, year coverage, spike gate/fallback)

<domain>
## Phase Boundary

Confirm the statewide **CA Government Compensation source (publicpay.ca.gov)** covers
Orange County cities (spike-first — gates the build), then build a **reusable statewide
city-salaries loader** that imports employee compensation for any CA city from that source,
and load **Orange County** salaries.

Delivers:
- **SAL-01:** A spike that confirms publicpay.ca.gov coverage + depth for OC cities, documented.
  This spike GATES the rest of the phase — no loader build until it passes.
- **SAL-02:** A reusable, city-parameterized statewide salaries loader (one tool, any CA city)
  that writes a Department → Position compensation tree as a `salaries` dataset.
- **SAL-03:** OC cities show an employee-compensation (salaries) dataset wherever the source
  provides it.

**No frontend work.** The `salaries` dataset_type is already fully supported in the app
(DatasetTabs salaries card, search labels, `salariesTotal` plumbing, `totalCompensation`/
`avgCompensation` metadata). A salaries tab appears automatically once a `salaries` budgets
row lands for a city.

**Not in scope:** changing the LA County salaries display; loading salaries for non-OC cities
(the loader must *support* any CA city, but this phase only *loads* OC); any new visualization.

</domain>

<decisions>
## Implementation Decisions

### Names policy — aggregated, no individual names (headline values decision)
- **D-01:** The statewide standard is **position-level aggregation with NO employee names.**
  The deepest tree leaf is **Position** (Department → Position), where each position node carries
  the employee **count**, **total compensation**, and **average**. No individual employee rows,
  no names.
- **Why:** publicpay.ca.gov publishes per-position records **without names** anyway, and this
  matches the v2.0 safety line — *official public record only, no personal info, no targeting*
  (`project_federal_tracker_ground_rules`). It keeps the statewide standard clean and uniform.
- **Note on LA County divergence:** LA County's existing salaries dataset (Phase 25, ArcGIS
  source) shows individual names as leaf rows. That is left untouched — OC/statewide cities will
  simply be one level shallower (Position is the leaf). This divergence is acceptable and expected.

### Headline figure — Total Compensation, with the wages/benefits split preserved
- **D-02:** The salaries-tab total and the tree (department/position node `amount`) sum on
  **Total Compensation = wages + employer benefits** (employer retirement & health contributions).
  This matches LA County's `Total_Compensation`, so the salaries tab means the same thing across
  every CA entity.
- **D-03:** Each **position node also carries the wages-vs-benefits breakdown in metadata**
  (e.g. avg base, avg overtime/other, avg benefits) so a citizen can drill into the split —
  mirroring LA County's per-position metadata (`avgBase`/`avgBenefits`/`avgOvertime`).

### Year coverage — full available range
- **D-04:** Load **every year the source provides** for each covered OC city (publicpay coverage
  is roughly ~2009 through the latest reported year), to match the depth of the FY2003–2024
  operating/revenue history.
- **Volume caveat for planning:** salary records are per-employee, so a full-range × 34-cities
  load is the heaviest data pull in this milestone. The loader MUST be multi-year capable (the
  LA loader's repeatable `--fy` flag pattern). Planner should batch/page sensibly and consider
  whether the spike samples one city-year before committing to the full sweep.

### Spike gate — access + shape + sampled figure match (3-part pass condition)
- **D-05:** The SAL-01 spike PASSES (and authorizes the loader build) only when all three hold:
  1. **Access** — the source is programmatically reachable (API and/or CSV download) for OC
     cities, with no paywall/bot-block that blocks automation.
  2. **Shape** — the data fields support a Department → Position compensation tree summing on
     Total Compensation (i.e. department, position/job title, wages components, benefits).
  3. **Sample match** — a sampled OC city/year's loaded figures **reconcile against what's
     published on publicpay.ca.gov** (proves the data is real and correct before scaling).
- **Documented:** the spike writes its findings (coverage, depth, access method, sample
  reconciliation) so the gate decision is auditable.

### Fallback / partial coverage — load covered cities, document gaps, proceed
- **D-06:** If the source is missing or thin for some OC cities, **load every city it covers and
  document the gaps honestly** — cities with no/thin data simply get no salaries tab. Proceed
  without pausing. This satisfies SAL-03's "wherever the source provides it" and the
  never-fabricate ground rule. (Chosen over pause-for-alternate-source and abort-if-mostly-missing.)
- **Implication:** coverage breadth is NOT required up front (the spike samples, it does not
  enumerate all 34 cities first). The covered/gap set is discovered during the load and recorded.

### Claude's Discretion
- Exact source access mechanism (publicpay API endpoint vs per-entity CSV download) — confirmed
  by the spike.
- Department-name and position-title normalization/cleanup (cf. `processSalaries.js`
  `cleanDepartmentName`/`cleanPositionTitle`).
- Loader CLI surface and parameterization (e.g. `--city`/`--entity`, `--fy` multiple, `--dry-run`,
  `--no-names`-equivalent), consistent with existing loader conventions.
- The exact source-attribution string written to `treasury_sync_city_budget`
  (`p_data_source_name`) — honest naming of the CA State Controller / publicpay.ca.gov source.
- Whether to zero-skip records (LA loader skips zero-comp rows) and how to handle multi-employer
  rows for a city.
- The SAL-03/SC-4 verification SQL/probe specifics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The salaries-loader precedent (the pattern to generalize — read first)
- `scripts/loadLACountySalaries.js` — the canonical RPC-based salaries loader. Read for: the
  Department → Position → (leaf) tree builder (`buildTree`, `:85-159`), the compact `n/a/c/i`
  tree node shape, the `treasury_sync_city_budget` RPC call with `p_dataset_type: 'salaries'`
  (`:184-199`), the `--fy` multiple / `--dry-run` / `--no-names` CLI pattern, and zero-comp
  skip logic. **This phase generalizes this LA-specific loader into a statewide, city-parameterized
  one reading from publicpay.ca.gov** (LA used an LA-only ArcGIS FeatureServer).
- `scripts/processSalaries.js` — legacy file/CSV-based salaries processor. Reference for
  privacy-aware aggregation, department/position name cleanup, and the wages-vs-benefits
  metadata fields (base/overtime/other/benefits) — informs D-03's metadata split.

### The source (SAL-01 spike target)
- **publicpay.ca.gov** — CA State Controller's *Government Compensation in California (GCC)*.
  Statewide per-position compensation for cities/counties/special districts. The spike confirms
  programmatic access (API/CSV), schema, and OC coverage. (External — full URL/endpoint TBD by spike.)

### Frontend salaries support (no work — just confirm the contract)
- `src/App.tsx` — `DatasetType` includes `'salaries'`; `hasSalaries` gating, `salariesData`
  load via `loadBudgetData(..., 'salaries', ...)`, `salariesTotal` wiring (`:44,73,303-322,892,909`).
- `src/components/datasets/DatasetTabs.tsx` — `SALARIES_CARD`, `hasSalaries` 3-col layout,
  `salariesTotal` total source (`:39-93`).
- `src/types/budget.ts` — `dataset_type` union incl. `'salaries'`; `totalCompensation`/
  `avgCompensation` metadata fields (`:152,174-177`).

### Prior OC context this builds on
- `.planning/phases/54-orange-county-entity-linking-enrichment/54-CONTEXT.md` — OC entity +
  34-city linking (the cities salaries attaches to). Salaries was explicitly deferred here to Phase 55.
- `.planning/phases/53-orange-county-operating-revenue-load/53-01-SUMMARY.md` — the 34 OC cities,
  with Anaheim (FY2025/26) and Santa Ana (FY2023–26) as custom-sourced. Salaries is an additive
  dataset; the never-overwrite convention still applies to those cities' operating/revenue rows.

### Locked conventions (apply even though they don't mention salaries)
- `docs/socal-county-onboarding.md` — "Locked conventions": honest source attribution, never
  overwrite custom-sourced cities. (Does not cover salaries; conventions still hold.)

### Ground rules
- Auto-memory `project_federal_tracker_ground_rules` — the safety line (D-01): official public
  record only, no personal info, no targeting; never display unsourced data; free sources only / $0.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadLACountySalaries.js`: full working template for a salaries loader — paging, tree build,
  RPC sync, multi-year CLI. The phase's loader generalizes the *source* (publicpay, any city)
  while reusing the *write path* unchanged.
- `treasury_sync_city_budget` RPC: the write target. Called with `p_dataset_type: 'salaries'`,
  `p_total`, `p_tree`, `p_row_count`, `p_data_source_name`, `p_municipality_id`, `p_fiscal_year`.
- `treasury_ensure_municipality` RPC: resolves/creates the city's municipality id (loader already
  uses it for LA County). OC cities already exist (Phase 53/54) — loader should resolve, not create.
- `colorUtils.js` `SmartColorAssigner` + `processSalaries.js` name-cleanup helpers — optional reuse.

### Established Patterns
- **`salaries` dataset_type is a first-class, already-wired dataset.** No schema migration, no
  frontend change — a salaries tab appears for a city once its `salaries` budgets row exists.
- **Compact tree shape (`n`/`a`/`c`/`i`):** node name / amount / children / items(leaf rows).
  With D-01 (no names), Position nodes have no `i` array — Position is the leaf.
- **Multi-year loaders take repeatable `--fy`** and skip zero-comp records.

### Integration Points
- Loader → `treasury.budgets` (one `salaries` row per city × fiscal_year) + the salaries tree →
  the salaries tab renders automatically (frontend reads via `loadBudgetData`).
- Cities resolve through the OC entity/linking from Phase 54 — salaries attach to existing
  municipality records.

</code_context>

<specifics>
## Specific Ideas

- "publicpay.ca.gov" was named in the roadmap goal as the intended source; the spike confirms it
  before any build (spike-first is a hard gate, not a formality).
- Headline value = **Total Compensation** so the salaries tab reads identically to LA County's,
  but keep the wages/benefits split visible on drill-down (D-02/D-03).
- The loader is the deliverable's reusable core (SAL-02) — generalize, don't hard-code OC.

</specifics>

<deferred>
## Deferred Ideas

- Loading salaries for non-OC CA cities (the loader supports them; this phase only loads OC) →
  future milestone, trivially repeatable once the loader exists.
- Backfilling individual-name display or richer per-employee detail for publicpay cities →
  out of scope and against the safety line (D-01); not planned.
- An alternate compensation source (e.g. Transparent California) as a fallback → explicitly NOT
  this phase (D-06 documents gaps instead of switching sources). Revisit only if a future phase
  needs name-level or broader coverage.

None of the above is in this phase's scope.

</deferred>

---

*Phase: 55-statewide-city-salaries-integration*
*Context gathered: 2026-06-15 (inline — names/figure/years/spike-gate decisions captured)*
