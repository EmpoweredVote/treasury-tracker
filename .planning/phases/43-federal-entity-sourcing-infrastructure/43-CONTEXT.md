# Phase 43 Context — Federal Entity + Sourcing Infrastructure

**Created:** 2026-06-12 (inline planning session — no subagents per project rule)
**Phase goal:** The DB, API, and frontend types accept a federal entity, and the sourcing schema exists for always-sourced data.
**Pattern source:** Phase 32 (state entity infrastructure) — `.planning/phases/32-state-entity-infrastructure/`

## Schema reality check (verified live against local Supabase 2026-06-12)

Findings that NARROW the work vs. what REQUIREMENTS.md assumed:

1. **`entity_type` CHECK constraint has grown since Phase 32** — now 11 values:
   `city, county, township, nonprofit, state, municipality, special_district, school_district, conservancy, library, town`.
   Phase 43 adds `'federal'` as the 12th. Migration must DROP + re-ADD the constraint (it exists).

2. **Budget tables already carry partial provenance:** `operating_budgets` and `revenue_budgets` both have `source_name` (registry key) + `source_row_id`. What's MISSING for the federal standard: `source_url` (direct link to the dataset/record) and `source_date` (fetch date). INFRA-02 = add those two columns to both tables.

3. **`category_enrichment` already has full sourcing fields** (`source`, `source_url`, `source_label`, `confidence`, `evidence_summary`, `generated_at`) — NO schema change needed for enrichment sourcing. Phase 46 uses what's there.

4. **`treasury.source_registry` exists** (name / display_name / url, 11 city-data rows). Federal sources get registry rows: treasury-fiscal-data, omb-historical-tables, usaspending, congress-gov, govinfo.

5. **`program_details` does not exist** — INFRA-03 creates it fresh.

## Frontend/backend facts

- `src/types/budget.ts:111` — `Municipality.entity_type` union, 11 members; add `'federal'`.
- `src/components/EntitySwitcher.tsx` — Phase 32 pattern to mirror exactly:
  - `ENTITY_TYPE_LABELS` map at line ~12 (add `federal: 'Federal Government'`)
  - `stateEntities` pre-filter at line ~72 prevents circular nesting; same pre-filter needed for federal, AND the `cityEntities` filter (`entity_type !== 'state'`) must also exclude `'federal'` or the US row lands inside a "US" city group
  - "STATE GOVERNMENTS" section renders above state groups (line ~152); FEDERAL section goes above it
  - Header display logic (line ~102): `entity_type === 'state' ? name : "name, state"` — must extend to federal so the pill reads "United States", not "United States, US"
- Backend (`C:/EV-Accounts/backend/src/lib/treasuryService.ts`) treats `entity_type` as `string | null`; an MTFCC/geofence map at line ~39 maps ONLY specific entity types to TIGER layers — federal must NOT be added there (no geofence).
- `getCities()` filters out municipalities with no budget data (Phase 32-04 fix). Consequence: **the federal row stays invisible in the app until Phase 44 loads data** — this satisfies the "may be hidden until Phase 45" criterion with zero flag code.

## Decisions

| Decision | Rationale |
|---|---|
| Federal row uses `state='US'`, `name='United States'` | EntitySwitcher federal section doesn't group by state, so no STATE_NAMES['US'] entry needed; seeding happens in Phase 44 with the data, mirroring the 32/33 split |
| `source_url`/`source_date` nullable on budget tables | 38k+ legacy city rows can't backfill; federal loaders REQUIRED to populate (enforced by Phase 44 loader code + Phase 48 audit, not by constraint) |
| `program_details` paired-URL columns (`enabling_bill` + `enabling_bill_url`, etc.) + `details` JSONB | Ground rule: every claim linked. Structured columns for the known fields; JSONB escape hatch for what the Phase 47 pilot discovers |
| `program_details` RLS disabled | Matches `category_enrichment` (same read path through backend service role) |
| Registry seed idempotent via `WHERE NOT EXISTS` | source_registry.name uniqueness not confirmed as a constraint; don't assume ON CONFLICT target |

## Success criteria traceability (ROADMAP Phase 43)

1. Federal row creatable + served → 43-01 (constraint) + 43-03 (E2E with temp data row)
2. Sourcing columns exist → 43-01
3. program_details exists → 43-01
4. EntitySwitcher "United States" entry → 43-02 (renders when data exists; hidden until Phase 44 by getCities filter)
5. No regression → 43-02 (tsc/build) + 43-03 (counts + spot queries)
