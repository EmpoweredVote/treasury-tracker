# Phase 59: Remaining CA Cities History + Linking - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Bring the CA cities that sit outside the already-onboarded Orange County and Los Angeles County cohorts up to parity: **link** the unlinked ones to their counties (completing the US → California → County → city breadcrumb + Cities-in-County panel), give them **FY2003 budget history where the source allows it without overwriting their custom data**, and **resolve the one budget-less record**. Satisfies HIST-02 + ENR-02.

**The cohort (verified against the live DB 2026-06-16):**
- **6 real unlinked cities** (all custom-source, mostly thin/recent): San Francisco (custom FY2025–26), San Jose (GF op+rev FY2021–25), Oakland (GP-fund op only FY2024–25), Fresno (GF op only FY2020–26), Riverside (GF op only FY2023–26), Bakersfield (custom FY2025–26). All have `county_id = NULL`.
- **4 other-county cities** (already linked, shallow custom history): Berkeley (Alameda, FY2012–15), Fremont (Alameda, FY2019–26 op+rev), Sacramento (Sacramento, FY2013–26 op+rev), San Diego (San Diego, FY2025 only).
- **"Test"** — a record named literally "Test" with no budget, no county, no population. This is the "1 budget-less city" of success criterion #2; it is a test artifact, not a real city.

**In scope:** linking the 6 unlinked cities to their counties; creating the 5 missing county entities as linking-only nodes; per-city SCO history layering beneath thin custom cities (+ basis note); revenue completion for op-only cities via the SCO layer; deleting the Test record; light inline verification.

**Out of scope (other phases / milestones):** salaries sweep (Phase 60); category enrichment (Phase 61); formal ACFR reconciliation + source-chain audit + UAT (Phase 62); **full-county SCO expansion** of the touched counties (Kern, Fresno, Riverside, Santa Clara, Alameda, SF, etc.) and the 6 new SoCal counties (v2.4); county-government budget backfill for the newly created county nodes (v2.4).
</domain>

<decisions>
## Implementation Decisions

### History approach for the custom-source cities (HIST-02)
- **D-01:** **Per-city by thinness** — for the THIN custom-source cities (San Francisco, Oakland, Fresno, Riverside, Bakersfield, San Diego, Berkeley — recent-only and/or operating-only), **layer SCO all-funds FY2003–present history BENEATH their custom years** (the Phase 58 Long Beach / West Hollywood pattern, prior D-04), giving them real county-consistent history. Leave the **richer** cities custom-only (the Phase 58 Los Angeles pattern, prior D-05) where layering an all-funds seam beneath decent custom data would mislead more than it helps — the planner applies the same thinness judgment Phase 58 used (candidates to potentially leave custom-only: San Jose, Fremont, Sacramento). The never-overwrite guard always preserves every existing custom (fiscal_year, dataset) row.
- **D-02:** Any city that ends up with a **mixed-basis series** (SCO all-funds history beneath GF/custom recent years) MUST get a sourced basis note, reusing the **already-shipped `src/data/cityBasisNotes.ts` + `ComparabilityNote`** mechanism from Phase 58 (prior D-08). No new UI. Every note line carries a SourceChip (always-sourced standard).
- **D-03:** **Revenue gaps are filled by the SCO layer, not separately.** For the op-only cities (Fresno, Oakland, Riverside), the SCO layer carries both expenditures AND revenues for FY2003–present, so their revenue history is satisfied by D-01 — no separate revenue sourcing effort. Recent custom-only-operating years stay as-is (never-overwrite).

### SCO load scope — the expansion boundary (HIST-02)
- **D-04:** **City-targeted only.** Load ONLY the specific named target cities from SCO — do NOT run full-county SCO loads. The touched counties' OTHER member cities (i.e. full-county onboarding/expansion) remain deferred to **v2.4**. This keeps Phase 59 scoped to "remaining cities," not county expansion.
  - **Research flag (gates D-01/D-04):** confirm `scripts/bulkLoadStateController.js` can target/filter to specific cities within a `--county` run (a `--city` filter or a post-fetch filter). If it only operates whole-county, the planner must add a minimal city filter rather than load entire counties. This is the load-shape risk to resolve before any real load.

### County linking + entities (ENR-02)
- **D-05:** **Create the 5 missing county entities as linking-only nodes** (no county-government budget this phase): **Kern** (for Bakersfield), **Fresno** (for Fresno), **Riverside** (for Riverside), **Santa Clara** (for San Jose), and **San Francisco**. This matches the existing precedent — Alameda, Sacramento, and San Diego counties already exist as linking-only nodes (no budget) with linked cities. County-government budget backfill for these nodes is deferred to v2.4.
- **D-06:** **City→county links to apply:** Bakersfield → Kern; Fresno → Fresno; Oakland → **Alameda** (already exists); Riverside → Riverside; San Jose → Santa Clara; San Francisco → itself (see D-07). The 4 other-county cities (Berkeley, Fremont, Sacramento, San Diego) are already linked — they need history (D-01), not linking.
- **D-07:** **San Francisco = a single combined "City and County of San Francisco" node**, not a separate county node + nested city node (SF is a consolidated city-county; a self-nested breadcrumb would confuse). **Research flag:** verify how the app's breadcrumb + Cities-in-County panel render a city==county case, and choose the representation that renders cleanly; document the final shape.

### Data hygiene
- **D-08:** **Delete the "Test" record** after a quick confirmation it has no dependent rows (budgets/salaries/links). This honestly resolves success criterion #2 — it was never a real city. (If, unexpectedly, it has dependents, fall back to documenting it; not expected.)

