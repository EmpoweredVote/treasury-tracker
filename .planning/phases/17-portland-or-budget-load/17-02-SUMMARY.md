---
phase: 17-portland-or-budget-load
plan: 02
subsystem: database
tags: [pdfplumber, supabase, portland, oregon, pdf-pipeline, extractPortland, processPortland]

# Dependency graph
requires:
  - phase: 17-portland-or-budget-load
    plan: 01
    provides: Portland municipality FK (id=2abac6c2), PDFs in docs/Portland/, pdfplumber confirmed
  - artifact: scripts/extractFremont.py
    provides: parse_money pattern, pdfplumber extract_tables pattern
  - artifact: scripts/processFremont.js
    provides: execSync invocation, ensureMunicipality, upsertDataSource, loadFiscalYear, parseArgs patterns
provides:
  - scripts/extractPortland.py (pdfplumber extractor outputting JSON to stdout)
  - scripts/processPortland.js (Node loader: runs Python extractor, builds tree, calls treasury_sync_budget_tree)
  - Dry-run validated: FY2025=39 bureaus $8.045B, FY2026=34 bureaus $8.483B
affects:
  - 17-03 (processPortland.js ready for live load)
  - 17-04 (live load plan — use totals from this SUMMARY to sanity-check)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portland Appropriation Schedule (Table 2) page-keyword detection for multi-page table extraction"
    - "Subtotal row detection: row ends with 'Subtotal' and has numeric col[5] (Total Appropriation)"
    - "resolvePdfDir: git common-dir fallback so scripts run from both main checkout and worktrees"
    - "parse_fy: FY YYYY-YY → ending year integer (FY 2025-26 → 2026)"

key-files:
  created:
    - scripts/extractPortland.py
    - scripts/processPortland.js
  modified: []

key-decisions:
  - "Use Appropriation Schedule (Table 2) col[5]=Total Appropriation as the adopted amount — most complete bureau total"
  - "Subtotal row detection: row[0] ends with 'Subtotal'; zero-amount subtotals skipped with stderr warning"
  - "resolvePdfDir fallback uses git rev-parse --git-common-dir to find main working tree (worktree-safe)"
  - "Service area not carried through — Appropriation Schedule does not provide service area grouping per bureau"
  - "FY2025 PDF has 39 bureaus vs FY2026's 34 — difference reflects bureau consolidation between years"

patterns-established:
  - "Bureau-level tree: each bureau → top-level node {n, a, i:[{d, a, aa:null, f:null, e:null}]}"
  - "No thousands conversion: Portland PDF amounts are already in full dollars"

requirements-completed: []

# Metrics
duration: ~45min
completed: 2026-05-31
---

# Phase 17 Plan 02: Portland Extractor + Loader Pipeline Summary

**pdfplumber Python extractor and Node.js loader pipeline built and dry-run validated against both Portland Adopted Budget Vol 1 PDFs; FY2025 yields 39 bureaus totaling $8.045B and FY2026 yields 34 bureaus totaling $8.483B in full-dollar amounts**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31
- **Tasks:** 2
- **Files created:** 2 (extractPortland.py, processPortland.js)

## Accomplishments

- `extractPortland.py`: detects Appropriation Schedule pages by "Appropriation Schedule" text keyword, extracts bureau Subtotal rows from multi-page Table 2, parses fiscal year from "FY YYYY-YY" format as ending integer year. Skips zero-amount subtotals (e.g. Office of Vibrant Communities) and grand Total row. Emits stderr for all skipped rows.
- `processPortland.js`: runs Python extractor via execSync, groups rows by fiscal year, builds bureau-level operating tree, upserts per-FY data_source rows (pdf_download), deletes + re-inserts via treasury_sync_budget_tree for idempotency. Dry-run flag bypasses all DB writes.
- Dry-run validated with exit 0 against both PDFs.

## Dry-Run Results (for Plan 04 sanity check)

| Fiscal Year | Bureaus | Total Appropriation |
|-------------|---------|---------------------|
| FY2025 (FY 2024-25) | 39 | $8,045,475,348 |
| FY2026 (FY 2025-26) | 34 | $8,482,617,933 |

Note: FY2025 has 39 bureaus vs FY2026's 34. The difference reflects bureau consolidation in the 2025-26 adopted budget (e.g. some offices merged or dissolved). Both counts are correct based on the Appropriation Schedule table content.

