# Phase 62 Plan 03 — UAT Checklist (Task 1 artifact)

**Purpose:** Guided click-through checklist for Chris to walk against the live app at
https://treasurytracker.empowered.vote. Chris drives the browser; the agent records results.
This checklist exercises every VER-04 item across the required 4-entity spread (D-07).

**VER-04 items covered:** FY2003 history depth | salaries dataset/tab | per-capita across backfilled years | enrichment (plain-language category names) | breadcrumb chain | Cities-in-County panel

**Entity spread:**
- Entity A — LA County city: **Glendale** (standard SCO city, FY2003 verified)
- Entity B — LA County government: **Los Angeles County** (county entity, FY2003–2024)
- Entity C — Phase-59 linked city (breadcrumb/Cities-in-County): **Oakland** (linked Alameda County) + **San Francisco** (combined city-county node, no county hop)
- Entity D — Salaries city: **Irvine** (Phase-60 GCC salaries city, Orange County; salaries FY2009–2024; exercise the Salaries tab)
  - *Note (2026-06-17): originally **Inglewood**, corrected after UAT round 1. A read-only DB probe found Inglewood has ZERO budget rows of any dataset — so the Salaries tab correctly did not appear (gating `availableDatasets.includes('salaries')` working as designed). Inglewood is not in the salaries cohort; Irvine is (op/rev/salaries = 22/22/16). This was a checklist city-pick defect, not a render bug.*

**Before you start:** Open https://treasurytracker.empowered.vote in a browser you can use comfortably.
Report each item by number: PASS / FAIL / PARTIAL (plus what you saw if not PASS).

---

## Section A — Glendale (LA County city, FY2003 depth + per-capita + enrichment)

Navigate to Glendale, CA.

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 1 | Search for or click **Glendale** (CA) from the landing page | Glendale's budget page loads; operating or revenue data visible for at least one year |
| 2 | Open the **year selector** (or history chart) and look for the earliest year available | FY2003 appears as the oldest available year (history reaches back to 2003) |
| 3 | Select **FY2003** in the year selector | The page renders Glendale's FY2003 operating total (~$451.9M) without errors; no "no data" message |
| 4 | With FY2003 selected, look for the **per-capita** figure | A per-capita dollar amount is displayed (expected ~$2,363/person); it is not blank or zero |
| 5 | Select a recent year (e.g. **FY2024**) and check the per-capita figure | Per-capita renders for the recent year too; the value has increased vs FY2003 (population denominator working across multiple years) |
| 6 | On Glendale's operating or revenue breakdown, look at the **category names** shown in the icicle/list | Categories show plain-language names (e.g. "General Government", "Public Safety", "Public Works", "Parks & Recreation") — not raw SCO code strings; enrichment is rendering |

---

## Section B — Los Angeles County (county government entity, FY2003–2024 + per-capita + Cities-in-County + breadcrumb)

Navigate to the **Los Angeles County** entity (the county government, not a city).

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 7 | Click **Los Angeles County** (county entity) from a county page or search | The LA County government budget page loads; operating and revenue data visible |
| 8 | Open the year selector / history chart | FY2003 is available as the earliest year; the range spans at least FY2003–FY2024 |
| 9 | Select **FY2003** | The page renders LA County FY2003 operating total (~$13.7B) without errors |
| 10 | Check the **per-capita** figure for FY2003 | A per-capita figure is shown (expected ~$1,365/person); not blank or zero |
| 11 | Check the **per-capita** figure for a recent year (e.g. FY2024) | Per-capita has increased substantially vs FY2003 (expected ~$3,752/person for FY2024); renders without errors |
| 12 | Look at the **breadcrumb** at the top of the page | Breadcrumb reads: **US → California → Los Angeles County** (exactly three levels; no city hop) |
| 13 | Look for the **Cities in Los Angeles County** panel (a list of cities belonging to this county) | A panel lists LA County cities (e.g. Burbank, Glendale, Pasadena, Santa Monica, and others); panel is not empty |

---

## Section C — Oakland (Phase-59 linked city, breadcrumb + Cities-in-County) and San Francisco (no-county-hop)

**Part C1 — Oakland (Alameda County link)**

