---
phase: 73
slug: utah-verification-source-chain-audit-uat
status: passed
verified: 2026-06-20
method: goal-backward; read-only live DB audit + published-ACFR reconciliation + human live-app UAT
---

# Phase 73 Verification — Utah Verification + Source-Chain Audit + UAT

**Goal:** The Utah expansion is independently reconciled against published ACFRs, the source chain is durable, and Chris signs off in the live app.

**Verdict: PASSED.** All 4 success criteria proven; both phase requirements (UVER-01, UVER-02) satisfied. Read-only throughout — no DB writes, no source-file changes, no live BigQuery, $0.

## Success Criteria

### SC#1 — ≥1 sample entity reconciles vs published ACFR on a basis-matched comparison ✅
**Two** entities reconciled (73-01), including the milestone's first Utah county-government ACFR cross-read:
- **Provo** FY2024 (FYE 6/30): revenue loaded $285,684,201 vs ACFR all-funds (gov + enterprise + internal-service operating) $287,848,962 → **−0.75%**; expenditure $346,484,275 vs ACFR-derived all-funds-cash band ≈$355M → ~−2.6%.
- **Salt Lake County** FY2024 (FYE 12/31): op $1,897,504,796 / rev $1,854,839,553 vs ACFR governmental ($1.566B exp / $1.503B rev) + enterprise + internal-service + other-financing flows → both **~±3%**, explained.
All deltas attributable to the documented all-funds-transaction-vs-separate-ACFR-statement basis (capital outlays included, depreciation excluded, other-financing sources/uses, inter-fund eliminations) — not load defects.

### SC#2 — source-chain audit passes (durable attribution, zero residue) ✅
Full read-only cohort audit (73-02) of all 15 entities: budgets op 180 + rev 180, salaries 179 (120 city + 59 county via the 71.1 rollup) — **every** row carries `data_source='Transparent Utah'` + `source_url='https://transparent.utah.gov'`; **0** NULL-source_url, **0** fragile/version-specific URLs (single durable bare domain), **0** FY2026 rows. Residue: **0** phantom county rows (70-02 cleanup confirmed), **0** null/zero totals, **0** duplicate (mun,fy,dataset). Salaries names-free: **0** PII tokens across all 179 hierarchies. Enrichment: 4,476 universal / **0** duplicate name_keys, **0** city-name leaks across the 3,536 P72 rows.

### SC#3 — live app verified end-to-end ✅
Chris walked the guided checklist (73-03) across Salt Lake City, Salt Lake County, West Valley City, St. George — city + county operating/revenue, salaries (names-free), per-capita, enrichment, Transparent Utah source chips, full breadcrumb chain (US → Utah → County → city), and both multi-city (Salt Lake County, 4 cities) and single-city (Washington County / St. George) Cities-in-County panels. All 22 items pass.

### SC#4 — Chris UAT sign-off recorded ✅
Sign-off captured at the blocking checkpoint (73-03): **"Sign off — all pass."**

## Requirements
- **UVER-01** (basis-matched ACFR reconciliation + full-cohort source-chain audit): satisfied — 73-01 (recon) + 73-02 (audit).
- **UVER-02** (live-app UAT across multiple Utah entities + Chris sign-off): satisfied — 73-03.

## Locked-decision fidelity
- **D-73-01** sample = Provo + Salt Lake County (first county recon) — done.
- **D-73-02/03** basis-matched, explainable tolerance, FY2024 — done.
- **D-73-04** bare-domain transparent.utah.gov accepted as durable bar — confirmed (sole source_url).
- **D-73-06** salaries names-free PII re-verification — 0 PII across 179 rows.
- **D-73-07/08** 4 pre-existing $-leak rows documented, NOT fixed; phase 100% read-only — honored.
- **D-73-09/10** guided UAT, Chris drives, blocking checkpoint, locked 4-entity spread — done.

## Deviations / notes
- **Salaries cohort = 179, not the 120 the plan assumed.** The Phase 71.1 single-scan rollup ETL loaded county PY (59 rows) beyond Phase 71's 10-city/120-row scope. Additional coverage, durably sourced + names-free — not a defect.

## Documented follow-ups (out of this read-only phase's scope)
1. 4 pre-existing ($-leak) universal enrichment rows (2026-03-28 origin: parking meter, harbor and port, sewer, solid waste enterprise fund) — bleed-safety cleanup of the original AI enrichment.
2. Salt Lake County FY2025 salaries (1 absent combo) — fills on the next FY2025-complete rollup refresh.

## Code review
N/A — read-only verification phase, zero source/schema changes (`files_modified: []` on all 3 plans). Regression/schema/codebase-drift gates are no-ops.
