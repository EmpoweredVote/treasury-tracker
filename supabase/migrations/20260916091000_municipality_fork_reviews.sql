-- Adjudications of suspected forked cities.
--
-- A pair reported by treasury.detect_forked_entities() is one of two things,
-- and only a human can tell which:
--
--   alias     ONE city held as TWO entities. Write the municipality_aliases row
--             so the old spelling resolves, then merge the entities deliberately
--             — following 20260914000000's pattern of asserting the four CASCADE
--             children are empty before deleting.
--
--   distinct  TWO governments that merely look alike. The detector stops
--             reporting the pair, so that a ZERO RESULT KEEPS MEANING SOMETHING.
--
-- ⚠ That second status is load-bearing. Ten pairs in the live table look like
-- forks by name and population alone and are nothing of the kind — Bell and
-- Bell Gardens, Avon and Avon Lake, Braddock and Braddock Hills. The five-signal
-- detector already excludes them on their overlapping year ranges, but any pair
-- it does surface and a human clears must stay cleared, or the check decays into
-- noise and gets ignored.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

CREATE TABLE IF NOT EXISTS treasury.municipality_fork_reviews (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name text        NOT NULL,
  state          text        NOT NULL,
  entity_type    text        NOT NULL,
  population     integer,
  suspected_id   uuid        REFERENCES treasury.municipalities(id) ON DELETE SET NULL,
  source         text,
  status         text        NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'alias', 'distinct')),
  resolved_by    text,
  resolved_at    timestamptz,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- A repeated load re-hits the same row rather than piling up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS municipality_fork_reviews_candidate_uniq
  ON treasury.municipality_fork_reviews (lower(candidate_name), state, entity_type);

COMMENT ON TABLE treasury.municipality_fork_reviews IS
  'Adjudicated fork candidates. status=alias means one city (write a municipality_aliases row and merge deliberately); status=distinct means two governments, and detect_forked_entities() stops reporting the pair.';

GRANT SELECT ON treasury.municipality_fork_reviews TO service_role;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE bad int := 0;
BEGIN
  -- The status vocabulary must be closed. A typo'd status that silently stored
  -- would leave a pair neither reported nor resolved.
  BEGIN
    INSERT INTO treasury.municipality_fork_reviews
      (candidate_name, state, entity_type, status)
    VALUES ('Self Test Town', 'ZZ', 'city', 'not-a-valid-status');
    bad := bad + 1;
    RAISE WARNING 'the status CHECK did not reject an invalid value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  DELETE FROM treasury.municipality_fork_reviews WHERE state = 'ZZ';

  IF bad > 0 THEN
    RAISE EXCEPTION 'municipality_fork_reviews: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — review queue created, status constrained to open/alias/distinct';
END $$;
