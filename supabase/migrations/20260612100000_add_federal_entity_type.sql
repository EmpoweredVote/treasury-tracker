ALTER TABLE treasury.municipalities
  DROP CONSTRAINT municipalities_entity_type_check;
ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state', 'municipality', 'special_district', 'school_district', 'conservancy', 'library', 'town', 'federal'));
