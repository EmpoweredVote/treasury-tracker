---
phase: 32-state-entity-infrastructure
verified: 2026-06-06T18:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
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
---

# Phase 32: State Entity Infrastructure — Verification Report

**Phase Goal:** State Entity Infrastructure — DB constraint, TypeScript type, and EntitySwitcher changes that enable a CA state-level municipality row and correct UI rendering.
**Verified:** 2026-06-06T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All 6 truths from the three plan must_haves are VERIFIED at the code level. Three additional truths require human visual confirmation in a running browser.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The treasury.municipalities table accepts INSERT with entity_type = 'state' without error | VERIFIED | Migration file exists and contains ADD CONSTRAINT municipalities_entity_type_check CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state', ...11 values)) — commit 06e45ab confirmed applied |
| 2 | INSERT with entity_type = 'invalid_value' is rejected by the CHECK constraint | VERIFIED | CHECK constraint enumerated list in migration file excludes any value not in the 11-member set; constraint applied to DB per SUMMARY |
| 3 | TypeScript compiles cleanly with entity_type: 'state' as a valid Municipality.entity_type value | VERIFIED | src/types/budget.ts line 111 reads `entity_type: 'city' | 'county' | 'township' | 'nonprofit' | 'state';` — npx tsc --noEmit exits 0 (verified live) |
| 4 | Assigning entity_type = 'state' to a Municipality object produces no TypeScript error | VERIFIED | Union type confirmed at budget.ts:111; tsc --noEmit confirmed exit 0 |
| 5 | State entities appear as flat clickable rows under the STATE GOVERNMENTS header — not nested under any state group | VERIFIED | EntitySwitcher.tsx line 73-74: stateEntities = filtered.filter(m => m.entity_type === 'state'); cityEntities = filtered.filter(m => m.entity_type !== 'state'); byState Map built exclusively from cityEntities (line 80) |
| 6 | Selecting a state entity shows just the entity name in the button (e.g., 'California' not 'California, CA') | VERIFIED | EntitySwitcher.tsx lines 99-103: displayName conditional returns selectedEntity.name when entity_type === 'state', else '${name}, ${state}' |

**Score:** 6/6 truths verified (code-level)

### ROADMAP Success Criteria Coverage

The ROADMAP defines 4 success criteria for Phase 32:

