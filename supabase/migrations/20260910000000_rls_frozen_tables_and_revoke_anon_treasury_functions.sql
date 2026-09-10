-- =============================================================================
-- Default-deny RLS on treasury.frozen_* + close the anonymous budget-write path
-- =============================================================================
-- Created 2026-09-10 with Chris Andrews.
-- Source: CTO decision 0015 (ev-cto/knowledge/decisions/0015-rls-audit-2026-09.md),
--         Parts B and E; watchlist #24 and #61. Founder decision 2026-09-10:
--         "protect them all."
--
-- Companion migration CA_0109 in the ev-accounts repo covers the essentials /
-- inform / transparent_motivations / meetings / trivia flagged tables. This file
-- owns only the treasury schema objects. Both target the SAME project
-- (kxsdzaojfaibhuzmclfq); the split is by repo ownership.
--
-- -----------------------------------------------------------------------------
-- PART B — default-deny RLS on the four public frozen_* reconciliation tables
-- -----------------------------------------------------------------------------
-- RLS-on with NO policy denies every row to any role that does not bypass RLS.
-- treasury IS a PostgREST-exposed schema and anon holds SELECT on these tables
-- today (measured 2026-09-10), so they are internet-readable now; this closes
-- that. Safe for the backend: postgres, service_role and ev_api all bypass RLS
-- (rolbypassrls = true, verified 2026-09-10) and none of these tables forces RLS,
-- so only direct anon/authenticated reads are affected. The frozen_* tables are
-- read/written only by treasury-tracker Edge Functions and Node scripts using the
-- service-role secret key (no browser Supabase client exists in treasury-tracker).

ALTER TABLE treasury.frozen_excluded_ids       ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.frozen_figure_ledger      ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.frozen_invariant_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.frozen_invariant_baseline ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PART E — revoke anonymous EXECUTE on four public.treasury_* SECURITY DEFINER
--          functions (two are budget WRITES)
-- -----------------------------------------------------------------------------
-- ⚠ IMPORTANT — the grants come from PUBLIC, not from an explicit anon grant.
-- Measured live 2026-09-10 (pg_proc.proacl):
--   treasury_sync_city_budget  : {=X/postgres, postgres=X, service_role=X}
--   treasury_sync_budget_tree  : {=X/postgres, postgres=X, service_role=X}
--   treasury_log_sync_failure  : {=X/postgres, postgres=X, service_role=X, anon=X, authenticated=X}
--   treasury_list_sources      : {=X/postgres, postgres=X, service_role=X, anon=X, authenticated=X}
-- The leading `=X/postgres` entry is a grant to PUBLIC. anon/authenticated inherit
-- EXECUTE through PUBLIC on ALL four. So `REVOKE ... FROM anon, authenticated`
-- ALONE would be a no-op on the two budget-write functions (they have no explicit
-- anon grant) and would leave the PUBLIC grant in place on the other two — the
-- hole would stay open. The correct close is to revoke from PUBLIC as well.
-- service_role keeps its own explicit grant, and is re-granted below to be
-- unmistakable. The Edge Functions treasury-sync and treasury-sync-orchestrator
-- build their client with SUPABASE_SERVICE_ROLE_KEY (verified in source
-- 2026-09-10), so they are unaffected.

REVOKE EXECUTE ON FUNCTION public.treasury_sync_city_budget(uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_sync_budget_tree(uuid, integer, text, numeric, jsonb, integer, text, text, text)                                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_log_sync_failure(uuid, integer, text, text, integer, text, text)                                                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.treasury_list_sources(text, text[])                                                                                           FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.treasury_sync_city_budget(uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_sync_budget_tree(uuid, integer, text, numeric, jsonb, integer, text, text, text)                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_log_sync_failure(uuid, integer, text, text, integer, text, text)                                                     TO service_role;
GRANT EXECUTE ON FUNCTION public.treasury_list_sources(text, text[])                                                                                           TO service_role;

-- =============================================================================
-- Post-verify gate — abort the migration if anything is not as intended.
-- =============================================================================
DO $$
DECLARE
  rel   text;
  fn    text;
  bad   int := 0;
  tbls  text[] := ARRAY[
    'treasury.frozen_excluded_ids',
    'treasury.frozen_figure_ledger',
    'treasury.frozen_invariant_runs',
    'treasury.frozen_invariant_baseline'
  ];
  fns   text[] := ARRAY[
    'public.treasury_sync_city_budget(uuid, integer, text, numeric, jsonb, integer, text, text, date, text, text, text, integer)',
    'public.treasury_sync_budget_tree(uuid, integer, text, numeric, jsonb, integer, text, text, text)',
    'public.treasury_log_sync_failure(uuid, integer, text, text, integer, text, text)',
    'public.treasury_list_sources(text, text[])'
  ];
BEGIN
  -- RLS on all four frozen_* tables
  FOREACH rel IN ARRAY tbls LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = split_part(rel, '.', 1)
        AND c.relname = split_part(rel, '.', 2)
        AND c.relrowsecurity
    ) THEN
      bad := bad + 1;
      RAISE WARNING 'RLS NOT enabled on %', rel;
    END IF;
  END LOOP;

  -- anon and authenticated must NOT execute; service_role MUST execute
  FOREACH fn IN ARRAY fns LOOP
    IF has_function_privilege('anon', fn, 'EXECUTE') THEN
      bad := bad + 1; RAISE WARNING 'anon can still EXECUTE %', fn;
    END IF;
    IF has_function_privilege('authenticated', fn, 'EXECUTE') THEN
      bad := bad + 1; RAISE WARNING 'authenticated can still EXECUTE %', fn;
    END IF;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      bad := bad + 1; RAISE WARNING 'service_role LOST EXECUTE on %', fn;
    END IF;
  END LOOP;

  IF bad > 0 THEN
    RAISE EXCEPTION 'treasury RLS/revoke migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK — 4 frozen_* tables default-deny RLS; anon/authenticated EXECUTE revoked on 4 treasury_* functions; service_role retained';
END $$;
