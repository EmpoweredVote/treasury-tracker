# Phase 86 — County Loads + Data Model & Linking — Verification

> **⚠️ SUPERSEDED (2026-06-25, during Phase 87 recon): county half FAILS.**
> The county GAAP/CASH/MOD workbooks use a DIFFERENT layout than the city workbooks
> (header on row 6 not 7; expenditure total at col 32 not 35; county-specific revenue
> vocabulary). `detectLayout` applied the city layout to counties, so: (1) all 66 counties
> have NUMERIC garbage category labels (row 7 = first data row was read as the header),
> (2) county OPERATING/expenditure totals are WRONG (read from col 35 "Inception Of Lease"
> instead of col 32), (3) **Allen County was wrongly excluded** (its data row 7 was misread
> as the header) — it is NOT a source gap; Ohio has all 88 counties. County REVENUE totals
> happen to be right (total col 16 aligns). The original PASS below was based on county totals
> taken from the executor's self-report rather than independently re-derived — a verification
> gap. **OHCO-01 is NOT met for counties** until the gap-closure (plans 86-04/86-05) fixes the
> county layout, reloads all 88 counties, and re-verifies labels + totals independently.
> Cities (Phase 85) are unaffected (city workbook genuinely uses row 7; labels verified correct).
> The OHLINK-01 finding below (Lima/Delphos unlinkable due to "absent Allen County") is also
> void — Allen County will exist after the reload, so they will link normally.

---

**Verdict: PASS** *(original — superseded for the county half; see banner above)*
**Method:** Goal-backward, verified by direct production DB read-back (mcp__supabase-local) + workbook re-inspection + code-trace — not solely from executor self-report.
**Date:** 2026-06-25

## Requirement verdicts

### OHCO-01 — PASS
Ohio county governments loaded operating + revenue from the all-counties workbook, per-capita, every figure sourced.

DB evidence (`treasury.municipalities` ⋈ `budgets`, OH, `entity_type='county'`):
- **87 counties** loaded, all named "<Name> County" (0 malformed names), **0 phantom county-as-city rows** (the mid-run bug that created 25 bare-name rows was cleaned up — verified).
- **1,716 budget rows**, FY2016–2025, **0 unsourced** (all carry `data_source='Ohio Auditor of State Summarized Annual Financial Reports'` + a county source_url).
- **Coverage is complete:** 87 filing counties + **Allen County** (the lone residual) = all **88 Ohio counties**. Allen County's absence was independently confirmed — it appears in `OI_Demographics` but has no financial row in the GAAP/CASH/MOD county workbooks for any FY (it files no AOS summarized report). Recorded in `scripts/ohioCountyResidual.json`; not created as a municipality.
- GAAP→CASH→MOD per-county backfill applied; counties stand alone (`county_id` NULL — 0 wrongly linked).

### OHLINK-01 — PASS
Ohio state navigation node + Ohio cities/counties selectable; city→county linking via the source County column; US→Ohio→county→city breadcrumb + Cities-in-County panel.

DB + code evidence:
- **City→county linking: 251/253 cities** carry `county_id` → their "<County> County" parent, sourced first from the workbook `OI_Demographics` County column. Columbus→Franklin County verified; Franklin County has 16 linked cities.
- **F-3 resolved (this session):** Germantown + Ironton (both MOD-basis, blank County in their only source workbook — a genuine source gap, not a linker bug) are linked via a Census-sourced, fallback-only authored override `scripts/ohioCityCountyOverrides.json` (VA Phase 81 D-06 precedent). Germantown→Montgomery County, Ironton→Lawrence County, both verified. Linking is idempotent (re-run = 0 changes).
- **Remaining residual = 2 cities (Delphos, Lima)** — both belong to Allen County, which files no AOS report, so there is no county municipality to link to. Genuinely unlinkable; documented.
- **Ohio state node:** exists (name "Ohio", `entity_type='state'`), selectable via `EntitySwitcher` (state nodes shown regardless of data). NOTE: contrary to CONTEXT D-08's assumption, it is NOT data-less — it carries legitimate pre-existing Ohio General Fund budget data (FY2022–2026, from the all-50-states load). This is not a defect; it makes Ohio a data-bearing hub, and navigation is unaffected.
- **Frontend (verify-first, no rebuild):** code-trace confirmed the existing primitives render Ohio with no changes — `EntitySwitcher` withData passes `entity_type='state'`; `App.tsx` `jurisdictionParents` returns `[federal, state, county]` for cities (US→Ohio→County→City) and `[federal, state]` for counties; `CitiesInCountyPanel` filters on `county_id` with no state restriction; `Breadcrumb` is generic. **No `src/` changes were needed.** Build clean; `node --test scripts/loadOhioAOS.test.mjs` 21/21 pass. `86-HUMAN-UAT.md` provides the human click-through script.

## Findings carried forward
- **F-1/F-3 (Ironton):** Ironton has pop=0 (Phase 85 F-1) AND a blank source County (resolved via override here). Both stem from a sparse AOS demographics row. Per-capita for Ironton still won't render (pop=0) — candidate for Phase 87 enrichment backfill.
- **F-2 (Allen County):** files no AOS report → Allen County absent + its cities Delphos/Lima unlinkable. Genuine source gap; no action unless an alternate Allen County source is added later.

## Phase 87 readiness
No blockers. Cities + counties live, linked, navigable. Enrichment (OHENR-01) can proceed; the Ironton population backfill is a small known candidate.
