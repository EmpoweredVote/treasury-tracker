---
phase: 36-selective-city-retrofit
plan: 02
subsystem: scripts
tags: [portland, 3-level-tree, service-area, pdf-extraction, security, WR-04]

requires:
  - 36-01 (audit framework, RPC behavior verdict)

provides:
  - scripts/extractPortland.py with extract_service_area_map() and populated service_area per row
  - scripts/processPortland.js with 3-level buildOperatingTree() + WR-04 SUPABASE_URL fix
  - FY2026 dry-run validated: 8 service areas, 34 bureaus, $8,482,617,933 total

affects:
  - 36-04 (Portland live reload — uses these updated scripts)

tech-stack:
  added: []
  patterns:
    - "keyword-search page location (Managing Agency + Service Area) to find PDF table across FYs"
    - "two-page table scan: header page by keyword + immediate continuation page"
    - "Map-accumulate → sort-descending tree builder (processCA.js buildNLevelTree pattern)"
    - "__no_sa__<bureau> unique key prevents merging of D-06 unmapped bureaus"

key-files:
  created: []
  modified:
    - scripts/extractPortland.py
    - scripts/processPortland.js

key-decisions:
  - "Continuation page scan: User's Guide table spans 2 PDF pages; page 2 lacks header keywords so keyword guard alone would miss 11 bureaus. Fix: locate header page by keyword, then always scan next page too."
  - "WR-04 applied to processPortland.js: removed hardcoded SUPABASE_URL fallback || 'https://kxsdzaojfaibhuzmclfq.supabase.co'; fail-closed with process.exit(2) if env unset"
  - "FY2026: all 34 bureaus mapped to one of 8 service areas (no D-06 unmapped bureaus for this FY)"

metrics:
  duration: ~35min
  completed: 2026-06-09T17:02:34Z
  tasks: 2
  files: 2
---

# Phase 36 Plan 02: Portland 3-Level Operating Tree — Code + Dry-Run Summary

**Portland's extractPortland.py now maps all 34 bureaus to 8 service areas from the PDF User's Guide table; processPortland.js builds a genuine 3-level operating tree (Service Area → Bureau → Line Item) with WR-04 security fix applied.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-06-09T17:02:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: Add extract_service_area_map() to extractPortland.py

- New `extract_service_area_map(pdf)` function added before `extract_budget()`
- Locates the "Managing Agency | Fund | Service Area | Fund Type" table by keyword search (`'Managing Agency'` and `'Service Area'` in page text) — NOT by hardcoded page index (Pitfall 1 guard)
- **Key deviation from naive implementation:** The User's Guide table spans two PDF pages. Page 1 (0-indexed: 11) has headers and first ~24 bureaus. Page 2 (0-indexed: 12) is a continuation with no header keywords — so pure keyword-search would miss 11 bureaus. Fix: locate header page by keyword, then immediately also process `header_page_idx + 1`.
- Handles `(blank)` service area entries (Office of Vibrant Communities pattern — $0 budget, filtered by zero-amount guard)
- `extract_budget()` updated to accept `service_area_map=None` parameter; builds map automatically and prints count to stderr
- Each output row: `service_area = service_area_map.get(bureau_name, '')`
- Adds stderr WARNING listing any bureaus without service_area mapping (mirrors `none_fy` warning pattern)
- No new imports added (pdfplumber, sys, re, json already imported at lines 16-19)

**FY2026 result: 34/34 bureaus mapped, 8 distinct service areas, 0 unmapped bureaus**

### Task 2: Rewrite buildOperatingTree() in processPortland.js + WR-04 fix

- Replaced flat 1-level `buildOperatingTree()` with 3-level implementation:
  - `service_area` (depth-0) → `bureau` (depth-1) → `line item` (depth-2)
  - Map-accumulate pattern from `processCA.js buildNLevelTree()` reference
  - Unique `__no_sa__<bureau>` key prevents merging of D-06 unmapped bureaus
  - D-06 path: emits standalone depth-0 leaf with `console.warn('[D-06] Bureau with no service_area: ...')`, NOT a synthetic "Unknown Service Area" parent
  - Nodes sorted by amount descending at every level
