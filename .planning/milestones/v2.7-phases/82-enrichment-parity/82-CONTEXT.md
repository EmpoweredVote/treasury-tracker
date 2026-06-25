# Phase 82: Enrichment Parity (Virginia) - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning
**Source:** Inline discuss (orchestrator-gathered; no separate discuss-phase subagent — per project token-economy preference)

<domain>
## Phase Boundary

Author standardized, bleed-safe, plain-language **universal** `category_enrichment` rows for the entire Virginia function/activity vocabulary loaded in Phases 80–81, **inline at $0** (no paid AI API). This is a **data-only** phase — no app or API code changes. The app's budget API already joins `category_enrichment` by `name_key` (= `budget_categories.link_key`), city-scoped row first then the `municipality_id IS NULL` universal fallback; authoring universal rows for the VA keys makes plain language render for every VA city, county, and town that shares a key.

The VA vocabulary is **fixed and standardized statewide** by the APA Comparative Report (Exhibit C functions + sub-exhibit activities; Exhibit B revenue sources). Verified live count (2026-06-23): **73 distinct `name_key`s** —
- operating depth-0 (functions): 10 keys
- operating depth-1 (`function|activity`): 28 keys
- revenue depth-0 (sources): 8 keys
- revenue depth-1 (`source|subsource`): 27 keys

Because the vocabulary is small and fixed, enrichment is authored as an **explicit hand-written map** keyed by exact `name_key` (one accurate row per key) — NOT Utah's heuristic router-with-fallback (Phase 72), which existed only because Utah's fund names were messy and unbounded.

Direct precedent: Phase 72 (Utah Enrichment Parity) — `scripts/loadUtahEnrichment72.mjs`, `data/utahEnrichment72.mjs`. Reuse its loader skeleton (live worklist derivation, `$`-leak guard, delete-then-insert for NULL-municipality writes, dry-run/`--apply`).
</domain>

<decisions>
## Implementation Decisions

### Authoring model
- **D-82-01 (LOCKED):** Explicit hand-authored map (`data/vaEnrichment82.mjs`) keyed by exact `name_key`. One row per the 73 live VA keys. No router, no keyword fallback — instead a **100% coverage assertion**: the loader ABORTS if any live VA key is missing from the map (and warns if the map has keys no longer present live).
- **D-82-02 (LOCKED):** Enrich BOTH depth-0 (function/source) AND depth-1 (`function|activity` / `source|subsource` composite) so drill-down carries plain language end to end. `name_key` for depth-1 is the full `parent|child` composite link_key (confirmed against live data).

