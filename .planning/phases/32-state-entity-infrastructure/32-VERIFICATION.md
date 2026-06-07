---
phase: 32-state-entity-infrastructure
verified: 2026-06-07T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed:
    - "Plan 04 must-haves incorporated (available_datasets filter in EntitySwitcher + HAVING COUNT in getCities())"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open app, select a city, confirm it shows 'City Name, ST' format (e.g., 'Portland, OR')"
    expected: "Non-state entities continue to display with state-code suffix"
    why_human: "displayName conditional branch for non-state entities cannot be exercised programmatically without a running app"
  - test: "Seed a test state entity (entity_type='state') and open the entity picker — confirm 'STATE GOVERNMENTS' sticky header appears above the CALIFORNIA/TEXAS/OREGON groups and the entity is listed flat below it with name only (no ', CA' suffix)"
    expected: "STATE GOVERNMENTS section appears at top of dropdown; state entity row shows just the entity name"
    why_human: "Visual dropdown rendering and conditional section display require a running browser session with live municipality data containing a state entity"
  - test: "Confirm existing CA cities (Sacramento, Oakland, etc.) still appear under the CALIFORNIA group — not in STATE GOVERNMENTS"
    expected: "Cities with entity_type='city' remain in the byState grouped sections; pre-filter does not bleed them out"
    why_human: "Requires browser session with live data to confirm visual placement"
  - test: "Open entity picker and confirm Carver, MA (or any municipality with zero budget rows) does NOT appear in the dropdown list"
    expected: "Municipalities with no loaded budget data are absent from the dropdown"
    why_human: "Requires a running app + knowledge of which municipalities in the target DB have zero budget rows to confirm exclusion"
---

# Phase 32: State Entity Infrastructure — Verification Report

**Phase Goal:** State entities appear as a dedicated top section in the EntitySwitcher, city/county layout is unchanged, and the dropdown never shows municipalities with no loadable budget data.
**Verified:** 2026-06-07T00:00:00Z
**Status:** human_needed
**Re-verification:** Yes — incorporates Plan 04 must-haves not present in initial verification

---

## Goal Achievement

### Observable Truths

All 10 must-have truths from Plans 01–04 are VERIFIED at the code level. Four items require human visual confirmation in a running browser.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The treasury.municipalities table accepts INSERT with entity_type = 'state' without error | VERIFIED | supabase/migrations/20260606000000_add_state_entity_type.sql: ADD CONSTRAINT municipalities_entity_type_check CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state', ...11 values total)) — idempotent (DROP CONSTRAINT IF EXISTS first) |
| 2 | INSERT with entity_type = 'invalid_value' is rejected by the CHECK constraint | VERIFIED | CHECK constraint enumerates all 11 valid values; any value outside the list is rejected by DB |
| 3 | TypeScript compiles cleanly with entity_type: 'state' as a valid Municipality.entity_type value | VERIFIED | src/types/budget.ts lines 111-122: 11-member union includes 'state' |
| 4 | Assigning entity_type = 'state' to a Municipality object produces no TypeScript error | VERIFIED | 'state' is present in the union; tsc --noEmit confirmed exit 0 per SUMMARY 32-02 |
| 5 | When municipalities includes a state entity, the dropdown shows a 'STATE GOVERNMENTS' sticky header above all state/city groups | VERIFIED | EntitySwitcher.tsx line 153: literal text "STATE GOVERNMENTS" in sticky header div, rendered at line 150-175 before grouped.byState.entries() render at line 177 |
| 6 | State entities appear as flat clickable rows under the STATE GOVERNMENTS header — not nested under any state group | VERIFIED | Lines 72-73: stateEntities = withData.filter(m => m.entity_type === 'state'); cityEntities = withData.filter(m => m.entity_type !== 'state'); byState Map built from cityEntities only (line 79) — state entities never enter the Map |
| 7 | Selecting a state entity shows just the entity name in the button (e.g., 'California' not 'California, CA') | VERIFIED | Lines 98-102: displayName ternary returns selectedEntity.name when entity_type === 'state', else `${name}, ${state}` |
| 8 | Existing city and county rows continue to render identically — the CALIFORNIA, TEXAS, OREGON groups are unaffected | VERIFIED (code) / HUMAN (visual) | byState Map built exclusively from cityEntities — no entity_type !== 'state' entity can appear in STATE GOVERNMENTS section; code logic sound |
| 9 | Municipalities with available_datasets.length === 0 do NOT appear in the EntitySwitcher dropdown | VERIFIED | EntitySwitcher.tsx line 69: `const withData = filtered.filter(m => m.available_datasets && m.available_datasets.length > 0);` — applied before stateEntities/cityEntities split; totalCount at line 97 also uses this filter |
| 10 | getCities() backend query returns only municipalities with at least one budget record | VERIFIED | C:/EV-Accounts/backend/src/lib/treasuryService.ts line 394: `HAVING COUNT(b.id) > 0` between GROUP BY and ORDER BY — authoritative filter at DB layer |

