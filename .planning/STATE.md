---
gsd_state_version: 1.0
milestone: v2.17
milestone_name: Tucson, AZ City Onboarding
status: verifying
last_updated: "2026-07-10T17:29:25.523Z"
last_activity: 2026-07-10
progress:
  total_phases: 29
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 7
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-10 — v2.17 Tucson, AZ City Onboarding STARTED)

**Core value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.
**Current focus:** Phase 129 — data-model-load-enrichment

## Current Position

Phase: 129 (data-model-load-enrichment) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Last activity: 2026-07-10

## Phase Overview — v2.17 Tucson, AZ City Onboarding

| Phase | Name | Requirements | Depends on | Status |
|-------|------|--------------|------------|--------|
| 128 | Recon + Extractor | TUC-01, TUC-02 | — | ○ Not started |
| 129 | Data Model + Load + Enrichment | TUC-03, TUC-04, TUC-05, TUC-06 | 128 | ○ Not started |
| 130 | Verification + Live UAT | TUC-07, TUC-08, TUC-09 | 128, 129 | ○ Not started |

**Critical path:** 128 → 129 → 130. A single-city onboarding on the proven one-off pipeline (`seedGreshamOregon.js` → `extractTucson.py` → `processTucson.js`). Phase 128 enumerates the published Tucson ACFR years, pins durable per-year URLs, proves clean `pdftotext -table` extraction of the **General Fund** column (bookend-tie $0 to printed Total revenues/expenditures), locks the deepest contiguous clean window, and builds the extractor (GF revenue-by-source + 2-level expenditure-by-function). Phase 129 seeds Tucson (city, pop ~542k/2024) + a **Pima County** navigation node under Arizona, links them (US→Arizona→Pima County→Tucson + Cities-in-County panel), loads GF operating + revenue for the window via source-safe `treasury_sync_budget_tree` (never-overwrite, durable `source_url`+`source_date`, per-capita, Money In auto-enable), and enriches to 100% bleed-safe coverage. Phase 130 = loader-independent blind re-derivation ($0 delta) → source-chain audit (0 residue) → Chris live UAT → confirm the v2.16 Essentials tether icon on Tucson's banner (TUC-09; cross-repo coverage gap documented if absent). **Constraints:** free ACFR PDFs only ($0 / $5 AI gate); **General Fund** basis (all-funds deferred); source-safe never-overwrite; every figure durably sourced; executed inline (no subagents). FY2024 probe = best-case (GF rev $773.5M / exp $648.7M both tie $0). **Deferred:** Pima County's own budget (navigation node only), all-funds view, Tucson salaries, OpenGov adopted-budget layer, other AZ cities. Scoping + probe: `.planning/TUCSON-SCOPING.md`.

## Deferred Items

### Acknowledged at v2.16 close (2026-07-08)