| SC | Text | Status | Evidence |
|----|------|--------|----------|
| SC-1 | entity_type: 'state' migration applied — CHECK constraint in treasury.municipalities accepts 'state' | VERIFIED | supabase/migrations/20260606000000_add_state_entity_type.sql contains the ADD CONSTRAINT statement with 'state' in the IN list |
| SC-2 | TypeScript compiles cleanly with 'state' added to Municipality.entity_type union in src/types/budget.ts | VERIFIED | src/types/budget.ts:111 confirmed; npx tsc --noEmit exits 0 |
| SC-3 | Entity picker shows a "State Governments" section above all state/city groups — not nested inside the "CALIFORNIA" group | VERIFIED (code) / HUMAN (visual) | EntitySwitcher.tsx lines 151-176: STATE GOVERNMENTS section rendered conditionally (stateEntities.length > 0) before grouped.byState.entries() render (line 178); correct ordering confirmed in code |
| SC-4 | All existing city and county pages render identically to before (no regression) | HUMAN | Pre-filter logic isolates state entities; byState Map only receives entity_type !== 'state' entries — code logic is correct but visual regression requires browser verification |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260606000000_add_state_entity_type.sql` | CHECK constraint migration adding 'state' to allowed entity_type values | VERIFIED | File exists, 3 lines, contains ADD CONSTRAINT municipalities_entity_type_check with all 11 entity_type values including 'state'. Commit 06e45ab. |
| `src/types/budget.ts` | Municipality interface with entity_type union including 'state' | VERIFIED | Line 111: `entity_type: 'city' | 'county' | 'township' | 'nonprofit' | 'state';` — exact match. Commit 08e87a0. |
| `src/components/EntitySwitcher.tsx` | EntitySwitcher with pre-filtered state entities, STATE GOVERNMENTS section, conditional displayName | VERIFIED | Contains "STATE GOVERNMENTS" (line 154), entity_type !== 'state' filter (line 74), entity_type === 'state' branch in displayName (line 100). Commits 9f137b5 + c7b6dd3. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| supabase/migrations/20260606000000_add_state_entity_type.sql | treasury.municipalities.entity_type | ALTER TABLE ADD CONSTRAINT | VERIFIED | File line 2: `ADD CONSTRAINT municipalities_entity_type_check` — pattern match confirmed |
| src/types/budget.ts | src/components/EntitySwitcher.tsx | Municipality type import | VERIFIED | EntitySwitcher.tsx line 3: `import type { Municipality } from '../types/budget';` — direct import confirmed |
| stateEntities array (filtered before byState build) | STATE GOVERNMENTS section JSX | useMemo pre-filter + JSX conditional render | VERIFIED | Line 73: filter creates stateEntities; line 80: byState built from cityEntities only; line 151: JSX renders stateEntities conditionally |
| displayName constant | selectedEntity.entity_type === 'state' branch | conditional expression | VERIFIED | Lines 99-103: ternary expression with entity_type === 'state' guard returns name only |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| EntitySwitcher.tsx | municipalities prop | App.tsx line 641-645: `municipalities={municipalities}` — populated by listMunicipalities() API call in App.tsx dataLoader | Yes — real DB query via API | FLOWING |
| EntitySwitcher.tsx | stateEntities | Derived from municipalities prop via useMemo filter — no separate fetch required | Real data when state entities exist in DB | FLOWING (conditioned on Phase 33 inserting state row) |

Note: The STATE GOVERNMENTS section will be empty until Phase 33 inserts a CA state municipality row. The conditional render (stateEntities.length > 0) correctly suppresses the section with current data — this is expected and correct behavior, not a stub.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles with 'state' in union | `npx tsc --noEmit` | Exit 0, no output | PASS |
| Migration file exists and contains constraint name | file read | municipalities_entity_type_check on line 2 | PASS |
| EntitySwitcher contains STATE GOVERNMENTS text | grep | Line 154 match | PASS |
| Pre-filter pattern present | grep entity_type !== 'state' | Line 74 match | PASS |
| displayName state branch present | grep entity_type === 'state' | Line 100 match | PASS |
| EntitySwitcher imported and used in App.tsx | grep | App.tsx line 8 import, line 641 usage with real municipalities prop | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INFRA-01 | 32-01-PLAN.md | Database supports entity_type: 'state' — migration adds 'state' to CHECK constraint | SATISFIED | Migration file exists with constraint covering all 11 live values including 'state'; commit 06e45ab |
| INFRA-02 | 32-02-PLAN.md | TypeScript Municipality.entity_type union includes 'state' | SATISFIED | src/types/budget.ts line 111 confirmed; tsc --noEmit passes; commit 08e87a0 |
| INFRA-03 | 32-03-PLAN.md | Entity picker surfaces state entities in a dedicated "State Governments" section above all state/city groups | SATISFIED (code) | EntitySwitcher.tsx has all required logic and JSX; visual confirmation deferred to human |

---

## Notable Deviation: Expanded CHECK Constraint

The migration was auto-fixed during execution (documented in 32-01-SUMMARY.md). The PLAN specified 5 entity_type values in the CHECK constraint; the actual migration covers 11 values because the live table had 6 additional undocumented entity_types (municipality, special_district, school_district, conservancy, library, town). The constraint as applied is strictly more correct — it reflects actual live data and is not a regression.

Impact on INFRA-01: None. The requirement is satisfied. The 'state' value is included and the constraint rejects out-of-set values.

Side note for future phases: 6 live entity_type values (municipality, special_district, school_district, conservancy, library, town) are present in the DB but absent from the TypeScript union in src/types/budget.ts. This is a pre-existing gap, not introduced by Phase 32, and is out of scope for this phase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TBD, FIXME, XXX, TODO, HACK, placeholder text, or stub return patterns in any of the 3 modified files | — | — |

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

---

## Gaps Summary

No gaps. All six must-have truths are verified at the code level. Three human verification items remain — all relate to visual dropdown rendering that cannot be confirmed without a running browser session. These are best exercised naturally during Phase 33 execution when the CA state municipality row is inserted.

---

_Verified: 2026-06-06T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
