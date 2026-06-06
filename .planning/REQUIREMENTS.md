# Requirements — v1.7 California State Budget + Deep Icicles

**Milestone:** v1.7
**Status:** Active
**Created:** 2026-06-06
**Core Value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

---

## Active Requirements

### INFRA — State Entity Infrastructure

- [ ] **INFRA-01**: Database supports `entity_type: 'state'` — migration adds 'state' to `treasury.municipalities` entity_type CHECK constraint
- [ ] **INFRA-02**: TypeScript `Municipality.entity_type` union includes `'state'` (1-line change in `src/types/budget.ts`)
- [ ] **INFRA-03**: Entity picker surfaces state entities in a dedicated "State Governments" section above all state/city groups — not nested inside the "CALIFORNIA" city group

### DATA — CA State Budget Data

- [ ] **DATA-01**: California seeded as a state-level municipality row (`name: 'California'`, `state: 'CA'`, `entity_type: 'state'`, `population: ~39,500,000`)
- [ ] **DATA-02**: California General Fund operating budget (~$212B) loaded for at least FY2024–25 and FY2025–26 via LAO Excel or ebudget.ca.gov PDF
- [ ] **DATA-03**: CA state budget categories AI-enriched with state-level framing (policy program framing, not city-level department framing)
- [ ] **DATA-04**: CA state budget page functional in live app — per-capita display, year selector, Money Out tab visible and correct

### TREE — 3-Level Tree Infrastructure

- [ ] **TREE-01**: `treasury_sync_budget_tree` RPC updated to accept 3-level trees (`c` → `c` → `i`); backward-compatible with all existing 2-level loaders (`c` → `i` path unchanged)
- [ ] **TREE-02**: `/api/treasury/budgets/:id/categories` endpoint returns 3-level `BudgetCategory[]` when `budget_line_items.department` is non-NULL; falls back to 2-level behavior for existing cities (where department IS NULL)
- [ ] **TREE-03**: All existing city and county pages render correctly after RPC + API update (zero regressions verified by spot-check of at least 3 cities)

### ICICLE — 3-Level Icicle Pilot

- [ ] **ICICLE-01**: CA state budget loaded as a genuine 3-level tree (Program Area → Department → Budget Category) using the updated RPC
- [ ] **ICICLE-02**: CA state icicle chart renders 3 drill-down levels in the live app (Level 1 → Level 2 → Level 3 navigation works)
- [ ] **ICICLE-03**: Drilling to Level 3 shows line items in `LineItemsTable` (leaf behavior identical to existing 2-level cities)

### RETROFIT — Selective City Retrofit Pilot

- [ ] **RETROFIT-01**: Source data audit completed for candidate cities — identifies which have a genuine, extractable 3rd level (not synthetic grouping)
- [ ] **RETROFIT-02**: 1–2 cities with confirmed genuine 3rd-level data retrofitted and reloaded as 3-level trees
- [ ] **RETROFIT-03**: Retrofitted cities display 3-level icicle drill-down in live app; existing enrichment rows remain intact

---

## Out of Scope

| Item | Reason |
|------|--------|
| CA state revenue budget | Separate data source (taxes, fees); different extraction problem — defer to v1.8 |
| All-funds CA state budget (~$495B) | $280B+ federal pass-through inflates total; General Fund only (~$212B) for comparability |
| Force-retrofit all 30+ existing cities | Most city sources are genuinely 2-level; synthetic 3rd level adds noise without insight |
| 4-level icicle depth | No source data supports a 4th level; 3 is the natural ceiling for CA state structure |

---

## Future Requirements

| Item | Why Deferred |
|------|-------------|
| CA state revenue budget (Money In) | Requires separate data extraction from CA tax/revenue sources |
| Multi-year CA state historical data (FY2015+) | LAO Excel supports it; add if time allows in Phase 33, otherwise v1.8 |
| Full city retrofit (all 30+ cities) | Needs source data audit per city; only viable after pilot confirms approach |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 32 | Pending |
| INFRA-02 | Phase 32 | Pending |
| INFRA-03 | Phase 32 | Pending |
| DATA-01 | Phase 33 | Pending |
| DATA-02 | Phase 33 | Pending |
| DATA-03 | Phase 33 | Pending |
| DATA-04 | Phase 33 | Pending |
| TREE-01 | Phase 34 | Pending |
| TREE-02 | Phase 34 | Pending |
| TREE-03 | Phase 34 | Pending |
| ICICLE-01 | Phase 35 | Pending |
| ICICLE-02 | Phase 35 | Pending |
| ICICLE-03 | Phase 35 | Pending |
| RETROFIT-01 | Phase 36 | Pending |
| RETROFIT-02 | Phase 36 | Pending |
| RETROFIT-03 | Phase 36 | Pending |

---

*Last updated: 2026-06-06 — traceability filled by roadmapper (Phases 32-36)*
