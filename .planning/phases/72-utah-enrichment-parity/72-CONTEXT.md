# Phase 72: Utah Enrichment Parity - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Author standardized, plain-language, bleed-safe category enrichment (plain names + descriptions) for **every newly-loaded Utah budget category** — operating, revenue, and salaries — reusing the Phase 61/66 inline-authoring pattern (`category_enrichment` rows resolved via a concept library + keyword router + fallback) but with a **fresh Utah fund concept set** and a **fresh county-government department concept set** where Utah's taxonomy diverges from the CA SCO taxonomy. Inline-authored at ~$0 (no paid API spend beyond the documented $5 gate).

**In scope:**
- Universal (`municipality_id IS NULL`) enrichment rows for Utah op/rev **fund** names (depth-0) and **`fund|department`** composites (depth-1).
- Universal enrichment for Utah **salary department** names (depth-0), reusing the CA concept library + a fresh county-government concept set.
- A fresh Utah **fund** concept library (~25-35 fund types) — net-new, since CA CONCEPTS are department-oriented.
- A fresh **county-government** department concept set (~8-12 concepts) — assessor, recorder, sheriff, surveyor, clerk/auditor, commission, justice court, children's justice center, non-departmental, etc.
- An idempotent `--apply`/dry-run loader mirroring `loadSoCalEnrichment66.mjs` that derives its worklist LIVE from production and upserts on `(name_key, municipality_id)`.
- Explicit count of the deferred single-city salary-dept long tail.

**Out of scope (deferred):**
- Any depth-2+ authoring (Utah op/rev has no populated depth-2 as loaded — fund→department is the full tree).
- Bespoke per-composite authoring (we route, never hand-author 1,748 composites).
- Verification / ACFR reconciliation / source-chain audit / UAT — that is Phase 73 (UVER-01/UVER-02).

</domain>

<decisions>
## Implementation Decisions

### Enrichment depth
- **D-72-01:** Enrich **depth-0 AND depth-1**. Depth-0 = fund names (op/rev) + department names (salaries). Depth-1 = `fund|department` composite keys (op/rev). This goes one level deeper than CA's Phase 61/66 (depth-0 only) — the user explicitly wants the richer drill-down. Utah op/rev has **no populated depth-2** as loaded (verified live: operating depth-2 = 0 keys), so depth-0 + depth-1 is the full tree.
- **D-72-02:** Depth-1 `fund|department` composites are enriched by **routing the department portion** (the segment after the `|`) through the shared department concept library + keyword router, with `general_dept` fallback. This yields ~100% universal coverage **including the ~1,683 single-city composites** at $0 — because the text describes the standard department, not a bespoke per-fund line. (Live counts: operating depth-1 = 1,748 distinct composites, 65 shared by ≥2 cities, 1,683 single-city.)

### Fund concept set (net-new)
- **D-72-03:** Author a **fresh Utah fund concept library** for the depth-0 op/rev fund types. The CA CONCEPTS library is department-oriented and does **not** cover fund names. Funds to cover (from live depth-0 scan): General Fund, Capital Projects Fund, Debt Service Fund, Special Revenue Fund(s), Internal Service Fund(s), Enterprise Fund(s), Water Fund, Sewer Fund, Stormwater Fund, Permanent Fund(s), Trust & Agency Fund(s), Grants Fund, CDBG Fund, B&C Road, RAMP Tax Fund, Police/Fire/Wastewater/Sewer Impact Fee Funds, Redevelopment Agency (RDA), Economic Development Agency (EDA), Municipal/Local Building Authority, Ambulance Fund, Emergency 911 Dispatch Fund, Fleet Management, Library (fund), etc. (~25-35 concepts).
- **D-72-04:** Fund descriptions are framed **purpose + money source** with a light "separate pot of money" framing — e.g. General Fund = "the city's main account for day-to-day services like police, fire, and parks, paid mostly from taxes." Matches the existing CONCEPTS voice (purpose + funding source; enterprise funds noted as rate-funded). NOT accounting-technical, NOT name-only.

