# Phase 112 RECON — ACFR Roster Lock + Source Location + Overlap Resolution

**Status:** IN PROGRESS — 112-01 (Ranking + Batch-1 source location: AZ/IN/CO/MO/KY) underway. 112-02 (Batch-2 source location: OR/SC/LA/OK/UT) and 112-03 (roster lock + substitutions + overlap resolution + consolidated handoff) not yet run.
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**Requirements:** RECON-09 (ranking + roster lock + source location), RECON-10 (overlap resolution)
**Method:** `pdftotext -table` on the NASBO 2025 SER PDF + official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-RECON.md shape (Phase 107 tranche-2 recon mold).

---

## Section 1 — NASBO 2025 SER GF-Size Ranking of the Remaining 31 NASBO States (RECON-09)

**Source:** NASBO 2025 State Expenditure Report, TABLE 1 "Total State Expenditures — Capital Inclusive ($ in millions)", **Actual Fiscal 2024, General Fund column**. `https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2025_SER/2025_NASBO_State_Expenditure_Report_S.pdf` (physical PDF page 19; `pdftotext -table -f 19 -l 19` extracts the full 50-state table cleanly — no column misalignment, unlike `-layout` mode on this same page, which mis-shifts rows by one wherever a state has blank Federal/Other/Bonds cells).

**Method:** Derived each remaining state's FY2024 GF operating total by summing its per-program-area values in the `STATES` map of `scripts/loadStateGF.mjs` (checksum-verified NASBO 2025 SER figures loaded in Phase 96) — this equals the loader's `controlTotalGF` field per state. **Full spot-check performed** (all 31, not just the top ~12): every one of the 31 `controlTotalGF` FY2024 values in `scripts/loadStateGF.mjs` was cross-checked byte-for-byte against the NASBO Table 1 PDF's Actual Fiscal 2024 General Fund column extracted via `pdftotext -table`. **Result: 0 transcription drift across all 31 states.** The Phase-96 loader data is confirmed accurate; no corrections needed.

**The 31 = 50 states minus the 19 ACFR-upgraded states** (MN, OH, VA, CA, TX, NY, FL, PA, IL, NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI).

**Candidate 10 (per REQUIREMENTS.md / 112-CONTEXT.md proposed order):** AZ, IN, CO, MO, KY, OR, SC, LA, OK, UT.

### Ranking Table (31 states, sorted descending by FY2024 GF total)

