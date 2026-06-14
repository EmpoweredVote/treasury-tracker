---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Orange County + Reusable SoCal Pipeline
status: executing
last_updated: "2026-06-14T16:48:34.348Z"
last_activity: 2026-06-14 -- Phase 52 execution started
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-14)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Phase 52 — socal-bulk-pipeline-hardening

## Current Position

Phase: 52 (socal-bulk-pipeline-hardening) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 52
Last activity: 2026-06-14 -- Phase 52 execution started

### Phase 50 outcomes (for Phase 51)

- Backend EV-Accounts exposes `period_label` on `/cities` available_datasets + `/budgets` (master 83b87196, deployed to Render). Frontend models periods via `src/utils/period.ts` (parsePeriod/buildPeriodTokens); TQ token resolves to fiscal_year 1976 + period_label; loadBudgetData disambiguates by period_label.
- `FederalLanding` is year-aware (selects annual_summary row by fiscal_year); TQ hides annual-summary bands (no TQ summary row); FYTD strip only on the current/default year.
- **Phase 51 owes:** (1) systematic source-chain audit across every figure/year/source — Phase 50 fixed only the surfaced context-metric chips (→ human fiscaldata pages, DB + loadFederalMTS.js) and federal lens chips (→ registry url, App.tsx); deeper per-figure URLs unaudited. (2) Comparability/definition-drift notes + the FY1976 Transition Quarter explanation copy (the TQ currently renders with a neutral heading, no sourced explanation).

### Per-capita denominators (Phase 50 fix, 2026-06-13)

Per-person/per-taxpayer now use PER-YEAR denominators in federal_context_metrics: `population_fyN` (FY1976–2025, FRED POPTHM = Census/BEA resident pop incl. armed forces overseas, July) + `tax_returns_filed_fyN` (FY2005–2023 IRS SOI histab21b individual returns, + FY2025 carried). Loader: `scripts/loadFederalDenominators.js` + `extractIRSReturns.py`. Frontend: `federalDenominators` memo in App.tsx.

- **Known gaps (by design, honest):** per-taxpayer disabled for pre-2005 + FY2024 (no clean free source — old IRS Data Books are PDF); per-capita disabled on the TQ. Frontend hides the toggle + resets to $ when a denominator is missing.
- **Note:** FY2025 per-person shifted ~340.1M→342.1M (switched from Census Vintage resident to the consistent FRED POPTHM series for cross-year uniformity).
- **Future (optional):** fill pre-2005/FY2024 per-taxpayer from `05in01an.xls` (SOI individual returns 1913–2005, needs `xlrd`) + a recent in01 vintage — ~1–2h, with a cross-series consistency caveat.

### Phase 49 outcomes (for Phase 50/51)

- Federal budgets now span FY1976–FY2025 (50 years) + TQ across operating/federal_agency/revenue, all sourced.
- **TQ storage:** fiscal_year=1976 + `budgets.period_label='Transition Quarter (Jul–Sep 1976)'`, dataset_id `tq1976`. Phase 50 YearSelector MUST treat a non-null period_label row as a separate selectable period (orders right after FY1976). Unique index is now 4-col (…, period_label) NULLS NOT DISTINCT; RPC `treasury_sync_budget_tree` has optional 8th arg `p_period_label`.
- **Agency lens for history is OMB Public Budget Database** (not MTS T5 — API only reaches FY2015); receipts history is **OMB Hist 2.1** (5 buckets, "Other" consolidates estate&gift/customs/misc). One-year source discontinuity FY2024→FY2025 (agency PBD→MTS, receipts Hist2.1→MTS T9) → Phase 51 comparability copy.
- Loaders: `loadFederalFunctions.js --fy N|--tq`, `loadFederalAgencies.js --source omb --fy N|--tq`, `loadFederalReceipts.js --fy N|--tq`, orchestrated by `backfillFederalHistory.mjs` (idempotent).

## Phase Overview

| Phase | Name | Depends on | Status |
|-------|------|------------|--------|
| 49 | Historical Federal Data Backfill (FY1976–FY2024) | Nothing new (reuses Phase 44 loaders + schema) | Complete |
| 50 | Federal YearSelector Wiring | Phase 49 | Complete |
| 51 | Comparability Notes + Source-Chain Verification + UAT | Phases 49–50 | Pending |

