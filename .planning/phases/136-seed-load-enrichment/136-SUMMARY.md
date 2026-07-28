# Phase 136 — Seed + Load + Enrichment: SUMMARY

**Completed:** 2026-07-27 · **Requirements:** MAD-04 ✅ MAD-05 ✅ MAD-06 ✅ MAD-07 ✅
**Live in production:** Madison, WI and Dane County, WI — 20 budget rows, 300 categories, 27 enrichment rows.

## What landed

| entity | id | rows | categories/row |
|---|---|---|---|
| Madison, WI (city) | `1e1575e3-075f-4fd3-9503-642c28b109df` | 10 (rev+op × CY2020–24) | 16 |
| Dane County, WI (county) | `94f5c941-b864-420c-bbe6-703917d54a17` | 10 (rev+op × CY2020–24) | 14 |

Madison CY2024: revenue **$649,501,230**, expenditure **$758,792,098** — identical to the Phase 135 dry-run and the MAD-01 reconciliation.

**Dane County is a full entity, not a nav-only node.** The CMREB `Counties` sheet carries the county's own data, so it got real budget rows in the same pass — unlike Pima in v2.17, where `PIMA-BUDGET-01` had to be deferred for want of a source.

## MAD-04 — Seed + link

`scripts/seedWisconsinMadison.js`, mirroring `seedTucsonArizona.js`. Every lookup is qualified by state **and** entity_type, and the seeder prints the `%madison%` collision set on each run so a misfire is visible in the log rather than discovered later:

```
Madison County, VA (county) · Madison, MN (city) · Madison Lake, MN (city) · Madison County, OH (county)
```

Populations are the workbook's own WI DOA figures (Madison 291,037; Dane 599,930), taken **as printed** — the bulletin warns a county figure may exceed the sum of its municipalities because some cities straddle county lines, so deriving it would be wrong. Link outcome: `linked` (county_id was NULL → Dane).

## MAD-05 — Load

The loader validates **every** row before writing anything, so a mis-shaped source cannot leave a partial load. It deliberately does not create municipalities: it resolves an already-seeded one and refuses otherwise, because a row created in the load path would miss the county link and could land with the wrong `entity_type`.

> **DEVIATION — recorded, not quietly taken.** MAD-05 as originally written called `treasury_sync_budget_tree` "the source-safe RPC". That attribution was wrong: neither RPC is safe on its own. The implementation uses `treasury_sync_city_budget` behind an explicit `findConflictingBudget` pre-skip guard — the `loadOhioAOS.js` pattern, and the mitigation `project_sync_city_budget_not_source_safe` actually prescribes. The requirement text has been corrected to match.

## MAD-06 — Honest provenance

- `data_source` = **"Wisconsin DOR County and Municipal Revenues and Expenditures (unaudited MFR)"** — the unaudited grade rides in the label itself, so it cannot be lost in a UI that shows only the source name.
- `fiscal_year_start_month` set explicitly to **1**. These are calendar-year governments; the column's dominant value table-wide is 7 (Jul–Jun), which would have mislabelled every period.
- `period_label` left **NULL** rather than inventing a "CY2024" convention — it is used by exactly 3 federal rows today, and misusing it would create a fake standard.
- `source_date` = the year end (the period described), never the fetch date.

## MAD-07 — Enrichment

27 rows: 22 universal + 5 entity-scoped. 100% coverage of both entities. $0, no paid API. CMREB is flat, so there are no `budget_line_items` to cover (verified: 0).

**Descriptions are sourced, not invented.** Each is a plain-language rendering of the bulletin's own §III line definition, with `source='official'` plus a `source_url`/`source_label` citing it. Most enrichment in this database is `source='ai'` and uncited; this run does not add to that pile — directly relevant to SRCSTD-01.

**Three pre-existing universal rows were materially wrong for this source** and got entity-scoped overrides rather than edits to rows other cities rely on:

| key | universal said | the bulletin defines it as |
|---|---|---|
| `conservation and development` | "Sustainability & Environment — climate, energy, waste reduction" | public housing, urban development, economic development, forestry |
| `ambulance` | "Fire & EMS — fire suppression, rescue" | ambulance services only; Fire is a **separate** line here |
| `parks and recreation` | park maintenance, trees, open space | that **plus** recreation programmes, events, pools, ice arenas, sports fields, zoo |

