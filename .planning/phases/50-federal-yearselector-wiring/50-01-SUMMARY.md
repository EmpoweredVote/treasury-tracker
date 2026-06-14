# Plan 50-01 Summary — Backend: expose period_label

**Status:** Complete (code + test committed in ../EV-Accounts; deploy = local for now)
**Commit:** `../EV-Accounts` master `20dafb73` — feat(treasury): expose period_label on datasets + budgets
**Requirements:** NAV-01

## What changed (`../EV-Accounts/backend/src/lib/treasuryService.ts`)
- `period_label: string | null` added to `TreasuryDataset`, `TreasuryBudget`, `CityRow.available_datasets` element, and `BudgetRow`.
- `available_datasets` `json_build_object` gains `'period_label', b.period_label` in **both** `getCities` and `getCityById`.
- Both `getBudgetsByCityId` SELECTs (filtered `?fiscal_year=` + unfiltered) and the single-budget SELECT gain `b.period_label`; `mapCity`/`mapBudget` coalesce to `null`.
- `tests/integration/treasury-cities.test.ts` asserts each `available_datasets` entry exposes `period_label`.

## Verification
- **Backend `tsc` build passes** (type safety confirmed) — `npm run build` clean.
- Additive + nullable → zero behavioral change for city/state/county (period_label null).

## Deviations / notes
- **Integration suite not run locally:** the EV-Accounts *root* deps aren't installed here (`npx` fell back to a cached vitest; config `vitest/config` not resolvable) and the suite needs a local Postgres. The assertion is in place for CI; runtime proof is the live contract probe in 50-04. Build (tsc) covers type correctness.
- **Deploy decision (50-01-03):** run the backend **locally on :5050** (reads prod Supabase, which already holds period_label from Phase 49); frontend dev proxies to it. Render deploy deferred until the frontend ships — no production change yet.
