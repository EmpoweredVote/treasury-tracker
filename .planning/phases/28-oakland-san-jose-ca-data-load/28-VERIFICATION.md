---
phase: 28-oakland-san-jose-ca-data-load
type: verification
completed: 2026-06-05
---

# Phase 28 Verification Record

## Six Success Criteria (from ROADMAP)

| # | Criterion | Status | Evidence |
|---|-----------|--------|---------|
| 1 | Oakland and San Jose appear in city picker under California | **PASS** | Both municipalities seeded (Plan 01); data loaded in treasury.budgets |
| 2 | Oakland operating budget shows data for ≥2 fiscal years; GPF band (~$800M/year) | **PASS** | FY2024 $834M, FY2025 $807M — both in $700M-$900M GPF band (Plan 02) |
| 3 | San Jose operating budget total in ~$1.7-1.9B General Fund range | **DEFERRED/NOTE** | Loaded totals: FY2024 $1.69B, FY2025 $1.82B. These are departmental-only (SUMMARY OF GENERAL FUND USES table). Older years (FY2021-2023) are $1.3B-$1.5B (smaller historical budgets — not enterprise bleed). Enterprise funds confirmed excluded (no Airport/Wastewater/Water categories in DB). |
| 4 | Both cities show Revenue / Money In tabs with ≥1 FY, OR revenue documented as deferred | **PASS** | Oakland revenue deferred per D-05 (GPF revenue section exists but requires additional parser). San Jose revenue loaded for FY2021-FY2025 (operating + revenue both present). |
| 5 | Per-capita ($/resident) displays correctly: Oakland ~444K, San Jose ~997K | **PASS** | Populations seeded in Plan 01: Oakland 444,000, San Jose 997,000 |
| 6 | Enrichment descriptions visible (not empty) for top categories in both cities | **PASS** | Oakland: 26 enriched rows, all non-empty. San Jose: 24 enriched rows, all non-empty. |

## Open Question 1 Resolution (Oakland $2.1B vs ~$800M)

**Resolved in Plan 02:** The ROADMAP requirement "$2.1B/year range" referred to Oakland's all-funds total. Oakland's General Purpose Fund (FD_1010, locked by D-06) is ~$800M-$850M/year. Loaded GPF totals ($807M-$834M) are correct for GPF-only scope.

## Oakland GPF Fund Label (D-06)

All Oakland budget_categories rows have fund="General Purpose Fund" (D-06 invariant). Confirmed via DB query in Plan 02.

## Revenue Status per City (D-05)

| City | Revenue Status |
|------|---------------|
| Oakland | Deferred — GPF revenue section exists in PDFs (pages 148-149) but OpenGov embedded chart format requires additional extraction work |
| San Jose | Loaded — FY2021-FY2025 revenue data in DB; "Taxes" and "Non-Tax Revenue" parent nodes populated |

## Enrichment Cost vs $0.10 Gate (D-07)

- Oakland FY2024: 26 categories AI-enriched
- San Jose FY2025: 25 AI calls → 24 DB rows (1 mapped to existing universal key)
- Combined estimate: ~$0.02-$0.04 (well under $0.10 gate)
- Gate confirmed: PASSED before live calls (dry-run showed 51 combined categories)

## Loaded Fiscal Years Summary

### Oakland (GPF, operating only)
| FY | Total | Source |
|----|-------|--------|
| 2024 | $834,121,344 | FY2023-25 biennial adopted budget |
| 2025 | $807,428,508 | FY2024-25 midcycle adopted budget |

### San Jose (General Fund, operating + revenue)
| FY | Operating | Revenue |
|----|-----------|---------|
| 2021 | $1,333,212,066 | $1,517,689,229 |
| 2022 | $1,376,791,870 | $1,543,052,390 |
| 2023 | $1,495,292,997 | $1,909,578,024 |
| 2024 | $1,693,389,501 | $2,085,088,973 |
| 2025 | $1,822,480,057 | $2,114,599,467 |

Note: FY2016-17 through FY2019-20 PDFs use an older format not parsed by current extractor — 4 years skipped (non-blocking; 5 years loaded exceeds minimum viable).

## Deferred Items Carrying Forward

| Item | Deferred To |
|------|------------|
| Oakland GPF revenue extraction | Future phase (requires parser for OpenGov embedded chart format) |
| FY2016-17 through FY2019-20 San Jose extraction | Future phase (older PDF format support needed) |
| FY2025-27 Oakland biennial | Not yet published at expected URL |

## Human App Verification

**Required:** Verify all six criteria at treasurytracker.empowered.vote before marking phase complete.
