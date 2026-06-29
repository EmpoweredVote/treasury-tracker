# Phase 97 — Plan 01: Spot-Reconciliation Record (SGFS-05)

**Run:** 2026-06-29 | **Mode:** read-only (no DB writes) | **DB:** production `kxsdzaojfaibhuzmclfq` (via mcp__supabase-local)
**Sample (D-97-01 "Representative 7"):** MN, OH, VA (ACFR op+rev) · Georgia, Texas, Colorado, California (NASBO operating FY2023+FY2024)

## Method (D-97-01 / carried D-93-06 — the Phase 86 lesson)

Each sample state's **stored** DB figures (`treasury.budgets.total_budget` + `treasury.budget_categories`) were compared
to figures **re-derived independently from the source document** — NOT from the loader's `STATES` object or any
loader self-report. Sources:
- **NASBO (GA/TX/CO/CA):** `./2025_NASBO_State_Expenditure_Report_S.pdf` (repo root), re-read with `pdftotext -table`.
  General Fund column only (1st numeric col; Total is the 5th — trap avoided). Table 1 = GF control total; per-function
  GF from Table 5 (E&S Ed), 9 (Higher Ed), 13 (Medicaid), 16 (Corrections), 21 (Transportation); "All Other" = GF total − Σ(5 named).
- **MN ACFR:** `./state-2023-acfr.pdf` (repo root) — State of Minnesota FY2023 ACFR, Governmental Funds Statement of
  Revenues, Expenditures and Changes in Fund Balances, **General Fund column**.
- **OH + VA ACFR:** fetched at run time (Chris decision 2026-06-29). VA = `doa.virginia.gov/.../2024/G_Major_Governmental_Funds.pdf`;
  OH = `archives.obm.ohio.gov/.../2024/ACFR_2024.pdf` (host required `curl --insecure --tlsv1.2` due to a TLS-handshake quirk — recorded for future runs).

**Tolerance (D-97-05):** explained, not penny-exact (~±2–5%). In practice every total tied **exactly** except one
documented function-level finding (Georgia Medicaid, below).

---

## A. ACFR states (GAAP basis, General Fund column) — ALL TIE EXACTLY

| State | FY | Dataset | Stored ($K) | Source-doc ($K) | Δ | Source citation |
|-------|----|---------|-------------|-----------------|---|-----------------|
| Minnesota | 2023 | operating | 26,646,765 | **26,646,765** | $0 | FY2023 ACFR, Govt Funds Stmt, GF col "Total Expenditures" |
| Minnesota | 2023 | revenue | 33,466,152 | **33,466,152** | $0 | same stmt, GF col "Net Revenues" |
| Ohio | 2024 | operating | 45,119,494 | **45,119,494** | $0 | FY2024 ACFR, Govt Funds Stmt, GF col "TOTAL EXPENDITURES" |
| Ohio | 2024 | revenue | 45,752,716 | **45,752,716** | $0 | same stmt, GF col "TOTAL REVENUES" |
| Virginia | 2024 | operating | 31,022,979 | **31,022,979** | $0 | FY2024 ACFR Major Govt Funds, GF col "Total Expenditures" |
| Virginia | 2024 | revenue | 32,875,046 | **32,875,046** | $0 | same stmt, GF col "Total Revenues" |

**Sampled categories (also exact):**
- MN rev: Individual Income Taxes 16,304,325 ✓ · Sales Taxes 7,538,069 ✓ · Federal Revenues 50,557 ✓
- OH: Public Assistance and Medicaid 19,635,827 ✓ · Primary/Secondary/Other Education 11,574,511 ✓ · Sales Taxes (rev) 13,990,858 ✓
- VA: Education (exp) 13,694,848 ✓ · Individual & Family Services 9,459,626 ✓ · Taxes (rev) 30,902,342 ✓

**Verdict:** MN/OH/VA stored figures are an exact, independent match to their published ACFR General Fund columns
(GAAP basis). Tie = $0 on all six totals — well inside the explained tolerance.

---

## B. NASBO states (budgetary basis, General Fund column)

Re-derived GF function values from the 2025 SER ($M). "Σ children" = depth-1 categories as stored; "parent" = depth-0 total.

### California FY2023 — EXACT TIE
| Function | Stored ($M) | SER GF ($M) | Δ |
|----------|-------------|-------------|---|
| Elementary & Secondary Education | 65,687 | 65,687 | 0 |
| Higher Education | 20,116 | 20,116 | 0 |
| Medicaid | 30,614 | 30,614 | 0 |
| Corrections | 14,756 | 14,756 | 0 |
| Transportation | 969 | 969 | 0 |
| All Other (= 195,189 − Σnamed 132,142) | 63,047 | 63,047 | 0 |
| **Total** | **195,189** | **195,189 (Table 1)** | **0** |

