-- Resolve 14 of the 22 geoids the 2026-09-12 national backfill left NULL.
--
-- PR #178 resolved 8,127 rows and left 21 missed + 1 ambiguous. Every one of
-- those 22 is a BUDGET-BEARING entity, so each is currently omitted from
-- `/api/treasury/coverage` and cannot be deep-linked by Civic Spaces. This
-- resolves the 14 that a Census row identifies unambiguously.
--
-- ── WHY THE GENERATOR MISSED THEM ──────────────────────────────────────────
--
-- Every one is a NAME-FORM difference, not a missing government. TT carries the
-- publisher's spelling; Census carries its own:
--
--   TT                        Census 2024 (SUMLEV 162)
--   Amador                    Amador City city
--   El Paso De Robles         El Paso de Robles (Paso Robles) city     -- case of "de"
--   La Canada Flintridge      La Canada Flintridge city                -- n-tilde in source
--   San Buenaventura          San Buenaventura (Ventura) city
--   Islamorada                Islamorada, Village of Islands village
--   Columbus-Muscogee         Columbus city                            -- consolidated city-county
--   Parker                    Parker City town
--   Pines                     Town of Pines town                       -- designator LEADS
--   Windfall                  Windfall City town
--   Lexington-Fayette ...     Lexington-Fayette urban county
--   Minnetonka Beach          Village of Minnetonka Beach city         -- designator LEADS
--   Saint Anthony             St. Anthony city                         -- Saint vs St.
--   Saint Anthony [Stearns]   St. Anthony city                         -- the OTHER one
--   Nashville-Davidson        Nashville-Davidson metropolitan government (balance)
--
-- `scripts/lib/geoid.mjs` appends Census designators to the TT name and never
-- strips them from the Census name, which is correct and deliberate. It cannot
-- reach a name whose designator LEADS ("Town of Pines"), one Census parenthesises
-- ("(Ventura)"), or one abbreviated differently ("St." for "Saint").
--
-- ⚠⚠ MINNESOTA HAS TWO "St. Anthony city" PLACES and TT carries both. They are
-- separated by the qualifier TT already encodes in the name, NOT by guessing:
--
--   2756680  St. Anthony city  pop 9,993  (Hennepin/Ramsey)  <- TT "Saint Anthony"
--   2756698  St. Anthony city  pop    93  (Stearns, cty 145) <- TT "Saint Anthony [Stearns]"
--
-- ── THE EIGHT DELIBERATELY LEFT NULL ───────────────────────────────────────
--
-- Null is a correct answer; a wrong geoid points a reader at another
-- government's budget while looking authoritative.
--
--   FL Hastings           no SUMLEV-162 or -061 row in the 2024 file at all
--   FL Weeki Wachee       likewise
--   PA Strausstown        likewise
--   IN Hardinsburg        likewise
--   IN Victoria Woods     likewise
--   PA Upper Mahantango Township, Schuylkill County
--                         no PA MCD row matching "mahantango" in any county
--   MN Thomson            only a TOWNSHIP row (061) exists; TT types it 'city',
--                         and a city-tier entity is not assumed to be its
--                         same-named township
--
--   MN Birchwood          ⚠⚠ WITHHELD ON PURPOSE — SEE BELOW
--
-- ── ⚠⚠ MN BIRCHWOOD IS A SECOND "MARINE ON SAINT CROIX" ────────────────────
--
-- "Birchwood" resolves to 2706058 — which TT's "Birchwood Village" ALREADY
-- holds. Writing it would create exactly the duplicate geoid that PR #181 had
-- to clean up. They are one city that TT holds as two entities:
--
--   fb5e4112…  "Birchwood"          18 budgets  FY2012-2020  pop 863  geoid NULL
--   b7291e76…  "Birchwood Village"   6 budgets  FY2021-2023  pop 898  geoid 2706058
--
-- Same publisher (MN Office of the State Auditor), contiguous non-overlapping
-- year ranges. The OSA changed the published name between its FY2020 and FY2021
-- reports and the name-matching loader created a second entity, severing the
-- city's history at the 2020/2021 boundary — the same defect as Marine on Saint
-- Croix and the same shape as the severed LA city series.
--
-- ⚠ Unlike Marine, these two produce DIFFERENT slugs (birchwood-mn vs
-- birchwood-village-mn), so nothing collides and no reader lands on the wrong
-- city. The damage is that each half looks complete and is not.
--
-- This migration does NOT merge them. That is a data-destructive decision and
-- belongs in its own reviewed migration, following 20260914000000's pattern of
-- asserting the CASCADE children are empty before deleting. Left open.

