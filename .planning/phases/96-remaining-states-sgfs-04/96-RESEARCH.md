# Phase 96: Remaining States (SGFS-04) — Research

**Researched:** 2026-06-28
**Domain:** NASBO State Expenditure Report bulk load — 46-state General Fund operating remediation
**Confidence:** HIGH (all primary findings verified directly from the live PDF and live API)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-96-01:** NASBO operating-only for the bulk cohort; revenue deferred. Load NASBO spending-by-function for the ~46 remaining states; do NOT attempt per-state ACFR revenue in this phase.
- **D-96-02:** Multi-year actual window per state — load the ACTUAL years present in the current NASBO SER (estimate/proposed years excluded per P1). Research confirms the exact actual-year set (see §NASBO SER Edition).
- **D-96-03 (KNOWN GAP):** Cohort unsourced revenue estimate rows REMAIN post-phase. Planner/researcher MUST surface whether they render in the app (they do — see §D-96-03 Revenue Display Finding). Resolution required in the plan.
- **D-96-04:** Node removal for "no clean source" is expected moot — NASBO covers all 50 states. Document any blank/unusable cell explicitly rather than leaving an estimate.
- **D-96-05:** Mandatory per-node basis label. data_source = `"NASBO State Expenditure Report — General Fund (FY<y> actual, budgetary basis)"`.
- **D-96-06:** Source-stamp contract: post-RPC targeted UPDATE sets source_url + source_date + data_source; never treasury_sync_city_budget; never budgets.data_source_id; 0-NULL invariant; idempotent.
- **D-96-07:** Actuals-only (P1) + no-fabrication (P5): load only NASBO ACTUAL columns; dual checksum per state-year before load.
- **D-96-08:** Negative-category render rule (P2): clamp render area to 0, retain signed value in label, carry source total verbatim.

### Phase-94 Policy (LOCKED, binding)
- P1: Actuals only. Never load the estimated column.
- P2: Negative category → clamp area to 0 + retain signed value + carry source total.
- P3: Mandatory per-node basis label (NASBO: budgetary basis; MN: GAAP basis).
- P4: 0-NULL source stamp via targeted post-RPC UPDATE. Never treasury_sync_city_budget.
- P5: No fabrication. Skip state-years with no usable figures.
- P6: Idempotent. Re-running changes nothing for already-loaded state-years.

### Claude's Discretion
- How to scale the loader: one parameterized run per state/FY vs cohort driver script — planner's call based on research (see §Loader Scaling).
- Whether to include Georgia FY2024 extension (GA FY2023 done in Phase 94; FY2024 is now actual in the 2025 SER) — research recommendation: include GA FY2024 as a cleanup task within Phase 96 (same loader, same SER, small addition).

### Deferred Ideas (OUT OF SCOPE)
- Revenue-by-source for the cohort (future per-state ACFR upgrades)
- Per-state ACFR operating upgrades for high-traffic states
- Cohort-wide source-chain audit + UAT (Phase 97 / SGFS-05)
- MN FY1997–2007 (Phase 95 deferral)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGFS-04 | Remaining ~46 state nodes remediated — each state's NASBO GF operating actuals loaded (spending-by-function, stamped), or node removed if no clean free source (documented). No unsourced estimate state operating rows remain. | NASBO 2025 SER confirmed all 46 states present with FY2023 + FY2024 actual GF columns. Dual checksum verified on Alabama FY2023 + FY2024 (0 diff). loader scaling path identified. D-96-03 revenue display gap requires suppression plan. |
</phase_requirements>

---

## Summary

Phase 96 bulk-remediates the remaining 46 state General Fund operating nodes by loading NASBO State Expenditure Report actuals via the Phase-94-proven `scripts/loadStateGF.mjs` loader. The current NASBO SER is the **2025 edition**, covering **actual FY2023 + actual FY2024** (plus estimated FY2025 which must NOT be loaded). The 2025 SER PDF was downloaded and tested: `pdftotext -table` extracts Table 1 (GF control totals) and all six per-function tables cleanly — no render-to-image needed. Alabama dual-checksum verified at 0 diff for both FY2023 and FY2024.

**Critical taxonomy change in 2025 SER:** Public Assistance is no longer a separate chapter. It was absorbed into "All Other" starting with the 2025 edition. The 7-function NASBO taxonomy becomes effectively 6 named functions (All Other now silently includes TANF/cash assistance). Despite this structural change, checksums still close to Table 1 GF totals exactly (verified on AL FY2023: 0 diff; FY2024: 0 diff). The loadStateGF.mjs loader must be updated to drop "Public Assistance" as a standalone category and reflect the correct 2025 SER structure.

**D-96-03 finding (BLOCKING):** All 46 cohort states have unsourced revenue estimate rows that ARE currently displayed in the live app (the "Money In" tab renders for every state node, pulling from treasury.budgets). The ground rule "never display unsourced data" requires these rows to be hidden or suppressed even though Phase 96 does not replace them. The plan must include a step to delete or suppress the unsourced revenue rows for the 46-state cohort (the operating estimate rows are overwritten by the NASBO loader, but revenue rows are not touched by this phase).

