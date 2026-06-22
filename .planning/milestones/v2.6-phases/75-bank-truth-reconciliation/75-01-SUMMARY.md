---
phase: 75-bank-truth-reconciliation
plan: 01
status: complete
requirements: [EVDATA-04, EVDATA-05]
key_files:
  created:
    - supabase/migrations/20260620000000_create_org_financial_summary.sql
---

# 75-01 Summary — org_financial_summary schema

## What was built

`treasury.org_financial_summary` — the single data home (CONTEXT D-02) for EV's reconciled financials. One sourced row per `(municipality_id, fiscal_year)`, upsertable (idempotent). Holds:

- **Cash truth** (bank-authoritative): `balance`, `balance_as_of`.
- **Burn/runway** (D-01/02/03): `monthly_burn`, `burn_window_months` (default 3), `runway_months` (nullable — NULL not Infinity when burn≈0).
- **Income gross→net** (D-11): `income_gross/fees/net` + `income_by_source` jsonb `[{source,gross,fee,net}]`. Fees modeled as a reduction of income, not an operating expense.
- **Reconciliation** (D-05/07): `recon_variance`, `recon_explanation`, `recon_by_source` jsonb `[{source,platform_net,bank_deposits,variance}]`, `unmatched_deposits` jsonb `[{date,amount,description}]`.
- **Sourcing**: `source_name` (NOT NULL), `source_url`, `source_date` (NOT NULL), `updated_at`.

Constraints: PK (`id`), FK → `treasury.municipalities(id) ON DELETE CASCADE`, UNIQUE `(municipality_id, fiscal_year)`.

## Decisions / notes

- Migration timestamp `20260620000000` (newer than prior `20260614…`).
- Grants mirror federal-table precedent: full DML to `service_role` (loaders), `SELECT` to `anon`/`authenticated` (API/PostgREST read path for the Phase 76 donor view).
- Applied to the live project via `mcp__supabase-local__apply_migration` (per feedback_supabase_migration_mcp) — verified: all 20 columns + PK/FK/unique constraint present. No rows written (75-02 does that).

## Verification

- `apply_migration` returned `{"success":true}`.
- `information_schema.columns` confirms the 20-column shape; `pg_constraint` confirms `org_financial_summary_municipality_id_fiscal_year_key` (unique), FK, PK.

## Hand-off

- 75-02 (`reconcileEV.js`) upserts the FY2026 row onConflict `(municipality_id, fiscal_year)`.
- Phase 76 reads this row via the ev-accounts API (separate repo) — API exposure is Phase 76's task.

## Self-Check: PASSED
