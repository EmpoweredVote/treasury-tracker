-- source_registry was created without a service_role grant (anon/authenticated
-- got SELECT; loaders and audit scripts run as service_role). Surfaced by the
-- Phase 48 source-chain auditor. Applied 2026-06-12 via mcp apply_migration
-- as 'grant_service_role_source_registry'.
GRANT SELECT ON treasury.source_registry TO service_role;
