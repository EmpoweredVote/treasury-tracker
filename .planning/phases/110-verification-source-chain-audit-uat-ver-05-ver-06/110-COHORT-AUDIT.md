# 110-COHORT-AUDIT — 50-Node State Cohort Source-Chain Audit (VER-05 b+c)

**Executed:** 2026-07-01 · **Script:** `scripts/verify-phase110-cohort-audit.mjs` (read-only, exit 0/2) · **Spend:** $0

## Headline verdict

**10/10 invariants PASS** (7 Phase-102/106 invariants + 3 tranche-2 extensions). The full 50-node
state cohort source-chain is **clean**: 0 NULL-basis, 0 residue (after the anticipated WR-05
cleanup, below), 0 out-of-window, 0 dup, 0 orphan; all 444 rows on the 19 ACFR states carry
ACFR-GAAP provenance with 0 NASBO labels remaining; all 31 un-upgraded NASBO states untouched
(exactly 2 NASBO operating rows each). Idempotency re-runs: 0 net change (NJ + MI FY2025).
Hole verdict: 0 unrecorded DB gaps. **Script exit code: 0.**

## Per-invariant results

| Invariant | Name | Result | Detail |
|-----------|------|--------|--------|
| INV-1 | NULL-basis | **PASS** | 0 of 506 state budget rows missing data_source/source_url/source_date |
| INV-2 | residue/fragile | **PASS** | 0 state `*-gf-*` data_sources with 0 referencing live rows (20 WR-05 artifacts deleted in-phase, below) |
| INV-3 | out-of-window | **PASS** | 0 FYs outside per-state bounds (19 ACFR windows + NASBO 2023–2024) |
| INV-4 | dup | **PASS** | 0 duplicate (municipality_id, fiscal_year, dataset_type) combos |
| INV-5 | orphan | **PASS** | 0 rows carry data_source_id (all text-stamp provenance; no FK orphan possible) |
| INV-6 | ACFR-GAAP-on-19 | **PASS** | All 444 op+rev rows on CA/TX/NY/FL/MN/OH/VA/PA/IL + NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI carry ACFR labels; 0 NASBO labels |
| INV-7 | NASBO-untouched-on-31 | **PASS** | All 62 rows on the 31 NASBO states: NASBO provenance, operating-only, exactly 2 rows each (CO control confirmed) |
| INV-8 | window-integrity (NEW) | **PASS** | All 10 tranche-2 states match their recorded loaded-FY sets EXACTLY, op & rev identical (holes absent by design) |
| INV-9 | MI Sep-30 (NEW) | **PASS** | All 14 MI rows: source_date = {FY}-09-30, fiscal_year_start_month = 10 |
| INV-10 | GA F-97-01 supersede (NEW) | **PASS** | GA FY2023 operating = $59,893,783,000 (ACFR) at the original key; 0 NASBO rows on GA |

## Row-count confirmations (tranche-2: 250 rows = 125 op + 125 rev)

| State | Rows | FY window | FYs | Note |
|-------|------|-----------|-----|------|
| NJ | 12 (6+6) | FY2020–2025 | 6 | dollars-unit state |
| MA | 38 (19+19) | FY2003–2025 | 19 | post-colon-fix (was 17); holes 2001/02/04/05/14/21 |
| NC | 28 (14+14) | FY2012–2025 | 14 | post-colon-fix (was 12); 0 holes |
| GA | 10 (5+5) | FY2021–2025 | 5 | F-97-01 superseded cleanly |
| MD | 8 (4+4) | FY2022–2025 | 4 | FY2022 clamp year |
| TN | 34 (17+17) | FY2009–2025 | 17 | 0 holes |
| CT | 46 (23+23) | FY2002–2025 | 23 | hole FY2006 (scanned PDF) |
| WI | 48 (24+24) | FY2002–2025 | 24 | contiguous; 3 clamp years |
| WA | 12 (6+6) | FY2020–2025 | 6 | 2 clamp years |
| MI | 14 (7+7) | FY2019–2025 | 7 | Sep-30 FY-end |

