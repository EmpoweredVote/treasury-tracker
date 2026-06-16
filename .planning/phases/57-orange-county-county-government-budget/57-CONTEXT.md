# Phase 57: Orange County County-Government Budget - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Load **Orange County's own county-government** operating + revenue budget from a
sourced published source and attach it to the **existing OC county entity**
(seeded in Phase 54), so the OC county page renders real budget data
(icicle/summary + working per-capita) instead of the directory-only fallback
shipped in Phase 56. The 34 linked OC cities must still list (no regression).

This is the county's **own** budget — distinct from the 34 city budgets already
loaded in Phase 53. Mirrors the county-government-budget precedent of LA County
(Phase 25) and the MA counties (Phase 41), and executes **Step 5** of
`docs/socal-county-onboarding.md`.

**In scope:** load OC county operating + revenue (all-governmental-funds basis,
multi-year); attach to the OC county entity with working per-capita; render the
existing icicle/summary on the county page; surface federal-style `SourceChip`
source tags **on the OC county page only**; build a **reusable** county-budget
loader; verify via `verify-phase57.mjs` + `57-VERIFICATION.md`.

**Out of scope:** loading/relinking the 34 cities (done in 53/54); adding new
datasets beyond operating + revenue; bringing `SourceChip` to *all* municipal
pages (that is the separate sourcing-backfill milestone); any new visualization
beyond the existing icicle/summary + per-capita.

</domain>

<decisions>
## Implementation Decisions

### Source document
- **D-01:** Primary load = **CA State Controller "ByTheNumbers" County datasets**
  via Socrata — **County Expenditures `uctr-c2j8`** (→ operating) + **County
  Revenues `emxv-k8xv`** (→ revenue), filtered `entity_name='Orange'`. This is the
  authoritative default and the same source family already used for the 34 OC
  cities. Mirrors the LA County (Phase 25) loaders exactly.
- **D-02:** The **OC published ACFR** (all-governmental-funds, ~$8–9B) is used as
  an **independent cross-check** to flag inconsistencies — NOT the primary load
  source. Cite the ACFR total(s) in `57-VERIFICATION.md` and document any delta vs
  the SCO figure. **If SCO and the ACFR conflict, SCO is the loaded value** (the
  ACFR delta is recorded as a documented variance, per the Phase 56 definitional
  finding that bases differ).
- **D-03:** Render **`SourceChip`-style source tags on the OC county page only**
  this phase (source name + "fetched <date>" + link to the durable SCO
  ByTheNumbers county dataset page). Reuse `src/components/federal/SourceChip.tsx`.
  Bringing source chips to every municipal page is the separate **sourcing-backfill
  milestone** — explicitly NOT this phase (confirmed with Chris).
- **Why:** SCO datasets give a machine-readable, multi-year, all-funds, durably
  sourced load with the lowest risk and maximal consistency with the city data;
  the ACFR provides an authoritative OC-government cross-check without taking on
  manual PDF extraction risk as the load path.

### Fiscal-year coverage
- **D-04:** Load the **full SCO County range (~FY2003–2024)**, matching the range
  the 34 OC cities already have, so the county page and its cities are consistent
  and the county gets full history + a year selector. Exact bounds follow data
  availability — years with no SCO county data are skipped gracefully (loader logs
  "No data found" and continues, per Phase 53 precedent).
- **D-05:** Apply the **chunked/canary load discipline** from Phase 53 (D-06):
  canary one recent year end-to-end, verify, then backfill the remaining years in
  small chunks. Writes are idempotent on (municipality, fiscal_year, dataset_type),
  so re-running a chunk is safe. Avoids the executor 600s command-timeout risk.

### Per-capita population (denominator)
- **D-06:** Use a **per-year OC county population if the SCO County feed carries
  `estimated_population`** (as the city feed does) — consistent with the city pages
  and the federal per-year denominator approach, and accurate across ~22 years of
  growth (~3.0M → ~3.2M). Where per-year is missing, **fall back to a single
  sourced figure** (CA Dept. of Finance E-series or Census) applied across years.
  Either way, **document the population source** in the load + `57-VERIFICATION.md`.
