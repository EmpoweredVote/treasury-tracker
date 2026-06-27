# Phase 92: Enrichment Parity (MNENR-01) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning
**Source:** Inline planning (no discuss-phase) — fully specified by ROADMAP + REQUIREMENTS + the Ohio Phase 87 / VA Phase 82 enrichment analog + the live MN vocabulary extracted from the DB. Standing guidance: **$0 inline-authored, NO Anthropic API generation** (auto-memory [[feedback_no_research_subagents]] extended note + [[feedback_api_cost_threshold]]).

<domain>
## Phase Boundary

Author state-neutral, bleed-safe, plain-language `category_enrichment` for the FULL live Minnesota city+county category vocabulary, at $0 inline (no paid API), and load it as universal (`municipality_id` NULL) rows — with a 100% coverage gate (abort on any unmapped live key, no fallback), delete-then-insert writes (NULLS-DISTINCT-safe), and `$`-leak + locality-name bleed guards. Delivers MNENR-01.

**In scope (MNENR-01):**
- `data/mnEnrichment92.mjs` — the hand-authored, state-neutral concept map covering the full MN vocabulary.
- `scripts/loadMNEnrichment92.mjs` — coverage-gated, guard-protected, delete-then-insert loader (mirrors `loadOhioEnrichment87.mjs` / `loadVAEnrichment82.mjs`).
- `scripts/loadMNEnrichment92.test.mjs` — offline tests (coverage gate + leak guards + buildRows).
- Live `--apply` write of universal rows + in-phase verification.

**Not in scope:** ACFR reconciliation + source-chain audit + UAT (Phase 93); any per-locality (non-NULL municipality_id) enrichment; new frontend.
</domain>

<decisions>
## Implementation Decisions

- **D-01: Cover ALL live depths (0/1/2) — 136 distinct composite keys.** Extracted live from the DB: depth-0 = 25 plain keys (`taxes`, `intergovernmental`, `public safety`, …); depth-1 = 72 composites (`taxes|propertytaxes`, `intergovernmental|state grants`, …); depth-2 = 39 composites (`intergovernmental|state grants|state local government aid`, …). Separator is `|`. The icicle drill-down (MN's value prop) renders descriptions at EVERY level, so enrichment must cover every depth — unlike Ohio (flat, depth-0 only).
- **D-02: Author by CONCEPT (keyed by normalized last-segment, ~90 concepts); loader expands to a universal row PER live composite key (name_key = the full composite).** Most leaf names are unique (propertytaxes, state local government aid, …); the main reuse is `current`/`capital`. A last-segment concept map is explicit + hand-authored + avoids 136 near-duplicate literals, while the **coverage gate runs over all 136 live keys** (each must resolve its last segment to a CONCEPT; ABORT on any unmapped — no fallback). name_key MUST equal the DB `link_key` composite (that is what the app/API joins on). [Per-key-literal authoring is an acceptable alternative if cleaner during execution, but the concept map is the chosen approach.]
- **D-03: State-neutral, bleed-safe, $0 inline-authored.** Every description concept-level, entity- AND state-neutral: no locality names, no `$` figures, no MN-specific facts; voice "local government" not "the city"/"Minnesota". NO Anthropic API call (the text is hand-written in-session into the committed data file).
- **D-04: Universal rows (municipality_id NULL) via DELETE-THEN-INSERT.** The `(name_key, municipality_id)` index is NULLS DISTINCT → upsert would INSERT duplicate universal rows; delete-then-insert is the only idempotent, overwrite-correct path (auto-memory [[reference_category_enrichment_nulls_distinct]], [[project_enrichment_scoping_fix]]).
- **D-05: Three pre-write guards, all abort.** (a) Coverage: every live key resolves to a concept (no fallback). (b) `$`-leak: no `$<digit>` in authored text. (c) MN-locality-name leak: authored text checked against the live MN `municipalities.name` list (945 entities), minus a common-English-word skip-set (incl. 'minnesota' + common-word city names like Savage, Climax, Hope, Center, Lake, Franklin, Savage, Two Harbors, Eagle Lake, … — build/extend from the actual flagged names at dry-run).
- **D-06: Mirror the established loader trio** (`loadOhioEnrichment87.mjs` + `data/ohioEnrichment87.mjs` + test) — swap the map for the MN concept map, state filter 'MN', worklist over ALL depths (composite keys, not just depth-0), and the resolver maps composite → last-segment → concept. Export pure helpers (`buildRows`, `findDollarLeaks`, `findLocalityLeaks`) for offline tests; entry-guard `main()` so tests don't hit the DB.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The trio to mirror (Ohio Phase 87 — the most recent enrichment-parity)
- `scripts/loadOhioEnrichment87.mjs` — the loader: live-worklist derivation, coverage gate (abort on missing, no fallback), `findDollarLeaks` + `findLocalityLeaks` (with a common-word skip-set), delete-then-insert universal writes, entry-guard for testable pure helpers. **Adapt:** worklist must collect ALL depths (not `depth=0` only) and key by the composite `link_key`; add the last-segment→concept resolver.
- `data/ohioEnrichment87.mjs` — the map shape ({plain_name, short_description, description, tags, confidence} + EXPECTED_KEYS) + the state-neutral voice/tags/confidence conventions.
- `scripts/loadOhioEnrichment87.test.mjs` — the offline test structure (coverage gate fires on a fake key; guards catch a seeded `$` + a seeded locality name; not flagged on a skip-set word).
- `scripts/loadVAEnrichment82.mjs` — the 2-level (composite depth-1) precedent — closest to MN's composite handling.

### Data-model / sourcing facts
- `treasury.category_enrichment` row: `{ name_key, municipality_id (NULL universal), plain_name, short_description, description, tags text[], source 'ai', confidence, evidence_summary, generated_at }`. Index `(name_key, municipality_id)` is NULLS DISTINCT.
- Live worklist: MN `municipalities` (entity_type IN city,county; 945) → `budgets` → `budget_categories` (ALL depths) → distinct `link_key` (composite), excluding `total`. Paginate the 1000-row cap.
- Auto-memory [[reference_category_enrichment_nulls_distinct]] (delete-then-insert), [[project_enrichment_scoping_fix]] (NULL-municipality bleed), [[feedback_no_research_subagents]] ($0 inline-author, no API), [[feedback_supabase_migration_mcp]] (read-only probes), [[feedback_api_cost_threshold]] ($5 gate — N/A here, $0).
- `.planning/REQUIREMENTS.md` MNENR-01; `.planning/ROADMAP.md` Phase 92 (3 success criteria).
</canonical_refs>

<specifics>
## Specific Ideas
- The MN labels are already plain-language ("Property Taxes", "Police/Sheriff", "State Local Government Aid", "Snow and Ice Removal") — descriptions explain what the category IS at a citizen level, concept-only.
- `current` / `capital` (the deepest expenditure leaves) get a generic operating-vs-investment concept reused across every function — honest and consistent.
- The `all other …` / `unallocated …` keys are honest catch-alls (NOT invented specifics).
- Dry-run-driven authoring loop: run the loader dry-run → it prints any live key whose concept is missing → author it → repeat until 0 missing (mirrors Ohio).
</specifics>

<deferred>
## Deferred Ideas
- Per-locality enrichment overrides → not needed (universal covers the standardized OSA vocabulary).
- ACFR reconciliation + source-chain audit + UAT → Phase 93.

None blocks Phase 92.
</deferred>

---

*Phase: 92-enrichment-parity-mnenr-01*
*Context gathered: 2026-06-27 (inline)*
