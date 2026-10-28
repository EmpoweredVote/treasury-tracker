-- Massachusetts is 306 towns and 45 cities, not 351 cities.
--
-- ── ⚠⚠ WHY THIS IS A MIGRATION AND NOT A RELOAD ────────────────────────────
--
-- `treasury_ensure_municipality` keys on (lower(name), state, entity_type) and
-- INSERTS when it finds no match. So retyping a government and then re-running
-- a loader that still passes the old type does not collide visibly — it MINTS A
-- SECOND Brookline and every later year lands on the new row, severing the
-- history at that boundary. The same shape as the State College retype and the
-- Ellettsville city-vs-town conflict.
--
-- Everything below therefore UPDATES EXISTING ROWS IN PLACE. The ids survive,
-- so all 16,881 Massachusetts budget rows keep pointing at the same entities
-- and the frozen-figure registry — keyed on budgets.id — is untouched.
--
-- ── WHERE THE TYPES COME FROM ──────────────────────────────────────────────
--
-- Census Vintage 2024, SUMLEV 061 (county subdivisions — in New England the
-- town is the general-purpose government, so 061 is the right layer and the
-- incorporated-place layer 162 is not: the 2024 file carries 351 MA rows at 061
-- against 58 at 162). Measured 2026-10-28: 061 names all 351 TT entities with
-- ZERO unmatched and zero name collisions.
--
-- The roster is committed at scripts/data/maMunicipalTypes.mjs and regenerated
-- by scripts/buildMaMunicipalTypes.mjs; the 45 names below are its `city` rows.
--
-- ── ⚠⚠ THE THIRTEEN, AND WHY THEY ARE ALSO RENAMED ─────────────────────────
--
-- Thirteen MA municipalities have a legal name ending in "Town" and run a CITY
-- charter, so the census writes "Amherst Town city". TT types them `town` —
-- Chris's call, 2026-10-28, on two grounds: it matches what each government
-- calls itself, and it matches the line TT's own geofence work already drew
-- (the 45 MA rows carrying `geoid_basis = census-pep-162-exact` are EXACTLY the
-- 45 plain-named census cities, with zero on either side of the difference).
--
-- They are stored under the LEGAL name so a town and a city of the same name
-- stay distinguishable. DLS keeps printing "Barnstable", so each rename gets a
-- `municipality_aliases` row carrying the publisher's spelling. ⚠ The alias
-- table is consulted by treasury_ensure_municipality on (alias_name, state,
-- entity_type), which is why these carry entity_type `town` and not `city`.
--
-- ⚠ The script-side lookups were fixed in the same change (scripts/lib/
-- maNames.mjs `maKey()`); the aliases cover the RPC path, which no MA loader
-- uses today but any future one would.

BEGIN;

-- ── 1. Type every MA municipality that is not one of the 45 cities ─────────
WITH ma_cities(name) AS (VALUES
  ('Amesbury'), ('Attleboro'), ('Beverly'),
  ('Boston'), ('Brockton'), ('Cambridge'),
  ('Chelsea'), ('Chicopee'), ('Easthampton'),
  ('Everett'), ('Fall River'), ('Fitchburg'),
  ('Framingham'), ('Gardner'), ('Gloucester'),
  ('Greenfield'), ('Haverhill'), ('Holyoke'),
  ('Lawrence'), ('Leominster'), ('Lowell'),
  ('Lynn'), ('Malden'), ('Marlborough'),
  ('Medford'), ('Melrose'), ('Methuen'),
  ('New Bedford'), ('Newburyport'), ('Newton'),
  ('North Adams'), ('Northampton'), ('Peabody'),
  ('Pittsfield'), ('Quincy'), ('Revere'),
  ('Salem'), ('Somerville'), ('Springfield'),
  ('Taunton'), ('Waltham'), ('Watertown'),
  ('Westfield'), ('Woburn'), ('Worcester')
)
UPDATE treasury.municipalities m
   SET entity_type = 'town'
 WHERE m.state = 'MA'
   AND m.entity_type = 'city'
   AND NOT EXISTS (SELECT 1 FROM ma_cities c WHERE lower(c.name) = lower(m.name));

