-- Michigan townships + villages sweep — the two schema facts the load needs.
--
-- 1. `village` joins the entity_type CHECK. A Michigan village is a legally
--    distinct class of government from a city: it is incorporated, but it
--    remains part of its township and its powers differ. 253 Michigan villages
--    file a Form F-65 and are loaded by this sweep. `township` was already
--    permitted by 20260606000000_add_state_entity_type.sql.
--
-- 2. ⚠⚠ MICHIGAN HAS NO CITY OF MANCHESTER, and TT records one.
--    The Village of Manchester (Washtenaw County) files the F-65 as municode
--    813030 on the VILLAGE form for FY2010-FY2019, and as municode 812019 on
--    the CITY form -- named `City of Manchester` -- from FY2020. It is one
--    government: the years are disjoint and contiguous, the fiscal calendar
--    never moves (month 6 end, a July start, on every filing of both codes),
--    the General Fund revenue runs continuously across the handover
--    (1,423,356 in FY2019 on the village form, 1,440,439 in FY2020 on the city
--    form), and the Census knows the place only as `Manchester village`.
--
--    TT already holds its FY2020-2025 half, created by PR #124 from the city
--    form and typed `city` -- with the VILLAGE's population, 2,056, because
--    `resolveCensus` matched `Manchester village`.
--
--    `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE), so
--    leaving this row at `city` while the sweep writes `village` would create a
--    SECOND Manchester and leave a reader two half-length cards for one
--    government. Correcting the type here keeps the row's id, so its 24
--    existing budget rows stay attached and the FY2010-2019 half joins them.
--
--    ⚠ It is the ONLY such pair in Michigan. All 203 (county, base name) pairs
--    held by two municodes were checked: 202 are a township filing alongside a
--    like-named city or village IN THE SAME YEARS -- different governments --
--    and exactly one has zero year overlap.
--
-- ⚠ INVARIANT-NEUTRAL. `treasury.frozen_invariant_status()` digests
--   `budgets.id || total_budget`; entity_type is not in it, no budget row is
--   touched, and no figure moves. Verified byte-identical either side:
--   62654 rows / 3a48ac283a15704fc62f970239a5ab3c37989f0d98f899be259be2de54ed41c6

ALTER TABLE treasury.municipalities
  DROP CONSTRAINT municipalities_entity_type_check;

ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'village', 'nonprofit',
                         'state', 'municipality', 'special_district',
                         'school_district', 'conservancy', 'library', 'town',
                         'federal'));

-- ⚠ Guarded and idempotent: it moves EXACTLY the one row, and only while that
-- row still looks like what was measured. A silent no-op here would mean the
-- premise changed, so the count is asserted rather than assumed.
DO $$
DECLARE v_moved integer;
BEGIN
  UPDATE treasury.municipalities
     SET entity_type = 'village'
   WHERE state = 'MI' AND name = 'Manchester' AND entity_type = 'city';
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  IF v_moved <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 Michigan Manchester typed city, moved %. The premise '
      'of this correction no longer holds -- re-measure before re-running.', v_moved;
  END IF;
END $$;
