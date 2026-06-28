---
phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03
plan: 02
subsystem: database
tags: [minnesota, acfr, gaap, state-node, revenue, processMNRevenue, P2-negative-revenue]

requires:
  - phase: 93-mn-acfr-sgfs-01
    provides: processMNRevenue.js FY2023-FY2025 revenue loader pattern
  - phase: 94-extractor-policy-sgfs-01
    provides: P2 negative-category policy (clamp-to-zero-area, retain signed value, carry source total verbatim)

provides:
  - "MN state-node revenue rows FY2008-FY2025 (18 years) in treasury.budgets — all GAAP actuals sourced to individual ACFRs"
  - "processMNRevenue.js REVENUE + SOURCES maps extended to FY2008-FY2022 (15 new years)"
  - "P2-aware buildTree: negative categories render at area=0, signed value in label, audited root total verbatim"
  - "FY2022 negative Investment/Interest Income handled per P2 (GF investment losses, -$350,456,000)"

affects: [96-state-nodes-nasbo, 97-source-chain-audit]

tech-stack:
  added: []
  patterns:
    - "P2 negative-revenue in buildTree: Math.max(cat.total, 0) for render area; signed value in display name '...: -$NNNm (net loss — shown at 0)'; footnote on root node; root total = audited Net Revenues verbatim"
    - "Remove c.total > 0 filter from buildTree (was silently dropping FY2022 negative line); replace with clamp + label"
    - "Securities Lending Income (FY2008-FY2011) folded into Investment/Interest Income for display (trivial amounts)"

key-files:
  created: []
  modified:
    - scripts/processMNRevenue.js

key-decisions:
  - "P2 implementation: buildTree now maps ALL non-zero categories (Math.max clamp), removes old positive-only filter"
  - "FY2022 Investment/Interest Income = -$350,456,000 (audited GF investment losses); area=0, label includes signed value"
  - "FY2022 root total = $31,743,414,000 (audited Net Revenues — includes the negative line); not recomputed from clamped leaves"
  - "Securities Lending Income folded into Investment/Interest Income for FY2008-FY2011 (amounts: $183K-$9.2M vs $38M-$105M primary)"
  - "FY2008-FY2009 Federal Revenues in GF = $0 (GF column shows dash; all federal revenues via Federal Fund); kept as 0 category, filtered from tree by c.total !== 0 check"

patterns-established:
  - "Pattern: P2-aware buildTree — Math.max clamp replaces positive-only filter; footnote on root when any negative present"
  - "Pattern: Securities Lending Income (small, intermittent) folded into Investment/Interest Income category for unified display"

requirements-completed: [SGFS-02]

duration: 45min
completed: 2026-06-28
---

# Phase 95 Plan 02: MN Revenue History + P2-Aware buildTree Summary

**Minnesota General Fund revenue-by-source extended back to FY2008 (15 new years, FY2008-FY2022) with P2-aware buildTree handling FY2022 negative investment earnings ($-350M) at zero icicle area with signed label and audited root total preserved**

## Performance

- **Duration:** ~45 min (combined with 95-01 extraction pass)
- **Started:** 2026-06-28T00:00:00Z
- **Completed:** 2026-06-28T01:30:00Z
- **Tasks:** 3 (Tasks 1+2 combined; Task 3 live load)
- **Files modified:** 1

## Accomplishments
- P2-aware buildTree implemented: removed `c.total > 0` positive-only filter, replaced with `Math.max(cat.total, 0)` clamp; negative categories render at area=0 with signed value in display name and footnote on root node
- Added REVENUE + SOURCES map entries for FY2008-FY2022 (15 new years); all 18 FYs dry-run validate PASS
- FY2022 negative Investment/Interest Income (-$350,456,000) correctly preserved: area=0 in icicle, label = "Investment/Interest Income: -$350M (net loss — shown at 0)", root total = $31,743,414,000 (audited Net Revenues)
- Live-loaded all 18 FYs; 15 new rows source-stamped; DB probe: 15 rows, 0 NULL, FY2022 total_budget = 31,743,414,000 exactly

## Extraction: Per-FY Table

