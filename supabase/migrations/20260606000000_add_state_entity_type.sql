-- Expand municipalities.entity_type CHECK constraint to include 'state'.
-- NOTE: treasury.budgets.dataset_type and treasury.data_sources.dataset_type
-- are NOT modified here. State governments use the same dataset_type values
-- as other entities ('operating', 'revenue', 'salaries'). If a state-specific
-- dataset_type value is needed in a future phase, add a new migration at that time.

ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_entity_type_check;

ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state',
    'municipality', 'special_district', 'school_district', 'conservancy',
    'library', 'town'));
