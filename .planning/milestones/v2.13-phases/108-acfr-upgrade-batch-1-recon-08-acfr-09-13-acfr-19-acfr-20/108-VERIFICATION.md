---
phase: 108-acfr-upgrade-batch-1-recon-08-acfr-09-13-acfr-19-acfr-20
verified: 2026-07-02T07:16:55Z
status: passed
score: 4/4 success criteria verified
re_verification: false
note: Retroactive verification — closes the v2.13-MILESTONE-AUDIT gap (phase executed 2026-07-01 with per-plan DB checks, but no phase-level VERIFICATION.md was written at the time). Evidence drawn from plan SUMMARYs/LOADLOGs, Phase 110's independent verification (which post-dates and covers this phase), and a dedicated 7-test live UAT (108-UAT.md, Chris, 7/7 pass, completed 2026-07-02).
---

# Phase 108 Verification — ACFR Upgrade Batch 1 (NJ, MA, NC, GA, MD)

**Phase goal:** The first 5 roster states (NJ, MA, NC, GA, MD) render GF revenue-by-source + GAAP spending-by-function on their state nodes, ACFR-sourced, basis-labelled, NASBO operating replaced idempotently.
**Method:** goal-backward against the 4 ROADMAP success criteria; evidence = plan SUMMARYs + LOADLOGs (execution-time DB assertions), Phase 110 loader-independent re-derivation + 50-node cohort audit (independent of this phase's loaders), and 108-UAT.md live-app testing (Chris, 2026-07-02).

## Success Criterion 1 — Each batch-1 state on ACFR GAAP rev+spend, as deep as cleanly extractable, every FY tying to its GF column total

| State | Window loaded | Yrs | Honest holes | Bookend ties |
|-------|--------------|-----|--------------|--------------|
| NJ | FY2020–FY2025 | 6 | 0 | $60,979,024,211 / $38,768,977,008 — $0/$0 ✅ (dollars unit) |
| MA | FY2003–FY2025 | 19 | FY2001/02/04/05/14/21 | 61,907,573K / FY2003 tie — exact ✅ (post-colon-fix, commit 679f1df) |
| NC | FY2012–FY2025 | 14 | pre-FY2012 | 75,416,082K / 44,930,429K (FY2020) — $0 ✅ (post-colon-fix) |
| GA | FY2021–FY2025 | 5 | 0 | 68,445,055K / 55,378,103K — $0/$0 ✅ |
| MD | FY2022–FY2025 | 4 | 0 | 48,689,018K (−$1) / 50,540,136K (+$2) ✅ (documented GAAP thousands rounding, TOL=5K) |

**48 batch-1 state-FYs (96 rows: operating + revenue)**, every FY gated by the exact GF-column tie. Extraction via hand-transcription (NJ) or the shared parser `maAcfrExtract.mjs` GENERAL-FUND-column path (MA/NC/GA/MD) — GF column only, never a multi-column sum. **Independently confirmed:** Phase 110's `verify-phase110-rederive.mjs` (zero loader/parser imports) blind re-derived every batch-1 state's bookends + FY2025 + 3 random middles (MA FY2016, NC FY2019) at **exact $0 delta**. **PASS**

## Success Criterion 2 — NASBO replaced in place idempotently + never-overwrite; existing ACFR nodes + un-upgraded NASBO states untouched; MA upgraded in place

- Per-state LOADLOG DB checks at execution: 0 NASBO labels remain on any of the 5 nodes; one operating row per (state, FY); 0 dup keys; pre-load NASBO baselines recorded (NJ $48,837M/$52,996M, GA $29,266M/$34,594M, MD $27,972M/$27,397M, etc.).
- **MA in-place (RECON-07):** exactly one Massachusetts node, no duplicate of the v1.8 DLS node — confirmed at load (108-02-MA-LOADLOG) and live in UAT Test 2.
- **GA F-97-01 supersede:** FY2023 operating replaced at the same `(6eb7dd4a, 2023, 'operating')` key with the ACFR actual $59,893,783K; 0 NASBO orphans — re-gated permanently by cohort-audit INV-10 and confirmed live in UAT Test 4.
- **Idempotency (live, this verification):** `processNJAcfr.js --fy 2025` re-run 2026-07-02 → "Loaded 0 rows", DB-asserted NJ FY2025 still exactly 2 budget rows (0 net change). Phase 110 had previously asserted the same ×2.
- **Cohort untouched:** Phase 110 cohort audit — 19 ACFR states / 444 rows clean, 31 NASBO states exactly 2 operating rows each, 0 anomalies. **PASS**

## Success Criterion 3 — Scope divergence relabelled honestly (ACFR-19); negative years render via P2 clamp (ACFR-20)

- Relabels recorded per state against pre-load NASBO baselines: NJ ~1.15×, MA ~1.73×, NC ~2.58×, GA ~1.98×, MD ~1.78× — all rows GAAP-basis-labelled (cohort audit: 0 non-GAAP labels on ACFR states).
- **P2 clamp live:** MD FY2022 "Interest and other investment income" −$275,992K renders 0 with "(net loss — shown at 0)" label, parent total $50,540,136,000 intact — verified at load (108-05), re-derived independently in Phase 110 (clamp-year check, printed root nets the negative), and confirmed live in UAT Test 5. **PASS**

## Success Criterion 4 — Every displayed row basis-labelled + durably sourced; Money In auto-enables

- Cohort audit INV-1: 506/506 state rows carry data_source + source_url + source_date; all batch-1 labels "…State ACFR — General Fund (FY… actual, GAAP basis)".
- Load-time URL corrections honestly recorded where recon patterns 404'd (NC archive enumeration, GA opaque Drupal slugs, MD case change) — all real PDFs confirmed.
- Money In auto-enabled on all 5 nodes; Colorado NASBO control still shows no Money In — UAT Test 6. **PASS**

## Requirements coverage

RECON-08 ✅ (NASBO replace + cohort untouched + live idempotency) · ACFR-09 NJ ✅ · ACFR-10 MA ✅ (in-place) · ACFR-11 NC ✅ · ACFR-12 GA ✅ (F-97-01 supersede) · ACFR-13 MD ✅ · ACFR-19 ✅ (5 relabels) · ACFR-20 ✅ (MD FY2022 clamp live).

## UAT (108-UAT.md)

7/7 passed (Chris, completed 2026-07-02): NJ magnitude/labels, MA single-node + hole honesty, NC window, GA supersede, MD clamp, Money In auto-enable + CO control, live idempotency re-run.

## Non-gating notes

1. **Cosmetic side-finding (out of phase scope):** state-node hero banner uses the Wikipedia article lead image, which for NJ (and likely other states) is the state flag — low-res and underwhelming. Root cause + fix paths documented in 108-UAT.md Gaps (hero_image_url DB override or CITY_WIKI_OVERRIDES entry). Pre-existing frontend behavior; v2.13 was data-only.
2. **WR-05 loader debt confirmed still live:** the 2026-07-02 NJ re-run re-created 1 unreferenced data_sources row (deleted same-session via the guarded delete-if-unreferenced precedent). Tracked in v2.13-MILESTONE-AUDIT tech debt.
3. MA/NC windows are the post-colon-fix values (MA 19 FYs, NC 14 FYs — commit 679f1df), superseding the original 108-02/108-03 SUMMARY counts; encoded in cohort-audit INV-8.

_Verified: 2026-07-02 — retroactive, closing v2.13-MILESTONE-AUDIT gap_
