-- The five-signal fork rule, as a function.
--
-- Moved out of scripts/detectForkedEntities.sql so that the file and the
-- loaders that call it share ONE implementation and cannot drift — the same
-- reasoning that put `toSlug` in one module shared by the writer and reader of
-- a link.
--
-- ── ⚠⚠ THIS RULE IS ONLY USABLE AFTER BUDGETS EXIST ────────────────────────
--
-- Three of its five signals — one shared publisher, non-overlapping adjacent
-- year ranges — come from the budgets table. An INSERT-time version of this
-- check was written, measured against the live table, and abandoned: ten
-- existing pairs satisfied the name-and-population half of the rule and ALL TEN
-- were distinct governments.
--
--   CA Bell/Bell Gardens      CA Chino/Chino Hills
--   OH Avon/Avon Lake         OH Bedford/Bedford Heights
--   PA Braddock/Braddock Hills   PA Langhorne/Langhorne Manor
--   IN Warren/Warren Park     MN Madison/Madison Lake
--   FL Lake City/Lake Mary    MN Pine City/Pine Island
--
-- A 100% false-positive rate. The problem is TIMING, not threshold: at INSERT
-- the new entity has no budgets, so the temporal signature that actually
-- identifies a rename does not exist yet. Those ten pairs are asserted below as
-- a permanent regression test so the rejected rule cannot creep back.
--
-- ⚠ Known normaliser artifact, harmless HERE: stripping the trailing designator
-- turns "Lake City" into "lake" and "Pine City" into "pine", which prefix-match
-- every "Lake ..." and "Pine ..." in the state. Those pairs have OVERLAPPING
-- year ranges and are excluded on that signal — which is itself the argument
-- for needing all five.
--
-- Design: docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md

-- ⚠ A NAMED COMPOSITE TYPE, not RETURNS TABLE. A `public` wrapper is added in a
-- later migration so PostgREST can reach this, and a wrapper needs
-- `RETURNS SETOF <type>` — an inline TABLE(...) signature cannot be referenced
-- from another function.
DROP TYPE IF EXISTS treasury.municipality_fork_pair CASCADE;
CREATE TYPE treasury.municipality_fork_pair AS (
  state text, entity_type text,
  name_a text, id_a uuid, years_a text, pop_a int, geoid_a text,
  name_b text, id_b uuid, years_b text, pop_b int, geoid_b text,
  year_gap int, name_sim numeric, shared_source text
);

CREATE OR REPLACE FUNCTION treasury.detect_forked_entities()
RETURNS SETOF treasury.municipality_fork_pair
LANGUAGE sql
STABLE
AS $$
  with core as (
    select m.id, m.name, m.state, m.entity_type, m.population, m.geoid,
           regexp_replace(lower(extensions.unaccent(m.name)), '[^a-z0-9]+', ' ', 'g') as n0,
           btrim(regexp_replace(
             regexp_replace(
               btrim(regexp_replace(lower(extensions.unaccent(m.name)), '[^a-z0-9]+', ' ', 'g')),
               '\s+(city|town|township|village|borough|municipality|urban county|county)$', '', 'g'),
             '^(city|town|village|borough|township) of\s+', '', 'g')) as core_name
    from treasury.municipalities m
    where m.entity_type in ('state','county','township','city','town',
                            'village','borough','municipality')
  ),
  span as (
    select b.municipality_id as id,
           min(b.fiscal_year) as lo, max(b.fiscal_year) as hi,
           count(distinct b.data_source) as n_src, min(b.data_source) as src
    from treasury.budgets b
    group by b.municipality_id
  )
  select a.state, a.entity_type,
         a.name, a.id, sa.lo || '-' || sa.hi, a.population, a.geoid,
         b.name, b.id, sb.lo || '-' || sb.hi, b.population, b.geoid,
         (case when sa.hi < sb.lo then sb.lo - sa.hi - 1 else sa.lo - sb.hi - 1 end)::int,
         round(extensions.similarity(a.core_name, b.core_name)::numeric, 2),
         left(sa.src, 60)
  from core a
  join span sa on sa.id = a.id
  join core b on b.state = a.state and b.id > a.id and b.entity_type = a.entity_type
  join span sb on sb.id = b.id
  where sa.n_src = 1 and sb.n_src = 1 and sa.src = sb.src
    and (sa.hi < sb.lo or sb.hi < sa.lo)
    and (case when sa.hi < sb.lo then sb.lo - sa.hi - 1 else sa.lo - sb.hi - 1 end) <= 1
    and (a.core_name = b.core_name
         or b.n0 like a.n0 || ' %' or a.n0 like b.n0 || ' %'
         or extensions.similarity(a.core_name, b.core_name) >= 0.55)
    and (a.population is null or b.population is null
         or a.population = 0 or b.population = 0
         or abs(a.population - b.population)::numeric
            / greatest(a.population, b.population) <= 0.25)
    and (a.geoid is null or b.geoid is null or a.geoid = b.geoid)
    -- ⭐ an adjudicated 'distinct' pair is suppressed permanently, so that a
    -- zero result keeps meaning something
    and not exists (
      select 1 from treasury.municipality_fork_reviews r
       where r.status = 'distinct'
         and r.state = a.state and r.entity_type = a.entity_type
         and lower(r.candidate_name) in (lower(a.name), lower(b.name))
    )
  order by 14 desc, 1, 3;
