-- Add audit_verdict JSONB column to treasury.data_sources.
-- Stores per-city audit results from the Phase 36 audit framework (D-04).
-- NULL until audited; consistent with existing column_mapping JSONB pattern on same table.
-- Shape: {
--   recommended_depth: N (integer),
--   evidence: string (summary of source evidence),
--   last_audited: ISO8601 string (e.g. "2026-06-09"),
--   auditor: string (e.g. "phase-36-audit"),
--   status: "retrofit_recommended" | "depth_confirmed_current" | "audit_deferred"
-- }
ALTER TABLE treasury.data_sources
  ADD COLUMN IF NOT EXISTS audit_verdict JSONB DEFAULT NULL;

COMMENT ON COLUMN treasury.data_sources.audit_verdict IS
  'Per-city audit verdict. Keys: recommended_depth (integer), evidence (string), '
  'last_audited (ISO8601 string), auditor (string), '
  'status (retrofit_recommended | depth_confirmed_current | audit_deferred). '
  'Populated by Phase 36 audit framework (D-04). Machine-readable source of truth '
  'for tree depth decisions across all 30+ cities.';
