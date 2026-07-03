---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
plan: 02
subsystem: database
tags: [acfr, state-budget, supabase, pdftotext, kentucky, nasbo-supersede]

# Dependency graph
requires:
  - phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
    provides: KY source location + bookend ties (112-BATCH1-SOURCES.md) + roster lock
  - phase: 113-acfr-upgrade-batch-1-in-az-or-mo-co
    provides: extract_gf.py + gen_state.py tooling, IL loader template, ephemeral data_sources lifecycle
provides:
  - Kentucky state node (6d9dfe88) live on full State-ACFR GAAP, FY2002-FY2022 + FY2024-FY2025 (FY2023 honest hole)
  - scripts/processKYAcfr.js + scripts/processKYRevenueAcfr.js (reusable KY loaders)
  - extract_gf.py pending-label-prefix accumulator (reusable fix for future states with two-line-wrapped category labels)
affects: [116-verification-source-chain-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns: [extract_gf.py pending-prefix accumulator for two-line wrapped category labels]

key-files:
  created:
    - scripts/processKYAcfr.js
    - scripts/processKYRevenueAcfr.js
    - .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-02-KY-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored — KY CONFIGS entry; not committed to git)
    - _acfr-work/extract_gf.py (gitignored — pending-prefix wrapped-label fix; not committed to git)

key-decisions:
  - "FY2023 ACFR PDF has no ToUnicode CMap on any embedded font -- pdftotext garbles the entire document (not just the statement pages), unlike FY2002's OCR-scan case where the numeric table still extracted cleanly -- omitted as a genuine, documented extraction failure rather than force-transcribed"
  - "extract_gf.py's silent dropping of text-only wrapped-label continuation lines was truncating category names across many years (numbers were always correct) -- fixed generically with a pending-prefix accumulator, not a KY-specific hack"
  - "FY2002's one-off OCR typo ('Rnes and forfeits' -> 'Fines and forfeits') was hand-corrected in the extracted JSON after confirming the identical row position/value pattern in every other loaded year; the numeric value was unaffected"

patterns-established:
  - "pending-prefix accumulator in extract_gf.py: a text-only table line with no digits anywhere is held and prepended onto the next data row's label, fixing two-line wrapped category names generically for any future state with a narrow label column"

requirements-completed: [ACFR-27, ACFR-31, ACFR-32]

# Metrics
duration: 45min
completed: 2026-07-03
---

# Phase 114 Plan 02: Kentucky ACFR Upgrade Summary

**Kentucky state node upgraded NASBO-only to full State-ACFR GAAP (GF revenue-by-source + spend-by-function), 23 of 24 recon-scoped fiscal years FY2002-FY2025 (FY2023 a documented honest hole), all tying to $0 diff.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified:** 3 (2 new loaders + 1 loadlog); STATE.md/ROADMAP.md/REQUIREMENTS.md updated separately

## Accomplishments

