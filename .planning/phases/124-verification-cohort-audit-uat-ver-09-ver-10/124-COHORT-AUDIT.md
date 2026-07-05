# 124-COHORT-AUDIT.md — Phase 124 Cohort Source-Chain Audit (VER-09 parts b+c, VER-10 prep)

**Headline verdict: 14/14 invariants PASS. 50/50 states on State-ACFR GAAP. NASBO retired to
exactly 2 honest fallback rows (NV FY2024 operating, KY FY2023 operating). Idempotency 0-change
on both a dollar-unit and a hand-transcribed loader re-run, 0 residue. The isAcfrOccupied guard
proven a no-op on all 47 states in the NASBO fallback map except its own 2 documented rows.**

Script: `scripts/verify-phase124-cohort-audit.mjs` (read-only, exit 0 = all PASS).
Run date: 2026-07-05. Cohort size: 50 state nodes, 1,560 budget rows.

---

## 1. Per-invariant results

| Invariant | Scope | Result | Detail |
|-----------|-------|--------|--------|
| INV-1 NULL-basis | all 1,560 rows | **PASS** | 0 rows missing `data_source`/`source_url`/`source_date` |
| INV-2 residue/fragile | `*-gf-*` data_sources | **PASS** | 0 stale rows (1 documented persistent-registry exception excluded — see §4) |
| INV-3 out-of-window | all 50 states | **PASS** | 0 rows outside their per-state window; every state has an explicit `WINDOW_BOUNDS` entry (no `_NASBO` default fallback remains) |
| INV-4 dup | (municipality_id, fy, dataset_type) | **PASS** | 0 duplicate combos |
| INV-5 orphan | `data_source_id` FK | **PASS** | 0 rows carry a `data_source_id` (text-stamp provenance only) |
| INV-6 ACFR-GAAP-on-50 | all 50 ACFR states | **PASS** | 1,558/1,560 rows carry ACFR/CAFR provenance; the 2 documented exceptions (KY FY2023 op, NV FY2024 op) correctly retain NASBO |
| **NASBORT-01** | whole cohort | **PASS** | Exactly 2 NASBO-labelled rows exist cohort-wide (NV FY2024 op, KY FY2023 op); neither key carries a same-year ACFR operating row; 0 (state,fy) keys carry both an ACFR and a NASBO operating row |
| **50/50-ACFR** | all 50 states | **PASS** | Every one of the 50 states has ≥1 ACFR-labelled operating row; 0 states are NASBO-only / ACFR-absent |
| INV-8 pre-GASB-34 label distinctness | CT/WI/MA | **PASS** | CT FY1988-2001, WI FY2000-2001, MA FY2001 carry the pre-34 label; modern years (incl. CT FY2006, OCR-recovered) carry "GAAP basis" — undisturbed by the tail load |
| INV-9 AL Sep-30 | AL (48 rows) | **PASS** | `source_date` = `{FY}-09-30`, `fiscal_year_start_month` = 10, all 48 rows |
| INV-10 MI Sep-30 | MI (14 rows) | **PASS** | `source_date` = `{FY}-09-30`, `fiscal_year_start_month` = 10, all 14 rows |
| **INV-ME non-June resolution** | ME (48 rows) | **PASS** | All 48 rows: `fiscal_year_start_month` = 1 (standard, same as every other unflagged state) and `source_date` ends `-06-30` — the pre-recon "non-June to watch" flag is confirmed resolved DB-side, matching 119-03-ME-LOADLOG's finding of standard June-30 on all 26 downloaded covers |
| INV-11 window-integrity | 23 touched states (21 tail + CA + FL) | **PASS** | Every touched state's exact loaded-FY set (op/rev tracked separately) matches its recorded LOADLOG disposition; holes absent by design (see §3) |
| INV-12 GA F-97-01 supersede | GA | **PASS** | FY2023 operating = $59,893,783,000 (ACFR GAAP) at the original key; 0 NASBO rows on the GA node |

**Total: 14 PASS, 0 FAIL.**

## 2. Row-count confirmation (21 new tail states + CA/FL widened)

