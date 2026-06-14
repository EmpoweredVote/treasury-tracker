# Plan 50-03 Summary — Per-year federal landing block

**Status:** Complete (tsc + vite build green; runtime verified in 50-04)
**Commit:** `feat(50-03): per-year federal landing block (bands/deficit strip switch by year)`
**Requirements:** NAV-02

## What changed
- **`src/components/federal/FederalLanding.tsx`**: now takes `{ fiscalYear, periodLabel, isCurrent }`. Selects `summary = annual_summary.find(s => s.fiscal_year === fiscalYear)` (the context payload already carries every year FY1962+, so no extra fetch). Passes the selected year's row to `DeficitStrip` + `FirstSplitBands`. The intro sentence uses the selected year's receipts/outlays/deficit (sourced figures).
- **TQ / missing-summary guard**: when `periodLabel != null` (the TQ) or no matching row exists, renders a neutral heading ("Transition Quarter (Jul–Sep 1976)" / "FY{year}") with no bands/deficit strip and no unsourced prose — the three lens trees still render below; Phase 51 owns the TQ explanation.
- **D-03**: the total-debt sentence and `ThisYearStrip` (live FY2026 FYTD) render only when `isCurrent` (the latest annual year / default view).
- **`src/App.tsx`**: passes `fiscalYear`/`periodLabel`/`isCurrent` (`isCurrent = selectedYear === availableYears[0]`).

## Verification
- `npx tsc -b` exits 0; `npm run build` (tsc + vite) exits 0.
- Default FY2025 view unchanged (summary = FY2025 row, isCurrent true → debt sentence + FYTD strip as before).

## Notes
- Historical years show their own sourced bands/deficit strip; the debt figure (a current metric) is intentionally hidden on non-current years to avoid anachronism.
- Live behavior (bands change per year, TQ hides bands, FYTD only on current) is confirmed in 50-04.
