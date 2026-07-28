# MAD-09 — Live UAT checklist (Madison, WI + Dane County)

App: **treasurytracker.empowered.vote** · everything below is already verified in the data and the API; this pass is about what a reader actually sees.

Reference figures (re-derived from the DOR workbook, tie $0):

| | CY2024 revenue | CY2024 expenditure |
|---|---:|---:|
| Madison, WI | $649,501,230 | $758,792,098 |
| Dane County, WI | $664,674,994 | $782,417,277 |

Per-capita divisors: Madison **291,037**, Dane **599,930**.

## Madison, WI

1. Search "Madison" — the **WI** city is findable and distinguishable from **Madison, MN** and **Madison Lake, MN**.
2. Money Out (operating) CY2024 totals **$758,792,098**.
3. Icicle shows 16 categories; largest is **Housing & Economic Development** at **$125,681,173**.
4. Click that category — the description says *public housing, urban and economic development, forestry*. **It must NOT say "Sustainability & Environment" / climate / waste reduction.** (This is the Phase 136 override; the API returns the right one, so a wrong reading here means a UI resolution bug.)
5. Money In toggles and shows **$649,501,230**, 16 sources, largest **Property Taxes $286,236,816**.
6. Year selector offers **CY2020–CY2024**; switching years changes both totals.
7. Per-capita renders and is sane (≈ $2,607/person expenditure at CY2024).
8. Source chip shows **"Wisconsin DOR County and Municipal Revenues and Expenditures (unaudited MFR)"** — the word *unaudited* must be visible — and links to `CMREB2024.xlsx` (link opens, file downloads).
9. Switch to CY2021 → the chip's URL changes to **CMREB2021.xlsx**, not the 2024 one.
10. Breadcrumb reads **US → Wisconsin → Dane County → Madison**.

## Dane County, WI

11. Reachable from Madison's breadcrumb, and has **its own budget** (not a nav-only node): CY2024 expenditure **$782,417,277**.
12. **Cities-in-County** panel lists Madison.
13. Largest expenditure is **Health & Human Services $287,633,648** — plausible for a county.
14. Same unaudited chip + per-year URL behaviour as Madison.

## Tether (v2.16 / v2.19)

15. Essentials + CTC tether icons present on Madison's banner? **Yes → tick. No → not a TT bug**; record as a cross-repo coverage gap (Madison, WI absent from the Essentials known-list), no TT code change.

## Also confirm (fix applied 2026-07-28)

16. Source chips now read **"· as of 2024-12-31"**, not "· fetched". They previously claimed a retrieval date that was often impossible (Bend FY2006 said "fetched 2006-06-30") — **1,801 rows / 67 entities** app-wide. Spot-check one **federal** page too, since the same chip is used there.

---

Anything that fails: note the item number and I'll take it from there.
