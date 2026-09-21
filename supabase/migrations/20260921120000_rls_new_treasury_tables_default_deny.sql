-- =============================================================================
-- Default-deny RLS on six new treasury tables (2026-09-16..2026-09-18 wave)
-- =============================================================================
-- Created 2026-09-21. Source: CTO weekly review 2026-09-21, task
-- ev-cto/tasks/2026-09-21-rls-on-new-treasury-tables.md.
--
-- The 2026-09-10 RLS audit (CTO decision 0015; watchlist #24/#61) sorted every
-- table then in existence into protected or deliberately-public, and left the
-- project at "RLS on everywhere it can be on". Six tables added in the stable-key
-- loader-identity work and the frozen-figure localizer landed AFTER that sweep
-- with RLS off. `treasury` is a PostgREST-exposed schema (pgrst.db_schemas,
-- verified 2026-09-21) and `anon` holds SELECT on all six through the schema-wide
-- default privilege — so they are internet-readable now. This restores the swept
-- end state for the wave.
--
-- ── BUCKET: PROTECTED (default-deny) for all six ───────────────────────────
-- Founder decision 2026-09-21 (Chris Andrews): protect all — the same call made
-- for the four treasury.frozen_* siblings on 2026-09-10 ("protect them all").
-- RLS-on with NO policy denies every row to any role that does not bypass RLS.
--
-- Each creating migration granted SELECT to service_role and to nobody else; the
-- anon reach was never intended, it is the schema default. None of these tables
-- has any anonymous or browser reader: Treasury Tracker's front end reads budget
-- data over HTTP from the ev-accounts-api (an RLS-bypassing role), and holds no
-- Supabase browser client at all (verified in src 2026-09-21). So default-deny
-- touches only direct anon/authenticated PostgREST reads, which nothing depends
-- on. Safe for the backend: postgres, service_role and ev_api all bypass RLS
-- (rolbypassrls = true, verified 2026-09-10/09-21), the frozen-invariant pg_cron
-- jobs run as the owner, and none of these tables FORCES RLS — so owner and
-- service-role paths are unaffected. RLS is deliberately NOT forced, matching the
-- 2026-09-10 migration.
--
--   treasury.municipality_aliases        PROTECTED — loader-identity table (old
--       published spellings -> surviving entity); read/written only by loader
--       scripts as service_role. No public reader.
--   treasury.municipality_fork_reviews   PROTECTED — internal adjudication queue
--       for suspected forked cities (carries staff `resolved_by`). Internal only.
--   treasury.municipality_source_keys    PROTECTED — a publisher's own stable unit
--       ids (approach C); consulted by the loader as service_role. No public
--       reader.
--   treasury.budget_total_changes        PROTECTED — trigger-written ledger of
--       budget total changes; its own creating migration marks it "NOT
--       anon-readable". A record of what the database did, never read by a client.
--   treasury.frozen_figure_snapshot      PROTECTED — per-row frozen-figure
--       localizer; captured deliberately by service_role. Same class as the four
--       frozen_* tables protected 2026-09-10.
--   treasury.frozen_figure_snapshot_meta PROTECTED — snapshot metadata (digest,
--       row_count, captured_at). Same class.
--
-- Columns checked for publisher-confidential data before this call: none of the
-- six carries a contact name, email, or anything supplied in confidence — the
-- content is public budget figures and public-record government-identity metadata
-- for a transparency tool. This is a classification gap, not a leak.
--
-- ── The seventh table is NOT here, by design ───────────────────────────────
-- essentials.source_hubs (the task's seventh) is owned by the on-the-record repo
-- (slice2b hub-registry, in progress) and lives in `essentials`, which is NOT
-- served by PostgREST — so it is unreachable by anon today. Its RLS belongs in
-- OTR's own in-flight hub-registry migration, not here. Until OTR lands it, the
-- linter's rls_disabled_in_public reads 2 (this restores 6 of 8; spatial_ref_sys
-- is the accepted, unalterable eighth).
--
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op when already on. Applies to
-- the shared project kxsdzaojfaibhuzmclfq ("E.V Backend").
-- -----------------------------------------------------------------------------

ALTER TABLE treasury.municipality_aliases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.municipality_fork_reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.municipality_source_keys     ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.budget_total_changes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.frozen_figure_snapshot       ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury.frozen_figure_snapshot_meta  ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Post-verify gate — abort the migration if anything is not as intended.
-- =============================================================================
-- Runs live at apply time: every one of the six must end with relrowsecurity =
-- true. It is the authoritative live check — the CI guard
-- (tests/exposedTableRls.test.mjs) reasons about migration text and cannot see
-- live state, so this DO block is what proves RLS is actually on in the database
-- it runs against.
DO $$
DECLARE
  rel  text;
  bad  int := 0;
  tbls text[] := ARRAY[
    'treasury.municipality_aliases',
    'treasury.municipality_fork_reviews',
    'treasury.municipality_source_keys',
    'treasury.budget_total_changes',
    'treasury.frozen_figure_snapshot',
    'treasury.frozen_figure_snapshot_meta'
  ];
BEGIN
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

  IF bad > 0 THEN
    RAISE EXCEPTION 'treasury new-tables RLS migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK — 6 new treasury tables default-deny RLS (RLS on, no policy)';
END $$;
