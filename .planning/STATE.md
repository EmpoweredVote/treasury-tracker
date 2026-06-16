---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: California Coverage Parity
status: executing
last_updated: "2026-06-16T17:48:00Z"
last_activity: 2026-06-16 -- Plan 58-04 complete (light inline verification — all 4 SC pass, Phase 62 handoff documented)
progress:
  total_phases: 62
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16 after v2.2)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Phase 58 — la-county-parity-backfill

## Current Position

Phase: 58 (la-county-parity-backfill) — COMPLETE
Plan: 4 of 4 — ALL PLANS COMPLETE
Status: Plans 58-01 + 58-02 + 58-03 + 58-04 all complete; Phase 58 done; Phase 59 next
Last activity: 2026-06-16 -- Plan 58-04 complete (light inline verification — all 4 SC pass, Phase 62 handoff documented)

### v2.3 gap baseline (DB query, 2026-06-16)

- **OC (the standard):** 34 cities op+rev FY2003–2024 + salaries (salaries live in production, NOT local DB).
- **LA County:** 88 cities op+rev FY2017+ only (0 reach FY2003), 0 salaries → Phase 58 backfill + Phase 60 salaries.
- **LA County gov budget:** FY2021–2025 present (vs OC FY2003–2024) → Phase 58 extends FY2003–2020.
- **Unlinked CA cities:** 7 (1 has no budget at all); **other-county cities:** 4 (Alameda/Sac/SD), FY2012+ → Phase 59.
- **Named custom-source cities (12):** LA/SF/SD/San Jose etc. — never-overwrite their budgets; salaries + enrichment only (Chris decision 2026-06-16).
- ⚠️ **Salary verify-at-plan-time:** local Supabase shows salaries for only Bloomington IN (282K rows, 2015–2025); the v2.2 OC salary sweep is production-only. Phase 60 must confirm against the **production / ev-accounts** DB, not local.

## Phase Overview

| Phase | Name | Depends on | Status |
|-------|------|------------|--------|
| 58 | LA County Parity Backfill (88 cities + county gov budget → FY2003) | Nothing (reuses v2.2 tools) | Planned (4 plans) |
| 59 | Remaining CA Cities History + Linking | Phase 58 | Pending |
| 60 | Statewide CA Salaries Sweep (2009–2024, all non-OC CA cities) | Nothing (parallel to 58/59) | Pending |
| 61 | Enrichment Parity | Phases 58 + 59 | Pending |
| 62 | ACFR Verification + Source-Chain Audit + UAT | Phases 58–61 | Pending |

**Critical path:** 58 → 59 → 61 → 62. Phase 60 (salaries) is independent and runs in parallel with 58/59.
**Constraint:** Free sources only; enrichment inline at ~$0 (API cost gate $5 — estimate before any AI run). Every backfilled figure carries durable source attribution.
**Pipeline reuse (zero new tooling):** `bulkLoadStateController.js --county` (history, never-overwrite guard), `loadCountyBudget.js` (county-gov budget), `loadCASalaries.js` (salaries), `seedCountyLinks.js` (linking), runbook `docs/socal-county-onboarding.md`.

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

Last session: 2026-06-16T17:48:00Z
Stopped at: Plan 58-04 complete (light inline verification — all 4 SC pass)
Resume file: .planning/phases/58-la-county-parity-backfill/58-04-SUMMARY.md

### Next Session

Phase 58 is complete. Begin Phase 59 (Remaining CA Cities History + Linking). Unlinked/other-county CA cities need FY2003+ history and county_id linking.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| (v2.0 not yet started) | — | — | — |
| Phase 53 P53-01 | 40 minutes | 5 tasks | 0 files |
| Phase 55 P55-02 | 45min | 3 tasks | 1 files |
| Phase 55 P55-03 | 25min | 2 tasks | 2 files |
| Phase 57 P57-01 | 75min | 5 tasks | 1 files |
| Phase 57 P57-02 | 35min | 3 tasks | 4 files |
| Phase 58 P58-01 | 90min | 5 tasks | 1 file (baseline.md) |

## Decisions

| Decision | Context |
|----------|---------|
| Recon before roadmap (Option 2) | Pulled live samples from every source before writing phases; caught CBO/GAO blocking and the obligations-vs-outlays trap before they could derail a phase |
| FY2025 actuals as headline year | Complete, final, sourced; FY2026 FYTD as live strip — partial-year proportions can mislead |
| Function lens default, agency toggle | "What it's for" is the citizen question; ~20 clean categories vs 800-row agency hierarchy |
| MTS/OMB outlays canonical; USAspending drill-down only | $3.3T gap between obligations and outlays; mixing them would corrupt headline figures |
| 6 phases (43–48), recon folded in | Brief's draft Phase A completed pre-roadmap; B–G became 43–48 |

