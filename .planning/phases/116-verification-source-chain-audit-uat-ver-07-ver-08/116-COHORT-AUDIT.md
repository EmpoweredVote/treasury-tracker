# Phase 116-02 — 50-Node Cohort Source-Chain Audit (VER-07 parts b+c, VER-08)

**Script:** `scripts/verify-phase116-cohort-audit.mjs` (read-only, exit 0/2, $0 spend)
**Run date:** 2026-07-03
**Cohort:** 29 ACFR states + 21 NASBO states = 50 state nodes, 901 live `treasury.budgets` rows
**Verdict: PASS — 12/12 invariants, exit 0.** Re-confirmed exit 0 after the LOAD-01 idempotency
re-run (Task 2) with 0 change to any invariant result.

---

## Per-invariant results

| Invariant | Description | Result | Evidence |
|-----------|-------------|--------|----------|
| INV-1 | Every state row has `data_source` + `source_url` + `source_date` | ✅ PASS | 0/901 rows missing any basis field |
| INV-2 | 0 residue stale `*-gf-*` `data_sources` rows (WR-05-class) | ✅ PASS | 0 checked (fleet has moved off the legacy `-gf-` dataset_id naming); re-confirmed 0 after the LOAD-01 re-run in Task 2 |
| INV-3 | 0 rows outside their per-state window bounds (29 ACFR windows + NASBO 2023-2024) | ✅ PASS | 0/901 out-of-window, using the widened/added WINDOW_BOUNDS below |
| INV-4 | 0 duplicate `(municipality_id, fiscal_year, dataset_type)` combos | ✅ PASS | 0 dups across 901 rows |
| INV-5 | 0 orphan `data_source_id` references | ✅ PASS | 0 rows carry `data_source_id` (text-stamp only architecture; no FK orphan possible) |
| INV-6 | All 29 ACFR states' rows ACFR/CAFR-provenance-labelled, 0 unexplained NASBO labels | ✅ PASS | 858/858 checkable rows carry ACFR or (era-correct) CAFR provenance; the 1 documented exception (KY FY2023 operating, honest broken-font hole) correctly retains its NASBO label and is excluded from the "bad" count by design, not silently passed |
| INV-7 | A NASBO control state (from the 21 remaining, none of the 29 ACFR states) untouched | ✅ PASS | Dynamic control = AK (alphabetically first of the 21): 2 rows, NASBO-labelled, operating-only. All 21 NASBO states: exactly 2 operating rows each, 42 rows total, 0 non-NASBO labels, 0 non-operating rows |
| INV-8 (NEW) | Pre-GASB-34 basis-label distinctness: CT FY1988-2001, WI FY2000-2001, MA FY2001 carry `"pre-GASB-34 combined statement basis"`, visibly distinct from `"GAAP basis"` on the same node's modern years; CT FY2006 (OCR-recovered but GASB-34-era) = GAAP, not pre-34 | ✅ PASS | CT: 14 pre-34 years × 2 datasets = 28 rows all pre-34-labelled; CT FY2006 = 2 rows both GAAP-labelled (not pre-34); WI: 2 pre-34 years × 2 = 4 rows pre-34-labelled; MA: 1 pre-34 year × 2 = 2 rows pre-34-labelled; 0 modern-year rows on any of the three nodes incorrectly carry the pre-34 label |
| INV-9 (NEW) | AL Sep-30 FY-end: `source_date = {fy}-09-30`, `fiscal_year_start_month = 10` | ✅ PASS | All 48 AL rows (24 op + 24 rev) comply |
| INV-10 | MI Sep-30 FY-end (carried from Phase 109/110, unchanged) | ✅ PASS | All 14 MI rows comply |
| INV-11 (NEW, generalizes Phase 110's INV-8) | Window-integrity: exact loaded-FY set (op/rev tracked separately) for the 14 touched states (10 tranche-3 + 4 deepened) matches the recorded LOADLOG disposition | ✅ PASS | All 14 states' operating AND revenue FY sets match exactly — including KY's op/rev divergence at FY2023 (op present as the documented NASBO exception, rev correctly absent) and MA's 4 documented holes |
| INV-12 | GA F-97-01 supersede (carried from Phase 110, unchanged) | ✅ PASS | GA FY2023 operating = $59,893,783,000 (ACFR GAAP) at the original key; 0 NASBO rows remain on the GA node |

**12/12 PASS. Script exits 0.**

---

## Window bounds applied (WINDOW_BOUNDS)

| Category | States | Bounds |
|----------|--------|--------|
| Unchanged (15) | CA 2008-2025 · TX 2015-2024 · NY 2003-2024 · FL 2021-2024 · MN 2008-2025 · OH 2020-2025 · VA 2022-2025 · PA 2016-2025 · IL 2021-2025 · NC 2012-2025 · GA 2021-2025 · MD 2022-2025 · TN 2009-2025 · WA 2020-2025 · MI 2019-2025 | (unchanged from Phase 110) |
| Widened deepening (4) | NJ 2002-2025 (was 2020-2025) · CT 1988-2025 (was 2002-2025) · WI 2000-2025 (was 2002-2025) · MA 2001-2025 (was 2003-2025) | |
| New tranche-3 (10) | IN 2002-2025 · AZ 2002-2024 · OR 2022-2025 · MO 2012-2025 · CO 2023-2025 · SC 2002-2025 · KY 2002-2025 · UT 2019-2025 · AL 2002-2025 · LA 2002-2025 | |
| NASBO default | all 21 remaining states | 2023-2024 |

---

## Row-count table (29 ACFR + 21 NASBO, confirmed against live DB)

### ACFR states (29) — operating + revenue

| State | Rows | Op | Rev | FY range | FYs | Tag |
|-------|------|----|----|----------|-----|-----|
| CA | 36 | 18 | 18 | FY2008-FY2025 | 18 | v2.11 |
| TX | 20 | 10 | 10 | FY2015-FY2024 | 10 | v2.11 |
| NY | 44 | 22 | 22 | FY2003-FY2024 | 22 | v2.11 |
| FL | 8 | 4 | 4 | FY2021-FY2024 | 4 | v2.11 |
| MN | 36 | 18 | 18 | FY2008-FY2025 | 18 | v2.11 |
| OH | 12 | 6 | 6 | FY2020-FY2025 | 6 | v2.11 |
| VA | 8 | 4 | 4 | FY2022-FY2025 | 4 | v2.11 |
| PA | 20 | 10 | 10 | FY2016-FY2025 | 10 | v2.11 |
| IL | 10 | 5 | 5 | FY2021-FY2025 | 5 | v2.11 |
| NJ | 48 | 24 | 24 | FY2002-FY2025 | 24 | **DEEPENED** (was 12/6+6) |
| MA | 42 | 21 | 21 | FY2001-FY2025 | 21 | **DEEPENED** (was 38/19+19; holes 2002/04/05/2021) |
| NC | 28 | 14 | 14 | FY2012-FY2025 | 14 | v2.13 |
| GA | 10 | 5 | 5 | FY2021-FY2025 | 5 | v2.13 |
| MD | 8 | 4 | 4 | FY2022-FY2025 | 4 | v2.13 |
| TN | 34 | 17 | 17 | FY2009-FY2025 | 17 | v2.13 |
| CT | 76 | 38 | 38 | FY1988-FY2025 | 38 | **DEEPENED** (was 46/23+23; hole 2006 now filled, pre-34 back to 1988) |
| WI | 52 | 26 | 26 | FY2000-FY2025 | 26 | **DEEPENED** (was 48/24+24; pre-34 back to 2000) |
| WA | 12 | 6 | 6 | FY2020-FY2025 | 6 | v2.13 |
| MI | 14 | 7 | 7 | FY2019-FY2025 | 7 | v2.13 |
| IN | 48 | 24 | 24 | FY2002-FY2025 | 24 | **NEW T3** |
| AZ | 46 | 23 | 23 | FY2002-FY2024 | 23 | **NEW T3** |
| OR | 8 | 4 | 4 | FY2022-FY2025 | 4 | **NEW T3** |
| MO | 28 | 14 | 14 | FY2012-FY2025 | 14 | **NEW T3** |
| CO | 6 | 3 | 3 | FY2023-FY2025 | 3 | **NEW T3** |
| SC | 48 | 24 | 24 | FY2002-FY2025 | 24 | **NEW T3** |
| KY | 47 | 24 | 23 | FY2002-FY2025 | 24 | **NEW T3** (op incl. FY2023 NASBO exception; rev FY2023 absent) |
| UT | 14 | 7 | 7 | FY2019-FY2025 | 7 | **NEW T3** |
| AL | 48 | 24 | 24 | FY2002-FY2025 | 24 | **NEW T3** |
| LA | 48 | 24 | 24 | FY2002-FY2025 | 24 | **NEW T3** |

**ACFR total: 859 rows (430 op + 429 rev).** Matches every plan-pinned row count from 113-VERIFICATION.md, 114-VERIFICATION.md, and 115-VERIFICATION.md exactly.

### NASBO states (21) — exactly 2 operating rows each, 42 rows total, operating-only

AK, AR, DE, HI, IA, ID, KS, ME, MS, MT, ND, NE, NH, NM, NV, OK, RI, SD, VT, WV, WY — confirmed untouched (all NASBO-labelled, all operating, exactly 2 rows/state).

**Cohort grand total: 901 rows (859 ACFR + 42 NASBO).** Matches the live `treasury.budgets` state-node row count exactly (independently confirmed: 472 operating + 429 revenue = 901).

---

## Hole reconciliation (PASS conditions — not re-litigated)

| Absence | Disposition | Confirmed by |
|---------|-------------|--------------|
| KY FY2023 revenue (+ operating stays NASBO-labelled) | Absent-by-design — broken-font/no-ToUnicode-CMap PDF, retained the NASBO operating row rather than fabricate a figure | 114-02-KY-LOADLOG.md; INV-11 confirms revenue FY set excludes 2023, operating FY set includes it |
| MA FY2002, FY2004, FY2005 | Absent-by-design — dot-leader digit-interleaving corruption, identical across all 3 years; an unsafe bounded-heuristic extractor was built, audited, and deliberately abandoned rather than ship a wrong-but-plausible figure | 115-03-MA-LOADLOG.md; INV-11 confirms these 3 FYs are absent from both op and rev MA sets |
| MA FY2021 | Absent-by-design — document-wide corrupted font ToUnicode mapping (cipher), confirmed via a 16,386-line "the"-frequency gap audit; not an OCR/scan issue (text layer exists, decodes to wrong characters) | 115-03-MA-LOADLOG.md; INV-11 |
| AZ stops at FY2024 | Absent-by-design — FY2025 not yet published/sourced at load time | 113-02-AZ-LOADLOG.md; INV-3 confirms AZ's window max=2024, no FY2025 row exists |
| OR floor FY2022 | Recon/format-locked window floor (D-06 honest window) | 113-03-OR-LOADLOG.md; INV-3 |
| CO floor FY2023 | Recon/format-locked window floor (D-12 shallow window) | 113-05-CO-LOADLOG.md; INV-3 |
| MO floor FY2012 | Recon/format-locked window floor | 113-04-MO-LOADLOG.md; INV-3 |
| UT floor FY2019 | Recon/format-locked window floor (Amendment G GF-alone scope) | 114-03-UT-LOADLOG.md; INV-3 |
| CT floor FY1988 | Pre-GASB-34/archive edge — CT's `oldcafrpdfs` collection begins at FY1988, no older PDFs exist | 115-02-CT-WI-LOADLOG.md; INV-3 |
| WI floor FY2000 | Pre-GASB-34/multi-file-era edge — pre-FY2000 WI is a 4-section multi-file format explicitly out of scope for this deepening pass | 115-02-CT-WI-LOADLOG.md; INV-3 |
| NJ floor FY2002 | Archive edge — NJ adopted GASB 34 in FY2002 itself (its first ACFR year); nothing older exists to omit, not a format boundary | 115-01-NJ-LOADLOG.md; INV-3 |

Every loadlog-LOADED FY for all 14 touched states (10 tranche-3 + 4 deepened) is present in the DB exactly as recorded — confirmed by INV-11's exact-FY-set match (0 issues). No hole was re-litigated in this audit; all dispositions above were already adjudicated in Phases 113/114/115 and are re-confirmed here as still holding in the live table.

**AZ FY2024 Google-Drive-link caveat (carried forward, not a hole):** AZ's FY2024 `source_url` points at a caveated Google Drive link (per 113-02-AZ-LOADLOG.md) rather than a durable gao.az.gov URL. The row is present, correctly ACFR-labelled, and ties — INV-1 confirms `source_url` is non-null — but the durability caveat is carried forward as a note for the next AZ touch, not a defect in this audit.

---

## LOAD-01 end-to-end proof (VER-08 headline)

**Representative loaders re-run:** SC (tranche-3) FY2025 operating + revenue, CT (deepened) FY2025 operating + revenue — via each loader's guarded `treasury_sync_budget_tree` path (`node scripts/processSCAcfr.js --fy 2025`, `node scripts/processSCRevenueAcfr.js --fy 2025`, `node scripts/processCTAcfr.js --fy 2025`, `node scripts/processCTRevenueAcfr.js --fy 2025`). `.env` sourced first; main tree; `treasury_sync_city_budget` never used.

### Baseline (before re-run)

| State | FY | Dataset | total_budget | data_source |
|-------|----|---------|---------------|-------------|
| SC | 2025 | operating | 20,323,239,000 | South Carolina State ACFR — General Fund (FY2025 actual, GAAP basis) |
| SC | 2025 | revenue | 20,731,521,000 | South Carolina State ACFR — General Fund Revenue (FY2025 actual, GAAP basis) |
| CT | 2025 | operating | 25,072,796,000 | Connecticut State ACFR — General Fund (FY2025 actual, GAAP basis) |
| CT | 2025 | revenue | 26,074,183,000 | Connecticut State ACFR — General Fund Revenue (FY2025 actual, GAAP basis) |

`treasury.data_sources` residue for `sc-acfr-%`/`ct-acfr-%` BEFORE re-run: **0 rows**.

### Re-run output

- `processSCAcfr.js --fy 2025`: "FY2025 validation: PASS", **"Loaded 0 rows for FY2025"** — 0 net change (UPDATE-in-place found no diff).
- `processSCRevenueAcfr.js --fy 2025`: "FY2025 validation: PASS", **"Loaded 0 rows for FY2025"** — 0 net change.
- `processCTAcfr.js --fy 2025`: "FY2025: TIE (11 functions, diff 0) Total Exp $25,072,796,000" — identical to baseline.
- `processCTRevenueAcfr.js --fy 2025`: "FY2025: TIE (11 sources, diff 0) Total Rev $26,074,183,000" — identical to baseline.

### Post-run (after re-run)

| State | FY | Dataset | total_budget | data_source | Changed? |
|-------|----|---------|---------------|-------------|----------|
| SC | 2025 | operating | 20,323,239,000 | (unchanged) | No |
| SC | 2025 | revenue | 20,731,521,000 | (unchanged) | No |
| CT | 2025 | operating | 25,072,796,000 | (unchanged) | No |
| CT | 2025 | revenue | 26,074,183,000 | (unchanged) | No |

**0 net change confirmed** on all 4 rows — totals and labels byte-for-byte identical before and after.

`treasury.data_sources` residue for `sc-acfr-%`/`ct-acfr-%` AFTER re-run, queried immediately with **NO manual re-clean step performed**: **0 rows**.

**This is the LOAD-01 proof.** Every prior cohort audit (Phase 102/106/110) required a manual re-clean of `data_sources` residue after each idempotency re-run (the WR-05 debt — `process*Acfr.js`'s create/RPC/delete lifecycle was non-atomic and left stray rows on certain code paths). Phase 111 made that lifecycle atomic/ephemeral. This is the first cohort audit in the series where the residue check was run immediately after the idempotency re-run, with zero intervention, and returned 0 — confirming the phase-111 fix holds under real repeated use across both a tranche-3 loader (SC) and a deepened loader (CT).

The full cohort audit (all 12 invariants, including INV-2's residue check) was re-run after the LOAD-01 re-run and returned the identical 12/12 PASS result with 0 change to row counts, confirming the re-run touched nothing else in the cohort.

---

## Headline verdict

**PASS.** The 50-node cohort (29 ACFR + 21 NASBO) source-chain audit is clean across all 12 invariants: no NULL/fragile basis fields, 0 residue, 0 out-of-window rows, 0 duplicates, 0 orphans, the full 29-state ACFR-GAAP set is correctly labelled (with the single documented KY FY2023 exception), the 21 NASBO states remain untouched, the new pre-GASB-34 basis label is visibly distinct from GAAP on all three affected nodes (CT/WI/MA), AL's Sep-30 FY-end semantics hold, MI's carried-forward Sep-30 check still holds, the window-integrity check confirms every touched state's exact loaded-FY set matches its LOADLOG record, and the carried-forward GA F-97-01 supersede is undisturbed. LOAD-01 is proven end-to-end: idempotency re-run = 0 net change, `data_sources` residue = 0 with no manual re-clean — the phase-111 atomic-lifecycle fix holds. VER-07 (parts b, c) and VER-08 are satisfied by this audit.
