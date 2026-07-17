---
phase: 133-verification-live-uat
requirement: [PIMA-08, PIMA-09]
kind: live-app UAT checklist
app_url: https://treasurytracker.empowered.vote
run_by: Chris
run_date: 2026-07-17
status: passed
pass_count: 34
total_scenarios: 34
signoff: "Chris, 2026-07-17, live at treasurytracker.empowered.vote — 34/34 ALL PASS"
---

# Phase 133 — Live UAT Checklist (PIMA-08 + PIMA-09)

Run every scenario against the **live production app**:
**https://treasurytracker.empowered.vote** (not a local build, not
financials.empowered.vote). Fill the **Status** column with **PASS** or **FAIL**;
add a note for anything surprising. Tether scenario (j) has its expected outcome
**pre-determined** by `133-TETHER-VERDICT.md` — you are confirming the prediction,
not discovering it fresh.

The underlying DB data is already machine-verified (44/44 FY×mode roll-ups + every
leaf tie $0, clean source-chain audit — see `133-REDERIVATION.md`); this checklist
confirms the *live visual render* — the icicle/Money-In path runs through the
external `ev-accounts-api`, so a human confirms it.

**Tip:** deep-link straight to each municipality via the search/browse, or use the
breadcrumb `US → Arizona → Pima County → <municipality>`. The Pima County node now
lists all five munis (Tucson + the four new).

---

## A. Baseline scenarios (D-07) — Oro Valley

FY2024 grounding: GF revenue **$59,077,316** / GF expenditure **$50,170,504**.
Pinned 2024 population: **48,855**.

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| a1 | **Icicle drill — operating `Current`** (Oro Valley, Money Out, FY2024). Expand `Current`. | `Current` ($47,774,541) expands into **4** children: General government $21,508,943, Public safety $20,170,049, Transit $1,697,772, Culture and recreation $4,397,777. | PASS | |
| a2 | **Icicle drill — operating `Debt service`** (Oro Valley, FY2024). Expand `Debt service`. | `Debt service` ($581,043) expands into **2** children: Principal retirement $489,400, Interest and fiscal charges $91,643. | PASS | |
| a3 | **Money In / Money Out toggle** (Oro Valley, FY2024). | Money Out (operating) total = **$50,170,504**; Money In (revenue) total = **$59,077,316**. Both trees render; toggle is smooth, no empty/broken state. | PASS | |
| a4 | **Per-capita ($/resident)** (Oro Valley, FY2024). | Uses population **48,855**. Money Out ≈ **$1,026.93/resident**; Money In ≈ **$1,209.24/resident**. Finite, sensible numbers (no ∞ / NaN / $0). | PASS | |
| a5 | **Source chip** (Oro Valley, FY2024). Open/click the source chip on a category. | Chip present; resolves to the FY2024 canonical ACFR (`orovalleyaz.gov/.../oro-valley-town-of-acfr-24.pdf`). | PASS | |
| a6 | **Breadcrumb navigation.** From Oro Valley, walk `US → Arizona → Pima County → Oro Valley` and back. | All four levels resolve and are clickable; Pima County sits between Arizona and Oro Valley. | PASS | |

## B. Baseline scenarios (D-07) — Marana

FY2024 grounding: GF revenue **$94,153,099** / GF expenditure **$59,821,670**.
Pinned 2024 population: **62,380**.

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| b1 | **Icicle drill — operating `Current`** (Marana, Money Out, FY2024). Expand `Current`. | `Current` ($56,116,975) expands into **6** children: General government $18,580,854, Public safety $21,797,377, Highways and streets $3,347,517, Health and welfare $416,217, Economic and community development $4,943,778, Culture and recreation $7,031,232. | PASS | |
| b2 | **Icicle drill — operating `Debt service`** (Marana, FY2024). Expand `Debt service`. | `Debt service` ($141,231) expands into **2** children: Principal retirement $113,876, Interest and fiscal charges $27,355. | PASS | |
| b3 | **Money In / Money Out toggle** (Marana, FY2024). | Money Out total = **$59,821,670**; Money In total = **$94,153,099**, top source Sales taxes ($44,763,592). Both trees render. | PASS | |
| b4 | **Per-capita ($/resident)** (Marana, FY2024). | Uses population **62,380**. Money Out ≈ **$958.99/resident**; Money In ≈ **$1,509.35/resident**. | PASS | |
| b5 | **Source chip** (Marana, FY2024). | Chip present; resolves to the FY2024 canonical ACFR (`maranaaz.gov/.../2024-town-of-marana-acfr-final.pdf`). | PASS | |
| b6 | **Breadcrumb navigation.** `US → Arizona → Pima County → Marana` and back. | All four levels resolve and are clickable. | PASS | |

