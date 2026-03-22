---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: milestone
status: unknown
last_updated: "2026-03-22T05:07:10.183Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
---

# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** A citizen can load the app and within seconds understand the top-level budget breakdown, then drill down to any department or line item.
**Current milestone:** v1.1 Multi-City Platform
**Current focus:** Phase 02 — city-config-dynamic-ui

## Current Position

Phase: 3
Plan: Not started

## Performance Metrics

- Phases complete: 0 / 4
- Requirements shipped: 0 / 15
- Plans complete: 0 / ?

## Accumulated Context

### Decisions

- Codebase bootstrapped into GSD on 2026-03-21; v1.0 represents all pre-GSD functionality
- Phase numbering starts at 1 for v1.1 (first milestone using GSD)
- Phase 1 must bundle routing + data file migration in the same commit — the existing silent mock-data fallback makes a split approach dangerous (a 404 after file move renders as plausible-looking mock data)
- Mock-data fallback removal is a Phase 1 blocker, not optional cleanup
- Phase 3 is independent of Phase 2 and can begin in parallel once Phase 1 merges
- ROUTE-03 is assigned to Phase 1 (the route shell + unknown-slug redirect); LA data behind it is Phase 4
- LA transactions are explicitly out of scope for v1.1 (`hasTransactions: false` in LA config)
- [Phase 01]: Import from react-router not react-router-dom (v7 consolidates into single package)
- [Phase 01]: CityPage receives slug as prop not via useParams -- clean testability, explicit over implicit
- [Phase 01]: NPM_TOKEN (GitHub Packages) required for npm install -- ev-ui is private; devs must set this env var
- [Phase 01-routing-shell-data-namespacing]: Phase 1 marked complete with one known gap: Criterion 5 (error state on missing data) never transitions from loading to error UI; gap deferred to Phase 2 or standalone fix
- [Phase 01-routing-shell-data-namespacing]: Error state checked before loading guard — if (loadError) at line 220 appears before if (loading) at line 235; prevents infinite spinner on fetch failure
- [Phase 02-city-config-dynamic-ui]: getCityConfig guard placed after all hooks (Navigate rendered after displayText) to comply with React rules of hooks
- [Phase 02-city-config-dynamic-ui]: LA placeholder in CITY_REGISTRY with isComingSoon:true shows in city picker as disabled but is filtered from routes
- [Phase 02-city-config-dynamic-ui]: cityConfig.hasTransactions gates LinkedTransactionsPanel rendering — cities without transaction data see no broken UI
- [Phase 02-city-config-dynamic-ui]: availableDatasets prop on DatasetTabs filters to visibleDatasets — future cities can omit tabs not supported by their data
- [Phase 02-city-config-dynamic-ui]: Smoke test deferred: NPM_TOKEN not available on current machine; all 16 automated checks passed; visual verification to be completed within 1-2 days from main computer

### Known Risks / Blockers

- **LA CSV column names unconfirmed** — must download and inspect actual LA dataset from data.lacity.org before writing LA hierarchy config in Phase 3; do not assume column names match Bloomington
- **LA data file size unknown** — Bloomington transaction files are 38–47MB; LA checkbook could exceed Netlify's 100MB deploy limit; audit before pipeline work
- **Two `loadDataset` implementations exist** — one live in `App.tsx`, one dead in `dataLoader.ts`; Phase 1 must decide to consolidate or update both; leaving them diverged adds maintenance risk
- **Socrata dataset IDs for LA may change annually** — verify current-year dataset ID from data.lacity.org before Phase 4 download

### Todos

- [ ] Plan Phase 1 (`/gsd:plan-phase 1`)

## Session Continuity

To resume: read ROADMAP.md for phase structure, then REQUIREMENTS.md for requirement details.
Next action: `/gsd:plan-phase 1`