**Primary recommendation:** Extend loadStateGF.mjs with a `STATES` object covering all 46 cohort states + Georgia FY2024 (GA FY2023 already done), update the NASBO_SER provenance block to point at the 2025 SER PDF, update FY_END_MMDD for NY/TX/AL/MI non-June-30 states, and add a Wave 0 cleanup task that deletes cohort revenue estimate rows before the NASBO load runs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| NASBO SER data extraction | Offline script (pdftotext -table) | Manual verification | No API; PDF-only source; pdftotext -table confirmed working |
| Dual checksum validation | Script (loadStateGF.mjs helpers) | — | validateAgainstControl() already implements this |
| Operating tree write | Database (treasury_sync_budget_tree RPC) | — | Keyed on (muni_id, fy, dataset_type) — upserts in place |
| Source-stamp | Database (targeted budgets UPDATE) | — | P4 contract: RPC does not set source_url/date |
| Revenue row suppression | Database (targeted DELETE) | — | Remove unsourced revenue estimate rows (D-96-03 resolution) |
| App rendering / display | Frontend (App.tsx + DatasetTabs) | ev-accounts-api | available_datasets drives tab visibility; removing DB rows removes the tab |

---

## NASBO SER Edition and URL

**Current edition:** 2025 State Expenditure Report [VERIFIED: fetched PDF header + landing page]

**Actual fiscal years in 2025 SER:**
- Actual FY2023 (column 1) — LOAD
- Actual FY2024 (column 2) — LOAD
- Estimated FY2025 (column 3) — DO NOT LOAD (P1)

**PDF URL (2025 SER):**
```
https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2025_SER/2025_NASBO_State_Expenditure_Report_S.pdf
```
[VERIFIED: downloaded 1,816,139 bytes; header confirms "2025 State Expenditure Report Fiscal Years 2023–2025"]

**Landing page (for source_url linking):**
```
https://www.nasbo.org/reports-data/state-expenditure-report
```

**Current loader (loadStateGF.mjs) NASBO_SER block points at the 2024 SER PDF.** It must be updated to the 2025 SER URL and edition string before the bulk load runs.

**2024 SER (archive — for reference only):**
```
https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2024_SER/2024_State_Expenditure_Report_S.pdf
```
The 2024 SER covered actual FY2022 + actual FY2023 + estimated FY2024. Georgia FY2023 was loaded from this edition. Do not use the 2024 SER for Phase 96; the 2025 SER supersedes it for the load window.

---

## The 46-State Cohort

**Exclusions (already on real actuals):**
- Minnesota (MN) — ACFR GAAP actuals FY2008–FY2025 (Phase 95)
- Ohio (OH) — ACFR GAAP actuals FY2020–FY2025 (Phase 95)
- Virginia (VA) — ACFR GAAP actuals FY2022–FY2025 (Phase 95)
- Georgia (GA) — NASBO FY2023 actual (Phase 94 pilot); FY2024 extension recommended as Phase 96 cleanup

**The 46 cohort states** (all verified present in treasury.municipalities with entity_type='state'): [VERIFIED: live API query]

| Abbr | Name | DB ID | FY End |
|------|------|-------|--------|
| AK | Alaska | b268c415-0058-4fea-8ba1-24f49fb434b4 | Jun 30 |
| AL | Alabama | bc953061-98de-43ad-878a-c6564bf75dbc | **Sep 30** |
| AR | Arkansas | 5efd2f95-6deb-4118-a07a-9f48cdca681c | Jun 30 |
| AZ | Arizona | 866036ee-20b2-4e3c-a4f3-5100659edf31 | Jun 30 |
| CA | California | e1007bf5-bac9-4b1c-878e-f6834885f850 | Jun 30 |
| CO | Colorado | 89d2aff1-6980-4c20-80fe-513618bce8ac | Jun 30 |
| CT | Connecticut | d01de53e-d687-4825-bfe2-09f7694c28d6 | Jun 30 |
| DE | Delaware | a7854fa3-8e68-4a0e-b92a-415bad6bccd2 | Jun 30 |
| FL | Florida | adb19ea0-de7c-4cd5-9445-cbf2108a8a1a | Jun 30 |
| HI | Hawaii | bf5b7221-9c8e-4df7-961d-e9c020ca733e | Jun 30 |
| IA | Iowa | 6e71a93f-a43d-4972-a239-85ddbebe2545 | Jun 30 |
| ID | Idaho | 247ca2d0-44bc-4ef0-bc0d-4875758bae5e | Jun 30 |
| IL | Illinois | ac8b3dee-b431-48d0-9f59-deea46c85948 | Jun 30 |
| IN | Indiana | 7eb77ada-b504-4531-98cc-8262cfb22ff5 | Jun 30 |
| KS | Kansas | bb3dcf05-586c-4e68-85d3-26a6199cc4ab | Jun 30 |
| KY | Kentucky | 6d9dfe88-f908-466c-95d5-66dce0777ee0 | Jun 30 |
| LA | Louisiana | b7e9e7cd-8b7e-4272-8e42-ef41b293120b | Jun 30 |
| MA | Massachusetts | fd6b008f-4d35-4665-8c6a-0429de5a4e1f | Jun 30 |
| MD | Maryland | 8e597f8f-c696-47c0-9001-ed78a54f2228 | Jun 30 |
| ME | Maine | 53f26018-1d20-4f6a-9c0e-400bfb91199a | Jun 30 |
| MI | Michigan | 38c9f1ff-130e-423d-955a-6f0aa5aecae2 | **Sep 30** |
| MO | Missouri | 21892bb7-1a1d-4038-8665-51c256ab5875 | Jun 30 |
| MS | Mississippi | ebec9e07-a79e-44b0-b5d5-2551625d4b8e | Jun 30 |
| MT | Montana | 6e085a8b-97e3-479d-8879-9bb7ff4f9fb1 | Jun 30 |
| NC | North Carolina | dd5281e8-6988-4f42-b83c-4fed43c7ada4 | Jun 30 |
| ND | North Dakota | e84aafe0-eeaa-470a-8fd3-708c88af2a80 | Jun 30 |
| NE | Nebraska | ccfb8751-ae32-4974-96a9-d8c8ea85a898 | Jun 30 |
| NH | New Hampshire | c54f6dbd-3f2a-453e-b0b9-259e377aef67 | Jun 30 |
| NJ | New Jersey | 91f310a1-bec9-404a-9825-82b1106c911f | Jun 30 |
| NM | New Mexico | 1e60ff76-c9fa-48d0-9442-042f61cd40ea | Jun 30 |
| NV | Nevada | d0879e45-0b72-41ee-bdbd-a214a4f2a1d5 | Jun 30 |
| NY | New York | 1a7f871c-7f2e-4786-9c55-5ab3409716f4 | **Mar 31** |
| OK | Oklahoma | 54233a91-919d-4a5f-9f24-2f9325250e64 | Jun 30 |
| OR | Oregon | 7686da27-5d64-44c2-bae2-f8c85c073e37 | Jun 30 |
| PA | Pennsylvania | d4a4aadc-f91e-45e4-852f-2cf21e177de5 | Jun 30 |
| RI | Rhode Island | 483f02b4-2167-4e3d-9f5c-0f3ed83be2e6 | Jun 30 |
| SC | South Carolina | f0024b19-1b89-4bdf-af47-d2e28c21278f | Jun 30 |
| SD | South Dakota | e7273079-b392-449d-af38-d2e4d0df73e0 | Jun 30 |
| TN | Tennessee | f96037ba-af9e-406d-a98f-8c5e2fd299d6 | Jun 30 |
| TX | Texas | dc93d846-ef3e-4a41-b58f-06be2d1ab40a | **Aug 31** |
| UT | Utah | 740cffee-3111-44c0-9473-a77acb6c42f8 | Jun 30 |
| VT | Vermont | 563d6f1c-ce2b-4071-938f-01725d283504 | Jun 30 |
| WA | Washington | d8257751-45c4-4853-9621-e1841e7d4998 | Jun 30 |
| WI | Wisconsin | 15fe5240-19d9-4fef-b785-d624b0a39a2a | Jun 30 |
| WV | West Virginia | e21923d7-ad99-4711-b765-255b9807c059 | Jun 30 |
| WY | Wyoming | 4009951b-8a23-457e-9591-1597356dfe34 | Jun 30 |