## C. Baseline scenarios (D-07) — Sahuarita

FY2024 grounding: GF revenue **$32,166,628** / GF expenditure **$23,924,397**.
Pinned 2024 population: **37,448**.

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| c1 | **Icicle drill — operating `Current`** (Sahuarita, Money Out, FY2024). Expand `Current`. | `Current` ($23,363,720) expands into **3** children: General government $7,431,137, Public safety $12,450,244, Culture and recreation $3,482,339. | PASS | |
| c2 | **Icicle drill — operating `Debt service`** (Sahuarita, FY2024). Expand `Debt service`. | `Debt service` ($257,902) expands into **2** children: Principal $244,724, Interest $13,178. | PASS | |
| c3 | **Money In / Money Out toggle** (Sahuarita, FY2024). | Money Out total = **$23,924,397**; Money In total = **$32,166,628**, top source Intergovernmental ($16,603,123). Both trees render. | PASS | |
| c4 | **Per-capita ($/resident)** (Sahuarita, FY2024). | Uses population **37,448**. Money Out ≈ **$638.76/resident**; Money In ≈ **$858.97/resident**. | PASS | |
| c5 | **Source chip** (Sahuarita, FY2024). | Chip present; resolves to the FY2024 canonical ACFR (`sahuaritaaz.gov/DocumentCenter/View/11908`). | PASS | |
| c6 | **Breadcrumb navigation.** `US → Arizona → Pima County → Sahuarita` and back. | All four levels resolve and are clickable. | PASS | |

## D. Baseline scenarios (D-07) — South Tucson

Latest available FY grounding (FY2022 — FY2023/FY2024 not yet published, see
scenario i): GF revenue **$6,201,468** / GF expenditure **$5,883,806**.
Pinned 2024 population: **4,535**.

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| d1 | **Icicle drill — operating `Current`** (South Tucson, Money Out, FY2022). Expand `Current`. | `Current` ($5,301,120) expands into **3** children: General government $1,416,839, Public safety $3,782,754, Highways and streets $101,527. | PASS | |
| d2 | **Icicle drill — operating `Debt service`** (South Tucson, FY2022). Expand `Debt service`. | `Debt service` ($533,013) expands into **2** children: Principal retirement $312,685, Interest and fiscal charges $220,328. | PASS | |
| d3 | **Money In / Money Out toggle** (South Tucson, FY2022). | Money Out total = **$5,883,806**; Money In total = **$6,201,468**, top source City sales taxes ($3,985,982). Both trees render. | PASS | |
| d4 | **Per-capita ($/resident)** (South Tucson, FY2022 or latest available). | Uses population **4,535**. Money Out ≈ **$1,297.42/resident**; Money In ≈ **$1,367.47/resident**. Finite, sensible numbers — note South Tucson is by far the smallest of the four (pop 4,535 vs 37K–62K). | PASS | |
| d5 | **Source chip** (South Tucson, FY2022). | Chip present; resolves to the FY2022 canonical origin (`southtucsonaz.gov/.../annual_financial_report_fye_6-30-2022.pdf`, ADE-mirror-retrieved per 131-RECON). | PASS | |
| d6 | **Breadcrumb navigation.** `US → Arizona → Pima County → South Tucson` and back. | All four levels resolve and are clickable. | PASS | |

## E. Baseline (D-07) — Pima County + Arizona shared checks

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| e1 | **Cities-in-County panel** (Pima County node). Open Pima County. | Pima County renders as a **navigation node**; its Cities-in-County panel lists **all five** munis together — Tucson, Oro Valley, Marana, Sahuarita, South Tucson. Clicking any lands on that entity. (Pima County has no budget of its own — nav only — expected, not a bug.) | PASS | |

