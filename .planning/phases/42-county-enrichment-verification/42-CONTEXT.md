# Phase 42: County Enrichment + Verification - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich all 5 active MA county budget categories with plain-language descriptions (municipality_id-scoped — never universal/NULL), then human-verify the complete county-city linking feature in the live app. This is the final phase of v1.9 MA County-City Linking.

Two deliverables:
1. **Enrichment** — plain_name + description for every budget category loaded in Phase 41 for Barnstable, Bristol, Dukes, Norfolk, and Plymouth counties (~68 categories total)
2. **Human verification** — confirm breadcrumb chip, CitiesInCountyPanel, per-capita, and no-regression in the live app; write 42-VERIFICATION.md; commit milestone close

</domain>

<decisions>
## Implementation Decisions

### Enrichment Approach

- **D-01:** API tokens are not available — Claude writes enrichment descriptions manually (inline), not via `enrichCategories.js`. Downstream agent must look up all budget category names from the DB for the 5 county municipality IDs, write plain-language descriptions, and upsert via SQL (same schema: `name_key`, `plain_name`, `description`, `municipality_id`, `confidence`).
- **D-02:** Enrichment must be municipality_id-scoped — one row per (name_key, municipality_id) pair. Never set municipality_id = NULL for county data. This prevents county descriptions from bleeding into city enrichment.
- **D-03:** No dry-run step needed since we're not calling Claude API — descriptions are written directly and upserted idempotently.

### UAT Verification

- **D-04:** Full verification — all 5 active counties (Barnstable, Bristol, Dukes, Norfolk, Plymouth). Not a sample.
- **D-05:** Per-county checks for each of the 5:
  1. A linked MA city page shows a county breadcrumb chip (e.g., "Bristol County →")
  2. Clicking the chip navigates to the county page
  3. CitiesInCountyPanel is visible on the county page listing its linked cities
  4. Per-capita figure ($/resident) displays using the loaded Census county population
- **D-06:** Regression check: one existing MA city (not linked to a new county) + one CA city. Confirms MA-wide behavior is intact and other states were not affected.
- **D-07:** Plan pauses for human UAT gate before writing VERIFICATION.md. Plan executor should stop and display the checklist; only write VERIFICATION.md after the user confirms all items pass.

### Milestone Close

- **D-08:** After UAT passes, write `42-VERIFICATION.md` documenting all UAT results (county by county + regression), then commit with a milestone close message marking **v1.9 complete**.
- **D-09:** VERIFICATION.md should include: pass/fail per UAT item, which city was used for each county breadcrumb test, regression cities tested, and any anomalies.

### Claude's Discretion

- Choice of which specific MA city to use for each county's breadcrumb test (any city known to be linked to that county)
- Exact plain_name wording for each county budget category (should follow the same style as prior enrichments — short, plain English, no jargon)
- SQL approach: can use a migration file or a standalone seed script (loadMACountyEnrichment.js following the Phase 41 pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §ENRICH-01 — Exact acceptance criteria: "municipality_id-scoped descriptions (municipality_id = county uuid, NOT municipality_id IS NULL — never universalize county enrichments)"
- `.planning/ROADMAP.md` §Phase 42 — Success criteria (5 items), plan description, goal

### Phase 41 Output (what was loaded — enrichment targets)
- `.planning/phases/41-ma-county-budget-load/41-02-SUMMARY.md` — Category counts per county: Barnstable 4, Bristol 18, Dukes 12, Norfolk 16, Plymouth 18 (~68 total); approach used per county (pdfplumber vs hardcoded)

### Enrichment Schema Reference
- `scripts/enrichCategories.js` lines ~380–400 — upsert structure for `category_enrichment` table: `name_key`, `municipality_id`, `plain_name`, `description`, `tags`, `confidence` fields. Conflict key: `(name_key, municipality_id)`.

### Project State
- `.planning/STATE.md` §API Cost Threshold — $5 gate applies to all AI API usage; manual enrichment approach bypasses this entirely
- `.planning/PROJECT.md` §Requirements — ENRICH-01 confirmed complete entry at v1.9

### Phase 41 Patterns (for milestone close)
- `.planning/phases/41-ma-county-budget-load/41-UAT.md` — UAT format reference for writing 42-UAT.md / VERIFICATION.md

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/enrichCategories.js` — NOT used for API calls this phase (no tokens), but its upsert pattern and schema (lines ~380–400) define the exact DB insert format to replicate manually.
- `scripts/loadMACountyBudget.js` (Phase 41) — Reference for how county municipality IDs were looked up and used; can query the same pattern to get county UUIDs.

### Established Patterns
- All prior county enrichments (LA County, Phase 25) are municipality_id-scoped — same pattern applies here.
- Category descriptions follow a consistent voice: short (1–2 sentences), plain English, avoids government jargon, explains what the department does in plain terms.
- Conflict key `(name_key, municipality_id)` makes all upserts idempotent — safe to re-run.

### Integration Points
- `treasury.category_enrichment` table — target for all 5 county enrichment rows
- County municipality IDs needed: query `municipalities` table WHERE state='MA' AND entity_type='county' to get the 5 UUIDs

</code_context>

<specifics>
## Specific Ideas

- Barnstable has only 4 hardcoded aggregate categories from page 29 of its PDF — descriptions should reflect county-level aggregation (e.g., "County Administration", "Sheriff's Office") rather than trying to describe sub-line items.
- Dukes (Martha's Vineyard) budget categories come from FY2024 audit schedule — descriptions should note the island government context where relevant.
- Bristol and Plymouth have 18 departments each — most are standard county government functions (Sheriff, DA, Registry of Deeds, etc.) with clear plain-language descriptions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 42-county-enrichment-verification*
*Context gathered: 2026-06-11*