| FY | Extracted Rev ($000) | Published GF Net Rev ($000) | Delta | Method |
|----|---------------------|-----------------------------|-------|--------|
| 2008 | 16,600,864 | 16,600,864 | 0 | pdftotext (dotted-column decoded) |
| 2009 | 15,153,318 | 15,153,318 | 0 | pdftotext (dotted-column decoded) |
| 2010 | 14,823,890 | 14,823,890 | 0 | pdftotext (dotted-column decoded) |
| 2011 | 16,836,517 | 16,836,517 | 0 | pdftotext (dotted-column decoded) |
| 2012 | 17,246,846 | 17,246,846 | 0 | pdftotext (clean table) |
| 2013 | 18,953,968 | 18,953,968 | 0 | pdftotext (clean table) |
| 2014 | 19,922,250 | 19,922,250 | 0 | pdftotext (clean table) |
| 2015 | 21,169,552 | 21,169,552 | 0 | pdftotext (accessible, clean) |
| 2016 | 21,555,138 | 21,555,138 | 0 | pdftotext (accessible, clean) |
| 2017 | 22,111,856 | 22,111,856 | 0 | pdftotext (accessible, clean) |
| 2018 | 23,982,256 | 23,982,256 | 0 | pdftotext (accessible, clean) |
| 2019 | 25,390,303 | 25,390,303 | 0 | pdftotext (accessible, clean) |
| 2020 | 24,866,869 | 24,866,869 | 0 | pdftotext (accessible, clean) |
| 2021 | 28,856,726 | 28,856,726 | 0 | pdftotext (accessible, clean) |
| 2022 | 31,743,414 | 31,743,414 | 0 | pdftotext (accessible, clean) |

**All 15 new FYs: 0-diff against published ACFR Net Revenues. No render-to-image fallback needed.**

## FY2022 P2 Details

- **Negative category:** `Investment/Interest Income`
- **Signed value:** -$350,456,000 (GF investment losses in FY2022)
- **Rendered area:** $0 (Math.max(-350_456_000, 0) = 0)
- **Display label:** `Investment/Interest Income: -$350M (net loss — shown at 0)`
- **Root total carried verbatim:** $31,743,414,000 (audited Net Revenues including the negative line — NOT recomputed from clamped positive leaves)
- **Root footnote:** "One or more revenue categories were net-negative in FY2022 (investment losses) and are shown at zero area with their real signed value in the label. The total reflects audited Net Revenues including the negative line."
- **DB verify:** treasury.budgets FY2022 revenue total_budget = 31,743,414,000 — confirmed matches

## Task Commits

1. **Task 1+2: P2-aware buildTree + extract FY2016-FY2022 + FY2008-FY2015 + widen defaults** - `e502041` (feat)
2. **Task 3: Live-load + DB probe** - (live run after commit)

## Files Created/Modified
- `C:/treasury-tracker/scripts/processMNRevenue.js` — REVENUE + SOURCES extended FY2008-FY2022; P2-aware buildTree (Math.max clamp, signed labels, footnote); default years + srcPayload fiscal_years widened to FY2008-FY2025

## Decisions Made
- P2 buildTree: removed `c.total > 0` filter entirely; all non-zero categories are included with `Math.max(cat.total, 0)` area clamp; negative category display name includes `": -$NNNm (net loss — shown at 0)"` suffix
- Root total stays REVENUE[fy].total (audited Net Revenues), never recomputed from clamped children — this is the key P2 invariant
- FY2008-FY2009 GF Federal Revenues = $0 (federal revenues flow via the separate Federal Fund); encoded as 0 total, filtered from icicle by `c.total !== 0` but included in validate() sum
- Securities Lending Income (FY2008: $9.2M, FY2009: $940K, FY2010: $183K, FY2011: $58K) folded into Investment/Interest Income for display; trivial amounts relative to $38M-$105M primary line

## Deviations from Plan

None — plan executed exactly as written. P2 implemented exactly per policy spec. All FYs 0-diff against published ACFR Net Revenues. No render-to-image fallback needed. FY2022 negative line preserved and clamped correctly.

## DB Probe Results

- MN revenue FY2008-2022 rows: **15**
- MN revenue FY2008-2022 NULL source rows: **0**
- FY2022 revenue total_budget: **31,743,414,000** (matches audited Net Revenues exactly)
- data_source label FY2022: `State of Minnesota ACFR — General Fund Revenue (FY2022 actual)`
- Idempotent re-run: 0 net new rows inserted

## Known Stubs

None — all categories are sourced from ACFR GENERAL FUND column; no placeholders or TODO values.

## Issues Encountered

None.

## Self-Check

- [x] processMNRevenue.js REVENUE + SOURCES cover FY2008-FY2025
- [x] buildTree P2-aware: Math.max clamp, no c.total > 0 filter, signed label, footnote
- [x] FY2022 root total = 31,743,414,000 (audited Net Revenues, not recomputed from clamped leaves)
- [x] 15 rows FY2008-FY2022 in treasury.budgets (revenue)
- [x] 0 NULL source_url/source_date/data_source
- [x] FY2022 revenue total_budget in DB matches audited figure
- [x] Idempotent re-run = 0 net changes

## Self-Check: PASSED

## Next Phase Readiness
- MN revenue history (FY2008-FY2025) complete; pairs with 95-01 MN operating for full GF picture
- P2 negative-revenue buildTree is now the pattern for any future state with investment losses in a GF year
- FY2022 is the only negative-revenue year in the 18-year MN series; P2 applies generally to any future negative category
- Ready for Phase 97 source-chain audit

---
*Phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03*
*Completed: 2026-06-28*
