---
gsd_state_version: 1.0
milestone: v2.14
milestone_name: State ACFR Long Tail — Tranche 3 + Deepening
status: executing
last_updated: "2026-07-03T00:48:17.007Z"
last_activity: 2026-07-02 -- Phase 113 COMPLETE (verified 14/14) — 5 states live on ACFR GAAP
progress:
  total_phases: 31
  completed_phases: 1
  total_plans: 8
  completed_plans: 3
  percent: 3
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-02 — v2.14 State ACFR Long Tail — Tranche 3 + Deepening STARTED)

**Core value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.
**Current focus:** Phase 113 — ACFR Upgrade — Batch 1 (IN/AZ/OR/MO/CO)

## Current Position

Phase: 113 (ACFR Upgrade — Batch 1 (IN/AZ/OR/MO/CO)) — COMPLETE 2026-07-02
Plan: 1 of 5
Status: Phase 113 complete — next: Phase 114 (batch 2) ∥ Phase 115 (deepening)
Last activity: 2026-07-02 -- Phase 113 COMPLETE (verified 14/14) — IN/AZ/OR/MO/CO live on ACFR GAAP, 68 state-years, 0 residue

## Phase Overview — v2.14 State ACFR Long Tail — Tranche 3 + Deepening

| Phase | Name | Requirements | Depends on | Status |
|-------|------|--------------|------------|--------|
| 111 | Loader Debt — Atomic data_sources Upsert | LOAD-01 | — | ✅ COMPLETE — verified 3/3, 2026-07-02 |
| 112 | Recon — Roster Lock + Source Location + Overlap Resolution | RECON-09, RECON-10 | 111 | ○ Not started |
| 113 | ACFR Upgrade — Batch 1 (IN/AZ/OR/MO/CO) | ACFR-21..25, ACFR-31, ACFR-32 | 112 | ✅ Complete 2026-07-02 |
| 114 | ACFR Upgrade — Batch 2 (~5 states) | ACFR-26..30, ACFR-31, ACFR-32 | 112 | ○ Not started |
| 115 | Deepening — Recoverable Holes + Pre-GASB-34 Extractor | DEEP-02, DEEP-03, DEEP-04 | 111 | ○ Not started |
| 116 | Verification + Source-Chain Audit + UAT | VER-07, VER-08 | 113, 114, 115 | ○ Not started |

**Critical path:** 111 → 112 → (113 ∥ 114 ∥ 115) → 116. **WR-05 loader fix FIRST** (Phase 111) so every load this milestone runs residue-free. Then recon locks the ~10-state tranche-3 roster (candidates AZ/IN/CO/MO/KY/OR/SC/LA/OK/UT, ranked from NASBO 2025 SER — substitutions documented) and upgrades each NASBO→**State-ACFR GAAP** GF revenue-by-source + finer spending-by-function as deep as durable URLs allow. Deepening (Phase 115, parallel with the batches) recovers the v2.13 holes: MA FY2001/02/04/05/14/21, CT FY2006 (OCR), NJ pre-FY2020, CT/WI pre-GASB-34 via a new pre-GASB-34 extractor + honest basis label. Cohort 19 ACFR nodes → ~29. Constraints: free ACFR PDFs only ($0/$5 AI gate); GENERAL FUND column of the Governmental Funds Statement (`pdftotext -table`); every figure durably sourced + basis-labelled; P2 clamp; idempotent never-overwrite (existing 19 ACFR nodes + un-upgraded NASBO states untouched); executed inline (no subagents); clone the proven per-state loader template; `loadStateGF.mjs` stays the NASBO fallback. No frontend work — Money In + `?dataset=revenue` auto-enable. Closeout = independent blind re-derivation → 50-state cohort audit (0 residue, no manual re-clean — proves LOAD-01) → Chris live UAT (Phase 102/106/110 mold). See [[project_acfr_recon_structure_unreliable]] + [[project_state_node_unsourced_estimates]].

## Deferred Items

### Acknowledged at v2.13 close (2026-07-02)