### Department concept set (reuse + extend)
- **D-72-05:** **Reuse the CA city CONCEPTS via the Phase 61 router** for all overlapping departments (police, fire, public works, finance, HR, library, parks, recreation, engineering, planning, city manager/council/attorney, etc.). This same library serves BOTH the salary depth-0 names and the depth-1 composite routing.
- **D-72-06:** Author a **fresh county-government concept set** (~8-12 concepts) for county departments the city-oriented library lacks — assessor, recorder, sheriff, surveyor, clerk/auditor, commission, justice court, children's justice center, non-departmental — with county-appropriate framing (bleed-safe, concept-level). (Counties in scope: Davis, Salt Lake, Utah, Washington, Weber.)

### Scope & bleed-safety posture
- **D-72-07:** **All rows universal** (`municipality_id IS NULL`), bleed-safe by construction — no city names, no $ figures, no entity-specific facts in any row. Mirrors Phase 61/66. SC#1's "hybrid" allowance is satisfied because Utah fund + department names turned out fully standardized; city-scope a row only if a genuinely city-specific case appears during authoring (none expected). Enforce the `$`-leak guard from `loadSoCalEnrichment66.mjs` (abort if any `$\d` appears in authored text).
- **D-72-08 (single-city salary-dept tail):** Run **every** salary department name through the router. Names that match a real concept get text (even single-city). Names that hit **only the `general_dept` fallback** are **counted + DEFERRED** (left showing raw names) per SC#3 and the Phase 61/66 precedent — no meaningless generic text applied at the salary top level. The deferred count must be reported by the loader.
- **D-72-09 (deliberate fallback asymmetry — NOT an oversight):** The `general_dept` fallback is **written** at depth-1 op/rev composites (it reads sensibly as "a department within the [fund]") but **deferred** at the salary depth-0 level (a bare idiosyncratic dept name with only generic text adds little). Planner should implement this boundary precisely; in practice depth-1 fallback is rare because the dept word is almost always standard.

### Claude's Discretion
- Exact concept IDs, router keyword rules, tag lists, and `evidence_summary` wording — left to the executor, provided D-72-04's voice and D-72-07's bleed-safety hold.
- Whether the Utah loader is a new sibling script (e.g. `loadUtahEnrichment72.mjs`) or extends an existing one — planner's call; the SoCal script is the template.
- Whether to factor the fresh fund + county concepts into a new `data/utahEnrichment72.mjs` module (recommended, mirrors `data/socalEnrichment66.mjs`) vs inline.
- How a depth-0 op key that is actually a department (e.g. "library", "fleet management", "redevelopment agency") is routed (fund concept vs dept concept) — router precedence is executor's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The pattern to mirror (enrichment authoring + loader)
- `scripts/loadSoCalEnrichment66.mjs` — the Phase 66 loader to mirror: live worklist derivation from production, resolver chain (EXACT_OVERRIDE → EXPLICIT_ROWS → ROUTE_RULES → general_dept fallback), `$`-leak guard, idempotent upsert on `(name_key, municipality_id)`, dry-run vs `--apply`.
- `scripts/loadCAParityEnrichment61.mjs` — the Phase 61 universal-authoring precedent (op/rev 100% + salary depts ≥2 cities; single-city tail deferred).
- `data/caParityEnrichment61.mjs` — `CONCEPTS` (57 department/utility concepts, the exact voice to match) + `SOURCE`. REUSE for Utah departments.
- `data/caParityEnrichment61_oprev.mjs` — `EXPLICIT_ROWS` + `ROUTE_RULES` (ordered keyword router). REUSE the router mechanism.
- `data/socalEnrichment66.mjs` — `SOCAL_EXACT` exact-override pattern; template for the new `data/utahEnrichment72.mjs` fund + county concept module.

### Schema + bleed-safety
- `category_enrichment` table (treasury schema) — columns: `name_key, municipality_id, plain_name, short_description, description, tags, source, confidence, evidence_summary, generated_at`; upsert conflict key `(name_key, municipality_id)`; two-tier join (city-scoped row wins, NULL = universal fallback).
- `src/services/treasuryService.ts` — the two-tier enrichment join the app uses to resolve names (city-specific first, then NULL universal). The reason NULL rows must be entity-agnostic.

