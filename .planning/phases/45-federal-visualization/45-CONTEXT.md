# Phase 45 Context — Federal Visualization

**Created:** 2026-06-12 (inline planning). **Goal:** A citizen landing on the United States page sees the proportional first split with deficit context and can drill either lens, every figure sourced.

**Division of labor (ROADMAP):** design decisions live HERE and in the plans (stronger model); execution is Sonnet-delegable. Plans carry exact component contracts for that reason.

## What Phase 44 left ready (see STATE.md "Phase 45 Inputs")

- US entity `0098c405-65e1-426f-8e5f-0fcbe2a900c0`, datasets live: operating (function lens), revenue, federal_agency (agency lens)
- `treasury.federal_annual_summary` (64 years incl. FY2025 official figures + BEA split)
- `treasury.federal_context_metrics` (71 rows: fytd_receipts/fytd_outlays/total_public_debt/fytd_interest_expense + 67 exclusion disclosures)
- `budgets.data_source_id` → `source_registry` (display_name + url) — the source-chip join; `data_sources.base_url` = exact dataset URL; `budgets.generated_at` = fetch timestamp
- BudgetIcicle already normalizes child widths; `federal_agency` already excluded from city tabs

## Architecture facts (verified this session)

- Frontend fetches via `src/data/dataLoader.ts` → `/api/treasury/cities/:id/budgets?fiscal_year=` → budget + categories. API_BASE handles dev proxy vs prod URL.
- Backend: `C:/EV-Accounts/backend/src/routes/treasury.ts` (Express, optionalAuth pattern, UUID_REGEX validation) + `treasuryService.ts`.
- App.tsx top-level dashboard renders at `navigationPath.length === 0`: PlainLanguageSummary → DatasetTabs → BudgetVisualization. Entity-specific behavior via flags (`isNonprofit` precedent at ~10 call sites).
- No federal-specific rendering exists; the US page currently shows the generic city experience.

## Design decisions (locked for this phase)

### Page composition (federal, top-level only)
```
[FederalLanding]                      ← NEW, replaces PlainLanguageSummary for federal
  ├─ DeficitStrip                     ← VIZ-02: receipts vs outlays bars, gap labeled, debt chip
  ├─ FirstSplitBands                  ← VIZ-01: Mandatory/Discretionary(def/nondef)/Net Interest
  └─ ThisYearStrip                    ← VIZ-03b: FY2026 FYTD receipts/outlays, as-of date
[DatasetTabs]                         ← unchanged (Money Out / Money In cards)
[LensToggle]                          ← VIZ-03a: "By what it's for" (default) | "By who spends it"
[BudgetVisualization]                 ← existing icicle/tree, fed operating OR federal_agency data
[MethodologyPanel]                    ← VIZ-06 + Phase-44 owed disclosures, collapsible
```
- FirstSplitBands are INFORMATIONAL (popover explainers), not drill targets — BEA category is orthogonal to the function drill; conflating them would mislead. Drill lives in the lens below.
- Deficit strip uses OFFICIAL figures (federal_annual_summary), never visual-tree totals.
- All federal branches keyed on `selectedEntity?.entity_type === 'federal'` (the isNonprofit pattern).

### Source chips (VIZ-04)
- New `SourceChip` component: `{sourceName, sourceUrl, fetchDate}` → small pill "Treasury Fiscal Data · fetched 2026-06-12 ↗" linking to the exact URL. Render on: DeficitStrip, FirstSplitBands, ThisYearStrip, debt chip, and the visualization header (per-dataset chip from budgets join).
- Data path: federal context endpoint returns per-row source fields (already stored); budgets endpoint gains source fields via source_registry join.

### Lens toggle (VIZ-03)
- Only rendered for federal + Money Out. Swaps the dataset feeding BudgetVisualization between 'operating' and 'federal_agency'. Default 'operating'. URL param `lens=agency` for shareability. Toggle labels: "What it's for" / "Who spends it" (citizen language, IA decision).

### Comparative scale (VIZ-05)
- Toggle group on the visualization header: `$` | `per person` | `% of total`. Per-person = amount / population (340,110,988, Census 2024 — chip links Census file). Formula disclosed in tooltip AND MethodologyPanel.
- **Per-taxpayer**: requires a SOURCED return count (IRS SOI). Verify-first task; if the IRS source can't be fetched/verified, ship per-capita + % only and record the gap against VIZ-05 — never an unsourced denominator.

### MethodologyPanel content (VIZ-06 + owed disclosures, every claim chipped)
1. Outlays vs budget authority: we show outlays (money actually spent), consistently.
2. Visual totals vs official: function lens shows $7,532.2B (= official $7,011.1B before $521.1B net-negative categories); agency lens $8,905.0B (before $1,895.5B offsets). Official figures in the DeficitStrip.
3. Offsetting receipts: negative items live as "(offsetting)" line items; 67 disclosure metrics enumerate them.
4. FY2025 actuals = headline; FY2026 FYTD = partial year (proportions not comparable).

## Risks / notes for executors

- PlainLanguageSummary must be SUPPRESSED for federal (its operating total would show the visual $7.5T without context) — FederalLanding replaces it.
- Backend deploy: EV-Accounts repo has its own deploy process — verify how prior phases shipped backend changes (32-04 touched it) before assuming; if deploy is manual, that's a human-action checkpoint.
- DatasetTabs operating card total will show $7,532.2B (visual total) — acceptable WITH the MethodologyPanel + official figures in DeficitStrip above it; do not "fix" the card by mixing in annual_summary numbers (one source per figure).
- Dark mode + mobile: every new component must use existing ev-* token classes; FirstSplitBands stack vertically under 640px.
