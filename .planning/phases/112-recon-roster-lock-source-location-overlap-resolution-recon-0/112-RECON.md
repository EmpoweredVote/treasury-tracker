# Phase 112 RECON — ACFR Roster Lock + Source Location + Overlap Resolution

**Status:** COMPLETE — 112-01 (Ranking + Batch-1 source location: AZ/IN/CO/MO/KY), 112-02 (Batch-2 source location: OR/SC/LA/OK/UT), and 112-03 (substitution round + roster lock + batch split + overlap resolution + consolidated handoff) all done. Decision-ready handoff for Phases 113/114.
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**Requirements:** RECON-09 (ranking + roster lock + source location), RECON-10 (overlap resolution)
**Method:** `pdftotext -table` on the NASBO 2025 SER PDF + official state ACFR PDFs via `curl`. Read-only SELECT probes against production Supabase (`treasury.municipalities`, `treasury.budgets`, `treasury.data_sources`). $0 spend. **No DB writes anywhere in this phase.**
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
| 9 | **Alabama (AL)** | $13,511M | Not a named candidate — **SUBSTITUTED IN by 112-03** | Rank-correction flag resolved in 112-03 (Section 2 below): AL outranks both LA (#10) and OK (#14). AL is substituted in for Oklahoma, the weakest named candidate. Full recon block below. |
| 10 | Louisiana (LA) | $11,970M | **Candidate** | Actual #10 — matches proposed #8 (off by 2 slots, still IN roster). |
| 11 | Hawaii (HI) | $11,222M | Not a candidate | Rank-correction flag (outranks OK #14) — reviewed in 112-03, NOT substituted (AL alone satisfies D-01's one-substitution-round rule; HI is not needed since AL already resolves the single vacancy). |
| 12 | New Mexico (NM) | $9,975M | Not a candidate | Rank-correction flag (outranks OK #14) — reviewed, not substituted (same reasoning as HI). |
| 13 | Kansas (KS) | $9,365M | Not a candidate | Rank-correction flag (outranks OK #14) — reviewed, not substituted (same reasoning as HI). |
| 14 | **Oklahoma (OK)** | $9,139M | Named candidate — **SUBSTITUTED OUT by 112-03** | Weakest of the 10 named candidates; actual rank 14, well outside the true top 10 (AL/HI/NM/KS all outrank it). Cleanly `pdftotext -table`-extracted and passed the D-07 recency floor in 112-02 (not a failed-extraction case) — substituted per the **rank-correction** clause of D-01, not extraction failure. Deferred to ACFRX-03 (final tranche). Full detail in Section 2 below. |
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

### Confirm-or-Correct Verdict (D-01 — resolved in 112-03)

- **Within the 10 named candidates:** the size order is CORRECTED from the proposed `AZ > IN > CO > MO > KY > OR > SC > LA > OK > UT` to the actual `IN > AZ > OR > MO > CO > SC > KY > UT > LA > OK`. This does not change roster membership for the 9 candidates other than OK.
- **Rank-correction flags (states outside the 10 that outrank a candidate):** **AL** (rank 9, outranks LA #10 and OK #14), **HI** (rank 11), **NM** (rank 12), **KS** (rank 13) all outrank OK (#14). **Resolved in 112-03 Section 2:** AL is substituted in for OK — one substitution round only (D-01), the count does not float further; HI/NM/KS are reviewed but not needed since AL alone fills the single vacancy.
- **Final locked roster (post-substitution, 10 states):** IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA — this is now exactly the "true top 10" by NASBO 2025 SER GF size among the 31 remaining states. OK exits to ACFRX-03.

---

## Section 2 — Substitution Round (D-01, RECON-09)

**Trigger check (per 112-03-PLAN.md task instructions):** collect every candidate marked SUBSTITUTION CANDIDATE by 112-01/112-02 (failed clean `pdftotext -table` extraction or failed the D-07 recency floor) plus any rank-correction flag (a non-candidate state ranking above a candidate).

- **SUBSTITUTION CANDIDATE marks:** **NONE.** A literal-string check of 112-BATCH1-SOURCES.md and 112-BATCH2-SOURCES.md confirms no state carries the `SUBSTITUTION CANDIDATE` marker — all 10 named candidates cleanly `pdftotext -table`-extracted and passed the D-07 recency floor (Section 5 of each SOURCES doc: all 10 states GREENLIGHT). AZ carries a **load-phase blocker/decision flag** (its FY2024 ACFR is currently hosted only via a non-durable Google Drive link, failing D-06) but this is explicitly NOT an extraction or recency-floor failure — AZ's FY2024 numbers extracted cleanly and tied to $0 diff. AZ stays IN the roster; the URL-durability question is flagged for Phase 113 to resolve at load time (see Section 6 gap log and Section 7 open risks).
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

**Overlap probe (RECON-10, same method as Section 5 below):** AL state node confirmed via read-only SELECT — `bc953061-98de-43ad-878a-c6564bf75dbc`, exactly 2 budgets rows (FY2023 $13,764M, FY2024 $13,511M NASBO operating, `data_source_id = null`, text-stamp provenance), **zero `data_sources` table rows**. Clean NASBO-only node — no pre-existing custom-source overlap, no in-place-upgrade complication. Standard ACFR-replaces-NASBO plan applies (same as the other 9 roster states).

---

## Section 3 — Roster Lock (RECON-09, D-01/D-02)

### Roster Decision Criteria (per 107 precedent, carried by D-05..D-12)

A state is **IN** if it:
1. Cleanly `pdftotext -table`-extracts (the GF column reads without column-alignment errors), AND
2. Passes the D-07 recency floor (FY2023 + FY2024 covered by a durable-URL clean window).

Substitution rule (D-01, this milestone only): a candidate that fails either criterion, or is rank-corrected by Section 1's re-ranking, may be substituted with the next-largest un-upgraded NASBO state — one substitution round only (resolved in Section 2 above: OK → AL).

### Roster Lock Table (final 10, post-substitution)

| State | Verdict | Clean window | Recency floor | Reason if deferred/substituted |
|-------|---------|--------------|----------------|----------------------------------|
| **IN** | **IN** | FY2002–FY2025 (24 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. Cleanest state in the tranche — no CDN issues, smallest NASBO scope divergence (~0.99×). GREENLIGHT. |
| **AZ** | **IN** | FY2002–FY2024 (FY2025 not yet published) | FY2023 ✅ FY2024 ✅ (numerically) | Bookend-tied $0 diff. **CONDITIONAL** — FY2024 PDF currently reachable only via a non-durable Google Drive link (D-06 concern); flagged as a Phase-113 load-time blocker/decision, does not disqualify AZ from the roster (numbers tie exactly). Cloudflare WAF friction noted. |
| **OR** | **IN** | FY2022–FY2025 (4 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied ($0 / $1K rounding). Shallow window permitted by D-12; older years 404 live (site cleanup, not a soft-404). GREENLIGHT. |
| **MO** | **IN** | FY2012–FY2025 (14 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. No CDN issues. GREENLIGHT. |
| **CO** | **IN** | FY2023–FY2025 (3 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. Shallow window (D-12 permits); TABOR Excess Revenue negative line requires P2 clamp. GREENLIGHT. |
| **SC** | **IN** | FY1993–FY2025 (33 years, deepest in tranche) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. FY2025 statement lives in a specific part-PDF (not the combined file). GREENLIGHT. |
| **KY** | **IN** | FY2002–FY2025 (24 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. Second-smallest NASBO scope divergence (~1.09×). Local TLS workaround noted (environment-only). GREENLIGHT. |
| **UT** | **IN** | FY2019–FY2025 (7 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. **UNIQUE:** ACFR GF narrower than NASBO GF (~0.83×) — Income Tax Fund earmark, flagged as load-phase decision. GREENLIGHT. State-node overlap explicitly resolved (Section 5). |
| **AL** | **IN** (substitute for OK) | FY2002–FY2025 (24 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff (this plan, Section 2). **UNIQUE:** ACFR GF far narrower than NASBO GF (~0.24×) — Alabama's constitutional dual-budget (GF vs Education Trust Fund) system; combined ≈1.04× NASBO. Flagged as load-phase decision. GREENLIGHT. |
| **LA** | **IN** | FY2002–FY2025 (24 years) | FY2023 ✅ FY2024 ✅ | Bookend-tied $0 diff. **CRITICAL:** GF is ~99% federal Intergovernmental Revenue; state tax revenue sits in a separate Bond Security & Redemption Fund — flag prominently at load. GREENLIGHT. |
| **OK** | **DEFERRED → ACFRX-03** | FY2002–FY2024 (recon complete, preserved) | FY2023 ✅ FY2024 ✅ (recon was clean) | **Rank-corrected out** — actual NASBO rank 14 of 31, four non-candidate states (AL/HI/NM/KS) outrank it. Not an extraction/recency failure. Full recon block preserved in 112-BATCH2-SOURCES.md for future reference. |

**All 10 final-roster states IN. 0 deferred among the locked roster (OK exits per rank-correction, replaced 1-for-1 by AL).**

D-01 check: 1 rank-correction substitution executed (OK → AL), one round only, no second reach-down (HI/NM/KS reviewed but not needed).
D-02 check: no minimum depth beyond the recency floor — CO's 3-year and OR's 4-year windows are both IN.

---

## Section 4 — Batch Split (D-02)

Locked by GF size, largest-first, from the **corrected** ranking (Section 1) with AL substituted in for OK. The final size order among the locked 10 is now identical to the "true top 10" derived independently in Section 1's ranking table.

| Batch | Phase | ACFR-2x slots | States (largest-GF-first) | Rationale |
|-------|-------|---------------|----------------------------|-----------|
| **Batch 1** | Phase 113 | **ACFR-21..25** | **Indiana ($22,405M), Arizona ($17,903M), Oregon ($16,100M), Missouri ($14,561M), Colorado ($14,513M)** | Largest five of the corrected roster. |
| **Batch 2** | Phase 114 | **ACFR-26..30** | **South Carolina ($14,189M), Kentucky ($14,188M), Utah ($13,674M), Alabama ($13,511M), Louisiana ($11,970M)** | Remaining five, includes the UT overlap-resolution state and the AL substitution. |

### ACFR-2x ↔ State Traceability Mapping (locked)

| ACFR-2x | State | vs. REQUIREMENTS.md proposed mapping |
|---------|-------|----------------------------------------|
| ACFR-21 | Indiana | Was proposed as "Arizona" — **reassigned** (size-order correction) |
| ACFR-22 | Arizona | Was proposed as "Indiana" — **reassigned** |
| ACFR-23 | Oregon | Was proposed as "Colorado" — **reassigned** (OR moves from the proposed Batch-2 slot into Batch-1) |
| ACFR-24 | Missouri | Matches proposed mapping |
| ACFR-25 | Colorado | Was proposed as "Kentucky" — **reassigned** (KY moves into Batch-2) |
| ACFR-26 | South Carolina | Matches proposed mapping |
| ACFR-27 | Kentucky | Was proposed as "South Carolina" — **reassigned** |
| ACFR-28 | Utah | Was proposed as "Louisiana" — **reassigned** |
| ACFR-29 | **Alabama** | Was proposed as "Oklahoma" — **substituted** per Section 2 (rank correction). Oklahoma exits to ACFRX-03. |
| ACFR-30 | Louisiana | Was proposed as "Utah" — **reassigned** |

**Note for Phase 113/114 kickoff:** REQUIREMENTS.md's literal `ACFR-21..30: {state}` text still shows the pre-recon proposed mapping (matching the original REQUIREMENTS.md order: AZ/IN/CO/MO/KY/OR/SC/LA/OK/UT). This recon **locks** the corrected mapping above as the authoritative input contract for the load phases; a small REQUIREMENTS.md text sync (updating the 10 state labels + traceability table to match this locked mapping) is recommended at Phase 113 kickoff. This plan's declared file scope is `112-RECON.md` only, so the REQUIREMENTS.md text itself is not edited here — this table is the authoritative source Phase 113/114 must read.

Both batches fully populated at 5/5. No rebalancing needed beyond the 1-for-1 OK→AL substitution.

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

**Verdict: the Utah state node holds ONLY Phase-96 NASBO rows — no v2.5-era custom-source residue, no phantom-city-row / display-name artifact on the state node itself.** This is a **clean NASBO-only node**, not a custom-source overlap requiring an in-place upgrade. The standard ACFR-replaces-NASBO plan applies to UT exactly as it does to the other 9 roster states — no MA/CA-style in-place-upgrade complication was found.

**Utah municipal (city/county) data — confirmed distinct and untouched:** A separate probe against `treasury.municipalities` filtered to `state='UT' AND entity_type != 'state'` returns **15 rows** (10 cities + 5 county governments — the full v2.5 Transparent Utah BigQuery cohort). These are **entirely separate municipality rows** from the UT state node (`740cffee...`), linked by `state='UT'` only, not by any FK to the state node. The Phase 113/114 UT ACFR load touches **only** the state node; the 15 municipal rows are unaffected by construction (the loader is scoped to a single `municipality_id`). Confirmed out of scope, confirmed untouched.

#### All 10 Roster States + the Alabama Substitute — Custom-Source Check

| State | Node ID | `budgets` rows | FYs | `data_source` labels | `data_sources` rows |
|-------|---------|----------------|-----|------------------------|----------------------|
| Indiana | `7eb77ada-b504-4531-98cc-8262cfb22ff5` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Arizona | `866036ee-20b2-4e3c-a4f3-5100659edf31` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Oregon | `7686da27-5d64-44c2-bae2-f8c85c073e37` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Missouri | `21892bb7-1a1d-4038-8665-51c256ab5875` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Colorado | `89d2aff1-6980-4c20-80fe-513618bce8ac` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| South Carolina | `f0024b19-1b89-4bdf-af47-d2e28c21278f` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Kentucky | `6d9dfe88-f908-466c-95d5-66dce0777ee0` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Utah | `740cffee-3111-44c0-9473-a77acb6c42f8` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Alabama (substitute) | `bc953061-98de-43ad-878a-c6564bf75dbc` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Louisiana | `b7e9e7cd-8b7e-4272-8e42-ef41b293120b` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |
| Oklahoma (deferred, ACFRX-03) | `54233a91-919d-4a5f-9f24-2f9325250e64` | 2 | 2023, 2024 | NASBO text-stamp (both years) | 0 |

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
| Oklahoma (deferred) | $7,752M | $9,139M |

**Result: NONE of the 10 final-roster states (nor the deferred OK) carry any pre-existing custom-source `data_sources` rows or non-NASBO `budgets` rows.** All 11 are clean NASBO-only nodes — 2 rows each (FY2023 + FY2024 operating), `data_source_id = null`, zero `data_sources` table residue. **No in-place-upgrade plan (MA/CA precedent) is required for any roster state** — every state gets the standard ACFR-replaces-NASBO plan (pure supersede at the `(municipality_id, fiscal_year, 'operating')` key; revenue is a pure insert). This is simpler than the Phase 107 tranche, which needed a (still-simple) in-place-upgrade confirmation for MA and a supersede-plan confirmation for GA — here, every state is uniformly clean.

**Nothing found that fails to fit the standard in-place/supersede mold** — D-03's "flag as load-phase decision" escape hatch is not needed for the overlap-resolution question itself. (Separately, the UT Income Tax Fund and AL Education Trust Fund scope-divergence questions in Sections 2/6 ARE flagged as load-phase decisions per D-09 — but those are scope/column-selection questions, not overlap/provenance questions.)

---

## Section 6 — Consolidated Risk-Fact Table (D-08)

| Fact | IN | AZ | OR | MO | CO | SC | KY | UT | AL | LA |
|------|----|----|----|----|----|----|----|----|----|-----|
| **Units** | Thousands | Thousands | Thousands | Thousands | Thousands | Thousands | Thousands | Thousands | Thousands | Thousands |
| **Negative GF line items (bookend years)** | None observed; "Investment income (loss)" label implies possible in other years — check all years at load. | None observed FY2002/FY2024. | None observed FY2022/FY2025. | None observed; MO Road Fund column went negative once, not GF. | **CAUTION: FY2024 TABOR Excess Revenue = −$1,214,908K** (P2 clamp required; presentation varies by year — check both standalone-line and netted-into-tax-revenue forms). | None observed FY2002/FY2025; FY2002 ending fund balance was a deficit (structural, not a P2 issue). | None observed FY2002/FY2024. | None observed FY2019/FY2025; "(Loss)" column-header label implies possible in other years. | None observed FY2002/FY2024. | None observed FY2002/FY2025 in the GF column (a nonmajor LEQT Fund column went negative once, not GF). |
| **Exact column header + statement** | "General Fund" (1st of 6+), *Statement of Rev/Exp/Changes — Governmental Funds* | "General Fund" (1st of 5) | "General" (1st of 6) | "General Fund" (1st of 6) | "General Funds" (plural; 1st of 4) | "General Fund" (1st of 5) | "General" (1st of 7) | "General Fund" (1st of 6) | "General Fund" (1st of 7-8; lineup shifts by era, GF stays column 1) | "GENERAL FUND" (1st of 4-5) |
| **FY-end month** | June 30 | June 30 | June 30 | June 30 | June 30 | June 30 | June 30 | June 30 | **September 30** (unique in this tranche, matches existing `loadStateGF.mjs` FY_END_MMDD.AL entry) | June 30 |

All ten confirmed on the correct **Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds** (GAAP), explicitly distinguished from each state's adjacent Statement-of-Activities reconciliation schedule (CO and MO both had this schedule immediately following the target statement and initially required care to avoid).

---

## Section 7 — Gap-Log Rollup

Consolidated from 112-BATCH1-SOURCES.md (112-01), 112-BATCH2-SOURCES.md (112-02), and the Alabama substitution recon (Section 2 above). None of these gaps prevent a state from being IN the final roster or passing the recency floor.

| State | FY / Period | Gap reason | Disposition |
|-------|-------------|-----------|-------------|
| IN | None found | Archive exceptionally complete (FY2001–FY2025, all direct URLs, no CDN issues). | No gap. |
| AZ | FY2024 URL durability | Current FY2024 ACFR hosted ONLY on Google Drive, not on the normal `gao.az.gov/sites/default/files/` path every other year uses. Fails D-06 as currently published. | **Load-phase blocker/decision (D-07 escalation)** — flagged for Phase 113, not a gap-log exclusion (numbers tie exactly). |
| AZ | `gao.az.gov` Cloudflare WAF | Both HTML and PDF assets behind a bot-management challenge; intermittent 403s on plain `curl`. | Not a hard blocker (ca-acfr-reconciliation.md precedent) — budget for retry-with-session or browser-download fallback at load time. |
| OR | FY2005–FY2021 | Filenames known via Wayback CDX but 404 live today (site cleanup, not soft-404). | Excluded per D-06 (non-durable). Recency floor already satisfied by FY2022–FY2025. |
| MO | Pre-FY2012 | Current listing page only enumerates node pages back to FY2012. | Gap logged; 14-year window (FY2012–2025) more than sufficient. |
| CO | Pre-FY2023 | No ACFR PDFs found under current `osc.colorado.gov` domain for FY2022 and older (likely site/domain migration). | Gap logged; FY2023–FY2025 (3 years) satisfies D-07; D-12 permits shallow windows. |
| SC | FY2025 statement location | FY2025 ACFR split into 9 part-PDFs; target statement lives in the `BasicFinancialStatements` part, not a combined file. | Not a gap — confirmed durable; loader must target the correct part-file. |
| KY | None found | Archive exceptionally complete (FY2001–FY2025). Local TLS workaround (`-k`) needed in this environment only, not a site issue. | No content gap; environment-only note for Phase 113/114. |
| UT | Pre-FY2019 | Pre-2019 filenames exist historically (Wayback) but 404 live post-WordPress-migration. | Excluded per D-06. Recency floor satisfied by FY2019–FY2025. |
| UT | Fund-name change (Education → Income Tax) | 2nd major fund column relabeled FY2019 "Education" → FY2025 "Income Tax" (2020 constitutional amendment), same fund. | Not a gap — loader must match by column position, not header string, across years. |
| AL | Pre-FY2000 | Not pursued — FY2002 is the declared pre-GASB-34 boundary for this milestone (D-12); in-scope boundary honored. | Not a gap. |
| AL | Filename convention (12+ variants across FY2000–2025) | No single derivable pattern (case, punctuation, and infix vary by era). | Not a gap — every year confirmed live from the one landing page; requires an explicit per-year SOURCES map (same class as OK/OR/UT/CO). |
| AL | Major-fund lineup shift | "Public Road and Bridge Fund" (FY2002-era) replaced by "ARPA Coronavirus State Fiscal Recovery Fund" (FY2021–2024) as the 5th major-fund column; GF stays column 1 throughout. | Not a gap — documented risk fact for the loader's column-position matching. |
| LA | Pre-FY2002 | Archive lists years back to FY1994; not tie-confirmed here per D-05 (bookend = oldest+latest only) and out of scope per the FY2002 boundary (Phase 115 territory). | Noted in passing per `<deferred>` guidance, not a 112 gap-log failure. |
| OK (deferred to ACFRX-03) | FY2024 naming break, FY2011 filename typo, FY2025 not yet published | See 112-BATCH2-SOURCES.md Section 6 for full detail — recon preserved for future use. | Not applicable to the locked roster; carried forward with OK's deferred recon block. |

---

## Section 8 — Untouched-Nodes Contract (RECON-10, carried from 107-RECON.md's RECON-08 mold)

### Existing 19 ACFR Nodes (confirmed from read-only DB probe, 2026-07-02)

| State | Node ID | Current ACFR FY window | `budgets` rows | `dataset_types` |
|-------|---------|--------------------------|------------------|--------------------|
| MN | `d4b4897d-5bb8-44ce-b7d2-355ca7c5f746` | FY2008–FY2025 | 36 | operating + revenue |
| OH | `7b2f8ddc-5d88-4f44-8d1e-52e02c0d0205` | FY2020–FY2025 | 12 | operating + revenue |
| VA | `c9b21975-bcc2-41d8-9dd8-fd9dcde32506` | FY2022–FY2025 | 8 | operating + revenue |
| CA | `e1007bf5-bac9-4b1c-878e-f6834885f850` | FY2008–FY2025 | 36 | operating + revenue |
| TX | `dc93d846-ef3e-4a41-b58f-06be2d1ab40a` | FY2015–FY2024 | 20 | operating + revenue |
| NY | `1a7f871c-7f2e-4786-9c55-5ab3409716f4` | FY2003–FY2024 | 44 | operating + revenue |
| FL | `adb19ea0-de7c-4cd5-9445-cbf2108a8a1a` | FY2021–FY2024 | 8 | operating + revenue |
| PA | `d4a4aadc-f91e-45e4-852f-2cf21e177de5` | FY2016–FY2025 | 20 | operating + revenue |
| IL | `ac8b3dee-b431-48d0-9f59-deea46c85948` | FY2021–FY2025 | 10 | operating + revenue |
| NJ | `91f310a1-bec9-404a-9825-82b1106c911f` | FY2020–FY2025 | 12 | operating + revenue |
| MA | `fd6b008f-4d35-4665-8c6a-0429de5a4e1f` | FY2003–FY2025 (non-contiguous) | 38 | operating + revenue |
| NC | `dd5281e8-6988-4f42-b83c-4fed43c7ada4` | FY2012–FY2025 | 28 | operating + revenue |
| GA | `6eb7dd4a-4dcf-4dcc-898f-45af9a3e20c3` | FY2021–FY2025 | 10 | operating + revenue |
| MD | `8e597f8f-c696-47c0-9001-ed78a54f2228` | FY2022–FY2025 | 8 | operating + revenue |
| TN | `f96037ba-af9e-406d-a98f-8c5e2fd299d6` | FY2009–FY2025 | 34 | operating + revenue |
| CT | `d01de53e-d687-4825-bfe2-09f7694c28d6` | FY2002–FY2025 (non-contiguous) | 46 | operating + revenue |
| WI | `15fe5240-19d9-4fef-b785-d624b0a39a2a` | FY2002–FY2025 | 48 | operating + revenue |
| WA | `d8257751-45c4-4853-9621-e1841e7d4998` | FY2020–FY2025 | 12 | operating + revenue |
| MI | `38c9f1ff-130e-423d-955a-6f0aa5aecae2` | FY2019–FY2025 | 14 | operating + revenue |

**19 nodes confirmed, all entirely distinct from the 10 locked-roster nodes and the AL substitute / OK-deferred nodes** (no ID collisions — verified by direct comparison of the UUID lists).

### The Contract

> **Phases 113 and 114 touch ONLY the 10 locked-roster state nodes** (Batch 1 / Phase 113: Indiana, Arizona, Oregon, Missouri, Colorado; Batch 2 / Phase 114: South Carolina, Kentucky, Utah, Alabama, Louisiana). The **19 existing ACFR nodes** (MN/OH/VA/CA/TX/NY/FL/PA/IL/NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI) and **all remaining un-upgraded NASBO states** (including the deferred Oklahoma, now carried to ACFRX-03, and the ~20 other NASBO states not in this tranche) are **undisturbed** — no writes, no deletes, no schema changes. The per-state ACFR loaders (new `process{IN,AZ,OR,MO,CO,SC,KY,UT,AL,LA}{,Revenue}Acfr.js` scripts, cloned from the `processILAcfr.js`/`processPAAcfr.js` families per the loader-template mapping in each SOURCES doc) are scoped to their own state node by `municipality_id`; they cannot affect other state nodes. `scripts/loadStateGF.mjs` stays the NASBO fallback for all un-upgraded states and is **not modified** by this recon or the loads it feeds. This contract is noted here; it is executed (enforced) by the loaders themselves in Phases 113/114 — every loader inherits the Phase-111 (LOAD-01) ephemeral `data_sources` lifecycle confirmed in `111-VERIFICATION.md`.

### NASBO-Replace Rule (mirrors 107-RECON.md's RECON-08, confirmed clean for all 10 states — no in-place-upgrade complication)

1. **Operating replacement:** each ACFR operating loader writes `dataset_type='operating'` keyed on `(muni_id, fy, 'operating')`. The never-overwrite guard checks for existing ACFR provenance first; since every roster state's existing rows carry NASBO provenance only (confirmed by Section 5's probe), they are replaced cleanly by the ACFR GAAP rows for the FYs the ACFR window covers. Idempotent.
2. **Revenue is a pure insert:** `dataset_type='revenue'` is new on all 10 roster nodes (no NASBO revenue exists for any state — NASBO has no per-state revenue-by-source table). Pure insert — auto-enables the "Money In" view.
3. **Idempotent:** a re-run of any Phase-113/114 loader produces 0 net new rows (per the Phase-111 LOAD-01 ephemeral lifecycle).
4. **Scoped to roster states only:** each per-state loader targets its own `municipality_id`; cannot affect other state nodes.
5. **Un-upgraded NASBO states stay on `loadStateGF.mjs`:** not modified. Oklahoma (deferred to ACFRX-03) and the ~20 other remaining NASBO states are untouched.
6. **The 19 existing ACFR nodes are untouched:** confirmed distinct UUIDs, no collision risk (Section 8 table above).
7. **No stale metadata cleanup needed for any roster state:** the Section 5 probe confirmed zero `data_sources` rows on every roster state node (including the AL substitute and the deferred OK). No equivalent of the Phase-99 CA/TX/NY/FL stale-`data_sources` delete step, and no equivalent of an MA-style in-place-upgrade cleanup, is needed anywhere in this tranche.

---

## Open Risks for Phases 113/114

### Scope-Relabel Confirmations (D-09)

| State | Ratio | Driver | Load-time confirmation needed |
|-------|-------|--------|-------------------------------|
| AZ | ~2.46× | Federal Medicaid/education passthrough consolidated into GAAP GF | Accept-and-relabel honestly |
| CO | ~1.81× | Federal Grants and Contracts inside GF | Accept-and-relabel honestly; also see TABOR P2 clamp below |
| MO | ~2.25× | Contributions and Intergovernmental inside GF | Accept-and-relabel honestly |
| SC | ~1.46× | GAAP-vs-budgetary basis difference (not federal passthrough — unusual driver) | Accept-and-relabel honestly; document the differing driver mechanism |
| LA | ~1.90× | **GF is ~99% federal Intergovernmental Revenue**; state taxes booked to a separate Bond Security & Redemption Fund | Flag prominently; whether to load GF alone or GF+Bond Security combined is a load-phase decision (not resolved here) |
| IN | ~0.99× | Medicaid reported in a separate major fund — smallest divergence in the tranche | Low relabel risk; still confirm at load |
| KY | ~1.09× | Federal reported in a separate major fund — second-smallest divergence | Low relabel risk; still confirm at load |
| OR | ~1.07× | Modest; most federal flows route through non-GF fund columns | Low relabel risk |
| UT | **~0.83× (narrower)** | Income Tax Fund constitutionally earmarked, reported separately from GF | **Load-phase decision:** GF alone vs GF+Income Tax Fund combined — not resolved here |
| AL | **~0.24× (narrower, unique — narrowest in tranche)** | Constitutional dual-budget: GF vs Education Trust Fund reported as separate major funds; combined ≈1.04× NASBO | **Load-phase decision:** GF alone vs GF+Education Trust Fund combined — not resolved here |

### P2 Clamp Anticipations (D-08.2)

| State | FY at risk | Issue | Action |
|-------|-----------|-------|--------|
| CO | FY2024 (and check every year) | TABOR Excess Revenue = −$1,214,908K, a standalone negative line in some years and netted into tax revenue in others | Check both presentation forms every loaded year |
| IN, UT | Older/other years | Column header literally reads "Investment income (loss)" — implies negatives possible even though bookend years were positive | Check every loaded year |
| MO | MO Road Fund column only (not GF) | Went negative once (−$129,262K, FY2024) in a non-GF column | Low risk for GF; verify at load anyway |
| LA | Nonmajor LEQT Fund column only (not GF) | Went negative once (FY2002) in a non-GF column | Low risk for GF |
| AZ, OR, SC, KY, AL | — | No negative GF-column lines observed in either bookend year | Low risk; check all years at load per standard policy |

### Units / Naming / Access Risks

| State | Risk | Action |
|-------|------|--------|
| AZ | FY2024 non-durable Google Drive URL; Cloudflare WAF on `gao.az.gov` | Resolve durable URL or document the Drive-link caveat explicitly; budget for retry/browser-download fallback |
| CO | Mild WAF requires a `Referer` header on every fetch | Set `Referer` matching the ACFR landing page |
| SC | FY2025 statement lives in a specific `BasicFinancialStatements` part-PDF, not the combined file | SOURCES map must target the correct part-file for FY2025 |
| LA | Hash-based CMS media paths, not derivable from FY alone | Re-enumerate from the landing/archive pages at load time |
| UT | 2nd major-fund column relabeled "Education" (FY2019) → "Income Tax" (FY2025), same fund | Loader must match by column position, not header string |
| AL | 12+ distinct filename conventions across FY2000–2025; major-fund lineup shifts by era (Public Road & Bridge → ARPA SFRF) | Explicit per-year SOURCES map required; match GF by column position (always column 1) |
| KY | Local TLS/cert-chain workaround (`-k`) needed in the recon environment only | Verify whether Node's native `https`/`fetch` needs the same workaround at load time (likely not) |

### Michigan-class Custom-Template Risk

None of the 10 locked-roster states requires a September-30 FY-end **except Alabama** (matches Phase 107's MI precedent exactly — same `fiscal_year_start_month = 10` / `source_date = {FY}-09-30` handling, already anticipated in `scripts/loadStateGF.mjs`'s `FY_END_MMDD` map). All other 9 roster states use the standard June-30 FY-end.

---

## Success-Criteria Coverage

### Phase 112 ROADMAP / RECON-09/RECON-10 Coverage

- [x] 31-state NASBO-2025-SER GF ranking table filled, sorted descending, 31 rows, none of the 19 ACFR states present.
- [x] Candidate/rank-correction marks recorded (AL/HI/NM/KS flagged; OK identified as weakest candidate) — **resolved in 112-03**.
- [x] Full spot-check (all 31, not just top ~12) against the NASBO 2025 SER PDF Table 1 — 0 transcription drift.
- [x] All 10 named candidates + the AL substitute located, GF statement confirmed, bookend tie-confirmed ($0 diff for every state), durable per-year URLs recorded (AZ's FY2024 URL flagged as a load-phase durability decision, not a roster-eligibility failure).
- [x] Substitution round run exactly once (D-01): OK → AL, reason = rank correction, documented with full recon block; OK's own recon preserved and carried to ACFRX-03; no second reach-down (HI/NM/KS reviewed, not needed).
- [x] Roster locked: 10 states (IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA), 0 deferred among the locked roster.
- [x] Batch split locked (D-02): Batch 1/Phase 113 = ACFR-21..25 (IN, AZ, OR, MO, CO); Batch 2/Phase 114 = ACFR-26..30 (SC, KY, UT, AL, LA); full ACFR-2x ↔ state traceability mapping recorded, including the reassignment note for REQUIREMENTS.md sync.
- [x] Overlap resolution — UT state-node provenance explicitly checked via read-only DB probe: clean NASBO-only node, no custom-source residue, UT municipal (city/county) data confirmed distinct and untouched (15 non-state UT entities).
- [x] Overlap resolution — every roster state (+ AL substitute + deferred OK) probed: **all 11 are clean NASBO-only nodes**, zero `data_sources` residue, no in-place-upgrade complication found anywhere in this tranche.
- [x] 19-ACFR-nodes-untouched contract recorded with full node list + confirmed UUIDs, distinct from all roster/substitute/deferred nodes.
- [x] Consolidated risk-fact table (D-08: units, negative GF lines, exact column header+statement, FY-end month) filled for all 10 locked-roster states.
- [x] Gap-log rollup consolidated from both SOURCES docs + the AL substitution recon.
- [x] D-13 caveat stated: recon totals are trusted; Phases 113/114 re-verify statement structure + URLs at load time, with the GF total-tie as the safety net.
- [x] Closeout confirmed: **$0 spend** (pdftotext + curl only, no AI); **zero DB writes** for the entire phase (all probes were read-only SELECT, verified by absence of any `.insert`/`.update`/`.delete`/`.rpc` call in the ephemeral probe script); no NASBO mutations; no loader code written; no frontend changes.

**Phase 112 is COMPLETE. This document is the decision-ready input contract for Phase 113 (Batch 1) and Phase 114 (Batch 2).**