- [Phase ?]: curl execSync for GCC download: Node 24 fetch blocked by Cloudflare TLS; curl with same browser UA returns HTTP 200, zero new deps
- [55-03]: Year-outer/city-inner sweep: downloads each GCC ZIP once for all 34 OC cities — 16 downloads total vs naive 544; sweepOCSalaries.js
- [55-03]: All 34 OC cities covered by GCC 2009–2024; zero gaps; SC-4 Irvine 2024 exact match delta=$0; 544 salaries rows, 313,085 records loaded
- [Phase ?]: SCO county feed carries per-year estimated_population — no --population fallback needed for OC; per-year denominators (2.98M-3.15M FY2003-2024) more accurate than LA single-year hardcode
- [Phase ?]: loadCountyBudget.js generalizes LA County one-offs into one parameterized script (D-07); is the runbook Step 5 tool for any future CA county budget load
- [Phase ?]: ACFR cross-check FY2010: SCO all-governmental-funds 3.007B vs ACFR gov-activities approx 2.35B; delta is documented variance (all-funds basis includes internal service + proprietary funds)
- [Phase ?]: County SourceChip separate block from federal controls to prevent regression
- [Phase ?]: EV-Accounts data_source_info follow-up: API returns null for county/city rows; needs to construct from source_url/source_date/data_source columns
- [58-01]: Calabasas (FY2004+) and Sierra Madre (FY2006+) are genuine SCO source gaps — both cities excluded from SCO FY2003 feed; 86 of 88 LA County cities reach FY2003
- [58-01]: Long Beach FY2022 operating corrected from $634M to $4,249M by re-sync — prior value was an earlier partial SCO load; all-governmental-funds is the correct basis
- [58-01]: 37 remaining NULL source_url are non-SCO custom rows (LA Socrata/Payroll, LB GF, WeHo Demand Register) — out of scope for SCO loader; SCO-source NULL = 0
- [58-04]: 4/4 sampled cities (Burbank, Glendale, Pasadena, Santa Monica) reach FY2003 with /d/ source_url; population non-zero for per-capita
- [58-04]: County entity 44 op+rev rows FY2003-2024; NULL=0; FY2024 $37.577B op / $39.322B rev confirmed; salaries 5 rows + 88 cities all unchanged
- [58-04]: 3 custom cities byte-for-byte unchanged: LA FY2024 op $19,974.3M (Socrata), LB GF FY2025-2026 intact, WeHo Demand Register 9 rows intact
- [58-04]: Basis note gating confirmed by code inspection — cityBasisNotes map has exactly 2 keys (Long Beach|CA, West Hollywood|CA); all other entities return null (no render)
- [58-04]: Formal ACFR reconciliation, source-chain audit, and Chris UAT deferred to Phase 62 (D-09 honored)

## Deferred Items

Carried forward from v1.7–v1.9 (see Known Tech Debt above). New in v2.0 planning:

| Category | Item | Status |
|----------|------|--------|
| data | CBO program descriptions as explainer source | cbo.gov bot-blocks; manual download workflow if needed |
| feature | Votes/amendments exploration hub | Future milestone — the eventual mission destination |
| feature | Sourcing backfill to cities/states | After the standard is proven federally |
| milestone | **Historical backfill — prior fiscal years (FY2024 ← back) at v2.0 detail** | RECOMMENDED NEXT (Chris asked 2026-06-12). Cheap parts already done: annual_summary already holds 64 years (FY1962+); explainers (name_key-keyed) + program origins (law-keyed, not year-keyed) are year-independent and need ZERO rework. Real work = iterate the OMB loader (Hist 3.2 outlays-by-function, 4.1/5.1 by-agency) across prior years + recompute per-year visual-vs-official disclosures + revenue-by-source per year + YearSelector wiring. Watch: function/agency definitions drift over decades (comparability notes); per-year actuals vs estimates. Same free sources + same loader pattern as 44. |

### Acknowledged at v2.2 close (2026-06-16)

Open-artifact audit at v2.2 close surfaced 4 items, all non-blocking and acknowledged (re-deferred). None are v2.2 blockers — all phases 52–57 have VERIFICATION files and the milestone audit PASSED 16/16:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 57 `57-HUMAN-UAT.md` | passed — 0 pending scenarios (flagged only because the file exists; UAT signed off) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, also acknowledged at v2.0 + v2.1 close |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort; see untracked scripts/_verify-longview-temp.mjs |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |

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
