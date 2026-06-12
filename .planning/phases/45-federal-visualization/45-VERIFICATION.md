# Phase 45 Verification — Federal Visualization

**Date:** 2026-06-12. Automated sweep complete; Chris UAT recorded below.

## Per-requirement results (automated)

| Req | Status | Evidence |
|---|---|---|
| VIZ-01 | **PASS** | FirstSplitBands renders Mandatory 59.4% / Discretionary 26.7% (def $893.6B / nondef $981.5B in popover) / Net Interest 13.8% from production /federal/context FY2025; proportional bar, not an icicle; informational popovers with structural definitions. Note: BEA components sum to $7,011.100B vs 1.1 outlays $7,011.105B — $5M source-table rounding (8.1 publishes in 0.1B); bands normalize by their own total, so rendered proportions are exact. |
| VIZ-02 | **PASS** | DeficitStrip: receipts $5,236.4B vs outlays $7,011.1B on a shared scale, hatched overhang labeled "Deficit: $1,774.7B — about 25¢ of every dollar spent was borrowed" (computed; formula in title attr); debt chip $39.2T as of 2026-06-10. Official figures only (annual_summary), never tree totals. |
| VIZ-03 | **PASS** | Function lens default; LensToggle swaps to federal_agency without reload; `lens=agency` URL param written + parsed on mount (federal-only); lens resets on entity change; ThisYearStrip shows FY2026 FYTD with partial-year caveat. Both production datasets verified served (operating 18→61→1,613; federal_agency 29 depts/5 levels). |
| VIZ-04 | **PASS** | SourceChip on: DeficitStrip (OMB + Debt to the Penny), FirstSplitBands (OMB), ThisYearStrip (Treasury Fiscal Data), per-dataset chips beside the controls (displayName + exact datasetUrl + fetchedAt from budgets response). Spot-checked 3 chip URLs live → all 200 (outlays xlsx, debt_to_penny API, IRS Table 1-2 xlsx). |
| VIZ-05 | **PASS** | ScaleToggle: $ / Per person (÷340,110,988, Census Vintage 2024) / Per taxpayer (÷162,754,810, IRS Data Book Table 1-2 — VERIFIED source, loaded as tax_returns_filed metric). Formulas + denominator sources in tooltips and MethodologyPanel. Hand-check: Social Security $1,580.7B ÷ population = $4,648/person ✓. "% of total" = the visualization's native per-segment shares (every level), documented interpretation. Display-only transform; loaded data never mutated. |
| VIZ-06 | **PASS** | MethodologyPanel ("How to read these numbers"): outlays vs budget authority; visual-vs-official totals COMPUTED live from disclosure metrics (function +$521.1B, agency +$1,895.5B — matches 44-VERIFICATION); "negative money isn't hidden" ((offsetting) line items); partial-year caveat; depth boundary (accounts = deepest outlays; obligations not mixed). Every section chipped. |

## Regression (automated)

- All federal UI behind `entity_type === 'federal'` conditions; municipal render paths unchanged (PlainLanguageSummary still renders for non-federal; no toggles/chips bleed).
- tsc + npm run build green. Production cities count 533; Plano 19 datasets (production curl).
- BudgetIcicle normalization (from 44) is mathematically identical for municipal trees.

## Deploys

- Backend: ev-accounts `6b17df4f` → Render, verified live.
- Frontend: treasury-tracker `e5661e1` → Netlify (bundle poll confirms federal UI served).

## Chris UAT (Task 2)

**Round 1 (2026-06-12):** Two findings —
1. *"Clicking on Alaska caused it to lock up"* + React #310 stack trace. ROOT CAUSE: the displayData useMemo sat below the appView early returns — hook-count change on the landing→budget transition. **Fixed** (`d10e8de`): memo moved above all early returns. The accompanying 401 was pre-existing benign guest-session noise (/account/me).
2. *"Where would I see it?"* — discoverability: answered (FEDERAL GOVERNMENT section atop the jurisdiction dropdown + direct URL). Noted for future polish: the entity may deserve landing-page promotion.

**Round 2 (2026-06-12): VERDICT — PASS with notes.** Notes + dispositions:
- *"It should be total/per taxpayer"* + *"Why are per person/per taxpayer totals so different?"* → The math was already total ÷ denominator; the gap (population 340.1M vs returns 162.75M ≈ 2.1×) was only explained in hover tooltips. **Fixed** (`6406010`): visible formula line under the toggle in both modes, including the household/non-filer explanation of the gap.
- *"I wish there was an introduction paragraph for the United States that gave basic information as 'Context'"* → **Fixed** (`6406010`): FederalLanding now opens with a context paragraph composed entirely from sourced figures (receipts, outlays, deficit, debt) — no model-memory prose.

**Phase 45: CLOSED — all six VIZ requirements PASS; UAT notes applied same-day.**
