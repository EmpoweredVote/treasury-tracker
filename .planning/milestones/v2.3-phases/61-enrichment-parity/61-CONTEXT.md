# Phase 61: Enrichment Parity - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored from Phase 54 OC precedent + Chris decisions 2026-06-16; no discuss-phase / research subagents per standing cost preference)

<domain>
## Phase Boundary

Every parity-loaded budget category — the operating + revenue categories backfilled in Phases 58 (88 LA County cities + the LA County government entity) and 59 (the 7 thin other-county/unlinked cities), PLUS the salaries-dataset categories loaded in Phase 60 (~98 CA cities) — carries standardized, bleed-safe, plain-language enrichment (plain_name + descriptions), municipality-scoped or universal, matching the OC/LA County baseline, authored **inline at $0**.

**In scope:** Compute the enrichment gap set (top-level category name_keys not already covered by an existing city-scoped OR universal record) across the Phase 58/59/60 cohort, spanning the operating, revenue, AND salaries datasets; author the gap inline at $0; place generic taxonomy names as universal (inherited by all cities), city-specific content as city-scoped; verify coverage + bleed-safety across ≥3 cities.

**Out of scope (other phases / deferred):** Formal ACFR reconciliation + full source-chain audit + Chris UAT (Phase 62); the 6 new SoCal counties (v2.4); county-government budgets for the linking-only county nodes (v2.4); any paid `enrichCategories.js` Anthropic SDK run.
</domain>

<decisions>
## Implementation Decisions

### Authoring method + cost (the headline)
- **D-01 (locked):** The executing agent **AUTHORS the plain-language text INLINE at $0 API cost** and upserts rows directly to `treasury.category_enrichment`. The paid `scripts/enrichCategories.js` Anthropic SDK path is **NOT run** — the script is read for its exact write shape and gap-detection logic only. Mirrors Phase 54 D-01 and the standing feedback that LLM generation pipelines are authored inline (Empowered Vote is an unfunded nonprofit with a hard ~$5 gate). Same sourcing rules bind the inline author: category-level descriptions of generic municipal funds/departments — model memory is the basis only for generic civic-finance facts, never for city-specific claims.
- **D-02:** Mirror the `enrichCategories.js` `saveEnrichment` write shape exactly (lines 381–402): `name_key`, `municipality_id`, `plain_name`, `short_description`, `description`, `tags`, `source`, `confidence`, `evidence_summary`, `generated_at`; upsert `onConflict: 'name_key,municipality_id'` in schema `treasury`. `name_key` = `lower(trim(parent_name))|lower(trim(name))` for a child, `lower(trim(name))` for top-level.

### Consistency with the OC/LA baseline
- **D-03:** Match the LA County / OC baseline (Phase 54 D-04): top-level depth only (DEPTH=0, `parent_id IS NULL`), every field populated (plain_name 2–5 words, short_description 1 sentence, description 2–3 sentences, tags 3–6, confidence, evidence_summary), and the same stored `source` value LA/OC uses (probe first — Phase 54 used `'ai'` as the honest agent-authored marker).

### Bleed-safety (HARD)
- **D-04 (HARD):** Every universal (`municipality_id IS NULL`) row contains **strictly category-level text** — no city names, no dollar figures, no city-specific facts. Any text that would reference a city specific must be written **city-scoped** (`municipality_id = that city's id`), and even then the text stays generic. NEVER store city-specific content in a universal record. This is the exact bug fixed in `project_enrichment_scoping_fix` (Indiana/CA text bled into other cities via the universal join) — re-prevented here.
- **D-05 (Chris, 2026-06-16 — HYBRID):** **Universal-first placement.** Generic statewide SCO taxonomy names (operating/revenue funds) and generic salaries department names → write UNIVERSAL so all current + future CA cities sharing the name inherit them. Author universals first to maximize reuse; only genuinely city-specific names get a city-scoped row. This resolves a conflict in the original ENR-01 / SC#1 wording ("municipality-scoped, never universal" vs "consistent with the OC/LA baseline", which is universal-first): Chris chose hybrid. ROADMAP §Phase 61 SC#1 + REQUIREMENTS ENR-01 were updated 2026-06-16 to "universal for generic taxonomy, city-scoped for city-specific — no city-specific text ever stored in a universal record."

### Scope: cohort + datasets + salaries
- **D-06:** Enrichment cohort = the parity-loaded entities from Phase 58 (88 LA County cities + the LA County government entity) + Phase 59 (the 7 thin cities: San Francisco, Oakland, Fresno, Riverside, Bakersfield, San Diego, Berkeley). The 4–5 new linking-only county nodes from Phase 59 carry 0 budget rows → nothing to enrich, excluded.
- **D-07 (Chris, 2026-06-16):** **Salaries categories ARE in scope.** Phase 60 loaded the `salaries` dataset for ~98 CA cities. The salaries tree's top-level categories (depth 0) are **department names** (Police, Fire, Public Works, …) — generic and universal-eligible, bleed-safe. Enrich at top-level only (DEPTH=0); depth-1 position nodes carry a city-specific `(count)` suffix and are intentionally left unenriched, consistent with the established top-level-only convention.

