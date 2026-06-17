# Plan 58-01: Pre-Load Baseline (Task 02)

**Captured:** 2026-06-16

## LA County County-Wide Stats

| Metric | Value |
|--------|-------|
| LA County entity id | f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1 |
| Cities linked to LA County | 88 |
| Cities with FY2003 operating | **0** (the gap to fill) |
| LA County city rows with NULL source_url | **1,437** |
| SCO FY2024 dry-run: cities found | 88 (expenditures), 88 (revenues) |
| SCO FY2003 dry-run: cities found | 86 (expenditures), 86 (revenues) |

## Dry-Run FY2024 Classification

- **Los Angeles:** SKIP — existing `Socrata: https://data.lacity.org` data preserved (FY2021-2026)
- **Long Beach:** Would import (FY2024 operating/revenue are same-source SCO → re-sync)
- **West Hollywood:** Would import (FY2024 operating/revenue are same-source SCO → re-sync; Demand Register rows are `transactions` dataset_type, not impacted)
- **87 cities would import, 1 skipped** per dataset type

## 3 Custom-City Row Baseline (data_source + totals)

### Los Angeles (id: 391bf791-1c1f-424f-a7a5-1b698c79093f)

Distinct sources: LA City Revenue, LA City Budget & Expenditures, Socrata: https://data.lacity.org, CA State Controller - Revenues, CA State Controller - Expenditures

| FY | Type | data_source | Total |
|----|------|-------------|-------|
| 2026 | revenue | LA City Revenue | $10,108.1M |
| 2026 | operating | LA City Budget & Expenditures | $21,431.3M |
| 2025 | revenue | Socrata: https://data.lacity.org | $10,223.0M |
| 2025 | operating | Socrata: https://data.lacity.org | $19,855.2M |
| 2024 | revenue | Socrata: https://data.lacity.org | $21,612.5M |
| 2024 | operating | Socrata: https://data.lacity.org | $19,974.3M |
| 2023 | revenue | Socrata: https://data.lacity.org | $21,141.4M |
| 2023 | operating | Socrata: https://data.lacity.org | $18,162.1M |
| 2022 | revenue | Socrata: https://data.lacity.org | $19,280.7M |
| 2022 | operating | Socrata: https://data.lacity.org | $17,447.7M |
| 2021 | revenue | Socrata: https://data.lacity.org | $17,563.9M |
| 2021 | operating | Socrata: https://data.lacity.org | $16,169.7M |
| 2020 | revenue | CA State Controller - Revenues | $17,078.1M |
| 2020 | operating | CA State Controller - Expenditures | $16,237.5M |
| 2019 | revenue | CA State Controller - Revenues | $17,466.3M |
| 2019 | operating | CA State Controller - Expenditures | $15,131.9M |
| 2018 | revenue | CA State Controller - Revenues | $15,809.3M |
| 2018 | operating | CA State Controller - Expenditures | $14,199.3M |
| 2017 | revenue | CA State Controller - Revenues | $15,058.0M |
| 2017 | operating | CA State Controller - Expenditures | $13,390.9M |

Note: LA City Payroll (salaries) + LA City Checkbook (transactions) rows excluded from this table (not impacted by SCO loader which writes operating/revenue only).

### Long Beach (id: 9464eab4-c981-4f28-a677-6b9e6c4b7607)

Custom (non-SCO) rows:

| FY | Type | data_source | Total |
|----|------|-------------|-------|
| 2026 | revenue | Long Beach General Fund Revenue Budget FY2026 | $747.8M |
| 2026 | operating | Long Beach General Fund Operating Budget FY2026 | $772.9M |
| 2025 | revenue | Long Beach General Fund Revenue Budget FY2025 | $725.7M |
| 2025 | operating | Long Beach General Fund Operating Budget FY2025 | $755.4M |

SCO rows (same-source, will be re-synced to gain source_url):

| FY | Type | data_source | Total |
|----|------|-------------|-------|
| 2024 | revenue | CA State Controller - Revenues | $676.8M |
| 2024 | operating | CA State Controller - Expenditures | $720.1M |
| 2023 | revenue | CA State Controller - Revenues | $671.8M |
| 2023 | operating | CA State Controller - Expenditures | $674.1M |
| ... | ... | CA State Controller - ... | ... |
| 2017 | revenue | CA State Controller - Revenues | $2,029.9M |
| 2017 | operating | CA State Controller - Expenditures | $2,004.9M |

### West Hollywood (id: e9892544-4251-4c2e-b3de-5a99080563a7)

Custom (non-operating/revenue) rows (dataset_type=transactions — NOT impacted by loader):

| FY | Type | data_source | Total |
|----|------|-------------|-------|
| 2026 | transactions | West Hollywood Demand Register FY2025-26 | $0.0M |
| 2025 | transactions | West Hollywood Demand Register FY2024-25 | $0.0M |
| 2024 | transactions | West Hollywood Demand Register FY2022-24 | $5.3M |
| 2023 | transactions | West Hollywood Demand Register FY2022-23 | $159.9M |
| 2022 | transactions | West Hollywood Demand Register FY2021-22 | $1.8M |
| 2021 | transactions | West Hollywood Demand Register FY2020-21 | $0.3M |
| 2020 | transactions | West Hollywood Demand Register FY2019-20 | $0.4M |
| 2019 | transactions | West Hollywood Demand Register FY2018-19 | $1.9M |
| 2018 | transactions | West Hollywood Demand Register FY2018-19 | $0.0M |

SCO rows (same-source, will be re-synced to gain source_url):

| FY | Type | data_source | Total |
|----|------|-------------|-------|
| 2024 | revenue | CA State Controller - Revenues | $193.7M |
| 2024 | operating | CA State Controller - Expenditures | $198.6M |
| ... | ... | CA State Controller - ... | ... |
| 2017 | revenue | CA State Controller - Revenues | $132.6M |
| 2017 | operating | CA State Controller - Expenditures | $123.4M |

## Canary Gate Requirements

For task 03 to pass (before any FY2003-2023 backfill):
1. Standard LA County city FY2024 operating/revenue rows must show source_url = non-NULL `/d/ju3w-4gxp` or `/d/rrtv-rsj9`
2. Los Angeles FY2024 rows must remain unchanged (data_source + total_budget)
3. Long Beach FY2025-2026 custom rows must remain unchanged
4. West Hollywood Demand Register rows must remain unchanged
