---
phase: 50
slug: federal-yearselector-wiring
status: passed
verified: 2026-06-13
method: contract probe + observed UAT (Chris approved on production)
---

# Phase 50 Verification — Federal YearSelector Wiring

**Phase goal:** A citizen can select any backfilled fiscal year in the federal view and every
panel — function, agency, revenue, landing bands, deficit strip — updates to that year.

**Verdict: PASSED.** Confirmed by live contract probes and Chris's approved UAT on production
(https://treasurytracker.empowered.vote).

## Success criteria (goal-backward)

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | YearSelector lists all loaded years (FY1976–FY2025); switching updates function/agency/revenue | API serves 50 years; `availableYears`/`buildPeriodTokens` + existing load effects; UAT approved | ✅ |
| 2 | Landing bands + deficit strip reflect the selected year | `FederalLanding` selects the annual_summary row by year; UAT approved | ✅ |
| 3 | Source chip updates to the selected year's source | Per-budget `data_source_info`; chips verified (+ link-quality fixes) | ✅ |
| 4 | No regression to FY2025 default or city/county/state | tsc/build green; UAT city+state+default checks approved | ✅ |

## Requirements
- **NAV-01** (select any backfilled year; views update) — ✅ incl. the FY1976 Transition Quarter as a distinct selectable period (`period_label` disambiguation, backend + frontend)
- **NAV-02** (bands + deficit strip reflect selected year) — ✅

## Transition Quarter
Backend exposes `period_label`; frontend models the TQ as a distinct token (`buildPeriodTokens`/`parsePeriod`), fetches it via `period_label` disambiguation, and the landing block hides annual-summary bands for it (no TQ summary row). FY1976 ≈ $397B vs TQ ≈ $102B confirmed distinct in UAT.

## Cross-repo / deploy
- EV-Accounts `master` (`83b87196`) deployed to Render — live API serves `period_label`. Rebased onto 6 concurrent team commits, no force-push.
- treasury-tracker `main` deployed to Netlify (YearSelector wiring + 2 source-link fixes).

## UAT-surfaced fixes (pre-existing, fixed; not NAV regressions)
- Context-metric chips → human dataset pages (DB + `loadFederalMTS.js`, `db5eb98`).
- Federal lens chips → human registry pages instead of raw `base_url` (`App.tsx`, `9ed35e0`).

## Follow-ups for Phase 51
- **Systematic source-chain audit** across every figure/year/source (the piecemeal fixes above were opportunistic; Phase 51 owns the comprehensive sweep).
- Comparability/definition-drift notes + the FY1976 Transition Quarter explanation copy.
