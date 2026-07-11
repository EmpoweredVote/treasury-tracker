---
phase: 130-verification-live-uat
requirement: [TUC-08, TUC-09]
kind: live-app UAT checklist
app_url: https://treasurytracker.empowered.vote
run_by: Chris
run_date: 2026-07-11
status: passed   # awaiting-signoff | passed | failed
pass_count: 15
total_scenarios: 15
signoff: "Chris — all 15 pass (2026-07-11)"
---

# Phase 130 — Live UAT Checklist (TUC-08 + TUC-09)

Run every scenario against the **live production app**:
**https://treasurytracker.empowered.vote** (not a local build, not
financials.empowered.vote). Fill the **Status** column with **PASS** or **FAIL**;
add a note for anything surprising. Tether scenario (j) has its expected outcome
**pre-determined** by `130-TETHER-VERDICT.md` — you are confirming the prediction.

The underlying DB data is already machine-verified ($0 re-derivation + clean
source-chain audit, see `130-REDERIVATION.md`); this checklist confirms the *live
visual render* — the icicle/Money-In path runs through the external `ev-accounts-api`,
so a human confirms it.

**Tip:** deep-link straight to Tucson via the search/browse, or use the breadcrumb
`US → Arizona → Pima County → Tucson`.

---

## A. Baseline scenarios (D-07) — across Tucson + Pima County + Arizona

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| a1 | **Icicle drill — operating `Current`** (Tucson, Money Out, FY2024). Expand the `Current` category. | `Current` ($559,483,332) expands into **5** children: Public safety and justice services ($296,810,861), Support services ($118,799,735), Community enrichment and development ($70,448,394), General government ($39,933,107), Elected and official ($33,491,235). | PASS | |
| a2 | **Icicle drill — operating `Debt service`** (Tucson, FY2024). Expand `Debt service`. | `Debt service` ($59,871,756) expands into **3** children: Principal ($41,325,395), Interest ($18,522,806), Fiscal agent fees ($23,555). | PASS | |
| a3 | **Money In / Money Out toggle** (Tucson, FY2024). Toggle between the two views. | Money Out (operating) total ≈ **$648,657,363**; Money In (revenue) total ≈ **$773,493,270**, top source Taxes ($405,003,757). Both trees render; toggle is smooth, no empty/broken state. | PASS | |
| a4 | **Per-capita ($/resident)** (Tucson, FY2024). Switch to per-capita display. | Uses population **554,013**. Money Out ≈ **$1,170.83/resident**; Money In ≈ **$1,396.16/resident**. Finite, sensible numbers (no ∞ / NaN / $0). | PASS | |
| a5 | **Source chips** (Tucson, any FY). Open/click the source chip on a category. | Chip present; resolves to the correct-per-FY **tucsonaz.gov** ACFR PDF (e.g. FY2024 → `cot-2024-annual-comprehensive-financial-report.pdf`). Labeled "City of Tucson ACFR — General Fund … (FYxxxx actual, GAAP basis)". | PASS | |
| a6 | **Breadcrumb navigation.** From Tucson, walk the breadcrumb `US → Arizona → Pima County → Tucson` and back. | All four levels resolve and are clickable; Pima County is present as a node between Arizona and Tucson. | PASS | |
| a7 | **Cities-in-County panel** (Pima County node). Open Pima County. | Pima County renders as a **navigation node**; its Cities-in-County panel lists **Tucson**; clicking Tucson lands on the Tucson entity. (Pima County has no budget of its own — nav only — that is expected, not a bug.) | PASS | |

## B. Extra scenarios (D-08)

| # | Scenario | Expected | Status | Note |
|---|----------|----------|--------|------|
| b1 | **AZ state regression.** Open the **Arizona** state node. | Arizona still renders its v2.14 ACFR data correctly (Money In/Out, icicle) — visibly undisturbed by the Tucson load. | PASS | |
| b2 | **Year switcher + era labels.** On Tucson, switch across several FYs (e.g. **FY2024, FY2020, FY2016**). | Year switcher works; each FY loads (spot-check totals: FY2020 operating ≈ $470,241,319 / revenue ≈ $558,372,140; FY2016 operating ≈ $430,230,002 / revenue ≈ $493,460,305). Per-FY category **labels are honest per year** (not normalized to one era's vocabulary — e.g. older FYs may say "Non-Departmental" where FY2024 says "General government"). | PASS | |
| b3 | **FY2021 / FY2022 merged-label quirk.** On Tucson, view **FY2021 revenue** and **FY2022 revenue**. | The two cosmetically-merged revenue category labels (FY2021 "Contributions from Outside Miscellaneous"; FY2022 "Developer fees - - Use of money and property") display **acceptably**; the dollar totals still tie; the Tucson-scoped enrichment text explains the quirk. Cosmetic only — not alarming. | PASS | |
| b4 | **FY2025-absence empty state.** On Tucson, look for **FY2025** in the year switcher. | FY2025 is **simply absent** (not yet published) — no broken/empty render, no phantom $0 row, no error. The newest available year is FY2024. | PASS | |

## C. Tether confirmation (TUC-09, D-09) — confirm the pre-determined verdict

Pre-determined verdict (`130-TETHER-VERDICT.md`, live coverage.json 2026-07-10):
**both COVERED** — icon EXPECTED on both banners.

| # | Scenario | Expected (predicted) | Status | Note |
|---|----------|----------------------|--------|------|
| j1 | **Tucson tether icon.** On Tucson's hero banner, look for the Essentials tethered icon (yellow magnifying glass, bottom-right). | Icon **PRESENT**; clicking it deep-links Tucson into Essentials (opens Essentials in a new tab). Matches predicted GEOID `0477000`. | PASS | |
| j2 | **Pima County tether icon.** On the Pima County banner, look for the Essentials icon. | Icon **PRESENT**; deep-links Pima County into Essentials. Matches predicted GEOID `04019`. | PASS | |
| j3 | **Tether adjudication.** Compare j1/j2 against the prediction. | Live render **matches** the COVERED prediction. If an icon is unexpectedly **absent**, that is a TUC-09 finding (record it) — the catalog covers both, so absence would indicate a match/fetch bug, not a coverage gap. | PASS | |

---

## Sign-off

- **Result:** ☑ All PASS ⬜ Pass with notes ⬜ Failures (list below)
- **Passed:** 15 / 15
- **Failures / findings:** none — every baseline (a1–a7), extra (b1–b4), and tether (j1–j3) scenario passed; the Essentials tether icon rendered on both the Tucson and Pima County banners, matching the pre-determined COVERED verdict.
- **Signed:** Chris  **Date:** 2026-07-11

Once signed, tell me the result and I'll roll it up into `130-VERIFICATION.md` and flip
the REQUIREMENTS.md traceability for TUC-07 / TUC-08 / TUC-09 — closing v2.17.
