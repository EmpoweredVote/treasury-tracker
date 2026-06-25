# Phase 85 — City Loads — Verification

**Verdict: PASS** (1 minor source-gap finding, non-blocking)
**Method:** Goal-backward, verified by direct production DB read-back (mcp__supabase-local execute_sql) by the orchestrator — not solely from executor self-report.
**Date:** 2026-06-25

## Requirement verdicts

### OHCITY-01 — PASS
All GAAP-filing Ohio cities loaded operating + revenue across the full available FY range, every row sourced, per-capita from `OI_Demographics`.

DB evidence (`treasury.budgets` ⋈ `municipalities`, `data_source='Ohio Auditor of State Summarized Annual Financial Reports'`, `entity_type='city'`, `state='OH'`):
- **4,880 rows / 253 distinct cities / FY2016–2025 (all 10 years)**.
- **0 rows with NULL `source_url`** — 100% sourced.
- Columbus FY2024 read back from DB: revenue **$2,166,549,000** (= recon $2.166B), operating **$2,477,440,000** (= Total Expenditures). Within tolerance.
- Per-capita: 252 of 253 cities have a non-zero population set. **See finding F-1** (Ironton, the sole exception).

### OHCITY-02 — PASS
Non-GAAP cities backfilled from CASH then MOD where GAAP absent; basis recorded per (city, FY); source-gap residual documented; no phantom municipalities.

DB evidence (basis inferred from `source_url`):
- **GAAP**: 4,718 rows / 246 cities (primary).
- **CASH backfill**: 122 rows / 12 cities.
- **MOD backfill**: 40 rows / 4 cities.
- City counts sum to 262 > 253 distinct because some cities are GAAP in some years and CASH/MOD in others — the mixed-basis-across-years behavior locked in CONTEXT D-02.
- **Residual** `scripts/ohioCityResidual.json` committed with `cities: []` — every `OI_Demographics` city across all 10 FY has at least one financial row, so zero demographics-only phantom cities. No municipalities created for unsourced cities.
- Idempotency (executor, re-run of FY2024): 0 new municipalities (253→253), 0 new budget rows — confirms the never-overwrite guard + idempotent writes.

## Findings

### F-1 (minor, non-blocking) — Ironton has population 0 across all FY
The 20 zero/null-population rows are all **Ironton** (10 FY × 2 datasets), the only **pure-MOD** city. The other 3 MOD-basis cities DO carry population, so this is not a MOD demographics-offset bug — Ironton genuinely has no population in the MOD `OI_Demographics` tab for any year. Effect: per-capita will not render for Ironton specifically (252/253 cities unaffected).
**Disposition:** Source gap, not a loader defect. Candidate for a one-off population backfill during Phase 87 (enrichment) or a small manual fix. Does not block Phase 85 or Phase 86.

## Phase 86 readiness
No blockers. The batch driver, `enumerateCities`, the basis-precedence assignment, the residual mechanism, and `cityCounty` (already exported in Phase 84) are all in place for county loads + city→county linking.
