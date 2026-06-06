# Phase 32: State Entity Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 32-state-entity-infrastructure
**Areas discussed:** State Governments section format, Display name when state selected, Migration approach

---

## State Governments section format

| Option | Description | Selected |
|--------|-------------|----------|
| Single flat header + entity list | One sticky 'STATE GOVERNMENTS' header, flat entity list beneath — no nested state-code or entity_type subheader | ✓ |
| Same nested format as cities | Standard state-code group header + entity_type subheader (e.g., CA > State Government > California) | |

**User's choice:** Single flat header + entity list
**Notes:** Avoids the "California > Cities > California" circular nesting documented in STATE.md architecture notes.

---

## Display name when state selected

| Option | Description | Selected |
|--------|-------------|----------|
| Just the name: 'California' | For entity_type 'state', omit state suffix — name already conveys everything | ✓ |
| Keep existing: 'California, CA' | Consistent with all other entities — no special-casing | |
| Add label: 'California (State)' | Parenthetical type label to disambiguate from a California city | |

**User's choice:** Just the entity name (no ", ST" suffix for state entities)
**Notes:** Implement via conditional in displayName expression. All non-state entities keep existing format.

---

## Migration approach

| Option | Description | Selected |
|--------|-------------|----------|
| Add a CHECK constraint | ADD CONSTRAINT municipalities_entity_type_check CHECK (entity_type IN (...)) | ✓ |
| Skip migration — TypeScript is enough | Column already accepts 'state'; TypeScript union is the only constraint | |
| Use an enum type | ALTER COLUMN entity_type TYPE treasury.entity_type — stricter but more invasive | |

**User's choice:** Add a CHECK constraint
**Notes:** Live DB inspection revealed no existing CHECK constraint on entity_type (plain text column). Migration adds a new constraint rather than modifying an existing one.

---

## Claude's Discretion

- Exact constraint name: `municipalities_entity_type_check`
- Migration filename timestamp: use current time at plan execution
- Sort order of state entities within "STATE GOVERNMENTS" section: alphabetical by name

## Deferred Ideas

None — discussion stayed within phase scope.
