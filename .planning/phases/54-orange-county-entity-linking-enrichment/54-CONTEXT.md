# Phase 54: Orange County Entity, Linking + Enrichment - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning
**Source:** Inline discussion (executes Steps 2–3 of the Phase 52 SoCal runbook — no new pipeline code)

<domain>
## Phase Boundary

Execute **Step 2 (seed county entity + link cities)** and **Step 3 (category enrichment)**
of `docs/socal-county-onboarding.md` against **Orange County**, then **Step 4 (verify)**.

Delivers:
- **OC-03:** Orange County entity (`entity_type='county'`) seeded once; all 34 OC cities
  linked via `municipalities.county_id`, powering the US → California → Orange County → city
  breadcrumb chain and the "Cities in Orange County" panel.
- **OC-05:** Anaheim and Santa Ana linked to the county **without altering** their existing
  custom-sourced budget data.
- **OC-04:** Each OC city's budget categories carry plain-language enrichment
  (plain name + description), consistent with the LA County baseline.

Scope is **linking + enrichment + verification only**. The operating/revenue data load was
Phase 53 (done). No new pipeline code is written — this runs the already-shipped
`seedCountyLinks.js` (Step 2) and writes enrichment rows to `category_enrichment` (Step 3).
Per Phase 52, linked cities and enrichment surface in the app automatically — no frontend work.

</domain>

<decisions>
## Implementation Decisions

### Enrichment is authored INLINE by the agent at $0 API cost (headline decision)
- **D-01:** Do **NOT** run the paid `enrichCategories.js` Anthropic path (`@anthropic-ai/sdk`,
  billed `ANTHROPIC_API_KEY` calls). Instead, the executing agent **generates the plain-language
  text itself inline** (as part of the Claude Code session — no separate billed API calls) and
  writes the rows **directly** to `treasury.category_enrichment` via the Supabase service key.
- **Why:** Empowered Vote is an unfunded nonprofit and has seen surprising API overages
  (see `feedback_api_cost_threshold`). The user explicitly asked for zero-cost enrichment.
- **Target cost: $0.** If any portion genuinely cannot be authored inline and would require a
  paid API call, **STOP and ask before spending** — do not auto-spend, even under the $5 gate.

