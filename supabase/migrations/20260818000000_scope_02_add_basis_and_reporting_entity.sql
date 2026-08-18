-- SCOPE-02 Task 1 — two axes the schema could not previously express.
--
-- `basis` is fund_scope before SCOPE-01: the data varies on it and the app
-- silently draws across it. SCO publishes ACTUALS; the city rows that follow a
-- city's SCO series are ADOPTED BUDGETS, and that is half of the -75% Long Beach
-- cliff. See spec §"Premise 2".
--
-- Both DEFAULT 'unknown' and stay there without evidence, exactly as fund_scope
-- does. Additive only: no existing value is read or changed.
ALTER TABLE treasury.budgets
  ADD COLUMN basis text NOT NULL DEFAULT 'unknown'
    CONSTRAINT budgets_basis_check CHECK (basis IN ('actual','adopted','unknown')),
  ADD COLUMN reporting_entity text NOT NULL DEFAULT 'unknown'
    CONSTRAINT budgets_reporting_entity_check
      CHECK (reporting_entity IN ('primary_government','incl_component_units','unknown'));

COMMENT ON COLUMN treasury.budgets.basis IS
  'Whether this figure is a closed-year actual or an adopted budget. Stamped per source from evidence; unknown until proven.';
COMMENT ON COLUMN treasury.budgets.reporting_entity IS
  'Primary government only, or consolidated with component units. MN OSA runs ~7-22% high vs an ACFR-derived total for this reason.';
