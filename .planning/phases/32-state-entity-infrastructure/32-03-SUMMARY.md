---
phase: 32-state-entity-infrastructure
plan: 03
subsystem: ui
tags: [typescript, react, entity-switcher, state-entity, dropdown]

requires:
  - 32-02

provides:
  - EntitySwitcher renders STATE GOVERNMENTS section above city/county groups
  - State entities pre-filtered before byState Map build — no circular nesting
  - displayName conditional — state entity shows name only (no ', CA' suffix)
  - ENTITY_TYPE_LABELS includes state: 'State Governments'

affects:
  - 33-ca-state-budget-data

tech-stack:
  added: []
  patterns:
    - Pre-filter by entity_type before Map build to prevent circular nesting in grouped useMemo
    - useMemo returning structured object ({ byState, stateEntities }) instead of raw Map

key-files:
  created: []
  modified:
    - src/components/EntitySwitcher.tsx

key-decisions:
  - "D-05: stateEntities pre-filtered from grouped useMemo before byState Map build — prevents California > Cities > California circular nesting"
  - "D-06: Sticky STATE GOVERNMENTS header + flat entity button list — identical visual style to existing state group headers"
  - "D-07: ENTITY_TYPE_LABELS gets state: 'State Governments' entry as first key"
  - "D-08: displayName conditional returns entity name only for state entities (no ', CA' suffix)"

patterns-established:
  - Pre-filtering entity_type before grouped Map build is the canonical pattern for non-city entity types

requirements-completed:
  - INFRA-03

duration: 12min
completed: 2026-06-06
---

# Phase 32-03: EntitySwitcher State Entity Support Summary

**EntitySwitcher updated with pre-filter logic, STATE GOVERNMENTS sticky header section, and conditional displayName — state entities render in their own top section without appearing inside city groups, and selecting one shows just the name with no state-code suffix.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-06
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

### Task 1: Pre-filter + displayName
- Added `state: 'State Governments'` as first entry in `ENTITY_TYPE_LABELS`
- Split `grouped` useMemo into two filter passes: `stateEntities` (entity_type === 'state') and `cityEntities` (entity_type !== 'state')
- byState Map now built exclusively from `cityEntities` — state entities never enter the Map
- `stateEntities` sorted alphabetically within useMemo
- useMemo now returns `{ byState, stateEntities }` object instead of raw Map
- Updated all downstream references: `grouped.byState.size`, `grouped.stateEntities.length`, `grouped.byState.entries()`
- displayName conditional: state entities show `entity.name` only; all other entities show `${name}, ${state}`
- `tsc --noEmit` exits 0

### Task 2: STATE GOVERNMENTS JSX section
- Added STATE GOVERNMENTS section immediately above the `byState.entries()` mapped sections
- Section conditionally rendered: `grouped.stateEntities.length > 0`
- Sticky header uses exact same class string as existing state group headers
- Flat button list (no entity_type subheader) — same button markup as existing entity rows
- Empty-state check updated: `grouped.byState.size === 0 && grouped.stateEntities.length === 0`
- `npm run build` exits 0 (1 pre-existing CSS import order warning — not introduced by this plan)

## Task Commits

1. **Task 1: Pre-filter state entities and add ENTITY_TYPE_LABELS entry** - `9f137b5` (feat)
2. **Task 2: Render the STATE GOVERNMENTS section in the dropdown JSX** - `c7b6dd3` (feat)

## Files Created/Modified

- `src/components/EntitySwitcher.tsx` — all three coordinated changes (D-05, D-06, D-07, D-08)

## Decisions Made

Followed plan decisions D-05 through D-08 exactly as specified in 32-CONTEXT.md.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript and build passed cleanly on first attempt.

## Known Stubs

None — no stub patterns introduced. STATE GOVERNMENTS section is live code; it renders only when municipalities prop contains state entities.

## Threat Flags

No new security-relevant surface introduced. Entity type comparison uses string literals only; no dynamic key lookups. No auth or access control changes.

## Next Phase Readiness

- INFRA-03 satisfied: EntitySwitcher renders STATE GOVERNMENTS section above all state/city groups
- D-05 through D-08 fully implemented
- Phase 33 (CA state budget data) can now insert a CA state municipality row — it will appear correctly in the STATE GOVERNMENTS section
- All existing city, county, township pages render identically — no regression

---
*Phase: 32-state-entity-infrastructure*
*Completed: 2026-06-06*
