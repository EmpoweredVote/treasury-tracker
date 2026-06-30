---
phase: 106-verification-source-chain-audit-uat-ver-03-ver-04
plan: 03
requirement: VER-04
status: pending
production-confirmed: "2026-06-30 HTTP 200 at treasurytracker.empowered.vote"
---

# Phase 106 — Live-App UAT Checklist (VER-04)

**Purpose:** Human sign-off that the v2.12 data (deepened CA / NY / FL pilot history + new PA + IL
ACFR nodes from Phase 105) renders correctly to a citizen in the live app. Data correctness was
independently proven in Plan 106-01 (24/24 exact ties, 106-REDERIVATION.md) and the 50-node
source-chain audit is clean (Plan 106-02, 7/7 invariants, 106-COHORT-AUDIT.md). This UAT is the
final check that what the DB says matches what the app shows.

**App URL:** https://treasurytracker.empowered.vote

**Production confirmed live:** HTTP 200 at treasurytracker.empowered.vote (verified 2026-06-30 by executor).

**Precedent:** Phase 102 SC3 UAT (v2.11); same 5-point-per-anchor check pattern.

**Instructions for Chris:**
- Open each anchor's node + FY in the live app using the exact path / deep-link provided.
- Verify all 5 numbered checks for that anchor.
- Record PASS or FAIL next to each check. Add any notes.
- If all 5 checks pass, mark the anchor RESULT: PASS.
- If any check fails and it is a data-correctness or source-chain defect (wrong number, wrong basis
  label, broken source chip, missing revenue view), mark RESULT: FAIL and note the defect.
  Cosmetic / non-blocking items can be noted without marking FAIL.
- After all 8 anchors: record your sign-off at the bottom of this file (with date) if all PASS
  (or after any data defects are fixed in-phase and re-confirmed).

---

## Check Definitions (applies to every anchor)

| Check | What to Verify |
|-------|---------------|
| (a) Revenue-by-source | The "Money In" / Revenue view loads and shows individual by-source rows (e.g. "Taxes", "Federal grants", "Licenses and permits", etc.) — NOT a flat single-row total |
| (b) Spending-by-function | The default spending icicle loads with multiple function-level rows (e.g. "Education", "Health", "Transportation", etc.) |
| (c) Basis label | The basis label shown on the node is correct: "GAAP (General Fund)" for ACFR states; "NASBO operating" for the un-upgraded control |
| (d) Source chip | The source chip (citation block) shows a populated URL and a source date — not blank or a placeholder |
| (e) Money In enabled / disabled | For ACFR states: the "Money In" card / revenue tab is enabled and shows revenue-by-source. For the NASBO control state: Money In is DISABLED (the card is grayed out or absent) |

---

## Anchor 1 — Pennsylvania, Recent FY (FY2025)

**Node:** Pennsylvania (State)
**FY:** 2025
**Deep-link:** https://treasurytracker.empowered.vote/?state=PA&dataset=revenue&fy=2025

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$92,414,817,000**
- Operating/spending total: **$94,758,255,000**
- Basis: ACFR GAAP (General Fund column — Governmental Funds Statement of Rev/Exp)
- Source: Pennsylvania ACFR — url containing `pa.gov` + `annualfinancialreport` + `acfr`
  (PA FY2025 URL pattern: `june-30-2025%20acfr.pdf`, %20 space variant)
- Units: thousands (values stored in full dollars = printed value × 1,000)

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders with by-source rows | Multiple named revenue categories visible (Taxes, Federal grants, Charges for services, etc.) | | |
| b | Spending-by-function renders | Multiple function rows visible | | |
| c | Basis label | "GAAP" or "ACFR" basis label shown (NOT "NASBO") | | |
| d | Source chip url + date | URL points to pa.gov ACFR; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled and shows revenue-by-source (not disabled) | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 2 — Pennsylvania, Deep Floor FY (FY2016)

**Node:** Pennsylvania (State)
**FY:** 2016
**Deep-link:** https://treasurytracker.empowered.vote/?state=PA&dataset=revenue&fy=2016

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$56,741,506,000**
- Operating/spending total: **$56,135,869,000**
- Basis: ACFR GAAP (General Fund column)
- Source: Pennsylvania ACFR FY2016 — URL contains `pa.gov` + `june-30-2016-acfr.pdf` (hyphen variant, no space)
- Units: thousands

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders with by-source rows | Multiple named revenue categories visible | | |
| b | Spending-by-function renders | Multiple function rows visible | | |
| c | Basis label | "GAAP" or "ACFR" basis label (NOT "NASBO") | | |
| d | Source chip url + date | URL points to pa.gov ACFR FY2016; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled and shows revenue-by-source | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 3 — Illinois, Recent FY (FY2025)

