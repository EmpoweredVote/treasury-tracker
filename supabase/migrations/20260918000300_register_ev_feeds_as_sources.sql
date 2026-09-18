-- Register TT's own financial feeds, so the live-sync rule can see them.
--
-- ── ⚠⚠ WHY: A FEED THAT NO RULE COULD SEE ─────────────────────────────────
--
-- The 2026-09-08→14 frozen-figure divergence resolved to ONE row — Empowered
-- Vote FY2026 revenue, 2769.51 -> 2819.51, a $50.00 donation picked up when TT's
-- own financials were refreshed. It was ledgered, and the ledger pinned that row.
-- FIVE MORE EV ROWS SIT IN THE SAME DIGEST AND WILL MOVE ON THE NEXT REFRESH.
--
-- No rule could catch them. The live-sync scope (v2.36) is a union of two tests,
-- and BOTH read treasury.data_sources:
--
--   (a) a row's `data_source` text names an ENABLED source
--   (b) an enabled source declares that municipality / fiscal_year / dataset_type
--
-- EV's three feeds were not registered as sources AT ALL, so both halves were
-- blind by construction. v2.36's blindness was a WRONG LABEL; this is no label
-- at all — a strictly worse shape, because nothing anywhere pointed at it.
--
-- ⭐ The fix uses the mechanism instead of hand-patching six ids: register the
-- feeds, and the existing rule excludes their rows by itself — now and for any
-- EV row added later.
--
-- ── ⚠⚠ ENABLED, BUT UNREACHABLE BY EITHER SYNC LAYER ──────────────────────
--
-- `is_enabled = true` is what rule (a)/(b) read, and it is also what makes a
-- source cron-eligible — so this would be a foot-gun if anything could pick
-- these up. Nothing can, for two independent reasons, both read from the code:
--
--   treasury-sync-orchestrator: selects `treasury_list_sources(p_api_type =>
--     'socrata')` — api_type 'manual' is never enumerated.
--   treasury-sync: `if (ds.api_type !== 'socrata') return 400 Unsupported`.
--
-- and a third, belt-and-braces: `sync_frequency = 'manual'`, which the
-- orchestrator's due-filter skips outright.
--
-- ⚠ `is_enabled = true` is honest here rather than a trick. The flag's real
-- question is "can this rewrite the row without a human recording it?" — and the
-- EV financials refresh does exactly that, three loaders at a time. See
-- ev_financials_refresh_runbook.
--
-- ⚠ Each feed needs its own `dataset_id`: the unique index is
-- (municipality_id, api_type, COALESCE(dataset_id,''), dataset_type), and two of
-- the three write `operating`.
--
-- ⚠ THIS MIGRATION MOVES NO FIGURE AND NO DIGEST. The exclusion is a SNAPSHOT in
-- the repo by design (a live predicate would let toggling is_enabled move the
-- digest with no commit). Registering the sources only makes them VISIBLE to
-- `node scripts/liveSyncExclusions.mjs --write`, which is a separate, reviewable
-- commit. The self-verification below asserts exactly that.

DO $$
DECLARE ev_id uuid;
BEGIN
  SELECT id INTO STRICT ev_id FROM treasury.municipalities
   WHERE name = 'Empowered Vote' AND state = 'CA';

  INSERT INTO treasury.data_sources
    (municipality_id, name, description, api_type, base_url, dataset_id,
     dataset_type, fiscal_year_start_month, fiscal_years, is_enabled,
     sync_frequency, priority)
  SELECT ev_id, v.name, v.description, 'manual', 'https://financials.empowered.vote',
         v.dataset_id, v.dataset_type, 1, ARRAY[2024, 2025, 2026], true, 'manual', 0
    FROM (VALUES
      ('Empowered Vote Financial Records', 'ev-financial-records', 'operating',
       'Hand-run loader: EV''s own books. Registered so the frozen-figure live-sync rule can see that these rows are rewritten on every financials refresh. NOT cron-synced — api_type manual is unreachable by both sync layers.'),
      ('Empowered Vote — platform exports', 'ev-platform-exports', 'revenue',
       'Hand-run loader: donation and platform revenue exports. The FY2026 revenue row from this feed moved $50.00 between 2026-09-11 and 2026-09-14 and broke the frozen invariant; that is why all three feeds are now registered.'),
      ('Beneficial State Bank', 'ev-bank-beneficial', 'operating',
       'Hand-run loader: merged date-range bank exports (see ev_financials_refresh_runbook). Named as the publisher of the figures, which is what budgets.data_source records for these rows.')
    ) AS v(name, dataset_id, dataset_type, description)
   WHERE NOT EXISTS (
     SELECT 1 FROM treasury.data_sources d
      WHERE d.municipality_id = ev_id AND d.name = v.name
   );
END $$;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE
  ev_id uuid; registered int; covered int; reachable int; bad int := 0;
  digest_before text; digest_after text;
BEGIN
  SELECT digest INTO digest_before FROM treasury.frozen_invariant_status();
  SELECT id INTO STRICT ev_id FROM treasury.municipalities
   WHERE name = 'Empowered Vote' AND state = 'CA';

  -- 1. Three feeds, enabled — enabled is what the rule reads.
  SELECT count(*) INTO registered FROM treasury.data_sources
   WHERE municipality_id = ev_id AND is_enabled AND api_type = 'manual';
  IF registered <> 3 THEN
    bad := bad + 1; RAISE WARNING 'expected 3 enabled EV feeds, found %', registered;
  END IF;

  -- 2. ⚠⚠ NEITHER SYNC LAYER CAN REACH THEM. Both are socrata-only; assert the
  -- property the code depends on rather than trusting the comment above.
  SELECT count(*) INTO reachable FROM treasury.data_sources
   WHERE municipality_id = ev_id
     AND (api_type = 'socrata' OR sync_frequency <> 'manual');
  IF reachable <> 0 THEN
    bad := bad + 1; RAISE WARNING '% EV source(s) are reachable by a sync layer', reachable;
  END IF;

  -- 3. ⭐ THE POINT: every EV budget row is now matched by the live-sync rule —
  -- (a) by name, or (b) by municipality/year/dataset_type.
  SELECT count(*) INTO covered
    FROM treasury.budgets b
   WHERE b.municipality_id = ev_id
     AND (
       EXISTS (SELECT 1 FROM treasury.data_sources d
                WHERE d.is_enabled AND d.name = b.data_source)
       OR EXISTS (SELECT 1 FROM treasury.data_sources d
                   WHERE d.is_enabled AND d.municipality_id = b.municipality_id
                     AND b.fiscal_year = ANY (d.fiscal_years)
                     AND (d.dataset_type IS NULL OR d.dataset_type = b.dataset_type))
     );
  IF covered <> (SELECT count(*) FROM treasury.budgets WHERE municipality_id = ev_id) THEN
    bad := bad + 1;
    RAISE WARNING 'only % of % EV rows are covered by the live-sync rule',
      covered, (SELECT count(*) FROM treasury.budgets WHERE municipality_id = ev_id);
  END IF;

  -- 4. ⚠⚠ AND NOTHING MOVED. The exclusion is a repo snapshot; this migration
  -- must make the rows VISIBLE to the rule without changing the digest by itself.
  SELECT digest INTO digest_after FROM treasury.frozen_invariant_status();
  IF digest_after IS DISTINCT FROM digest_before THEN
    bad := bad + 1;
    RAISE WARNING 'registering a source MOVED the digest: % -> %', digest_before, digest_after;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'register EV feeds: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — 3 EV feeds registered, unreachable by both sync layers, all EV rows now covered, digest unmoved';
END $$;
