# Phase 50: Federal YearSelector Wiring — Context

**Gathered:** 2026-06-13 (inline scoping questions — no separate discuss-phase)
**Status:** Ready for planning
**Requirements:** NAV-01, NAV-02

<domain>
## Phase Boundary

Make every backfilled federal period (FY1976–FY2025 + the FY1976 Transition Quarter)
selectable in the existing federal YearSelector, with the function / agency / revenue
trees, the landing Mandatory/Discretionary/Net-Interest bands, the deficit strip, and the
source chips all updating to the selected period. Spans **two repos**: the `treasury-tracker`
frontend (this repo) and the `EV-Accounts` backend API (`../EV-Accounts`, separate Render deploy).

**In scope:** backend `period_label` exposure, frontend period model + selector + data-layer
disambiguation, per-year landing bands/deficit strip, FYTD-strip gating, regression safety.

**Explicitly NOT this phase:** comparability/definition-drift copy and the TQ explanation
(Phase 51); any change to FY2025-as-default or to city/county/state behavior.
</domain>

<decisions>
## Implementation Decisions (from scoping questions, 2026-06-13)

- **D-01 — Include the EV-Accounts backend change in Phase 50.** The live API drops
  `period_label`, and `/budgets?fiscal_year=1976` returns BOTH the real FY1976 and the TQ
  (6 rows), so the frontend cannot disambiguate FY1976 today. The backend must expose
  `period_label` on `available_datasets` and on the budget response. Implemented in
  `../EV-Accounts` (git `master`), committed there, coordinated to the Render deploy.
- **D-02 — Show the Transition Quarter as its own selectable period.** Render
  "Transition Quarter (Jul–Sep 1976)" as a distinct entry ordered immediately after FY1976.
- **D-03 — Hide the "this year so far" FYTD strip (ThisYearStrip) on non-current years.**
  Show it only on the default/current federal view (FY2025 headline); hide it when a historical
  period is selected.

### Claude's Discretion
- Period-token representation in the frontend (compound token vs parallel state) — planner's call.
- Landing bands on the TQ: `federal_annual_summary` has no TQ row (it is year-keyed), so the
  Mandatory/Discretionary/Net-Interest bands + deficit strip cannot be computed for the TQ.
  Hide them for the TQ (show only the three lens trees); Phase 51 adds the TQ explanation.
</decisions>

<canonical_refs>
## Canonical References

### Frontend (this repo)
- `src/App.tsx` — federal state: `selectedYear`, `availableYears` (derived from
  `selectedEntity.available_datasets`), `loadBudgetData` effect, lens/scale toggles, YearSelector render (~line 719).
- `src/components/YearSelector.tsx` — generic selector (`years: string[]`, `selectedYear`, `onYearChange`); hardcodes the "FY {year}" label.
- `src/data/dataLoader.ts` — `loadBudgetData` (fetch by `?fiscal_year=`, then `.find(dataset_type)`), `loadFederalContext`, `API_BASE`.
- `src/components/federal/FederalLanding.tsx` — currently FY2025-hardcoded (`annual_summary[last]`); feeds `DeficitStrip`, `FirstSplitBands`, `ThisYearStrip`.
- `src/types/budget.ts` — `Municipality.available_datasets`, `FederalAnnualSummaryRow`, `FederalContext`.

### Backend (`../EV-Accounts/backend/src`)
- `lib/treasuryService.ts` — `TreasuryDataset`/`TreasuryBudget` interfaces, `mapCity`/`mapBudget`,
  `getCities`/`getCityById` (`available_datasets` json_build_object), `getBudgetsByCityId` SELECTs.
- `routes/treasury.ts` — `/cities`, `/cities/:id/budgets`, `/budgets/:id/categories` endpoints.
- `tests/integration/treasury-cities.test.ts` — integration coverage to extend.

### Phase 49 carryover (STATE.md "Phase 49 outcomes")
- TQ stored at `fiscal_year=1976`, `budgets.period_label='Transition Quarter (Jul–Sep 1976)'`, dataset_id `tq1976`.
</canonical_refs>

<specifics>
## Verified facts (live, 2026-06-13)
- `/treasury/cities` already returns all 153 federal dataset rows (50 distinct years 1976–2025) — the **year list populates with no change**; the gap is only `period_label`.
- `/budgets?fiscal_year=1976` returns 6 rows (FY1976 + TQ × 3 lenses); `period_label` absent → ambiguous `.find()`.
- `loadFederalContext()` returns `annual_summary` for all 64 years (FY1962+) → landing bands can switch **frontend-only**.
- Backend is at `../EV-Accounts` (git `master`); deploys to Render separately from the frontend (Netlify).
</specifics>

<deferred>
- TQ comparability/explanation copy and definition-drift notes → Phase 51.
</deferred>

---
*Phase: 50-federal-yearselector-wiring · Context gathered 2026-06-13*