**Node:** Illinois (State)
**FY:** 2025
**Deep-link:** https://treasurytracker.empowered.vote/?state=IL&dataset=revenue&fy=2025

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$78,342,927,000**
- Operating/spending total: **$75,456,922,000**
- Basis: ACFR GAAP (General Fund column)
- Source: Illinois ACFR FY2025 — URL contains `illinoiscomptroller.gov` + `ACFR%20Final%202025%20-%20Bookmarked.pdf`
- Units: thousands

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders with by-source rows | Multiple named revenue categories visible (Income taxes, Sales taxes, Federal sources, etc.) | | |
| b | Spending-by-function renders | Multiple function rows visible | | |
| c | Basis label | "GAAP" or "ACFR" basis label (NOT "NASBO") | | |
| d | Source chip url + date | URL points to illinoiscomptroller.gov ACFR; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled and shows revenue-by-source | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 4 — Illinois, FY2022 (Negative-Clamp Year)

**Node:** Illinois (State)
**FY:** 2022
**Deep-link:** https://treasurytracker.empowered.vote/?state=IL&dataset=revenue&fy=2022

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$73,204,339,000** (this is the printed root total from the ACFR, which already
  nets the negative investment loss — the bar is the printed total, not a sum of only positive items)
- Operating/spending total: **$62,089,769,000**
- Negative-clamp line: "Interest and other investment income" was **-$197,857,000** in FY2022.
  The P2 clamp renders this line at $0 in the icicle with the label **(net loss — shown at 0)**.
  The root revenue total ($73,204,339,000) is unaffected — it preserves the printed net.
- Basis: ACFR GAAP
- Source: Illinois ACFR FY2022 — URL contains `illinoiscomptroller.gov` + `ACFR%20Final%20FY%202022.pdf`

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders; clamp label visible | "Interest and other investment income" row shows "(net loss — shown at 0)" label (not a negative number) | | |
| b | Root revenue total is preserved correctly | Root / header revenue total shown as **$73,204,339,000** (± display rounding) | | |
| c | Basis label | "GAAP" or "ACFR" basis label | | |
| d | Source chip url + date | URL points to illinoiscomptroller.gov ACFR FY2022; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 5 — New York, Deep Floor FY (~FY2003, ×millions scaling)

**Node:** New York (State)
**FY:** 2003
**Deep-link:** https://treasurytracker.empowered.vote/?state=NY&dataset=revenue&fy=2003

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$29,250,000,000** (printed in the ACFR in millions: $29,250M × 1,000,000)
- Operating/spending total: **$40,910,000,000** (printed in millions: $40,910M × 1,000,000)
- Units note: NY ACFRs report in millions (×1,000,000). The DB stores full dollar values.
  The app must display approx **$29.3 billion** revenue / **$40.9 billion** operating.
  If the app shows values around $29 billion (not $29 million or $29 trillion), the scaling is correct.
- Basis: ACFR GAAP
- Source: NY ACFR FY2003 — URL contains `osc.ny.gov` + `comprehensive-annual-financial-report-2003.pdf`

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders with by-source rows | Multiple named revenue categories visible | | |
| b | Operating total in the correct billions range | Spending displayed as ~$40.9 billion (NOT ~$40.9 million or ~$40.9 trillion) — ×millions scaling correct | | |
| c | Basis label | "GAAP" or "ACFR" basis label | | |
| d | Source chip url + date | URL points to osc.ny.gov ACFR 2003; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled and shows ~$29.3 billion revenue | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 6 — California, FY2008 (Clean-Pattern Floor / Deepening Boundary)

**Node:** California (State)
**FY:** 2008
**Deep-link:** https://treasurytracker.empowered.vote/?state=CA&dataset=revenue&fy=2008

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$97,774,378,000** (printed in ACFR in thousands: $97,774,378K × 1,000)
- Operating/spending total: **$98,975,042,000** (printed in thousands: $98,975,042K × 1,000)
- This is the oldest CA deepened year added by Phase 104, using the CAFR URL path:
  `https://www.sco.ca.gov/Files-ARD/CAFR/cafr08web.pdf`
- Basis: ACFR GAAP
- Source chip should show sco.ca.gov CAFR URL + date

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders with by-source rows | Multiple named revenue categories visible (Taxes, Licenses fees/permits, Federal revenues, etc.) | | |
| b | Spending-by-function renders | Multiple function rows visible | | |
| c | Basis label | "GAAP" or "ACFR" basis label | | |
| d | Source chip url + date | URL points to sco.ca.gov CAFR FY2008; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled, shows ~$97.8 billion revenue | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 7 — Florida, FY2021 (Negative-Clamp Year)