**Non-June-30 fiscal year ends** (confirmed from 2025 SER notes, p.1): [VERIFIED: 2025_NASBO_State_Expenditure_Report_S.pdf]
- Alabama (AL): fiscal year Oct 1 → Sep 30 — `source_date = FY-09-30`
- Michigan (MI): fiscal year Oct 1 → Sep 30 — `source_date = FY-09-30`
- Texas (TX): fiscal year Sep 1 → Aug 31 — `source_date = FY-08-31`
- New York (NY): fiscal year Apr 1 → Mar 31 — `source_date = FY-03-31`

**Note on non-round but unsourced states:** CA, NY, TX, MI, PA have non-round GF totals in the current DB — they are still unsourced estimates and are fully included in the 46-state cohort. NASBO SER 2025 has all 46 states present with actual FY2023 and FY2024 data.

**Georgia FY2024 extension:** GA FY2023 was loaded in Phase 94 (from the 2024 SER). FY2024 is now actual in the 2025 SER. CONTEXT.md states the goal is "widen to the available actual window." Recommend including GA FY2024 as a task within Phase 96 (trivial addition to the existing GA STATES entry in loadStateGF.mjs). GA also has FY2022–2026 unsourced operating estimate rows that the RPC will displace; GA FY2025/2026 remain estimates and are deleted by the 0-NULL contract (the loader only touches actual rows it writes).

---

## D-96-03 Revenue Display Finding — BLOCKING

**CONFIRMED: Unsourced revenue rows ARE displayed in the live app.** [VERIFIED: live API + UI inspection]

Evidence:
- Live API `/api/treasury/cities` returns state nodes with `available_datasets` entries for both `operating` and `revenue` dataset types for every cohort state.
- Example (Alabama FY2023): `source_url=null`, `data_source="Alabama General Fund Revenue"`, `total_budget=10500000000` (round number = unsourced estimate). The "Money In" tab renders with this data.
- The frontend (App.tsx) shows a "Money In" tab whenever `available_datasets` contains a `revenue` entry for the selected year — there is no source_url guard in the tab-display path.

**This violates the ground rule "NEVER create or display unsourced data."**

**Resolution (recommended): DELETE the cohort unsourced revenue rows before the NASBO load.**

The NASBO loader (by design) does not touch revenue rows at all. After the NASBO operating load, cohort states will have sourced operating rows but still-present unsourced revenue rows. The cleanest fix is to delete all cohort revenue estimate rows (dataset_type='revenue') for the 46-state cohort before loading begins. This:
1. Removes the tab that shows unsourced data.
2. Matches the honest state: "NASBO nodes carry operating-only; revenue deferred to ACFR upgrade" (P3, 94-01-POLICY.md).
3. Is consistent with how OH/VA FY2026 estimate rows were deleted in Phase 95.