### Colorado FY2023 — EXACT TIE (Transportation $1M small-magnitude edge confirmed)
| Function | Stored ($M) | SER GF ($M) | Δ |
|----------|-------------|-------------|---|
| Elementary & Secondary Education | 4,500 | 4,500 | 0 |
| Higher Education | 1,386 | 1,386 | 0 |
| Medicaid | 3,344 | 3,344 | 0 |
| Corrections | 924 | 924 | 0 |
| Transportation | **1** | **1** | 0 |
| All Other | 3,492 | 3,492 | 0 |
| **Total** | **13,647** | **13,647 (Table 1)** | **0** |

### Texas FY2023 — EXACT TIE (non-June FYE 08-31; small Transportation/All Other edge)
| Function | Stored ($M) | SER GF ($M) | Δ |
|----------|-------------|-------------|---|
| Elementary & Secondary Education | 19,312 | 19,312 | 0 |
| Higher Education | 7,853 | 7,853 | 0 |
| Medicaid | 14,002 | 14,002 | 0 |
| Corrections | 4,139 | 4,139 | 0 |
| Transportation | 9 | 9 | 0 |
| All Other | 52 | 52 | 0 |
| **Total** | **45,367** | **45,367 (Table 1)** | **0** |
- source_date stored as **2023-08-31** (correct FY-end for Texas) — the non-June-30 FYE edge is handled correctly.

### Georgia FY2023 — 6/7 TIE · **FINDING: Medicaid +$8M**
| Function | Stored ($M) | SER GF ($M) | Δ |
|----------|-------------|-------------|---|
| Elementary & Secondary Education | 11,463 | 11,463 | 0 |
| Higher Education | 3,903 | 3,903 | 0 |
| **Medicaid** | **3,398** | **3,390** | **+8** ⚠ |
| Corrections | 1,888 | 1,888 | 0 |
| Transportation | 2,011 | 2,011 | 0 |
| All Other (correctly derived as 29,266 − Σnamed-using-3,390 = 6,611) | 6,611 | 6,611 | 0 |
| **Depth-0 total (parent)** | **29,266** | **29,266 (Table 1)** | **0** |
| **Σ depth-1 children** | **29,274** | — | **+8 vs parent** |

**Finding F-97-01 (GA Medicaid FY2023):** stored Medicaid GF = **$3,398M**; the NASBO SER Table 13 General Fund column
reads **$3,390M** (verified: 3,390 + Federal 12,707 + Other 1,358 = Total 17,455 ✓). The "All Other" residual (6,611) was
correctly computed using 3,390, so the stored **depth-1 children sum to $29,274M — $8M OVER the depth-0 parent total
of $29,266M** (0.027%). The parent total itself is correct (ties Table 1 exactly); only the Medicaid child is overstated,
which makes the icicle children exceed the parent box.
- This is the exact class of defect D-97-01 / the Phase 86 lesson targets — caught by independent re-derivation, invisible
  to loader self-report. Phase 94 flagged GA as "6/7 within 0.03%" and accepted it; for integrity (children must not
  exceed parent) it is a clean candidate for the **D-97-04 approved fix in Plan 97-02**: correct GA Medicaid FY2023
  3,398 → 3,390 (one cell; idempotent). FY2024 GA Medicaid must also be checked there (SER FY2024 GA Medicaid GF = 5,318).

---

## SGFS-05 spot-reconciliation verdict

**PASS (with 1 documented finding routed to Plan 97-02).**
- **7/7 sample states: dataset TOTALS reconcile to source** — all six ACFR totals tie $0; all four NASBO depth-0 totals
  tie the SER Table 1 GF control exactly.
- **6/7 states: function-level EXACT tie** (CA, CO, TX exact; MN/OH/VA totals + sampled categories exact).
- **1 finding (F-97-01):** Georgia FY2023 Medicaid GF stored $3,398M vs SER $3,390M (+$8M), causing depth-1 children to
  exceed the depth-0 parent by $8M. Total is correct; the Medicaid child is overstated. Routed to the Plan 97-02 D-97-04
  fix checkpoint (also verify GA FY2024).
- Re-derivation used source documents (ACFR statements + NASBO SER), NOT loader self-report. General Fund column
  confirmed for all NASBO reads. Mixed basis confirmed correct: NASBO = budgetary, MN/OH/VA = GAAP.