**Score:** 10/10 truths verified (code-level)

### ROADMAP Success Criteria Coverage

The ROADMAP defines 4 success criteria for Phase 32. All are satisfied:

| SC | Text | Status | Evidence |
|----|------|--------|----------|
| SC-1 | entity_type: 'state' migration applied — CHECK constraint in treasury.municipalities accepts 'state' | VERIFIED | Migration file line 6: 'state' in the IN list; idempotent DROP+ADD pattern |
| SC-2 | TypeScript compiles cleanly with 'state' added to Municipality.entity_type union in src/types/budget.ts | VERIFIED | budget.ts lines 111-122: 11-member union; 'state' present |
| SC-3 | Entity picker shows a "State Governments" section above all state/city groups — not nested inside the "CALIFORNIA" group | VERIFIED (code) / HUMAN (visual) | EntitySwitcher.tsx line 150-175: STATE GOVERNMENTS section rendered before byState.entries() at line 177 |
| SC-4 | All existing city and county pages render identically to before (no regression) | HUMAN | Pre-filter logic correct in code; byState Map only receives entity_type !== 'state' entries |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260606000000_add_state_entity_type.sql` | CHECK constraint migration adding 'state' to allowed entity_type values | VERIFIED | File exists, 9 lines, idempotent (DROP CONSTRAINT IF EXISTS before ADD). Contains municipalities_entity_type_check with all 11 values including 'state'. Commit 06e45ab. |
| `src/types/budget.ts` | Municipality interface with entity_type union including 'state' | VERIFIED | Lines 111-122: 11-member multi-line union includes 'state'. Diverges from plan's expected single-line format but satisfies the must-have. Commit 08e87a0. |
| `src/components/EntitySwitcher.tsx` | EntitySwitcher with pre-filtered state entities, STATE GOVERNMENTS section, conditional displayName, and available_datasets guard | VERIFIED | Contains STATE GOVERNMENTS (line 153), entity_type !== 'state' filter (line 73), entity_type === 'state' displayName branch (line 99), available_datasets guard (line 69). Commits 9f137b5 + c7b6dd3 + 12b359f. |
| `C:/EV-Accounts/backend/src/lib/treasuryService.ts` | getCities() query filtered to municipalities with at least one budget record | VERIFIED | Line 394: `HAVING COUNT(b.id) > 0` present between GROUP BY m.id and ORDER BY m.name. LEFT JOIN and json_agg structure preserved. Commit 9e7f1a3 (ev-accounts-api repo). |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| supabase/migrations/20260606000000_add_state_entity_type.sql | treasury.municipalities.entity_type | ALTER TABLE ADD CONSTRAINT | VERIFIED | File line 4: ADD CONSTRAINT municipalities_entity_type_check — pattern match confirmed |
| src/types/budget.ts | src/components/EntitySwitcher.tsx | Municipality type import | VERIFIED | EntitySwitcher.tsx line 3: `import type { Municipality } from '../types/budget';` — direct import confirmed |
| stateEntities array (filtered before byState build) | STATE GOVERNMENTS section JSX | useMemo pre-filter + JSX conditional render | VERIFIED | Line 72: stateEntities filter; line 79: byState built from cityEntities only; line 150-175: JSX renders stateEntities conditionally before grouped.byState.entries() |
| displayName constant | selectedEntity.entity_type === 'state' branch | conditional expression | VERIFIED | Lines 98-102: ternary with entity_type === 'state' guard returns name only |
| getCities() SQL query | treasury.municipalities LEFT JOIN treasury.budgets | HAVING COUNT(b.id) > 0 filter | VERIFIED | treasuryService.ts line 394: HAVING COUNT(b.id) > 0 between GROUP BY and ORDER BY |
| EntitySwitcher.tsx grouped useMemo | municipalities prop | pre-filter on available_datasets.length === 0 | VERIFIED | Line 69: withData filter; lines 72-73: stateEntities/cityEntities built from withData |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| EntitySwitcher.tsx | municipalities prop | API via getCities() → App.tsx dataLoader → municipalities prop | Yes — DB query with HAVING COUNT(b.id) > 0; only municipalities with budget data | FLOWING |
| EntitySwitcher.tsx | withData | Derived from municipalities prop via useMemo line 69 available_datasets guard | Inherits real data from prop; defensive guard against prop-level drift | FLOWING |
| EntitySwitcher.tsx | stateEntities | Derived from withData via entity_type === 'state' filter (line 72) | Real data when state entities exist in DB | FLOWING (conditioned on Phase 33 inserting state row) |
| EntitySwitcher.tsx | byState | Built from cityEntities (withData where entity_type !== 'state', line 73+79) | Real city/county data from prop | FLOWING |

Note: The STATE GOVERNMENTS section is empty until Phase 33 inserts a CA state municipality row. The conditional render (`stateEntities.length > 0`) correctly suppresses the section — this is expected behavior, not a stub. The no-loadable-budget guard is active and will exclude empty municipalities at both layers.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Migration file exists with constraint name | File read line 4 | ADD CONSTRAINT municipalities_entity_type_check with 11 values | PASS |
| Migration is idempotent | File read lines 2-3 | DROP CONSTRAINT IF EXISTS before ADD | PASS |
| 'state' in TypeScript union | budget.ts lines 111-122 read | 11-member union, 'state' on line 116 | PASS |
| EntitySwitcher contains STATE GOVERNMENTS text | EntitySwitcher.tsx line 153 | Literal "STATE GOVERNMENTS" in sticky header | PASS |
| Pre-filter pattern present | EntitySwitcher.tsx line 73 | `m.entity_type !== 'state'` in cityEntities filter | PASS |
| displayName state branch present | EntitySwitcher.tsx lines 98-102 | entity_type === 'state' ternary returns name only | PASS |
| available_datasets guard in useMemo | EntitySwitcher.tsx line 69 | withData filter on available_datasets.length > 0 | PASS |
| totalCount reflects filtered count | EntitySwitcher.tsx line 97 | totalCount uses same available_datasets filter | PASS |
| HAVING COUNT in getCities() | treasuryService.ts line 394 | HAVING COUNT(b.id) > 0 between GROUP BY and ORDER BY | PASS |
| getCityById() unaffected | treasuryService.ts line 403 | Separate function; no HAVING clause added | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 32-01-PLAN.md | Database supports entity_type: 'state' — migration adds 'state' to CHECK constraint | SATISFIED | Migration file exists with constraint covering all 11 live values including 'state'; idempotent; commit 06e45ab |
| INFRA-02 | 32-02-PLAN.md | TypeScript Municipality.entity_type union includes 'state' | SATISFIED | src/types/budget.ts lines 111-122: 11-member union includes 'state'; tsc --noEmit exit 0; commit 08e87a0 |
| INFRA-03 | 32-03-PLAN.md + 32-04-PLAN.md | Entity picker surfaces state entities in a dedicated "State Governments" section above all state/city groups; dropdown excludes municipalities with no budget data | SATISFIED (code) | EntitySwitcher.tsx has all required logic: STATE GOVERNMENTS section (line 150-175), pre-filter (line 72-73), displayName branch (line 99), available_datasets guard (line 69); backend HAVING filter at line 394 |

All three requirement IDs declared across Plans 01–04 are fully accounted for. No orphaned requirements.

---

## Notable Deviation: Expanded CHECK Constraint and TypeScript Union

The migration was auto-fixed during execution (documented in 32-01-SUMMARY.md). The PLAN specified 5 entity_type values; the actual migration and TypeScript union cover 11 values because the live DB had 6 additional undocumented entity_types (municipality, special_district, school_district, conservancy, library, town). The constraint and union as applied are strictly more correct — they reflect actual live data and are not regressions.

Impact on INFRA-01 and INFRA-02: None. Requirements are satisfied. The 'state' value is present in both the DB constraint and the TypeScript union.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TBD, FIXME, XXX, TODO, HACK, placeholder text, or stub return patterns in any of the 4 modified files | — | — |

---

## Human Verification Required

### 1. Non-state entity displayName format (regression check)

**Test:** Open the live app at treasurytracker.empowered.vote. Select any existing city (e.g., Portland, Sacramento). Observe the button label.
**Expected:** Button shows "Portland, OR" — city name with state-code suffix. The displayName non-state branch is unaffected.
**Why human:** The non-state branch of the displayName conditional (`${name}, ${state}`) cannot be exercised programmatically without a running browser and real navigation.

### 2. STATE GOVERNMENTS section visual appearance

**Test:** Seed a temporary state municipality row in the DB (entity_type='state', name='California', state='CA') then open the entity picker dropdown.
**Expected:** A sticky header reading "STATE GOVERNMENTS" appears at the top of the dropdown list, above the CALIFORNIA / TEXAS / OREGON state groups. Below that header, "California" appears as a flat clickable button row with no state-code suffix.
**Why human:** Conditional JSX section rendering (stateEntities.length > 0) and dropdown visual layout require a browser session. Phase 33 will naturally exercise this — the test can be deferred to Phase 33 verification if preferred.

### 3. Existing city placement regression (no circular nesting)

**Test:** With the same seeded state row present, open the entity picker and verify Sacramento, Oakland, Portland, Dallas still appear in their respective CALIFORNIA, OREGON, TEXAS groups — not in STATE GOVERNMENTS.
**Expected:** Cities with entity_type='city' are untouched; only entity_type='state' rows appear in the STATE GOVERNMENTS section.
**Why human:** Requires live dropdown inspection to confirm pre-filter does not accidentally exclude city entities.

### 4. Empty-dataset municipality exclusion (UAT gap closure)

**Test:** Open the entity picker dropdown and confirm that Carver, MA (or any other municipality known to have zero budget rows in treasury.budgets) does not appear in the list.
**Expected:** No municipalities with zero budget rows are selectable; selecting any listed municipality loads budget data without error.
**Why human:** Requires a running app with knowledge of which municipalities in the target DB have zero budget rows; cannot be confirmed by static code analysis alone. This closes UAT gap Test 3 from 32-HUMAN-UAT.md.

---

## Gaps Summary

No gaps. All 10 must-have truths are verified at the code level. Four human verification items remain — all relate to visual dropdown rendering and live DB state that cannot be confirmed without a running browser session.

The empty-dataset exclusion (Plan 04) is implemented at both the backend SQL layer (HAVING COUNT(b.id) > 0 in getCities()) and the frontend defensive layer (available_datasets.length > 0 in EntitySwitcher useMemo). Both are wired and substantive.

---

_Verified: 2026-06-07T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
