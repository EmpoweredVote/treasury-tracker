# Phase 51 — Research: Comparability Notes + Source-Chain Verification + UAT

**Researched:** 2026-06-13 (inline — no research subagent, per cost policy)
**Requirements:** CTX-02
**[verified]** = checked against live DB / live sources.

## TL;DR
1. **Comparability content is fully sourceable** (no model memory needed):
   - **TQ** — OMB Historical Tables *Introduction*: "in calendar year 1976 the July–September period was a separate accounting period (the transition quarter) to bridge the shift to the new fiscal year; through FY1976 the fiscal year began July 1, beginning FY1977 it begins October 1." Source: OMB Historical Tables Introduction (GovInfo `BUDGET-YYYY-TAB-1.pdf`) / current whitehouse.gov edition.
   - **Function drift** — OMB *retroactively* reclassifies so "the data show the same stream of transactions in the same manner" across periods (OMB Historical Tables Introduction + Public Budget Database User's Guide `db_guide_fy2027.pdf`). So function trees are largely kept comparable by OMB; the honest note is "classifications have been updated over time and applied retroactively."
   - **Agency drift** — the real structural change is agency creation/abolition/merger (e.g., Energy 1977, Education 1979, Homeland Security 2002). Source each to its enabling **public law** via GovInfo/Congress.gov — reuse the Phase 47 program-origins sourcing path (`program_details`).
2. **Source-chain audit findings [verified live]** — every backfilled figure resolves *today*, but two URL classes are fragile/raw and must be fixed for durable "zero residue" (D-02):
   - **22,941** disclosure metrics → `…/outlays_fy2027.xlsx` (version-specific → breaks next edition). Repoint to `…/supplemental-materials/`.
   - **30** FY2025 metrics → raw `api.fiscaldata.treasury.gov/…mts_table_5` JSON; **1** → `…/25db-1-02-nr.xlsx`. Repoint to human pages.
   - Budget→registry links already clean (human OMB/fiscaldata pages). ✓
3. **Audit harness** (`auditFederalSources.mjs`) writes results to the archived `…/phases/48-…/` dir → exits 1 on the write even though checks pass. Fix the output path (write to the phase-51 dir).

## Comparability content — sourcing plan (D-01, detailed per-area)
Author a committed, cited data file `data/federal-comparability.json` (mirrors `data/federal-enrichment.json`: inline-authored from fetched official text, $0, git-reviewable), shape e.g.:
```
{ "transition_quarter": { "text": "...", "source_name":"omb-historical-tables", "source_url":"<OMB intro / govinfo TAB-1 pdf>", "source_date":"2026-06-13" },
  "function_classification": { "text": "...retroactive reclassification...", "source_url":"<OMB intro / db guide>", ... },
  "agency_reorganizations": [ { "agency":"Department of Energy", "year":1977, "note":"...", "enabling_law":"Pub. L. 95-91", "source_url":"<govinfo PLAW>" }, ... ] }
```
Bound the agency list to the **significant, citizen-relevant** reorganizations (not every minor change): the major cabinet-level creations/splits/mergers across FY1976→FY2024 (e.g., Energy 1977, Education & HHS split from HEW 1979–80, Veterans Affairs cabinet 1989, Homeland Security 2002). Each row cited to its enabling public law (GovInfo `PLAW-…`, already a PASS-class source in the Phase 48 audit). Store loader optional — a static import is fine (it's small, sourced, version-controlled).

## Comparability notes — UI plan
- A compact, expandable **ComparabilityNote** component (analog: `MethodologyPanel.tsx`), each line carrying a `SourceChip` (reuse the federal SourceChip → human pages).
- Render on **historical-year** federal views: the function/agency drift notes (so a citizen comparing FY1990 vs FY2024 sees the caveat). Suppress on the FY2025 default to keep the headline clean (or show a minimal one — planner's call).
- Render the **TQ explanation** on the Transition Quarter view (where Phase 50 currently shows only a neutral heading in `FederalLanding.tsx`).

## Source-chain fixes (D-02)
- **DB updates** (prod): `UPDATE federal_context_metrics SET source_url='…/supplemental-materials/' WHERE source_url LIKE '%outlays_%xlsx'` (the 22,941); repoint the 30 raw-API FY2025 rows + the IRS `.xlsx` row to human pages.
- **Loader patches** so re-runs stay durable: `loadFederalFunctions.js` / `loadFederalAgencies.js` write the stable supplemental-materials page as the *metric* `source_url` (keep the exact xlsx URL only as the `data_sources.base_url` / fetch URL); `loadFederalMTS.js` already fixed for context metrics — apply the same to the FY2025 agency-offset metrics.

## Spot-check (criterion 3)
For FY1976, FY1990, FY2008, FY2024: assert the loaded function net (or `federal_annual_summary.outlays`) matches OMB Hist 1.1 published outlays within rounding (the loaders already reconciled at load — re-assert from the DB + the published figure).

## Validation Architecture
> Drives `51-VALIDATION.md`. Validation = the audit harness (all-PASS, zero residue), coverage/spot SQL, frontend tsc/build, and observed UAT.
- **Source-chain:** `node scripts/auditFederalSources.mjs` → 0 FAIL across all backfilled years' source URLs (after the durability fixes); output written to a live path (phase-51 dir).
- **Durability:** no metric `source_url` matches a version-specific pattern (`outlays_fy\d+\.xlsx`, raw `api.fiscaldata`, `\d+db-…xlsx`) — SQL assertion.
- **Spot-check:** FY1976/1990/2008/2024 totals reconcile to OMB Hist 1.1 (SQL + published figures).
- **Comparability content:** every entry in `federal-comparability.json` has source_name/url/date; each `source_url` resolves (200 or GovInfo-API confirmed).
- **UI:** `npm run build` green; notes render on a historical year + the TQ (observed UAT).
- **UAT:** Chris sign-off on historical navigation, comparability notes, and data accuracy → milestone close.

## RESEARCH COMPLETE