Open-artifact audit at v2.13 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.13 blockers — Phase 110 verified the whole milestone end-to-end (VER-05 49/49 independent re-derivation + 10/10 cohort audit; VER-06 Chris live UAT 11/11 all-pass) and the milestone audit closed at 18/18:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 110 `110-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 11/11 2026-07-01; flagged only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | deferred — frontend-routing follow-up carried from v2.12 |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.13 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.13 |

**v2.13 follow-ups (documented, not fixed):** WR-05 loader data_sources residue (recurs on every `process*Acfr.js` run until the upsert is atomic; re-cleaned in 110-02 + after the 108-closure NJ re-run); recoverable history holes (MA FY2001/02/04/05/14/21, CT FY2006 OCR, NJ pre-FY2020, CT/WI pre-GASB-34 — need a pre-GASB-34 extractor + basis label); state-node hero banners default to Wikipedia's lead image = low-res state flag (cosmetic; fix paths diagnosed in 108-UAT.md Gaps).

### Acknowledged at v2.6 close (2026-06-22)

Items acknowledged and deferred at v2.6 milestone close on 2026-06-22:

| Category | Item | Status | Note |
|----------|------|--------|------|
| phase | 77-where-the-money-goes-graphic (EVVIZ-01) | iceboxed | Deliberate icebox — flat 6-category data makes a dedicated graphic low-value; revisit in a future milestone |
| quick_task | 001-create-treasury-tracker-entries-for-ever | missing | Unrelated to v2.6 (city-data); stub with no recorded work |
| quick_task | 002-add-longview-tx-revenue | missing | Unrelated to v2.6 (Longview TX city-data) |
| quick_task | 003-longview-operating-budget | missing | Unrelated to v2.6 (Longview TX city-data) |

**Re-deferred at v2.11 milestone close (2026-06-29):** the same 3 Longview-TX quick-task stubs (001/002/003) resurfaced in the v2.11 pre-close audit — they remain unrelated to the State ACFR milestone and stay deferred (Chris-acknowledged). The Phase 101 verification gap from the same audit was *resolved* (closed by Phase 102 VER-02 UAT sign-off), not deferred.

### v2.6 EV Financial Transparency Refresh context

- **Scope:** Empowered Vote's OWN organizational financials (not geographic). Refresh donation/income figures by idempotently combining all sources, add a donor-facing transparency view, and add an actual "where the money goes" spend graphic. *(Graphic — Phase 77/EVVIZ-01 — ICEBOXED 2026-06-22; deferred to a future milestone.)*
- **Sources (all idempotent CSV merge — no live API this milestone):**
  - **GiveButter** — primary; already has live webhook → Supabase rows. Fresh export must dedup against webhook rows by `external_id`.
  - **Patreon** — recurring donations, CSV export.
  - **Benevity** — workplace/matching giving, export.
  - **Beneficial State Bank** — transaction CSV export confirmed available (Chris, 2026-06-20). **Authoritative for cash balance + expenses.**
  - **Manual / off-platform** — checks, grants, in-kind.
- **🔑 Reconciliation rule (design at Phase 75 plan time):** bank = balance/expense truth; platforms = income detail. A platform payout deposited in the bank must NOT be counted twice on top of the platform donations that produced it (deposits arrive net of platform fees).
- **EV is all-volunteer, $0 staff comp** — expense breakdown should make this obvious (reinforces the donor story).
- **Inputs still needed from Chris:** the fundraising **goal figure** (EVVIEW-04); the current set of expense categories the bank debits should roll up into.
- **Constraints:** free/low-cost only (unfunded nonprofit); $5 AI-spend gate — estimate before any AI run; every displayed figure sourced (platform export, bank statement, or manual-entry record). Live host `treasurytracker.empowered.vote`.
- **Reuse:** `scripts/loadEVFinances.js` (CSV → Supabase), the existing webhook dedup (`external_id` + source columns), the nonprofit display mode / brand-tile system, and the verification/source-chain + UAT pattern from prior milestones.
- **Parked:** Ohio geographic milestone (recon'd, `reference_ohio_aos_financial_data`) — a future candidate, not v2.6.

## Phase Overview

| Phase | Name | Requirements | Depends on | Status |
|-------|------|--------------|------------|--------|
| 74 | Donation Source Refresh (Idempotent Income Merge) | EVDATA-01, EVDATA-02, EVDATA-03 | — | ✅ COMPLETE — verified, Chris UAT all-pass 2026-06-20 |
| 75 | Bank Truth + Reconciliation | EVDATA-04, EVDATA-05, EVDATA-06 | 74 | ✅ COMPLETE — verified 2026-06-21 |
| 76 | Donor-Facing Transparency View | EVVIEW-01..04 | 75 | ✅ COMPLETE — verified, Chris live UAT 2026-06-21 |
| 77 | "Where the Money Goes" Graphic | EVVIZ-01 | 76 | 🧊 ICEBOXED 2026-06-22 (deferred — see ROADMAP) |
| 78 | Reconciliation Audit + Live-App UAT | EVVER-01, EVVER-02 | 74–76 | ▶ Starting (wrap-up) |

**Critical path:** 74 → 75 → 76 → 78 (77 iceboxed). Phase 78 verifies the refreshed figures + transparency view.
**Constraint:** Idempotent CSV merge; free/low-cost only ($5 AI gate); every figure sourced; bank authoritative for balance + expenses, platforms for income detail (never double-count).

## Accumulated Context

### v2.6 Phase 74 close (2026-06-20)

- **Phase 74 COMPLETE + verified.** FY2026 EV donation income refreshed from platform exports: GiveButter $703, Patreon $370, Benevity $1,475, Interest $0.51 = **$2,548.51** (was $1,256.51). Idempotent, dedup'd (export-baseline + webhook-delta), aggregate-only (no donor PII). `scripts/loadEVDonations.js` + tests; `loadEVFinances.js` writes expenses only now (D-08). Chris UAT all-pass.
- **Benevity FY basis = disbursement date (cash basis)** — matches the bank. Fixed a cross-year double-count: 14 Dec-2025 gifts ($207.50) were in both FY2025 (old sheet) and FY2026; removed from FY2025 (→ $2,340.01).
- **Phase 75 expense side PULLED FORWARD (Chris asked):** `scripts/loadEVBank.js` loads every Beneficial State Bank debit as the FY operating dataset. FY2026 operating $969.33 (stale sheet) → **$1,745.65** (bank truth): AI & Research $820.60 (Anthropic $680.60!), Infra & Hosting $473.43, Design $410.31, Domains $39.95, Bank Fees $1.36. Idempotent + tested, source='bank'. No transfers/payroll (all-volunteer).
- **🔑 Phase 75 remaining:** cash balance ($1,706.77 @ 6/17) + runway; deposit↔donation reconciliation (gross donations vs. net deposits — don't double-count); manual/off-platform entries; **track + display platform fees** (~$125/FY, captured by loadEVDonations D-09 but currently dropped — Chris explicitly wants these visible, the cost-of-fundraising story).

### Roadmap Evolution

- Phase 71.1 inserted after Phase 71: Single-scan rollup ETL — replace per-(entity,FY,type) live BigQuery queries (full-table scans, ~$132/day) with one rollup scan into Supabase; manual refresh (URGENT)

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

Last session: 2026-07-02T22:21:55.179Z
Stopped at: Completed 112-03-PLAN.md — Phase 112 recon complete, ready for verification
Resume file: None

### Next Session

v2.13 State ACFR Long Tail — Tranche 2 is shipped + archived (tag v2.13). No active milestone. Start the next one:
  /gsd-new-milestone   (questioning → research → requirements → roadmap; phases continue from 111)
Leading candidates: ACFRX-02 (remaining ~31 NASBO states → ACFR, and/or the v2.13 recoverable-holes deepening pass — MA/CT/NJ/WI older years, needs a pre-GASB-34 extractor); votes/amendments hub (VOTES-01); sourced-standard backfill to city data (SRCSTD-01); WR-05 atomic data_sources upsert fix.

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
| Phase 62 P62-01 | 50min | 3 tasks | 1 files |
| Phase 62 P62-02 | 30min | 3 tasks | 1 files |
| Phase 62 P62-03 | 45min | 3 tasks | 2 files |
| Phase 81-towns-virginia-data-model-linking P01 | 35 | 4 tasks | 3 files |
| Phase 81-towns-virginia-data-model-linking P02 | 30min | 2 tasks | 3 files |
| Phase 81-towns-virginia-data-model-linking PP03 | 35min | 4 tasks | 5 files |
| Phase 81.5 P01 | 40min | 3 tasks | 2 files |
| Phase 81.5 P02 | 14min | 3 tasks | 2 files |
| Phase 84 P01 | 35min | 3 tasks | 2 files |
| Phase 84 P02 | 30min | 2 tasks | 1 files |
| Phase 85 P01 | 40min | 3 tasks | 3 files |
| Phase 85-city-loads P02 | 23min | 4 tasks | 1 files |
| Phase 86 P86-01 | 7m | 3 tasks | 4 files |
| Phase 86-county-loads-data-model-linking P86-02 | 95min | 4 tasks | 4 files |
| Phase 86-county-loads-data-model-linking P03 | 25min | 3 tasks | 1 files |
| Phase 86-county-loads-data-model-linking P04 | 45min | 3 tasks | 3 files |
| Phase 86-county-loads-data-model-linking P05 | 90min | 4 tasks | 2 files |
| Phase 87-enrichment-parity P87-01 | 11 minutes | 3 tasks | 5 files |
| Phase 88-verification-source-chain-audit-uat P01 | 40 | 2 tasks | 1 files |
| Phase 88 P02 | 23 | 3 tasks | 2 files |
| Phase 92-enrichment-parity-mnenr-01 P01 | 20min | 3 tasks | 5 files |
| Phase 95 P03 | 45 | 2 tasks | 2 files |
| Phase 95 P05 | 5 | 2 tasks | 1 file |
| Phase 96-remaining-states-sgfs-04 P03 | 45 | 2 tasks | 1 files |
| Phase 96-remaining-states-sgfs-04 P04 | 45 | 2 tasks | 1 files |
| Phase 96 P05 | 25min | 2 tasks | 1 files |
| Phase 96-remaining-states-sgfs-04 P06 | 9min | 2 tasks | 1 files |
| Phase 101 P01 | 8min | 3 tasks | 2 files |
| Phase 102-verification-source-chain-audit-uat-ver-01-ver-02 P01 | 45min | 2 tasks | 1 files |
| Phase 102 P02 | 30 | 3 tasks | 2 files |
| Phase 104 P04 | 35min | 4 tasks | 1 files |
| Phase 107-recon P107-01 | 180 | 3 tasks | 1 files |
| Phase 107-recon-acfr-source-location-roster-lock-overlap-resolution-re P107-02 | 120 | 3 tasks | 1 files |
| Phase 107-recon-acfr-source-location-roster-lock-overlap-resolution-re P107-03 | 6min | 2 tasks | 1 files |
| Phase 112 P03 | 95min | 3 tasks | 1 files |

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
- [Phase ?]: FY2023 selected as ACFR reconciliation year; government-wide Statement of Activities is basis-matched comparator
- [Phase ?]: Glendale + Burbank ACFRs inaccessible via free CLI (CDN blocks); FOLLOW-UP per D-08; SCO source-loop + Phase 60 /usr/bin/bash-delta corroboration documents presumptive PASS
- [Phase ?]: signoff-all-pass: all 24 UAT checklist items PASS (Chris, 2026-06-17); VER-04 satisfied
- [Phase ?]: Employees card is year-gated (App.tsx availableDatasetTypes); year=2003 hides salaries tab for FY2009-2024 cohort — correct behavior confirmed UAT
- [Phase ?]: D-08 UX flag: show Employees card for any year salaries exist + prompt year switch (v2.4 candidate, not fixed in phase 62)
- [Phase ?]: Towns stored with BARE display names — zero town/city collisions; 6 town/county overlaps (Bedford, Culpeper, Orange, Pulaski, Tazewell, Wise) safe because counties carry County suffix
- [Phase ?]: Exhibit A town population fallback: col4=name col2=population section-scoped No.-reset; fires only when Exhibit H returns null; cities/counties unchanged
- [Phase ?]: 3 towns absent from ALL published XLSX years (Big Stone Gap, Clifton Forge, Vinton) - documented source gaps, no phantom municipalities; future re-run picks them up idempotently
- [81-02]: Virginia state node pre-existed with prior General Fund budget data (10 rows, source_url=null); seeder returns existing node idempotently; pre-existing data left untouched (different source, no never-overwrite conflict)
- [81-02]: Warren County absent from Phase 80 load (93/95 counties); Front Royal skipped in seeder; vaTownCounties.json has correct entry for auto-link on future re-run
- [81-02]: 33 VA towns linked to parent county via county_id; 4 skipped (3 towns not in DB, 1 county not in DB); idempotent re-run confirmed 0 writes
- [81.5-01]: Benevity = exactly 1 recurring supporter (Chris Andrew's Cisco company-match, 61 rows, 1 donor) — hard rule with code comment; excluded from median
- [81.5-01]: Lean carrier for micro-donation aggregates: item_count + description JSON (_evMicro namespace) on Donations category; no backend schema change, frontend parses in Plan 81.5-02
- [81.5-01]: FY2026 reconciled: 9 supporters (3 GB + 5 Patreon + 1 Benevity), median $10/mo, persisted item_count=9
- [Phase ?]: [85-01]: enumerateCities uses revTotalCol OR expTotalCol (either finite) to skip blank/footer rows — handles rows where one total column may be zero
- [Phase ?]: [85-01]: GAAP→CASH→MOD Map-based assignment: first basis whose workbook contains the city wins; FY2024 dry-run: 245 cities (235 GAAP + 7 CASH + 3 MOD), zero writes, zero failures (D-02)
- [Phase ?]: [85-02]: Zero cross-FY residual across FY2016-2025 — every OI_Demographics city has financial rows; ohioCityResidual.json cities=[] is the durable no-phantom record
- [Phase ?]: [85-02]: FY2025 workbook is preliminary (196 GAAP cities vs ~235-244 in prior years) — loaded as-is per audit completion timing; partial FY noted
- [Phase ?]: Rule 1 bug fix: CASH/MOD county workbooks omit County suffix; normalised in batch driver
- [Phase ?]: [86-02]: Allen County consistent source-gap residual FY2016-2025 — documented in ohioCountyResidual.json, not created as municipality
- [Phase ?]: [86-02]: Ohio state node has pre-existing General Fund data (10 rows, different source) — preserved by never-overwrite guard per VA 81-02 precedent
- [Phase ?]: [86-02]: 249/253 OH cities linked to county via workbook OI_Demographics County column; 4 link-residual (Delphos+Lima=Allen County not loaded, Germantown+Ironton=absent from workbook)
- [86-04]: County GAAP layout is headerRow=6/expTotalCol=32 (not city's row-7/col-35); county CASH/MOD has entityCol=1 (not city CASH's 2); detectLayout gains entityType arg defaulting to 'city'
- [86-04]: Allen County was in the workbook at row 7 (first data row) all along — dropped because city layout misread it as the header row; 64 GAAP counties now enumerated; Franklin County rev=$1,811,422,000 (col 16) / exp=$1,913,193,000 (col 32)
- [Phase ?]: LSC URLs used for OH state-node source stamp; seedOHState.js Step C changed to direct data_sources table query (RPC truncates at 1000 rows)
- [Phase ?]: [88-02]: 4 OH population=0 entities fixed (Ironton+3 counties) from 2020 Census P.L. 94-171
- [Phase ?]: pdftotext -table mode works cleanly for Ohio ACFR two-page spread; all 12 checksums 0 diff
- [Phase ?]: FY2022 OH Investment Income -570453k net loss: P2 clamp applied in revenue loader; audited total 44323336k carried verbatim
- [95-05]: Per-state keep-windows enforced: OH_KEEP=[2020..2025] (6 years), VA_KEEP=[2022..2025] (4 years) — a shared window would have wrongly deleted Ohio FY2020/FY2021 actuals
- [95-05]: 4 OH/VA FY2026 estimate rows (lsc.ohio.gov + dpb.virginia.gov false-provenance) deleted; 4 data_sources rows corrected to ACFR landing pages; all 4 DB probes PASS; idempotent
- [Phase ?]: CO Transportation GF = 1M not zero per NASBO Table 21
- [Phase ?]: 102-02 cohort audit
- [Phase ?]: 107-03: All 10 roster states IN (0 deferred); MA in-place upgrade (no stale data_sources); GA F-97-01 superseded cleanly; NJ=dollars not thousands; MI=September-30 FY-end custom loader
- [Phase ?]: Rank-correction substitution: Oklahoma (weakest named ACFR candidate, actual NASBO rank 14/31) substituted for Alabama (rank 9, next-largest un-upgraded state) per D-01; one round only, OK carried to ACFRX-03 with recon preserved
- [Phase ?]: All 10 locked-roster ACFR states + Alabama substitute confirmed clean NASBO-only nodes via read-only DB probe (zero data_sources residue) — no in-place-upgrade plan needed anywhere in tranche 3, simpler than Phase 107
- [Phase ?]: Alabama's ACFR General Fund is ~0.24x its NASBO GF (narrowest divergence in the v2.14 tranche) due to its constitutional GF/Education-Trust-Fund dual-budget split; flagged as a Phase-114 load-time decision, not resolved in recon

## Deferred Items

Carried forward from v1.7–v1.9 (see Known Tech Debt above). New in v2.0 planning:

| Category | Item | Status |
|----------|------|--------|
| data | CBO program descriptions as explainer source | cbo.gov bot-blocks; manual download workflow if needed |
| feature | Votes/amendments exploration hub | Future milestone — the eventual mission destination |
| feature | Sourcing backfill to cities/states | After the standard is proven federally |
| milestone | **Historical backfill — prior fiscal years (FY2024 ← back) at v2.0 detail** | RECOMMENDED NEXT (Chris asked 2026-06-12). Cheap parts already done: annual_summary already holds 64 years (FY1962+); explainers (name_key-keyed) + program origins (law-keyed, not year-keyed) are year-independent and need ZERO rework. Real work = iterate the OMB loader (Hist 3.2 outlays-by-function, 4.1/5.1 by-agency) across prior years + recompute per-year visual-vs-official disclosures + revenue-by-source per year + YearSelector wiring. Watch: function/agency definitions drift over decades (comparability notes); per-year actuals vs estimates. Same free sources + same loader pattern as 44. |

### Acknowledged at v2.12 close (2026-07-01)

Open-artifact audit at v2.12 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.12 blockers — Phase 106 verified the whole milestone end-to-end (VER-03 independent re-derivation 24/24 exact + cohort audit 7/7; VER-04 Chris live-app UAT 8/8 all-pass); all 8 v2.12 requirements Complete:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 106 `106-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 8/8 2026-06-30, status:passed frontmatter set) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | deferred — signed-in users hit an unrecognized deep-link get sent to their home city; frontend-routing follow-up (canonical `?entity=` links fixed; deeper UX logged) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.12 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.12 |

