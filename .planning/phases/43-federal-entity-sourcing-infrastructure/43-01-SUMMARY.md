# 43-01 Summary — Federal DB Migrations

**Executed:** 2026-06-12 | **Status:** Complete — all 4 tasks pass

## What shipped

| Migration | Result |
|---|---|
| `20260612100000_add_federal_entity_type.sql` | Constraint dropped + re-added with 12 values; verified by pg_get_constraintdef |
| `20260612100100_add_budget_sourcing_columns.sql` | `source_url` (text) + `source_date` (date) on operating_budgets AND revenue_budgets, with COMMENTs stating the federal-required convention |
| `20260612100200_create_program_details.sql` | 17-column table, FK→municipalities ON DELETE CASCADE, UNIQUE(municipality_id, name_key), RLS disabled (matches category_enrichment) |
| `20260612100300_seed_federal_source_registry.sql` | 5 federal rows via WHERE NOT EXISTS |

## Functional test evidence

- INSERT entity_type='federal' → succeeded (row `5e5b2f5d…`, deleted after)
- INSERT entity_type='_bogus' → rejected, error 23514 CHECK violation ✓
- program_details INSERT → succeeded; duplicate (municipality_id, name_key) → rejected, error 23505 on `program_details_municipality_id_name_key_key` ✓; test row deleted
- Seed re-run via execute_sql → zero new rows (idempotent) ✓

## Final verification counts

- source_registry total: **16** (11 existing + 5 federal, no duplicates)
- Sourcing columns across both budget tables: **4**
- program_details columns: **17**
- No existing rows mutated (DDL + WHERE NOT EXISTS inserts only)

## Deviations from plan

None.
