-- Approach C in the lookup: the publisher's own id decides identity.
--
-- ⚠⚠ ADDING A STEP DOES NOT CHANGE THE SIGNATURE, so this is a plain REPLACE —
-- the 6-argument function from 20260916093000 keeps its argument list and no
-- overload is created. (Compare that migration's DROP, which was needed
-- because it WIDENED the signature from four arguments to six.)
--
-- The parameters already exist and already default to NULL; what changes is
-- that supplying them now resolves against treasury.municipality_source_keys
-- instead of treasury.municipality_aliases, and that a load REGISTERS the key
-- it supplied. Callers that pass no key behave exactly as before.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

CREATE OR REPLACE FUNCTION public.treasury_ensure_municipality(
  p_name              text,
  p_state             text,
  p_entity_type       text    DEFAULT 'city',
  p_population        integer DEFAULT 0,
  p_source            text    DEFAULT NULL,
  p_source_entity_key text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'treasury', 'public'
AS $function$
DECLARE
  v_id          uuid;
  v_keyed_name  text;
  v_keyed_state text;
  v_keyed_type  text;
  v_named_id    uuid;
  v_alias_owner uuid;
BEGIN
  -- 1. ⭐ APPROACH C: the publisher's own stable key wins when supplied. This
  -- is the only path here that makes a rename a NON-EVENT rather than
  -- something to be caught afterwards.
  IF p_source IS NOT NULL AND p_source_entity_key IS NOT NULL THEN
    SELECT k.municipality_id, m.name, m.state, m.entity_type
      INTO v_id, v_keyed_name, v_keyed_state, v_keyed_type
      FROM treasury.municipality_source_keys k
      JOIN treasury.municipalities m ON m.id = k.municipality_id
     WHERE k.source = p_source AND k.source_entity_key = p_source_entity_key;

    IF FOUND THEN
      -- ⚠ A key must never reach across state or kind of government. If a
      -- publisher ever numbers its counties in the same series as its cities,
      -- this fails loudly instead of merging a county into a city.
      IF v_keyed_state <> p_state OR v_keyed_type <> p_entity_type THEN
        RAISE EXCEPTION
          'source key %/% identifies "%" (%/%), but was used for a %/% named "%"',
          p_source, p_source_entity_key, v_keyed_name, v_keyed_state, v_keyed_type,
          p_state, p_entity_type, p_name;
      END IF;

      -- ⚠⚠ The incoming NAME matching a DIFFERENT entity means the fork this
      -- mechanism exists to prevent ALREADY EXISTS: one government held as
      -- two, one half keyed and one half not. Resolving by key here would hide
      -- it forever. Fail, naming both halves.
      SELECT id INTO v_named_id
        FROM treasury.municipalities
       WHERE lower(name) = lower(p_name)
         AND state = p_state
         AND entity_type = p_entity_type;

      IF v_named_id IS NOT NULL AND v_named_id <> v_id THEN
        RAISE EXCEPTION
          'source key %/% identifies "%" (%), but "%" is a SEPARATE entity (%) — one government held as two; merge them before loading',
          p_source, p_source_entity_key, v_keyed_name, v_id, p_name, v_named_id;
      END IF;

      -- A spelling the publisher has not printed before is recorded as an
      -- alias, so the NAME path resolves too — for this loader and for every
      -- other source that has no key to key on.
      --
      -- ⚠ Recording a spelling is NOT renaming. The stored name is left alone:
      -- `?entity=` slugs derive from it, so a load that rewrote it would
      -- invalidate every link ever shared to this city.
      IF lower(v_keyed_name) <> lower(p_name) THEN
        SELECT municipality_id INTO v_alias_owner
          FROM treasury.municipality_aliases
         WHERE lower(alias_name) = lower(p_name)
           AND state = p_state
           AND entity_type = p_entity_type;

        IF v_alias_owner IS NOT NULL AND v_alias_owner <> v_id THEN
          RAISE EXCEPTION
            'source key %/% identifies "%" (%), but the spelling "%" is already an alias of a different entity (%)',
            p_source, p_source_entity_key, v_keyed_name, v_id, p_name, v_alias_owner;
        END IF;

        INSERT INTO treasury.municipality_aliases
          (municipality_id, alias_name, state, entity_type, source, source_entity_key, note)
        VALUES
          (v_id, p_name, p_state, p_entity_type, p_source, p_source_entity_key,
           format('Recorded automatically on %s: %s printed this spelling for source key %s, which identifies "%s".',
                  current_date, p_source, p_source_entity_key, v_keyed_name))
        ON CONFLICT DO NOTHING;
      END IF;

      RETURN v_id;
    END IF;
  END IF;

  -- 2. Today's behaviour: case-insensitive name match (#182).
  --
  -- ⚠ When found, the stored name is left ALONE even if the casing differs.
  SELECT id INTO v_id
    FROM treasury.municipalities
   WHERE lower(name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;

  IF NOT FOUND THEN
    -- 3. A known rename resolves to the entity it renamed.
    -- ⚠ The same rule applies — resolving through an alias must NEVER rename.
    SELECT municipality_id INTO v_id
      FROM treasury.municipality_aliases
     WHERE lower(alias_name) = lower(p_name)
       AND state = p_state
       AND entity_type = p_entity_type;
  END IF;

  IF v_id IS NULL THEN
    -- 4. Create. An unknown rename from a publisher WITHOUT a stable id still
    -- creates a second entity here; it is caught at the END of the load by
    -- treasury.detect_forked_entities(), which needs budget rows this row does
    -- not have yet.
    INSERT INTO treasury.municipalities (name, state, entity_type, population)
    VALUES (p_name, p_state, p_entity_type, p_population)
    RETURNING id INTO v_id;
  END IF;

  -- ⭐ The load LEARNS the key. Whichever way the entity was resolved above,
  -- supplying a key here means the NEXT re-spelling by this publisher resolves
  -- at step 1 and never reaches the name.
  IF p_source IS NOT NULL AND p_source_entity_key IS NOT NULL THEN
    PERFORM treasury.attach_source_key(v_id, p_source, p_source_entity_key, p_name);
  END IF;

  RETURN v_id;
END;
$function$;

-- ── Self-verification: REBUILD THE BIRCHWOOD RENAME AND PROVE IT IS INERT ──
--
-- The established pattern (#186, and this design's Testing section): rebuild
-- the known fork, assert the mechanism fires, roll back, verify the rollback.
-- An untested check that returns nothing proves nothing.
DO $$
DECLARE
  bv_id uuid; bv_name text; other_id uuid;
  rows_before int; rows_after int; returned_id uuid; bad int := 0;
  raised boolean;
  src text := '__selftest_osa__';
  new_spelling text := 'Birchwood Village Selftest Spelling';
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  SELECT id, name INTO bv_id, bv_name FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';
  IF bv_id IS NULL THEN
    RAISE EXCEPTION 'Birchwood Village is not in the table — the fixture this test rests on is gone';
  END IF;

  PERFORM treasury.attach_source_key(bv_id, src, '168', bv_name);

  -- 1. ⭐⭐ THE WHOLE POINT: the publisher prints a name TT has never seen, and
  -- the key resolves it to the existing city. This is the Birchwood incident
  -- replayed — under name identity it created a second government.
  returned_id := public.treasury_ensure_municipality(new_spelling, 'MN', 'city', 851, src, '168');
  IF returned_id IS DISTINCT FROM bv_id THEN
    bad := bad + 1;
    RAISE WARNING 'the renamed spelling resolved to %, expected %', returned_id, bv_id;
  END IF;

  -- 2. ...and created NOTHING. The assertion that proves prevention rather
  -- than mere detection.
  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1;
    RAISE WARNING 'the rename still CREATED % row(s)', rows_after - rows_before;
  END IF;

  -- 3. ...and did NOT rename the city (criterion 5 — `?entity=` slugs).
  IF (SELECT name FROM treasury.municipalities WHERE id = bv_id) <> bv_name THEN
    bad := bad + 1; RAISE WARNING 'resolving by key RENAMED the entity';
  END IF;

  -- 4. ...and recorded the new spelling as an alias, so the name path resolves
  -- it too.
  IF NOT EXISTS (SELECT 1 FROM treasury.municipality_aliases
                  WHERE municipality_id = bv_id AND lower(alias_name) = lower(new_spelling)) THEN
    bad := bad + 1; RAISE WARNING 'the new spelling was not recorded as an alias';
  END IF;

  -- 5. A key used for the wrong kind of government is REFUSED.
  raised := false;
  BEGIN
    returned_id := public.treasury_ensure_municipality(new_spelling, 'MN', 'county', 851, src, '168');
  EXCEPTION WHEN others THEN raised := true;
  END;
  IF NOT raised THEN
    bad := bad + 1; RAISE WARNING 'a city key resolved a COUNTY without complaint';
  END IF;

  -- 6. A key whose entity is NOT the entity the name points at is REFUSED —
  -- the already-forked shape.
  SELECT id INTO other_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND id <> bv_id ORDER BY id LIMIT 1;
  raised := false;
  BEGIN
    returned_id := public.treasury_ensure_municipality(
      (SELECT name FROM treasury.municipalities WHERE id = other_id), 'MN', 'city', 0, src, '168');
  EXCEPTION WHEN others THEN raised := true;
  END;
  IF NOT raised THEN
    bad := bad + 1; RAISE WARNING 'a key resolved past a DIFFERENT entity of the same name';
  END IF;

  -- 7. No regression on #182 / the alias path: an unkeyed call still works.
  returned_id := public.treasury_ensure_municipality(upper(bv_name), 'MN', 'city', 0);
  IF returned_id IS DISTINCT FROM bv_id THEN
    bad := bad + 1; RAISE WARNING 'the unkeyed case-insensitive path regressed';
  END IF;
  returned_id := public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863);
  IF returned_id IS DISTINCT FROM bv_id THEN
    bad := bad + 1; RAISE WARNING 'the historical alias path regressed';
  END IF;

  -- 8. An unkeyed call for a genuinely new name still CREATES — the mechanism
  -- must not have turned into a universal no-op.
  returned_id := public.treasury_ensure_municipality('Zzz Selftest Township', 'MN', 'city', 1);
  IF returned_id IS NULL THEN
    bad := bad + 1; RAISE WARNING 'a genuinely new entity was not created';
  END IF;
  DELETE FROM treasury.municipalities WHERE id = returned_id;

  -- Roll back the fixture, then verify the rollback.
  DELETE FROM treasury.municipality_aliases
   WHERE municipality_id = bv_id AND lower(alias_name) = lower(new_spelling);
  DELETE FROM treasury.municipality_source_keys WHERE source = src;

  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'self-test left % municipality row(s) behind', rows_after - rows_before;
  END IF;
  IF EXISTS (SELECT 1 FROM treasury.municipality_source_keys WHERE source = src) THEN
    bad := bad + 1; RAISE WARNING 'self-test left a source key behind';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'source-key lookup: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — the Birchwood rename replayed as a NON-EVENT: same id, nothing created, nothing renamed, spelling recorded';
END $$;