**v2.12 follow-ups (documented, not fixed):** authenticated deep-link redirect UX smoothing (todo above); Phase-104 deepening holes (NY ≤FY2002, CA FY2002–2007, FL ≤FY2020) intentionally absent-by-design (recorded + honest in UI, verified PASS by D-06); 105 code-review non-blocking items WR-01/03/04/05 (clamp root-vs-child invariant, validate() tolerance, `strict:false` arg parsing, non-atomic `data_sources` upsert — the WR-05 pattern re-created 2 residue rows during 106 idempotency re-runs, cleaned in-phase); next-tranche NASBO→ACFR upgrades (ACFRX-01/02, future milestone).

### Acknowledged at v2.5 close (2026-06-20)

Open-artifact audit at v2.5 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.5 blockers — Phase 73 verified the whole milestone end-to-end (UVER-01 ACFR recon + source-chain audit, UVER-02 Chris UAT all-pass):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 73 `73-03-UAT-CHECKLIST.md` | 0 pending scenarios (flagged only because the file lacks status frontmatter; UAT signed off all-pass 2026-06-20, recorded in 73-03-SUMMARY + 73-VERIFICATION) |
| verification_gap | Phase 71 `71-VERIFICATION.md` | `human_needed` — salaries human-UAT flag; functionally satisfied by Phase 73's all-pass UAT (which exercised salaries). Stale flag. |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to Utah |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to Utah |