- Updated `processPDF()` dry-run output to print service area count and bureau count for operating mode
- WR-04 security fix: removed `|| 'https://kxsdzaojfaibhuzmclfq.supabase.co'` fallback from `SUPABASE_URL`; added `if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }` — matches `processCA.js` lines 61-62

## FY2026 Dry-Run Results (Key Numbers)

| Metric | Value |
|--------|-------|
| Service areas | 8 |
| Bureaus | 34 |
| FY2026 total (3-level) | $8,482,617,933 |
| Prior flat-tree total (FY2026) | $8,482,617,933 |
| Reconciliation | EXACT MATCH — no rows dropped, no double-counting |

**Service areas (sorted by amount descending):**

| Service Area | Total |
|-------------|-------|
| Public Works | $4,657,952,739 |
| Community & Economic Development | $1,297,639,403 |
| City Operations | $1,032,210,780 |
| City Administrator | $854,921,744 |
| Public Safety | $602,662,720 |
| City Council | $19,548,454 |
| Office of the City Auditor | $14,185,501 |
| Office of the Mayor | $3,496,592 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two-page PDF table requires continuation page scan**
- **Found during:** Task 1 implementation and verification
- **Issue:** The User's Guide "Managing Agency → Service Area" table spans two PDF pages. Page 2 (0-indexed: 12) is the continuation and does NOT contain the header keywords "Managing Agency" or "Service Area" — so the pure keyword-search strategy described in the PATTERNS.md would locate page 1 but miss page 2, leaving 11 bureaus (Portland Bureau of Transportation, Portland Fire & Rescue, Portland Police Bureau, Portland Parks & Recreation, Portland Housing Bureau, Portland Office of Emergency Management, Portland Permitting & Development, Prosper Portland, Portland Children's Levy, Special Appropriations, Water Bureau) unmapped.
- **Fix:** After locating the header page by keyword, always also process `header_page_idx + 1`. This is robust: if the table fits on one page in a future FY, the continuation scan will find no new agencies (all rows have blank agency + valid service area which gets skipped since `current_bureau` already has an entry).
- **Files modified:** `scripts/extractPortland.py` — `extract_service_area_map()` function
- **Result:** 34/34 bureaus mapped (was 23/34 with keyword-only approach)

## Known Stubs

None. Both scripts are fully implemented and dry-run validated.

## Threat Surface Scan

No new network endpoints, auth paths, or user-input surfaces introduced.

**T-36-04 (WR-04) mitigated:** The hardcoded `SUPABASE_URL` fallback in `processPortland.js` has been removed. If `SUPABASE_URL` is unset, the script now exits with an error rather than silently using the production URL. This was the one unmitigated threat from the plan's threat register — now resolved.

**T-36-05 mitigated:** The `(blank)` service area value from the PDF table is explicitly skipped in `extract_service_area_map()`. Rows where service_area is empty fall back to `''`, and the loader collapses them per D-06 (no crash).

No threat flags.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `scripts/extractPortland.py` | FOUND |
| `scripts/processPortland.js` | FOUND |
| `.planning/phases/36-selective-city-retrofit/36-02-SUMMARY.md` | FOUND |
| Commit `d4c936b` (Task 1: extractPortland.py) | FOUND |
| Commit `8089251` (Task 2: processPortland.js) | FOUND |
| `def extract_service_area_map(` in extractPortland.py | VERIFIED (1 occurrence) |
| `buildOperatingTree` in processPortland.js | VERIFIED (2 occurrences — definition + call) |
| No hardcoded SUPABASE_URL fallback in processPortland.js | VERIFIED |
| FY2026 dry-run: 8 service areas, 34 bureaus, $8,482,617,933 | VERIFIED |
| FY2026 total reconciliation (3-level == prior flat) | VERIFIED (exact match) |