**Implementation:** A pre-load cleanup script (or manual SQL) deletes `treasury.budgets` rows where `municipality_id` IN (the 46 cohort IDs) AND `dataset_type = 'revenue'`. Idempotent (safe to re-run after deletion).

**Alternative (not recommended):** Leave the revenue rows and accept the display. This contradicts D-96-03 and the ground rule. Rejected.

**What is NOT deleted:** The cohort's operating estimate rows are overwritten by the NASBO loader via the treasury_sync_budget_tree RPC (which upserts on muni+fy+dataset_type). The FY2025/2026 unsourced operating estimate rows (not in the NASBO actual window) MUST also be deleted — the loader only writes FY2023 and FY2024, so FY2025/FY2026 operating estimate rows persist as dead weight unless explicitly cleaned up. The plan should include deletion of out-of-window operating estimate rows for each state (same pattern as 95-05 cleanup).

---

## Standard Stack

### Core (all verified present in the codebase)

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `@supabase/supabase-js` | in package.json | DB client for RPC + UPDATE | Already in use; loadStateGF.mjs imports it |
| `pdftotext` (poppler) | 4.00 (verified) | NASBO SER table extraction | Phase-95 proven; `-table` flag works for NASBO per-function tables |
| `node:util parseArgs` | built-in | CLI flag parsing | Already used in loadStateGF.mjs |
| `node:fs readFileSync` | built-in | .env loading | Already used in loadStateGF.mjs |

### No New Packages Required
Phase 96 is entirely within the existing toolchain. No npm installs needed.

---

## Package Legitimacy Audit

No new packages are installed in this phase. The existing `@supabase/supabase-js` is a well-established package (npm registry, 6+ years, millions of weekly downloads). No audit action needed.

---

## Extraction Technique — pdftotext -table CONFIRMED WORKING

**Testing conducted on 2025 NASBO SER PDF (C:/treasury-tracker/cache/nasbo-2025-ser.pdf).** [VERIFIED: direct execution]

`pdftotext -table` produces cleanly aligned tabular output for the 2025 SER. Table 1 (GF control totals) and all per-function tables (T5 El/Sec Ed, T9 Higher Ed, T13 Medicaid, T16 Corrections, T21 Transportation, T26 All Other) all extract with state rows and fund-source columns in alignment.

**Checksum verification on Alabama (sample state):**
```
FY2023: El/Sec $6,300M + Higher Ed $3,037M + Medicaid $813M + Corrections $759M + Transport $0M + All Other $2,855M = $13,764M
Table 1 GF FY2023: $13,764M → DIFF = $0 (0.000%)

FY2024: El/Sec $6,389M + Higher Ed $2,629M + Medicaid $855M + Corrections $846M + Transport $0M + All Other $2,792M = $13,511M
Table 1 GF FY2024: $13,511M → DIFF = $0 (0.000%)
```
[VERIFIED: computed in session]

**pdftotext output line numbers in 2025 SER** (using `-table` flag):

| Table | Function | Approx Line | FY Columns |
|-------|----------|-------------|------------|
| Table 1 | GF Control Totals (all states) | ~1129 | FY2023 actual / FY2024 actual / FY2025 est |
| Table 5 | Elementary & Secondary Education | ~2162 | same structure |
| Table 9 | Higher Education | ~2797 | same structure |
| Table 13 | Medicaid | ~3464 | same structure |
| Table 16 | Corrections | ~4004 | same structure |
| Table 21 | Transportation | ~4754 | same structure |
| Table 26 | All Other (incl. Public Assistance) | ~5714 | same structure |

**Column order per per-function table:**
`State | General Fund | Federal Funds | Other State Funds | Bonds | Total` (FY2023), then same 5 cols for FY2024, then FY2025.

**The General Fund column is the first numeric column for each FY group** — this is the value to extract.

**IMPORTANT: Do NOT use pdftotext without -table.** Default mode collapses blank cells and misaligns columns (the Phase-94 finding). Always use `-table` for NASBO SER tables.

---

## Critical Taxonomy Change: 2025 SER Public Assistance → Merged Into All Other

**The 2025 NASBO SER eliminated the standalone "Public Assistance" chapter.** [VERIFIED: 2025_NASBO_State_Expenditure_Report_S.pdf p.490, p.11181]

NASBO text (p.490): "The 'all other' category also now includes public assistance (both the Temporary Assistance for Needy Families program and other cash assistance programs), which was previously reported on separately in the State Expenditure Report."

**Impact on the loader:**
- The Phase-94 loader `loadStateGF.mjs` has a `Public Assistance` category in STATES.GA.operating. In 2025 SER data, there is no separate Public Assistance table.
- For all 46 cohort states loaded from the 2025 SER, **Public Assistance figures are rolled into All Other** (Table 26). There is no separate value to read.
- **The category taxonomy for 2025 SER data is 6 named functions:** Elementary & Secondary Education, Higher Education, Medicaid, Corrections, Transportation, All Other.
- **Checksums still close exactly** — the 6-function sum ties to Table 1 GF with 0 diff on AL (verified). The math works because All Other now includes what was formerly Public Assistance.

**Loader update required:**
- Remove the `{ name: 'Public Assistance', total: 0 }` entry from the STATES object when populating 2025 SER data.
- For Georgia FY2024 (from 2025 SER), also use the 6-category structure (no Public Assistance).
- Georgia FY2023 (already loaded from 2024 SER) retains its 7-category structure with Public Assistance = $0 — do not modify that existing row.

