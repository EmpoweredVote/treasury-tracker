---
phase: 124-verification-cohort-audit-uat-ver-09-ver-10
verified: 2026-07-06T06:47:42Z
status: passed
score: 4/4 must-haves verified (roadmap success criteria); 5/5 artifacts; 5/5 key links
overrides_applied: 0
---

# Phase 124: Verification + Cohort Audit + UAT (VER-09, VER-10) Verification Report

**Phase Goal:** Prove the whole 50-state cohort real, sourced, residue-free, and ACFR-complete — independently re-derive the v2.15 final-tail + deepening upgrades from source (VER-09) and earn Chris's live-app sign-off that they render honestly (VER-10), closing the "all 50 states on ACFR" milestone.

**Verified:** 2026-07-06T06:47:42Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a goal-backward verification, not a re-statement of SUMMARY.md claims. I independently re-ran both verification harnesses live against the production Supabase schema (gitignored `.env` sourced from the main tree) rather than trusting the SUMMARY/REDERIVATION/COHORT-AUDIT files at face value, then cross-checked the UAT checklist's expected values against the independently-verified re-derivation numbers.

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria — the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Loader-independent blind re-derivation of every newly-loaded + newly-deepened state-FY ties at exact $0 | ✓ VERIFIED | Re-ran `node scripts/verify-phase124-rederive.mjs` live (fresh process, not cached SUMMARY narration): **149/151 checks tie at exact $0**; the only 2 non-zero deltas are ID FY2004 revenue (−$22) and operating (+$29), identical to what `124-REDERIVATION.md` reports, and identical disposition (pre-existing 118-05 loadlog-documented whole-dollar/thousands normalization rounding — not a transcription defect, no tolerance band). Script source-inspected: zero `import`/`require` of any `process*Acfr.js`, `extract_gf.py`, `gen_state.py`, `maAcfrExtract.mjs`, or `pre34Extract.mjs` — independence confirmed by direct inspection, not by SUMMARY claim. |
| 2 | 50-state cohort source-chain audit: all rows sourced/windowed/deduplicated/basis-labelled; 0 `data_sources` residue with no manual re-clean (LOAD-01 cohort-wide); all 50 nodes confirmed on ACFR | ✓ VERIFIED | Re-ran `node scripts/verify-phase124-cohort-audit.mjs` live: **14/14 invariants PASS, exit 0** — INV-1 (0 NULL-basis) through INV-12 (GA supersede), plus NASBORT-01 and 50/50-ACFR, all print PASS against the live 1,560-row, 50-state cohort. Matches `124-COHORT-AUDIT.md` exactly. |
| 3 | Chris live-app UAT sign-off across a representative sample of newly-upgraded states + a deepened node | ✓ VERIFIED | `124-UAT-CHECKLIST.md` frontmatter: `status: signed-off`, `signed_off_by: "Chris Cantrell"`, `signed_off_date: "2026-07-05"`. All 12 anchors recorded ✅ PASS with dated notes. The 12-anchor set covers every distinct v2.15 risk class (CA/FL deepening floors, ID mixed-unit, NV dollar-unit, NM/OK/SD hand-transcribed, AR single-fund, NV/KY NASBO fallbacks, ME FY-end, WY regression) — not a token sample. Expected values on each anchor were spot-checked against `124-REDERIVATION.md`'s independently-verified totals (e.g. CA FY2002 rev $63,942,875,000, ID FY2004 rev $2,314,492,000, NM FY2022 rev $26,161,736,000, OK FY2019 rev $19,417,878,000, SD FY2007 rev $917,987,000, AR FY2024 rev $24,045,611,000) — all match exactly, confirming the UAT checklist's expected values are sourced from the independent re-derivation, not the loaders. |
| 4 | No node still shows NASBO where ACFR now exists | ✓ VERIFIED | NASBORT-01 invariant (live re-run): exactly 2 NASBO-labelled rows cohort-wide (NV FY2024 operating, KY FY2023 operating), 0 (state,fy) keys carry both an ACFR and a NASBO operating row. UAT Anchor 12 (WY FY2025, the 50/50-completion node) explicitly asserts 0 occurrences of "NASBO" anywhere on the node — recorded PASS. Anchors 9/10 confirm the 2 fallback rows are honestly disclosed (not disguised as ACFR). |