Pre-tranche states unchanged: CA 36, NY 44, MN 36, TX 20, PA 20, OH 12, IL 10, FL 8, VA 8.
Cohort: **19 ACFR states (444 rows) + 31 NASBO states (62 rows) = 506 state rows, 0 anomalies.**

## Idempotency result (one representative loader per batch)

- **NJ FY2025** (Batch-1): `processNJAcfr.js --fy 2025` + `processNJRevenueAcfr.js --fy 2025` →
  both report **"Loaded 0 rows"**, source re-stamped, NJ still 12 rows.
- **MI FY2025** (Batch-2): `processMIAcfr.js --fy 2025` + `processMIRevenueAcfr.js --fy 2025` →
  RPC update-in-place path ("Loaded 1" reporting), DB-verified **0 net change**: MI still 14 rows,
  0 dups, FY2025 totals unchanged ($55,592,047,000 op / $53,788,610,000 rev).

## WR-05 residue re-check + in-phase fix (the anticipated v2.12 lesson)

**Found:** the first audit run failed INV-2 with exactly **20** stale `data_sources` rows —
`{nj,ma,nc,ga,md,tn,ct,wi,wa,mi}-acfr-gf-{operating,revenue}` — each backing 0 live budgets rows.
This is the known WR-05 check-then-insert pattern (Phase 105 code review; Phase 106 hit the
identical 10-row set for CA/FL/IL/NY/PA and deleted them in-phase per D-05): the loaders create a
data_sources metadata entry on each run while budget rows carry text-stamp provenance
(`data_source_id = null`), leaving the entries permanently unreferenced.

**Fix (after the idempotency re-runs, so re-created entries were also caught):** deleted all 20
unreferenced `*-acfr-gf-*` rows in one guarded pass (delete scoped to
`NOT EXISTS (referencing budgets row)` — cannot touch a referenced source). The NJ/MI re-runs had
updated the same dataset_id rows in place (residue count stayed 20, not 24), so one deletion round
sufficed. Re-run audit: **INV-2 PASS, 10/10 clean, exit 0.** Display provenance is unaffected —
the source chip reads the text-stamped budgets columns (INV-1 all-506 PASS).

**Standing note for future loads:** any `process*Acfr.js` run re-creates its 2 residue rows; the
next audit run's INV-2 will flag them. The durable fix (make the loaders' data_sources upsert
atomic or stop writing the vestigial entry) remains logged as WR-05 code-review debt — cosmetic,
not gating (same disposition as v2.12).

## Hole-verdict reconciliation (0 unrecorded gaps)

INV-8 compares each tranche-2 state's actual DB FY set against the loadlog-recorded set —
**exact match for all 10 states on both datasets.** Every absent FY maps to a recorded disposition:

| Absent FYs | Disposition (recorded) |
|------------|------------------------|
| MA FY2001/2002/2004/2005 | older combined-format statements — generic parser can't isolate GF; deferred (108-02) |
| MA FY2014, FY2021 | `-table` anchor quirks on those editions — interior holes, recoverable follow-up (108-02) |
| CT FY2006 | scanned PDF, no text layer — OCR-only, deferred (109-02) |
| CT ≤FY2001, WI ≤FY2001 | pre-GASB-34 Combined-Statement format — honestly not force-parsed (109-02/03 D-01 self-limit) |
| TN ≤FY2008 | outside the recon-attempted window (109-01) |
| MI ≤FY2018 | not listed in the state archive (109-05) |
| WA ≤FY2019 | deferred per recon gap log (109-04) |
| NJ ≤FY2019 | deeper ACFRs exist under varying filename patterns — future deepening pass (108-01) |
| GA ≤FY2020, MD ≤FY2021 | recon-locked clean windows (108-04/05) |

Live rendering is honest by construction: per-FY rows only (no interpolation), each row
basis-labelled + source-chipped, so a missing FY simply doesn't appear in the year selector
(MA hole honesty is UAT anchor #2 in Plan 03). These holes are **PASS-honest**, not defects —
not re-litigated per plan.