Navigate to **Oakland**, CA.

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 14 | Click or search for **Oakland** (CA) | Oakland's budget page loads |
| 15 | Look at the **breadcrumb** at the top of the page | Breadcrumb reads: **US → California → Alameda County → Oakland** (four levels; county hop present) |
| 16 | Click **Alameda County** in the breadcrumb | Alameda County page loads (or a county listing page); confirms the county link is live |
| 17 | On the Alameda County page, look for the **Cities in Alameda County** panel | The panel lists cities including Oakland, Berkeley, and Fremont (cities linked to Alameda County); panel is not empty |

**Part C2 — San Francisco (combined city-county node, no county hop)**

Navigate to **San Francisco**, CA.

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 18 | Click or search for **San Francisco** (CA) | San Francisco's page loads |
| 19 | Look at the **breadcrumb** at the top of the page | Breadcrumb reads: **US → California → San Francisco** (three levels; NO separate "County" hop — SF is a combined city-county node) |

---

## Section D — Irvine (Phase-60 salaries city: Salaries tab + Department→Position tree + enrichment)

Navigate to **Irvine**, CA. *(Corrected from Inglewood — see note above.)*

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 20 | Click or search for **Irvine** (CA) | Irvine's page loads |
| 20a | **Set the year selector to a recent year (e.g. 2024).** Salaries data only exists FY2009–2024, so the Employees card is HIDDEN for older years like 2003. If the year carried over from a prior FY2003 test, change it to 2024 first. | Year is 2024 (or any 2009–2024) |
| 21 | Look at the dataset cards row. There should be **three** cards: **Money Out**, **Money In**, and **Employees** (the salaries dataset is labeled **"Employees"** with a people icon + "Employee compensation" subtitle — NOT the word "Salaries") | A third card labeled **Employees** appears next to Money Out / Money In |
| 22 | Click the **Employees** card | The salaries (employee compensation) view loads; a Department list or tree is visible |
| 23 | Expand or click a **department** in the Employees/salaries tree | A list of positions (job titles) and associated salary/compensation figures appears under that department |
| 24 | Look at the **department names** shown in the tree | Department names show plain-language labels (e.g. "Police Department", "Fire Department", "Public Works") — enrichment is rendering for salary departments; labels are not raw code strings |

> **UAT round-2/3 notes (2026-06-17):**
> - *Round 1 (Inglewood):* checklist picked a non-salaries entity → corrected to Irvine.
> - *Round 2 (Irvine, "no Salaries card"):* two root causes, both confirmed, neither a product defect:
>   1. The salaries card is labeled **"Employees"** (`SALARIES_CARD` in `src/components/datasets/DatasetTabs.tsx`, Users icon, "Employee compensation"), not "Salaries".
>   2. The Employees card is **year-gated**: `availableDatasetTypes` (App.tsx ~L172) filters `available_datasets` to the selected year. The round-2 screenshot showed `year=2003` (carried over from the Glendale FY2003 test); Irvine's salaries are FY2009–2024, so at 2003 only Money Out / Money In render — correct behavior. Selecting a 2009–2024 year reveals the Employees card.
> - Live production API (`ev-accounts-api.onrender.com/api/treasury/cities`) confirms Irvine carries salaries FY2009–2024.
> - **Candidate UX follow-up flag (not fixed here, D-08):** dataset cards appearing/disappearing as the user changes year can surprise users; consider showing the Employees card whenever salaries exist for *any* year and prompting a year switch.

---

## Checklist summary (for reporting)

When you finish, report back by item number:

```
1: PASS/FAIL/PARTIAL — [notes if not PASS]
2: PASS/FAIL/PARTIAL — ...
...
24: PASS/FAIL/PARTIAL — ...
```

Then select your sign-off decision:
- **signoff-all-pass** — all 24 items pass; VER-04 satisfied
- **signoff-with-flags** — most pass; list the specific item numbers that failed or were partial
- **fail-blocking** — a blocking defect prevents the parity work from being usable; describe item + what you saw

---

*Checklist authored: 2026-06-17*
*Targets: https://treasurytracker.empowered.vote (NOT financials.empowered.vote)*
*VER-04 items: FY2003 depth (items 2–3, 8–9) | per-capita (items 4–5, 10–11) | enrichment (items 6, 24) | breadcrumb (items 12, 15, 19) | Cities-in-County (items 13, 17) | salaries tab (items 21–23)*
