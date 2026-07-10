# Phase 129: Data Model + Load + Enrichment — Context

**Gathered:** 2026-07-10 (inline synthesis — no discuss-phase subagent, per project token/machine-strain policy)
**Status:** Ready for planning
**Source:** `.planning/TUCSON-SCOPING.md` (locked milestone decisions) + `.planning/REQUIREMENTS.md` (TUC-03..06) + Phase 128 outputs (`128-RECON.md`, `128-RESEARCH.md`, `extractTucson.py`)

<domain>
## Phase Boundary

Phase 128 proved the source and built the extractor (`scripts/extractTucson.py`, all 10 windowed FYs × 2 modes tie $0). Phase 129 turns that into live, navigable, sourced, enriched data:

1. **Data model** — seed the Tucson city node + a Pima County navigation node, and link them (`county_id`) so the `US → Arizona → Pima County → Tucson` breadcrumb + Cities-in-County panel render.
2. **Load** — run the extractor across the locked FY2015–FY2024 window and load GF operating (expenditure-by-function, 2-level) + revenue (revenue-by-source, flat) through the source-safe `treasury_sync_budget_tree` RPC, stamping a durable `source_url` + `source_date` on every loaded row.
3. **Enrichment** — author bleed-safe `category_enrichment` covering 100% of Tucson's loaded GF categories, inline at $0.

**Out of scope (fence):** Pima County's *own* government budget (navigation node only — no county financials). FY2025 (not yet published — honest newest-boundary gap). Any new source infrastructure or schema/RPC change. Verification + Chris UAT are **Phase 130**, not here.
</domain>

<decisions>
## Implementation Decisions

### Data model
- **D-01** — Tucson is seeded via `scripts/seedTucsonArizona.js` (name=`Tucson`, state=`AZ`, entity_type=`city`, population ~542,000 / 2024 vintage), idempotent (select-by-name+state → insert/update). `data_source` rows are **owned by the processor**, never the seeder (avoids `dataset_id` collision — the `seedGreshamOregon.js` convention). [TUC-03]
- **D-02** — A **Pima County** navigation node is seeded (state=`AZ`, entity_type=`county`, with population) under the existing Arizona state node, and Tucson is linked via `municipalities.county_id`. This is **decision (B)** from the scoping brief — the milestone locked it, overriding the brief's own §3 recommendation of (A) direct-under-Arizona. Pima County's own budget is out of scope (nav node only). [TUC-04]
- **D-03** — County node + link reuse the proven pattern from `scripts/seedCountyLinks.js` (`treasury_ensure_municipality` for the county entity; set `county_id` only where NULL or already this county — never repoint silently). Both the city and the county live in `seedTucsonArizona.js` as one idempotent seeder.

### Load
- **D-04** — Basis is **General Fund, GAAP actuals** (city ACFR), whole dollars (not thousands). Locked window is **FY2015–FY2024** (Phase 128; no interior holes). Load every year the extractor ties. [TUC-05]
- **D-05** — Load goes through the **source-safe `treasury_sync_budget_tree` RPC** — **never** `treasury_sync_city_budget` (which overwrites + keeps stale labels). Idempotency = per-`data_source_id`+`fiscal_year` pre-load delete then re-insert; a re-run nets **0 change**. [TUC-05]
- **D-06** — `data_sources` rows follow the **ephemeral WR-05/LOAD-01 lifecycle** (create fresh at start of run, delete at end) — the `budgets` rows carry text-stamp provenance, so a persistent `data_sources` row is unreferenceable residue. (`processAZAcfr.js` pattern.)
- **D-07** — Every loaded `budgets` row is stamped with a durable **`source_url`** (the per-FY tucsonaz.gov PDF URL pinned in `128-RECON.md`) + **`source_date`**, via a post-sync `.update()` (the `processAZAcfr.js` source-stamp pattern). [TUC-05]
- **D-08** — The extractor emits a nested `{n,a,c:[…]}` tree; the loader maps it to the RPC's `{n,a,i:[{d,a,aa,f,e}]}` shape. **Operating → 2-level icicle:** top nodes `Current` / `Capital outlay` / `Capital projects` / `Debt service`; `Current` and `Debt service` expand to their function/component children. **Revenue → flat.** [TUC-05]
- **D-09** — `source_date` is the honest as-of date of the financial data: the fiscal-year end (`June 30, <FY>`), unless the ACFR cover states an issue date. No fabricated dates.
- **D-10** — Per-capita ($/resident) renders from the seeded 2024 population; the "Money In" revenue view auto-enables because a `dataset_type='revenue'` dataset now exists. **No frontend code change** — both are data-driven. [TUC-05]

