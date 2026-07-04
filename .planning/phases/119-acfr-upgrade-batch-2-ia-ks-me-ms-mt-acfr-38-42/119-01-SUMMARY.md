---
phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42
plan: "01"
subsystem: database
tags: [acfr, pdftotext, supabase, treasury_sync_budget_tree, iowa, state-acfr]

# Dependency graph
requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: enumerated per-FY Iowa ACFR URLs, bookend ties, NET-REVENUES arithmetic, NASBO baseline
provides:
  - Iowa state node (6e71a93f-a43d-4972-a239-85ddbebe2545) fully upgraded from NASBO-only to
    State-ACFR GAAP GF revenue-by-source + GAAP spending-by-function, FY2002-2007 + FY2009-2025
  - ia_extract.py — reusable IA-specific NET-REVENUES-not-GROSS post-processor over extract_gf.py
  - gen_state.py default_exp_name() "Capital Outlay" dual-subsection disambiguation (LA precedent)
affects: [120-acfr-upgrade-batch-3, 121-acfr-upgrade-batch-4, 123-nasbo-retirement, 124-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IA-specific extractor (ia_extract.py) layered on extract_gf.py for statements whose printed
      total line isn't a literal 'Total revenues' (NET REVENUES = GROSS REVENUES - contra line)"
    - "Contra/refund lines stored as NEGATIVE categories and rendered via the existing P2 clamp
      (clampForRender) rather than dropped or netted silently"

key-files:
  created:
    - scripts/processIAAcfr.js
    - scripts/processIARevenueAcfr.js
    - _acfr-work/ia_extract.py (gitignored)
    - .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-01-IA-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (gitignored — CONFIGS['IA'] entry + Capital Outlay disambiguation)

key-decisions:
  - "Stored IA revenue tree total = NET REVENUES (gross minus the 'Less revenue refunds' contra
    line), matching the printed statement's own tie-out, not GROSS REVENUES"
  - "FY2008 omitted as an honest hole — RC4-encrypted PDF, zero-length text extraction on every
    available tool (pdftotext, pypdf), no OCR/qpdf/mutool/ghostscript tooling available"
  - "FY2003 pdftotext -table wrap defect (Agriculture & Natural Resources GF value landed on an
    orphaned numbers-only line) hand-patched directly in ia_all.json with printed-row evidence"

patterns-established:
  - "Pattern: when a state's GAAP statement doesn't use a literal 'Total revenues'/'Total
    expenditures' anchor line, write a small state-specific post-processor over extract_gf.py's
    shared line-parser rather than modifying the shared anchor-detection regex"

requirements-completed: [ACFR-38]

# Metrics
duration: 60min
completed: 2026-07-04
---

# Phase 119 Plan 01: Iowa ACFR Upgrade (ACFR-38) Summary

**Iowa state node upgraded from NASBO-only to full State-ACFR GAAP (GF revenue-by-source tied to NET REVENUES, not gross, + GAAP spending-by-function) across FY2002-2007 + FY2009-2025 (23 of 24 target years), NASBO FY2023/FY2024 replaced in place.**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-07-04T08:30:00-07:00 (approx)
- **Completed:** 2026-07-04T09:40:00-07:00
- **Tasks:** 3 completed
- **Files modified:** 2 committed (scripts/processIAAcfr.js, scripts/processIARevenueAcfr.js) + 1 LOADLOG + gitignored _acfr-work tooling

