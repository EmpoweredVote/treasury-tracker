---
phase: 32-state-entity-infrastructure
fixed_at: 2026-06-06T17:40:00Z
review_path: .planning/phases/32-state-entity-infrastructure/32-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-06-06T17:40:00Z
**Source review:** .planning/phases/32-state-entity-infrastructure/32-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Migration is not idempotent — `ADD CONSTRAINT` without prior `DROP CONSTRAINT IF EXISTS`

**Files modified:** `supabase/migrations/20260606000000_add_state_entity_type.sql`
**Commit:** 3df02e3
**Applied fix:** Prepended `ALTER TABLE treasury.municipalities DROP CONSTRAINT IF EXISTS municipalities_entity_type_check;` before the `ADD CONSTRAINT` statement. The migration now follows the same idempotency pattern established in phase-23.

---

### CR-02: TypeScript `Municipality.entity_type` union is missing 6 of 11 DB-valid values

**Files modified:** `src/types/budget.ts`
**Commit:** 86d4849
**Applied fix:** Expanded the `entity_type` field union from 5 values (`city | county | township | nonprofit | state`) to all 11 DB-valid values, adding `municipality`, `special_district`, `school_district`, `conservancy`, `library`, and `town`. Union is now formatted multi-line for readability.

---

### WR-01: `ENTITY_TYPE_LABELS` missing entries for `'municipality'` and `'town'`

**Files modified:** `src/components/EntitySwitcher.tsx`
**Commit:** a758fec
**Applied fix:** Added `town: 'Towns'` and `municipality: 'Municipalities'` entries to `ENTITY_TYPE_LABELS`, inserted between `township` and `special_district` entries. Both values now render human-readable labels in the UI subheader.

---

### WR-02: `wikiImage.ts` produces malformed Wikipedia titles for `'state'` entities

**Files modified:** `src/utils/wikiImage.ts`
**Commit:** 3ef881c
**Applied fix:** Added a `case 'state':` branch to `buildSearchTitles` that pushes `entity.name` (e.g., `"Indiana"`) and `"${entity.name} (state)"` as candidates, then returns early to prevent the `stateFull` fallback from appending a duplicate state name. Also exported `STATE_NAMES` from `wikiImage.ts` so it can be consumed by `EntitySwitcher.tsx` (prerequisite for WR-03).

---

### WR-03: `STATE_LABELS` in `EntitySwitcher` only covers 4 states

**Files modified:** `src/components/EntitySwitcher.tsx`
**Commit:** a758fec
**Applied fix:** Removed the 4-entry `STATE_LABELS` constant entirely. Imported the existing full 50-state `STATE_NAMES` map from `src/utils/wikiImage.ts` (exported as part of WR-02 fix). All `STATE_LABELS[...]` references updated to `STATE_NAMES[...]`. State headers now render correctly for all 50 states rather than falling back to raw abbreviations.

---

### WR-04: Fallback `|| 'city'` in entity grouping masks type gaps

**Files modified:** `src/components/EntitySwitcher.tsx`
**Commit:** a758fec
**Applied fix:** Removed the dead `|| 'city'` fallback from `const type = m.entity_type || 'city'`. The line now reads `const type = m.entity_type;`. Since CR-02 expanded the TypeScript union to cover all valid DB values, TypeScript's type system now provides exhaustive checking rather than a silent runtime fallback.

---

_Fixed: 2026-06-06T17:40:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
