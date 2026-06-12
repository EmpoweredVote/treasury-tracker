ALTER TABLE treasury.operating_budgets
  ADD COLUMN source_url text,
  ADD COLUMN source_date date;
ALTER TABLE treasury.revenue_budgets
  ADD COLUMN source_url text,
  ADD COLUMN source_date date;

COMMENT ON COLUMN treasury.operating_budgets.source_url IS 'Direct URL to the source dataset/record. REQUIRED on federal rows (v2.0 always-sourced standard); nullable for legacy municipal rows.';
COMMENT ON COLUMN treasury.operating_budgets.source_date IS 'Date the source data was fetched. REQUIRED on federal rows.';
COMMENT ON COLUMN treasury.revenue_budgets.source_url IS 'Direct URL to the source dataset/record. REQUIRED on federal rows (v2.0 always-sourced standard); nullable for legacy municipal rows.';
COMMENT ON COLUMN treasury.revenue_budgets.source_date IS 'Date the source data was fetched. REQUIRED on federal rows.';