**Historical note (2024 SER):** The 2024 SER DID have a separate Public Assistance chapter (Table 16 in that edition). For any state-year loaded from the 2024 SER in the future (e.g., backfilling FY2022), the 7-function taxonomy applies. Phase 96 loads only from the 2025 SER (FY2023 + FY2024), so all 46-state data uses the 6-function structure.

---

## Architecture Patterns

### Loader Scaling Recommendation: Cohort Driver Pattern

**Recommended approach: a cohort driver script that calls the existing loadStateGF.mjs logic across all 46 states.**

The `loadStateGF.mjs` already supports `--state` and `--fy` flags. The STATES object is the only thing that must grow from 1 state (GA) to 47 (46 cohort + GA FY2024 extension). The main loop in `loadStateGF.mjs` already iterates `Object.keys(STATES)` and per-FY arrays.

**Option A (recommended): Expand STATES in loadStateGF.mjs directly.**
- Add all 46 states' FY2023 + FY2024 figures to the STATES object in loadStateGF.mjs.
- Run `node scripts/loadStateGF.mjs --dry-run` to validate all checksums before touching production.
- Run `node scripts/loadStateGF.mjs` (all states) or `--state XX --fy YYYY` for per-state runs.
- Idempotent: already-loaded GA FY2023 re-runs cleanly (P6).

This keeps the loader as the single source of truth. Adding ~46 × 2 FY entries = ~92 state-year data objects. Each is ~50 lines of data. Total addition: ~4,600 lines of data declarations. Manageable in one file; the test suite runs offline against the STATES object.

**Option B: Cohort driver script loops CLI runs.**
- A wrapper script calls `node scripts/loadStateGF.mjs --state XX --fy 2023` then `--fy 2024` for each state.
- Only viable if the STATES object is pre-populated (same data entry work).
- Adds complexity without benefit; not recommended.

**Data entry process (per state, per FY):**
1. Extract 6 GF values from pdftotext -table output (T5/T9/T13/T16/T21/T26 General Fund column, select state row, select FY column).
2. Extract control total from Table 1 General Fund column for the same state-FY.
3. Run validateAgainstControl() mentally: sum must equal control within 0.5% tolerance (practically 0 diff for most states).
4. Enter as category array in STATES object.

**Plan wave structure for data entry:**
This is primarily a data-extraction + data-entry task. A planner should structure it as:
- Wave 0: Loader updates (NASBO_SER URL, FY_END_MMDD expansion, Public Assistance removal, revenue cleanup script)
- Wave 1–N: Groups of states (e.g., by alphabet or by size), each wave adding ~10–15 states to STATES and dry-run validating
- Final wave: Full cohort live load + verification

### Recommended Project Structure (no changes needed)

```
scripts/
├── loadStateGF.mjs          # THE loader — extend STATES here
├── loadStateGF.test.mjs     # Unit tests for pure helpers
└── cleanupStateEstimates.mjs  # New: delete unsourced operating+revenue rows
cache/
├── nasbo-2025-ser.pdf       # Already downloaded here
└── nasbo-2024-ser.pdf       # Archive reference
```

### Key Code Patterns

**NASBO_SER provenance block (update to 2025 SER):**
```javascript
// Source: loadStateGF.mjs NASBO_SER const — update to 2025 SER
const NASBO_SER = {
  url: 'https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2025_SER/2025_NASBO_State_Expenditure_Report_S.pdf',
  edition: '2025 State Expenditure Report (actual FY2023, FY2024)',
};
```

**FY_END_MMDD expansion (required for non-June-30 states):**
```javascript
// Source: NASBO 2025 SER notes, p.1 — verified
const FY_END_MMDD = {
  GA: '06-30',  // existing
  AL: '09-30',  // Oct 1 → Sep 30
  MI: '09-30',  // Oct 1 → Sep 30
  TX: '08-31',  // Sep 1 → Aug 31
  NY: '03-31',  // Apr 1 → Mar 31
  // all others: '06-30' (default fallback, already in sourceDate())
};
```

**State entry structure (6-function, 2025 SER — no Public Assistance):**
```javascript
// Example for Alabama — Public Assistance NOT a separate line
AL: {
  name: 'Alabama', abbr: 'AL', population: 5_024_279,
  operating: {
    2023: {
      confidence: 'actual',
      controlTotalGF: 13_764_000_000,  // Table 1 GF FY2023
      categories: [
        { name: 'Elementary & Secondary Education', total: 6_300_000_000 },
        { name: 'Higher Education',                  total: 3_037_000_000 },
        { name: 'Medicaid',                          total:   813_000_000 },
        { name: 'Corrections',                       total:   759_000_000 },
        { name: 'Transportation',                    total:             0 },
        { name: 'All Other',                         total: 2_855_000_000 },
      ],
    },
    2024: {
      confidence: 'actual',
      controlTotalGF: 13_511_000_000,  // Table 1 GF FY2024
      categories: [
        { name: 'Elementary & Secondary Education', total: 6_389_000_000 },
        { name: 'Higher Education',                  total: 2_629_000_000 },
        { name: 'Medicaid',                          total:   855_000_000 },
        { name: 'Corrections',                       total:   846_000_000 },
        { name: 'Transportation',                    total:             0 },
        { name: 'All Other',                         total: 2_792_000_000 },
      ],
    },
  },
},
```
[VERIFIED: figures extracted from 2025 SER via pdftotext -table and checksums confirmed]