$$;

COMMENT ON FUNCTION treasury.detect_forked_entities() IS
  'Cities TT may hold as two entities after a publisher rename. Five signals, all required; only usable after budgets exist. Run at the end of every load via assertNoNewForks().';

GRANT EXECUTE ON FUNCTION treasury.detect_forked_entities() TO service_role;

-- ── Self-verification: fire on the real fork, stay silent on the ten ───────
--
-- ⚠ An empty result from an unvalidated check proves nothing. This rebuilds the
-- Birchwood fork that actually happened, asserts the rule reports exactly it,
-- then undoes the probe. The whole migration is one transaction, so a failure
-- anywhere rolls the probe back with it.
DO $$
DECLARE
  keep_id  uuid;
  probe_id uuid := '00000000-dead-4bee-8000-00000000000a';
  hits int;
  bad  int := 0;
BEGIN
  SELECT count(*) INTO hits FROM treasury.detect_forked_entities();
  IF hits <> 0 THEN
    bad := bad + 1;
    RAISE WARNING 'detector is not clean BEFORE the probe: % row(s)', hits;
  END IF;

  SELECT id INTO STRICT keep_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';

  CREATE TEMP TABLE probe_row ON COMMIT DROP AS
    SELECT * FROM treasury.municipalities WHERE id = keep_id;
  UPDATE probe_row SET id = probe_id, name = 'Birchwood',
                       population = 863, geoid = NULL, geoid_basis = NULL;
  INSERT INTO treasury.municipalities SELECT * FROM probe_row;
  UPDATE treasury.budgets SET municipality_id = probe_id
   WHERE municipality_id = keep_id AND fiscal_year <= 2020;

  SELECT count(*) INTO hits FROM treasury.detect_forked_entities()
   WHERE state = 'MN'
     AND (lower(name_a) LIKE 'birchwood%' OR lower(name_b) LIKE 'birchwood%');
  IF hits <> 1 THEN
    bad := bad + 1;
    RAISE WARNING 'detector found % Birchwood pair(s), expected exactly 1', hits;
  END IF;

  -- ⚠ THE REGRESSION THAT KILLED THE INSERT-TIME RULE.
  SELECT count(*) INTO hits FROM treasury.detect_forked_entities()
   WHERE (name_a, name_b) IN (
     ('Bell','Bell Gardens'), ('Chino','Chino Hills'),
     ('Avon','Avon Lake'), ('Bedford','Bedford Heights'),
     ('Braddock','Braddock Hills'), ('Langhorne','Langhorne Manor'),
     ('Warren','Warren Park'), ('Madison','Madison Lake'),
     ('Lake City','Lake Mary'), ('Pine City','Pine Island'));
  IF hits <> 0 THEN
    bad := bad + 1;
    RAISE WARNING '% known-distinct pair(s) were reported as forks', hits;
  END IF;

  -- Undo the probe.
  UPDATE treasury.budgets SET municipality_id = keep_id WHERE municipality_id = probe_id;
  DELETE FROM treasury.municipalities WHERE id = probe_id;

  SELECT count(*) INTO hits FROM treasury.detect_forked_entities();
  IF hits <> 0 THEN
    bad := bad + 1;
    RAISE WARNING 'detector not clean AFTER cleanup: % row(s)', hits;
  END IF;
  IF EXISTS (SELECT 1 FROM treasury.municipalities WHERE id = probe_id) THEN
    bad := bad + 1; RAISE WARNING 'the probe row leaked';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'detect_forked_entities: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — fires on the real Birchwood fork, silent on the ten known-distinct pairs, no leaks';
END $$;
