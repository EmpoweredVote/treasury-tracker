---
phase: 33-ca-state-budget-data
validation_date: 2026-06-08
status: COMPLETE
script: scripts/verify-phase33.mjs
---

# Phase 33: CA State Budget Data — Nyquist Validation

## Coverage Summary

| Gap ID | Requirement | Description | Type | Status |
|--------|-------------|-------------|------|--------|
| 33-01-01 | DATA-01 | CA municipality: entity_type='state', population=39500000, state='CA' | DB (automated) | COVERED |
| 33-01-02 | DATA-01 | data_source: api_type='xlsx_download', dataset_id='ca-lao-gf-operating' | DB (automated) | COVERED |
| 33-02-01 | DATA-02 | 5 budget rows in treasury.budgets for FY2022-2026 | DB (automated) | COVERED |
| 33-02-02 | DATA-02 | FY2026 total within [$225B, $232B] | DB (automated) | COVERED |
| 33-02-03 | DATA-02 | All 5 FY totals within sanity band [$150B, $300B] | DB (automated) | COVERED |
| 33-02-04 | DATA-02 | budget_categories count > 0 for CA operating budgets | DB (automated) | COVERED |
| 33-03-01 | DATA-03 | enrichCategories.js contains `case 'state':` | Static (automated) | COVERED |
| 33-03-02 | DATA-03 | 'state' case references 'General Fund' and 'Medi-Cal' | Static (automated) | COVERED |
| 33-03-03 | DATA-03 | category_enrichment rows exist for California | DB (automated) | COVERED |
| 33-03-04 | DATA-03 | No CA enrichment row contains "city council" or "mayor" | DB (automated) | COVERED |
| 33-04-01 | DATA-04 | Live app: CA visible in entity picker with State Budget badge | Human (UAT) | COVERED |
| 33-04-02 | DATA-04 | Live app: Money Out ~$228B for FY2025-26 | Human (UAT) | COVERED |
| 33-04-03 | DATA-04 | Live app: per-capita ~$5,782 per resident | Human (UAT) | COVERED |
| 33-04-04 | DATA-04 | Live app: year selector shows FY2022-FY2026 | Human (UAT) | COVERED |
| 33-04-05 | DATA-04 | Live app: enrichment uses state-level language | Human (UAT) | COVERED |
| 33-04-06 | DATA-04 | Live app: CA state not used as "Your City" preloaded card | Human (UAT) | COVERED |

**10 automated gaps / 6 human-only gaps (all browser visual — cannot be asserted via script)**

## Test Artifacts

- `scripts/verify-phase33.mjs` — automated verification (gaps 33-01-01 through 33-03-04)
- UAT record: `.planning/phases/33-ca-state-budget-data/33-UAT.md` (6/6 passed 2026-06-07)
- Verification record: `.planning/phases/33-ca-state-budget-data/33-VERIFICATION.md` (PASSED)

## Run Automated Checks

```
node scripts/verify-phase33.mjs
```

Exit 0 = all 10 automated gap checks pass. Exit 1 = one or more fail.

## Prior Execution Evidence

VERIFICATION.md confirms all DATA-01 through DATA-04 requirements met (verified 2026-06-07):
- DB: CA municipality id=e1007bf5-bac9-4b1c-878e-f6834885f850, entity_type='state', population=39500000
- DB: data_source id=e47a4cb5, api_type='xlsx_download', dataset_id='ca-lao-gf-operating'
- DB: 5 budget rows loaded (FY2022-2026); FY2026 total ~$228.4B; 892 budget_category rows
- DB: 12 category_enrichment rows for CA FY2026, state-level framing confirmed
- UAT: 6/6 tests passed by human spot-check at https://treasurytracker.empowered.vote 2026-06-07

## Sanity Band Reference (from 33-02-SUMMARY.md)

| Fiscal Year | Total Loaded |
|-------------|-------------|
| FY2022 | ~$216.8B |
| FY2023 | ~$195.2B |
| FY2024 | ~$205.7B |
| FY2025 | ~$233.6B |
| FY2026 | ~$228.4B |

All five years fall within the [$150B, $300B] sanity band enforced by processCA.js.