- **Why:** the LA loader hard-coded one figure; for a 22-year history a per-year
  series is more honest and matches how the federal tracker fixed per-capita
  (per-year denominators). Honest sourcing is a project ground rule.

### Loader: reusable, not OC-specific
- **D-07:** Build **one reusable county-government-budget loader** taking
  `--county`/`--entity` (+ `--fy` repeated, `--source-date`, `--dry-run`),
  generalizing the LA-hardcoded `loadLACountyOperating.js` / `loadLACountyRevenue.js`
  (which hardcode `entity_name='Los Angeles'` + a fixed population). Mirrors how
  `bulkLoadStateController.js` generalized the city load.
- **Why:** v2.2 is the "Reusable SoCal Pipeline" milestone and the onboarding
  runbook's **Step 5** is written as a repeatable per-county step. Generalizing now
  means every future county's own budget loads with one command instead of a new
  one-off clone (the LA scripts became permanent one-offs — D-07 avoids repeating
  that).

### Claude's Discretion
- **Category-tree mapping:** reuse the LA `buildTree` hierarchy (category →
  subcategory_1 → line items, all-funds basis); exact field handling per the SCO
  county schema.
- **Verification mechanics:** `verify-phase57.mjs` DB-probe (exit 0 on success) +
  `57-VERIFICATION.md` documenting coverage, the ACFR cross-check figure(s)/delta,
  the population source, and durable source attribution. Mirror
  `verify-phase3X.mjs` / the 53/56 VERIFICATION precedent.
- **Collision/clean-state check:** confirm the OC county entity currently has no
  budget rows (Phase 56 showed it directory-only) so the load is clean; honor the
  never-overwrite convention if any pre-existing rows are found.
- Which year/figure to spot-check against the ACFR for the cross-check.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The runbook + the lesson this phase closes
- `docs/socal-county-onboarding.md` — **Step 5 ("Load the county's own budget")**
  is this phase; "Locked conventions" (always-sourced durable page URL + fetch
  date; population backfill rule; never overwrite custom data) MUST hold. The doc
  records OC shipping cities-only as the gap Phase 57 fixes.

### County-government-budget load precedents (the pattern to generalize)
- `scripts/loadLACountyOperating.js` — LA County operating loader: SCO County
  Expenditures `uctr-c2j8`, `entity_name='Los Angeles'`, `buildTree`
  (category→subcategory_1→line items), writes via `treasury_sync_city_budget` RPC
  with `p_entity_type='county'` + hardcoded `p_population`. **Generalize this.**
- `scripts/loadLACountyRevenue.js` — LA County revenue loader: SCO County Revenues
  `emxv-k8xv` (note: the *county* revenue dataset, NOT the cities dataset).
- `scripts/loadMACountyBudget.js` — MA county PDF-based loader (Phase 41); the
  alternate ACFR/PDF precedent named in the roadmap (used here only conceptually —
  the ACFR is a cross-check, not the load path).

### City-load pipeline this generalization mirrors
- `scripts/bulkLoadStateController.js` — the reusable `--county`/`--fy`/`--dry-run`
  city loader (Phase 52); the model for D-07's reusable county-budget loader.
- `scripts/seedCountyLinks.js` — county entity seed + city linking (Phase 54); the
  OC county entity it created is what this phase's budget attaches to.

### Source-tag UI (D-03)
- `src/components/federal/SourceChip.tsx` — the v2.0 always-sourced source-pill
  (source name + "fetched <date>" + link). Its own comment notes it is currently
  federal-only and municipal data adopts it "in the sourcing-backfill milestone" —
  Phase 57 wires it onto the **OC county page only**.

### Prior OC phases (the entity + data this builds on)
- `.planning/phases/53-orange-county-operating-revenue-load/53-CONTEXT.md` +
  `53-VERIFICATION.md` — the 34-city load, chunked/canary discipline (D-05),
  source/population conventions.