## F. Extra scenarios (D-08)

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| f1 | **AZ state regression.** Open the **Arizona** state node. | Arizona still renders its v2.14 ACFR data correctly (Money In/Out, icicle) — visibly undisturbed by the Pima munis load. | PASS | |
| f2 | **Year switcher + per-FY labels.** Pick any one of the four munis (e.g. Oro Valley) and switch across several FYs — **FY2024, FY2021, FY2019**. | Year switcher works; each FY loads and renders (spot-check totals against 131-RECON: Oro Valley FY2021 rev $53,628,289/exp $39,532,776; FY2019 rev $40,924,353/exp $35,448,052). Per-FY labels render honestly (no forced normalization to one era's vocabulary). | PASS | |
| f3 | **Oro Valley `-table` glyph-cleanup labels.** On Oro Valley, view an FY with the documented glyph-split artifact (FY2020, FY2023, or FY2024). | Labels display **cleanly** — "Transit" (not "Tran s it"), "Interest" (not "In teres t"), "Net increase/(decrease) in fair value of investments" (not "...in v es tmen ts") — and the dollar **values are intact/correct** (e.g. FY2024 Transit = $1,697,772). | PASS | |
| f4 | **South Tucson FY2023/FY2024 absence — clean empty state.** On South Tucson, look for FY2023 and FY2024 in the year switcher. | Both years are **simply absent** (not yet published by the city) — no broken/empty render, no phantom $0 row, no error. Newest available year is FY2022. | PASS | |

## G. Tether confirmation (PIMA-09, D-09) — confirm the pre-determined verdict

Pre-determined verdict (`133-TETHER-VERDICT.md`, live coverage.json fetched
2026-07-17, `fetched_ok`): **ALL FOUR COVERED** — icon EXPECTED on all four banners.

| # | Scenario | Expected (predicted) | Status | Note |
|---|----------|----------------------|--------|------|
| g1 | **Oro Valley tether icon.** On Oro Valley's hero banner, look for the Essentials tethered icon (yellow magnifying glass, bottom-right). | Icon **PRESENT**; clicking it deep-links Oro Valley into Essentials (opens in a new tab). Matches predicted GEOID `0451600`. | PASS | |
| g2 | **Marana tether icon.** On Marana's hero banner. | Icon **PRESENT**; deep-links Marana into Essentials. Matches predicted GEOID `0444270`. | PASS | |
| g3 | **Sahuarita tether icon.** On Sahuarita's hero banner. | Icon **PRESENT**; deep-links Sahuarita into Essentials. Matches predicted GEOID `0462140`. | PASS | |
| g4 | **South Tucson tether icon.** On South Tucson's hero banner. | Icon **PRESENT**; deep-links South Tucson into Essentials. Matches predicted GEOID `0468850`. | PASS | |
| g5 | **Tether adjudication.** Compare g1–g4 against the prediction. | Live render **matches** the ALL-FOUR-COVERED prediction. If any icon is unexpectedly **absent**, that is a PIMA-09 finding (record it) — the catalog covers all four, so absence would indicate a match/fetch bug, not a coverage gap. A confirmed **not-covered** (icon correctly absent, matching an uncovered verdict) would be a PASS per PIMA-09's met-with-documented-gap language — but that branch is not expected here since all four are predicted COVERED. | PASS | |

---

## Sign-off

- **Result:** ✅ All PASS ⬜ Pass with notes ⬜ Failures (list below)
- **Passed:** 34 / 34
- **Failures / findings:** None. Every baseline scenario (A. Oro Valley a1–a6, B. Marana
  b1–b6, C. Sahuarita c1–c6, D. South Tucson d1–d6, E. Pima County e1), every extra (F.
  f1–f4), and every tether confirmation (G. g1–g5) passed against the live app. All four
  municipalities' Essentials tether icons are present and match the pre-determined
  ALL-FOUR-COVERED verdict from `133-TETHER-VERDICT.md` (g5 adjudication: match).
- **Signed:** Chris  **Date:** 2026-07-17

**Note on scenario count:** this checklist's frontmatter originally estimated
`total_scenarios: 24` (the D-07 baseline count across the four munis, a1–d6); the
checklist as authored also includes 10 further D-08/D-09 scenarios (E, F, G), for **34**
numbered scenarios total. Corrected to 34/34 here to accurately reflect every row Chris
ran, rather than under-reporting the actual UAT surface (Rule 1 — count correction, no
scenario content changed).

Signed off 2026-07-17. Rolled up into `133-VERIFICATION.md`; REQUIREMENTS.md
traceability flipped to complete for PIMA-07 / PIMA-08 / PIMA-09 — closing v2.18.
