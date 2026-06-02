-- Phase 23 migration: add 'all_funds_requirements' to data_sources dataset_type check constraint
-- This expands the allowed values for dataset_type to include 'all_funds_requirements'
-- which is used for the "Resources and Requirements — All Funds" page totals
-- extracted from OR city budget PDFs (Portland, Gresham, Troutdale).
--
-- Safe to run multiple times: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT pattern.

ALTER TABLE treasury.data_sources
  DROP CONSTRAINT IF EXISTS data_sources_dataset_type_check;

ALTER TABLE treasury.data_sources
  ADD CONSTRAINT data_sources_dataset_type_check
  CHECK (dataset_type IN ('operating', 'revenue', 'salaries', 'transactions', 'all_funds_requirements'));
