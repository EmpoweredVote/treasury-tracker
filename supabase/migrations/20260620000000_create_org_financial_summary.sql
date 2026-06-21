-- v2.6 Phase 75 (EVDATA-04/05): EV reconciled financial summary.
-- One sourced row per (municipality_id, fiscal_year). Bank is authoritative for
-- cash balance + expenses; platform exports are authoritative for income detail
-- (gross + fees). Amounts in DOLLARS. Upsert by (municipality_id, fiscal_year)
-- so re-running a loader overwrites the single FY row (idempotent, never accumulates).
-- Mirrors the sourcing-column + grant conventions of treasury.federal_context_metrics.

CREATE TABLE treasury.org_financial_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id uuid NOT NULL REFERENCES treasury.municipalities(id) ON DELETE CASCADE,
  fiscal_year smallint NOT NULL,
  -- cash truth (bank-authoritative)
  balance numeric NOT NULL,
  balance_as_of date NOT NULL,
  -- burn / runway (D-01, D-02, D-03)
  monthly_burn numeric NOT NULL,
  burn_window_months smallint NOT NULL DEFAULT 3,
  runway_months numeric,
  -- income gross→net (D-11), platform-authoritative
  income_gross numeric NOT NULL DEFAULT 0,
  income_fees numeric NOT NULL DEFAULT 0,
  income_net numeric NOT NULL DEFAULT 0,
  income_by_source jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- reconciliation (D-05)
  recon_variance numeric,
  recon_explanation text,
  recon_by_source jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_deposits jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- always-sourced standard
  source_name text NOT NULL,
  source_url text,
  source_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipality_id, fiscal_year)
);

COMMENT ON TABLE treasury.org_financial_summary IS
  'v2.6: one row per (municipality, fiscal year) for an org''s reconciled financials (EV). Bank-authoritative balance/expenses, platform-authoritative income. Amounts in DOLLARS. Upsert by (municipality_id, fiscal_year) — idempotent, never accumulates.';
COMMENT ON COLUMN treasury.org_financial_summary.runway_months IS
  'balance / monthly_burn. NULL when burn rounds to ~0 — never store Infinity / never display a fake "no recent spend" state (D-03).';
COMMENT ON COLUMN treasury.org_financial_summary.income_by_source IS
  'JSON array [{source,gross,fee,net}] — the per-source gross→net waterfall (D-11). Fees are a reduction of income, NOT an operating expense.';
COMMENT ON COLUMN treasury.org_financial_summary.recon_by_source IS
  'JSON array [{source,platform_net,bank_deposits,variance}] — platform net (gross−fee) vs. matched bank payout deposits (D-05). Bank payout deposits are matched-and-excluded, never re-added as income.';
COMMENT ON COLUMN treasury.org_financial_summary.unmatched_deposits IS
  'JSON array [{date,amount,description}] — bank deposits matching no platform descriptor and not interest; flagged for manual classification (D-07).';

-- Grants: loaders run as service_role (full); API/PostgREST read path uses anon/authenticated (SELECT).
-- Mirrors treasury.federal_context_metrics (20260612110200) + the anon/authenticated SELECT default.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON treasury.org_financial_summary
  TO service_role;
GRANT SELECT ON treasury.org_financial_summary TO anon, authenticated;