**Revenue + out-of-window operating cleanup SQL:**
```sql
-- Delete unsourced revenue estimate rows for the 46-state cohort
-- Run BEFORE the NASBO operating load
DELETE FROM treasury.budgets
WHERE municipality_id IN (
  -- paste the 46 IDs from the cohort table above
)
AND dataset_type = 'revenue';

-- Delete out-of-window operating estimate rows (FY2025, FY2026 for the cohort)
-- These will not be overwritten by the NASBO load (only FY2023+FY2024 are written)
DELETE FROM treasury.budgets
WHERE municipality_id IN (
  -- paste the 46 IDs
)
AND dataset_type = 'operating'
AND fiscal_year IN (2025, 2026);

-- Also delete FY2022 operating estimate rows (FY2022 is actual in 2024 SER but not in
-- scope for Phase 96 which uses only the 2025 SER FY2023+FY2024 window).
-- NOTE: If the plan includes backfilling FY2022 from the 2024 SER (out of scope per
-- D-96-02 / "current NASBO SER"), then skip this line and add FY2022 data entries.
DELETE FROM treasury.budgets
WHERE municipality_id IN (
  -- paste the 46 IDs
)
AND dataset_type = 'operating'
AND fiscal_year = 2022;
```

**Planner note on FY2022:** The 2024 SER covers actual FY2022 + FY2023. Phase 96 uses the 2025 SER (FY2023 + FY2024). FY2022 is NOT loaded unless the planner explicitly decides to use the 2024 SER for a backfill pass. If FY2022 is not loaded, the FY2022 operating estimate rows must be deleted (not left as orphaned estimates). Recommend: delete FY2022 (and FY2025, FY2026) estimate rows for the cohort; Phase 96 loads FY2023 + FY2024 only. Document the FY2022 gap as acknowledged (not a silent drop — per P5, an unloaded year has no row, which is honest).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Checksum validation | Custom diff checker | `validateAgainstControl()` in loadStateGF.mjs | Already proven; 0.5% tolerance; exits 2 on FAIL |
| Tree building | Custom JSON tree | `buildOperatingTree()` in loadStateGF.mjs | Pure, offline-tested, handles negatives (P2) |
| DB write | Direct SQL INSERT | `treasury_sync_budget_tree` RPC | Handles upsert keyed on (muni+fy+dataset_type); never partial-write |
| Source stamp | Embedding in RPC | Post-RPC targeted `UPDATE` | RPC contract does not set source_url/date; this is P4 |
| Data source row | New table schema | `treasury.data_sources` find-or-update | Already handled in `loadStateFY()` |
| PDF column extraction | Image OCR | `pdftotext -table` | Verified working on 2025 SER; 0-diff checksums on Alabama |

**Key insight:** The Phase-94 loader already handles every correctness concern. Phase 96 is a data-entry + configuration task, not a code architecture task. The "hard" part is transcribing ~92 state-year data objects correctly from the 2025 SER PDF.

---

## Validation Architecture

The **dual checksum** is the validation gate for each state-year. No state-year enters the DB unless it passes both checks.

### Dual Checksum Gate (per state-year)

**Checksum A — Row check (redundant verification that GF+Fed+Other+Bonds = Total for each function row):**
For each function table row for a given state: confirm the 4 fund-source columns sum to the Total column. This catches data-entry transposition errors before comparing to the control.

```
For each function F, state S, fiscal year Y:
  GF_F + Federal_F + Other_F + Bonds_F == Total_F  (or within $1M rounding)
```

**Checksum B — Control total check (7/6-function GF sum vs Table 1):**
Sum of all function GF values must tie to Table 1's General Fund column for the same state-year within 0.5% (in practice, always 0 diff or single-digit million rounding).

```javascript
// Already implemented in validateAgainstControl()
catSum = sum(categories.map(c => c.total))
diff = |catSum - controlTotalGF|
ok = diff <= controlTotalGF * 0.005
```

