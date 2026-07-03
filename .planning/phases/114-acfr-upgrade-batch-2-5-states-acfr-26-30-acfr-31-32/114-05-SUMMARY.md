---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
plan: 05
subsystem: database
tags: [acfr, pdftotext, supabase, state-budget, treasury]

requires:
  - phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
    provides: LA source location (doa.la.gov hash-URL landing/archive pages), bookend ties, GF-alone scope-decision flag, ~99%-federal-composition finding, clean-NASBO-only overlap probe
  - phase: 113-acfr-upgrade-batch-1-in-az-or-mo-co
    provides: extract_gf.py + gen_state.py Phase-113 tooling reused as-is (with this plan's fixes layered on top)
  - phase: 114-04
    provides: gen_state.py CONFIGS-entry generation pattern + GF-alone scope-decision precedent (UT, AL)
provides:
  - LA state node fully on State-ACFR GAAP (GF revenue-by-source + spending-by-function, FY2002-FY2025, zero honest holes)
  - GF-alone scope decision resolved and recorded (ACFR-31) — LA's ~1.90x divergence driven by ~99% federal Intergovernmental Revenues in the GF, with own-source state taxes booked to the separate Bond Security & Redemption Fund column
  - extract_gf.py generalized with a position-anchor/first-cell fallback for non-uniform pdftotext -table column alignment, and a whitespace-tolerant statement-header regex
  - gen_state.py generalized with ALL-CAPS source title-casing (smart_title()) and dual Current/Intergovernmental expenditure-subsection disambiguation
affects: [116-verification-source-chain-audit-uat]

tech-stack:
  added: []
  patterns: [gen_state.py CONFIGS-entry per-state loader generation, ephemeral data_sources create/RPC/delete lifecycle, P2 clamp for negative GF lines, hash-URL landing-page re-enumeration for non-derivable CMS paths, position-anchor/first-cell fallback extraction for non-uniform table alignment]

key-files:
  created:
    - scripts/processLAAcfr.js
    - scripts/processLARevenueAcfr.js
    - .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-05-LA-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (LA CONFIGS entry + smart_title() ALL-CAPS fix + Intergovernmental-subsection disambiguation; gitignored)
    - _acfr-work/extract_gf.py (statement-header regex \s+ tolerance + anchored/first-cell fallback retry; gitignored)

key-decisions:
  - "GF-alone scope decision (ACFR-31): loaded the printed General Fund column alone, not a GF+Bond Security & Redemption Fund composite — resolves the 112-recon load-phase flag"
  - "LA's ~1.90x NASBO divergence documented with its structurally distinct driver (unique in this tranche): ~99% of the GF is federal Intergovernmental Revenues, while Louisiana's own-source state taxes are booked entirely to the separate Bond Security & Redemption Fund column — confirmed by the Taxes/Gaming/Tobacco Settlement revenue lines printing a blank GENERAL FUND cell in all 24 loaded years"
  - "ALL-CAPS source labels generalized via a new smart_title() helper in gen_state.py rather than a one-off LA string transform — reusable for any future ALL-CAPS state"
  - "Dual Current/Intergovernmental expenditure-subsection collision (LA repeats the same function-name lineup under two subsections starting FY2015) resolved with a generic ' — Intergovernmental' suffix rule in default_exp_name(), not a LA-specific hack"
  - "extract_gf.py's single Total-revenues-anchored column position, which assumes stable right-edge alignment across a whole document, broke on LA's FY2003-2005 older-era table layout; fixed with a position-blind first-cell retry per document rather than widening the tolerance (which risked wrong-column grabs on other states)"

patterns-established:
  - "gen_state.py smart_title() — title-cases genuinely ALL-CAPS source labels (lowercasing connector words except when leading), gated on s == s.upper() so it never fires on already-correctly-cased sources"
  - "gen_state.py default_exp_name() Intergovernmental-subsection suffix rule — disambiguates duplicate function names appearing under both a 'Current' and an 'Intergovernmental' expenditure subsection"
  - "extract_gf.py per-document anchored/first-cell fallback — main() tries the position-anchored pass first (protects against wrapped-label overflow), falls back to position-blind first-cell (GF is always column 1) only if the anchored pass fails to tie"

requirements-completed: [ACFR-30, ACFR-31, ACFR-32]

duration: 70min
completed: 2026-07-03
---

# Phase 114 Plan 05: Louisiana ACFR Upgrade Summary

**Louisiana state node upgraded from NASBO operating-only to full State-ACFR GAAP (GF revenue-by-source + spending-by-function) across the complete FY2002–FY2025 window (24 years, zero honest holes), resolving the recon's GF-alone-vs-composite load-phase decision and documenting the tranche's only structurally-driven (not merely federal-passthrough-sized) divergence: LA's GF is ~99% federal Intergovernmental Revenues, with Louisiana's own state tax revenue booked entirely to a separate fund column.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 3 completed
- **Files modified:** 3 (2 loader scripts + 1 LOADLOG; `_acfr-work/gen_state.py` + `_acfr-work/extract_gf.py` changes are gitignored tooling)

## Accomplishments

- Both LA loaders (`processLAAcfr.js`, `processLARevenueAcfr.js`) built via `_acfr-work/gen_state.py`'s new LA CONFIGS entry, on the proven IL/SC/KY/UT/AL template
- All 24 per-year hash-path URLs (FY2002–FY2025) live-enumerated from the two doa.la.gov landing pages (`annual-financial-report/` for FY2022–FY2025, `archives/` for FY2002–FY2021), never guessed from the FY — including catching a genuine filename misspelling (`carf03.pdf`, not `cafr03.pdf`) on the state's own archive page for FY2003
- All 24 PDFs downloaded, verified (%PDF magic + 1.29MB–10.44MB, all well above the 500KB soft-404 guard), `pdftotext -table`-extracted, and tie-verified via `extract_gf.py` to $0 diff on BOTH revenue and expenditure printed General Fund totals — zero honest holes, the cleanest FY coverage in the tranche after Alabama
- Bookends confirmed exactly: FY2025 GF Total revenues $22,780,529K / expenditures $39,246,140K; FY2002 GF Total revenues $5,807,699K / expenditures $14,695,770K — matching the plan's source_facts precisely
- Live-loaded operating + revenue for all 24 FYs; NASBO FY2023/FY2024 operating rows replaced in place (0 NASBO labels remain, exactly one operating row per (LA, fy))
- GF-alone scope decision (ACFR-31) resolved and documented with unusual prominence: LA's ~1.90× NASBO divergence is driven not by a modest federal-passthrough increment (the IL/AZ/MO/CO/SC mechanism) but structurally — ~99% of the GF ($22,482,784K of $22,780,529K FY2025) is federal Intergovernmental Revenues, while Louisiana's own-source state taxes (~$14.1B) sit entirely in the separate Bond Security & Redemption Fund column of the same statement, confirmed by every "Taxes"/"Gaming"/"Tobacco Settlement" revenue line printing a blank GENERAL FUND cell in all 24 loaded years
- Full-cohort negative-value scan found 4 of 24 years with a negative GF revenue line ("Use of Money and Property": FY2004 -$38,246K, FY2012 -$20,092K, FY2013 -$80,800K, FY2022 -$4,006K) — the P2 clamp path (ACFR-32) fired live and correctly for all 4, spot-verified via `--dry-run --fy 2013`
- Two new discoveries generalized into shared tooling rather than hand-patched for LA alone: (1) LA's ALL-CAPS source labels (`"INTERGOVERNMENTAL REVENUES"`) needed title-casing to match the cohort's Title Case convention — added `smart_title()` to `gen_state.py`; (2) LA repeats the same function-name lineup under both a "Current" and an "Intergovernmental" expenditure subsection starting FY2015 — added a `" — Intergovernmental"` disambiguation suffix to `default_exp_name()`
- Two further `extract_gf.py` fixes discovered and generalized: a statement-header regex that required a single literal space (broke on FY2016–FY2019's multi-space-gapped header rendering), and a position-anchor/first-cell fallback for FY2003–FY2005's non-uniform column alignment (the single Total-revenues-anchored position assumption failed on this older-era layout)
- Idempotency proven: re-running FY2024 operating + revenue live a second time produced 0 net change (identical row IDs, totals, and source stamps); `treasury.data_sources` has 0 `la-acfr-%` rows both before the first load and after the re-run (WR-05/LOAD-01 ephemeral lifecycle holds)
- Confirmed untouched: the existing ACFR cohort (spot-checked SC/KY/UT/AL) and a NASBO-only sample (WY); re-verified zero regression across all 96 already-loaded SC/KY/UT/AL state-years after both `extract_gf.py` fixes
- Money In auto-enabled data-driven (24 new revenue rows)

## Task Commits

1. **Task 1: Build both LA loaders + enumerate hash URLs + download/extract/transcribe FY2002–FY2025 + dry-run tie** - `a1bddc0` (feat)
2. **Task 2 + Task 3: Live-load LA + idempotency/0-residue/cohort-untouched verification + LOADLOG** - `5021001` (docs) — Task 2 produced no file changes (pure DB write); combined with Task 3's LOADLOG per established plan convention (114-02/114-03/114-04 precedent)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/processLAAcfr.js` - LA GF spending-by-function loader (dataset_type='operating'), UNITS=1000, tie-verified FY2002–FY2025
- `scripts/processLARevenueAcfr.js` - LA GF revenue-by-source loader (dataset_type='revenue'), UNITS=1000, P2 clamp wired, tie-verified FY2002–FY2025
- `.planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-05-LA-LOADLOG.md` - Full load disposition, GF-alone + federal-composition record, idempotency + 0-residue proof, cohort-untouched checks
- `_acfr-work/gen_state.py` (gitignored) - Added LA CONFIGS entry; added `smart_title()` ALL-CAPS title-casing and `default_exp_name()` Intergovernmental-subsection disambiguation
- `_acfr-work/extract_gf.py` (gitignored) - Fixed statement-header regex to tolerate multi-space gaps; added a position-anchor/first-cell fallback retry when the anchored pass fails to tie

## Decisions Made

- **GF-alone over GF+Bond-Security-and-Redemption composite (ACFR-31):** the printed GF column ties exactly to $0 diff every year across all 24 years and matches the cohort-wide uniform mold; a composite total is unprintable and unverifiable against any source statement. The resulting ~1.90× divergence is honest and driven by a genuinely different mechanism than every other tranche state — LA's own-source tax revenue physically lives in a different fund column, not merely a larger federal-passthrough share of the same GF.
- **Generalized ALL-CAPS handling in gen_state.py rather than a bespoke LA string transform:** since this is the first ALL-CAPS source in the tranche and future states could plausibly share the pattern, `smart_title()` was added as a shared, narrowly-gated (`s == s.upper()`) fix in `norm()` rather than a one-off LA-specific label rewrite.
- **Generalized Intergovernmental-subsection disambiguation rather than a bespoke LA merge/rename:** LA's dual Current/Intergovernmental function breakdown is a real GAAP structural feature (not unique to LA in principle), so `default_exp_name()` gained a general rule keyed on the `sub` value rather than hardcoding LA-specific category renames.
- **Position-blind first-cell fallback over widening the anchor tolerance:** widening `cell_at_anchor`'s tolerance risked silently grabbing values from an adjacent fund column on other, correctly-anchored states. A per-document fallback that only activates when the anchored pass fails its own tie-check is safer — it never changes behavior for a document that already ties.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `extract_gf.py` statement-header regex to tolerate multi-space gaps**
- **Found during:** Task 1 (LA's FY2016–FY2019 PDFs render the statement header with large multi-space gaps between "Revenues," and "Expenditures" — `find_statement()` reported "statement not found" for exactly those 4 years)
- **Issue:** The regex `r'Statement of Revenues,? Expenditures'` required a single literal space; LA's title-line rendering for those 4 years inserted many spaces instead.
- **Fix:** Changed to `r'Statement of Revenues,?\s+Expenditures'`.
- **Verification:** All 4 previously-unfound years (FY2016–FY2019) now extract and tie at $0 diff; re-ran the full SC/KY/UT/AL corpus (96 state-years) post-fix with identical results.
- **Committed in:** `a1bddc0` (Task 1 commit) — fix lives in gitignored tooling, generated loaders reflect it.

**2. [Rule 1 - Bug] Added position-anchor/first-cell fallback to `extract_gf.py` for FY2003–FY2005**
- **Found during:** Task 1 (FY2003 and FY2005 dropped genuine in-column revenue values; FY2004's entire expenditures section anchor drifted, leaving `Total Expenditures` blank)
- **Issue:** `extract_gf.py`'s single `'Total revenues'`-row-derived anchor assumed a stable right-edge column position across the whole document; LA's FY2003–FY2005 statements have label-length-dependent padding drift within and across sections, so several genuine GF-column values fell outside the anchor's tolerance and were silently dropped.
- **Fix:** Added a `use_anchor` parameter to `extract()`; `main()` now tries the anchored pass first (unchanged behavior for every already-working document) and retries with position-blind `first_cell()` extraction only if the anchored pass fails to tie.
- **Verification:** FY2003/2004/2005 now tie at $0 diff via the fallback path; re-ran SC/KY/UT/AL (96 state-years) post-fix — all still tie via the original anchored path, zero regression.
- **Committed in:** `a1bddc0` (Task 1 commit).

**3. [Rule 2 - Missing critical functionality] Added `smart_title()` ALL-CAPS title-casing to `gen_state.py`**
- **Found during:** Task 1 (LA's raw extracted category labels are all-uppercase — `"INTERGOVERNMENTAL REVENUES"`, `"USE OF MONEY & PROPERTY"` — while the plan's own example text explicitly expects Title Case, e.g. "Intergovernmental Revenues")
- **Issue:** Without title-casing, LA's tree would render in ALL CAPS while every other cohort state renders in Title Case — a display inconsistency that also risks looking like a data-quality issue to a UAT reviewer, even though the underlying figures are correct.
- **Fix:** Added `smart_title()` (lowercases connector words unless leading) invoked from `norm()`, gated on `s == s.upper()` so it only fires on genuinely all-uppercase source text.
- **Verification:** LA's generated loaders now show `"Intergovernmental Revenues"`, `"Use of Money & Property"`, etc.; re-ran SC/KY/UT/AL post-fix — no label changed (their sources are not all-uppercase).
- **Committed in:** `a1bddc0` (Task 1 commit).

**4. [Rule 1 - Bug] Added Intergovernmental-subsection disambiguation to `default_exp_name()`**
- **Found during:** Task 1 (LA's FY2015–FY2025 expenditure section repeats the same function names — e.g. "General Government," "Education" — under both a "Current" subsection and a separate "Intergovernmental" subsection; without disambiguation the generated tree would show two identically-named sibling leaves)
- **Issue:** `default_exp_name()` only special-cased "Debt service" sub-headings; any other `sub` value was ignored, so the two occurrences of e.g. "Education" (Current $1,309,762K vs. Intergovernmental $6,801,090K in FY2025) would both render with the plain name "Education," producing a broken-looking duplicate in the leaf list.
- **Fix:** Added a rule appending `" — Intergovernmental"` when `sub.lower() == 'intergovernmental'` and the label doesn't already mention it.
- **Verification:** FY2015–FY2025 trees now show both "Education" and "Education — Intergovernmental" as distinct, correctly-summed leaves; validate() ties unaffected (label-only change).
- **Committed in:** `a1bddc0` (Task 1 commit).

---

**Total deviations:** 4 auto-fixed (2 Rule 1 bug fixes to shared extraction tooling, 2 Rule 2 missing-functionality additions to shared generation tooling) — all four are generalized, reusable fixes to the shared `_acfr-work/extract_gf.py`/`gen_state.py` tooling, not LA-specific hacks, and all four were re-verified against zero regression on the 96 already-loaded SC/KY/UT/AL state-years.
**Impact on plan:** Necessary for correctness (complete FY coverage, correct category disambiguation) and for consistent cohort-wide display conventions. No scope creep; no change to any previously-loaded state's stored dollar amount or category structure.

## Issues Encountered

The four deviations above (all auto-fixed, all generalized into shared tooling). No architectural decisions required (Rule 4 not triggered). LA's PDFs all downloaded cleanly on the first attempt with a standard browser User-Agent (no CDN/WAF block, unlike AZ/CO in Phase 113) once the correct hash URLs were live-enumerated from the two landing pages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Louisiana is fully ACFR-sourced (operating + revenue, GAAP-labelled, NASBO replaced, Money In enabled, 0 data_sources residue, cohort rows untouched) and ready for Phase 116's independent re-derivation + cohort audit + UAT. The GF-alone scope decision and its unusual structural driver (federal-Intergovernmental-dominated GF vs. taxes-in-Bond-Security-Fund) are fully documented for the verification phase to re-derive against. No blockers or concerns carried forward.

---
*Phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32*
*Plan: 05*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created files verified present (scripts/processLAAcfr.js, scripts/processLARevenueAcfr.js, 114-05-LA-LOADLOG.md, 114-05-SUMMARY.md); all referenced commits (a1bddc0, 5021001) verified present in git log.