### Gap computation timing
- **D-08 (Chris, 2026-06-16):** The gap set is computed at **execute time** via a blocking `checkpoint:decision` task (read-only production probe, $0) that records the LA/OC baseline, sizes the gap set, and confirms the $0 inline plan before any authoring — exactly the Phase 54 gating pattern. The plan stays a template (no hard-coded gap list) until execution.
- **D-09:** Enrichment is keyed by `name_key`, which is year-independent — a universal row covers the same category name across all backfilled years (FY2003–2024). Compute the gap at the latest loaded year per dataset (FY2024 for operating/revenue/salaries), AND additionally sweep distinct top-level name_keys across all loaded years per dataset (read-only) to catch any historical-only top-level names.

### Database target
- **D-10:** Production Treasury DB ONLY — repo `.env` / `.env.local` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service key required; anon key does not bypass RLS → writes fail silently), schema `treasury`. `mcp__supabase-local` MUST NOT be used (it is stale for this data).

### Verification scope (this phase)
- **D-11:** Light inline verification — coverage probe (every cohort city's top-level name_keys across op/rev/salaries resolve via (name_key, city) OR (name_key, NULL); 0 uncovered) + bleed-safety probe (0 universals carry city names / dollar figures) spot-checked across ≥3 cities. Formal ACFR reconciliation + source-chain audit + Chris UAT are deferred to Phase 62.

### Claude's Discretion
- Order of authoring; how to batch the gap set; exact wording of each plain_name/description (within D-03 richness + D-04 bleed-safety constraints); which 3+ cities to spot-check.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The template (Phase 54 OC enrichment — this phase is its re-application)
- `.planning/milestones/v2.2-phases/54-orange-county-entity-linking-enrichment/54-02-PLAN.md` — the exact 3-task gated pattern (gap-set GATE → author inline → verify) to mirror.
- `.planning/milestones/v2.2-phases/54-orange-county-entity-linking-enrichment/54-02-SUMMARY.md` — what the OC run produced (13 universal rows, $0, idempotent) + the name_key-inheritance insight.
- `.planning/milestones/v2.2-phases/54-orange-county-entity-linking-enrichment/54-CONTEXT.md` — origin of D-01 (inline $0), D-04 (match LA), D-05 (bleed-safety).

### Write shape + gap logic (reference only — DO NOT run the paid path)
- `scripts/enrichCategories.js` — `normalize()` (152–154), gap/skip logic `getExistingEnrichments`/`getUniversalEnrichments`/`getBudgetCategories` (181–253), output schema (319–348), `saveEnrichment` write shape (381–402), CAFR skip (421–426), DEPTH default `'0'` = top-level.
- `scripts/loadCASalaries.js` — salaries tree shape (lines ~380–448): top-level = department, depth-1 = `position (count)`; `dataset_type: 'salaries'`.

### Runbook + milestone planning
- `docs/socal-county-onboarding.md` — Step 3 (enrichment) + Step 4 (enrichment verification).
- `.planning/ROADMAP.md` §Phase 61 — goal + 3 success criteria.
- `.planning/REQUIREMENTS.md` — ENR-01.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `treasury.category_enrichment` table + the two-tier join (city-scoped first, then `municipality_id IS NULL` universal fallback) read by `treasuryService.ts` in the separate **ev-accounts** backend repo. Enrichment renders automatically once rows exist — no frontend work.
- `name_key` keying means a universal row authored here is inherited by every current + future CA city sharing the SCO/department taxonomy name — coverage compounds at no extra cost.

### Established Patterns
- Phase 54 OC enrichment: gap = city's top-level name_keys minus (city-scoped OR universal NULL); author universals first; idempotent upsert on (name_key, municipality_id).
- Bleed-safety automated probe (Phase 33 / Phase 54): scan universals for `$\d` and city-name tokens; exit nonzero on any leak.

### Integration Points
- LA County government entity id `f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1` (a county-type entity in the cohort — confirm its op/rev top-level names are covered).
- Many op/rev SCO taxonomy names are likely ALREADY covered by the Phase 54 universal set (inherited) → the operating/revenue gap may be small; the salaries department names are the likely net-new gap.
</code_context>

<specifics>
## Specific Ideas
- Expect the operating/revenue gap to be small (Phase 54 universals already cover the shared SCO taxonomy); the salaries department-name set is the likely net-new work.
- Salaries top-level enrichment (department names) is universal-eligible and bleed-safe — a citizen sees "Police Department → Police & public safety payroll" rather than a raw fund label.
</specifics>

<deferred>
## Deferred Ideas
- Depth-1 (position-level) salaries enrichment — out of scope (city-specific counts; top-level-only convention).
- Normalizing the 4 pre-existing generic-"$0" universals (Phase 54 note) — out of scope.
- Formal ACFR reconciliation + source-chain audit + UAT → Phase 62.
</deferred>

---

*Phase: 61-enrichment-parity*
*Context gathered: 2026-06-16 (inline)*