### Notable Bureau Amounts (FY2026)

| Bureau | Total Appropriation |
|--------|---------------------|
| Water Bureau | $2,071,512,063 |
| Bureau of Environmental Services | $1,425,353,758 |
| Bureau of Planning & Sustainability | $838,539,246 |
| Portland Bureau of Transportation | $617,257,226 |
| Portland Parks & Recreation | $541,225,747 |
| Fund and Debt Management | $474,150,272 |
| Portland Police Bureau | $316,692,335 |
| Fire & Police Disability & Retirement | $309,519,063 |

## Task Commits

1. **Task 1: extractPortland.py** - `9c487d7` (feat)
2. **Task 2: processPortland.js** - `5996c87` (feat)

## Files Created/Modified

- `scripts/extractPortland.py` — pdfplumber extractor: Appropriation Schedule page detection, subtotal row capture, parse_fy for FY YYYY-YY format, full-dollar amounts, JSON to stdout
- `scripts/processPortland.js` — Node loader: execSync Python, buildOperatingTree, upsertDataSource (pdf_download/fy${fiscalYear}), loadFiscalYear (delete+RPC), resolvePdfDir (worktree-safe), --dry-run support

## Decisions Made

1. **Appropriation Schedule Table 2, col[5] = Total Appropriation:** Selected as the adopted budget figure because it is the most complete per-bureau total (includes Program Expenses + Contingency + Interfund Transfers + Debt Service). Other tables (Summary of Bureau Expenses by Fund, page 124+) contain Program Expenses only and do not include full appropriation.
2. **Zero-amount subtotals skipped:** "Office of Vibrant Communities" had $0 total in FY2026 — skipped with stderr warning rather than emitting a $0 row that would create noise in the budget tree.
3. **resolvePdfDir fallback:** Since `docs/` is gitignored, PDFs live only in the main working tree. When running from a worktree, `git rev-parse --git-common-dir` finds the main .git dir; `path.dirname()` gives the main repo root. This makes the script work from both worktrees and main checkout without user configuration.
4. **Service area empty string:** The Appropriation Schedule table does not include service area grouping per bureau (it's a flat list). Service area grouping is available elsewhere in the PDF but would require separate extraction. Per plan spec, `service_area: ''` is acceptable — the tree uses bureau as the top-level node.
5. **FY fiscal year count difference (39 vs 34 bureaus):** Confirmed by inspecting both PDFs. Not a bug — Portland reorganized some bureaus between fiscal years.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] resolvePdfDir worktree fallback added to processPortland.js**
- **Found during:** Task 2 dry-run testing
- **Issue:** When running from a git worktree, `ROOT` (derived from `__dirname`) resolves to the worktree root, but `docs/Portland/` PDFs are gitignored and only exist in the main working tree. `readdirSync('worktree-root/docs/Portland')` threw ENOENT.
- **Fix:** Added `resolvePdfDir()` function that checks if `docs/Portland/` exists in ROOT first, then falls back to the main repo root via `git rev-parse --git-common-dir`. This is transparent to normal (non-worktree) usage.
- **Files modified:** scripts/processPortland.js
- **Committed in:** 5996c87

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking worktree path issue)
**Impact on plan:** Fix is backward-compatible; normal usage unaffected. Plan 04 (live load) will run from main checkout where docs/Portland/ exists at ROOT — no fallback needed.

## Known Stubs

None. Both scripts are fully functional. The `service_area: ''` field is intentional (not stub) — the Appropriation Schedule does not provide service area grouping, and the plan spec accepted this.

## Threat Flags

None beyond the declared threat model. T-17-03 (PDF path in execSync) mitigated: path comes from controlled `readdirSync` of `docs/Portland/`, not user input; argument is double-quoted. T-17-04 (maxBuffer) mitigated: 8MB limit with bureau-only JSON output (well under 100KB per PDF).

## Next Phase Readiness

- Plan 04 (live load) can proceed immediately:
  - Run `node scripts/processPortland.js` (no --dry-run) from the main repo checkout
  - Expected: FY2025=39 bureaus $8.045B, FY2026=34 bureaus $8.483B
  - Municipality must be present (seeded in Plan 01, id=2abac6c2)
  - SUPABASE_SERVICE_KEY must be set in environment

---
*Phase: 17-portland-or-budget-load*
*Completed: 2026-05-31*
