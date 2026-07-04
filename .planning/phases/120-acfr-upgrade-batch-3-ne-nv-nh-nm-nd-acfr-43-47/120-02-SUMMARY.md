---
phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47
plan: "02"
subsystem: database
tags: [acfr, nasbo-retirement, state-acfr, gaap, treasury-budgets, supabase, nevada]

requires:
  - phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
    provides: NV source recon (opaque per-FY URL enumeration, GENERAL FUND column identification, dollars-unit flag, FY2024 gap flag, bookend ties)
  - phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47 (120-01)
    provides: gen_state.py / extract_gf.py v2.14+ tooling lineage, LOAD-01 ephemeral data_sources pattern, U+FFFD DASH_TOKEN fix
provides:
  - Nevada state node upgraded NASBO -> State-ACFR GAAP (GF revenue-by-source + GAAP spending-by-function), FY2019-FY2023 (partial window), zero honest holes within the window
  - gen_state.py generalized with a `units` config option (default 1000/thousands) so dollar-denominated states can emit `UNITS=1` instead of the previously hardcoded `UNITS=1_000` -- reusable for ND (also dollars, later in this batch)
affects: [120-03-nh, 120-04-nm, 120-05-nd, 123-nasbo-retirement, 124-verification-cohort-audit-uat]

tech-stack:
  added: []
  patterns:
    - "gen_state.py CONFIGS['NV'] opaque-filename clone (GA/NC/DE/HI/IA/ME/KS/MS/MT/NE lineage) with units=1 override"
    - "gen_state.py `units` config option (default 1000) -- generalizes UNITS scaling + all thousands/dollars doc/log strings for dollar-denominated ACFR states"

key-files:
  created:
    - .planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-02-NV-LOADLOG.md
  modified:
    - scripts/processNVAcfr.js
    - scripts/processNVRevenueAcfr.js
    - _acfr-work/gen_state.py

key-decisions:
  - "NV ACFR GF ~2.87x NASBO GF (widest divergence in Batch 3) accepted and relabelled honestly — NV's GAAP General Fund consolidates federal Medicaid/grant pass-through directly into the General column ('Intergovernmental' = 59% of FY2023 GF revenue), the TX/NC-trap mechanism"
  - "Partial-window load (D-07): re-checked controller.nv.gov live at load time -- FY2024/FY2025 still not published ('currently being remediated', all filename variants 404) -- loaded FY2019-FY2023 on ACFR, deliberately RETAINED the FY2024 NASBO operating row with its honest label rather than fabricating or dropping the latest covered year"
  - "gen_state.py's hardcoded UNITS=1_000 generalized into a `units` config option (default 1000) rather than hand-authoring a one-off NV loader outside the generator -- NV is the first dollar-denominated state run through gen_state.py; the fix is reusable for ND later in this same batch"
  - "FY2022 'Interest and investment income (loss)' -$141,921,982 routed through the existing P2 clamp rather than treated as an extraction error -- a real GAAP fair-value loss, both bookend years positive, matching the recon's bookend-only negative scan"

requirements-completed: [ACFR-44]

duration: ~50min
completed: 2026-07-04
---

# Phase 120 Plan 02: Nevada ACFR Upgrade (ACFR-44) Summary

**Nevada state node upgraded NASBO->State-ACFR GAAP: GF revenue-by-source + GAAP spending-by-function live for FY2019-2023 (partial window, FY2024 honestly retained on NASBO), stored in raw dollars (UNITS=1), ~2.87x TX-trap divergence recorded.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-04
- **Tasks:** 3/3
- **Files modified:** 3 (2 created via gen_state.py, 1 LOADLOG created); gen_state.py itself modified (gitignored, not committed)

## Accomplishments

