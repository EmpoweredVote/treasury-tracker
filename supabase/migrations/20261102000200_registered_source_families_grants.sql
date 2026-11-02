-- The schema's default privileges cover anon, authenticated and ev_api but
-- NOT service_role, which is the role scripts/syncRegisteredFamilies.mjs runs
-- as. Without this the sync fails with "permission denied for table".
-- Matches treasury.frozen_figure_ledger, the closest analogue (a mirror table
-- written by a script and read by a gate).
--
-- ⚠ anon/authenticated keep the default SELECT, as on every other treasury
-- table. These rows are regex patterns over PUBLISHED data_source names —
-- nothing here is more sensitive than treasury.budgets itself, which is
-- already anon-readable. Diverging would be a surprise, not a safeguard.

grant select, insert, update, delete
  on treasury.registered_source_families
  to service_role;
