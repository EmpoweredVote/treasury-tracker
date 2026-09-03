-- Pennsylvania statewide sweep — the two schema facts the load needs.
--
-- 1. `borough` joins the entity_type CHECK. A Pennsylvania borough is a legally
--    distinct class of government from a city: it is incorporated, but it is
--    governed by the Borough Code rather than a city code, and its Annual Audit
--    and Financial Report is signed by a different officer — Section IV of
--    DCED-CLGS-30 has "Boroughs: Elected Auditors, Independent Auditor, or
--    Controller" against "Cities: Director of Accounts and Finance".
--
--    949 Pennsylvania boroughs file an approved AFR in FY2015-FY2024 and are
--    loaded by this sweep. This mirrors 20260901000000, which added `village`
--    for Michigan's 253 for the same reason.
--
--    ⚠ `borough` must also be present in every `CITY_TIER_TYPES` set in
--    scripts/, or coverage matching silently stops finding these 949 — the
--    defect PR #131 found for Michigan's 1,240 townships, which could never
--    match anything. Done in the same PR.
--
-- 2. ⚠⚠ STATE COLLEGE IS TYPED `municipality`, THE LEGACY PLANO-ERA VALUE.
--    It is a Borough — DCED types it `Borough` and its published name is
--    `STATE COLLEGE BORO` — and it already holds budget rows from Knight
--    session 5 (PR #113).
--
--    `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE), so
--    leaving this row at `municipality` while the sweep writes `borough` would
--    create a SECOND State College and leave a reader two cards for one
--    government, with the older card's rows orphaned behind it. Correcting the
--    type here keeps the row's id, so its existing budget rows stay attached
--    and the sweep updates them in place.
--
--    ⚠ It is the only Pennsylvania row needing this. The other three PA rows are
--    `Philadelphia` (city — correct), `Centre County` (county — correct) and the
--    `Pennsylvania` state node.
--
-- ⚠ INVARIANT-NEUTRAL. `treasury.frozen_invariant_status()` digests
--   `budgets.id || total_budget`; entity_type is not in it, no budget row is
--   touched, and no figure moves. Expected byte-identical either side:
--   62654 rows / 3a48ac283a15704fc62f970239a5ab3c37989f0d98f899be259be2de54ed41c6

ALTER TABLE treasury.municipalities
  DROP CONSTRAINT municipalities_entity_type_check;

ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'village', 'borough',
                         'nonprofit', 'state', 'municipality', 'special_district',
                         'school_district', 'conservancy', 'library', 'town',
                         'federal'));

-- ⚠ Guarded and idempotent: it moves EXACTLY the one row, and only while that
-- row still looks like what was measured. A silent no-op would mean the premise
-- changed, so the count is asserted rather than assumed. Re-running after the
-- move is a no-op that raises, which is the intended signal on a second apply —
-- so the guard tolerates the already-migrated state explicitly.
DO $$
DECLARE
  v_moved integer;
  v_already integer;
BEGIN
  SELECT count(*) INTO v_already
    FROM treasury.municipalities
   WHERE state = 'PA' AND name = 'State College' AND entity_type = 'borough';

  IF v_already = 1 THEN
    RAISE NOTICE 'State College is already typed borough — nothing to move.';
    RETURN;
  END IF;

  UPDATE treasury.municipalities
     SET entity_type = 'borough'
   WHERE state = 'PA' AND name = 'State College' AND entity_type = 'municipality';
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  IF v_moved <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 Pennsylvania State College typed municipality, moved %. '
      'The premise of this correction no longer holds -- re-measure before re-running.', v_moved;
  END IF;
END $$;