**Critical path:** 49 → 50 → 51 (linear; data → navigation → context/verify).
**Constraint:** $0 API spend — no AI/LLM enrichment calls; Claude loads free OMB historical tables directly (Hist 3.2 function, 4.1/5.1 agency, 2.x receipts). Browser User-Agent required for OMB xlsx; openpyxl parses cleanly.
**Carryover (zero rework):** `federal_annual_summary` already holds 64 yrs; explainers (name-keyed) + program origins (law-keyed) are year-independent.

## Accumulated Context

### v2.0 Foundation Documents

- `.planning/v2.0-FEDERAL-BRIEF.md` — mission, ground rules, sourcing architecture, phase shape
- `.planning/v2.0-recon/RECON.md` — verified sources, pinned figures, data structure findings, IA decisions
- `.planning/v2.0-recon/samples/` — raw API samples (MTS tables 4/5/9, USAspending, OMB xlsx)
- Auto-memory: `project_federal_tracker_ground_rules.md`

### Ground Rules (Chris, 2026-06-12)

1. No paid APIs; LLM spend under the $5 gate
2. NEVER create or display unsourced data or text
3. No reflexive deep icicles — visualization fits the data
4. Explainers: Tier 1 from fetched authoritative text only; Tier 2 origins from Congress.gov/GovInfo structured records
5. Safety line: official public record only — no personal info, no targeting
6. Transparency about opacity (DoD failed audits flagged with GAO/OIG citation)

### IA Decisions (locked 2026-06-12)

- Headline year: FY2025 actuals; FY2026 FYTD as secondary "this year so far" strip
- Landing: proportional Mandatory/Discretionary/Net Interest bands + permanent deficit strip
- Function lens default; agency lens behind toggle
- Outlays consistently (MTS/OMB); USAspending obligations never headline figures

### Pinned Sourced Figures (recon 2026-06-12)

- FY2025 actuals: receipts $5,236.4B / outlays $7,011.1B / deficit $1,774.7B (OMB Hist 1.1)
- FY2025 split: Discretionary $1,875.1B (Def $893.6B / Nondef $981.5B), Mandatory ~$4,165.9B, Net Interest ~$970B (OMB Hist 8.1)
- FY2026 FYTD thru May: outlays $4,901.9B, receipts $3,655.6B; Net Interest $722.7B > Defense $630.9B (MTS T9)
- Debt: $39.213T (Debt to the Penny, 2026-06-10)

### Phase 45 Inputs (from Phase 44 execution)

- US entity id `0098c405-65e1-426f-8e5f-0fcbe2a900c0`; datasets live: operating (function lens, $7,532.2B displayed), revenue ($5,234.6B), federal_agency (agency lens, $8,905.0B displayed)
- Landing bands + deficit strip data: treasury.federal_annual_summary (64 years; FY2025 official: receipts $5,236.4B / outlays $7,011.1B / deficit $1,774.7B / mandatory $4,165.9B / disc def $893.6B / disc nondef $981.5B / net interest $970.1B)
- Live strip: federal_context_metrics fytd_receipts/fytd_outlays/total_public_debt/fytd_interest_expense
- DISCLOSURES OWED (44-VERIFICATION §Known disclosures): visual totals exceed official net (function +$521.1B, agency +$1,895.5B excluded negatives); 67 disclosure metrics enumerate every exclusion; offsetting items are negative '(offsetting)' line items in the data
- budgets.data_source_id FK → source_registry (NOT data_sources) — the source-chip join; all 3 federal rows linked
- BudgetIcicle now normalizes child widths by sum-of-children (App.tsx federal_agency excluded from tab list — Phase 45 builds the lens toggle)

### Phase 44 Loader Contract (from 43-03 audit)

- **getCities visibility is gated on `treasury.budgets`** metadata rows (one per fiscal_year × dataset_type), NOT on operating_budgets line items — loaders must write both
- `treasury.budgets` NOT NULLs: fiscal_year, dataset_type, total_budget, fiscal_year_start_month — federal uses **fiscal_year_start_month = 10**
- Federal line-item rows MUST populate source_name (registry key), source_url, source_date — columns live as of 43-01
- Registry keys available: treasury-fiscal-data, omb-historical-tables, usaspending, congress-gov, govinfo
- The US entity appears in the app automatically when the first treasury.budgets row lands (no feature flag)

### Technical Gotchas (verified during recon)