-- ── 2. Store the thirteen under their legal names ──────────────────────────
-- ⚠ Runs AFTER the retype, so these rows are already `town` and the rename
-- cannot collide with a `city` of the same name.
WITH renames(from_name, to_name) AS (VALUES
  ('Agawam','Agawam Town'),
  ('Amherst','Amherst Town'),
  ('Barnstable','Barnstable Town'),
  ('Braintree','Braintree Town'),
  ('Bridgewater','Bridgewater Town'),
  ('Franklin','Franklin Town'),
  ('North Attleborough','North Attleborough Town'),
  ('Palmer','Palmer Town'),
  ('Randolph','Randolph Town'),
  ('Southbridge','Southbridge Town'),
  ('West Springfield','West Springfield Town'),
  ('Weymouth','Weymouth Town'),
  ('Winthrop','Winthrop Town')
)
UPDATE treasury.municipalities m
   SET name = r.to_name
  FROM renames r
 WHERE m.state = 'MA'
   AND m.entity_type = 'town'
   AND lower(m.name) = lower(r.from_name);

-- ── 3. Keep the publisher's spelling resolvable ────────────────────────────
WITH renames(from_name, to_name) AS (VALUES
  ('Agawam','Agawam Town'),
  ('Amherst','Amherst Town'),
  ('Barnstable','Barnstable Town'),
  ('Braintree','Braintree Town'),
  ('Bridgewater','Bridgewater Town'),
  ('Franklin','Franklin Town'),
  ('North Attleborough','North Attleborough Town'),
  ('Palmer','Palmer Town'),
  ('Randolph','Randolph Town'),
  ('Southbridge','Southbridge Town'),
  ('West Springfield','West Springfield Town'),
  ('Weymouth','Weymouth Town'),
  ('Winthrop','Winthrop Town')
)
INSERT INTO treasury.municipality_aliases
  (municipality_id, alias_name, state, entity_type, source, note)
SELECT m.id, r.from_name, 'MA', 'town', 'Massachusetts DLS',
       'Recorded 2026-10-28: the Division of Local Services prints "' || r.from_name
       || '" for the government whose legal name is "' || r.to_name
       || '". TT stores the legal name so a town and a city of the same name stay '
       || 'distinguishable; this alias keeps the publisher''s spelling resolvable.'
  FROM renames r
  JOIN treasury.municipalities m
    ON m.state = 'MA' AND m.entity_type = 'town' AND m.name = r.to_name
ON CONFLICT DO NOTHING;

-- ── 4. Refuse the whole migration unless it landed exactly ─────────────────
DO $$
DECLARE
  v_city  int;
  v_town  int;
  v_alias int;
  v_named int;
  v_orphan int;
BEGIN
  SELECT count(*) FILTER (WHERE entity_type = 'city'),
         count(*) FILTER (WHERE entity_type = 'town')
    INTO v_city, v_town
    FROM treasury.municipalities
   WHERE state = 'MA' AND entity_type IN ('city', 'town');

  IF v_city <> 45 OR v_town <> 306 THEN
    RAISE EXCEPTION 'MA should be 45 city / 306 town, got % / %', v_city, v_town;
  END IF;

  SELECT count(*) INTO v_named
    FROM treasury.municipalities
   WHERE state = 'MA' AND name LIKE '% Town';
  IF v_named <> 13 THEN
    RAISE EXCEPTION 'expected 13 MA governments stored under a "... Town" legal name, got %', v_named;
  END IF;

  SELECT count(*) INTO v_alias
    FROM treasury.municipality_aliases WHERE state = 'MA';
  IF v_alias <> 13 THEN
    RAISE EXCEPTION 'expected 13 MA aliases, got %', v_alias;
  END IF;

  -- ⚠ The point of the whole exercise: no government may have been forked.
  -- 351 municipal rows before, 351 after, and every budget row still attached.
  SELECT count(*) INTO v_orphan
    FROM treasury.budgets b
    JOIN treasury.municipalities m ON m.id = b.municipality_id
   WHERE m.state = 'MA';
  IF v_orphan <> 16881 THEN
    RAISE EXCEPTION 'MA budget rows should still number 16881, got %', v_orphan;
  END IF;

  RAISE NOTICE 'MA: % city / % town, % legal-name rows, % aliases, % budget rows',
    v_city, v_town, v_named, v_alias, v_orphan;
END $$;

COMMIT;
