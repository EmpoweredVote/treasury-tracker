# Phase 66: SoCal Enrichment Parity - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning
**Source:** Inline (orchestrator-authored from the Phase 61 enrichment precedent + script reads + a live production residual probe; no discuss-phase / research subagents per [[feedback_no_research_subagents]])

<domain>
## Phase Boundary

Brings the parity-loaded SoCal categories (operating, revenue, salaries) to the OC/LA enrichment baseline: standardized, plain-language, **bleed-safe** category enrichment (plain names + descriptions), authored **hybrid** (universal for generic taxonomy; city-scoped for anything city-specific) **inline at ~$0** (no paid AI). Closes ENR-03.

**Key framing — this is a small RESIDUAL, not a from-scratch enrichment.** Phase 61 already authored **577 universal `category_enrichment` rows** covering the CA operating + revenue taxonomy (100%) and every salary department shared by ≥2 cities. Those universal rows are keyed by `name_key` (dataset-independent) and already apply to the new SoCal cities via the two-tier fallback join. A live probe (2026-06-17) confirms the SoCal residual:

| Dataset | Distinct depth-0 keys (SoCal) | Uncovered | Uncovered shared by ≥2 SoCal cities |
|---------|-------------------------------|-----------|-------------------------------------|
| Operating | 94 | **0** | 0 |
| Revenue | 72 | **0** | 0 |
| Salaries | 1033 | 789 | **27** |

So Phase 66's authoring work ≈ **the ~27 uncovered salary department name_keys shared by ≥2 SoCal cities** (all generic municipal departments — e.g. "code enforcement department", "recreation department", "city manager department", "water treatment"), plus any op/rev residual that surfaces at author-time (expected 0). The ~762 single-city salary dept-name long tail is documented as a **deferred gap** (Phase 61 precedent + Chris's prior ruling: single-city dept names like "Police Department" are self-explanatory, low value).

**In scope:** Author universal generic enrichment for the uncovered ≥2-city SoCal name_keys; bleed-safe; verify ≥3 cities; document the single-city tail. **Out of scope:** the single-city salary long tail; re-authoring already-covered op/rev; any paid-AI enrichment; UAT (Phase 67).
</domain>

<decisions>
## Implementation Decisions

