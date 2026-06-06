# Phase 32: State Entity Infrastructure - Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the database schema, TypeScript types, and EntitySwitcher component to support `entity_type: 'state'` — 3 targeted changes that make the app ready to host a state-level entity without breaking any existing city, county, or township page.

</domain>

<decisions>
## Implementation Decisions

### DB Migration (INFRA-01)
- **D-01:** `entity_type` is a plain `text` column with **no existing CHECK constraint** (confirmed by live DB inspection). The migration adds a new CHECK constraint — nothing to DROP first.
- **D-02:** Migration SQL:
  ```sql
  ALTER TABLE treasury.municipalities
    ADD CONSTRAINT municipalities_entity_type_check
    CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state'));
  ```
- **D-03:** Apply via `mcp__supabase-local__apply_migration`. Follow existing timestamp naming convention (e.g., `20260606HHMMSS_add_state_entity_type.sql`).

### TypeScript Type (INFRA-02)
- **D-04:** One-line change in `src/types/budget.ts:111` — add `'state'` to the union:
  ```ts
  entity_type: 'city' | 'county' | 'township' | 'nonprofit' | 'state';
  ```

### EntitySwitcher UI (INFRA-03)
- **D-05:** Pre-filter state entities (`entity_type === 'state'`) from the input array BEFORE building the `byState` Map in the `grouped` useMemo. They must never enter the map — this prevents the "California > Cities > California" circular nesting.
- **D-06:** Render a "STATE GOVERNMENTS" section at the top of the dropdown list (above all state/city group sections). Use the same sticky-header visual style as existing state group headers (`STATE_LABELS` pattern). Structure: one sticky "STATE GOVERNMENTS" header, then a flat list of state entities as clickable rows directly beneath it — no nested state-code group header, no entity_type subheader.
- **D-07:** Add `'state': 'State Governments'` to `ENTITY_TYPE_LABELS` for completeness (covers any future fallback rendering).
- **D-08:** When a state entity is selected, the button shows just the entity name with no state suffix — e.g., **"California"** not "California, CA". Implement via a conditional in the `displayName` expression: `entity_type === 'state' ? name : '${name}, ${state}'`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §INFRA-01, INFRA-02, INFRA-03 — the 3 locked requirements for this phase

### Roadmap
- `.planning/ROADMAP.md` §Phase 32 — success criteria, goal statement

### Files Being Modified
- `src/components/EntitySwitcher.tsx` — pre-filter + top-section render logic (D-05, D-06, D-07, D-08)
- `src/types/budget.ts` line 111 — TypeScript union type extension (D-04)

### Migration Infrastructure
- `supabase/migrations/` — existing migration files for naming convention reference
- Memory: use `mcp__supabase-local__apply_migration` for DDL; verify with `execute_sql`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EntitySwitcher.tsx` sticky-header markup (line 143) — exact class string to reuse for "STATE GOVERNMENTS" header: `"sticky top-0 bg-[#F7F7F8] dark:bg-ev-gray-900 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ev-gray-500 border-b border-[#E2EBEF] dark:border-ev-gray-700"`
- `EntitySwitcher.tsx` entity button markup (line 155) — reuse for state entity rows in the new section

### Established Patterns
- `grouped` useMemo (lines 61–88) — builds `byState: Map<state, Map<entity_type, Municipality[]>>`. Pre-filter state entities before this block using `municipalities.filter(m => m.entity_type !== 'state')` for the byState build, and a separate `stateEntities` array.
- Migration apply: `mcp__supabase-local__apply_migration` → verify with `execute_sql SELECT entity_type FROM treasury.municipalities LIMIT 5`

### Integration Points
- `displayName` constant (line 91–93) — `selectedEntity ? \`${selectedEntity.name}, ${selectedEntity.state}\` : 'Select jurisdiction'` → needs conditional branch for entity_type === 'state'
- `STATE_LABELS` (line 21–26) — the state group header source; "STATE GOVERNMENTS" header is rendered statically (not from this map)
- `ENTITY_TYPE_LABELS` (line 11–19) — add `state: 'State Governments'` entry

</code_context>

<specifics>
## Specific Ideas

- The "STATE GOVERNMENTS" section header text is exactly "STATE GOVERNMENTS" (all-caps, matching the visual weight of state group headers like "CALIFORNIA")
- Section appears at the very top of the scrollable list — above all alphabetically-sorted state groups
- State entities sort alphabetically within the State Governments section (if multiple states ever exist)
- When filtering: state entities still appear in the flat section filtered by name match (same `m.name.toLowerCase().includes(lowerFilter)` logic as cities)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 32-state-entity-infrastructure*
*Context gathered: 2026-06-06*
