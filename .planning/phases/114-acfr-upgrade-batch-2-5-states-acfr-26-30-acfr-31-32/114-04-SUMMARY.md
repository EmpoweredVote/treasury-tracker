---
phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32
plan: 04
subsystem: database
tags: [acfr, pdftotext, supabase, state-budget, treasury]

requires:
  - phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
    provides: AL source location (comptroller.alabama.gov era filename map), bookend ties, GF-alone scope-decision flag, Sep-30 FY-end flag, clean-NASBO-only overlap probe
  - phase: 113-acfr-upgrade-batch-1-in-az-or-mo-co
    provides: extract_gf.py + gen_state.py Phase-113 tooling reused as-is
  - phase: 114-03
    provides: gen_state.py CONFIGS-entry generation pattern + GF-alone scope-decision precedent (UT)
provides:
  - AL state node fully on State-ACFR GAAP (GF revenue-by-source + spending-by-function, FY2002-FY2025, zero honest holes)
  - GF-alone scope decision resolved and recorded (ACFR-31) — AL is the tranche's narrowest divergence (~0.24x NASBO)
  - gen_state.py generalized with fy_end + fiscal_year_start_month config options (the MI Sep-30 precedent, now reusable for any future non-June-30 state)
affects: [116-verification-source-chain-audit-uat]

tech-stack:
  added: []
  patterns: [gen_state.py CONFIGS-entry per-state loader generation, ephemeral data_sources create/RPC/delete lifecycle, P2 clamp for negative GF lines, fiscal_year_start_month belt-and-suspenders stamp for non-June-30 FY-end states]

key-files:
  created:
    - scripts/processALAcfr.js
    - scripts/processALRevenueAcfr.js
    - .planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-04-AL-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (AL CONFIGS entry + new fy_end/fiscal_year_start_month config options; gitignored)

key-decisions:
  - "GF-alone scope decision (ACFR-31): loaded the printed General Fund column alone, not a GF+Education Trust Fund composite — resolves the 112-recon load-phase flag"
  - "AL's ~0.24x narrower-than-NASBO divergence (the tranche's narrowest) documented as honest and GAAP-correct (constitutional GF/Education-Trust-Fund dual-budget split), corroborated by GF+ETF ~1.04x NASBO"
  - "Sep-30 FY-end (MI precedent, D-03) handled generically by extending gen_state.py with fy_end and fiscal_year_start_month config options rather than hand-writing a one-off loader"
  - "GF column selected by position (1st numeric token, anchored on the Total revenues/Total expenditures row), never by column-header text, across the era-shifting major-fund lineup (Public Road and Bridge Fund in FY2002 vs. ARPA Coronavirus State Fiscal Recovery Fund in FY2024)"

patterns-established:
  - "gen_state.py fy_end (default '06-30') + fiscal_year_start_month (default none) config options — generalizes the MI Sep-30 precedent into the shared per-state loader generator, reusable for any future non-June-30 FY-end state without a bespoke loader"

requirements-completed: [ACFR-29, ACFR-31, ACFR-32]

duration: 25min
completed: 2026-07-02
---

# Phase 114 Plan 04: Alabama ACFR Upgrade Summary

**Alabama state node upgraded from NASBO operating-only to full State-ACFR GAAP (GF revenue-by-source + spending-by-function) across the complete FY2002–FY2025 window (24 years, zero honest holes), resolving the recon's GF-alone-vs-composite load-phase decision and documenting the tranche's narrowest NASBO divergence (~0.24×) as an honest artifact of Alabama's constitutional dual-budget system.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 completed
- **Files modified:** 3 (2 loader scripts + 1 LOADLOG; `_acfr-work/gen_state.py` change is gitignored tooling)

## Accomplishments