### Prior phase decisions carried in
- `.planning/phases/69-utah-city-budgets-load/69-CONTEXT.md` — D-69-01 fund-first tree shape (op/rev). NOTE: as loaded, op/rev is fund(depth0)→department(depth1) with no depth-2.
- `.planning/phases/71-utah-city-salaries-compensation/71-CONTEXT.md` — D-71-02 2-level salary tree (Department → Wages/Benefits); D-71-01 names-free.
- `.planning/REQUIREMENTS.md` — UENR-01 (the requirement this phase satisfies).
- `.planning/ROADMAP.md` — Phase 72 entry (success criteria 1-3, "fresh Utah universal set" directive).

### Lessons (must respect)
- Memory `project_enrichment_scoping_fix.md` — the NULL-`municipality_id` bleed incident: never leave `municipality_id` NULL unless text is genuinely entity-agnostic. Here ALL rows are universal **by design**, so text MUST contain no city names / $ figures / entity facts (D-72-07).
- API cost gate: estimate before any AI run; stop + get approval if >$5 (Empowered Vote is unfunded). This phase is inline-authored at $0 — no paid API path.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CONCEPTS` (`data/caParityEnrichment61.mjs`) — 57 proven department/utility concepts; reused verbatim for Utah department names (salaries depth-0 + op/rev depth-1 routing).
- `ROUTE_RULES` + `EXPLICIT_ROWS` (`data/caParityEnrichment61_oprev.mjs`) — ordered keyword router; reused as the routing engine, extended with Utah fund + county keywords.
- `loadSoCalEnrichment66.mjs` resolver + live-worklist + `$`-leak guard + idempotent batched upsert — copy structure for the Utah loader.

### Established Patterns
- Inline-authored, $0, universal-row enrichment with bleed-safety by construction (Phase 61/66). Worklist derived live from production `budget_categories` (paginate past 1000-row cap; chunk `.in()` queries at ~25-30 ids).
- Resolver chain: exact-override → explicit → keyword route → generic fallback; log `via` bucket counts + fallback list + `$`-leak count (must be 0).

### Integration Points
- Writes land in `treasury.category_enrichment`; the app reads them via the two-tier join in `treasuryService.ts` — no app/frontend change needed.
- Worklist source: Utah municipalities (`state = 'UT'`: 10 cities + 5 county govts; 16 muni rows incl. the UT state row) → their `budgets` (operating/revenue/salaries) → `budget_categories` depth-0 and depth-1.

</code_context>

<specifics>
## Specific Ideas

- Live-verified Utah landscape (2026-06-20 scout):
  - **operating** depth-0: 770 distinct fund keys (33 ≥2-city); depth-1: 1,748 `fund|dept` composites (65 ≥2-city, 1,683 single-city); depth-2: 0.
  - **revenue** depth-0: 740 distinct fund keys (36 ≥2-city).
  - **salaries** depth-0: 660 distinct department keys (51 ≥2-city, 609 single-city tail).
- Op/rev depth-0 keys are **fund** names (general fund, sewer fund, debt service fund, enterprise funds, impact fee funds, RDA/EDA...); salary + depth-1 keys are **department** names (police, fire, public works, finance, HR... + county: assessor, recorder, sheriff, surveyor, clerk/auditor, justice court).
- The user wants richer drill-down than CA parity (enrich the department-within-fund level), achieved at $0 via routing rather than bespoke authoring.

</specifics>

<deferred>
## Deferred Ideas

- **Single-city salary-dept long tail** (~609 idiosyncratic names matching only `general_dept`): counted + deferred per SC#3 / D-72-08 — left showing raw names, no generic text applied.
- **Verification** (ACFR reconciliation, source-chain audit, live-app UAT): Phase 73 (UVER-01/UVER-02), not this phase.
- None of the discussion strayed outside the enrichment domain — no new-capability scope creep surfaced.

</deferred>

---

*Phase: 72-utah-enrichment-parity*
*Context gathered: 2026-06-20*
