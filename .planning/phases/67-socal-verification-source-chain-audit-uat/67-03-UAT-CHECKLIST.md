# Phase 67 Plan 03 — SoCal UAT Checklist (Task 1 artifact)

**Purpose:** Guided click-through for Chris to walk against the live app at
**https://treasurytracker.empowered.vote**. Chris drives the browser; the agent records results.
Exercises every VER-06 item across a representative SoCal spread, including counties **created this milestone**.

**VER-06 items covered:** FY2003 history depth | salaries dataset/tab | per-capita across backfilled years | enrichment (plain category names) | breadcrumb chain (US → California → County → city) | Cities-in-County panel

**Entity spread (all data pre-verified read-only, 2026-06-17):**
- **A — Riverside (city)** — Riverside County; op 24 / rev 22 / salaries 16 yrs; FY2003 present; pop 324,000. (FY2003 depth + per-capita + enrichment + Salaries tab)
- **B — Ventura County** (county government page) — op/rev FY2003–2024; pop 823,863; **10 cities linked** (Cities-in-County). A county **created this milestone**. (icicle/summary + per-capita + Cities-in-County + breadcrumb)
- **C — Oxnard** (city in Ventura County) — op/rev FY2003–2024; salaries 16 yrs; pop 181,763. (breadcrumb US → California → **Ventura County** → Oxnard; Salaries tab)
- **D — El Centro** (city in Imperial County — smallest cohort) — op/rev FY2003–2024; salaries 16 yrs; pop 38,881. (breadcrumb into **Imperial County**, a milestone-created county)

**Before you start:** Open https://treasurytracker.empowered.vote. Report each item by number: **PASS / FAIL / PARTIAL** (plus what you saw if not PASS).

---

## Section A — Riverside (city) — FY2003 depth, per-capita, enrichment, salaries

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 1 | Search/click **Riverside** (CA) | Riverside's budget page loads; operating/revenue data visible |
| 2 | Open the year selector / history | **FY2003** appears as the earliest available year |
| 3 | Select **FY2003** | Renders Riverside's FY2003 operating/revenue without errors; no "no data" |
| 4 | With FY2003 selected, find **per-capita** | A per-capita $ amount displays (not blank/zero) |
| 5 | Select a recent year (e.g. **FY2024**) and check per-capita | Per-capita renders for the recent year too (population works across years) |
| 6 | Look at category names in the icicle/list | Plain-language names ("General Government", "Public Safety", "Public Works"…), not raw SCO codes — enrichment rendering |
| 7 | Open the **Salaries** tab/card | Salaries dataset present; Department → Position breakdown renders (plain department names) |

---

## Section B — Ventura County (county government) — icicle/summary, per-capita, Cities-in-County, breadcrumb

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 8 | Navigate to **Ventura County** (the county government entity, not a city) | County page loads with an **icicle/summary** (no longer "directory-only") |
| 9 | Check the year selector | FY2003–2024 available; select FY2003 and a recent year — both render |
| 10 | Find **per-capita** on the county page | A per-capita $ amount displays (population 823,863 working) |
| 11 | Find the **Cities-in-County** panel | Lists Ventura County cities (≈10: Camarillo, Oxnard, Ojai, Simi Valley, Thousand Oaks, …) |
| 12 | Check the **breadcrumb** | Shows US → California → Ventura County |

---

## Section C — Oxnard (Ventura County city) — breadcrumb into a milestone-created county + salaries

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 13 | Navigate to **Oxnard** (CA) — e.g. via the Ventura County Cities-in-County panel | Oxnard's budget page loads |
| 14 | Check the **breadcrumb chain** | US → California → **Ventura County** → Oxnard (the new county hop renders) |
| 15 | Open the **Salaries** tab | Salaries dataset present; Department → Position breakdown renders |
| 16 | Spot-check per-capita on a backfilled year | Per-capita renders (pop 181,763) |

---

## Section D — El Centro (Imperial County — smallest cohort) — breadcrumb into a milestone-created county

| # | Navigation step | Expected result |
|---|-----------------|-----------------|
| 17 | Navigate to **El Centro** (CA) | El Centro's budget page loads; FY2003 present |
| 18 | Check the **breadcrumb chain** | US → California → **Imperial County** → El Centro |
| 19 | Open **Imperial County** from the breadcrumb; find Cities-in-County | Imperial County page renders; Cities-in-County lists its cities (Brawley, Calexico, El Centro, Imperial…) |
| 20 | Spot-check enrichment + a recent-year per-capita on El Centro | Plain category names; per-capita renders |

---

**When done:** report PASS/FAIL/PARTIAL per item. The agent records your results and your sign-off at the blocking checkpoint.
