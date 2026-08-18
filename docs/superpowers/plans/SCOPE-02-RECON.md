# SCOPE-02 — Reconciliation Evidence

The document of record for SCOPE-02 findings, measurements and decisions. Companion to
`SCOPE-01-RECON.md`.

---

## Task 10 — Backfill the SCO actuals the index kept out

**Files changed:** `scripts/bulkLoadStateController.js` — `findConflictingBudget` narrowed to
`.eq('fund_scope','all_funds').eq('basis','actual')`; `importCityData`'s
`treasury_sync_city_budget` RPC call now passes `p_fund_scope: 'all_funds'`, `p_basis: 'actual'`.

Ran with `--city`, never `--county` (per dispatch override): the brief's `--county` commands
would have treated every other city in Fresno/Riverside/Orange/Alameda County whose SCO rows
share this loader's source string as "safe to refresh," churning hundreds of cities' category
trees on a live database to add four cities' worth of rows.

### Backfill coverage

Every target city-year that SCO's Cities Annual Report holds was loaded on the **first attempt**,
zero retries needed — `bythenumbers.sco.ca.gov` did not time out during this run.

| City | FY | Expenditures (`operating`) | Revenues (`revenue`) |
|---|---|---|---|
| Fresno | 2020 | Loaded — new row (SCO already held revenue for this year pre-run) | Already present pre-run (`CA State Controller - Revenues`, refreshed in place, same id) |
| Fresno | 2021 | Loaded — new row | Already present pre-run, refreshed in place |
| Fresno | 2022 | Loaded — new row | Already present pre-run, refreshed in place |
| Fresno | 2023 | Loaded — new row | Already present pre-run, refreshed in place |
| Fresno | 2024 | Loaded — new row | Already present pre-run, refreshed in place |
| Riverside | 2023 | Loaded — new row | Already present pre-run, refreshed in place |
| Riverside | 2024 | Loaded — new row | Already present pre-run, refreshed in place |
| Santa Ana | 2023 | Loaded — new row | Loaded — new row (Santa Ana's revenue key was also occupied by an adopted budget row) |
| Santa Ana | 2024 | Loaded — new row | Loaded — new row |
| Oakland | 2024 | Loaded — new row | Already present pre-run (`CA State Controller - Revenues`, refreshed in place, same id) |

**Finding, not a gap:** for Fresno, Riverside and Oakland, the `revenue` SCO all-funds/actual rows
already existed before this task ran (evidently loaded successfully in a prior run, before the
never-overwrite collision policy was tightened, and stamped `fund_scope='all_funds'`,
`basis='actual'` by the SCOPE-02 Task 8 stamping pass) — only their `operating` (expenditures)
figures had been blocked by an adopted-budget row occupying the key. Santa Ana was the one target
city where **both** dataset types were blocked, because Santa Ana had adopted budgets on file for
both revenue and expenditures.

**No target city-year returned zero SCO rows.** SCO's Cities Annual Report holds data for all ten
target city-years across both dataset types. There is no measured source gap to record for this
task — every row this task set out to backfill was published and available.

### Rows created

12 new `treasury.budgets` rows (ids recorded in `scripts/data/scope02CreatedIds.json`):

| City | FY | Dataset | `total_budget` | `data_source` |
|---|---|---|---|---|
| Fresno | 2020 | operating | 938,301,071 | CA State Controller - Expenditures |
| Fresno | 2021 | operating | 1,079,121,567 | CA State Controller - Expenditures |
| Fresno | 2022 | operating | 1,186,582,659 | CA State Controller - Expenditures |
| Fresno | 2023 | operating | 1,379,941,902 | CA State Controller - Expenditures |
| Fresno | 2024 | operating | 1,474,265,521 | CA State Controller - Expenditures |
| Riverside | 2023 | operating | 1,075,853,753 | CA State Controller - Expenditures |
| Riverside | 2024 | operating | 1,180,984,170 | CA State Controller - Expenditures |
| Oakland | 2024 | operating | 2,252,063,000 | CA State Controller - Expenditures |
| Santa Ana | 2023 | operating | 770,595,238 | CA State Controller - Expenditures |
| Santa Ana | 2023 | revenue | 778,706,543 | CA State Controller - Revenues |
| Santa Ana | 2024 | operating | 814,564,167 | CA State Controller - Expenditures |
| Santa Ana | 2024 | revenue | 837,498,213 | CA State Controller - Revenues |

Every new row carries `fund_scope='all_funds'`, `basis='actual'`.

### Safety check — pre-existing rows untouched

Snapshotted `treasury.budgets` for the four target municipalities before and after the load
(249 rows before, 261 after). Every one of the 249 pre-existing rows was compared field-for-field
(`total_budget`, `data_source`, `fund_scope`, `basis`) between the before and after snapshots:
**zero mismatches.** The pre-existing adopted-budget rows (e.g. `Fresno General Fund Operating
Budget FY2020`, `Santa Ana General Fund Revenue Budget FY2023`) are byte-identical.

`treasury.budgets` total row count: 79,927 (pre-Task-9 baseline) → 79,939 after this task
(+12, matching the created-id count exactly).

Full detail (every command run, every dry-run/real-run output, the raw before/after snapshots,
and the CI gate results) is in `.superpowers/sdd/2026-08-17-scope-02/task-10-report.md`.