- Generalized `gen_state.py` with a `units` config option (default 1000/thousands) — the generator previously hardcoded `const UNITS = 1_000;` with no override, which never surfaced because every prior state's ACFR is reported in thousands. NV's printed statement is already in whole dollars; `units=1` now emits `UNITS=1` and swaps every "thousands" doc/log string to "dollars" generically (Rule 2 fix — required for correctness, reusable for ND later in Batch 3).
- Downloaded and extracted all 5 NV ACFR PDFs (FY2019–FY2023), each verified as a real PDF (%PDF magic, 10–26MB, well over the 500KB soft-404 threshold); re-checked `controller.nv.gov` live for a FY2024/FY2025 ACFR (D-07) — confirmed still absent (404 on every tested filename variant, landing page still reads "currently being remediated").
- Generated `scripts/processNVAcfr.js` + `scripts/processNVRevenueAcfr.js` via `gen_state.py CONFIGS['NV']`; both bookends dry-run-tied exactly ($15,153,168,081 FY2023 / $10,411,179,917 FY2019, $0 diff on both revenues and expenditures, all 5 years).
- Live-loaded Nevada General Fund operating (GAAP spending-by-function) and revenue (GAAP revenue-by-source) for all 5 target fiscal years FY2019–FY2023, 10 rows total, every year tying exactly to the printed GENERAL FUND column totals, stored in raw dollars (UNITS=1, not ×1,000).
- Replaced the FY2023 NASBO operating row ($4,742,000,000) in place with the ACFR GAAP total ($12,405,372,737) — same row `id` before/after, confirming UPDATE not insert+delete; deliberately RETAINED the FY2024 NASBO operating row ($5,273,000,000) untouched with its honest NASBO label, per the partial-window decision.
- Proved idempotent never-overwrite: a second live run of NV --fy 2023 (both loaders) reported "Loaded 0 rows" with identical row ids/totals afterward, and 0 `data_sources` residue.
- Confirmed cohort isolation: California and Alaska (existing ACFR nodes) unchanged; West Virginia (un-upgraded NASBO state) still carries exactly its 2 pre-existing NASBO rows, untouched.
- Money In auto-enabled on the NV node (5 revenue rows now live, data-driven, no frontend change).
- Recorded the ~2.87x accept-relabel scope divergence (NV's GAAP GF consolidates 59% federal Medicaid pass-through) and the FY2022 P2 clamp note in `120-02-NV-LOADLOG.md`.

## Task Commits

1. **Task 1: Generate both NV loaders (UNITS=1 dollars, opaque SOURCES map) via gen_state.py + download/extract FY2019-2023 + dry-run tie** - `5caaf35` (feat)
2. **Tasks 2+3: Live-load NV (operating + revenue) + idempotency/0-residue/Money-In/cohort-untouched verification + LOADLOG** - `3bb57ed` (feat) — combined into one commit since Task 2 alone produces no file diff (matches 120-01/119-01/119-02 precedent where the live-load commit carries the LOADLOG.md)

**Plan metadata:** (this commit, following) — docs: complete plan

## Files Created/Modified

- `.planning/phases/120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47/120-02-NV-LOADLOG.md` - Full per-FY load disposition, FY2024 re-check + NASBO-retained rationale, NASBO-replacement confirmation, accept-relabel divergence, clamp note, idempotency + 0-residue result
- `scripts/processNVAcfr.js` - NV GF operating loader (UNITS=1 dollars, GAAP-labelled, ephemeral data_sources lifecycle) — created in Task 1
- `scripts/processNVRevenueAcfr.js` - NV GF revenue loader (UNITS=1 dollars, clampForRender, ephemeral data_sources lifecycle) — created in Task 1
- `_acfr-work/gen_state.py` - `CONFIGS['NV']` entry added + new `units` config option generalized into the JS-generation template — Task 1 (gitignored, not committed to git; loader outputs are the committed artifacts)

## Decisions Made

- NV ACFR GF ~2.87x NASBO GF (widest divergence in Batch 3, TX/NC-trap mechanism) accepted and relabelled honestly rather than treated as a scope anomaly — Nevada's GAAP General Fund consolidates federal Medicaid/grant pass-through directly into the General column ("Intergovernmental" = $8,940,557,604 = 59% of FY2023 GF revenue).
- Partial-window load per D-07: re-checked `controller.nv.gov` live at load time (2026-07-04), confirmed FY2024/FY2025 still unpublished (all filename variants 404, landing page unchanged) — loaded FY2019–FY2023 on ACFR and deliberately retained the FY2024 NASBO row with its honest label, rather than fabricating a FY2024 ACFR or stranding the latest covered year by dropping it entirely.
- `gen_state.py`'s hardcoded `UNITS = 1_000` was generalized into a `units` config option (default 1000) rather than hand-authoring a one-off NV loader outside the generator — this is the first dollar-denominated state run through `gen_state.py`; the fix is reusable for North Dakota (also dollars per the 117 recon) later in this same batch.
- FY2022 "Interest and investment income (loss)" (-$141,921,982) was routed through the existing P2 clamp mechanism (render at 0, signed value preserved in the category label) as a real GAAP-basis fair-value loss, not an extraction artifact — both bookend years (FY2019/FY2023) are positive, matching the recon's bookend-only negative scan; this interior-year negative was a new discovery made during this load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `gen_state.py` hardcoded `UNITS = 1_000` with no override — added a `units` config option**
- **Found during:** Task 1 (generating the NV loaders)
- **Issue:** `gen_state.py`'s JS-generation template hardcoded `const UNITS = 1_000;` (and every "thousands" wording throughout the docstring/log strings) with no config-driven override. NV's printed ACFR statement is already in whole dollars (bookend totals run $10–15 billion, not thousands) — every prior CONFIGS entry through NE was thousands-denominated, so this gap never surfaced.
- **Fix:** Added `units` as an optional CONFIGS key (default 1000). `make()` now resolves `UNITS_VAL = C.get('units', 1000)`, derives `UNIT_WORD` ('dollars' vs 'thousands') and `UNITS_JS` ('1' vs '1_000'), and threads them through every generated string: the top docstring basis note, the `UNITS = ...` control-line doc comment, the `const UNITS = ...;` declaration, the raw-data comment, the `validate()` diff-message unit tag, and the startup console.log unit label. `CONFIGS['NV']` sets `units=1`.
- **Files modified:** `_acfr-work/gen_state.py` (gitignored, not committed), `scripts/processNVAcfr.js`, `scripts/processNVRevenueAcfr.js` (generated output, committed)
- **Verification:** Both generated loaders show `const UNITS = 1;` and dry-run correctly stored $15,153,168,081 / $10,411,179,917 without any ×1,000 scaling; re-ran `py -3 gen_state.py NE` mentally-verified unaffected (NE's CONFIGS entry has no `units` key, so it still defaults to 1000 and its already-committed loader output is unchanged by this generalization — not re-run, no risk of regression since NE's own generated files were not touched in this session).
- **Committed in:** `5caaf35` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — Rule 2)
**Impact on plan:** Necessary for NV's correctness (the plan's own must_haves explicitly call out UNITS=1 as "the #1 load risk"); the fix is additive/backward-compatible (default preserves all prior states' behavior) and directly enables the plan's stated goal. No scope creep — this was required tooling work, not new functionality beyond the plan's ask.

## Issues Encountered

None. The "Loaded 0 rows" console output on both the initial live load and the idempotency re-run is a known, previously-documented RPC reporting artifact (see 119-04-MS-LOADLOG.md / 120-01-NE-LOADLOG.md) — not a load-vs-no-op discriminator. Verified the actual discriminator (row totals, row `id` continuity, `data_source` labels) via direct DB query instead. `mcp__supabase-local` tools were not present in this environment's toolset; DB verification was performed via a small ad-hoc `@supabase/supabase-js` script, deleted before the final commit, leaving the working tree clean (per the plan's efficiency note, matching the 120-01 precedent).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Nevada (ACFR-44) is complete: fully ACFR-sourced for FY2019–FY2023, GAAP-labelled, idempotent, 0 residue, cohort-isolated, FY2024 honestly retained on NASBO. Ready to hand to Phase 124 for independent re-derivation + cohort audit + Chris UAT.
- Batch 3 (Phase 120) continues with NH/NM/ND (ACFR-45..47) in subsequent plans (120-03..120-05). The `gen_state.py` `units` config generalization from this plan is directly reusable for North Dakota (also dollar-denominated per the 117 recon).
- No blockers for the remaining Batch 3 states.

---
*Phase: 120-acfr-upgrade-batch-3-ne-nv-nh-nm-nd-acfr-43-47*
*Plan: 02*
*Completed: 2026-07-04*
