# 44-01 Summary — Federal Schema + US Entity Seed

**Executed:** 2026-06-12 | **Status:** Complete — all 4 tasks pass

## Shipped

| Item | Result |
|---|---|
| `20260612110000_add_federal_agency_dataset_type.sql` | data_sources_dataset_type_check now 6 values (federal_agency added) |
| `20260612110100_create_federal_context_tables.sql` | federal_annual_summary (13 cols) + federal_context_metrics (9 cols), source columns NOT NULL, amounts-in-dollars convention in COMMENTs |
| `scripts/seedUSFederal.js` | US entity `0098c405-65e1-426f-8e5f-0fcbe2a900c0` — population **340,110,988 fetched live from Census** NST-EST2024-ALLDATA.csv (SUMLEV=010, POPESTIMATE2024), population_year=2024. Dry-run → live → re-run cycle proved idempotency. Sanity band 300M–400M enforced. |
| `src/types/budget.ts` | dataset_type union + 'federal_agency' |
| `src/App.tsx:154` | federal_agency excluded from tab-type list (semantic: it's a lens, not a tab) |

## Census endpoint discovery

- The PEP API has no 2024 vintage (endpoint returns empty) — population comes from the CSV estimates file, matching the loadMAPopulation.js approach.
- The national file lives under `/state/totals/NST-EST2024-ALLDATA.csv` — the intuitive `/national/totals/` path **404s**. Recorded in script header.

## dataset_type consumer audit (Task 4)

| Consumer | Disposition |
|---|---|
| App.tsx:148 availableDatasetTypes | federal_agency now explicitly excluded (same pattern as all_funds_requirements) |
| App.tsx:275-278 hasX checks | `.some(type==='x')` — unknown types inert |
| App.tsx:352-357 effectiveDataset | falls back to 'operating' — safe |
| dataLoader.ts:58 | find-by-type with fallback — safe |
| DatasetTabs.tsx:54-56 | fixed card list; only `.includes('salaries')` checked — unknown types inert |

tsc + build green. US entity confirmed invisible (no budgets rows).

## Deviations from plan

Census PEP API path replaced by CSV download (API discontinued post-2021 vintage) — same data, same vintage, sourced URL logged.
