---
phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53
plan: "121-06"
subsystem: database
tags: [acfr, gaap, wyoming, state-finances, pdftotext, treasury-budgets, nasbo-retirement]

# Dependency graph
requires:
  - phase: 121-05
    provides: gen_state.py/extract_gf.py tooling (VT colon-less-header split_row fix, WV rev_boundary precedent)
provides:
  - "Wyoming STATE node (4009951b) fully ACFR-sourced FY2005-2025 (21 years), revenue-by-source + spending-by-function, GAAP basis"
  - "gen_state.py CONFIGS['WY'] (UNITS=1 dollars, multi-era SOURCES map, colon-less-header precedent)"
  - "_acfr-work/wy_assemble.py (colon-less 'Taxes'/'Current'/'Debt Service' header-merge fix, VT precedent generalized)"
  - "ALL 50 US STATES now on State-ACFR GAAP — v2.15 milestone's core load target achieved"
affects: [123-nasbo-retirement, 124-verification-cohort-audit-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "wy_assemble.py one-off post-process pass to strip colon-less subsection-header label merges (VT precedent, 3rd instance in cohort)"
    - "Live FY-URL discovery via direct fetch of the publications landing page when the recon's SOURCES map has a gap (FY2020)"

key-files:
  created:
    - scripts/processWYAcfr.js
    - scripts/processWYRevenueAcfr.js
    - _acfr-work/wy_assemble.py
    - .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-06-WY-LOADLOG.md
  modified:
    - _acfr-work/gen_state.py (CONFIGS['WY'] added; gitignored, not tracked in git)

key-decisions:
  - "WY window = FY2005-FY2025 (21 years), zero honest holes -- FY1980-FY2004 excluded per recon (FY2002 poor-OCR spot-check)"
  - "FY2020 URL not in the 117 recon's SOURCES map -- discovered live off sao.wyo.gov/publications/ (FY-20-CAFR-2.26.21.pdf), resolved without an honest hole"
  - "Colon-less 'Taxes'/'Current'/'Debt Service' subsection headers (WY-specific instance of the VT precedent) fixed via a dedicated wy_assemble.py post-process pass -- labels only, values/ties unaffected"
  - "~2.43x NASBO divergence accepted and relabelled honestly -- unusual DUAL driver (Investment Income $1.41B, the single largest GF revenue line, PLUS Federal $1.11B), distinct from every other Batch-4 state's single-driver mechanism"
  - "Per-year P2 clamp monitoring applied at every one of the 21 loaded years (not just bookends) per the recon's explicit caution -- 7 years hit the Fair-Market-Value-of-Investments clamp, 3 hit Sale of Assets"

patterns-established:
  - "State node disambiguation assertion pattern (EXPECTED_MUNI_ID hard-check before any write) proven against a genuine 3-way name collision (state + 2 unrelated city nodes) for the first time in this milestone"

requirements-completed: [ACFR-53]

# Metrics
duration: 55min
completed: 2026-07-05
---

# Phase 121 Plan 06: Wyoming ACFR Upgrade (ACFR-53, the FINAL state) Summary

**Wyoming STATE node (4009951b) upgraded from NASBO-only to full State-ACFR GAAP across FY2005-2025 (21 years, zero honest holes), whole-dollar (UNITS=1), NASBO replaced in place — completing all 50 US states on ACFR.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (all auto)
- **Files modified:** 4 (2 loaders created, 1 assembly script created, 1 loadlog created; gen_state.py updated but gitignored)

## Accomplishments

- Downloaded and validated all 21 WY ACFR PDFs (FY2005–FY2025), zero soft-404s, all `%PDF` magic + size-guard clean
- Extracted the GENERAL FUND column via `pdftotext -table` + `extract_gf.py`; all 21 years tied to $0 diff on both revenue and expenditure printed totals on the first extraction pass (after a one-off colon-less-header label fix, values untouched)
- Discovered the FY2020 URL live (a gap in the 117 recon's own SOURCES enumeration) without introducing an honest hole
- Generated both loaders via `gen_state.py` with `CONFIGS['WY']` (UNITS=1, node `4009951b`, multi-era SOURCES map)
- Live-loaded both loaders across all 21 years: NASBO FY2023/FY2024 replaced in place (one operating row per (muni,fy), zero NASBO label remains); 21 net-new revenue rows landed (Money In auto-enable)
- Confirmed the two unrelated "Wyoming" city nodes (MN, OH) are byte-for-byte unchanged before/after the full load
- Per-year P2 clamp monitoring applied at every year (not just bookends) — 10 negative-line years found and clamped correctly, signed magnitude preserved in category labels
- Idempotency re-run (FY2025 op+rev, live): 0 net change, 0 data_sources residue (LOAD-01 holds)
- Cohort-untouched confirmed: Vermont's existing ACFR node unchanged; the only 2 DB-wide remaining NASBO-labelled rows (Kentucky FY2023, Nevada FY2024) are pre-existing documented exceptions, unrelated to this plan
- **All 50 US states now carry a State-ACFR-sourced General Fund** — the v2.15 milestone's core load target is achieved with this plan's completion

## Task Commits

1. **Task 1: Generate both WY loaders + download/extract/dry-run tie** - `14e1f6d` (feat)
2. **Task 2: Live-load WY STATE node (NASBO replaced in place)** - no separate commit (no file changes; live DB write only — documented in the LOADLOG commit below per plan precedent)
3. **Task 3: Idempotency + 0-residue + cohort-untouched verification + LOADLOG** - `9c7b3b3` (docs)

**Plan metadata:** (this commit, following SUMMARY write)

## Files Created/Modified

- `scripts/processWYAcfr.js` — WY GF spending-by-function loader (operating), UNITS=1, node 4009951b
- `scripts/processWYRevenueAcfr.js` — WY GF revenue-by-source loader (revenue), UNITS=1, node 4009951b
- `_acfr-work/wy_assemble.py` — colon-less header-merge post-process fix (gitignored working file, not tracked)
- `_acfr-work/gen_state.py` — `CONFIGS['WY']` added (gitignored, not tracked in git; the same pattern used for every prior state in this tranche)
- `.planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-06-WY-LOADLOG.md` — full load disposition, node-disambiguation confirmation, P2 clamp results, idempotency + cohort verification, the all-50-states milestone note

## Decisions Made

See `key-decisions` in frontmatter above. Most significant: the ~2.43x NASBO divergence has an **unusual dual driver** (Investment Income as the single largest GF revenue line, PLUS a large Federal line) — distinct from every other Batch-4 state's single-mechanism divergence (federal-passthrough alone, or tax-consolidation alone). Recorded prominently in the loader's `head_note` and the LOADLOG.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FY2020 URL not in the recon's SOURCES map**
- **Found during:** Task 1 (download phase)
- **Issue:** The 117 recon's WY Detail Block SOURCES enumeration jumps from FY2019 (`CAFR_2019.pdf`) directly to FY2021 (`ACFR-FY2021-5.31.22.pdf`), omitting FY2020 entirely — a gap in the recon's own documentation, not a load-time failure.
- **Fix:** Fetched the live `sao.wyo.gov/publications/` landing page, found FY2020 at `https://sao.wyo.gov/wp-content/uploads/2021/03/FY-20-CAFR-2.26.21.pdf`, downloaded (HTTP 200, valid PDF), extracted, tied exactly ($0 diff both sides).
- **Files modified:** `_acfr-work/gen_state.py` (CONFIGS['WY'].sources[2020])
- **Verification:** FY2020 tie confirmed via extract_gf.py JSON output before adding to the config; re-confirmed in the final dry-run and live load.
- **Committed in:** `14e1f6d` (Task 1 commit)

**2. [Rule 1 - Bug] Colon-less "Taxes"/"Current"/"Debt Service" subsection headers merging into adjacent item labels**
- **Found during:** Task 1 (extraction phase)
- **Issue:** WY's printed statement prints these three subsection headers with NO trailing colon (confirmed on all 21 years' raw text) — `extract_gf.py`'s colon-based sub-heading detector only recognizes `:`-terminated headers, so each header merged into the immediately-following item's label via the generic wrapped-label pending accumulator (e.g. "Taxes" + "Sales and Use Taxes" → "Taxes Sales and Use Taxes"), same defect class as the VT precedent (121-04).
- **Fix:** Wrote `_acfr-work/wy_assemble.py`, a dedicated one-off post-process pass that strips the three known header-prefix strings back off the merged labels and sets/propagates `sub='Debt Service'` where needed so `gen_state.py`'s `default_exp_name()` disambiguation renames "Principal Retirement"/"Interest" to "Debt service — ..." consistently with FY2005–FY2014's own colon-terminated-heading years.
- **Files modified:** `_acfr-work/wy_assemble.py` (new, gitignored working file), `_acfr-work/wy/wy_all.json` (gitignored data file)
- **Verification:** All 21 years' revenue and expenditure sum-vs-total ties re-verified identical before and after the label fix (values untouched, labels only).
- **Committed in:** `14e1f6d` (Task 1 commit — the fix is baked into the generated loader's embedded data, not a separate commit)

---

**Total deviations:** 2 auto-fixed (1 blocking URL-discovery gap, 1 bug — colon-less header merge)
**Impact on plan:** Both fixes necessary to complete the tied window and produce correctly-labelled categories. No scope creep — both are within the plan's own documented "watch for" flags (multiple naming eras; VT split_row precedent explicitly anticipated as reusable).

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 123 (NASBO Retirement):** WY contributes zero entries to the "stay-NASBO" exception list (per the 117 recon's Section 8) — ready for `loadStateGF.mjs` demotion/guard work.
- **Phase 124 (Verification + Cohort Audit + UAT):** WY is ready for independent blind re-derivation and inclusion in the 50-state cohort audit. No known stubs, no deferred items specific to WY.
- **Milestone status:** All 50 US states now carry a State-ACFR-sourced General Fund (revenue-by-source + spending-by-function) — the v2.15 milestone's core load objective (Batches 1–4, Phases 118–121) is complete.

---
*Phase: 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53*
*Completed: 2026-07-05*

## Self-Check: PASSED

- FOUND: scripts/processWYAcfr.js
- FOUND: scripts/processWYRevenueAcfr.js
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-06-WY-LOADLOG.md
- FOUND: .planning/phases/121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53/121-06-SUMMARY.md
- FOUND commit: 14e1f6d (Task 1)
- FOUND commit: 9c7b3b3 (Task 3 / LOADLOG)
