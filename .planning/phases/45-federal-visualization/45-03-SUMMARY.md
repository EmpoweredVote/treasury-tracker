# 45-03 Summary — Lens, Scale, Chips, Methodology

**Executed:** 2026-06-12 | **Status:** Complete — build green

## Shipped

- `src/components/federal/LensToggle.tsx` — "What it's for" / "Who spends it" segmented control, aria-pressed.
- App.tsx lens wiring: `federalLens` state; the agency lens substitutes `federal_agency` for `operating` at load time (tab state untouched — the lens is a view of Money Out, not a tab); `lens=agency` URL param round-trips (syncURL + mount parsing, federal-only); lens resets on entity change; navigationPath resets on toggle.
- Per-dataset SourceChip beside the controls (federal only): displayName + exact datasetUrl + fetchedAt from the 45-01 budgets fields. Money In gets the chip + scale toggle without the lens.
- **Per-taxpayer VERIFIED and shipped**: irs.gov does NOT bot-block. IRS Data Book Table 1-2 xlsx → "Individual, total" FY2025 = **162,754,810**. New `scripts/loadFederalTaxpayers.js` (scrapes the page for the current edition, sanity band 100M–200M, halt outside) → `tax_returns_filed` metric; `irs-data-book` registry row added.
- `src/components/federal/ScaleToggle.tsx` — `$` / `Per person` / `Per taxpayer` (the latter hidden if the metric is absent); formula + denominator source in tooltips. **"% of total" interpretation:** satisfied natively — every icicle segment already displays its share at every level; a $→% data transform would corrupt the currency formatters. Recorded as the VIZ-05 reading.
- Display transform in App.tsx: pure-math copy of the category tree (amount, actualAmount, lineItems ÷ sourced denominator); loaded data never mutated (T-45-04); spot-check: Social Security $1,580.7B ÷ 340,110,988 = $4,648/person.
- `src/components/federal/MethodologyPanel.tsx` — collapsible "How to read these numbers": outlays vs budget authority; visual-vs-official totals **computed live** from the context payload (sums the excluded/offsets disclosure metrics — renders $7,532.2B / $521.1B / $8,905.0B-equivalent figures from data, zero hardcoded); negative money isn't hidden; partial-year caveat; depth boundary (accounts = deepest outlay data; obligations not mixed). Rendered at the bottom of the federal top-level page.

## Verification

- tsc + npm run build green (one fix: `*/` inside a doc comment terminated it early).
- Non-federal entities: all new UI is behind `entity_type === 'federal'` conditions; zero municipal change.

## Deviations from plan

- "% of total" delivered as the visualization's native per-segment shares rather than a third transform mode (documented rationale above).
- Per-taxpayer loader is its own script (xlsx needs python; loadFederalMTS.js is pure-fetch Node) — same metric table, same conventions.