- Both AL loaders (`processALAcfr.js`, `processALRevenueAcfr.js`) built via `_acfr-work/gen_state.py`'s new AL CONFIGS entry, on the proven IL/KY/SC/UT template
- Resolved all 24 per-era PDF URLs (FY2002–FY2025, 12+ naming styles) directly from the single `comptroller.alabama.gov/acfr-2/` landing page in one fetch — no guessed-filename 404s
- All 24 PDFs downloaded, verified (%PDF magic + >500KB), `pdftotext -table`-extracted, and tie-verified via `extract_gf.py` to $0 diff on BOTH revenue and expenditure printed General Fund totals — on the FIRST extraction pass, zero honest holes, the cleanest run of the v2.14 tranche so far (uniform 6-revenue/11-12-expenditure category shape across the entire window, no OCR defects, no wrapped labels, no font issues)
- Bookends confirmed exactly: FY2024 GF Total revenues $3,262,681K / expenditures $2,291,921K; FY2002 GF Total revenues $1,094,623K / expenditures $1,044,708K — all four $0 diff
- Live-loaded operating + revenue for all 24 FYs; NASBO FY2023/FY2024 operating rows replaced in place (0 NASBO labels remain, exactly one operating row per (AL, fy))
- GF-alone scope decision (ACFR-31) resolved and documented: Alabama's ACFR GF is the tranche's narrowest NASBO divergence (~0.24×), driven by the constitutional GF/Education Trust Fund dual-budget split (ETF $10,779,442K FY2024 kept as a separate major fund); GF+ETF ≈ 1.04× NASBO corroborates that NASBO's survey figure combines both funds
- Full-cohort negative-value scan across all 24 years found zero negative GF lines (revenue or expenditure) — the P2 clamp path (ACFR-32) stays wired but was never exercised for AL, unlike UT (FY2022) or CO (FY2024 TABOR)
- Sep-30 FY-end (D-03, MI precedent) handled generically: extended `gen_state.py` with `fy_end` and `fiscal_year_start_month` config options rather than hand-writing a bespoke AL loader; confirmed on all 48 rows (`source_date` ending `-09-30`, `fiscal_year_start_month=10`)
- Idempotency proven: re-running FY2024 operating + revenue live a second time produced 0 net change; `treasury.data_sources` has 0 `al-acfr-%` rows both before the first load and after the re-run (WR-05/LOAD-01 ephemeral lifecycle holds)
- Confirmed untouched: the existing ACFR cohort (spot-checked SC/KY/UT) and a NASBO-only sample (WY)
- Money In auto-enabled data-driven (24 new revenue rows)

## Task Commits

1. **Task 1: Build both AL loaders + download/extract/transcribe FY2002–FY2025 + dry-run tie** - `360cab6` (feat)
2. **Task 2 + Task 3: Live-load AL + idempotency/0-residue/cohort-untouched verification + LOADLOG** - `91d6490` (docs) — Task 2 produced no file changes (pure DB write); combined with Task 3's LOADLOG per established plan convention (see 114-02/114-03 precedent)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `scripts/processALAcfr.js` - AL GF spending-by-function loader (dataset_type='operating'), UNITS=1000, Sep-30 FY-end, tie-verified FY2002–FY2025
- `scripts/processALRevenueAcfr.js` - AL GF revenue-by-source loader (dataset_type='revenue'), UNITS=1000, Sep-30 FY-end, P2 clamp wired, tie-verified FY2002–FY2025
- `.planning/phases/114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32/114-04-AL-LOADLOG.md` - Full load disposition, scope-decision record, Sep-30 confirmation, idempotency + 0-residue proof, cohort-untouched checks
- `_acfr-work/gen_state.py` (gitignored) - Added AL CONFIGS entry; added `fy_end` (default '06-30') and `fiscal_year_start_month` (default none) config options generalizing the MI Sep-30 precedent

## Decisions Made

