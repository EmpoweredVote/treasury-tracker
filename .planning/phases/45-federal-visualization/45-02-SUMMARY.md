# 45-02 Summary — FederalLanding Components

**Executed:** 2026-06-12 | **Status:** Complete — build green

## Shipped

- `src/components/federal/SourceChip.tsx` — generic attribution pill (name · fetched date ↗), external-link safe, dark-mode tokens, aria-labeled. The VIZ-04 unit.
- `src/components/federal/DeficitStrip.tsx` — FY2025 receipts vs outlays on a shared scale; deficit overhang hatched and labeled ("about 25¢ of every dollar spent was borrowed" — computed from the two sourced figures, formula in title attr); debt chip with as-of date. Raw OMB sign convention respected (negative = deficit); surplus years render without the overhang.
- `src/components/federal/FirstSplitBands.tsx` — proportional Mandatory/Discretionary/Net Interest bar (≥640px) with stacked-row mobile variant; keyboard-accessible definition popovers (structural definitions: how the spending is DECIDED, no editorializing); Discretionary popover shows the defense/nondefense split. Informational, not drillable (45-CONTEXT).
- `src/components/federal/ThisYearStrip.tsx` — FY2026 FYTD in/out with as-of date + partial-year caveat; FY derived from the as-of month (Oct+ → +1).
- `src/components/federal/FederalLanding.tsx` — fetches /federal/context once (loading skeleton, honest error state — never fabricated numbers); headline year = LAST row of annual_summary (latest actual year — survives next year's data without code change).
- `src/data/dataLoader.ts` — loadFederalContext() (cached, throws on failure per D-06).
- `src/types/budget.ts` — FederalContext types; metadata.dataSourceInfo extended with datasetUrl/fetchedAt (the existing field — dataLoader passes the object through untouched, so the new fields flow automatically).
- `src/App.tsx` — federal branch: FederalLanding replaces PlainLanguageSummary for entity_type==='federal' only; all other entities untouched (ternary around the existing block, no logic change).

## Verification

- tsc + npm run build green.
- All figures from /federal/context props — grep confirms zero hardcoded dollar values in src/components/federal/.
- Headline-year selection is data-driven (last actual row), not '2025' literal.

## Deviations from plan

- metadata.dataSourceInfo already existed in BudgetData — extended it rather than adding a parallel field (less churn than planned).