**Exit on failure:** If either checksum fails, the loader prints the error and exits with code 2. No partial load.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node built-in test runner (loadStateGF.test.mjs) |
| Config file | None (ESM, direct run) |
| Quick run command | `node --test scripts/loadStateGF.test.mjs` |
| Full suite command | `node --test scripts/loadStateGF.test.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SGFS-04 (operating) | Each of 46 states × 2 FYs validates + loads to 0-NULL operating row | dry-run validation | `node scripts/loadStateGF.mjs --dry-run` | ✅ (loader exists) |
| SGFS-04 (checksum) | validateAgainstControl() returns ok=true for all 92 state-year entries | unit | `node --test scripts/loadStateGF.test.mjs` | ✅ (test file exists) |
| SGFS-04 (revenue cleanup) | Revenue estimate rows deleted before load | smoke (SQL query) | manual SQL probe | ❌ Wave 0 gap |
| SGFS-04 (no orphans) | FY2025/2026 operating estimate rows deleted | smoke (API check) | `curl .../cities` + inspect available_datasets | manual |

### Sampling Rate

- **Per state group (every ~10 states added):** `node scripts/loadStateGF.mjs --dry-run` — all checksums must pass before proceeding.
- **Before live load:** Full dry-run on all 46 states (2 FYs each = 92 validates).
- **Phase gate:** All 92 state-year rows in DB with non-NULL source_url, then Phase 97.

### Wave 0 Gaps

- [ ] `scripts/cleanupStateEstimates.mjs` — deletes unsourced revenue rows + out-of-window operating estimate rows for the 46 cohort states. Covers D-96-03 resolution.
- [ ] Update loadStateGF.mjs STATES object with all 46 cohort states + GA FY2024 data.
- [ ] Update loadStateGF.mjs NASBO_SER block to 2025 SER URL + edition string.
- [ ] Expand FY_END_MMDD with AL/MI/TX/NY non-June-30 entries.
- [ ] Update or add test cases in loadStateGF.test.mjs to cover at least one cohort state FY2023 + FY2024 entry with known checksum.

---

## Common Pitfalls

### Pitfall 1: Using pdftotext WITHOUT -table flag
**What goes wrong:** Blank cells in the NASBO tables collapse, shifting columns left. GA FY2023 Table 1 text reads GF=$37,334M vs actual $27,657M (Phase-94 finding). Every value after a blank cell is wrong.
**Why it happens:** Default pdftotext layout mode doesn't preserve column alignment when cells are empty.
**How to avoid:** Always `pdftotext -table`. Use the line-number map above to find each table. Cross-check General Fund column value against obvious sanity (California GF is always the largest; Wyoming the smallest).
**Warning signs:** Any state GF total that is more than 2× or less than 0.5× the expected round-number estimate (the old seed data) warrants re-extraction.

### Pitfall 2: Loading the FY2025 Estimated Column
**What goes wrong:** The third FY group in each table (FY2025) is labeled "Estimated." Loading it violates P1 and produces non-actual data in the app.
**Why it happens:** The column layout is FY2023/FY2024/FY2025 left-to-right; it's easy to miscount columns when parsing.
**How to avoid:** The Table 1 header explicitly labels columns: "Actual Fiscal 2023 | Actual Fiscal 2024 | Estimated Fiscal 2025." Always parse by the labeled FY group, not by column position.
**Warning signs:** FY2025 data will often look slightly different from FY2024 (NASBO smoothed projections tend to be rounder).

### Pitfall 3: Using the 7-Function Structure for 2025 SER Data
**What goes wrong:** The STATES object includes `{ name: 'Public Assistance', total: X }`. For 2025 SER data, there is no separate Public Assistance table, so X is fabricated or zero. The checksum will fail (no separate PA line item to verify against) OR the Public Assistance value is silently included in All Other already.
**Why it happens:** The Phase-94 loader was built against the 2024 SER which had a separate PA chapter. The 2025 SER merged PA into All Other.
**How to avoid:** Use 6 categories for all 2025 SER state-year entries. Do NOT add a Public Assistance line. The checksum closes without it.
**Warning signs:** If a state's 6-function sum closes to Table 1 GF exactly, the structure is correct. If there's a residual that matches roughly 1–2% of GF, it might indicate a misread; re-check the All Other column (which now includes PA).

### Pitfall 4: FY_END_MMDD Default for AL/MI/TX/NY
**What goes wrong:** source_date = `"2023-06-30"` for Alabama FY2023, but Alabama's fiscal year ends September 30. The source_date is wrong, violating the provenance contract.
**Why it happens:** The current loadStateGF.mjs FY_END_MMDD only has `GA: '06-30'` and falls back to `'06-30'` for all others.
**How to avoid:** Populate FY_END_MMDD with AL='09-30', MI='09-30', TX='08-31', NY='03-31' before running any non-GA state.
**Warning signs:** A source_date of June 30 for Alabama or Michigan is always wrong.

### Pitfall 5: Not Deleting FY2025/2026 Operating Estimate Rows
**What goes wrong:** After the NASBO load writes FY2023 + FY2024 operating rows, FY2025 and FY2026 operating estimate rows (from the original all-50-states seed) remain in the DB. The app shows a "Budget" tab for FY2025/2026 with round-number unsourced data, violating the ground rule.
**Why it happens:** The RPC upserts only the years it writes; it does not touch FY years not in the call.
**How to avoid:** The cleanup script (Wave 0 gap above) deletes operating rows for FY2025, FY2026, and FY2022 for all cohort states.
**Warning signs:** After the load, checking `available_datasets` for any cohort state in the API should return only FY2023 and FY2024 operating entries (no FY2022/2025/2026 operating, no revenue).

### Pitfall 6: Forgetting the data_sources.fiscal_years Update
**What goes wrong:** The `data_sources` row for a state has `fiscal_years: [2022, 2023, 2024, 2025, 2026]` (from the original seeder). After the load, the actual fiscal_years should be `[2023, 2024]`. While this doesn't break the app directly, it creates a misleading data_sources record.
**Why it happens:** The loadStateFY() function updates the data_sources row with `srcPayload` which includes `fiscal_years: Object.keys(st.operating).map(Number)`. If the STATES object only has FY2023 and FY2024 entries, this auto-updates correctly. This pitfall is only a risk if someone manually edits the data_sources row after the fact.
**How to avoid:** Ensure the STATES object entries only list the actual FY years being loaded (2023, 2024). The existing code handles this automatically.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NASBO 7-function taxonomy (separate Public Assistance chapter) | 6-function taxonomy (PA merged into All Other) | 2025 SER edition | loadStateGF.mjs STATES entries must use 6 categories for 2025 SER data |
| 2024 SER as source (actual FY2022, FY2023) | 2025 SER as source (actual FY2023, FY2024) | 2025 NASBO publication | Update NASBO_SER.url in loader; FY2023 is now in both editions (use 2025 SER for consistency) |
| Georgia-only STATES object | 46+ state STATES object | Phase 96 | STATES grows from 1 to ~47 entries |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Georgia FY2024 should be included in Phase 96 as a cleanup task | 46-State Cohort / GA FY2024 | Low — if Chris explicitly excludes GA FY2024, skip that entry; does not affect the 46-state cohort |
| A2 | FY2022 operating estimate rows should be deleted (not loaded from 2024 SER) | Revenue Display Finding / cleanup SQL | Medium — if the plan decides to backfill FY2022 from the 2024 SER, the cleanup SQL should omit the FY2022 delete; the research recommendation is to load only FY2023+FY2024 from the 2025 SER and acknowledge FY2022 as deferred |
| A3 | loadStateGF.mjs DB lookup `eq('name', st.name).eq('state', st.abbr).eq('entity_type', 'state')` will find all 46 cohort nodes | Loader Scaling | Low — names in seedRemainingStates.js match the live API names; verified against DB IDs |

**If this table is examined:** A1 is the only material assumption requiring planner decision. A2 and A3 are low-risk.

---

## Open Questions (RESOLVED during planning, 2026-06-28)

> RESOLVED — Q1: skip FY2022, document in 96-07 load log. Q2: include GA FY2024 (96-06). Q3: 7-plan / 6-wave structure settled.

1. **Include FY2022 from 2024 SER?**
   - What we know: 2024 SER has actual FY2022 + FY2023 data for all 50 states.
   - What's unclear: D-96-02 says "load the actual years present in the CURRENT NASBO SER" — which is 2025 SER (FY2023+FY2024 only). FY2022 would require also parsing the 2024 SER.
   - Recommendation: Skip FY2022 for now (defer to Phase 97 or future backfill). Document explicitly. This matches the "current SER" wording in D-96-02.

2. **GA FY2024 extension — in scope or out?**
   - What we know: GA FY2023 done in Phase 94; GA FY2024 is actual in 2025 SER; GA is excluded from the 46-state cohort list.
   - Recommendation: Include GA FY2024 as a small cleanup task — it's 1 additional data entry, same loader invocation, and closes the gap of GA having an unsourced FY2024 operating row.

3. **How many wave plans does the planner need?**
   - Data entry for 46 states × 2 FYs is substantial. The planner should consider grouping by alphabet (e.g., 3 plans of ~15 states each) or by region, with dry-run validation between each group. Alternatively, one person could do all 46 states in a single transcription pass.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pdftotext | NASBO table extraction | ✓ | 4.00 | None — required for the extraction approach |
| node.js | loadStateGF.mjs | ✓ | v24.13.0 | — |
| SUPABASE_SERVICE_KEY | DB writes | Must be in .env | — | dry-run works without key |
| NASBO 2025 SER PDF | Data source | ✓ | Downloaded to cache/nasbo-2025-ser.pdf | Re-download from URL above |

**pdftotext availability confirmed:** `/mingw64/bin/pdftotext` version 4.00 — poppler package present.

---

## Security Domain

This phase has no authentication, user input, or credential handling beyond the existing Supabase service key pattern. ASVS categories V2/V3/V4 do not apply. V5 (Input Validation) is addressed by the dual checksum (values come from a trusted PDF source, not user input). V6 (Cryptography) does not apply.

---

## Sources

### Primary (HIGH confidence)
- NASBO 2025 State Expenditure Report PDF — downloaded directly, checksum-verified on Alabama FY2023+FY2024. URL: `https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2025_SER/2025_NASBO_State_Expenditure_Report_S.pdf`
- NASBO landing page — confirmed 2025 SER is current edition: `https://www.nasbo.org/reports-data/state-expenditure-report`
- Live API `/api/treasury/cities` — state entity list + available_datasets verified, Alabama FY2023 revenue row confirmed unsourced + rendering
- `scripts/loadStateGF.mjs` — loader contract read directly; NASBO_SER block, STATES structure, RPC call, source-stamp pattern all confirmed
- `94-01-POLICY.md` — P1–P6 locked policy re-confirmed
- `94-01-SPIKE.md` — NASBO mechanism decisions, Public Assistance note now superseded by 2025 SER taxonomy change

### Secondary (MEDIUM confidence)
- `scripts/seedRemainingStates.js` — state name/abbr mapping, FY end month notes (cross-verified against 2025 SER internal notes)
- Live API `/api/treasury/cities/{id}/budgets?fiscal_year=2023` for Alabama — source_url=null, total=round number confirmed

### Tertiary (LOW confidence)
- None — all critical claims are PRIMARY verified.

---

## Metadata

**Confidence breakdown:**
- NASBO SER URL + actual-year window: HIGH — PDF downloaded, header confirmed, fiscal year labels verified
- 46-state cohort list + DB IDs: HIGH — live API query
- pdftotext -table workability: HIGH — executed on the actual 2025 SER PDF, checksums computed
- Public Assistance taxonomy change: HIGH — verified from NASBO 2025 SER text + checksum closure
- FY end dates for AL/MI/TX/NY: HIGH — verified from 2025 SER internal notes (p.1)
- D-96-03 revenue display: HIGH — live API + code inspection of App.tsx
- Loader scaling recommendation: MEDIUM — based on code reading; planner should confirm wave structure

**Research date:** 2026-06-28
**Valid until:** 2026-09-28 (stable — NASBO publishes annually; 2026 SER not expected until late 2026)