- **GF-alone over GF+Education-Trust-Fund composite (ACFR-31):** the printed GF column ties exactly to $0 diff every year across all 24 years and matches the cohort-wide uniform mold; a composite total is unprintable and unverifiable against any source statement. The resulting drop vs. NASBO (~0.24×, the tranche's narrowest) is honest, not padded — corroborated by the GF+ETF≈1.04× match against NASBO.
- **Generalized Sep-30 handling in gen_state.py rather than a bespoke loader:** MI's Phase-109 loader hand-wrote its Sep-30 handling as a one-off custom loader (parser-based, not generator-based). Since AL fits the standard IL-template generator shape (explicit per-year URLs, no positional parser needed), the cleaner path was extending the shared generator with `fy_end`/`fiscal_year_start_month` config options — reusable for any future non-June-30 state without repeating MI's bespoke approach.
- **Position-anchored column selection:** confirmed via `extract_gf.py`'s existing anchor-on-"Total revenues"-row mechanism — no change needed. Selection was already position-based, so the major-fund lineup shift (Public Road and Bridge Fund in FY2002 vs. ARPA Coronavirus State Fiscal Recovery Fund in FY2024) never risked corrupting extraction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added `fy_end` + `fiscal_year_start_month` config options to `gen_state.py`**
- **Found during:** Task 1 (building the AL loader — the plan's interfaces section explicitly requires `source_date = ${fy}-09-30` and the MI-precedent `fiscal_year_start_month` propagation, but the shared generator only supported the standard June-30 date)
- **Issue:** `gen_state.py`'s `sources_block()` hardcoded `date: '{y}-06-30'` for every state; the generator also never stamped `fiscal_year_start_month` anywhere, which MI's bespoke loader does on both the ephemeral `data_sources` payload and the post-RPC `budgets` UPDATE (belt-and-suspenders per D-03). Without this, AL's generated loaders would have stamped incorrect June-30 source_dates and omitted the `fiscal_year_start_month=10` propagation entirely — a correctness requirement per the plan's must_haves and threat T-114-04-D.
- **Fix:** Added `fy_end` (default `'06-30'`, override to `'09-30'` in the AL CONFIGS entry) and `fiscal_year_start_month` (default none, set to `10` for AL) config options; both are threaded through to the `SOURCES` block, the ephemeral `data_sources` payload, and the post-RPC `budgets` UPDATE.
- **Files modified:** `_acfr-work/gen_state.py` (gitignored)
- **Verification:** Regenerated loaders; DB query post-load confirms 0 rows with `source_date` not ending in `-09-30` and 0 rows with `fiscal_year_start_month != 10` across all 48 AL rows.
- **Committed in:** `360cab6` (Task 1 commit) — the fix lives in gitignored tooling but the generated (committed) loaders reflect it correctly.

---

**Total deviations:** 1 auto-fixed (Rule 2 — required correctness functionality, not present in the shared generator until this plan needed it)
**Impact on plan:** Necessary for correctness of the Sep-30 FY-end handling explicitly required by the plan. No scope creep; no change to any stored dollar amount; the fix is now reusable tooling for any future non-June-30 state.

## Issues Encountered

None beyond the one deviation above. All 24 PDFs resolved directly from a single landing-page fetch and downloaded cleanly on the first attempt with a standard browser User-Agent (no CDN/WAF block, unlike AZ/CO in Phase 113); all 24 years extracted and tied to $0 diff on the first `pdftotext -table` + `extract_gf.py` pass — no honest holes, no OCR/font issues, no wrapped-label fixes needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Alabama is fully ACFR-sourced (operating + revenue, GAAP-labelled, Sep-30 dates stamped, NASBO replaced, Money In enabled, 0 data_sources residue, cohort rows untouched) and ready for Phase 116's independent re-derivation + cohort audit + UAT. No blockers or concerns carried forward.

---
*Phase: 114-acfr-upgrade-batch-2-5-states-acfr-26-30-acfr-31-32*
*Plan: 04*
*Completed: 2026-07-02*

## Self-Check: PASSED

All created files verified present (scripts/processALAcfr.js, scripts/processALRevenueAcfr.js, 114-04-AL-LOADLOG.md, 114-04-SUMMARY.md); all referenced commits (360cab6, 91d6490) verified present in git log.