UPDATE treasury.municipalities AS m
   SET geoid = v.geoid, geoid_basis = v.basis
  FROM (VALUES
    ('aac14635-dc4c-48c1-b2fc-3c91f08db0c6'::uuid, '0601514', 'census-pep-162-exact'),  -- CA Amador
    ('08a0bcc1-cd1c-4bf4-8525-99761d766a71'::uuid, '0622300', 'census-pep-162-exact'),  -- CA El Paso De Robles
    ('f50ce0de-1813-4629-a45b-d48e46dae7bc'::uuid, '0639003', 'census-pep-162-exact'),  -- CA La Canada Flintridge
    ('2328ad60-8047-43aa-b2e6-f29eebf81dd0'::uuid, '0665042', 'census-pep-162-exact'),  -- CA San Buenaventura
    ('9098e5e2-3e0f-401c-986e-7c00d0ed75f3'::uuid, '1234132', 'census-pep-162-exact'),  -- FL Islamorada
    ('ac949546-e3e0-4710-a351-d3c1c67787d5'::uuid, '1319000', 'census-pep-162-exact'),  -- GA Columbus-Muscogee
    ('1065bf9d-1851-4e39-9ba7-f1e25ccafe87'::uuid, '1857978', 'census-pep-162-exact'),  -- IN Parker
    ('2bcd7cf0-a62d-4d6f-a97c-fdb1fbede3ae'::uuid, '1876256', 'census-pep-162-exact'),  -- IN Pines
    ('4caac16d-b090-4c9b-b528-f27696e33c1f'::uuid, '1884806', 'census-pep-162-exact'),  -- IN Windfall
    ('436cacc6-631c-4cfa-913d-1cb5707c4798'::uuid, '2146027', 'census-pep-162-exact'),  -- KY Lexington-Fayette
    ('be552289-da2b-4b7d-851f-b798d42371ef'::uuid, '2767130', 'census-pep-162-exact'),  -- MN Minnetonka Beach
    ('5ceee4eb-d037-42b5-8932-9d59bd0cbad4'::uuid, '2756680', 'census-pep-162-exact'),  -- MN Saint Anthony
    ('999ca783-3d45-4105-b852-84167e2d1917'::uuid, '2756698', 'census-pep-162-exact'),  -- MN Saint Anthony [Stearns]
    ('6619d441-5c53-4378-9653-5282ba282c46'::uuid, '4752006', 'census-pep-162-exact')   -- TN Nashville-Davidson
  ) AS v(id, geoid, basis)
 WHERE m.id = v.id;

DO $$
DECLARE
  n int;
BEGIN
  -- Exactly 14 rows, and each must have actually been NULL before this ran.
  SELECT count(*) INTO n FROM treasury.municipalities
   WHERE geoid IN ('0601514','0622300','0639003','0665042','1234132','1319000','1857978',
                   '1876256','1884806','2146027','2767130','2756680','2756698','4752006');
  IF n <> 14 THEN
    RAISE EXCEPTION 'expected 14 rows carrying the new geoids, found %', n;
  END IF;

  -- ⚠⚠ THE CHECK THAT MATTERS. A duplicate geoid means two TT rows claim the
  -- same government — invisible to a length check, a basis check or a row
  -- count, and the only check that caught Elizabeth/Elizabethtown, the two
  -- Franklins, and Marine on Saint Croix.
  SELECT count(*) INTO n FROM (
    SELECT geoid FROM treasury.municipalities
     WHERE geoid IS NOT NULL GROUP BY geoid HAVING count(*) > 1
  ) d;
  IF n <> 0 THEN
    RAISE EXCEPTION '% duplicate geoid(s) after this migration', n;
  END IF;

  -- Length must agree with the layer the value came from. All 14 are SUMLEV
  -- 162 place rows, so all 14 are 7 digits.
  SELECT count(*) INTO n FROM treasury.municipalities
   WHERE geoid_basis = 'census-pep-162-exact' AND length(geoid) <> 7;
  IF n <> 0 THEN
    RAISE EXCEPTION '% place-basis geoid(s) are not 7 digits', n;
  END IF;

  -- geoid and geoid_basis are set together or not at all.
  SELECT count(*) INTO n FROM treasury.municipalities
   WHERE (geoid IS NULL) <> (geoid_basis IS NULL);
  IF n <> 0 THEN
    RAISE EXCEPTION '% row(s) with geoid and geoid_basis unpaired', n;
  END IF;
END $$;