### Scope / shared keys (cross-state)
- **D-82-03 (LOCKED — "Improve + fix"):** 7 of the 73 keys are SHARED universal rows also read by CA/MA/UT/TX/OR entities (`public safety`, `public works`, `education`, `community development`, `fines and forfeitures`, `revenue from use of money and property`, `miscellaneous`). Author all 73 in deliberately **entity- AND state-neutral** language and overwrite the shared universals — this is a strict improvement (unifies voice; notably FIXES the existing universal `miscellaneous` row, which today reads "Information Technology" — wrong for VA *and* MA's 351 entities). A **no-regression spot-check** on one CA city + one MA town is REQUIRED before sign-off.
- **D-82-04 (LOCKED — include state node):** Include the 12 Virginia state-node keys (`virginia general fund budget` + its 6 program-area composites; `virginia general fund revenue` + its 4 source composites). They are part of the VA vocabulary and small; framed as state-level program areas, not local departments.

### Safety / idempotency
- **D-82-05 (LOCKED):** All rows are universal (`municipality_id IS NULL`) and bleed-safe by construction — no locality name, no `$` figure, no entity-specific fact. A `$`-leak guard AND a VA-locality-name guard ABORT the run on any violation.
- **D-82-06 (LOCKED):** Writes use **delete-then-insert** over the authored keys (NOT upsert). The `(name_key, municipality_id)` unique index is NULLS DISTINCT, so `ON CONFLICT` never matches a `NULL`-municipality row and upsert would INSERT duplicates. Reference: `scripts/loadUtahEnrichment72.mjs`; memory `category-enrichment-nulls-distinct`. This is idempotent and correctly overwrites stale rows (incl. the `miscellaneous`→IT row).
- **D-82-07 (LOCKED):** Loader is dry-run by default; `--apply` writes to production. Reuses the gitignored `.env`/`.env.local` service key (never logged/committed).

### Disambiguation
- **D-82-08 (LOCKED):** The token "interest" appears under two different parents and means different things — `general property taxes|interest` (interest/penalties charged on delinquent tax) vs `revenue from use of money and property|interest` (interest earned on invested cash). The explicit map authors a distinct, parent-correct row for each composite; a test asserts the two descriptions differ.

### Claude's Discretion
- Exact wording of each plain_name / short_description / description (must match the citizen-friendly voice of `data/caParityEnrichment61.mjs` CONCEPTS), tag sets, and confidence levels.
- Whether to split `data/vaEnrichment82.mjs` by dataset (operating vs revenue) or keep one object — keep simple, one module.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Direct precedent (Phase 72 Utah — mirror the loader, simplify to explicit map)
- `scripts/loadUtahEnrichment72.mjs` — loader skeleton: env load, live-worklist pagination, `$`-leak guard, **delete-then-insert** for NULL-municipality writes, dry-run/`--apply`, expanded-mapping JSON writer.
- `scripts/loadUtahEnrichment72.test.mjs` — offline test shape.
- `data/caParityEnrichment61.mjs` — `CONCEPTS` shape + the exact citizen-friendly voice to match (`{ plain_name, short_description, description, tags, confidence }`).

### Data model + render path (read-only — do NOT change)
- `scripts/enrichCategories.js` — `name_key` convention: depth-0 plain link_key; depth-1 `parent|name` composite (`saveEnrichment`).
- `src/data/dataLoader.ts` — app fetches the budget tree from the REST API (`API_BASE/treasury/...`); enrichment is joined server-side by `name_key` and surfaces as `category.enrichment.{plainName,shortDescription,description,source}` (see `src/App.tsx`). Confirms this phase needs NO app/API code change.

### VA loader (vocabulary origin)
- `scripts/loadVAComparativeReport.js` — how the VA function→activity tree and revenue tree are built (Exhibit C/C-1..C-8, Exhibit B/B2); the source of the `name_key` vocabulary.

### Memory (binding constraints)
- `category-enrichment-nulls-distinct` — universal writes MUST be delete-then-insert, dedup by name_key.
- `project_enrichment_scoping_fix` — never leave municipality_id NULL for entity-specific text; the bleed incident.
- `project_ev_funding_philosophy` / `feedback_api_cost_threshold` — $0 / within the $5 AI gate; unfunded nonprofit.
</canonical_refs>

<specifics>
## Specific Ideas

The full 73-key vocabulary (verified live 2026-06-23) is enumerated in `82-RESEARCH.md`. Notable edge cases the map MUST cover:
- `non- departmental` (operating depth-0) — note the literal space after the hyphen in the stored key.
- `virginia general fund budget` / `virginia general fund revenue` and their composites — the VA STATE node, framed as state program areas.
- Two parent-specific "interest" composites (D-82-08).
- `miscellaneous` (revenue depth-0) — author as a revenue catch-all; explicitly NOT "Information Technology".
</specifics>

<deferred>
## Deferred Ideas

- Per-locality (municipality-scoped) enrichment overrides — not needed; the VA vocabulary is uniform statewide, so universal rows suffice (Phase 72 reached the same conclusion).
- Verification / ACFR reconciliation / full-cohort source-chain audit / live UAT — that is Phase 83 (VAVER-01, VAVER-02), not this phase.
</deferred>

---

*Phase: 82-enrichment-parity*
*Context gathered: 2026-06-23 (inline orchestrator discuss + live DB recon)*