### Enrichment
- **D-11** — Enrichment is authored **inline at $0** (no paid AI path — API-cost guardrail). Worklist is derived **LIVE from production** (`treasury.budget_categories` for Tucson's loaded op+rev, the union across all loaded FYs) — not a guessed label list — so coverage is provably 100% of what actually loaded. (`loadSoCalEnrichment66.mjs` derivation pattern.) [TUC-06]
- **D-12** — Bleed-safe: **universal** rows (`municipality_id = NULL`) only where the label is genuinely shareable and the text carries **no** city-specific / $ / other-entity content; **city-scoped** rows (`municipality_id = Tucson`) otherwise. Universal writes use **delete-then-insert** (the `category_enrichment` NULLS-DISTINCT gotcha — upsert on `(name_key, municipality_id)` inserts duplicates when `municipality_id` is NULL). No cross-entity bleed. [TUC-06]

### Claude's Discretion
- Exact plan/task decomposition, script internals, and log formatting.
- Whether the Pima County node is written inside `seedTucsonArizona.js` or via a `seedCountyLinks.js` invocation (as long as population is set and the link is idempotent).
- Enrichment concept-library reuse vs. fresh authoring for Tucson's specific vocabulary.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth (Phase 128)
- `.planning/phases/128-recon-extractor/128-RECON.md` — locked window FY2015–FY2024, durable per-FY PDF URLs (→ `source_url`), tie deltas, era vocabulary variance.
- `scripts/extractTucson.py` — the extractor 129 loads from (`--mode operating|revenue`; emits `{n,a,c}` tree + `tie_delta`).
- `.planning/phases/128-recon-extractor/128-RESEARCH.md` — tree shapes, parsing landmines, whole-dollars basis.

### Analog code (copy these patterns)
- `scripts/seedGreshamOregon.js` — idempotent municipality upsert; data_source owned by processor. [D-01]
- `scripts/seedCountyLinks.js` — county entity via `treasury_ensure_municipality`; `county_id` link discipline. [D-02/D-03]
- `scripts/processGresham.js` — Python-extractor→RPC loader skeleton (spawnSync args-array, per-FY loop, `treasury_sync_budget_tree`, pre-load delete idempotency). [D-05/D-08]
- `scripts/processAZAcfr.js` — ephemeral `data_sources` lifecycle (WR-05), post-sync `source_url`/`source_date` stamp, per-capita, sanity assert. [D-06/D-07]
- `scripts/loadSoCalEnrichment66.mjs` — live worklist derivation from `budget_categories`; delete-then-insert universal rows. [D-11/D-12]

### Requirements
- `.planning/REQUIREMENTS.md` — TUC-03, TUC-04, TUC-05, TUC-06 (exact acceptance language).
</canonical_refs>

<specifics>
## Specific Ideas

- FY2024 grounding: GF revenue $773,493,270 / GF expenditure $648,657,363 / Excess $124,835,907 — the loaded totals must reproduce these (and every other windowed FY in `128-RECON.md`) at $0.
- Operating top-level icicle nodes: `Current` (→ Public safety & justice, Community enrichment & development, Support services, General government, Elected & official), `Capital outlay`, `Capital projects`, `Debt service` (→ Principal, Interest, Fiscal agent fees). Labels are per-FY (era variance is honest, not normalized).
- Load on `main`, not a worktree (`docs/Tucson/*.pdf` gitignored → worktrees unsafe, per v2.15 loader notes).
</specifics>

<deferred>
## Deferred Ideas

- FY2025 ACFR (not yet published as of 2026-07-10 — add when the city posts it, ~late 2026).
- Pre-FY2015 history (higher format risk; 10 years is a deep window for a one-off city).
- Pima County's own government budget (would be a separate onboarding).
- OpenGov adopted-budget forward-year layer (optional future context).
</deferred>

---

*Phase: 129-data-model-load-enrichment*
*Context synthesized: 2026-07-10 (inline)*
