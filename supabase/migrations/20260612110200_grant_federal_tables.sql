-- All three federal tables (program_details from 43-01; annual_summary +
-- context_metrics from 44-01) were created without the service_role grant
-- that every other treasury table carries — loaders use the service key and
-- hit "permission denied". Match the treasury.municipalities grant set.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON treasury.program_details, treasury.federal_annual_summary, treasury.federal_context_metrics
  TO service_role;
