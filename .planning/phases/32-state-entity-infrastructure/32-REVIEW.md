---
phase: 32-state-entity-infrastructure
reviewed: 2026-06-06T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - supabase/migrations/20260606000000_add_state_entity_type.sql
  - src/types/budget.ts
  - src/components/EntitySwitcher.tsx
findings:
  critical: 2
  warning: 4
  info: 0
  total: 6
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-06-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the SQL migration adding the `entity_type` CHECK constraint, the `Municipality` TypeScript type definition, and the `EntitySwitcher` component. The migration introduces a non-idempotent DDL pattern that will fail on re-apply. More critically, the TypeScript type union for `entity_type` covers only 5 of the 11 values the database now accepts, creating a structural type gap that will cause runtime failures when any of the 6 unmodeled entity types are returned from the API. Four additional warning-level issues exist in display logic and the `wikiImage` utility.

---

## Critical Issues

### CR-01: Migration is not idempotent — `ADD CONSTRAINT` without prior `DROP CONSTRAINT IF EXISTS`

**File:** `supabase/migrations/20260606000000_add_state_entity_type.sql:2`
**Issue:** The migration executes `ADD CONSTRAINT municipalities_entity_type_check` with no preceding `DROP CONSTRAINT IF EXISTS`. If the constraint already exists (CI re-run, Supabase migration replay, or partial apply followed by retry), Postgres will throw:

```
ERROR:  constraint "municipalities_entity_type_check" already exists
```

and the migration will fail entirely. The project's own phase-23 migration (`20260602031258_add_all_funds_requirements_dataset_type.sql`) establishes the correct idempotency pattern for constraint replacement.

**Fix:**
```sql
ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_entity_type_check;

ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state',
    'municipality', 'special_district', 'school_district', 'conservancy',
    'library', 'town'));
```

---

### CR-02: TypeScript `Municipality.entity_type` union is missing 6 of 11 DB-valid values

**File:** `src/types/budget.ts:111`
**Issue:** The `Municipality` interface declares:

```ts
entity_type: 'city' | 'county' | 'township' | 'nonprofit' | 'state';
```

The migration adds a CHECK constraint allowing 11 values. The 6 values present in production data that are absent from the TypeScript union are: `'municipality'`, `'special_district'`, `'school_district'`, `'conservancy'`, `'library'`, `'town'`. When the API returns any of these, TypeScript will treat the value as `never` in exhaustive type narrowing, and any code using strict equality checks against the union will silently produce incorrect behavior (wrong branch taken, wrong label shown, etc.). Components already in the codebase that switch on `entity_type` — including `App.tsx`, `wikiImage.ts`, and `EntitySwitcher.tsx` — are all affected.

**Fix:**
```ts
entity_type:
  | 'city'
  | 'county'
  | 'township'
  | 'nonprofit'
  | 'state'
  | 'municipality'
  | 'special_district'
  | 'school_district'
  | 'conservancy'
  | 'library'
  | 'town';
```

---

## Warnings

### WR-01: `ENTITY_TYPE_LABELS` missing entries for `'municipality'` and `'town'`

**File:** `src/components/EntitySwitcher.tsx:11-20`
**Issue:** The label map includes `township`, `special_district`, `school_district`, `library`, and `conservancy` but omits `municipality` and `town` — both of which are valid per the DB constraint and present in production data per the migration commit message. `ENTITY_TYPE_LABELS[type]` returns `undefined` for these values, causing the UI subheader to render the raw DB string (e.g., `"municipality (3)"`) instead of a human-readable label.

**Fix:**
```ts
const ENTITY_TYPE_LABELS: Record<string, string> = {
  state: 'State Governments',
  city: 'Cities',
  county: 'Counties',
  township: 'Townships',
  town: 'Towns',                            // add
  municipality: 'Municipalities',           // add
  special_district: 'Special Districts',
  school_district: 'School Districts',
  library: 'Libraries',
  conservancy: 'Conservancy Districts',
};
```

---

### WR-02: `wikiImage.ts` produces malformed Wikipedia titles for `'state'` entities

**File:** `src/utils/wikiImage.ts:73-94`
**Issue:** `buildSearchTitles` has no `case 'state'` branch. State-level entities fall through to the `default` branch, which produces `"${entity.name}, ${stateFull}"` — e.g., if the entity name is `"Indiana"` and state is `"IN"`, the generated title is `"Indiana, Indiana"`. This is not a valid Wikipedia article title and the fetch will return null, so state entities will never receive a hero image from Wikipedia even when one is available.

**Fix:** Add an explicit `'state'` case that returns just the state name (and no fallback that repeats the state):
```ts
case 'state':
  titles.push(entity.name);  // e.g. "Indiana"
  titles.push(`${entity.name} (state)`);
  return titles; // return early — state fallback to stateFull would duplicate
```

---

### WR-03: `STATE_LABELS` in `EntitySwitcher` only covers 4 states

**File:** `src/components/EntitySwitcher.tsx:22-27`
**Issue:** The hard-coded `STATE_LABELS` map covers only `IN`, `CA`, `TX`, and `OR`. Any entity whose `state` field is not in this map will display the raw 2-letter abbreviation as the group header (e.g., `"WA"` instead of `"Washington"`). This silently degrades for any new state added to the dataset. The `wikiImage.ts` utility already maintains a full 50-state `STATE_NAMES` map that could be imported or duplicated here.

**Fix:** Either import/re-export `STATE_NAMES` from `wikiImage.ts`, or define a full 50-state map in a shared constant module and reference it from both files.

---

### WR-04: Fallback `|| 'city'` in entity grouping masks type gaps rather than surfacing them

**File:** `src/components/EntitySwitcher.tsx:83`
**Issue:** `const type = m.entity_type || 'city'` — the `||` fallback activates only for falsy values. Since `entity_type` is always a non-empty string when present, this fallback is unreachable in practice. Its presence suggests a copy-paste from earlier code where the field was optional, and it gives a false sense of safety without providing any actual protection. The real gap — unrecognized type values producing unlabeled subheaders — is not addressed by this pattern.

**Fix:** Remove the dead fallback and, after fixing CR-02, rely on TypeScript's exhaustive type checking to catch unhandled values at compile time:
```ts
const type = m.entity_type;
```

---

_Reviewed: 2026-06-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
