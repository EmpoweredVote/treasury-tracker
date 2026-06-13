# Plan 49-01 Summary — Transition Quarter storage primitive

**Status:** Complete (migration applied to DB + regression-verified)
**Commit:** `feat(49-01): add budgets.period_label + 8-arg RPC for Transition Quarter`
**Requirements:** CTX-01

## What changed
- `supabase/migrations/20260613120000_add_budget_period_label.sql` — applied via `mcp__supabase-local__apply_migration`:
  1. `treasury.budgets.period_label` (nullable text, default NULL).
  2. Unique index rebuilt to `(municipality_id, fiscal_year, dataset_type, period_label) NULLS NOT DISTINCT`.
  3. `public.treasury_sync_budget_tree` dropped (7-arg) and re-created (8-arg, `p_period_label text DEFAULT NULL`), matching the period via `period_label IS NOT DISTINCT FROM p_period_label`.

## Key decisions
- **User chose the period_label migration** over a sentinel fiscal_year (AskUserQuestion). Keeps `fiscal_year=1976` truthful; avoids magic integers leaking into Phase 50 queries.
- **DROP+CREATE, not an added overload.** The RPC is in `public` (not `treasury`). Adding an 8th defaulted arg via `CREATE OR REPLACE` alone would create a *second* overload, making 7-arg calls ambiguous. Dropping the 7-arg signature first leaves exactly one function that 7-arg callers still resolve to (via the DEFAULT).
- **`NULLS NOT DISTINCT`** preserves the original "one row per (entity, year, lens)" guarantee (two NULL-label rows still collide) while letting a labeled TQ row coexist with NULL-label FY1976.

## Verification (regression probes — all green)
| Probe | Result |
|-------|--------|
| `period_label` exists, nullable | YES |
| Unique index | 4-col `… NULLS NOT DISTINCT` |
| RPC overloads | **1** (no ambiguity) |
| RPC args | includes `p_period_label text DEFAULT NULL` |
| FY2025 rows | untouched (period_label NULL, totals intact) |

## Downstream
- TQ loads (`--tq`) in 49-05 now have the column + 8-arg RPC they need.
- Phase 50 YearSelector: a federal budget query must treat a non-null `period_label` row as a separate selectable period (the TQ orders immediately after FY1976).