| State | Op rows | Rev rows | FY range | Matches interfaces block? |
|-------|---------|----------|----------|---------------------------|
| AK | 20 | 20 | FY2006–2025 | Yes (20+20) |
| AR | 22 | 22 | FY2003–2024 | Yes (22+22) |
| DE | 21 | 21 | FY2004–2025 (hole 2005) | Yes (21+21) |
| HI | 21 | 21 | FY2005–2025 | Yes (21+21) |
| ID | 22 | 22 | FY2004–2025 | Yes (22+22) |
| IA | 23 | 23 | FY2002–2025 (hole 2008) | Yes (23+23) |
| KS | 7 | 7 | FY2019–2025 | Yes (7+7) |
| ME | 24 | 24 | FY2002–2025 | Yes (24+24) |
| MS | 22 | 22 | FY2003–2024 | Yes (22+22) |
| MT | 11 | 11 | FY2015–2025 | Yes (11+11) |
| NE | 6 | 6 | FY2020–2025 | Yes (6+6) |
| NV | 6 (5 ACFR + 1 NASBO FY2024) | 5 | FY2019–2024 op / FY2019–2023 rev | Yes |
| NH | 8 | 8 | FY2017–2024 | Yes (8+8) |
| NM | 4 | 4 | FY2019–2024 (holes 2020/2021) | Yes (4+4) |
| ND | 5 | 5 | FY2021–2025 | Yes (5+5) |
| OK | 23 | 23 | FY2002–2024 | Yes (23+23) |
| RI | 20 | 20 | FY2006–2025 | Yes (20+20) |
| SD | 24 | 24 | FY2002–2025 | Yes (24+24) |
| VT | 11 | 11 | FY2015–2025 | Yes (11+11) |
| WV | 6 | 6 | FY2020–2025 | Yes (6+6) |
| WY | 21 | 21 | FY2005–2025 | Yes (21+21) |
| CA | 24 | 24 | FY2002–2025 (was 18+18) | Yes (24+24) |
| FL | 22 | 22 | FY2003–2024 (was 4+4) | Yes (22+22) |

Cohort total: **1,560 budget rows** across all 50 state nodes (901 pre-tail rows carried
unchanged from Phase 116 + 659 tail/deepening rows added by Phases 118–122).

## 3. Window-verdict reconciliation

Every FY recorded as LOADED in the 118-121 + 122 batch SUMMARYs is present in the live DB
(row counts in §2 confirm this exactly), and every absent FY within a state's window maps to a
recorded, documented disposition — **not** an unrecorded gap:

| State | Absent FY(s) within window | Recorded reason |
|-------|------------------------------|------------------|
| AR | FY2025 | Garbled Type-3 font (out-of-window: window max=2024, so this is a floor, not an internal hole) |
| DE | FY2005 | 404 on the source PDF |
| HI | FY2000–2004 | Image-only, below the recon floor (window starts FY2005) |
| IA | FY2008 | RC4-encrypted PDF (no OCR/qpdf tooling available) |
| ME | FY2000/2001 | Pre-GASB-34, below the recon floor (window starts FY2002) |
| MS | FY2025 | Not yet published (out-of-window: window max=2024) |
| NV | Op FY2024 = NASBO fallback (not an ACFR hole, a disclosed exception); Rev ends FY2023 | Recency-tail; no FY2024 revenue ACFR statement available yet |
| NM | FY2020/2021 | Only a narrower single-agency filing found, not the statewide ACFR |
| KY | Op FY2023 = NASBO fallback; Rev FY2023 absent | Broken-font PDF (carried unchanged from Phase 116/121) |
| FL | FY2000–2002 | Repair-pending (damaged xref, qpdf unavailable); window starts FY2003 |
| CA | ≤FY2001 | Soft-404 floor; window starts FY2002 |
| NY | ≤FY2002 | 404 floor; window starts FY2003 (unchanged from 116) |
| TX | ≤FY2014 | No durable statewide URL; window starts FY2015 (unchanged from 116) |

**NV FY2024 operating + KY FY2023 operating are confirmed the only 2 honest NASBO fallbacks in
the entire cohort** (NASBORT-01, §1) — both are disclosed, labelled `NASBO State Expenditure
Report`, and neither has a competing same-year ACFR operating row. No node shows NASBO where
ACFR now exists.

**Verdict: 0 unrecorded DB gaps.** Every absence traces to a documented, honest disposition
already judged unrecoverable in Phases 118–122; none are re-litigated here.

## 4. Documented persistent-registry exception (INV-2)

`ca-acfr-gf-operating` (data_sources id `6758d9ae-d06c-40e6-907d-71e4dfea611f`) backs 0 live
`budgets` rows (CA budgets rows use text-stamp provenance, `data_source_id` is NULL — confirmed
by INV-5). This is **not** WR-05-class residue: `122-03-DEEP05-CLOSEOUT.md` (line 29) and
`122-03-SUMMARY.md` explicitly document that CA's operating loader is not ephemeral for this one
dataset and intentionally keeps exactly 1 persistent registry row (24 fiscal_years, 0
orphan/duplicate). The audit script allowlists this single documented dataset_id and would still
FAIL on any other undocumented `*-gf-*` residue — confirmed 0 other residue rows exist.