### Verification depth (carry-forward from Phase 58 D-09)
- **D-09:** **Light inline checks only** in Phase 59 (FY-reach + source-chip presence on a sampled layered city, links/breadcrumb render live, custom cities untouched pre/post, Test record gone). Formal reconciliation + source-chain audit + Chris UAT remain **Phase 62**.

### Claude's Discretion
- The exact "thin vs rich" threshold for D-01 (apply Phase 58's judgment); per-`--fy` batching and dry-run-first sequencing per the runbook; the precise mechanism of the city filter (D-04 research flag); the authoritative city→county mapping confirmation (D-06 is the expected mapping).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline runbook + locked conventions
- `docs/socal-county-onboarding.md` — the hardened pipeline procedure + the 3 LOCKED conventions (durable `/d/` source URL, population backfill-only, never-overwrite existing custom data). Steps for city loading + linking are load-bearing here.

### Reusable scripts (no new tooling expected)
- `scripts/bulkLoadStateController.js` — city operating + revenue SCO loader (`--county`, `--fy`, `--source-date`); collision/never-overwrite + per-year population live here. **Must confirm it can target individual cities (D-04 research flag).**
- `scripts/seedCountyLinks.js` — county entity creation + city→county linking; the tool for D-05/D-06. Confirm it can create the 5 new county nodes and apply the links idempotently.
- `scripts/loadCountyBudget.js` — county-government budget loader; **NOT used this phase** (county-gov budgets deferred to v2.4) — referenced only to confirm the linking-only nodes don't accidentally get budgets.

### Prior-phase context (the patterns this phase mirrors)
- `.planning/phases/58-la-county-parity-backfill/58-CONTEXT.md` — D-04 (layer-beneath), D-05 (leave-custom-only), D-08 (basis note), D-09 (light verification) — directly reused here.
- `src/data/cityBasisNotes.ts` + `src/components/federal/ComparabilityNote.tsx` + `src/components/dashboard/SourceChip.tsx` — the shipped basis-note mechanism to extend (D-02).

### Milestone planning docs
- `.planning/REQUIREMENTS.md` — HIST-02, ENR-02 (this phase) + the named-custom-source-cities never-overwrite rule.
- `.planning/ROADMAP.md` §Phase 59 — goal + 4 success criteria; §v2.3 milestone — the v2.4 expansion deferral.
- `.planning/STATE.md` §v2.3 gap baseline — the unlinked/other-county/named-custom cohort counts.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bulkLoadStateController.js` / `seedCountyLinks.js`: the entire phase runs on these two v2.2-hardened scripts (plus the deletion of one record). No new loaders expected.
- `treasury_sync_city_budget` RPC: persists budget tree + durable source_url + source_date (the SCO-layer writer).
- `src/data/cityBasisNotes.ts` + `ComparabilityNote` + `SourceChip`: the shipped per-city basis-note mechanism (Phase 58) — extend the keyed map for any newly mixed-basis city.

### Established Patterns
- **Never-overwrite by (fiscal_year, dataset) source identity** — preserves every custom row while SCO fills empty/earlier years (proven on Long Beach / West Hollywood in Phase 58).
- **All-governmental-funds basis for SCO** vs GF/custom — the basis difference that triggers the D-02 note.
- **Linking-only county nodes** — Alameda / Sacramento / San Diego already exist as county entities with `min_fy = no budget` and linked cities; the model for D-05.
- Durable `/d/<id>` source_url + fetch date as `source_date`; per-year SCO population; population backfill-only (never lower a non-zero population).

### Integration Points
- `treasury.municipalities` (id, name, state, entity_type, population, **county_id**) — linking writes `county_id`; new county nodes are `entity_type='county'`, `state='CA'`.
- `treasury.budgets` rows (municipality_id × fiscal_year × dataset_type) gate app visibility; the SCO layer writes these.
- Breadcrumb (US → CA → County → city) + Cities-in-County panel render off `county_id`; **verify the city==county case for San Francisco (D-07)**.
- Backend lives in the separate **ev-accounts** repo (Render) — source-chip surfacing flows through `treasuryService.ts` (already wired for cities/counties).
</code_context>

<specifics>
## Specific Ideas

- Parity target mirrors Phase 58 exactly: layer SCO all-funds FY2003–2024 beneath thin custom cities, every figure sourced with durable `/d/` URLs + per-year population, basis note on any mixed-basis series.
- The cohort is small and named — this is a city-targeted, surgical phase, deliberately NOT a county-expansion phase.
- San Francisco's consolidated city-county status is the one structural oddity; resolve its representation against actual breadcrumb behavior, don't force a generic county+city shape.
</specifics>

<deferred>
## Deferred Ideas

- **Full-county SCO expansion** of every county touched for linking (Kern, Fresno, Riverside, Santa Clara, Alameda, San Francisco, Sacramento, San Diego) — load ALL their member cities. Deferred to **v2.4** (county expansion). Worth recording per touched county so it's not lost.
- **County-government budget backfill** for the 5 new linking-only county nodes (and the existing Alameda/Sacramento/San Diego nodes) — deferred to **v2.4** (matches the LA/OC county-gov treatment).
- Salaries for these cities → Phase 60; enrichment → Phase 61; formal ACFR reconciliation + source-chain audit + UAT → Phase 62.
</deferred>

---

*Phase: 59-remaining-ca-cities-history-linking*
*Context gathered: 2026-06-16*
