---
phase: 28-oakland-san-jose-ca-data-load
plan: 04
subsystem: enrichment
tags: [enrichment, california, oakland, san-jose, verification]

# Dependency graph
requires:
  - phase: 28-02
    provides: Oakland GPF operating loaded (FY2024 $834M, FY2025 $807M)
  - phase: 28-03
    provides: San Jose General Fund operating + revenue loaded (FY2021-FY2025)
provides:
  - treasury.category_enrichment rows for Oakland (26) and San Jose (24)
  - 28-VERIFICATION.md documenting all six phase success criteria
affects: [app enrichment display]

requirements-completed: [ENRICH-01, DATA-02, DATA-03, POPUL-01]

# Metrics
duration: ~30min
completed: 2026-06-05
---

# Phase 28 Plan 04: Enrichment + Verification Summary

**AI enrichment ran under the $0.10 D-07 gate; all six Phase 28 success criteria verified by human in the app.**

## Enrichment Results

| City | FY | AI calls | DB rows | All non-empty |
|------|----|----------|---------|---------------|
| Oakland | 2024 | 26 | 26 | YES |
| San Jose | 2025 | 25 | 24 | YES |

Combined cost: ~$0.02-$0.04 (under $0.10 D-07 gate). Idempotent via name_key upsert.

## Six Success Criteria — Final Status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Oakland + San Jose in city picker under California | PASS |
| 2 | Oakland ≥2 FYs, GPF band (~$800M/year) | PASS |
| 3 | San Jose GF operating ~$1.7-1.9B (recent years) | PASS (FY2024 $1.69B, FY2025 $1.82B) |
| 4 | Revenue populated or documented as deferred | PASS |
| 5 | Per-capita display correct (Oakland 444K, San Jose 997K) | PASS |
| 6 | Enrichment descriptions visible | PASS |

Human verified at treasurytracker.empowered.vote: approved 2026-06-05.

## Deviations / Deferred

- San Jose FY2016-2020 PDFs use older format — 4 years skipped; 5 years loaded (FY2021-2025)
- Oakland revenue deferred per D-05 (OpenGov embedded chart format)
- Open Question 1 resolved: Oakland $2.1B = all-funds; GPF = ~$800M (correct scope)
