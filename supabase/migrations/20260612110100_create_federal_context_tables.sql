CREATE TABLE treasury.federal_annual_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year smallint NOT NULL UNIQUE,
  receipts numeric NOT NULL,
  outlays numeric NOT NULL,
  surplus_or_deficit numeric NOT NULL,
  mandatory numeric,
  discretionary_defense numeric,
  discretionary_nondefense numeric,
  net_interest numeric,
  source_name text NOT NULL,
  source_url text NOT NULL,
  source_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE treasury.federal_annual_summary IS 'v2.0: one row per federal fiscal year, ACTUALS ONLY (no OMB estimate years). Amounts in DOLLARS — loaders normalize from OMB millions. Feeds landing bands, deficit strip, multi-decade context.';
COMMENT ON COLUMN treasury.federal_annual_summary.surplus_or_deficit IS 'Raw OMB sign convention (negative = deficit). Never re-derive or re-sign.';

CREATE TABLE treasury.federal_context_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL UNIQUE,
  value numeric NOT NULL,
  as_of_date date NOT NULL,
  label text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  source_date date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE treasury.federal_context_metrics IS 'v2.0: keyed sourced metrics (total_public_debt, fytd_outlays, fytd_receipts, fytd_interest_expense, excluded negative budget lines for disclosure). Amounts in DOLLARS. Upsert by metric_key.';