- **D-01 (scope = residual only):** Author universal generic enrichment for the **uncovered salary department name_keys shared by ≥2 SoCal cities** (~27 at probe time, executor re-confirms at author-time) + any op/rev residual (expected 0). Document the single-city salary long tail (~762) as a deferred gap. Mirrors Phase 61's op/rev-full + salaries-≥2-cities strategy.
- **D-02 (hybrid scoping + bleed-safety — CRITICAL):** Universal rows use `municipality_id = NULL` and MUST be **generic** — no `$` figures, no city names, no city-specific facts. The enrichment join is two-tier (municipality-specific → NULL universal fallback), so a NULL row renders on **every** city ([[project_enrichment_scoping_fix]] — the bleed bug). City-scoped rows (with `municipality_id`) only for genuinely city-specific categories (none expected; the 27 are all standard departments). No city-specific text in a universal record.
- **D-03 (tooling — reuse the Phase 61 resolver; minimal new code):** Reuse `data/caParityEnrichment61.mjs` (`CONCEPTS`) + `data/caParityEnrichment61_oprev.mjs` (`EXPLICIT_ROWS`, `ROUTE_RULES`) + the `resolve()` mapper from `scripts/loadCAParityEnrichment61.mjs` (explicit → keyword route → `general_dept` fallback). Build a SoCal worklist of the uncovered ≥2-city name_keys, resolve each to a CONCEPT, write a **committed** data/expansion file, and idempotently upsert on `(name_key, municipality_id)` — same deterministic, reviewable, dry-run-gated pattern as Phase 61. Add a new CONCEPT only if a name_key doesn't route (unlikely — all are standard departments). A small `loadSoCalEnrichment66.mjs` (mirroring the Phase 61 loader) is acceptable.
- **D-04 ($0 inline authoring):** The agent authors plain-language text directly (via the CONCEPTS library); the paid `enrichCategories.js` (Anthropic/Haiku) is NOT run. Total spend ~$0 (well under the gate, [[feedback_api_cost_threshold]]).
- **D-05 (name_key model):** `name_key` = `budget_categories.link_key` = lowercased category/department name (children: `parent|child`, via `normalize()` = `(name||'').toLowerCase().trim()`). The enrichment join is keyed by `(name_key, municipality_id)` and is **dataset-independent** — one universal row covers a name across operating/revenue/salaries for all cities.
- **D-06 (category source of truth):** Categories come from `treasury.budget_categories` (depth 0 = functional categories / departments; column `link_key` is the enrichment key), NOT the legacy `budgets.hierarchy` JSON (frequently null for newer rows). Coverage is measured against `treasury.category_enrichment` (2,951 rows; 577 universal at probe time).
- **D-07 (production DB):** Production Treasury DB only — repo `.env` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, schema `treasury`. NEVER `mcp__supabase-local`. Loaders don't auto-load `.env` — source it first (`set -a; . ./.env; set +a`).
- **D-08 (execution mode — serial main tree; DOES touch source files):** Runs serially on the main working tree (needs `.env` + production DB). Unlike Phases 63–65, this phase **creates committed data/loader files** (the SoCal enrichment worklist/expansion + optional loader, like Phase 61's `data/caParityEnrichment61*.mjs`), so `files_modified` is NOT empty.
- **D-09 (verification):** Confirm op/rev coverage stays 100% and the ≥2-city salary departments are now covered; **bleed-safety spot-check across ≥3 SoCal cities** — a universal row renders the same generic text everywhere and no city's specific text appears on another's categories; authored text contains no `$` figures. Document the single-city tail. No human checkpoint (UAT is Phase 67 / VER-06).
- **D-10 ($0 / deferred):** Single-city salary dept-name long tail (~762) deferred — self-explanatory, low value (Phase 61 precedent).
</decisions>

<canonical_refs>
## Canonical References

**Downstream executor MUST read these before implementing.**

- `.planning/phases/61-enrichment-parity/61-01-SUMMARY.md` — the precedent: gap-set method, $0 inline authoring, CONCEPTS + router, bleed-safety self-check, op/rev-full + salaries-≥2 strategy, single-city-tail deferral.
- `scripts/loadCAParityEnrichment61.mjs` — the loader to mirror (`resolve()` explicit→route→fallback; idempotent upsert on `(name_key, municipality_id)`; dry-run vs `--apply`; `$`-leak self-check).
- `data/caParityEnrichment61.mjs` (`CONCEPTS`) + `data/caParityEnrichment61_oprev.mjs` (`EXPLICIT_ROWS`, `ROUTE_RULES`) — the reusable concept library + router.
- `treasury.budget_categories` (depth 0, `link_key`) — category source of truth; `treasury.category_enrichment` (`name_key`, `municipality_id`, `plain_name`, `short_description`, `description`, `tags`, `source`, `confidence`, `evidence_summary`) — the enrichment table.
- [[project_enrichment_scoping_fix]] — the NULL-municipality_id bleed bug + rule. [[reference_treasury_budgets_probe_columns]] — probe column gotchas.
</canonical_refs>

<code_context>
## Existing Code Insights
- Phase 61's universal rows already cover the entire CA SCO op/rev functional taxonomy and ≥2-city salary departments; because SoCal uses the same statewide SCO/GCC taxonomy, op/rev arrived already 100% covered (probe: 0 uncovered) and only salaries has a residual.
- The 27 uncovered ≥2-city salary departments are standard municipal functions that route cleanly to existing CONCEPTS (police, fire, parks, water, public works, finance, city clerk, human resources, etc.) — new CONCEPTs are unlikely to be needed.
- `resolve()`'s `general_dept` fallback guarantees every name_key gets a sensible generic row even if it doesn't match a keyword route.
</code_context>

<specifics>
## Specific Ideas
- Sample of the 27 uncovered ≥2-city departments: code enforcement department, economic development department, recreation department, government services, parks & community services, engineering services, city manager department, city clerk department, land development, police investigations, fire operations, administrative services, public works wastewater/parks/street maintenance, wastewater, human resources / risk management, finance-administration, finance-purchasing, town manager, storm water, municipal services, parks & landscape, water treatment (plant), parks department.
- Bleed-safety spot-check cities: pick ≥3 across different counties (e.g. a Riverside, a San Bernardino, and a Ventura city) and confirm a universal-enriched department shows identical generic text and no foreign city's text.
</specifics>

<deferred>
## Deferred Ideas
- Single-city salary department-name long tail (~762) → deferred (self-explanatory, low value).
- Salary department-name canonicalization (FUP-03) → later milestone.
- Live-app UAT for enrichment rendering → Phase 67 (VER-06).
</deferred>

---

*Phase: 66-socal-enrichment-parity*
*Context gathered: 2026-06-17 (inline)*
