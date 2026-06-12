---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Federal Treasury Tracker
status: roadmap_complete
last_updated: "2026-06-12"
last_activity: 2026-06-12 — Data recon complete, IA decisions locked, v2.0 roadmap written (Phases 43-48)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-09)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** v2.0 Federal Treasury Tracker — roadmap written; next: plan Phase 43

## Current Position

Phase: 43 (Federal Entity + Sourcing Infrastructure) — Complete
Plan: 3/3 complete
Status: All migrations applied + verified; frontend federal-ready (build green); backend audited — zero changes needed
Last activity: 2026-06-12 — Phase 43 executed; next: plan Phase 44 (Core Federal Data Load)

## Phase Overview

| Phase | Name | Depends on | Status |
|-------|------|------------|--------|
| 43 | Federal Entity + Sourcing Infrastructure | Nothing (Phase 32 'state' pattern) | Complete (2026-06-12) |
| 44 | Core Federal Data Load | Phase 43 | Not started |
| 45 | Federal Visualization | Phase 44 | Not started |
| 46 | Sourced Explainer Pipeline v2 | Phase 44 (pipeline), 45 (UI) | Not started |
| 47 | Program Origins Pilot | Phase 43 + 46 standard + API keys | Not started |
| 48 | Source-Chain Verification + UAT | Phases 45–47 | Not started |

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

Last session: 2026-06-12
Stopped at: v2.0 roadmap complete — ready to plan Phase 43
Resume file: .planning/v2.0-recon/RECON.md

### Next Session

Plan Phase 43 (`/gsd:plan-phase 43`) — federal entity migration follows the Phase 32 'state' pattern (.planning/phases/32-state-entity-infrastructure/).

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
