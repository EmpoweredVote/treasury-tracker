---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Federal History
status: planning
last_updated: "2026-06-13T06:42:34.379Z"
last_activity: 2026-06-13
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-13)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v2.0 Federal Treasury Tracker SHIPPED 2026-06-13. Planning next milestone — recommended: historical backfill (prior fiscal years at v2.0 detail).

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-13 — Milestone v2.1 started

## Phase Overview

| Phase | Name | Depends on | Status |
|-------|------|------------|--------|
| 43 | Federal Entity + Sourcing Infrastructure | Nothing (Phase 32 'state' pattern) | Complete (2026-06-12) |
| 44 | Core Federal Data Load | Phase 43 | Complete (2026-06-12) |
| 45 | Federal Visualization | Phase 44 | Complete (2026-06-12) |
| 46 | Sourced Explainer Pipeline v2 | Phase 44 (pipeline), 45 (UI) | Complete (2026-06-12) |
| 47 | Program Origins Pilot | Phase 43 + 46 standard + API keys | Complete (2026-06-12) |
| 48 | Source-Chain Verification + UAT | Phases 45–47 | Complete (2026-06-13) |

**Critical path:** 43 → 44 → 45 → 48; 46 and 47 can overlap with 45 once 44 lands.
**Human-action checkpoints:** ~~Congress.gov + GovInfo API key signup~~ DONE 2026-06-12 — `DATA_GOV_API_KEY` in .env, verified against both APIs (ORIG-01 ✅). Remaining: CBO/GAO documents need manual browser download if required (both domains bot-block curl).

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

Last session: 2026-06-13
Stopped at: v2.0 milestone shipped + archived (phases 43-48 complete; tag v2.0)
Resume file: .planning/PROJECT.md

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