## 5. Idempotency / never-overwrite result

Two representative loaders were re-run live against their already-loaded FYs, using each
loader's existing guarded never-overwrite path (`.env` sourced; main tree; `treasury_sync_budget_tree`
RPC — never `treasury_sync_city_budget`):

| Loader | Re-run target | Result |
|--------|----------------|--------|
| `processNDAcfr.js` (dollar-unit, UNITS=1) | ND FY2025 operating | `Loaded 0 rows for FY2025` |
| `processNDRevenueAcfr.js` | ND FY2025 revenue | `Loaded 0 rows for FY2025` |
| `processOKAcfr.js` (hand-transcribed cohort member, UNITS=1000) | OK FY2024 operating | `Loaded 0 rows for FY2024` |
| `processOKRevenueAcfr.js` | OK FY2024 revenue | `Loaded 0 rows for FY2024` |

**Post-re-run cohort audit re-run:** 14/14 invariants still PASS, exit 0. ND still exactly 10
rows (5 op + 5 rev), OK still exactly 46 rows (23 op + 23 rev) — **0 net budgets change.**

**WR-05 residue re-check (explicit):** direct queries against `treasury.data_sources` for
`dataset_id ILIKE 'nd-%'` and `dataset_id ILIKE 'ok-%'` both return **0 rows** after the
re-runs — confirming the ephemeral `data_sources` lifecycle (LOAD-01) held for both a
dollar-unit and a hand-transcribed loader on a second live run, with no manual re-clean needed.

**isAcfrOccupied guard dry-run result:** the CLI `--dry-run` flag on `loadStateGF.mjs` was found
to short-circuit BEFORE the guard's DB read (`loadStateFY` returns at the control-tie check,
which runs before muni resolution and the guard), so it cannot literally exercise the
DB-dependent guard branch — see the Deviations section in the plan SUMMARY for the full
explanation. Instead, the guard's exported pure function `isAcfrOccupied` was applied directly
against the LIVE current `data_source` of every (state, fy) combination present in the loader's
hardcoded NASBO fallback map (`__STATES`, 47 states):

- **94 state-FY combinations checked** (47 states × 2 FYs each, FY2023+FY2024).
- **92 would SKIP** (ACFR-occupied — the guard fires, 0 intended writes).
- **2 would WRITE**: KY FY2023 and NV FY2024 — but in both cases the existing row IS the
  loader's own NASBO label (`isAcfrOccupied` correctly returns `false` for its own fallback,
  permitting idempotent self-refresh, not an overwrite of a foreign source).
- **Conclusion: 0 intended writes to any of the 50 ACFR nodes.** An unfiltered re-run of
  `loadStateGF.mjs` can only touch NV FY2024 / KY FY2023 (its own 2 documented fallback rows)
  or a genuinely absent node — confirming the Phase 123 NASBORT-01 guard is a no-op on the
  ACFR-occupied surface, matching the 123-01-SUMMARY.md's own DB-verified finding (2 NASBO
  rows, neither with same-year ACFR).

## 6. Sign-off

All must-have truths for VER-09 parts (b)+(c) are satisfied:
- 0 NULL-basis / fragile / residue / out-of-window / dup / orphan across the full 50-node,
  1,560-row cohort — LOAD-01 holds cohort-wide with no manual re-clean.
- All 50 state nodes confirmed on State-ACFR GAAP (50/50-ACFR).
- NASBORT-01 confirmed: exactly 2 NASBO rows (NV FY2024 op, KY FY2023 op), neither with a
  same-year ACFR row.
- Every displayed state-node row carries a basis label (INV-1).
- Every newly-loaded/deepened state's exact loaded-FY set matches its recorded LOADLOG
  disposition (INV-11); holes are absent by design, not unrecorded gaps (§3).
- A dollar-unit loader (ND) and a hand-transcribed loader (OK) both re-run to 0 net change with
  0 residue (§5); the NASBO-retirement guard proven a no-op on all ACFR-occupied nodes.

This file + `124-REDERIVATION.md` (VER-09a, plan 124-01) are the two evidence inputs the UAT
plan (124-03) and the gsd-verifier read for VER-09. VER-10 (Chris live-app UAT) is scoped to
plan 124-03.
