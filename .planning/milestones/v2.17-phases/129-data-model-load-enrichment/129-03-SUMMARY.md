---
phase: 129-data-model-load-enrichment
plan: "03"
subsystem: enrichment
tags: [supabase, postgres, tucson, arizona, category-enrichment, bleed-safety, nulls-distinct]

# Dependency graph
requires:
  - phase: 129-02
    provides: 20 treasury.budgets rows for Tucson (10 FY x operating/revenue), 119 budget_categories, 181 budget_line_items
provides:
  - "scripts/loadTucsonEnrichment.mjs — live-worklist-derived, mixed universal + Tucson-scoped category_enrichment loader"
  - "15/15 Tucson GF category name_keys covered (8 pre-existing universal + 5 newly-authored universal + 2 newly-authored Tucson-scoped)"
affects: [130-verification-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mixed-scope coverage gate: derive live worklist -> check DB for EXISTING coverage (universal OR entity-scoped) first -> only consult the hand-authored map for keys not already covered -> abort on any live key with neither. Lets a new entity's enrichment run reuse prior loaders' generic universal rows without re-authoring or duplicating them (loadVAEnrichment82.mjs's explicit-map+gate pattern extended to allow a mix of scopes in one run)."
    - "Universal rows: delete-then-insert scoped ONLY to the keys this run authors (not a blanket clear) -- leaves all other entities' universal rows and the 8 pre-existing Tucson-relevant universal rows untouched. Tucson-scoped rows: plain upsert on (name_key, municipality_id), safe because municipality_id is a real non-null value there (NULLS DISTINCT only affects NULL-municipality_id conflict matching)."

key-files:
  created: [scripts/loadTucsonEnrichment.mjs, data/tucsonEnrichment129.mjs]
  modified: [.gitignore]

key-decisions:
  - "Tucson's operating tree stores its 2nd-level drill-down (functions under Current, components under Debt service) in budget_line_items.description, NOT as depth-1 budget_categories rows -- confirmed empirically (119 budget_categories rows across all 20 Tucson budgets, ALL depth=0; the 181 budget_line_items rows carry the function/component leaves). The plan's D-11/task wording (\"depth 0 and depth 1\") assumed a c[]-nested 2-level budget_categories tree; 129-02 instead used the i[]-multi-item RPC recipe (Portland/federal-agency precedent), which the RPC contract routes into budget_line_items, not budget_categories. category_enrichment in this codebase (confirmed by scripts/enrichCategories.js, the only read+write reference for the concept) only ever keys against budget_categories -- there is no established mechanism to enrich budget_line_items.description directly, and adding one would be a schema/architecture change (explicitly out of scope, D-11/D-12 \"no schema change\"). The script queries BOTH depth 0 and depth 1 (future-proof, matches the plan literally) but Tucson's live depth-1 set is empty by construction, so the true 100%-of-what's-enrichable worklist is the 15 depth-0 keys (4 operating icicle parents + 11 revenue sources) -- which is what was derived, authored, and verified."
  - "8 of the 15 live keys (capital outlay, capital projects, charges for services, debt service, fines and forfeitures, licenses and permits, miscellaneous, taxes) already had bleed-safe, generic universal category_enrichment rows from earlier loaders (CA-parity/MN/Ohio-era authoring) -- left untouched rather than re-authored, since TUC-06's requirement is \"a matching row exists\", not \"this plan wrote it\". Confirmed each is genuinely generic (no $, no city names) by direct DB read before treating as covered."
  - "'contributions from outside miscellaneous' and 'developer fees - - use of money and property' (the two 128-02-deferred merged wrapped-label artifacts) authored as Tucson-scoped per the plan's explicit instruction -- text describes them honestly as this-year's-statement presentation quirks (\"combined revenue line ... in this year's statement\"), not a fabricated general concept."

requirements-completed: [TUC-06]

# Metrics
duration: 30min
completed: 2026-07-10
---

# Phase 129 Plan 03: Bleed-safe Tucson category enrichment Summary

**`scripts/loadTucsonEnrichment.mjs` derives Tucson's enrichment worklist live from its loaded `budget_categories`, reuses 8 pre-existing generic universal rows, and authors 5 new universal + 2 new Tucson-scoped rows (delete-then-insert / upsert respectively) — 15/15 keys covered, idempotent, $0, zero bleed.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-10
- **Tasks:** 2 completed
- **Files created:** 2 (`scripts/loadTucsonEnrichment.mjs`, `data/tucsonEnrichment129.mjs`); 1 modified (`.gitignore`)

## Accomplishments

- Live worklist derivation: Tucson's 20 `budgets` rows (operating + revenue, FY2015–FY2024) → `budget_categories` depth 0 AND depth 1 (paginated) → 15 distinct `link_key`s (4 operating icicle-parent categories + 11 revenue sources)
- Coverage gate distinguishes three states per key: already covered by a pre-existing row (8 keys), authored this run (7 keys), or missing (0 keys — hard abort if any) — printed as a full key → scope → text-preview mapping plus a `covered/total` line
- 5 new **universal** rows (bleed-safe, generic GAAP/CAFR concepts): `current`, `use of money and property`, `federal grants and contributions`, `other agencies`, `contributions from outside sources`
- 2 new **Tucson-scoped** rows for the 129-02-deferred era-specific merged labels: `contributions from outside miscellaneous`, `developer fees - - use of money and property` — text honestly describes them as a single fiscal year's printed-statement presentation choice, not a fabricated general concept
- Universal writes use **delete-then-insert** scoped to only the 5 keys this run authors (NULLS-DISTINCT-safe); Tucson-scoped writes use a plain upsert on `(name_key, municipality_id)` (safe — non-null conflict target)
- Guards run before any write: $-figure leak check (0 hits across all 7 authored rows) and AZ-locality-name leak check against every AZ municipality's name (0 hits in universal-row text)
- Post-apply re-derivation: live worklist recomputed, all 15/15 keys now resolve to a matching row — **100% coverage**
- Idempotency proven: a second `--apply` run reports "Nothing to write — already 100% covered" (0 net new rows); direct DB check confirms exactly 1 row per newly-authored universal key (no duplicates) and exactly 2 Tucson-scoped rows; the universal-table total row count is unchanged pre/post (4,697 — writes replaced content in place)
- **$0 spend, zero paid-API calls** — every row inline-authored

## Task Commits

Each task was committed atomically:

1. **Task 129-03-01: dry-run loader + live worklist derivation** — `677022d` (feat)
2. **Task 129-03-02: `--apply` write path, run, idempotency + coverage re-verification** — `7d98093` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/loadTucsonEnrichment.mjs` — worklist derivation (depth 0/1, paginated), coverage gate, `$`/AZ-locality-name guards, mixed universal-delete-then-insert + Tucson-scoped-upsert write path, `--apply` flag
- `data/tucsonEnrichment129.mjs` — explicit concept map for the 7 keys this plan authors (5 universal + 2 Tucson-scoped), each tagged with its intended scope
- `.gitignore` — added the Tucson enrichment source-of-record allowlist entries (`!/data/tucsonEnrichment129.mjs`, `!/data/tucson-enrichment-129.expanded.json`), following the `data/*` gitignore-with-explicit-allowlist convention already used for VA/Ohio/MN/CA-parity enrichment source files

## Decisions Made

- See `key-decisions` in frontmatter — the depth-1 schema finding is the substantive one (documented there and in Deviations below).
- Reused 8 pre-existing universal rows rather than re-authoring them: verified by direct DB read that each is already generic and bleed-safe (no `$`, no city names) before counting it as coverage, so no risk of silently inheriting a bad row.

## Deviations from Plan

### Auto-fixed / Clarified Issues

**1. [Rule 1/Clarification] Tucson's operating tree has no depth-1 `budget_categories` rows — leaf functions live in `budget_line_items` instead**
- **Found during:** Task 1 (deriving the live worklist)
- **Issue:** The plan's task 1 acceptance criteria expected the worklist to include "leaf categories (functions + revenue sources)" via `budget_categories` depth 0 AND depth 1. Direct DB inspection showed all 119 `budget_categories` rows across Tucson's 20 budgets are `depth=0`; the operating tree's real leaves (e.g. "Public safety and justice services", "Elected and official" under `Current`; "Principal"/"Interest"/"Fiscal agent fees" under `Debt service`) are stored as `budget_line_items` rows (181 total), keyed to their parent `budget_categories.id` via `category_id` — the direct result of 129-02's `i[]`-multi-item RPC recipe (Portland/federal-agency precedent), which routes multi-child leaves into `budget_line_items`, not nested `budget_categories`.
- **Why not a bug to fix:** `category_enrichment` in this codebase (confirmed via `scripts/enrichCategories.js`, the only existing read+write reference implementation for the concept) keys exclusively against `budget_categories` rows — there is no established mechanism anywhere in the codebase to enrich `budget_line_items.description` directly, and building one would be a genuine architecture change, explicitly out of scope for this plan (`files_modified: [scripts/loadTucsonEnrichment.mjs]` only, no schema change per D-11/D-12).
- **Resolution:** The loader queries both depth 0 AND depth 1 (literally matching the plan, future-proof for any dataset that does store a true 2-level `budget_categories` tree), but Tucson's live depth-1 set is empty by construction — so the true, complete "100% of what's enrichable" worklist is the 15 depth-0 keys, which is what was derived, authored, and verified as 100% covered. Revenue's "leaf categories" are its own depth-0 rows (flat structure, 11 sources) — those ARE fully covered.
- **Files affected:** `scripts/loadTucsonEnrichment.mjs` (queries both depths; finds 0 at depth 1 for Tucson)
- **Commit:** `677022d`

### Out-of-scope, deferred (not fixed)

None. No pre-existing issues discovered outside this plan's scope.

## Known Stubs

None. Every category_enrichment row written carries real, human-authored plain-language text — no placeholder/empty values.

## Threat Flags

None. This plan's writes are exactly the surface its own `<threat_model>` (T-129-03) anticipated: `category_enrichment` rows, some `municipality_id = NULL` (universal). Mitigations were applied as specified — generic universal text (0 `$`-leaks, 0 AZ-locality-name leaks verified programmatically), delete-then-insert for universal writes (0 duplicates confirmed), live-derived worklist with a hard-abort coverage gate (0 missing keys), zero API calls. No new endpoint, auth path, or schema change.

## Issues Encountered

None beyond the depth-1 schema finding documented above (resolved by deriving the worklist from what's actually enrichable, not what the plan assumed would exist).

## User Setup Required

None. `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` were already present in the project's `.env`.

## Next Phase Readiness

- Tucson (id `e97d7a75-7a27-4b21-ac5e-667b16930a8f`) now has 100% bleed-safe `category_enrichment` coverage for all 15 of its loaded GF category `link_key`s (8 shared-universal + 5 new-universal + 2 Tucson-scoped) — ready for Phase 130 verification (TUC-07/08/09).
- Flag for Phase 130 (informational, not a defect): Tucson's icicle drill-down leaves (the function/component names under `Current`/`Debt service`) render from `budget_line_items.description` directly and are NOT joined to `category_enrichment` — this matches the existing Portland/federal-agency precedent (same `i[]`-multi-item recipe) and is consistent with how those entities already render live, so no UAT regression is expected; noting it here so Phase 130's UAT doesn't mistake a self-explanatory line-item label (e.g. "Public safety and justice services") for a missing enrichment tooltip.
- No blockers. `category_enrichment` table has 0 residue — writes only touched the 5 new universal `name_key`s + 2 Tucson-scoped rows; all other entities' universal rows (4,697 total, unchanged count) and Tucson's pre-existing 8 shared-universal keys were left untouched.

---
*Phase: 129-data-model-load-enrichment*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: scripts/loadTucsonEnrichment.mjs
- FOUND: data/tucsonEnrichment129.mjs
- FOUND: commit 677022d (Task 129-03-01)
- FOUND: commit 7d98093 (Task 129-03-02)
- FOUND: 15/15 Tucson GF category name_keys covered by category_enrichment (universal or municipality_id = Tucson)
- FOUND: 0 duplicate universal rows for the 5 newly-authored keys; exactly 2 Tucson-scoped rows
- FOUND: second --apply run reports 0 net new rows (idempotent)