| Rank | State | FY2024 GF total | Candidate? | Notes |
|------|-------|-----------------|------------|-------|
| 1 | Indiana (IN) | $22,405M | **Candidate** | Actual #1 by GF size — proposed order had IN #2 (after AZ). Order correction. |
| 2 | Arizona (AZ) | $17,903M | **Candidate** | Actual #2 — proposed order had AZ #1. Order correction. |
| 3 | Oregon (OR) | $16,100M | **Candidate** | Actual #3 — proposed order had OR #6. Order correction. |
| 4 | Missouri (MO) | $14,561M | **Candidate** | Actual #4 — matches proposed #4. |
| 5 | Colorado (CO) | $14,513M | **Candidate** | Actual #5 — proposed order had CO #3. Order correction. |
| 6 | South Carolina (SC) | $14,189M | **Candidate** | Actual #6 — proposed order had SC #7. Order correction. |
| 7 | Kentucky (KY) | $14,188M | **Candidate** | Actual #7 — matches proposed #5 closely (off by 2 slots). Order correction (KY/SC essentially tied, $1M apart). |
| 8 | Utah (UT) | $13,674M | **Candidate** | Actual #8 — proposed order had UT #10 (last). Order correction — UT ranks ahead of LA and OK. |
| 9 | **Alabama (AL)** | $13,511M | Not a candidate | **RANK-CORRECTION FLAG (D-01):** AL is NOT in the named candidate 10, but ranks above candidates Louisiana (#10) and Oklahoma (#14). Flagged for the 112-03 substitution round — do not recon here. |
| 10 | Louisiana (LA) | $11,970M | **Candidate** | Actual #10 — matches proposed #8 (off by 2 slots, still IN roster). |
| 11 | **Hawaii (HI)** | $11,222M | Not a candidate | **RANK-CORRECTION FLAG (D-01):** ranks above candidate Oklahoma (#14). Flagged for 112-03 — do not recon here. |
| 12 | **New Mexico (NM)** | $9,975M | Not a candidate | **RANK-CORRECTION FLAG (D-01):** ranks above candidate Oklahoma (#14). Flagged for 112-03 — do not recon here. |
| 13 | **Kansas (KS)** | $9,365M | Not a candidate | **RANK-CORRECTION FLAG (D-01):** ranks above candidate Oklahoma (#14). Flagged for 112-03 — do not recon here. |
| 14 | Oklahoma (OK) | $9,139M | **Candidate** | Actual #14 — proposed order had OK #9. **Falls well outside the true top 10** (AL/HI/NM/KS all outrank it). Weakest-ranked of the 10 named candidates — primary D-01 substitution-round candidate for 112-03 (AL, the state immediately above it in the true ranking that's closest to the roster, is the natural first-look substitute if OK fails clean extraction or the rank correction is applied). |
| 15 | Iowa (IA) | $8,560M | Not a candidate | Below all 10 named candidates. |
| 16 | Mississippi (MS) | $6,635M | Not a candidate | — |
| 17 | Alaska (AK) | $6,339M | Not a candidate | — |
| 18 | Delaware (DE) | $6,232M | Not a candidate | — |
| 19 | Arkansas (AR) | $6,075M | Not a candidate | — |
| 20 | Nebraska (NE) | $5,314M | Not a candidate | — |
| 21 | Nevada (NV) | $5,273M | Not a candidate | — |
| 22 | Rhode Island (RI) | $5,236M | Not a candidate | — |
| 23 | Idaho (ID) | $5,020M | Not a candidate | — |
| 24 | Maine (ME) | $4,980M | Not a candidate | — |
| 25 | West Virginia (WV) | $4,164M | Not a candidate | — |
| 26 | North Dakota (ND) | $2,876M | Not a candidate | — |
| 27 | Montana (MT) | $2,684M | Not a candidate | — |
| 28 | Vermont (VT) | $2,510M | Not a candidate | — |
| 29 | South Dakota (SD) | $2,362M | Not a candidate | — |
| 30 | New Hampshire (NH) | $1,981M | Not a candidate | — |
| 31 | Wyoming (WY) | $1,654M | Not a candidate | — |

**Row count check:** 31 rows. None of the 19 ACFR states appear (verified — MN/OH/VA/CA/TX/NY/FL/PA/IL/NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI are all absent from this table).

### Confirm-or-Correct Verdict (D-01 input for plan 112-03)

- **Within the 10 named candidates:** the size order is CORRECTED from the proposed `AZ > IN > CO > MO > KY > OR > SC > LA > OK > UT` to the actual `IN > AZ > OR > MO > CO > SC > KY > UT > LA > OK`. This does not change roster membership (D-02 batch-split still uses this corrected order to re-lock the 113/114 batch assignment in 112-03).
- **Rank-correction flags (states outside the 10 that outrank a candidate):** **AL** (rank 9, outranks LA #10 and OK #14), **HI** (rank 11, outranks OK #14), **NM** (rank 12, outranks OK #14), **KS** (rank 13, outranks OK #14). All four are flagged per D-01 for the 112-03 substitution round. None are reconned in this plan (112-01/112-02 recon only the 10 named candidates: AZ/IN/CO/MO/KY in 112-01, OR/SC/LA/OK/UT in 112-02).
- **Weakest candidate:** Oklahoma (OK), actual rank 14 — well outside the true top 10. It is still reconned in 112-02 per the named-candidate-10 rule (D-01: draw only from the named 10; substitution is a 112-03 decision after extraction results are in), but flagged here as the most likely substitution-round casualty.

---

## Section 2 — Roster Lock (RECON-09, D-01/D-02)

*Placeholder — filled in plan 112-03 after 112-01 (AZ/IN/CO/MO/KY) and 112-02 (OR/SC/LA/OK/UT) source-location recon complete.*

Decision criteria (per 107 precedent, carried by D-05..D-12):
1. Cleanly `pdftotext -table`-extracts (GF column reads without alignment errors), AND
2. Passes the D-07 recency floor (FY2023 + FY2024 covered by a durable-URL clean window).

Substitution rule (D-01, this milestone only): a candidate that fails either criterion, or is rank-corrected by Section 1 above, may be substituted with the next-largest un-upgraded NASBO state — one substitution round only, each substitution documented with its reason. Failed candidates (with no substitute reached) land in ACFRX-03 (final tranche).

*(To be filled: Roster Lock Table — State | Verdict | Clean window | Recency floor | Reason if deferred/substituted)*

---

## Section 3 — Batch Split (D-02)

*Placeholder — filled in plan 112-03.*

Proposed (pre-substitution, largest-GF-first per the corrected Section 1 order): Batch 1 (Phase 113) = IN, AZ, OR, MO, CO; Batch 2 (Phase 114) = SC, KY, UT, LA, OK. **Locked assignment TBD in 112-03** after substitution round (if any) is resolved — surviving states keep size-order assignment, batches rebalance around them (~5/~5).

*(To be filled: final ACFR-2x ↔ state mapping table for the traceability table.)*

---

## Section 4 — Overlap Resolution (RECON-10)

*Placeholder — filled in plan 112-03.*

Named overlap-risk state: **Utah (UT)** — v2.5 loaded Utah *municipal* (city/county) data from Transparent Utah BigQuery (unaffected, out of scope), but the UT *state node's* provenance must be explicitly checked before any ACFR write. Default plan (D-03): in-place upgrade (MA v1.8-DLS / CA v1.7 precedent) if UT's state node carries pre-existing custom-source rows — no duplicate node, ACFR rows replace prior state-node GF rows per state-FY, provenance + row inventory documented before any write.

*(To be filled: read-only DB probe results — UT state node ID + row inventory + in-place-upgrade plan or "clean NASBO-only node" verdict; same check for any substituted-in state per Section 1.)*

---

## Section 5 — Consolidated Risk-Fact Table (D-08)

*Placeholder — filled in plan 112-03 after 112-01 + 112-02 detail blocks are complete. Will consolidate: Units | Negative GF line items | Exact column header + statement | FY-end month, per locked-roster state — mirrors 107-RECON.md Section 3.*

---

## Section 6 — Gap-Log Rollup

*Placeholder — filled in plan 112-03, consolidating the per-state gap logs recorded in 112-BATCH1-SOURCES.md (112-01) and 112-BATCH2-SOURCES.md (112-02).*

---

## Section 7 — Untouched-Nodes Contract (RECON-10, carried from 107-RECON.md RECON-08 mold)

The existing **19 ACFR nodes** (MN, OH, VA, CA, TX, NY, FL, PA, IL, NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI) are **not disturbed** by this recon or by the Phase 113/114 loads it feeds. Phases 113/114 touch only the locked roster's state nodes (to be confirmed in 112-03 via read-only DB probe, same method as the Phase 107 probe). `scripts/loadStateGF.mjs` stays the NASBO fallback for all un-upgraded states and is not modified.

---

## Success-Criteria Coverage (partial — 112-01 only)

- [x] 31-state NASBO-2025-SER GF ranking table filled, sorted descending, 31 rows, none of the 19 ACFR states present.
- [x] Candidate/rank-correction marks recorded (AL/HI/NM/KS flagged; OK identified as weakest candidate).
- [x] Full spot-check (all 31, not just top ~12) against the NASBO 2025 SER PDF Table 1 — 0 transcription drift.
- [ ] Roster locked (112-03).
- [ ] Batch split locked (112-03).
- [ ] Overlap resolution — UT provenance check (112-03).
- [ ] Consolidated risk-fact table + gap-log rollup (112-03).