**Score:** 4/4 roadmap success criteria verified — all independently re-confirmed live, not taken on SUMMARY narration.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/verify-phase124-rederive.mjs` | Loader-independent blind re-derivation harness | ✓ VERIFIED | 678 lines; no loader/parser imports (source-inspected); ran live to completion with `REVIEW` exit code 2 (2 pre-approved explained non-zero deltas — matches its own documented acceptance criteria, not a defect) |
| `.planning/phases/124.../124-REDERIVATION.md` | Per-FY tie log, 151 checks | ✓ VERIFIED | Full disposition table present; live re-run output matches this file's numbers exactly (spot-checked full diff, not sampled) |
| `scripts/verify-phase124-cohort-audit.mjs` | 50-node cohort invariant audit | ✓ VERIFIED | Ran live to completion, exit 0, 14/14 invariants PASS |
| `.planning/phases/124.../124-COHORT-AUDIT.md` | Cohort audit report | ✓ VERIFIED | Per-invariant table, row-count confirmation table, window reconciliation, idempotency + guard-verification sections all present and match the live re-run |
| `.planning/phases/124.../124-UAT-CHECKLIST.md` | 12-anchor UAT script + Chris sign-off | ✓ VERIFIED | `status: signed-off` frontmatter; all 12 anchors have dated ✅ PASS results; final sign-off line present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `verify-phase124-rederive.mjs` | source ACFR/CAFR PDFs | `pdftotext -table` / `pdftoppm`+`tesseract` OCR, own extraction | ✓ WIRED | Live re-run read real cached PDFs from `_acfr-work/` and re-extracted GF totals fresh; OCR path exercised for NM/OK/SD image years (log shows `tesseract --psm 6` invocations) |
| `verify-phase124-rederive.mjs` | `treasury.budgets` | REST read of `total_budget` per (municipality_id, fiscal_year, dataset_type) | ✓ WIRED | Live re-run resolved 23 state municipality IDs at runtime and diffed against real DB rows; deltas printed match `124-REDERIVATION.md` row-for-row |
| `verify-phase124-cohort-audit.mjs` | `treasury.budgets` + `treasury.data_sources` | read-only invariant queries, explicit `.range()` pagination | ✓ WIRED | Live re-run confirmed 1,560-row cohort loads correctly (the pagination fix noted in 124-02-SUMMARY is functioning — no truncation) |
| `124-COHORT-AUDIT.md` NASBORT-01 section | `123-01-SUMMARY.md` guard | confirms only 2 NASBO rows, both without same-year ACFR | ✓ WIRED | Live NASBORT-01 re-run result matches: NV FY2024 op + KY FY2023 op are the only 2, neither has a competing same-year ACFR row |
| `124-UAT-CHECKLIST.md` anchors | `124-REDERIVATION.md` + `124-COHORT-AUDIT.md` | expected values sourced from independent evidence, not loaders | ✓ WIRED | Cross-checked 6 of 12 anchors' expected dollar figures against the REDERIVATION table — all match to the dollar |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense (this phase produces verification scripts + reports, not a rendering component) — but the equivalent check (does the UAT's *expected value* data flow from the independent re-derivation rather than from the loaders) was explicitly traced above and confirmed: `124-UAT-CHECKLIST.md`'s expected figures are the literal numbers from `124-REDERIVATION.md`, not loader-embedded values.

### Behavioral Spot-Checks / Probe Execution

Both verification harnesses in this phase ARE the probes. Both were executed fresh in this verification pass (not accepted from SUMMARY narration):

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `scripts/verify-phase124-rederive.mjs` | `node scripts/verify-phase124-rederive.mjs` | 149/151 exact $0 ties, 2 pre-approved explained deltas (ID FY2004), exit 2 (matches its own documented "REVIEW" contract — not a failure) | PASS (matches claimed result exactly) |
| `scripts/verify-phase124-cohort-audit.mjs` | `node scripts/verify-phase124-cohort-audit.mjs` | 14/14 invariants PASS, exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VER-09 | 124-01, 124-02 | Loader-independent blind re-derivation + 50-state cohort source-chain audit | ✓ SATISFIED | REQUIREMENTS.md marks `[x]`; both harnesses re-run live in this verification and confirmed passing at the same numbers as the evidence files |
| VER-10 | 124-03 | Chris live-app UAT sign-off, no node shows NASBO where ACFR exists | ✓ SATISFIED | REQUIREMENTS.md marks `[x]`; `124-UAT-CHECKLIST.md` carries Chris's dated 12/12 sign-off |

**Note (minor doc inconsistency, non-blocking):** `.planning/REQUIREMENTS.md`'s Traceability table (line 123) still reads `VER-10 | Phase 124 | Pending (Plan 03)`, stale from before the 124-03 completion commit (`76d819c`) — that commit updated the VER-10 checkbox to `[x]` (the authoritative requirement-status line) but missed updating the traceability table row. This does not affect requirement satisfaction (the checkbox and both evidence files are correct and consistent); flagged as an ℹ️ INFO housekeeping item, not a gap.

### Anti-Patterns Found

None. Both scripts (`verify-phase124-rederive.mjs`, `verify-phase124-cohort-audit.mjs`) were scanned for TODO/FIXME/XXX/TBD/placeholder/stub markers — zero matches. No empty implementations, no hardcoded-empty stub patterns applicable (these are verification harnesses, not rendering components).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 123 | Stale traceability row (`Pending (Plan 03)` vs. actual `[x]` complete) | ℹ️ Info | Cosmetic doc drift; requirement itself is correctly marked complete elsewhere in the same file |

### Human Verification Required

None. The phase's own human checkpoint (Task 2 of plan 124-03, `checkpoint:human-verify`, `autonomous: false`) was already executed and resolved within the phase: Chris exercised all 12 live-app anchors and recorded a dated 12/12 PASS sign-off in `124-UAT-CHECKLIST.md`. No further human action is needed for this verification pass.

### Gaps Summary

No gaps found. All 4 roadmap success criteria for Phase 124 are independently re-confirmed against the live production database and live app UAT record, not merely accepted from SUMMARY.md claims:

1. The blind re-derivation harness (zero loader/parser dependency, confirmed by source inspection) was re-run fresh and reproduced the exact 149/151-tie, 2-explained result claimed in `124-REDERIVATION.md`.
2. The 50-node cohort audit (14 invariants incl. NASBORT-01 and 50/50-ACFR) was re-run fresh against the live 1,560-row cohort and reproduced the 14/14 PASS result claimed in `124-COHORT-AUDIT.md`.
3. Chris's UAT sign-off is recorded, dated, and covers all 12 risk-class anchors with expected values traced back to the independent re-derivation (not the loaders).
4. The NASBO-retirement regression guard (no node shows NASBO where ACFR now exists) is proven both DB-side (NASBORT-01) and UI-side (UAT Anchor 12, WY FY2025).

The only finding is a single cosmetic, non-blocking documentation drift in REQUIREMENTS.md's traceability table (noted above) — it does not affect the correctness of the verification evidence or the phase's goal achievement.

---

_Verified: 2026-07-06T06:47:42Z_
_Verifier: Claude (gsd-verifier)_
