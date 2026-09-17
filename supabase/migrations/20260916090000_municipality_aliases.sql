-- Alternate published names for a municipality.
--
-- ── WHY ────────────────────────────────────────────────────────────────────
--
-- Loaders establish entity identity BY PUBLISHED NAME. When a publisher changes
-- the name it prints, the lookup misses, a SECOND entity is created, and every
-- year from that point lands on the new row — severing the city's history. It
-- has happened twice, both from the Minnesota Office of the State Auditor:
--
--   2026-09-14  Marine on Saint Croix / Marine On Saint Croix   "on" -> "On"
--   2026-09-15  Birchwood            / Birchwood Village        a word added
--
-- Nothing fails when it happens. Both halves carry honest publisher data, every
-- total ties, and EACH HALF LOOKS COMPLETE.
--
-- This table absorbs a rename once it has been adjudicated: the old spelling
-- resolves to the surviving entity, permanently.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

CREATE TABLE IF NOT EXISTS treasury.municipality_aliases (
  municipality_id   uuid        NOT NULL REFERENCES treasury.municipalities(id) ON DELETE CASCADE,
  alias_name        text        NOT NULL,
  state             text        NOT NULL,
  entity_type       text        NOT NULL,
  source            text,
  source_entity_key text,
  note              text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (municipality_id, alias_name)
);

-- One spelling maps to one government.
CREATE UNIQUE INDEX IF NOT EXISTS municipality_aliases_name_ci_uniq
  ON treasury.municipality_aliases (lower(alias_name), state, entity_type);

-- ⭐ Approach C lands here with no further schema work: a loader that knows its
-- publisher's own stable unit id writes it, and lookup keys on that instead of
-- on the name. That is the only mechanism that PREVENTS a fork rather than
-- catching it — see the design's "What this buys, stated honestly".
CREATE UNIQUE INDEX IF NOT EXISTS municipality_aliases_source_key_uniq
  ON treasury.municipality_aliases (source, source_entity_key)
  WHERE source_entity_key IS NOT NULL;

-- ⚠⚠ A NAME IS EITHER AN ENTITY OR AN ALIAS, NEVER BOTH. No cross-table
-- constraint can express that, so it is a trigger. Without it an alias could
-- shadow a real entity and silently redirect its loads to a different city —
-- a worse failure than the one this design exists to prevent.
CREATE OR REPLACE FUNCTION treasury.guard_alias_is_not_an_entity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM treasury.municipalities m
     WHERE lower(m.name) = lower(NEW.alias_name)
       AND m.state = NEW.state
       AND m.entity_type = NEW.entity_type
  ) THEN
    RAISE EXCEPTION
      'alias "%" (%/%) is already a municipality name — a name is an entity or an alias, never both',
      NEW.alias_name, NEW.state, NEW.entity_type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS municipality_aliases_not_an_entity ON treasury.municipality_aliases;
CREATE TRIGGER municipality_aliases_not_an_entity
  BEFORE INSERT OR UPDATE ON treasury.municipality_aliases
  FOR EACH ROW EXECUTE FUNCTION treasury.guard_alias_is_not_an_entity();

COMMENT ON TABLE treasury.municipality_aliases IS
  'Alternate published names that resolve to an existing municipality. Consulted by treasury_ensure_municipality before it creates anything. source_entity_key carries a publisher''s own stable unit id where one exists.';

GRANT SELECT ON treasury.municipality_aliases TO service_role;

-- ── Self-verification: prove the behaviour, do not assert it ───────────────
DO $$
DECLARE
  probe_id uuid; probe_name text; probe_state text; probe_type text;
  bad int := 0;
BEGIN
  SELECT id, name, state, entity_type
    INTO probe_id, probe_name, probe_state, probe_type
    FROM treasury.municipalities
   WHERE entity_type = 'city'
   ORDER BY id LIMIT 1;

  -- An alias that duplicates a real entity name must be REJECTED.
  BEGIN
    INSERT INTO treasury.municipality_aliases
      (municipality_id, alias_name, state, entity_type, note)
    VALUES (probe_id, probe_name, probe_state, probe_type, 'self-test, must fail');
    bad := bad + 1;
    RAISE WARNING 'an alias shadowing an entity name was ACCEPTED';
    DELETE FROM treasury.municipality_aliases
     WHERE municipality_id = probe_id AND alias_name = probe_name;
  EXCEPTION WHEN others THEN NULL;
  END;

  IF bad > 0 THEN
    RAISE EXCEPTION 'municipality_aliases: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — aliases table created; an alias cannot shadow an entity name';
END $$;