### Enrichment write shape (mirror the script exactly so the app renders it identically)
- **D-02:** Upsert into `category_enrichment` on conflict `(name_key, municipality_id)` with the
  same columns the script writes: `name_key` (normalized `parent_name|name` or `name`),
  `municipality_id`, `plain_name` (2–5 word citizen-friendly name), `short_description`
  (one sentence), `description` (2–3 sentences: what it is, why it exists, how funded),
  `tags` (array), `confidence`, `evidence_summary`. Use `source` to honestly mark these as
  agent-authored inline enrichment (planner to confirm the exact `source` value LA used / an
  appropriate non-`'ai'` marker if warranted; keep consistent with LA's records).

### Scope — reuse LA baseline, fill gaps only
- **D-03:** Reuse the shared CA SCO taxonomy already enriched for the LA County 88. Only enrich
  the **gap set**: OC category `name_key`s **not already covered** for an OC city (i.e. not in the
  universal `municipality_id IS NULL` set and not already city-scoped for that city). The script's
  own "already enriched (universal OR municipality-specific)" skip logic defines the gap — replicate
  that filter before authoring anything.

### Depth + storage pattern — match LA County's current (post-fix) records
- **D-04:** Inspect LA County's **current** `category_enrichment` records to set the bar, then match:
  the same **depth/level** of categories enriched, the same field richness, and the **same
  universal-vs-city-scoped placement convention** LA uses post-fix.

### Bleed-safety (hard constraint — learned from a prior production bug)
- **D-05:** Generated text MUST be **strictly category-level** (describe the SCO fund/category name
  itself) with **no city-specific names, figures, or facts**. A prior bug stored city-specific text as
  universal (`municipality_id IS NULL`), bleeding Indiana/CA text into other cities (since fixed —
  see `project_enrichment_scoping_fix`). Generic SCO taxonomy names (uniform statewide) may live in
  the universal set to maximize reuse; anything with city specifics MUST be city-scoped. **Never put
  city-specific content in a universal record.**

### Linking (Step 2) — deterministic, free, collision-safe
- **D-06:** Run `seedCountyLinks.js --county "Orange"` (dry-run first). It seeds the OC entity once
  (idempotent, never duplicates), derives membership from the same SCO `entity_name` feed as the
  loader, and sets `county_id` only where NULL or already this county. It **never touches budget
  data**, so Anaheim/Santa Ana are linked without altering their custom data (OC-05). No AI cost.

### Anaheim & Santa Ana — auto-link, reconcile name mismatch if needed
- **D-07:** Expect the standard link to attach both via SCO `entity_name` match. If a stored-name
  mismatch blocks linking for either custom city, **reconcile the city's name/record so it links** —
  without touching its budget rows or `data_source`. (Chosen over verify-only: OC-05 requires them
  linked, not merely reported.)

### Claude's Discretion
- Exact `name_key` gap-detection query/probe mechanics and which fiscal year's categories to enrich
  (likely the latest loaded year, matching how LA was enriched).
- Whether a given generic SCO category name is stored universal vs city-scoped, bounded strictly by
  D-05 (no city-specific content in universals).
- The verification SQL/probe specifics for Step 4.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The runbook (the procedure this phase executes)
- `docs/socal-county-onboarding.md` — Step 2 (seed county + link), Step 3 (enrich), Step 4 (verify),
  and "Locked conventions" (source attribution, population, never-overwrite). Note Step 3 documents
  the *paid* path; D-01 replaces it with inline authoring writing the **same** rows.

### Pipeline core (shipped in Phase 52 — run, do not edit)
- `scripts/seedCountyLinks.js` — generic county seed + link helper: `--county`, `--state`,
  `--dry-run`, `--force`. Idempotent, collision-safe, never touches budget data.
- `scripts/enrichCategories.js` — **reference only.** Read it for the exact `category_enrichment`
  write shape (`:385-400`), `name_key` normalization (`:383-384`), the "already enriched" skip set
  (`:234-252`), the prompt/output schema (`:319-348`), and CAFR-format skip logic (`:421-426`).
  Do **not** run its paid Anthropic path (D-01).

### Prior context
- `.planning/phases/53-orange-county-operating-revenue-load/53-CONTEXT.md` — the data load this builds on.
- `.planning/phases/53-orange-county-operating-revenue-load/53-01-SUMMARY.md` — 34 cities loaded,
  Anaheim custom = FY2025/26, Santa Ana custom = FY2023–26 (the rows linking must not disturb).
- `.planning/phases/52-socal-bulk-pipeline-hardening/52-04-SUMMARY.md` — runbook + pipeline validation.

### LA County baseline (the consistency target for D-03/D-04)
- LA County enrichment records in `category_enrichment` — inspect to set depth + storage pattern.
- `scripts/seedLACountyLinks.js`, `scripts/loadLACountyOperating.js`, `scripts/loadLACountyRevenue.js`
  — how the LA baseline was built (for reference).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `seedCountyLinks.js`: one-command, county-parameterized linking. `node scripts/seedCountyLinks.js --county "Orange"` does all of Step 2 (OC-03 + OC-05) with no per-county code.
- `category_enrichment` table + `(name_key, municipality_id)` upsert: the write target for inline enrichment; the app reads enrichment by `(name_key, this-city)` OR `(name_key, NULL universal)`.

### Established Patterns
- **Universal vs city-scoped enrichment:** `municipality_id IS NULL` = inherited by every city; city id = that city only. Only universals cross cities — LA's city-specific records are NOT inherited by OC, so the gap set is "OC name_keys not in the universal set (or already city-scoped here)."
- **Idempotent / collision-safe seeding:** seedCountyLinks reuses an existing county entity and only fills NULL `county_id`; safe to re-run.
- **Never-overwrite (locked convention #3):** custom-sourced cities (Anaheim/Santa Ana) are linked but never reloaded.

### Integration Points
- Linking writes `municipalities.county_id` + the county entity → breadcrumb chain + Cities-in-County panel (frontend reads these, no UI work).
- Enrichment writes `category_enrichment` → category plain-names/descriptions render in the budget views automatically.

</code_context>

<specifics>
## Specific Ideas

- User's framing: "Are you able to enrich without any money?" + "do option 1 and have you do the enrichment inline?" → the inline-$0 approach (D-01) is the explicit, user-driven decision, not a fallback.
- One command for Step 2: `node scripts/seedCountyLinks.js --county "Orange"` (county name exactly `"Orange"`, no "County" suffix — matches the SCO `county` field).

</specifics>

<deferred>
## Deferred Ideas

- Backfilling the always-sourced standard / richer enrichment to other existing city/county data → future milestone.
- Statewide per-city salaries integration → **Phase 55** (SAL-01/02/03).

None of the above is in this phase's scope.

</deferred>

---

*Phase: 54-orange-county-entity-linking-enrichment*
*Context gathered: 2026-06-14 (inline — executes the Phase 52 runbook Steps 2–3, enrichment authored at $0)*