- Fiscal Data API: `page[size]` must be URL-encoded (`page%5Bsize%5D`)
- OMB xlsx: needs browser User-Agent; URL is `/omb/information-resources/budget/historical-tables/` (moved)
- MTS Table 5: "Total--" rows appear at mixed levels — walk parent_id, never sum "Total--" rows
- USAspending explorer total = obligations ($10.3T FY2025) ≠ outlays ($7.0T); has "Unreported Data" line
- CBO + GAO: entire domains 403 non-browser clients — manual download fallback
- openpyxl available in local Python; parses OMB tables cleanly

### API Cost Threshold

$5 per run — estimate before running AI enrichment. Recon estimate for full federal enrichment: <$0.50 (~65 generation calls with fetched context). Re-estimate before each run.

### Known Tech Debt (carried from v1.7–v1.9)

- Oakland revenue (OpenGov embedded chart format) — deferred
- Fresno + Riverside revenue (no extractable GF revenue section) — deferred
- San Jose FY2016–2020 (older PDF format) — deferred
- Phase 07, 14, 22, 25 verification files — human_needed, shipped milestones
- MA GF Expenditures report type (re-add path in 37-01-SUMMARY.md)

## Session Continuity

Last session: 2026-06-14T16:44:18.432Z
Stopped at: Phase 52 planned (4 plans)
Resume file: .planning/phases/52-socal-bulk-pipeline-hardening/52-01-PLAN.md

### Next Session

Start the next milestone with `/gsd:new-milestone`. Recommended scope: historical backfill — prior fiscal years of federal function/agency detail at v2.0 quality (explainers + origins are year-independent and carry over; work is iterating the OMB loader across years + per-year disclosures + YearSelector wiring). See PROJECT.md "Current Milestone" + REQUIREMENTS archive Future Requirements.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| (v2.0 not yet started) | — | — | — |

## Decisions

| Decision | Context |
|----------|---------|
| Recon before roadmap (Option 2) | Pulled live samples from every source before writing phases; caught CBO/GAO blocking and the obligations-vs-outlays trap before they could derail a phase |
| FY2025 actuals as headline year | Complete, final, sourced; FY2026 FYTD as live strip — partial-year proportions can mislead |
| Function lens default, agency toggle | "What it's for" is the citizen question; ~20 clean categories vs 800-row agency hierarchy |
| MTS/OMB outlays canonical; USAspending drill-down only | $3.3T gap between obligations and outlays; mixing them would corrupt headline figures |
| 6 phases (43–48), recon folded in | Brief's draft Phase A completed pre-roadmap; B–G became 43–48 |

## Deferred Items

Carried forward from v1.7–v1.9 (see Known Tech Debt above). New in v2.0 planning:

| Category | Item | Status |
|----------|------|--------|
| data | CBO program descriptions as explainer source | cbo.gov bot-blocks; manual download workflow if needed |
| feature | Votes/amendments exploration hub | Future milestone — the eventual mission destination |
| feature | Sourcing backfill to cities/states | After the standard is proven federally |
| milestone | **Historical backfill — prior fiscal years (FY2024 ← back) at v2.0 detail** | RECOMMENDED NEXT (Chris asked 2026-06-12). Cheap parts already done: annual_summary already holds 64 years (FY1962+); explainers (name_key-keyed) + program origins (law-keyed, not year-keyed) are year-independent and need ZERO rework. Real work = iterate the OMB loader (Hist 3.2 outlays-by-function, 4.1/5.1 by-agency) across prior years + recompute per-year visual-vs-official disclosures + revenue-by-source per year + YearSelector wiring. Watch: function/agency definitions drift over decades (comparability notes); per-year actuals vs estimates. Same free sources + same loader pattern as 44. |

### Acknowledged at v2.0 close (2026-06-13)

Open-artifact audit at milestone close surfaced 5 stale/orphaned items, acknowledged and deferred (none are v2.0 blockers — all phases 43–48 have complete VERIFICATION files):

| Category | Item | Status |
|----------|------|--------|
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — unrelated to v2.0 federal work |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort; see untracked scripts/_verify-longview-temp.mjs |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |
| uat_gap | (unnamed) | empty/orphaned entry — no v2.0 UAT gap (Phase 48 UAT signed off) |
| verification_gap | (unnamed, human_needed) | matches pre-existing Phase 07/14/22/25 human_needed debt (shipped milestones) |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