The first matters most: it is Madison's largest expenditure line at **$125.7M**, so a reader clicking it would have been told it was an environmental programme.

Wisconsin-specific statutory detail is kept out of universal text, and a guard fails the run if universal text names a jurisdiction.

## Verification — against the database, not the loaders' reports

| check | result |
|---|---|
| budget rows / category rows / unsourced | 20 / 300 / **0** |
| `fiscal_year_start_month` | 1 on all 20 |
| load re-run | totals + row counts unchanged (idempotent) |
| enrichment re-run | 0 new rows, no duplicates |
| scoped enrichment targets | only Madison WI + Dane County WI |
| universal rows naming a jurisdiction | **0** |
| duplicate universal rows (repo-wide) | **0** |
| bleed check | Madison MN + Madison County OH/VA carry `Ambulance` and `Parks and Recreation` and correctly keep the pre-existing universal rows — the WI overrides do not reach them |

## Two pre-existing bugs found here — FIXED 2026-07-27 at Chris's request

Both were flagged as out-of-scope observations, then fixed on request. Each turned out to be a *class* of bug, not the single row noticed:

**1. Implausible Ohio county populations — 18 of 88, not 1.** `Madison County, OH` at 100,151,375 was the one spotted; a sweep found 17 more (Ottawa 106,432,166; Highland 80,576,108; …), all with `population_year IS NULL`. These are money figures in the population column, consistent with `project_ohio_aos_county_vs_city_layout` — the `OI_Demographics` offsets `loadOhioAOS.js` uses do not line up on county workbooks.

Fixed by `scripts/fixOhioCountyPopulations.mjs`: only implausible rows touched, values read directly out of the Census Vintage 2024 county file (no hand transcription), stamped `population_year=2024`. Madison County OH is now **45,531**. The other 70 counties were **left alone** — plausible but a mixed older vintage (Delaware 194,000, Ross 77,000 are suspiciously round); restating them would silently shift per-capita figures across Ohio, which is a separate decision.

`loadOhioAOS.js` now rejects any population above `MAX_PLAUSIBLE_POPULATION` (1.5M — Ohio's largest county is Franklin at ~1.36M) and warns, so a re-run cannot reintroduce it. A missing population is recoverable; a wrong one silently misinforms.

**2. Universal `ambulance` enrichment was fire-department text.** `plain_name` "Fire & EMS", description "…fire suppression, rescue, fire prevention/inspection… Staffed by firefighters" — copied from the `fire` entry. **321 entities** across CA/MN/WI carry an `ambulance` category and **315 also carry a separate `fire` category**, so for ~98% of consumers the node described the wrong function, duplicating its neighbour.

Fixed by `scripts/fixAmbulanceEnrichment.mjs`: universal row replaced with ambulance/EMS-specific state-neutral text, `source='manual'` (hand-authored — labelling it `ai` would misstate its origin) and no invented citation. The Phase 136 Dane County override was **retired**, since it existed only to route around the broken universal row; keeping it would have stopped Wisconsin receiving future improvements to the shared text. `SCOPED_OVERRIDES` in `loadWIEnrichment136.mjs` had `ambulance` removed so the two scripts cannot fight over the same row.

Verified: 0 implausible OH populations, 18 stamped 2024, 1 universal `ambulance` row reading "Ambulance & EMS", 0 ambulance rows mentioning firefighters, WI's 20 budget rows unchanged, MAD-07 coverage still 100%, and all three scripts idempotent.

## Still open (not fixed)

- The OH county `OI_Demographics` column offsets remain unverified — the guard prevents bad writes but the root cause needs the county workbook to confirm. Follow-up.
- A broader enrichment-quality audit is warranted; the `ambulance` case was found by eye, not by a check. Copy-paste of a *neighbouring* concept's text is invisible to duplicate-detection since the strings differ.

## Handoff to Phase 137

MAD-08 (blind re-derivation of all 20 rows from the workbook + source-chain audit) and MAD-09 (live UAT + tether check). Note for MAD-08: re-derive from the XLSX **independently of `loadWICMREB.js`** — reusing its parsing would only prove self-consistency.

## Commits

- `42bffb8` MAD-04..07 seed, load, enrich