**v2.5 follow-ups (from Phase 73, D-73-07/08 — documented, not fixed):** 4 pre-existing non-P72 `$`-leak universal enrichment rows (2026-03-28 origin: parking meter, harbor/port, sewer, solid waste enterprise fund) — bleed-safety cleanup; Salt Lake County FY2025 salaries (1 absent combo, fills on next FY2025-complete rollup refresh).

### Acknowledged at v2.7 close (2026-06-23)

Open-artifact audit at v2.7 close surfaced 6 items, all non-blocking and acknowledged (deferred). None are v2.7 blockers — Phase 83 verified the whole milestone end-to-end (VAVER-01 ACFR recon + source-chain audit, VAVER-02 Chris UAT all-pass); all VA requirements Complete:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 81 `81-HUMAN-UAT.md` | resolved — 0 open scenarios |
| uat_gap | Phase 81.5 `81.5-HUMAN-UAT.md` | resolved — 0 open scenarios |
| uat_gap | Phase 83 `83-03-UAT-CHECKLIST.md` | 0 open scenarios — flagged `unknown` only because the checklist lacks status frontmatter; Chris signed off all-pass 2026-06-23 (recorded in 83-03-SUMMARY + 83-VERIFICATION) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to VA |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to VA |

**v2.7 follow-ups (from Phases 80/83 — documented, not fixed):** 6 localities absent in ALL published XLSX years (cities Colonial Heights/Emporia/Hopewell/Norton; counties Lee/Warren — multi-year-overdue audits) + Covington/Alleghany null population (FY2024 school-consolidation footnote) — picked up idempotently on a future re-run; 3 towns absent from all XLSX years (Big Stone Gap, Clifton Forge, Vinton).

