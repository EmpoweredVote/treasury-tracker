-- Civic Spaces Asks 1+2: a Census FIPS geoid on every geographic TT entity.
--
-- ⚠ `text`, not a number: '01073' is Jefferson County, AL, and an integer
--    column eats the leading zero silently.
-- ⚠ NULLABLE with NO DEFAULT. A NOT NULL DEFAULT on a column meaning "we know
--    this" is the fiscal_year_start_month defect — it would assert a geoid TT
--    never derived, on every row, and nothing would fail.
-- ⚠ geoid and geoid_basis travel together. A value with no provenance cannot
--    be told apart from a guess later.

ALTER TABLE treasury.municipalities ADD COLUMN IF NOT EXISTS geoid text;
ALTER TABLE treasury.municipalities ADD COLUMN IF NOT EXISTS geoid_basis text;

COMMENT ON COLUMN treasury.municipalities.geoid IS
  'Census FIPS geoid. Length is tier-determined: state 2, county 5, place-tier 7, township 10 (county-subdivision). NULL means TT could not derive one with confidence — never a guess.';
COMMENT ON COLUMN treasury.municipalities.geoid_basis IS
  'How the geoid was derived: static-state-fips | census-pep-050-exact | census-pep-162-exact | census-pep-061-county-scoped.';

-- Length is a function of the tier, so a wrong-length value cannot be stored.
-- ELSE -1 means any geoid on a non-geographic entity_type (federal, nonprofit,
-- special_district, school_district, conservancy, library) is rejected.
ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_geoid_shape;
ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_geoid_shape CHECK (
    geoid IS NULL OR (
      geoid ~ '^[0-9]+$'
      AND length(geoid) = CASE entity_type
        WHEN 'state'        THEN 2
        WHEN 'county'       THEN 5
        WHEN 'township'     THEN 10
        WHEN 'city'         THEN 7
        WHEN 'town'         THEN 7
        WHEN 'village'      THEN 7
        WHEN 'borough'      THEN 7
        WHEN 'municipality' THEN 7
        ELSE -1
      END
    )
  );

ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_geoid_basis_paired;
ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_geoid_basis_paired CHECK (
    (geoid IS NULL) = (geoid_basis IS NULL)
  );

CREATE INDEX IF NOT EXISTS municipalities_geoid_idx
  ON treasury.municipalities (geoid) WHERE geoid IS NOT NULL;

-- Self-verification: prove the constraints actually reject what they must.
DO $$
DECLARE bad int := 0; tid uuid;
BEGIN
  SELECT id INTO tid FROM treasury.municipalities WHERE entity_type = 'county' LIMIT 1;

  BEGIN -- a 7-digit place geoid on a county must be rejected
    UPDATE treasury.municipalities SET geoid = '1805860', geoid_basis = 'census-pep-162-exact' WHERE id = tid;
    bad := bad + 1; RAISE WARNING 'CHECK did not reject a 7-digit geoid on a county';
    UPDATE treasury.municipalities SET geoid = NULL, geoid_basis = NULL WHERE id = tid;
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN -- geoid without a basis must be rejected
    UPDATE treasury.municipalities SET geoid = '18105', geoid_basis = NULL WHERE id = tid;
    bad := bad + 1; RAISE WARNING 'CHECK did not reject a geoid with no basis';
    UPDATE treasury.municipalities SET geoid = NULL WHERE id = tid;
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN -- a geoid on a non-geographic type must be rejected
    UPDATE treasury.municipalities SET geoid = '1805860', geoid_basis = 'census-pep-162-exact'
      WHERE entity_type = 'federal';
    bad := bad + 1; RAISE WARNING 'CHECK did not reject a geoid on entity_type federal';
    UPDATE treasury.municipalities SET geoid = NULL, geoid_basis = NULL WHERE entity_type = 'federal';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  IF bad > 0 THEN
    RAISE EXCEPTION 'municipalities geoid migration: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — geoid/geoid_basis added; tier-keyed length CHECK and pairing CHECK both reject bad values';
END $$;