## Accomplishments
- Enumerated all 24 per-FY opaque `publications.iowa.gov/{id}/` URLs from the `das.iowa.gov/acfr-archive` grid table (cell-scoped href+alt-text pairing, not a naive nearest-href heuristic) plus the current-year landing page for FY2025; downloaded, verified (%PDF magic + size), and `pdftotext -table`'d all 24 PDFs
- Built `ia_extract.py`, a dedicated IA post-processor that resolves the state's GROSS REVENUES → Less revenue refunds → NET REVENUES tie-out (no literal "Total revenues" line exists in IA's statement) by popping that triple out of `extract_gf.py`'s generic item list and storing the contra as a negative, P2-clamped category
- Generated `scripts/processIAAcfr.js` (operating) + `scripts/processIARevenueAcfr.js` (revenue) via `gen_state.py CONFIGS['IA']`; both bookends dry-run-tied exactly (FY2025 $24,251,676,000 / FY2002 $9,752,220,000, NET REVENUES ×1,000)
- Live-loaded 23 fiscal years (46 rows total) — FY2023/FY2024 NASBO operating rows replaced in place (same row `id`, GAAP total + label); confirmed via idempotent re-run (`Loaded 0 rows`, 0 net change) and 0 `data_sources` residue

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate both IA loaders + download/extract/transcribe + dry-run tie** - `023b524` (feat)
2. **Task 2: Live-load IA (operating + revenue), NASBO replaced in place** - DB-only, no repo files to commit (verified in Task 3's commit)
3. **Task 3: Idempotency + 0-residue + Money-In + cohort-untouched verification + LOADLOG** - `4ad1dd7` (feat)

_Note: Task 2 is a live-DB-write task with no repository file changes of its own; its result is recorded and verified in Task 3's LOADLOG commit._

## Files Created/Modified
- `scripts/processIAAcfr.js` - Iowa GF operating (spending-by-function) loader, GAAP basis, UNITS=1000
- `scripts/processIARevenueAcfr.js` - Iowa GF revenue (by-source) loader, GAAP basis, UNITS=1000, NET-REVENUES tie
- `_acfr-work/ia_extract.py` (gitignored) - IA-specific GROSS/NET REVENUES post-processor over extract_gf.py
- `_acfr-work/gen_state.py` (gitignored) - added `CONFIGS['IA']` + generalized `default_exp_name()` Capital Outlay disambiguation
- `.planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-01-IA-LOADLOG.md` - full per-FY load disposition

## Decisions Made
- Revenue tree total resolves to NET REVENUES (gross minus the "Less revenue refunds" contra line), matching the plan's requirement and the printed statement's own arithmetic — verified $0 diff at every one of the 23 loaded years, not just the two bookends
- FY2008 treated as an honest hole rather than force-transcribed: the PDF is genuinely text-bearing (confirmed via `pdftoppm` visual render) but both `pdftotext` and `pypdf` return zero extractable characters past the front matter, and `pdffonts` finds no font resources in that range — matches the KY FY2023 no-ToUnicode-CMap precedent exactly. No OCR/qpdf/mutool/ghostscript tooling was available in this environment, so per the "never force-transcribe from a garbled source" rule this was logged and skipped, not chased further.
- FY2003's single row-level extraction defect ("Agriculture & Natural Resources" GF value split onto an orphaned numbers-only line by `pdftotext -table`) was hand-patched directly in `ia_all.json` with printed-row evidence, following the KY FY2002-OCR-typo / UT FY2019-label-wrap precedent for one-off transcription fixes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] extract_gf.py's generic "Total revenues" anchor doesn't exist in IA's statement**
- **Found during:** Task 1 (dry-run tie verification)
- **Issue:** IA's Governmental Funds statement never prints a literal "Total revenues" line — it prints GROSS REVENUES, then "Less revenue refunds", then NET REVENUES. The shared `extract_gf.py` state machine has no way to know NET REVENUES is the tie-check total, so all three lines would be misfiled as ordinary revenue items with `rev_total` staying `None` forever (permanently failing the tie check).
- **Fix:** Wrote `_acfr-work/ia_extract.py`, a thin IA-specific post-processor that calls `extract_gf.py`'s shared `find_statement()`/`extract()` and then pops the GROSS REVENUES/Less revenue refunds/NET REVENUES triple back out, storing the contra as a negative category and setting `rev_total` = NET REVENUES.
- **Files modified:** `_acfr-work/ia_extract.py` (new, gitignored)
- **Verification:** All 23 loaded years tie the revenue total to $0 diff; both bookends confirmed exact.
- **Committed in:** `023b524` (Task 1 commit) — gitignored tooling, not tracked in git, but produced the loader data verified in that commit's dry-run output.

**2. [Rule 1 - Bug] FY2003 pdftotext -table row-split defect misattributed a GF value**
- **Found during:** Task 1 (dry-run tie verification — FY2003 initially failed `exp_tie`)
- **Issue:** `pdftotext -table` split the "Agriculture & Natural Resources" (Current subsection) row so its true GENERAL FUND value (139,493 thousand) landed alone on the preceding physical line with no label at all, while the label line itself only carried the row's later Nonmajor/Total columns (6,318 / 149,625) — causing the naive extractor to grab the wrong number.
- **Fix:** Added a generic phantom-numeric-label filter to `ia_extract.py`, then hand-patched the correct value (139,493) directly into the assembled `ia_all.json` with the printed-row evidence documented in `gen_state.py`'s IA head_note.
- **Files modified:** `_acfr-work/ia_extract.py`, `_acfr-work/ia/ia_all.json` (both gitignored)
- **Verification:** FY2003 Current-subsection sum now ties the printed TOTAL EXPENDITURES $10,004,502K exactly ($0 diff).
- **Committed in:** `023b524` (Task 1 commit)

**3. [Rule 1 - Bug] FY2004 dual expenditure-subsection name collision**
- **Found during:** Task 1 (dry-run — FY2004 categories included duplicate names across Current: and Capital Outlay: subsections)
- **Issue:** IA's FY2004 statement repeats the same function-name lineup (Administration & Regulation, Education, etc.) under both "Current:" and "Capital Outlay:" subsections with real, non-zero GF dollars in both — the generic `gen_state.py` `default_exp_name()` had no rule for this and would have produced two identically-named tree leaves.
- **Fix:** Generalized `default_exp_name()` with a "Capital Outlay" disambiguation rule (same mechanism as the existing LA "Intergovernmental" fix), appending " — Capital Outlay" to the second occurrence.
- **Files modified:** `_acfr-work/gen_state.py` (gitignored)
- **Verification:** FY2004 dry-run shows zero name collisions; category sum still ties FY2004's printed TOTAL EXPENDITURES $9,825,703K exactly.
- **Committed in:** `023b524` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in extraction/tooling, not scope creep)
**Impact on plan:** All three fixes were necessary to achieve the plan's own stated tie standard (every loaded FY ties to $0 diff). No scope creep — all fixes are narrowly scoped to IA's extraction and are documented as reusable tooling generalizations for future states with the same patterns (LA precedent).