Open-artifact audit at v2.16 close surfaced 5 items, all non-blocking (Chris chose Acknowledge & proceed). None are v2.16 (Tethered Icons) work — Phase 127 verified the whole milestone end-to-end (TETH-03 7/7 headless matrix against live catalog + real DB entities; VER-01 Chris live-app sign-off 2026-07-08, 0 defects):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 127 `127-UAT.md` | passed — 0 open scenarios (Chris signed off 2026-07-08; audit flags it only because the file exists and its custom format isn't parsed) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried from v2.12; the only genuinely-open item |
| quick_task | 001-create-treasury-tracker-entries-for-ever | **complete, not orphaned** — Collin County TX seeder (live in DB); "missing" is the SUMMARY-filename detection quirk (per v2.15 correction) |
| quick_task | 002-add-longview-tx-revenue | **complete, not orphaned** — Longview TX FY2026 revenue loaded (live in DB) |
| quick_task | 003-longview-operating-budget | **complete, not orphaned** — Longview TX FY2026 operating budget loaded (live in DB) |

### Acknowledged at v2.15 close (2026-07-06)

Open-artifact audit at v2.15 close surfaced 5 items, all non-blocking. None are v2.15 blockers — Phase 124 verified the whole milestone end-to-end (VER-09 149/151 blind re-derivation exact $0 + 14/14 cohort audit incl. NASBORT-01 + 50/50-ACFR; VER-10 Chris live UAT 12/12 all-pass):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 124 `124-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 12/12 2026-07-05; flagged only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | **deferred** — frontend-routing follow-up carried from v2.12; the only genuinely-open item |
| quick_task | 001-create-treasury-tracker-entries-for-ever | **complete, not orphaned** — Collin County TX municipality seeder (28 munis, live in DB). `status: complete` added to frontmatter; the audit's "missing" is a SUMMARY-filename detection quirk (`NNN-SUMMARY.md` short-id form vs the full-dirname form the handler expects) |
| quick_task | 002-add-longview-tx-revenue | **complete, not orphaned** — Longview TX FY2026 revenue loaded (commits 7b68c08/a4ce792/5bcad47), live in DB |
| quick_task | 003-longview-operating-budget | **complete, not orphaned** — Longview TX FY2026 operating budget loaded (27 depts, $104.8M, commit 0eb1f6d), live in DB |

Note: the v2.14-close notes below mislabelled the three quick tasks as "orphaned (file missing)" — they are in fact completed loads with PLAN + SUMMARY files; corrected here.

### Acknowledged at v2.14 close (2026-07-03)

Open-artifact audit at v2.14 close surfaced 5 items, all non-blocking and acknowledged (deferred). None are v2.14 blockers — Phase 116 verified the whole milestone end-to-end (VER-07 75/75 blind re-derivation exact $0 + 12-invariant cohort audit; VER-08 Chris live UAT 11/11 all-pass) and the milestone audit closed PASSED 20/20:

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 116 `116-UAT-CHECKLIST.md` | passed — 0 pending scenarios (Chris signed off 11/11 2026-07-03; flagged only because the file exists) |
| todo | `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction.md` | deferred — frontend-routing follow-up carried from v2.12 |
| quick_task | 001-create-treasury-tracker-entries-for-ever | orphaned (file missing) — pre-v2.0 leftover, acknowledged at every close since v2.0 |
| quick_task | 002-add-longview-tx-revenue | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.14 |
| quick_task | 003-longview-operating-budget | orphaned (file missing) — pre-v2.0 Longview TX effort, unrelated to v2.14 |

**v2.14 tech debt (documented, not fixed — all advisory, none affect figure correctness/tie-outs/sourcing; see milestones/v2.14-MILESTONE-AUDIT.md):** WR-04..07 loader error-path robustness (`process.exit(2)` inside `try` bypasses `finally` residue cleanup; swallowed select error; mid-run partial-load risk — fleet-wide, self-heals on next run's start-delete, **never manifested in any v2.14 run**); AL "Charges"→"Changes" category-label drift (`processALAcfr.js` FY2018+, unverified against source PDF, ties unaffected — worth a source spot-check); UT trailing-space category name (`processUTAcfr.js:111`, cosmetic); NJ phantom-comment referencing a non-existent `isolateNJStatement()` guard (guard logic lives only in the loadlog). **RESOLVED this milestone:** WR-05 data_sources residue → fixed by LOAD-01 (Phase 111), proven end-to-end. **Nyquist:** VALIDATION.md exists for 111/115/116 (all compliant); 112 is doc-only recon (N/A); 113/114 data loads are covered by Phase 116's 75/75 blind re-derivation (stronger than a formal harness) — optional `/gsd-validate-phase 113`/`114` if complete paperwork is wanted.

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

Last session: 2026-07-10T17:29:25.510Z
Stopped at: Completed 129-03-PLAN.md (Tucson enrichment 100% coverage, idempotent, 0 bleed)
Resume file: None

### Next Session

v2.14 State ACFR Long Tail — Tranche 3 + Deepening is shipped + archived (tag v2.14). Cohort now 29 ACFR + 21 NASBO = 901 rows, 0 anomalies; WR-05 loader debt retired (LOAD-01). No active milestone. Start the next one:
  /gsd-new-milestone   (questioning → research → requirements → roadmap; phases continue from 117)
Leading candidates: ACFRX-03 (final ~21 NASBO states → ACFR, retiring NASBO to fallback-only — incl. OK, reconned + deferred out of v2.14); votes/amendments hub (VOTES-01); sourced-standard backfill to city data (SRCSTD-01); deeper history on the other ACFR nodes (CA/NY/FL/TX pre-window holes).

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
| Phase 114 P01 | 17min | 3 tasks | 3 files |
| Phase 114-02 PP02 | 45min | 3 tasks | 3 files |
| Phase 114 P03 | 20min | 3 tasks | 3 files |
| Phase 114 P04 | 25min | 3 tasks | 3 files |
| Phase 114 P05 | 70min | 3 tasks | 3 files |
| Phase 115 P01 | 32min | 3 tasks | 3 files |
| Phase 115-deepening-recoverable-holes-pre-gasb-34-extractor P02 | 65min | 3 tasks | 6 files |
| Phase 115 P03 | 50min | 3 tasks | 5 files |
| Phase 116 P01 | 40min | 3 tasks | 2 files |
| Phase 116-verification-source-chain-audit-uat-ver-07-ver-08 P02 | 25min | 3 tasks | 2 files |
| Phase 119 P01 | 60min | 3 tasks | 3 files |
| Phase 119 P02 | 35min | 3 tasks | 2 files |
| Phase 119-acfr-upgrade-batch-2-ia-ks-me-ms-mt-acfr-38-42 PP03 | 55min | 3 tasks | 2 files |
| Phase 120 P01 | 15min | 3 tasks | 1 files |
| Phase 120 P03 | 45min | 3 tasks | 3 files |
| Phase 120 P04 | 40min | 3 tasks | 3 files |
| Phase 120 P05 | 15min | 3 tasks | 3 files |
| Phase 121 P01 | 30min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P03 | 105min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P04 | 40min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P121-05 | 25min | 3 tasks | 3 files |
| Phase 121-acfr-upgrade-batch-4-ok-ri-sd-vt-wv-wy-acfr-48-53 P121-06 | 55min | 3 tasks | 4 files |
| Phase 124 P01 | 60min | 2 tasks | 2 files |
| Phase 124 P02 | 65min | 2 tasks | 2 files |
| Phase 124 P03 | 20min | 2 tasks | 1 files |
| Phase 125 P125 | 25min | 4 tasks | 9 files |
| Phase 126 P126 | 16min | 5 tasks | 12 files |
| Phase 129-data-model-load-enrichment P01 | 35min | 2 tasks | 1 files |
| Phase 129 P02 | 45min | 3 tasks | 1 files |
| Phase 129 PP03 | 30min | 2 tasks | 3 files |

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
- [Phase 114-01]: SC's printed statement puts a single 'Taxes:' header ahead of ALL revenue lines (confirmed all 24 years) -- fixed via a new gen_state.py rev_boundary config option rather than hand-authoring category names
- [Phase 114-01]: Loaded the full FY2002-FY2025 SC window (24 years) with zero honest holes -- every year tied exactly on first extraction pass
- [Phase ?]: FY2023 KY ACFR PDF has no ToUnicode CMap on any embedded font (garbles the whole document) -- omitted as honest hole, distinct from FY2002's OCR-scan case where the numeric table still extracted cleanly
- [Phase ?]: extract_gf.py pending-prefix accumulator fixes two-line wrapped category labels generically (KY discovered it, reusable for future states)
- [Phase ?]: KY's ~1.09x near-parity vs NASBO matches IN's mechanism: Federal reported through a separate major fund column, not consolidated into GF
- [Phase 114-03]: UT GF-alone scope decision (ACFR-31): loaded the printed General Fund column alone, not a GF+Income Tax Fund composite -- the tranche's one narrower-than-NASBO state (~0.83x-0.91x), driven by the Amendment G constitutional income-tax earmark in a separate major fund
- [Phase 114-03]: UT gen_state.py default_rev_name generalized to pluralize a label already ending in singular Tax (e.g. Sales and Use Tax -> Sales and Use Taxes) instead of appending a redundant taxes suffix -- reusable fix
- [Phase 114]: AL GF-alone scope decision (ACFR-31): loaded printed General Fund column alone, not GF+Education Trust Fund composite -- 0.24x narrower than NASBO (tranche's narrowest), corroborated by GF+ETF ~1.04x NASBO (constitutional dual-budget driver)
- [Phase 114]: gen_state.py generalized with fy_end + fiscal_year_start_month config options (MI Sep-30 precedent) for AL rather than a bespoke loader -- reusable for future non-June-30 states
- [Phase 114]: LA GF-alone (ACFR-31): ~1.90x NASBO divergence driven by ~99% federal Intergovernmental Revenues in the GF; own-source state taxes booked entirely to the separate Bond Security & Redemption Fund column -- unique structural driver in the tranche
- [Phase 114]: extract_gf.py generalized with a position-anchor/first-cell fallback for non-uniform pdftotext -table alignment (LA FY2003-2005) and a whitespace-tolerant statement-header regex (LA FY2016-2019) -- zero regression on 96 already-loaded SC/KY/UT/AL state-years
- [Phase 114]: gen_state.py generalized with smart_title() ALL-CAPS source-label title-casing and a Current/Intergovernmental expenditure-subsection disambiguation rule -- both discovered by LA, reusable for future states
- [Phase 115]: NJ has no pre-GASB-34 boundary -- FY2002 (its first ACFR year) is the archive's edge — NJ adopted GASB 34 in FY2002 itself, so all 18 candidate years FY2002-2019 use the modern statement format and all tie exactly
- [Phase 115]: Kept NJ loaders' embedded-data architecture rather than converting to CT-style runtime parsing — Guarantees zero risk to already-loaded FY2020-2025 rows; newly-recovered years extracted once via the shared parser, verified tied, then embedded as static data
- [Phase 115-02]: pre34Extract.mjs (position-anchored) ties all 14 CT pre-34 years exactly; WI 2000-2001 within TOL; CT FY2006 recovered via free OCR — Zero honest holes in CT/WI deepening; OCR cross-verified row-by-row against printed row totals
- [Phase 115-03]: FY2001 recovered by widening pre34Extract.mjs lookahead window (superset, zero CT/WI regression); FY2002/04/05 dot-leader corruption left as honest hole after abandoning an unsafe bounded-heuristic extractor
- [Phase 116]: MA FY2014 title-anchor bugfix + both pre-flagged rounding-note candidates (WI FY2001, MA FY2014) tied exact $0 — Harness whitespace-tolerant title regex fix; loadlog rounding notes were internal loader printed-vs-line-sum reconciliation, not printed-vs-stored discrepancies
- [Phase 116-02]: INV-6 label regex accepts both ACFR and CAFR (case-insensitive) since pre-GASB-34 rows honestly carry the era-correct CAFR term
- [Phase 116-02]: KY FY2023 modeled as a documented exception in INV-6 (allows 1 NASBO-labelled row) and INV-11 (operating includes FY2023, revenue excludes it)
- [Phase 116-02]: LOAD-01 proven end-to-end: SC + CT FY2025 re-run via guarded treasury_sync_budget_tree = 0 net change, 0 data_sources residue with no manual re-clean
- [Phase ?]: Iowa revenue tree total resolves to NET REVENUES (gross minus Less revenue refunds contra), not gross
- [Phase ?]: Iowa FY2008 omitted as honest hole -- RC4-encrypted PDF, zero-length text extraction on pdftotext and pypdf, no OCR/qpdf tooling available (KY FY2023 precedent)
- [Phase ?]: gen_state.py default_exp_name() generalized with a Capital Outlay dual-subsection disambiguation rule (LA Intergovernmental precedent), reusable for future states
- [Phase 119]: KS: loaded full FY2019-2025 window, zero honest holes; extract_gf.py wide-layout position-anchor (CO/MO precedent) isolated the 8-column General column with no code changes
- [Phase ?]: [119-03]: ME window narrowed to FY2002-2025 (24yr, not the recon's aspirational FY2000-2025 26yr) -- FY2000/FY2001 are pre-GASB-34 COMBINED-statement years with no distinct General column; extract_gf.py correctly reported 'statement not found' rather than mis-transcribing
- [Phase ?]: [119-03]: ME June-30 FY-end confirmed on all 26 downloaded covers (not just recon bookends) -- the pre-recon 'non-June to watch' flag is fully resolved with full-window evidence
- [Phase 120-01]: NE ACFR GF ~1.19x NASBO GF (smallest divergence in Batch 3) accepted and relabelled honestly — NE General Fund is ~91% own-source (Income Tax + Sales/Use Tax); federal flows post to a separate Federal Fund column, not General
- [Phase 120-01]: extract_gf.py generalized: U+FFFD treated as a DASH_TOKEN — Fixes a silent column-shift bug on PDFs (NE FY2024) that render blank GF cells as an invalid UTF-8 byte (0xAD soft hyphen) instead of ASCII dash
- [Phase ?]: NH ACFR GF ~3.22x NASBO GF (widest divergence in Batch 3) accepted and relabelled honestly -- Federal Government (48%) + Special Taxes consolidated into GAAP General column
- [Phase ?]: NH fetched via Wayback Machine mirror (CDX API timestamp resolution + if_ modifier URLs) rather than browser-download -- das.nh.gov/www.das.nh.gov Akamai-blocks all automated fetch, harder than tn.gov precedent
- [Phase ?]: NM ACFR GF ~3.06x NASBO GF accepted honestly -- federal passthrough (38% of GF) plus own-source oil/gas royalties (Rentals and Royalties $5.35B FY2024) both consolidated into the GENERAL FUND column
- [Phase ?]: NM FY2020/FY2021 left as an honest gap -- only DFA's own narrower single-agency 341 filings found for those years, not the statewide 341-A ACFR
- [Phase ?]: NM FY2022 image-only statement page hand-transcribed from Phase 117's already-rendered PNGs, independently re-summed to $0 diff, confirming the recon's own hand-verification
- [Phase ?]: NM FY2023 opaque filename discovered live via a Wayback CDX directory-listing crawl of the known 2024 upload folder -- reusable pattern for unlinked-landing-page opaque-slug states
- [Phase 120-05]: ND ACFR GF ~1.57x NASBO (mildest divergence in Batch 3) accepted and relabelled honestly -- own-source Sales/Use + Oil/Gas/Coal taxes dominate GF; federal booked to separate Federal column
- [Phase 120-05]: UNITS=1 dollars hard-set for ND (the ND units trap) -- both bookends dollar-exact confirmed
- [Phase 120-05]: FY2021 -nd filename suffix exception special-cased in SOURCES map (2021-acfr-nd.pdf) rather than assumed derivable
- [Phase 121-01]: extract_gf.py flat() fix generalizes letter-spaced total-row label detection (OK FY2013 discovered it), zero regression across cohort
- [Phase 121-01]: OK FY2019 hand-transcribed from rendered PNG (image-embedded statement table, no text layer), re-summed to $0 diff, NM FY2022 precedent
- [Phase 121-01]: OK ACFR GF ~3.35x NASBO GF (widest in Batch 4) accepted and relabelled honestly -- Federal Grants consolidated into GENERAL column
- [Phase 121-03]: extract_gf.py generalized to match singular 'Revenue:'/'Total Revenue' statement labels -- SD is the first cohort state with singular labels; safe superset, zero regression on the plural-labeled cohort
- [Phase 121-03]: SD 9-year whole-document-scanned/unrenderable PDF hand-transcription (2003-2011 excl. 2002) generalizes the IA FY2008 single-year precedent to a systematic multi-year pattern
- [Phase 121-03]: SD ACFR GF ~1.03x NASBO GF (smallest divergence in the entire v2.15 milestone) -- federal-passthrough revenue routes to non-GF fund columns, keeping GF near-parity
- [Phase 121-04]: VT ACFR-51: UNITS=1 dollars hard-set; extract_gf.py split_row() generalized for zero/one-whitespace dot-leader defect (VT FY2024/2025), zero regression vs ND/SD/MT/NE; ~1.01x near-parity vs NASBO (smallest divergence in Batch 4); FY2023/FY2024 NASBO replaced in place
- [Phase ?]: WV: rev_boundary='Intergovernmental' clears the single 'Taxes:' header (SC/MS/MT precedent); zero hand-patches, all 6 FY2020-2025 years tied exactly on first pass
- [Phase ?]: WV ACFR GF ~3.52x NASBO GF (2nd-largest in Batch 4) accepted and relabelled honestly -- Intergovernmental federal-passthrough ~47% of GF plus nearly all state taxes consolidated into General
- [Phase 121-06]: WY ACFR GF ~2.43x NASBO GF driven by an unusual DUAL mechanism -- Investment Income (largest single GF revenue line, $1.41B FY2025, Permanent Mineral Trust Fund earnings) PLUS Federal ($1.11B) both consolidated into the General column, distinct from every other Batch-4 state's single-driver divergence
- [Phase 121-06]: WY's FY2020 URL is absent from the 117 recon's own SOURCES enumeration (jumps FY2019->FY2021) -- discovered live off sao.wyo.gov/publications/ during the load, no honest hole resulted
- [Phase 121-06]: WY colon-less 'Taxes'/'Current'/'Debt Service' subsection headers (3rd instance of the VT precedent in this cohort) fixed via a dedicated wy_assemble.py post-process pass -- labels only, all 21 years re-verified tying identically before/after
- [Phase 121-06]: MILESTONE: Wyoming (ACFR-53) was the final state -- all 50 US states now carry a State-ACFR-sourced General Fund (revenue-by-source + spending-by-function), completing Batches 1-4 (Phases 118-121) ahead of Phase 123 (NASBO Retirement) and Phase 124 (Verification+UAT)
- [Phase ?]: [Phase 124-01]: ID FY2004's ~$22/$29 rounding delta is EXPLAINED (verbatim per the 118-05 loadlog's own documented mixed-unit whole-dollar/thousands normalization), not fixed -- pre-approved loader rounding artifact, not a transcription defect
- [Phase ?]: [Phase 124-01]: IA's NET REVENUES tie is re-keyed directly from the printed NET REVENUES row rather than recomputed as GROSS minus refunds -- the printed statement already bakes in that arithmetic
- [Phase ?]: [Phase 124-01]: OCR-independent checks (NM FY2022, OK FY2019, SD FY2007/FY2010) render+OCR the source PDF fresh every harness run rather than reusing prior PNG renders, to keep the independence claim auditable
- [Phase ?]: [Phase 124-01]: VER-09a result -- 149/151 loader-independent re-derivation checks tie exact $0 across all 21 v2.15 final-tail states + the exhaustive 24-state-FY CA/FL deepening set; 2 explained (ID FY2004 rounding)
- [Phase 124-02]: Fixed a PostgREST 1,000-row pagination gap in the cohort audit before it could corrupt invariants (cohort now totals 1,560 rows, exceeding the default cap)
- [Phase 124-02]: INV-2 allowlists the one documented CA persistent data_sources registry row (ca-acfr-gf-operating) per 122-03-DEEP05-CLOSEOUT.md rather than flagging it as WR-05 residue
- [Phase 124-02]: loadStateGF.mjs --dry-run cannot exercise the isAcfrOccupied guard (returns before the DB read) — verified the guard instead by applying it directly against live data, confirming 0 intended writes to any of the 50 ACFR nodes
- [Phase 124-03]: VER-10 live-app UAT — Chris signed off 12/12 anchors PASS (2026-07-05), 0 defects fixed in-phase; closes the v2.15 human capstone (all 50 states on ACFR)
- [Phase 125]: Federal target string used verbatim as confirmed byte-for-byte by essentials repo (browse_federal_officials=1&browse_label=United+States)
- [Phase 125]: strip() (trailing County / , ST) + normalizePlace() applied identically to entity name and catalog label -- state equality alone disambiguates Washington County OR vs UT
- [Phase 125]: Cross-repo deferral note upgraded from pending to RESOLVED after a live smoke test proved both Essentials-side deliverables (coverage.json+CORS, federal browse route) are already live on production
- [Phase 126]: Registry mirrors Essentials fixed order [essentials, compass, readrank]; only essentials live, compass/readrank always resolve null (reserved, no placeholder icons)
- [Phase 126]: Icon chips always use the -light SVG symbol on a semi-transparent navy chip in both TT themes, no theme branching on the symbol
- [Phase 126]: A covered city/county with no geoid resolves to null (no icon) this phase; flagged for Phase 127 UAT to revisit a label-only fallback
- [Phase 126]: Suppressed a react-hooks/refs (eslint-plugin-react-hooks v7 compiler rule) false positive on @floating-ui/react's refs.setFloating with a scoped eslint-disable-line
- [Phase 129-01]: Pinned real Census Vintage 2024 populations (Tucson 554013, Pima County 1080149) via live curl to www2.census.gov CSVs, not the ~542k/~1.06M planning-doc placeholders
- [Phase 129]: [129-02] toBudgetTree() i[]-multi-item recipe (not further c[] nesting) confirmed against 4 loaders + live _treasury_insert_tree contract as the correct 2-level RPC-write pattern — Matches processPortland.js/loadFederalAgencies.js precedent; plan's D-08 wording followed literally
- [Phase 129]: [129-02] Live load complete: 20/20 Tucson budgets rows (10 FY x operating+revenue), independent re-derivation ties 128-RECON.md printed totals at exact $0, idempotent (0 net change on re-run), 0 data_sources residue — processTucson.js via treasury_sync_budget_tree; py -3 used instead of python (env quirk)
- [Phase ?]: 129-03: Tucson operating tree's drill-down leaves live in budget_line_items (i[] recipe), not depth-1 budget_categories; enrichment worklist derives from the 15 depth-0 keys (true 100% of what is enrichable) -- no schema change

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
