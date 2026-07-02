# Phase 112 RECON — ACFR Roster Lock + Source Location + Overlap Resolution

**Status:** IN PROGRESS — 112-01 (Ranking + Batch-1 source location: AZ/IN/CO/MO/KY) and 112-02 (Batch-2 source location: OR/SC/LA/OK/UT) complete. 112-03 Task 1 (read-only overlap probe) and Task 2 (substitution round) complete. Roster lock, batch split, and consolidated handoff (Task 3) not yet run.
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**Requirements:** RECON-09 (ranking + roster lock + source location), RECON-10 (overlap resolution)
**Method:** `pdftotext -table` on the NASBO 2025 SER PDF + official state ACFR PDFs via `curl`. Read-only SELECT probes against production Supabase (`treasury.municipalities`, `treasury.budgets`, `treasury.data_sources`). $0 spend. No DB writes.
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

### Confirm-or-Correct Verdict (D-01 — resolved in 112-03 Task 2)

- **Within the 10 named candidates:** the size order is CORRECTED from the proposed `AZ > IN > CO > MO > KY > OR > SC > LA > OK > UT` to the actual `IN > AZ > OR > MO > CO > SC > KY > UT > LA > OK`. This does not change roster membership for the 9 candidates other than OK.
- **Rank-correction flags (states outside the 10 that outrank a candidate):** **AL** (rank 9, outranks LA #10 and OK #14), **HI** (rank 11), **NM** (rank 12), **KS** (rank 13) all outrank OK (#14). **Resolved in Section 2 below:** AL is substituted in for OK — one substitution round only (D-01), the count does not float further; HI/NM/KS are reviewed but not needed since AL alone fills the single vacancy.
- **Final locked-in-progress roster (post-substitution, 10 states, pending Task 3 lock table):** IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA — this is now exactly the "true top 10" by NASBO 2025 SER GF size among the 31 remaining states. OK exits to ACFRX-03.

---

## Section 2 — Substitution Round (D-01, RECON-09)

**Trigger check (per 112-03-PLAN.md task instructions):** collect every candidate marked SUBSTITUTION CANDIDATE by 112-01/112-02 (failed clean `pdftotext -table` extraction or failed the D-07 recency floor) plus any rank-correction flag (a non-candidate state ranking above a candidate).

- **SUBSTITUTION CANDIDATE marks:** **NONE.** A literal-string check of 112-BATCH1-SOURCES.md and 112-BATCH2-SOURCES.md confirms no state carries the `SUBSTITUTION CANDIDATE` marker — all 10 named candidates cleanly `pdftotext -table`-extracted and passed the D-07 recency floor (Section 5 of each SOURCES doc: all 10 states GREENLIGHT). AZ carries a **load-phase blocker/decision flag** (its FY2024 ACFR is currently hosted only via a non-durable Google Drive link, failing D-06) but this is explicitly NOT an extraction or recency-floor failure — AZ's FY2024 numbers extracted cleanly and tied to $0 diff. AZ stays IN the roster; the URL-durability question is flagged for Phase 113 to resolve at load time.
- **Rank-correction flags:** **YES.** Section 1 above documents four non-candidate states (AL rank 9, HI rank 11, NM rank 12, KS rank 13) that all outrank Oklahoma (OK, rank 14 — the weakest of the 10 named candidates, "well outside the true top 10" per the 112-01 recon's own explicit flag).

**Verdict: one substitution round required.** Per D-01 ("a candidate that ... is rank-corrected by the NASBO 2025 SER re-ranking may be substituted with the next-largest un-upgraded NASBO state"), Oklahoma is the outgoing candidate and **Alabama (AL, rank 9 — the single next-largest un-upgraded NASBO state, immediately above the roster's weakest link)** is the incoming substitute. Hawaii/New Mexico/Kansas are not needed: D-01 permits exactly **one substitution round**, and AL alone fills the single vacancy created by OK's exit — there is no second reach-down.

### Outgoing: Oklahoma (OK) → ACFRX-03

**Reason: rank correction.** OK is the weakest of the 10 named candidates (NASBO 2025 SER actual rank 14 of 31), and four non-candidate states (AL #9, HI #11, NM #12, KS #13) all rank above it — meaning OK does not belong in the "true top 10" by GF size. OK was **not** substituted for a technical failure: its 112-02 recon block (bookend-tied $0 diff for both FY2002 and FY2024, GREENLIGHT recency floor, clean `Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds` extraction) remains fully valid and is preserved in 112-BATCH2-SOURCES.md for future reference. **OK lands in ACFRX-03** (the final long-tail tranche) with its recon work already done — a future milestone can pick it straight off the shelf without re-reconning.

### Incoming: Alabama (AL) — Full Recon Block (substitute for OK)

**Source:** State of Alabama Comptroller's Office (`comptroller.alabama.gov`)
**PDF:** Annual Comprehensive Financial Report (ACFR) / formerly CAFR
**Landing page:** `https://comptroller.alabama.gov/acfr-2/` — full archive FY2000–FY2025 enumerable directly from this one page, all hosted on `comptroller.alabama.gov/wp-content/uploads/`, all confirmed live (`application/pdf`).

**URL pattern (no single derivable pattern — naming convention shifts by era, all confirmed live from the one landing page):**
- FY2025: `.../2026/03/ACFR-2025.Alabama.pdf`
- FY2024: `.../2025/04/ACFR-2024.Alabama.pdf`
- FY2023: `.../2024/03/ACFR-2023.Alabama.pdf` (confirmed live via HEAD, 200 OK, `application/pdf`)
- FY2021: `.../2022/03/ACFR-2021.Alabama.pdf` (first year using "ACFR" naming instead of "CAFR")
- FY2016–FY2020: `CAFR-{YYYY}.Alabama.pdf`
- FY2007–FY2015: mixed case/style (`cafr.2007.pdf`, `cafr.2008.pdf`, `cafr.2009.pdf`, `cafr.2010.pdf`, `cafr.ala_.2012.pdf`, `cafr.2013.ala_.pdf`, `cafr.2014.Alabama.pdf`, `CAFR.Ala_.2011.pdf`, `Cafr.2015.pdf`)
- FY2000–FY2006: `{YYYY}CAFR.pdf`
- FY2002 (bookend, boundary year): `https://comptroller.alabama.gov/wp-content/uploads/2017/11/2002CAFR.pdf`

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds (FY2002 title omits the comma after "Expenditures"; cosmetic wording variance only, same statement)
**Column:** **General Fund** (1st column both bookend years; major-fund lineup shifts slightly by era — FY2002: General Fund | Education Trust Fund | Alabama Trust Fund | Medicaid Fund | **Public Road and Bridge Fund** | Public Welfare Trust Fund | Nonmajor | Total; FY2024: General Fund | Education Trust Fund | Alabama Trust Fund | Medicaid Fund | Public Welfare Trust Fund | **ARPA Coronavirus State Fiscal Recovery Fund** | Nonmajor | Total — GF stays column 1 in both)
**Units:** Thousands ("(Amounts in Thousands)" confirmed both bookend PDFs)
**FY-end:** **September 30** (matches the existing `FY_END_MMDD.AL = '09-30'` entry already present in `scripts/loadStateGF.mjs` from Phase 96 — independently corroborated by this recon)

**Bookend tie-confirms (GF column, Total Revenues):**
- FY2024: GF Total Revenues = **$3,262,681K** — GF line items (Taxes $2,476,722K + Licenses/Permits/Fees $205,949K + Fines/Forfeits/Court Settlements $17,224K + Investment Income $559,074K + Federal Grants $0 + Other Revenues $3,712K) sum = $3,262,681K ✅ (diff $0). GF Total Expenditures = $2,291,921K, line items sum = $2,291,921K ✅ (diff $0).
- FY2002 (oldest — GASB-34-era boundary): GF Total Revenues = **$1,094,623K** — line items (Taxes $890,276K + Licenses/Permits/Fees $121,345K + Fines/Forfeits/Court Settlements $18,199K + Investment Income $35,139K + Federal Grants $0 + Other Revenues $29,664K) sum = $1,094,623K ✅ (diff $0). GF Total Expenditures = $1,044,708K, line items sum = $1,044,708K ✅ (diff $0).

**Negative GF line items:** None in either bookend year's GF column — all revenue lines positive in both FY2002 and FY2024. Low P2 risk.

**Scope vs NASBO (D-09) — UNIQUE FINDING, narrowest divergence in the entire v2.14 tranche:** AL's ACFR GF Total Revenues ($3,262,681K = $3.26B, FY2024) vs NASBO GF operating ($13,511M) = **~0.24×** — narrower even than Utah's 0.83× (the only other narrower-than-NASBO state found this tranche). **Driver: Alabama's constitutionally mandated dual-budget system.** Alabama's state government operates two legally separate major "budgets" — the General Fund (non-education state government) and the **Education Trust Fund** (K-12 + higher education, $10,779,442K FY2024 GF-column-adjacent) — kept as two distinct major funds in the GAAP statement, unlike most other states which fold education spending into a single General Fund. **Combined GF + Education Trust Fund = $3,262,681K + $10,779,442K = $14,042,123K ($14.04B), which is very close to NASBO's reported $13,511M (~1.04×)** — strong evidence that NASBO's survey-reported "General Fund" figure for Alabama represents the state's combined GF+ETF budget concept, not the narrow GAAP General Fund alone. **Flagged as a load-phase decision (per D-03/D-09 guidance, same treatment as Utah's Income Tax Fund finding) — not resolved here:** Phase 114 must decide whether to load GF alone (narrower, GAAP-legal-fund-accurate) or GF+Education Trust Fund combined (broader, ~1.04× NASBO parity). Document the constitutional dual-budget driver explicitly either way.

**Recency floor (D-07):** FY2023 confirmed live (`ACFR-2023.Alabama.pdf`, HEAD 200 OK, `application/pdf`) + FY2024 extracted and bookend-tied ($0 diff). **GREENLIGHT.**

**Clean window:** FY2002–FY2025 (24 years; full archive enumerable back to FY2000, but FY2002 is the declared pre-GASB-34 boundary for this milestone per D-12 — FY2000/FY2001 not pursued further, in-scope boundary honored).

**Gap log:** No durability gaps — every year FY2000–FY2025 is confirmed live on `comptroller.alabama.gov`. The only note is the **non-derivable, multi-convention filename pattern** (12+ distinct naming styles across 26 years) — same class of finding as OK/OR/UT/CO, requires an explicit per-year `SOURCES` map, not a content gap.

**Loader template mapping:** `processILAcfr.js` / `processILRevenueAcfr.js` (multi-major-fund layout, non-derivable per-year URL naming requiring an explicit SOURCES map — same family as OK/OR/UT/SC/LA).

**Overlap probe (RECON-10, per Section 5's method):** AL state node confirmed via read-only SELECT — `bc953061-98de-43ad-878a-c6564bf75dbc`, exactly 2 budgets rows (FY2023 $13,764M, FY2024 $13,511M NASBO operating, `data_source_id = null`, text-stamp provenance), **zero `data_sources` table rows**. Clean NASBO-only node — no pre-existing custom-source overlap, no in-place-upgrade complication. Standard ACFR-replaces-NASBO plan applies (same as the other 9 roster states).

---

## Section 3 — Roster Lock (RECON-09, D-01/D-02)

*Placeholder — filled in plan 112-03 Task 3 now that the substitution round (Section 2) is resolved.*

Decision criteria (per 107 precedent, carried by D-05..D-12):
1. Cleanly `pdftotext -table`-extracts (GF column reads without alignment errors), AND
2. Passes the D-07 recency floor (FY2023 + FY2024 covered by a durable-URL clean window).

Final roster (post-substitution, per Section 2): IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA. OK exits to ACFRX-03.

*(To be filled in Task 3: Roster Lock Table — State | Verdict | Clean window | Recency floor | Reason if deferred/substituted)*

---

## Section 4 — Batch Split (D-02)

*Placeholder — filled in plan 112-03 Task 3.*

Locked by GF size, largest-first, from the corrected ranking (Section 1) with AL substituted in for OK per Section 2.

*(To be filled in Task 3: final ACFR-2x ↔ state mapping table for the traceability table.)*

---

## Section 5 — Overlap Resolution (RECON-10)

### Read-Only DB Probe Results (2026-07-02)

Probe ran **SELECT-only** against `treasury.municipalities`, `treasury.budgets`, and `treasury.data_sources` via a Node script using `@supabase/supabase-js` and the service-role key from the repo-root `.env` (never quoted in this doc). No INSERT/UPDATE/DELETE/RPC executed. Script was ephemeral (run from repo root for `node_modules` resolution, deleted immediately after — not committed, per this plan's declared file scope of `112-RECON.md` only).

#### Utah State Node — Explicit Provenance Check (RECON-10 named overlap-risk state)

| Field | Result |
|-------|--------|
| Node ID | `740cffee-3111-44c0-9473-a77acb6c42f8` |
| Name | Utah |
| `budgets` row count | **2** |
| Fiscal years | 2023, 2024 |
| `dataset_type`s | operating (only — no revenue rows) |
| `data_source` labels | `"NASBO State Expenditure Report — General Fund (FY2023 actual, budgetary basis)"`, `"NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis)"` |
| `data_source_id` | `null` (text-stamp provenance, per P4 policy) |
| `data_sources` table rows | **0** |

**Verdict: the Utah state node holds ONLY Phase-96 NASBO rows — no v2.5-era custom-source residue, no phantom-city-row / display-name artifact on the state node itself.** This is a **clean NASBO-only node**, not a custom-source overlap requiring an in-place upgrade. The standard ACFR-replaces-NASBO plan applies to UT exactly as it does to the other roster states — no MA/CA-style in-place-upgrade complication was found.

**Utah municipal (city/county) data — confirmed distinct and untouched:** A separate probe against `treasury.municipalities` filtered to `state='UT' AND entity_type != 'state'` returns **15 rows** (10 cities + 5 county governments — the full v2.5 Transparent Utah BigQuery cohort). These are **entirely separate municipality rows** from the UT state node (`740cffee...`), linked by `state='UT'` only, not by any FK to the state node. The Phase 113/114 UT ACFR load touches **only** the state node; the 15 municipal rows are unaffected by construction (the loader is scoped to a single `municipality_id`). Confirmed out of scope, confirmed untouched.

#### All 10 Named Candidates — Custom-Source Check

| State | Node ID | `budgets` rows | FYs | `data_source` labels | `data_sources` rows |
|-------|---------|----------------|-----|------------------------|----------------------|
| Arizona | `866036ee-20b2-4e3c-a4f3-5100659edf31` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Indiana | `7eb77ada-b504-4531-98cc-8262cfb22ff5` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Colorado | `89d2aff1-6980-4c20-80fe-513618bce8ac` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Missouri | `21892bb7-1a1d-4038-8665-51c256ab5875` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Kentucky | `6d9dfe88-f908-466c-95d5-66dce0777ee0` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Oregon | `7686da27-5d64-44c2-bae2-f8c85c073e37` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| South Carolina | `f0024b19-1b89-4bdf-af47-d2e28c21278f` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Louisiana | `b7e9e7cd-8b7e-4272-8e42-ef41b293120b` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Oklahoma | `54233a91-919d-4a5f-9f24-2f9325250e64` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Utah | `740cffee-3111-44c0-9473-a77acb6c42f8` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |

**Also probed as a likely substitution candidate (per Section 1's rank-correction flags):**

| State | Node ID | `budgets` rows | FYs | `data_source` labels | `data_sources` rows |
|-------|---------|----------------|-----|------------------------|----------------------|
| Alabama | `bc953061-98de-43ad-878a-c6564bf75dbc` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |

**Exact FY2023/FY2024 NASBO totals confirmed by probe** (for context — these are the rows the Phase 113/114 ACFR loaders will replace per state-FY):

| State | FY2023 operating | FY2024 operating |
|-------|-------------------|--------------------|
| Indiana | $26,397M | $22,405M |
| Arizona | $16,001M | $17,903M |
| Oregon | $13,586M | $16,100M |
| Missouri | $12,526M | $14,561M |
| Colorado | $13,647M | $14,513M |
| South Carolina | $12,089M | $14,189M |
| Kentucky | $14,350M | $14,188M |
| Utah | $11,682M | $13,674M |
| Alabama | $13,764M | $13,511M |
| Louisiana | $11,880M | $11,970M |
| Oklahoma | $7,752M | $9,139M |

**Result: NONE of the 10 named candidates (nor Alabama, the likely substitution candidate) carry any pre-existing custom-source `data_sources` rows or non-NASBO `budgets` rows.** All 11 are clean NASBO-only nodes — 2 rows each (FY2023 + FY2024 operating), `data_source_id = null`, zero `data_sources` table residue. **No in-place-upgrade plan (MA/CA precedent) is required for any of these states** — every state gets the standard ACFR-replaces-NASBO plan (pure supersede at the `(municipality_id, fiscal_year, 'operating')` key; revenue is a pure insert). This is simpler than the Phase 107 tranche, which needed a (still-simple) in-place-upgrade confirmation for MA and a supersede-plan confirmation for GA — here, every state probed is uniformly clean.

**Nothing found that fails to fit the standard in-place/supersede mold** — D-03's "flag as load-phase decision" escape hatch is not needed for the overlap-resolution question itself (the UT Income Tax Fund scope-divergence question from 112-BATCH2-SOURCES.md is a separate, already-flagged D-09 scope/column-selection question, not an overlap/provenance question).

#### The 19 Existing ACFR Nodes — Confirmed Distinct (from the same probe)

| State | Node ID | `budgets` rows |
|-------|---------|----------------|
| MN | `d4b4897d-5bb8-44ce-b7d2-355ca7c5f746` | 36 |
| OH | `7b2f8ddc-5d88-4f44-8d1e-52e02c0d0205` | 12 |
| VA | `c9b21975-bcc2-41d8-9dd8-fd9dcde32506` | 8 |
| CA | `e1007bf5-bac9-4b1c-878e-f6834885f850` | 36 |
| TX | `dc93d846-ef3e-4a41-b58f-06be2d1ab40a` | 20 |
| NY | `1a7f871c-7f2e-4786-9c55-5ab3409716f4` | 44 |
| FL | `adb19ea0-de7c-4cd5-9445-cbf2108a8a1a` | 8 |
| PA | `d4a4aadc-f91e-45e4-852f-2cf21e177de5` | 20 |
| IL | `ac8b3dee-b431-48d0-9f59-deea46c85948` | 10 |
| NJ | `91f310a1-bec9-404a-9825-82b1106c911f` | 12 |
| MA | `fd6b008f-4d35-4665-8c6a-0429de5a4e1f` | 38 |
| NC | `dd5281e8-6988-4f42-b83c-4fed43c7ada4` | 28 |
| GA | `6eb7dd4a-4dcf-4dcc-898f-45af9a3e20c3` | 10 |
| MD | `8e597f8f-c696-47c0-9001-ed78a54f2228` | 8 |
| TN | `f96037ba-af9e-406d-a98f-8c5e2fd299d6` | 34 |
| CT | `d01de53e-d687-4825-bfe2-09f7694c28d6` | 46 |
| WI | `15fe5240-19d9-4fef-b785-d624b0a39a2a` | 48 |
| WA | `d8257751-45c4-4853-9621-e1841e7d4998` | 12 |
| MI | `38c9f1ff-130e-423d-955a-6f0aa5aecae2` | 14 |

**19 nodes confirmed present, all entirely distinct from the 10 named-candidate nodes and the Alabama substitution-candidate node** (no ID collisions — verified by direct comparison of the UUID lists).

---

## Section 6 — Consolidated Risk-Fact Table (D-08)

*Placeholder — filled in plan 112-03 Task 3 after the substitution round (Task 2) is resolved. Will consolidate: Units | Negative GF line items | Exact column header + statement | FY-end month, per locked-roster state — mirrors 107-RECON.md Section 3.*

---

## Section 7 — Gap-Log Rollup

*Placeholder — filled in plan 112-03 Task 3, consolidating the per-state gap logs recorded in 112-BATCH1-SOURCES.md (112-01) and 112-BATCH2-SOURCES.md (112-02), plus any substitution-round gap log from Task 2.*

---

## Section 8 — Untouched-Nodes Contract (RECON-10, carried from 107-RECON.md RECON-08 mold)

The existing **19 ACFR nodes** (MN, OH, VA, CA, TX, NY, FL, PA, IL, NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI) are **not disturbed** by this recon or by the Phase 113/114 loads it feeds — **confirmed via the read-only DB probe above** (Section 5): all 19 node UUIDs enumerated and confirmed distinct from every named-candidate and substitution-candidate node. Phases 113/114 touch only the locked roster's state nodes (roster to be finalized in 112-03 Task 3 via the substitution round in Task 2). `scripts/loadStateGF.mjs` stays the NASBO fallback for all un-upgraded states and is not modified.

---

## Success-Criteria Coverage (partial — 112-01, 112-02, and 112-03 Tasks 1-2 complete)

- [x] 31-state NASBO-2025-SER GF ranking table filled, sorted descending, 31 rows, none of the 19 ACFR states present.
- [x] Candidate/rank-correction marks recorded (AL/HI/NM/KS flagged; OK identified as weakest candidate).
- [x] Full spot-check (all 31, not just top ~12) against the NASBO 2025 SER PDF Table 1 — 0 transcription drift.
- [x] Substitution round run exactly once (D-01): **DONE.** OK → AL, reason = rank correction, full recon block for AL completed (bookend-tied $0 diff both years, four risk facts pinned, recency floor GREENLIGHT, scope-vs-NASBO flagged, loader template mapped, gap log recorded); OK's own recon preserved and carried to ACFRX-03; no second reach-down (HI/NM/KS reviewed, not needed).
- [ ] Roster locked (112-03 Task 3 — final roster now known: IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA; formal lock table pending).
- [ ] Batch split locked (112-03 Task 3).
- [x] Overlap resolution — UT provenance check: **DONE.** Clean NASBO-only node, no custom-source residue; UT municipal data confirmed distinct and untouched (15 non-state UT entities).
- [x] Overlap resolution — all 10 named candidates + the Alabama substitute probed: **DONE.** All 11 are clean NASBO-only nodes, zero `data_sources` residue.
- [x] 19-ACFR-nodes-untouched contract confirmed via read-only probe (UUIDs enumerated, distinct from all candidate nodes).
- [ ] Consolidated risk-fact table + gap-log rollup (112-03 Task 3 — AL's individual risk facts and gap log already captured in Section 2 above, pending consolidation into Sections 6/7).
