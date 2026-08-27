-- Retire the plaintext sync key now that the Vault path is verified end to end.
--
-- Verification that gates this migration (run before applying it):
--   net.http_post to /functions/v1/treasury-sync, with the x-api-key header built by
--   the EXACT expression cron jobs 5 and 6 now use, returned
--   HTTP 400 {"error":"data_source_id required"} — i.e. authentication succeeded and
--   only the request body was incomplete. A 401 would have meant the new key was not
--   accepted. Testing against treasury-sync rather than the orchestrator keeps the
--   probe from starting real sync work.
--
-- After this migration the old 38-character key authenticates nothing.
--
-- The `anon` and `authenticated` SELECT grants go too. They were already inert —
-- RLS is on with no policies, and an anon REST read returned `[]` against a working
-- control — but a grant that only RLS is holding back is a latent leak, and this
-- table is the last place anyone should rely on a single line of defence.
--
-- `ev_api`'s grants are deliberately LEFT IN PLACE. It is a separate application
-- role (the Express API in C:\EV-Accounts) and revoking a grant on behalf of code
-- this repo cannot see risks breaking it for no benefit: the secret is gone, so
-- there is nothing left in the table for that role to read.

DELETE FROM treasury.sync_config WHERE key = 'sync_api_key';

REVOKE SELECT ON treasury.sync_config FROM anon;
REVOKE SELECT ON treasury.sync_config FROM authenticated;

COMMENT ON TABLE treasury.sync_config IS
  'Non-secret sync configuration. ⚠ DO NOT store credentials here — the sync API key '
  'lived in this table in plaintext until 2026-08-27 and now lives in Vault as '
  '`treasury_sync_api_key`, read by treasury_get_sync_key() and by cron jobs 5/6.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM treasury.sync_config WHERE key = 'sync_api_key') THEN
    RAISE EXCEPTION 'the plaintext sync_api_key row is still present';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'treasury' AND table_name = 'sync_config'
      AND grantee IN ('anon', 'authenticated')
  ) THEN
    RAISE EXCEPTION 'anon/authenticated still hold grants on treasury.sync_config';
  END IF;
  IF (SELECT length(decrypted_secret) FROM vault.decrypted_secrets
      WHERE name = 'treasury_sync_api_key') IS NULL THEN
    RAISE EXCEPTION 'refusing to retire the old key: the Vault secret is missing';
  END IF;
END $$;
