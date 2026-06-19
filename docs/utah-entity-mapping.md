# Utah Entity Mapping (UTSRC-01) — 15 v2.5 Targets

Exact `entity_name` strings confirmed against the live `ut-sao-transparency-prod.transaction.transaction`
table on **2026-06-19**. There is **no `entity_id` column** — the entity key is `entity_name` (exact) + `govt_lvl`.
Match EXACTLY (never `LIKE`): decoys include North/South Ogden City, North/South Salt Lake, Ogden Valley City,
Washington Terrace City, Davis School District, George Washington Academy.

All 15 cover **FY2014–FY2026** (FY2026 current/near-complete). EX = operating, RV = revenue, PY = payroll/salaries (Phase 71).

## Cities (10) — `govt_lvl = 'City'`

| Treasury-Tracker municipality | exact `entity_name` | County (Phase 70 link) | EX / RV / PY rows |
|---|---|---|---|
| Layton | `Layton City` | Davis County | 343,866 / 658,662 / 42,976 |
| Lehi | `Lehi City` | Utah County | 260,978 / 553,573 / 37,433 |
| Ogden | `Ogden City` | Weber County | 1,065,903 / 677,020 / 87,680 |
| Orem | `Orem City` | Utah County | 570,847 / 234,690 / 46,189 |
| Provo | `Provo City` | Utah County | 2,623,488 / 1,074,129 / 58,678 |
| Salt Lake City | `Salt Lake City` | Salt Lake County | 5,114,579 / 5,304,345 / 2,646,452 |
| Sandy | `Sandy City` | Salt Lake County | 713,952 / 479,982 / 44,656 |
| St. George | `St. George City` | Washington County | 704,670 / 576,587 / 80,001 |
| West Jordan | `West Jordan City` | Salt Lake County | 293,387 / 369,388 / 43,344 |
| West Valley City | `West Valley City` | Salt Lake County | 300,516 / 447,040 / 30,417 |

## Counties (5) — `govt_lvl = 'County'`

| Treasury-Tracker entity | exact `entity_name` | Member cities (above) | EX / RV / PY rows |
|---|---|---|---|
| Salt Lake County | `Salt Lake County` | SLC, Sandy, West Jordan, West Valley City | 5,573,296 / 1,234,397 / 422,073 |
| Utah County | `Utah County` | Provo, Orem, Lehi | 854,387 / 246,140 / 56,604 |
| Davis County | `Davis County` | Layton | 491,973 / 452,488 / 89,395 |
| Weber County | `Weber County` | Ogden | 853,158 / 627,114 / 57,097 |
| Washington County | `Washington County` | St. George | 478,857 / 204,851 / 29,467 |

## Tree column (D-06) — decided from live data

- **`function1` is unusable** — ~70% NULL for cities (Provo FY2024 EX: $243.6M of $346.5M NULL, only 2 distinct values).
- **`cat1`** = expense *object* (CAPITAL EXPENSE, FULL TIME REGULAR, ELECTRIC CHARGES…), 165 distinct, fully populated.
- **`org1`** = department/purpose (PATROL, STREET MAINTENANCE, PARKS CIP, ENERGY ADMINISTRATION…), 211 distinct, fully populated. **← chosen top level** ("what it's for"), matching D-06's "org is the fallback when function is sparse." `loadUtahTransparency.js --source-column` now defaults to `org1`; sub-level = `cat1`.
- **Phase 69 tuning note:** `org1` is granular (≈200 top categories, many with a single subcat). Consider a fund-based or curated rollup for a tidier icicle before/while loading all 10 cities.
