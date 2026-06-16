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

Once shipped, verify on the live OC county page that the chip renders: "CA State Controller - County Expenditures · fetched 2026-06-15" linking to https://bythenumbers.sco.ca.gov/d/uctr-c2j8 (UAT item 7). This also lights up the same chip for every city row that carries durable source attribution.

**Request filed:** `C:/EV-Accounts/ACCOUNTS-TEAM-REQUEST-sourcechip-data-source-info-2026-06-16.md` (committed in the EV-Accounts repo as `3d341702`, 2026-06-16).

**Status 2026-06-16 — code done, awaiting deploy:** EV-Accounts `treasuryService.ts` implemented the fix (commit `3d341702`): `BudgetRow` gains `source_url`/`source_date`, all 3 budget SQL selects include them, and `mapBudget()` falls back to `{ displayName: data_source, url: source_url, datasetUrl: source_url, fetchedAt: source_date }` when `ds_display_name` is null and all three municipal columns are non-null. Shape matches the frontend chip (`datasetUrl || url`).
- DB data confirmed satisfies the condition: OC county FY2024 operating + revenue rows have `data_source`, `source_url`, `source_date` all non-null and `data_source_id` null.
- BUT production `https://ev-accounts-api.onrender.com/api/treasury/cities/65e7c643-5829-4821-9537-f8595bce61ab/budgets?fiscal_year=2024` still returns `data_source_info: null` → the running Render build predates `3d341702`. **Pending: redeploy ev-accounts-api from that commit.**
- Re-verify after deploy: the API call above should return `data_source_info` populated; then confirm the live OC county SourceChip renders (UAT item 7) and close this todo.
