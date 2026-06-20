# Phase 73 — Utah Expansion Live-App UAT Checklist (UVER-02)

**App:** https://treasurytracker.empowered.vote
**Driver:** Chris (drives the browser; the agent records only what you report — no automation)
**Spread (D-73-10):** Salt Lake City · Salt Lake County · West Valley City · St. George
**All picks pre-verified read-only (2026-06-20):** every entity below has the op/rev/salaries/population/links the checklist asks for — a blank tab would be a real defect, not an empty pick.

Mark each item **PASS / FAIL / PARTIAL**. Reference values are from the loaded production data.

---

## A. Salt Lake City (city — airport-heavy, keeps "City" in name)
*Pre-verified: operating 12 FY, revenue 12 FY, salaries 12 FY, population 217,783 (2024).*

1. Navigate to Salt Lake City. **Operating** tab shows a fund-topped icicle (top level = funds: General Fund, Airport, Water, etc.). → expect a rendered multi-fund icicle, FY selector spanning **2014–2025**.
2. Switch the year selector across several FYs (e.g. 2018 → 2024 → 2025) → totals change; no blank/zero years.
3. **Revenue** tab renders its own icicle. → expect rendered revenue tree.
4. **Salaries** tab is present and renders (Department → Wages/Benefits) → expect a 2-level salaries tree, **no employee names** anywhere.
5. **Per-capita** ($/resident) displays, labeled with population year **2024** (pop 217,783).
6. **Category enrichment** — expand a fund/department; plain-language descriptions render (no `$` figures, no other city's name).
7. **Source chip** reads **Transparent Utah** and links to `https://transparent.utah.gov`.
8. **Breadcrumb**: US → Utah → Salt Lake County → Salt Lake City.

## B. Salt Lake County (county government — multi-city Cities-in-County panel)
*Pre-verified: operating 12 FY, revenue 12 FY, salaries 11 FY (FY2025 not yet loaded — current year), population 1,216,274 (2024).*

9. Navigate to Salt Lake County (county page). **Operating** icicle / summary renders. → FY2024 operating ≈ **$1,897,504,796**; revenue ≈ **$1,854,839,553** (the basis-matched ACFR-reconciled figures from 73-01).
10. **Per-capita** displays (pop 1,216,274 / 2024).
11. **Cities-in-County panel** lists its linked cities → expect **Salt Lake City, Sandy, West Jordan, West Valley City** (4 cities).
12. Click a city in the panel (e.g. Sandy) → navigates to that city's page.
13. **Breadcrumb**: US → Utah → Salt Lake County. **Source chip** = Transparent Utah.
14. *(Optional)* Salaries tab renders for the county (FY2014–2024; FY2025 intentionally absent — current year).

## C. West Valley City (2nd Salt Lake County city — keeps "City" in name)
*Pre-verified: operating 12 FY, revenue 12 FY, salaries 12 FY, population 138,144 (2024).*

15. Navigate to West Valley City. Operating + Revenue + Salaries tabs all render.
16. **Per-capita** (pop 138,144 / 2024).
17. **Breadcrumb**: US → Utah → Salt Lake County → West Valley City (confirms the 2nd-city link into the same county panel).
18. Source chip = Transparent Utah.

## D. St. George (smallest-cohort edge — Washington County single-city county; renamed display name, no "City")
*Pre-verified: operating 12 FY, revenue 12 FY, salaries 12 FY, population 106,288 (2024); Washington County Cities-in-County = St. George only.*

19. Navigate to St. George. Display name reads **"St. George"** (not "St. George City"). Operating/Revenue/Salaries render.
20. **Per-capita** (pop 106,288 / 2024).
21. **Breadcrumb**: US → Utah → Washington County → St. George.
22. Navigate to **Washington County** → Cities-in-County panel shows **St. George** (single-city county case). County op/rev + per-capita render (pop 207,943).

---

## Coverage map (every UVER-02 item is exercised)
- City operating/revenue → A1–A3, C15, D19 · Salaries dataset/tab → A4, C15, D19 (+B14) · Per-capita → A5, B10, C16, D20, D22
- Enrichment rendering → A6 · Source chips → A7, B13, C18 · Breadcrumb chain → A8, B13, C17, D21 · Cities-in-County panel → B11–B12 (multi-city) + D22 (single-city)

## Sign-off
- [ ] All items PASS → full sign-off
- [ ] Most PASS, specific items flagged → conditional sign-off (flagged items become documented follow-ups)
- [ ] A blocking defect makes the expansion unusable → no sign-off (defect → new fix phase)