**Node:** Florida (State)
**FY:** 2021
**Deep-link:** https://treasurytracker.empowered.vote/?state=FL&dataset=revenue&fy=2021

**Expected values (from 106-REDERIVATION.md, exact tie confirmed):**
- Revenue total: **$46,989,188,000** (printed in ACFR in thousands; this root total already nets
  the negative investment loss — it is the ACFR's own printed root total)
- Operating/spending total: **$37,277,963,000**
- Negative-clamp line: "Investment earnings (losses)" was **-$398,287,000** in FY2021.
  The P2 clamp renders this line at $0 in the revenue icicle with the label
  **(net loss — shown at 0)**. The root revenue total ($46,989,188,000) preserves the net.
- Basis: ACFR GAAP
- Source: FL ACFR FY2021 — URL contains `myfloridacfo.com` + `fye-2021-state-of-florida-annual-comprehensive-financial-report.pdf`

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Revenue-by-source icicle renders; clamp label visible | "Investment earnings (losses)" row (or equivalent) shows "(net loss — shown at 0)" (not a negative number) | | |
| b | Root revenue total is preserved correctly | Root / header revenue total shown as **$46,989,188,000** (± display rounding) | | |
| c | Basis label | "GAAP" or "ACFR" basis label | | |
| d | Source chip url + date | URL points to myfloridacfo.com ACFR FY2021; date populated | | |
| e | Money In enabled | Revenue tab / Money In card enabled | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Anchor 8 — Georgia (Un-Upgraded NASBO Control State) — Regression Guard

**Node:** Georgia (State)
**FY:** 2024 (or 2023 — either works; both are NASBO operating-only)
**Deep-link:** https://treasurytracker.empowered.vote/?state=GA&fy=2024

**Purpose:** Confirm that the PA/IL/CA/NY/FL upgrades did NOT disturb the un-upgraded NASBO
states. GA is the canonical NASBO control used in Phase 106 Plan 02 (106-COHORT-AUDIT.md
INV-7). It must still render as operating-only with Money In disabled.

**Expected values (from 106-COHORT-AUDIT.md INV-7):**
- GA has exactly 2 budget rows: NASBO operating FY2023 + NASBO operating FY2024
- Data source label: "NASBO State Expenditure Report — General Fund (FY2023 actual…" (NASBO provenance)
- NO revenue-by-source data (no GA ACFR revenue rows loaded)
- Money In card: **DISABLED** (grayed out, not clickable, or absent)
- Attempting ?dataset=revenue deep-link should fall back gracefully to operating (not break or show a
  blank/error state)

**Checks:**

| # | Check | Expected | Result | Notes |
|---|-------|----------|--------|-------|
| a | Spending-by-function renders (operating view loads) | Operating budget icicle loads with NASBO function-level rows | | |
| b | Basis label shows NASBO operating | Basis label shows "NASBO" (NOT "GAAP" or "ACFR") | | |
| c | Source chip url + date | Source chip shows NASBO State Expenditure Report citation; date populated | | |
| d | Money In card is DISABLED | The "Money In" card or revenue tab is grayed out / absent / disabled — no revenue view available | | |
| e | ?dataset=revenue deep-link falls back gracefully | Navigating to `?state=GA&dataset=revenue&fy=2024` does NOT show a blank/error — falls back to operating view (regression guard: resolveEffectiveDataset helper) | | |

**RESULT: [ PASS / FAIL ]**
**Notes:**

---

## Summary Table

| Anchor | State | FY | Type | RESULT |
|--------|-------|----|------|--------|
| 1 | PA | FY2025 | Recent FY — new ACFR node | |
| 2 | PA | FY2016 | Deep floor — new ACFR node | |
| 3 | IL | FY2025 | Recent FY — new ACFR node | |
| 4 | IL | FY2022 | Negative-clamp year | |
| 5 | NY | FY2003 | Deep floor — ×millions scaling | |
| 6 | CA | FY2008 | Deep floor — Phase 104 deepening | |
| 7 | FL | FY2021 | Negative-clamp year — Phase 104 deepening | |
| 8 | GA | FY2024 | NASBO control — regression guard | |

---

## Sign-Off

After completing all 8 anchors:

**Sign-off:** ___________________________

**Date:** ___________________________

**All-pass verdict:** [ YES — all 8 anchors PASS / NO — see failed anchors above ]

**VER-04 status:** [ SATISFIED / PENDING IN-PHASE FIX ]

---

*Prepared: 2026-06-30 | Phase 106 Plan 03 | Executor: Claude (gsd-executor)*
*Production confirmed HTTP 200 at treasurytracker.empowered.vote*
*Expected values sourced from 106-REDERIVATION.md (24/24 exact ties) and 106-COHORT-AUDIT.md (7/7 invariants)*
