---
phase: 129-data-model-load-enrichment
plan: "02"
subsystem: data-load
tags: [supabase, postgres, tucson, arizona, acfr, budget-tree, source-safe-rpc]

# Dependency graph
requires:
  - phase: 128-recon-extractor
    provides: locked FY2015-FY2024 window + extractTucson.py (revenue + operating extraction, tie_delta==0 gate)
  - phase: 129-01
    provides: Tucson municipality row (id e97d7a75-7a27-4b21-ac5e-667b16930a8f) + Pima County link
provides:
  - "20 treasury.budgets rows for Tucson (10 FY x 2 dataset_type), loaded via the source-safe treasury_sync_budget_tree RPC"
  - "Every row durably sourced (source_url = the per-FY tucsonaz.gov ACFR PDF, source_date = fiscal-year-end June 30)"
  - "A dataset_type='revenue' row exists for FY2024 (Money In view precondition)"
  - "Operating renders a genuine 2-level icicle (Current -> 5 functions, Debt service -> 2-4 components per era)"
affects: [129-03-enrichment, 130-verification-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toBudgetTree() mapper: extractor's {n,a,c:[...]} nested tree -> RPC's {n,a,i:[{d,a,aa,f,e}]} shape, using the multi-item-i-array-under-one-category contract (processPortland.js buildOperatingTree / loadFederalAgencies.js precedent) to fake a 2-level icicle from a 1-level RPC write"
    - "Ephemeral data_sources: ONE row per dataset_type for the whole FY2015-2024 window (not per-FY), created at run start / deleted at run end (processAZAcfr.js pattern, not the per-FY processGresham.js pattern)"
    - "py -3 instead of the win32 python convention other loaders use (this machine's python resolves to a non-functional MS Store alias stub)"

key-files:
  created: [scripts/processTucson.js]
  modified: []

key-decisions:
  - "Combined task 129-02-01 (dry-run) and 129-02-02 (live-load) into one cohesive file/commit rather than writing the dry-run path first and bolting the live-load path on in a second edit -- a single loader script reads more coherently than two passes over the same functions. Task 2's distinct acceptance bar (no reference to the forbidden RPC) was still independently verified and given its own commit."
  - "Reused the plan's exact D-08 tree-mapping recipe (i[] holding multiple {d,a} leaf entries under one category, rather than nesting further budget_categories via c[]) -- confirmed against the live _treasury_insert_tree contract and 4 other loaders (processPortland.js, loadFederalAgencies.js, processGresham.js, loadMACountyBudget.js) that this is the established pattern for a 2-level RPC write, not a novel shape"
  - "Ephemeral data_source scoped once per dataset_type (operating | revenue) for the whole 10-year window, not once per FY -- matches processAZAcfr.js (one ds spans many FYs) rather than processGresham.js (one ds per FY); simpler lifecycle, same 0-residue guarantee"

requirements-completed: [TUC-05]

# Metrics
duration: 45min
completed: 2026-07-10
---

# Phase 129 Plan 02: Load Tucson GF operating + revenue Summary

**`scripts/processTucson.js` loads Tucson's General Fund operating (expenditure-by-function, 2-level) + revenue (revenue-by-source, flat) for FY2015-FY2024 through the source-safe `treasury_sync_budget_tree` RPC — 20/20 rows independently re-derive to the 128-RECON.md printed totals at exactly $0, every row durably sourced, 0 `data_sources` residue, idempotent on re-run.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-07-10
- **Tasks:** 3 completed
- **Files modified:** 1 (`scripts/processTucson.js`, created)

## Accomplishments

- `scripts/processTucson.js` built on the `processGresham.js` skeleton (worktree-safe `resolvePdfDir()`, `spawnSync` args-array extractor call) + `processAZAcfr.js` provenance discipline (ephemeral `data_sources`, post-sync source stamp, muni resolve-or-refuse, sanity ceiling)
- `toBudgetTree()` maps the extractor's `{n,a,c:[...]}` tree to the RPC's `{n,a,i:[{d,a,aa,f,e}]}` shape: revenue flat (one item per category), operating 2-level (`Current`/`Debt service` expand into their function/component children via `i[]`; `Capital outlay`/`Capital projects` are single-item leaves)
- `URLS[fy]` map of the 10 durable per-FY `tucsonaz.gov` PDF URLs (128-RECON.md)
- Both `--dry-run` and `--revenue --dry-run` reproduce every one of the 20 FY x mode 128-RECON.md printed totals exactly, incl. the FY2024 grounding figures (GF revenue $773,493,270 / GF expenditure $648,657,363)
- **Live load complete:** 20 `treasury.budgets` rows for Tucson (10 FY x 2 `dataset_type`), all loaded via `treasury_sync_budget_tree` (never the non-source-safe city-budget sync RPC)
- **Independent re-derivation (not the extractor's self-tie):** queried `treasury.budget_categories` directly for every FY x mode and summed the depth-0 category amounts — all 20 tie the 128-RECON.md printed total at exactly $0 delta
- **Source chain:** every one of the 20 rows carries a non-null `source_url` (its tucsonaz.gov ACFR PDF) and `source_date` (the fiscal-year end, June 30 `<FY>` — no fabricated issue date, per D-09)
- **Ephemeral `data_sources`:** 0 residue confirmed after the run (`data_sources` table has 0 rows matching `tucson%` dataset_id)
- **Idempotency proven:** ran both modes a second time; row count stayed at 20, category count stayed at 119, line-item count stayed at 181 — 0 net change
- **2-level drill confirmed:** FY2024 operating `Current` ($559,483,332) expands into 5 functions (Elected and official, Public safety and justice services, Community enrichment and development, Support services, General government) summing exactly to the parent; `Debt service` ($59,871,756) expands into 3 components (Principal, Interest, Fiscal agent fees)
- **Money In precondition satisfied:** a `dataset_type='revenue'` row exists for Tucson FY2024
- **Per-capita finite and positive:** FY2024 revenue $773,493,270 / seeded population 554,013 = **$1,396.16/resident**

## Task Commits

Each task was committed atomically:

1. **Task 129-02-01: dry-run loader + tree mapper** — `aa20f08` (feat)
2. **Task 129-02-02: live-load path (ephemeral data_sources, source stamp, sanity ceiling, muni resolve-or-refuse)** — `bea8110` (feat) — shipped together with task 1's code in the same file (see Deviations); this commit specifically hardened the "no reference to the forbidden RPC" acceptance bar
3. **Task 129-02-03: live load run + verification** — `46f56f0` (docs) — the live DB load itself has no separate commit (no code change); this commit captures the deferred-item log from the live run

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/processTucson.js` — Tucson budget loader (dry-run + live-load paths): `resolvePdfDir()`, `discoverPdfsByFY()`, `extractPDF()`, `toBudgetTree()`, `ensureMunicipality()`, `createEphemeralDataSource()`/`deleteEphemeralDataSource()`, `loadFiscalYear()`, `processMode()`, CLI (`--dry-run`, `--revenue`, `--fy`)

## Decisions Made

- **Tasks 1 and 2 written together in one file/pass.** The plan splits "build the dry-run path" (task 1) and "add the live-load path" (task 2) into two tasks, but a single cohesive script (rather than writing dry-run functions, committing, then bolting live-load functions on) was the more natural implementation shape here — every function in the file (extraction, mapping, DB writes) is used by both dry-run and live modes via a shared `processMode()` code path, so splitting them into two edits would have meant either stubbing live-load calls in task 1 or rewriting `processMode()` in task 2. Task 2's own distinct acceptance criterion ("contains no reference to the forbidden RPC") was independently verified and given its own commit, which reworded a docstring line that had spelled out the forbidden RPC's name in prose.
- **Tree-mapping recipe followed the plan/research literally** (`i[]` holding multiple leaf entries under one category, not further `c[]` nesting) rather than the alternative recursive-`c` pattern used by `processPortland.js`'s `buildOperatingTree` for its own service-area -> bureau tree. Both patterns are valid against the live `_treasury_insert_tree` contract; the plan's explicit recipe was followed for consistency with 129-CONTEXT/129-RESEARCH's exact wording and acceptance criteria ("Current/Debt service carry their function/component children in `i[]`").
- **Ephemeral `data_source` scoped once per dataset_type for the whole window**, not once per FY — matches `processAZAcfr.js`'s pattern (one `data_source` id used across all 23 AZ fiscal years) rather than `processGresham.js`'s per-FY pattern. Simpler lifecycle (2 creates/2 deletes total instead of 20), same 0-residue guarantee, and the per-`(data_source_id, fiscal_year)` pre-load delete before every RPC call still gives per-FY idempotency.
- **`py -3` instead of `python` on win32** (Rule 3 auto-fix, environment-specific): this machine's `python` on PATH resolves to the non-functional Microsoft Store app-execution-alias stub (confirmed: `python --version` prints the Store redirect message; `py -3 --version` correctly reports Python 3.14.3, the interpreter with `pdftotext`/extractor dependencies already proven working in Phase 128). Sibling city loaders (`processGresham.js` et al.) use `python` on win32 — this is a local machine PATH quirk, not a project-wide convention change, and is called out in the file's header comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `python` on PATH is non-functional on this machine; used `py -3` instead**
- **Found during:** Task 1 (writing `extractPDF()`)
- **Issue:** The established sibling-loader convention (`process.platform === 'win32' ? 'python' : 'python3'`) resolves `python` to a broken Microsoft Store app-execution-alias stub on this machine, which would make every `extractPDF()` call fail immediately.
- **Fix:** Detect win32 and use `py -3 <script> <args>` instead (confirmed working: `py -3 --version` → Python 3.14.3, and manual `py -3 scripts/extractTucson.py ...` runs match this loader's own dry-run output exactly).
- **Files modified:** `scripts/processTucson.js`
- **Commit:** `aa20f08`

### Out-of-scope, deferred (not fixed)

**1. [Scope boundary] Two cosmetic wrapped-label merges in `extractTucson.py`'s revenue output**
- **Found during:** Task 3 (live load run), spot-checking category labels
- **Issue:** `build_revenue()`'s wrapped-label buffer swallows bare-dash blank-cell placeholders (not matched by the `_MONEY` regex) into a "label-only" line's buffered text, then prepends that to the NEXT row's label. Two categories carry a merged label as a result: FY2021 revenue `"Contributions from Outside Miscellaneous"` and FY2022 revenue `"Developer fees - - Use of money and property"`.
- **Impact:** Cosmetic only — every affected FY's total independently re-derives to the 128-RECON.md printed total at exactly $0 (confirmed via direct `budget_categories` query). No dollar figure is wrong; only two category labels are merged where the source likely has two separate rows (one of them $0/blank in the GF column).
- **Why not fixed:** `scripts/extractTucson.py` is Phase 128's output and is not in this plan's `files_modified` scope (`scripts/processTucson.js` only). Per the SCOPE BOUNDARY rule, out-of-scope pre-existing issues are logged, not fixed.
- **Logged:** `.planning/phases/129-data-model-load-enrichment/deferred-items.md`

## Known Stubs

None. Every loaded row carries real ACFR-derived data, a real `source_url`, and a real `source_date` — no placeholder/empty values.

## Threat Flags

None. This plan's writes are exactly the surface the plan's own `<threat_model>` (T-129-02) anticipated: `extractTucson.py`/`pdftotext` spawned over controlled `docs/Tucson/` PDFs, bulk writes to `treasury.budgets`/`budget_categories`/`budget_line_items` via the source-safe RPC, ephemeral `data_sources`. No new endpoint, auth path, or schema change was introduced.

## Issues Encountered

None beyond the `python`/`py` PATH quirk documented above (resolved inline, Rule 3).

## User Setup Required

None. `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` were already present in the project's `.env`; `pdftotext` (poppler) and a working Python 3 interpreter (`py -3`) were already present on the machine (proven in Phase 128).

## Next Phase Readiness

- Tucson (id `e97d7a75-7a27-4b21-ac5e-667b16930a8f`) has 20 sourced `treasury.budgets` rows (10 FY x 2 dataset_type), 119 `budget_categories`, 181 `budget_line_items` — ready for Plan 129-03 (`scripts/loadTucsonEnrichment.mjs`) to derive its enrichment worklist LIVE from `treasury.budget_categories` (the union of every loaded FY's labels, honest per-era vocabulary variance and all).
- No blockers. `data_sources` table has 0 residue rows for either Tucson dataset_id — the next plan's own ephemeral lifecycle (if it creates any `data_sources` rows at all; enrichment typically doesn't) starts from a clean slate.
- Deferred: the two cosmetic wrapped-label merges (see Deviations) will surface as two of Plan 129-03's live-derived worklist category names verbatim (e.g. `"developer fees - - use of money and property"` as a `link_key`) — the enrichment plan should author against them as-is (honest per-year vocabulary, matching D-04's "load whatever each year printed" philosophy) rather than silently normalizing them.

---
*Phase: 129-data-model-load-enrichment*
*Completed: 2026-07-10*

## Self-Check: PASSED

- FOUND: scripts/processTucson.js
- FOUND: commit aa20f08 (Task 129-02-01)
- FOUND: commit bea8110 (Task 129-02-02)
- FOUND: commit 46f56f0 (Task 129-02-03)
- FOUND: 20 treasury.budgets rows for Tucson, independently re-derived to $0 delta against 128-RECON.md
- FOUND: 0 treasury.data_sources residue rows (dataset_id ilike 'tucson%')