### Acknowledged at v2.10 close (2026-06-29)

Open-artifact audit at v2.10 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.10 blockers — Phase 97 verified the whole milestone end-to-end (SGFS-05 cohort source-chain audit + "Representative 7" reconciliation + Chris UAT 21/21 all-pass); all 5 SGFS requirements Complete:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 93 `93-UAT-CHECKLIST.md` | passed — 0 open scenarios (v2.9, already shipped) |
| uat_gap | Phase 97 `97-UAT-CHECKLIST.md` | passed — 0 open scenarios; status:passed frontmatter added at close (Chris signed off 21/21 2026-06-29) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.10 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.10 |

**v2.10 follow-ups (from Phase 97 — documented, not fixed):** cohort revenue-by-source (NASBO has none per-state → future per-state ACFR upgrades for high-traffic states, the OH/VA path); MN FY1997–2007 history + the MN FY2008 operating $8.79M categorization gap (0.055%, needs FY2008 ACFR re-extraction); minor frontend `?dataset=revenue` URL robustness on operating-only nodes (normal navigation unaffected).

### Acknowledged at v2.2 close (2026-06-16)

Open-artifact audit at v2.2 close surfaced 4 items, all non-blocking and acknowledged (re-deferred). None are v2.2 blockers — all phases 52–57 have VERIFICATION files and the milestone audit PASSED 16/16:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 57 `57-HUMAN-UAT.md` | passed — 0 pending scenarios (flagged only because the file exists; UAT signed off) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, also acknowledged at v2.0 + v2.1 close |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort; see untracked scripts/_verify-longview-temp.mjs |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |

### Acknowledged at v2.3 close (2026-06-17)

Open-artifact audit at v2.3 close surfaced 4 items, all non-blocking and acknowledged (re-deferred). None are v2.3 blockers — Phase 62 verified the milestone end-to-end (VER-03 + VER-04, 4/4):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 62 `62-03-UAT-CHECKLIST.md` | 0 pending scenarios (flagged only because the file exists; UAT signed off all-pass 2026-06-17) |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at v2.0/v2.1/v2.2 closes |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview effort |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview effort |

**v2.4 follow-ups (from Phase 62, D-08 — documented, not fixed):** Glendale + Burbank ACFR reconciliation via manual browser download (CDN blocks CLI); the "Employees" salaries-card year-gating UX (show whenever salaries exist for any year + prompt year switch); the 5,226 single-city salary department-name canonicalization long tail (from Phase 61).

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