- `.planning/phases/54-orange-county-entity-linking-enrichment/54-CONTEXT.md` — the
  OC county entity + 34-city `county_id` linking this budget attaches to.
- `.planning/phases/56-orange-county-verification-uat/56-CONTEXT.md` — the
  definitional finding (SCO totals are **all-governmental-funds**, not General
  Fund) and the budget-less "directory-only" county page that becomes the fallback.

### Verification precedent
- `scripts/verify-phase32.mjs` / `verify-phase33.mjs` / `verify-phase34.mjs` — the
  DB-probe verification-script pattern to mirror for `verify-phase57.mjs`.

### Ground rules + DB access
- Auto-memory `project_federal_tracker_ground_rules` — official public record only;
  never display unsourced data; document, never fabricate.
- Production Treasury DB (NOT `mcp__supabase-local`): repo `.env` `SUPABASE_URL` +
  `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadLACountyOperating.js` / `loadLACountyRevenue.js` — the operating + revenue
  county loaders to **generalize** into one `--county/--entity`-parameterized
  loader (D-07). `buildTree`, `parseAmt`, and the `treasury_sync_city_budget`
  `p_entity_type='county'` write path carry over directly.
- `SourceChip.tsx` — drop-in source-pill for the OC county page (D-03).
- `verify-phase3X.mjs` — DB-probe template for `verify-phase57.mjs`.

### Established Patterns
- **County budgets write via `treasury_sync_city_budget`** with
  `p_entity_type='county'` + `p_population` (LA precedent). D-07 makes county +
  population args instead of constants.
- **Source family = SCO ByTheNumbers**, durable dataset *page* URL (never the
  `/resource/*.json` API endpoint) + fetch date — same always-sourced convention
  as the city load.
- **All-governmental-funds basis** for SCO county totals (Phase 56 finding) —
  document it; the ACFR cross-check compares basis-to-basis.
- **Per-phase `*-VERIFICATION.md`** documents methodology + results (53/54/56).
- **Once budget rows exist, the county page renders the icicle/summary
  automatically** — Phase 56 made budget-less rendering the fallback, so frontend
  work is limited to the `SourceChip` wiring (D-03).

### Integration Points
- Loader → `treasury.budgets` / budget tree for the OC county `municipality_id`
  (`entity_type='county'`), operating + revenue.
- County page (live app https://treasurytracker.empowered.vote) → icicle/summary +
  per-capita + CitiesInCountyPanel (34 cities, unchanged) + new SourceChip.

</code_context>

<specifics>
## Specific Ideas

- "Do option 3, but link the sources with tags the way we showed sources on the
  federal swing. If we default to one, do SCO — the ACFR can be used to flag for
  inconsistencies." → D-01/D-02/D-03.
- SourceChip on the **OC county page only for now** (Chris) — not the full
  municipal backfill.
- County name passed to the loader matches the SCO `county`/`entity_name` field
  exactly: `"Orange"` (no "County" suffix), consistent with the city loader.
- The county revenue dataset is `emxv-k8xv` (the *county* feed) — explicitly not
  the cities revenue dataset, which would misrepresent county-government revenue.

</specifics>

<deferred>
## Deferred Ideas

- **Bring `SourceChip` source tags to all municipal pages** (cities + every
  county) → the separate **sourcing-backfill milestone**, not Phase 57.
- **Onboard additional SoCal counties' own budgets** with the new reusable loader
  (the runbook Step 5 for the next county) → future county-onboarding milestone;
  D-07's generalization is what enables it.
- **Exhaustive multi-year ACFR reconciliation** of the OC county totals → not this
  phase; Phase 57 does a documented cross-check spot, not a full audit.

</deferred>

---

*Phase: 57-orange-county-county-government-budget*
*Context gathered: 2026-06-15 (inline — source / year range / per-capita / loader reuse)*
