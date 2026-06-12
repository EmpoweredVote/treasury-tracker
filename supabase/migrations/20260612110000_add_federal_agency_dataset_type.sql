ALTER TABLE treasury.data_sources
  DROP CONSTRAINT data_sources_dataset_type_check;
ALTER TABLE treasury.data_sources
  ADD CONSTRAINT data_sources_dataset_type_check
  CHECK (dataset_type IN ('operating', 'revenue', 'transactions', 'salaries', 'all_funds_requirements', 'federal_agency'));