## Issues Encountered
- FY2008's PDF initially appeared to be a scanned-image problem (visually resembled corrupted/overlapping glyphs on the org-chart page), but closer investigation with `pdftoppm` confirmed the financial-statement pages themselves render real, clean vector text — the extraction failure is a font-resource/encoding defect specific to this one file, not a scanned-document limitation. Documented as an honest hole per the KY FY2023 precedent rather than pursued further, since no OCR tooling was available in this environment (installing one would require a package-manager install requiring a checkpoint, and the effort-vs-benefit for a single interior year didn't justify raising one).

## User Setup Required
None - no external service configuration required. Live writes used the existing gitignored `.env` service-role credentials already present in the main working tree.

## Next Phase Readiness
- Iowa (ACFR-38) is fully loaded and verified idempotent with 0 residue; ready for Phase 124's independent re-derivation + cohort audit + Chris UAT.
- `ia_extract.py`'s NET-REVENUES-not-GROSS pattern and `gen_state.py`'s Capital Outlay disambiguation are both documented and reusable if a future Batch 3/4 state (Kansas, Maine, Mississippi, Montana in this same phase, or Nebraska/Nevada/etc. in later phases) exhibits the same statement shape.
- No blockers for 119-02 (Kansas) through 119-05 (Montana), which proceed independently in this phase's remaining plans.

---
*Phase: 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42*
*Completed: 2026-07-04*

## Self-Check: PASSED

- FOUND: scripts/processIAAcfr.js
- FOUND: scripts/processIARevenueAcfr.js
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-01-IA-LOADLOG.md
- FOUND: .planning/phases/119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42/119-01-SUMMARY.md
- FOUND commit: 023b524
- FOUND commit: 4ad1dd7
