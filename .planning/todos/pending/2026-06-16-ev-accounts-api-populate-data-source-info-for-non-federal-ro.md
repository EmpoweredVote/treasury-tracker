---
created: 2026-06-16T03:51:55.819Z
title: EV-Accounts API — populate data_source_info for non-federal rows (lights up county/city SourceChip)
area: data-sourcing
files:
  - src/App.tsx:995-1005
  - scripts/loadCountyBudget.js
origin_phase: 57
requirements: [OCB-02]
---

## Problem

The OC county SourceChip is code-complete but **dormant** in production. In Phase 57 a county-scoped `<SourceChip>` block was added to `src/App.tsx:995-1005`, gated on `entity_type === 'county' && budgetData.metadata.dataSourceInfo`. It deliberately does not render a blank chip.

The EV-Accounts production API returns `data_source_info: null` for **all non-federal budget rows**. It only populates `data_source_info` for federal rows, via the `data_source_id → source_registry` FK. County (and city) rows carry their attribution in the municipal `source_url` / `source_date` / `data_source` columns, which the API does not currently map into `data_source_info`.

So even though the OC county budget rows have durable `/d/<id>` ByTheNumbers source URLs + fetch dates in the DB (loaded in Phase 57-01), the county page shows no source tag. This is the only open item from Phase 57 (UAT item 7, deferred). Tracked in `.planning/phases/57-orange-county-county-government-budget/57-VERIFICATION.md` and `57-HUMAN-UAT.md`.

## Solution

Update the EV-Accounts backend budget API so that, when `data_source_id` is null, it constructs a `data_source_info` object from the municipal `source_url` / `source_date` / `data_source` columns. Shape expected by the frontend chip:
- `displayName` ← `data_source` (e.g. "CA State Controller - County Expenditures")
- `datasetUrl` ← `source_url` (the durable `/d/<id>` ByTheNumbers page)
- `fetchedAt` ← `source_date`

Once shipped, verify on the live OC county page that the chip renders: "CA State Controller - County Expenditures · fetched 2026-06-15" linking to https://bythenumbers.sco.ca.gov/d/uctr-c2j8 (UAT item 7). This also lights up the same chip for every city row that carries durable source attribution. Follow the `C:/EV-Accounts/ACCOUNTS-FEATURE-REQUEST.md` pattern when filing against the EV-Accounts repo.