- Built `scripts/processKYAcfr.js` (GF spend-by-function, `operating`) and `scripts/processKYRevenueAcfr.js` (GF revenue-by-source, `revenue`) on the IL/Phase-113 loader template, generated via `_acfr-work/gen_state.py`
- Enumerated all 24 per-year finance.ky.gov ACFR PDF URLs directly from the landing page (Node's native `fetch` worked without any TLS workaround in this environment — the recon-flagged `curl -k` requirement did not reproduce here) and downloaded FY2002-FY2025 (including the 73MB FY2002 scan), skipping all "Supplemental Report" files
- Extracted and tie-verified 23 of 24 fiscal years — every year ties exactly ($0 diff) to the printed General Fund column "Total revenues" / "Total expenditures" on the Statement of Revenues, Expenditures, and Changes in Fund Balances
- Bookends confirmed: FY2024 GF Total revenues = $15,456,606,000; FY2002 = $6,510,474,000
- Live-loaded both operating and revenue for all 23 tying years; FY2024 NASBO operating row replaced in place (zero duplicates); FY2023's pre-existing NASBO row correctly left untouched since its source PDF could not be transcribed
- Discovered and fixed a genuine extraction defect in the shared `extract_gf.py`: KY's narrow label column wraps several category names across two physical `pdftotext -table` lines (e.g. "Interest and other" / "investment income") with no numbers on the first line — the tool was silently dropping the first-line fragment, truncating display names across many years even though the numeric ties were always correct. Added a generic `pending`-prefix accumulator that carries a text-only continuation line forward onto the next data row's label.
- Found and corrected a one-off FY2002 OCR typo ("Rnes and forfeits" → "Fines and forfeits") directly in the extracted JSON, confirmed against the identical row position/value pattern in every other loaded year; the numeric value was never affected.
- Confirmed the P2 clamp fires live in nearly every loaded year: "Interest and other investment income" and "Increase (decrease) in fair value of investments" both go negative repeatedly (e.g. FY2012 -$681K / -$15,574K), correctly rendered at $0 with the signed magnitude preserved in the label.
- Proved idempotency (FY2024 re-run = 0 net change, byte-for-byte) and 0 `data_sources` residue (`ky-acfr-%` count = 0 both before and after)
- Confirmed the cohort is untouched: spot-checked SC/IN/CA (existing ACFR nodes, unchanged) and Utah (un-upgraded Batch-2 roster state, still clean NASBO-only)
- Documented the ~1.09x KY-vs-NASBO near-parity honestly (ACFR-31): Kentucky reports Federal funds through a separate major fund column, the same favorable mechanism that keeps Indiana's divergence small in this tranche

## Task Commits

1. **Task 1: Build both KY loaders + download/extract/transcribe FY2002-FY2025 + dry-run tie** - `299053c` (feat)
2. **Task 2 + 3: Live-load KY (operating + revenue) + idempotency/0-residue/cohort verification + LOADLOG** - `0a76945` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/processKYAcfr.js` - KY GF spending-by-function loader, `dataset_type='operating'`, UNITS=1000, tie-verified FY2002-FY2022 + FY2024-FY2025
- `scripts/processKYRevenueAcfr.js` - KY GF revenue-by-source loader, `dataset_type='revenue'`, UNITS=1000, tie-verified FY2002-FY2022 + FY2024-FY2025
- `.planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-02-KY-LOADLOG.md` - Per-FY load disposition, FY2023 honest-hole rationale, NASBO-replacement confirmation, near-parity record, idempotency + 0-residue result
- `_acfr-work/gen_state.py` (gitignored, not committed) - added `KY` CONFIGS entry
- `_acfr-work/extract_gf.py` (gitignored, not committed) - added the generic `pending`-prefix wrapped-label accumulator

## Decisions Made

- **FY2023 treated as a genuine extraction failure, not force-transcribed:** `pdffonts` confirmed every embedded font in the FY2023 PDF has no ToUnicode CMap, and `pdftotext` (in every mode tried) produces a document-wide garbled text layer — categorically different from FY2002's OCR-scan case where the numeric table still extracted cleanly despite garbled narrative text. Checked the Wayback Machine for an alternate copy; it returned the byte-identical file. No OCR tooling (tesseract) was available in this environment as a fallback. FY2023's pre-existing NASBO operating row was left untouched rather than force-replaced with fabricated data — this is the honest-hole path the plan explicitly sanctions.
- **extract_gf.py fixed generically, not with a KY-specific hack:** the wrapped-label truncation is a structural artifact of any narrow label column, not a KY-only quirk, so the fix (a `pending`-prefix accumulator) lives in the shared tool for reuse by any future state with the same pattern — mirroring the SC precedent of extending `gen_state.py`/`extract_gf.py` generically rather than hand-patching category names.
- **FY2002 OCR typo hand-corrected only after cross-year confirmation:** rather than guessing, the correction ("Rnes" → "Fines") was verified against the identical row position and relative value pattern present in every other loaded year before being applied directly to the extracted JSON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a wrapped-label truncation defect in the shared extract_gf.py tool**
- **Found during:** Task 1 (generating the KY loaders and inspecting the output)
- **Issue:** KY's printed Statement of Revenues, Expenditures, and Changes in Fund Balances has a narrow label column that wraps several category names across two physical `pdftotext -table` lines — e.g. "Interest and other" / "investment income", "Increase (decrease) in fair" / "value of investments", "Natural resources and" / "environmental protection". `extract_gf.py` had no mechanism to detect these text-only continuation lines and was silently dropping them, so the generated loaders would have shipped truncated, factually-wrong category labels (e.g. "investment income" and "environmental protection" instead of the full names) on a public-facing financial transparency page. Numeric totals were never affected (ties were correct throughout).
- **Fix:** Added a `pending`-prefix accumulator to `extract_gf.py`'s `extract()` function. A text-only line with no digits anywhere on it (and not ending in `:`, which is reserved for subsection headers) is held and prepended onto the label of the next data row that carries a number, then cleared.
- **Files modified:** `_acfr-work/extract_gf.py` (gitignored working tool, not committed to git; re-ran extraction for all 23 tying years after the fix)
- **Verification:** Re-extracted all 23 years post-fix and confirmed every previously-truncated label now reads correctly in full ("Interest and other investment income", "Increase (decrease) in fair value of investments", "Natural resources and environmental protection") while every numeric tie held unchanged at $0 diff (the fix only touches label text, never the numeric extraction path).
- **Committed in:** `299053c` (Task 1 commit)

**2. [Rule 1 - Bug] Corrected a one-off FY2002 OCR typo in the extracted revenue data**
- **Found during:** Task 1 (post-extraction label review)
- **Issue:** The 73MB scanned FY2002 PDF's OCR text layer misread "Fines and forfeits" as "Rnes and forfeits" on the one row carrying the numeric value.
- **Fix:** Confirmed the correct label against the identical row position and relative value pattern in every other loaded year, then hand-corrected the label directly in `ky/KY2002.json` before merging into `ky_all.json`. The numeric value ($44,760 thousand) was untouched — only the OCR-garbled label glyph was fixed.
- **Files modified:** `_acfr-work/ky/KY2002.json` (gitignored working data, not committed to git)
- **Verification:** Re-ran the dry-run tie after the correction; FY2002 still tied to $0 diff (the fix is label-only).
- **Committed in:** `299053c` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes are necessary for data-labeling accuracy on a public-facing transparency page and neither touched the underlying tie-out totals. No scope creep — both fixes stayed inside the shared gitignored tooling / one-off extracted-data correction.

## Issues Encountered

**FY2023 could not be loaded** — see the "FY2023 honest hole" section in `114-02-KY-LOADLOG.md` for the full technical rationale (no ToUnicode CMap, document-wide text-layer corruption, no OCR fallback available, Wayback copy byte-identical). This is documented as an honest hole, not an error: the plan explicitly permits omitting non-extracting years rather than force-writing unverifiable data. Kentucky's pre-existing NASBO FY2023 operating row remains live and correctly labelled as NASBO (not silently dropped or corrupted).

All other 23 fiscal years downloaded with valid `%PDF` magic bytes and sizes well above the 500KB soft-404 threshold on the first attempt; no retry loop was needed for those years.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Kentucky is fully ACFR-sourced for 23 of 24 recon-scoped years (operating + revenue, GAAP-labelled, NASBO FY2024 replaced, Money In enabled) and ready to hand off to Phase 116 for independent re-derivation + cohort audit + UAT alongside the rest of the Batch-2 states (SC done, UT/AL/LA remaining).
- The FY2023 honest hole should be carried into Phase 116's verification scope as an expected, documented absence (not a defect to chase) unless a future OCR-capable environment becomes available to revisit it.
- No blockers. `extract_gf.py`'s new `pending`-prefix accumulator is available for reuse by any remaining Batch-2/Batch-3 or deepening-pass state with the same two-line wrapped-label pattern.

## Self-Check: PASSED

- FOUND: scripts/processKYAcfr.js
- FOUND: scripts/processKYRevenueAcfr.js
- FOUND: .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-02-KY-LOADLOG.md
- FOUND: commit 299053c (Task 1)
- FOUND: commit 0a76945 (Task 2+3)

---
*Phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32*
*Completed: 2026-07-03*
