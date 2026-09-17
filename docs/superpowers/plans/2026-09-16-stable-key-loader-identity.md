# Stable-Key Loader Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a publisher's rename from silently creating a second entity and severing a city's budget history — by absorbing known renames through aliases, and failing any load that creates a new fork.

**Architecture:** A `municipality_aliases` table resolves known renames inside `treasury_ensure_municipality`. The five-signal fork detector becomes a set-returning function that every loader runs before reporting success, so a new fork fails the run that created it. Adjudications live in `municipality_fork_reviews`; `distinct` suppresses a pair permanently so a zero result keeps meaning something.

**Tech Stack:** PostgreSQL 15 (Supabase), plpgsql, Node ESM scripts, vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md`

## Global Constraints

- **Never rename an existing entity on load.** `?entity=` slugs derive from `name`; rewriting it invalidates every shared link. Applies to alias hits too.
- **No insert-time blocking.** Measured and rejected: ten existing pairs (`Bell`/`Bell Gardens`, `Avon`/`Avon Lake`, …) satisfy the containment rule and all ten are distinct governments. At `INSERT` the new entity has no budgets, so the temporal signal that identifies a real fork does not exist yet.
- **One implementation of the fork rule.** It lives in `treasury.detect_forked_entities()`; the `.sql` file and the loaders both call it. Two copies would drift.
- **Migrations self-verify** with a `DO $$` block that probes real rows, counts before/after, accumulates `bad`, and `RAISE EXCEPTION`s — the pattern in `20260914000100_municipality_name_match_case_insensitive.sql`.
- **CI runs no database.** SQL proof lives in migration self-verification; vitest covers pure JS only.
- **Apply with `mcp__supabase-local__apply_migration`, then verify independently** with a separate `execute_sql` read. Never trust a migration's own success report alone.
- **Do not use a git worktree.** `.env` is gitignored, so a worktree cannot run the scripts. Work on a branch in the main checkout.
- Run scripts as `node --env-file=.env <script>`; `dotenv` is not installed.
- Migration filenames follow `YYYYMMDDHHMMSS_name.sql`.

## Task Order And Why It Matters

**Aliases are seeded (Task 4) as early as they can be**, because the seed closes
a hole that is open right now: both merges deleted a row whose name the
publisher has already printed, so a republished FY2012-2020 figure under
`Birchwood` would re-fork the city merged in #185.

**Loaders gain the check (Task 6) only after the detector function exists
(Task 3)** and after the helper wraps it (Task 5).

---

### Task 1: Alias table and mutual exclusion

**Files:**
- Create: `supabase/migrations/20260916090000_municipality_aliases.sql`

**Interfaces:**
- Produces: table `treasury.municipality_aliases(municipality_id, alias_name, state, entity_type, source, source_entity_key, note, created_at)`; trigger `municipality_aliases_not_an_entity`

- [ ] **Step 1: Write the migration**

```sql
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

-- Approach C lands here with no further schema work: a loader that knows its
-- publisher's stable unit id writes it, and lookup keys on that instead of name.
CREATE UNIQUE INDEX IF NOT EXISTS municipality_aliases_source_key_uniq
  ON treasury.municipality_aliases (source, source_entity_key)
  WHERE source_entity_key IS NOT NULL;

-- ⚠⚠ A name is either an entity or an alias, NEVER both. No cross-table
-- constraint can express that, so it is a trigger. Without it an alias could
-- shadow a real entity and silently redirect its loads — worse than the defect
-- this design exists to fix.
CREATE OR REPLACE FUNCTION treasury.guard_alias_is_not_an_entity()
RETURNS trigger LANGUAGE plpgsql AS $$
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

GRANT SELECT ON treasury.municipality_aliases TO service_role;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE probe_id uuid; probe_name text; probe_state text; probe_type text; bad int := 0;
BEGIN
  SELECT id, name, state, entity_type
    INTO probe_id, probe_name, probe_state, probe_type
    FROM treasury.municipalities WHERE entity_type = 'city' ORDER BY id LIMIT 1;

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

  IF bad > 0 THEN RAISE EXCEPTION 'municipality_aliases: % checks failed', bad; END IF;
  RAISE NOTICE 'OK — aliases table created; an alias cannot shadow an entity name';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `municipality_aliases`.
Expected: `{"success": true}`.

- [ ] **Step 3: Verify independently**

```sql
select (select count(*) from treasury.municipality_aliases) as alias_rows,
       (select count(*) from pg_trigger where tgname = 'municipality_aliases_not_an_entity') as guard_present;
```

Expected: `alias_rows = 0`, `guard_present = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916090000_municipality_aliases.sql
git commit -m "feat(db): municipality_aliases table, with alias/entity mutual exclusion"
```

---

### Task 2: Fork review queue

**Files:**
- Create: `supabase/migrations/20260916091000_municipality_fork_reviews.sql`

**Interfaces:**
- Produces: table `treasury.municipality_fork_reviews(id, candidate_name, state, entity_type, population, suspected_id, source, status, resolved_by, resolved_at, note, created_at)`. Task 3 reads `status='distinct'` to suppress pairs.

- [ ] **Step 1: Write the migration**

```sql
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

CREATE UNIQUE INDEX IF NOT EXISTS municipality_fork_reviews_candidate_uniq
  ON treasury.municipality_fork_reviews (lower(candidate_name), state, entity_type);

COMMENT ON TABLE treasury.municipality_fork_reviews IS
  'Adjudicated fork candidates. status=alias means one city (write a municipality_aliases row and merge deliberately); status=distinct means two governments, and the detector stops reporting the pair.';

GRANT SELECT ON treasury.municipality_fork_reviews TO service_role;

DO $$
DECLARE bad int := 0;
BEGIN
  BEGIN
    INSERT INTO treasury.municipality_fork_reviews (candidate_name, state, entity_type, status)
    VALUES ('Self Test Town', 'ZZ', 'city', 'not-a-valid-status');
    bad := bad + 1; RAISE WARNING 'the status CHECK did not reject an invalid value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  DELETE FROM treasury.municipality_fork_reviews WHERE state = 'ZZ';
  IF bad > 0 THEN RAISE EXCEPTION 'municipality_fork_reviews: % checks failed', bad; END IF;
  RAISE NOTICE 'OK — review queue created, status constrained to open/alias/distinct';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `municipality_fork_reviews`.

- [ ] **Step 3: Verify independently**

```sql
select count(*) as reviews from treasury.municipality_fork_reviews;
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916091000_municipality_fork_reviews.sql
git commit -m "feat(db): municipality_fork_reviews adjudication queue"
```

---

### Task 3: The detector becomes a function

**Files:**
- Create: `supabase/migrations/20260916092000_detect_forked_entities_fn.sql`
- Modify: `scripts/detectForkedEntities.sql` (replace the query body with a call)

**Interfaces:**
- Consumes: `treasury.municipality_fork_reviews` (Task 2)
- Produces: `treasury.detect_forked_entities()` returning `(state text, entity_type text, name_a text, id_a uuid, years_a text, pop_a int, geoid_a text, name_b text, id_b uuid, years_b text, pop_b int, geoid_b text, year_gap int, name_sim numeric, shared_source text)`

- [ ] **Step 1: Write the migration**

```sql
-- The five-signal fork rule, moved out of scripts/detectForkedEntities.sql so
-- that the file and the loaders share ONE implementation and cannot drift.
--
-- ⚠⚠ THIS RULE IS ONLY USABLE AFTER BUDGETS EXIST. Three of its five signals —
-- one shared publisher, non-overlapping adjacent year ranges — come from the
-- budgets table. An insert-time version of this check was measured against the
-- live table and abandoned: ten existing pairs satisfied the name-and-
-- population half of the rule and ALL TEN were distinct governments
-- (Bell/Bell Gardens, Avon/Avon Lake, Braddock/Braddock Hills, ...).
--
-- ⚠ Known normaliser artifact, harmless here: stripping the trailing
-- designator turns "Lake City" into "lake" and "Pine City" into "pine", which
-- prefix-match every "Lake ..." and "Pine ..." in the state. Those pairs have
-- OVERLAPPING year ranges and are excluded on that signal, which is exactly why
-- the rule needs all five and an insert-time rule could not work.
-- ⚠ A NAMED COMPOSITE TYPE, not RETURNS TABLE. Task 5 adds a `public` wrapper
-- so PostgREST can call this, and a wrapper needs `RETURNS SETOF <type>` — an
-- inline TABLE(...) signature cannot be referenced from another function.
-- Declaring it here avoids rewriting this function later.
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
    -- an adjudicated 'distinct' pair is suppressed permanently, so that a zero
    -- result keeps meaning something
    and not exists (
      select 1 from treasury.municipality_fork_reviews r
       where r.status = 'distinct'
         and r.state = a.state and r.entity_type = a.entity_type
         and lower(r.candidate_name) in (lower(a.name), lower(b.name))
    )
  order by 14 desc, 1, 3;
$$;

GRANT EXECUTE ON FUNCTION treasury.detect_forked_entities() TO service_role;

-- ── Self-verification: the rule must fire on a real fork and not on the ten ──
DO $$
DECLARE
  keep_id uuid; probe_id uuid := '00000000-dead-4bee-8000-00000000000a';
  hits int; bad int := 0;
BEGIN
  -- Clean on production before we touch anything.
  SELECT count(*) INTO hits FROM treasury.detect_forked_entities();
  IF hits <> 0 THEN
    bad := bad + 1; RAISE WARNING 'detector is not clean before the probe: % row(s)', hits;
  END IF;

  -- Rebuild the Birchwood fork: copy the survivor, rename, strip geoid, and
  -- hand it back the FY2012-2020 budgets.
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
   WHERE state = 'MN' AND (lower(name_a) LIKE 'birchwood%' OR lower(name_b) LIKE 'birchwood%');
  IF hits <> 1 THEN
    bad := bad + 1; RAISE WARNING 'detector found % Birchwood pair(s), expected 1', hits;
  END IF;

  -- ⚠ THE REGRESSION THAT KILLED THE INSERT-TIME RULE. These ten pairs are
  -- distinct governments and must never be reported.
  SELECT count(*) INTO hits FROM treasury.detect_forked_entities()
   WHERE (name_a, name_b) IN (
     ('Bell','Bell Gardens'), ('Chino','Chino Hills'),
     ('Avon','Avon Lake'), ('Bedford','Bedford Heights'),
     ('Braddock','Braddock Hills'), ('Langhorne','Langhorne Manor'),
     ('Warren','Warren Park'), ('Madison','Madison Lake'),
     ('Lake City','Lake Mary'), ('Pine City','Pine Island'));
  IF hits <> 0 THEN
    bad := bad + 1; RAISE WARNING '% known-distinct pair(s) were reported as forks', hits;
  END IF;

  -- Undo the probe.
  UPDATE treasury.budgets SET municipality_id = keep_id WHERE municipality_id = probe_id;
  DELETE FROM treasury.municipalities WHERE id = probe_id;

  SELECT count(*) INTO hits FROM treasury.detect_forked_entities();
  IF hits <> 0 THEN
    bad := bad + 1; RAISE WARNING 'detector not clean after cleanup: % row(s)', hits;
  END IF;
  IF EXISTS (SELECT 1 FROM treasury.municipalities WHERE id = probe_id) THEN
    bad := bad + 1; RAISE WARNING 'the probe row leaked';
  END IF;

  IF bad > 0 THEN RAISE EXCEPTION 'detect_forked_entities: % checks failed', bad; END IF;
  RAISE NOTICE 'OK — fires on the real Birchwood fork, silent on the ten known-distinct pairs, no leaks';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `detect_forked_entities_fn`.
Expected: `{"success": true}`. **A failure here means the probe may have leaked — run Step 3 before anything else.**

- [ ] **Step 3: Verify independently**

```sql
select (select count(*) from treasury.detect_forked_entities()) as forks,
       (select count(*) from treasury.municipalities) as total_rows,
       (select count(*) from treasury.budgets
         where municipality_id = (select id from treasury.municipalities
                                   where state='MN' and lower(name)='birchwood village')) as birchwood_budgets;
```

Expected: `forks = 0`, `total_rows = 8182`, `birchwood_budgets = 24`.

- [ ] **Step 4: Point the .sql file at the function**

Replace everything in `scripts/detectForkedEntities.sql` from the `with geo as (` line to the end of the file with:

```sql
SELECT * FROM treasury.detect_forked_entities();
```

Keep the entire comment header — it is the record of why the rule exists — and
add one line to it:

```sql
-- ⚠ The rule itself now lives in treasury.detect_forked_entities() so that this
-- file and the loaders that call it cannot drift. Migration
-- 20260916092000_detect_forked_entities_fn.sql.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916092000_detect_forked_entities_fn.sql scripts/detectForkedEntities.sql
git commit -m "refactor(db): fork rule becomes a function so callers cannot drift"
```

---

### Task 4: Alias lookup in the RPC, and seed the historical aliases

**Files:**
- Create: `supabase/migrations/20260916093000_ensure_municipality_alias_lookup.sql`
- Create: `supabase/migrations/20260916094000_seed_historical_aliases.sql`

**Interfaces:**
- Consumes: `treasury.municipality_aliases` (Task 1)
- Produces: `public.treasury_ensure_municipality(p_name text, p_state text, p_entity_type text DEFAULT 'city', p_population integer DEFAULT 0, p_source text DEFAULT NULL, p_source_entity_key text DEFAULT NULL) RETURNS uuid`

- [ ] **Step 1: Write the lookup migration**

```sql
-- ⚠⚠ ADDING PARAMETERS CREATES AN OVERLOAD, IT DOES NOT REPLACE.
-- `CREATE OR REPLACE FUNCTION` matches on the argument list, so the 4-argument
-- function would survive alongside the 6-argument one and PostgREST could pick
-- either. Drop the old signature explicitly. Callers use NAMED parameters, so
-- existing 4-argument call sites resolve against the new defaults unchanged.
DROP FUNCTION IF EXISTS public.treasury_ensure_municipality(text, text, text, integer);

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
DECLARE v_id uuid;
BEGIN
  -- 1. Approach C: the publisher's own stable key wins when supplied.
  IF p_source IS NOT NULL AND p_source_entity_key IS NOT NULL THEN
    SELECT municipality_id INTO v_id FROM treasury.municipality_aliases
     WHERE source = p_source AND source_entity_key = p_source_entity_key;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  -- 2. Today's behaviour: case-insensitive name match.
  SELECT id INTO v_id FROM treasury.municipalities
   WHERE lower(name) = lower(p_name) AND state = p_state AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  -- 3. New: a known rename resolves to the entity it renamed.
  -- ⚠ Resolving through an alias must NEVER rename the entity. The `?entity=`
  -- slug derives from `name`; rewriting it invalidates every shared link.
  SELECT municipality_id INTO v_id FROM treasury.municipality_aliases
   WHERE lower(alias_name) = lower(p_name) AND state = p_state AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  INSERT INTO treasury.municipalities (name, state, entity_type, population)
  VALUES (p_name, p_state, p_entity_type, p_population)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE
  probe_id uuid; probe_name text; probe_state text; probe_type text;
  returned_id uuid; rows_before int; rows_after int; bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;
  SELECT id, name, state, entity_type INTO probe_id, probe_name, probe_state, probe_type
    FROM treasury.municipalities WHERE entity_type = 'city' ORDER BY id LIMIT 1;

  returned_id := public.treasury_ensure_municipality(upper(probe_name), probe_state, probe_type, 0);
  IF returned_id IS DISTINCT FROM probe_id THEN
    bad := bad + 1; RAISE WARNING 'case-variant lookup regressed (#182)';
  END IF;

  INSERT INTO treasury.municipality_aliases
    (municipality_id, alias_name, state, entity_type, note)
  VALUES (probe_id, probe_name || ' Selftest Alias', probe_state, probe_type, 'self-test');

  returned_id := public.treasury_ensure_municipality(
    probe_name || ' Selftest Alias', probe_state, probe_type, 0);
  IF returned_id IS DISTINCT FROM probe_id THEN
    bad := bad + 1; RAISE WARNING 'alias lookup returned %, expected %', returned_id, probe_id;
  END IF;
  IF (SELECT name FROM treasury.municipalities WHERE id = probe_id) <> probe_name THEN
    bad := bad + 1; RAISE WARNING 'resolving through an alias RENAMED the entity';
  END IF;

  DELETE FROM treasury.municipality_aliases
   WHERE municipality_id = probe_id AND alias_name = probe_name || ' Selftest Alias';

  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'lookups created % row(s)', rows_after - rows_before;
  END IF;

  IF bad > 0 THEN RAISE EXCEPTION 'alias lookup: % checks failed', bad; END IF;
  RAISE NOTICE 'OK — aliases resolve, case match intact, nothing renamed, nothing created';
END $$;
```

- [ ] **Step 2: Apply it, and confirm the old overload is gone**

`mcp__supabase-local__apply_migration`, name `ensure_municipality_alias_lookup`. Then:

```sql
select count(*) as overloads,
       max(pg_get_function_identity_arguments(p.oid)) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'treasury_ensure_municipality';
```

Expected: `overloads = 1`, six parameters. **If `overloads = 2` the drop failed and PostgREST may call either — stop and fix before continuing.**

- [ ] **Step 3: Write the seed migration**

```sql
-- ⚠⚠ THIS CLOSES A HOLE THAT IS OPEN RIGHT NOW, it is not tidying.
--
-- #185 and 20260914000000 each deleted a row whose name the publisher HAS
-- ALREADY PRINTED. If MN OSA republishes any FY2012-2020 figure under
-- "Birchwood", today's loader finds no match and CREATES THE ENTITY AGAIN,
-- re-forking the city that was just merged.
--
-- Ids are resolved by name rather than hardcoded, so this fails loudly if the
-- survivor is not where it is expected.
DO $$
DECLARE birchwood_id uuid; marine_id uuid;
BEGIN
  SELECT id INTO STRICT birchwood_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';
  SELECT id INTO STRICT marine_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'marine on saint croix';

  INSERT INTO treasury.municipality_aliases
    (municipality_id, alias_name, state, entity_type, source, note)
  VALUES
    (birchwood_id, 'Birchwood', 'MN', 'city',
     'Minnesota Office of the State Auditor City/County Finances Report',
     'OSA published this spelling through FY2020; merged into Birchwood Village by PR #185.'),
    (marine_id, 'Marine On Saint Croix', 'MN', 'city',
     'Minnesota Office of the State Auditor City/County Finances Report',
     'OSA published this capitalisation FY2014-2023; merged by migration 20260914000000.')
  ON CONFLICT DO NOTHING;
END $$;

DO $$
DECLARE v_id uuid; expect_id uuid; rows_before int; rows_after int; bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;
  SELECT id INTO expect_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';

  v_id := public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863);
  IF v_id IS DISTINCT FROM expect_id THEN
    bad := bad + 1; RAISE WARNING '"Birchwood" resolved to %, expected %', v_id, expect_id;
  END IF;

  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1;
    RAISE WARNING 'the old spelling CREATED % row(s) — the re-fork is still open',
      rows_after - rows_before;
  END IF;

  IF bad > 0 THEN RAISE EXCEPTION 'historical aliases: % checks failed', bad; END IF;
  RAISE NOTICE 'OK — a republished "Birchwood" resolves to Birchwood Village and creates nothing';
END $$;
```

- [ ] **Step 4: Apply and verify independently**

`mcp__supabase-local__apply_migration`, name `seed_historical_aliases`. Then:

```sql
select a.alias_name, m.name as resolves_to
from treasury.municipality_aliases a
join treasury.municipalities m on m.id = a.municipality_id
order by a.alias_name;
```

Expected exactly two rows: `Birchwood → Birchwood Village`, `Marine On Saint Croix → Marine on Saint Croix`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260916093000_ensure_municipality_alias_lookup.sql \
        supabase/migrations/20260916094000_seed_historical_aliases.sql
git commit -m "feat(db): resolve known renames through aliases, and seed the two merged spellings"
```

---

### Task 5: The shared helper

**Files:**
- Create: `scripts/lib/ensureMunicipality.mjs`
- Test: `tests/ensureMunicipality.test.mjs`

**Interfaces:**
- Produces: `ensureMunicipality(db, {name, state, entityType, population, source, sourceEntityKey}) -> Promise<{id: string}>` and `assertNoNewForks(db) -> Promise<void>` (throws, naming both halves)

- [ ] **Step 1: Write the failing test**

```javascript
// tests/ensureMunicipality.test.mjs
import { describe, it, expect } from 'vitest';
import { ensureMunicipality, assertNoNewForks } from '../scripts/lib/ensureMunicipality.mjs';

const fakeDb = (impl) => ({ rpc: async (fn, args) => impl(fn, args) });

describe('ensureMunicipality', () => {
  it('returns the id the RPC resolves', async () => {
    const db = fakeDb(async () => ({ data: 'aaaaaaaa-0000-0000-0000-000000000001', error: null }));
    const out = await ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' });
    expect(out).toEqual({ id: 'aaaaaaaa-0000-0000-0000-000000000001' });
  });

  it('throws on a real error, so a broken load fails loudly', async () => {
    const db = fakeDb(async () => ({ data: null, error: { message: 'connection reset' } }));
    await expect(
      ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' }),
    ).rejects.toThrow(/connection reset/);
  });

  it('throws when the RPC returns no id at all', async () => {
    const db = fakeDb(async () => ({ data: null, error: null }));
    await expect(
      ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' }),
    ).rejects.toThrow(/no id/i);
  });

  it('passes the publisher key through when given', async () => {
    let seen = null;
    const db = fakeDb(async (_fn, args) => { seen = args; return { data: 'id', error: null }; });
    await ensureMunicipality(db, {
      name: 'Anytown', state: 'MN', entityType: 'city',
      source: 'MN OSA', sourceEntityKey: '12345',
    });
    expect(seen.p_source).toBe('MN OSA');
    expect(seen.p_source_entity_key).toBe('12345');
  });
});

describe('assertNoNewForks', () => {
  it('passes when the detector returns nothing', async () => {
    const db = fakeDb(async () => ({ data: [], error: null }));
    await expect(assertNoNewForks(db)).resolves.toBeUndefined();
  });

  it('throws and names both halves when a fork appears', async () => {
    const db = fakeDb(async () => ({
      data: [{ state: 'MN', name_a: 'Birchwood', years_a: '2012-2020',
               name_b: 'Birchwood Village', years_b: '2021-2023' }],
      error: null,
    }));
    await expect(assertNoNewForks(db)).rejects.toThrow(/Birchwood.*Birchwood Village/s);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/ensureMunicipality.test.mjs`
Expected: FAIL — cannot resolve `../scripts/lib/ensureMunicipality.mjs`.

- [ ] **Step 3: Write the helper**

```javascript
// scripts/lib/ensureMunicipality.mjs
/**
 * The one way a loader turns a published name into a TT entity id, and the one
 * way it proves it did not fork a city on the way.
 *
 * ⚠⚠ Loaders establish identity BY NAME. When a publisher changes the name it
 * prints, the lookup misses and a SECOND entity is created, severing the city's
 * history at that year. It has happened twice, both from MN OSA. Nothing fails
 * when it happens: both halves carry honest data and each looks complete.
 *
 * Known renames are absorbed by treasury.municipality_aliases. Unknown ones are
 * caught by assertNoNewForks() at the END of a load — the fork rule needs the
 * budget rows to exist, so it cannot run at insert time. An insert-time version
 * was measured and abandoned: ten existing pairs tripped it and all ten were
 * distinct governments (Bell/Bell Gardens, Avon/Avon Lake, ...).
 */

export async function ensureMunicipality(db, {
  name, state, entityType = 'city', population = 0, source = null, sourceEntityKey = null,
}) {
  const { data, error } = await db.rpc('treasury_ensure_municipality', {
    p_name: name,
    p_state: state,
    p_entity_type: entityType,
    p_population: population ?? 0,
    p_source: source,
    p_source_entity_key: sourceEntityKey,
  });

  if (error) throw new Error(`ensureMunicipality(${name}, ${state}): ${error.message}`);
  if (!data) throw new Error(`ensureMunicipality(${name}, ${state}): returned no id`);

  return { id: data };
}

/**
 * Run at the END of every load, before reporting success.
 *
 * ⚠ A zero result only means something because 'distinct' adjudications are
 * suppressed in the function itself. Do not filter here as well.
 */
export async function assertNoNewForks(db) {
  const { data, error } = await db.rpc('detect_forked_entities');
  if (error) throw new Error(`fork check failed to run: ${error.message}`);
  if (!data || data.length === 0) return;

  const lines = data.map(
    (r) => `  ${r.state}  "${r.name_a}" (${r.years_a})  <->  "${r.name_b}" (${r.years_b})`,
  );
  throw new Error(
    `${data.length} suspected forked ${data.length === 1 ? 'city' : 'cities'} after this load:\n` +
    `${lines.join('\n')}\n` +
    `Each is ONE city held as TWO entities, or two governments that need a ` +
    `'distinct' row in treasury.municipality_fork_reviews. Resolve before trusting this load.`,
  );
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/ensureMunicipality.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Expose the function to PostgREST**

`assertNoNewForks` calls it by RPC, so it must be reachable in the `public`
schema. The composite type it returns was already created in Task 3. Apply a
migration named `expose_detect_forked_entities`:

```sql
CREATE OR REPLACE FUNCTION public.detect_forked_entities()
RETURNS SETOF treasury.municipality_fork_pair
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'treasury','public'
AS $$ SELECT * FROM treasury.detect_forked_entities(); $$;

GRANT EXECUTE ON FUNCTION public.detect_forked_entities() TO service_role;
```

Then verify it is callable the way the helper calls it:

```sql
select count(*) from public.detect_forked_entities();
```

Expected: `0`.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/ensureMunicipality.mjs tests/ensureMunicipality.test.mjs supabase/migrations/
git commit -m "feat(scripts): ensureMunicipality helper and load-end fork check"
```

---

### Task 6: Route every loader through the helper and check itself

**Files:**
- Modify (29 files, 30 invocations):
  `scripts/bulkLoadStateController.js`, `scripts/loadCoKsAcfrs.mjs`, `scripts/loadFlStatewide.mjs`,
  `scripts/loadFloridaDFS.mjs`, `scripts/loadGeorgiaRLGF.mjs`, `scripts/loadInCountyAcfrs.mjs`,
  `scripts/loadIndianaGateway.mjs`, `scripts/loadLACountyOperating.js`, `scripts/loadLACountyRevenue.js`,
  `scripts/loadLACountySalaries.js`, `scripts/loadMNOSA.js`, `scripts/loadMiStatewideF65.mjs`,
  `scripts/loadMichiganF65.mjs`, `scripts/loadOhioAOS.js`, `scripts/loadPaDced.mjs`,
  `scripts/loadPaStatewide.mjs`, `scripts/loadS8Acfrs.mjs`, `scripts/loadScCityAcfrs.mjs`,
  `scripts/loadScRfa.mjs`, `scripts/loadSdAcfrs.mjs`, `scripts/loadUtahTransparency.js`,
  `scripts/loadVAComparativeReport.js`, `scripts/seedCountyLinks.js`, `scripts/seedNashville.mjs`,
  `scripts/seedSouthCarolinaCities.mjs`, `scripts/seedTucsonArizona.js`, `scripts/seedVirginiaDataModel.js`,
  `scripts/seedWashingtonSeattle.js`, `scripts/seedWisconsinMadison.js`
- Test: `tests/noDirectEnsureMunicipalityRpc.test.mjs`

**Interfaces:**
- Consumes: `ensureMunicipality`, `assertNoNewForks` (Task 5)

- [ ] **Step 1: Write the failing guard test**

```javascript
// tests/noDirectEnsureMunicipalityRpc.test.mjs
/**
 * ⚠ Grep-shaped on purpose. This repo has been bitten by fixes that were
 * correct in one file and re-broken by the next merge; a rule that scans every
 * file is the only kind that survives one.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['scripts', 'src', 'supabase'];
const EXTS = ['.mjs', '.js', '.ts'];
const ALLOWED = new Set(['scripts/lib/ensureMunicipality.mjs']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

describe('treasury_ensure_municipality is only called through the helper', () => {
  it('has no direct .rpc() call outside scripts/lib/ensureMunicipality.mjs', () => {
    const offenders = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = file.split('\\').join('/');
        if (ALLOWED.has(rel)) continue;
        const src = readFileSync(file, 'utf8');
        if (/rpc\(\s*['"]treasury_ensure_municipality['"]/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails, and to get the worklist**

Run: `npx vitest run tests/noDirectEnsureMunicipalityRpc.test.mjs`
Expected: FAIL, listing 29 offending files. That list is the worklist for Step 3.

- [ ] **Step 3: Convert each call site**

Add the import at the top of each file:

```javascript
import { ensureMunicipality, assertNoNewForks } from './lib/ensureMunicipality.mjs';
```

Before (representative — `scripts/loadCoKsAcfrs.mjs:177`):

```javascript
const { data, error } = await db.rpc('treasury_ensure_municipality', {
  p_name: ent.name, p_state: ent.state,
  p_entity_type: ent.entityType, p_population: ent.population,
});
if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
ids.set(ent.key, data);
```

After:

```javascript
const { id } = await ensureMunicipality(db, {
  name: ent.name, state: ent.state,
  entityType: ent.entityType, population: ent.population,
});
ids.set(ent.key, id);
```

- [ ] **Step 4: Add the load-end check as an npm script** — REVISED 2026-09-16

⚠⚠ **THE ORIGINAL STEP 4 WAS ABANDONED AFTER MEASURING THE 29 FILES.** It said
to insert `await assertNoNewForks(db)` at the end of each loader's `main()`.
They do not share a shape:

    18 of 29   have a locatable `^async function main(`
     8 of 29   declare no client under either common name (`db` / `supabase`)
    most       create the client INSIDE main(), so the bottom-level
               invocation cannot be wrapped either

A blind insertion across those is the same shape of edit that, earlier in this
task, removed 62 error checks instead of 30. Not worth repeating.

⭐ **The repo already has a post-load verification convention, and it is npm
scripts, not in-loader calls.** Loaders end by printing `Now run: npm run
verify:frozen`. The fork check is GLOBAL — it scans the whole table — so running
it once after a load is informationally identical to running it inside every
loader.

Create `scripts/checkForkedEntities.mjs` calling `assertNoNewForks`, and add:

```json
"check:forks": "node --env-file=.env scripts/checkForkedEntities.mjs"
```

⚠ **The honest cost:** this is ADVERTISED rather than ENFORCED, and the spec's
success criterion — "every loader calls assertNoNewForks before reporting
success" — is NOT met as written. Given this project's own lesson that *TT keeps
building harnesses nobody runs*, that is a real downgrade, not a neutral
substitution. Chris chose it deliberately on 2026-09-16 over partial enforcement
(18 files) or 29 hand edits.

- [ ] **Step 5: Run the guard test and the full suite**

Run: `npx vitest run tests/noDirectEnsureMunicipalityRpc.test.mjs` → PASS, `offenders` empty.
Run: `npm test` → whole suite green, no new failures.
Run: `npm run build` → clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/ tests/noDirectEnsureMunicipalityRpc.test.mjs
git commit -m "refactor(loaders): one door for entity lookup, and every load checks itself for forks"
```

---

### Task 7: Prove it against the real fork, end to end

**Files:**
- Create: `docs/superpowers/plans/2026-09-16-stable-key-verification.md`

- [ ] **Step 1: The alias path resolves without creating anything**

```sql
select public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863) as resolved,
       (select id from treasury.municipalities
         where state='MN' and lower(name)='birchwood village') as expected,
       (select count(*) from treasury.municipalities) as total_rows;
```

Expected: `resolved = expected`, both non-null, `total_rows = 8182`.

- [ ] **Step 2: Without the alias, the detector catches the fork**

```sql
BEGIN;
DELETE FROM treasury.municipality_aliases WHERE state='MN' AND lower(alias_name)='birchwood';

CREATE TEMP TABLE p AS SELECT * FROM treasury.municipalities
 WHERE state='MN' AND lower(name)='birchwood village';
UPDATE p SET id='00000000-dead-4bee-8000-00000000000b'::uuid, name='Birchwood',
             population=863, geoid=NULL, geoid_basis=NULL;
INSERT INTO treasury.municipalities SELECT * FROM p;
UPDATE treasury.budgets SET municipality_id='00000000-dead-4bee-8000-00000000000b'::uuid
 WHERE municipality_id=(SELECT id FROM treasury.municipalities
                         WHERE state='MN' AND lower(name)='birchwood village')
   AND fiscal_year <= 2020;

SELECT count(*) AS forks_detected,
       (SELECT name_a || ' <-> ' || name_b FROM treasury.detect_forked_entities() LIMIT 1) AS pair
FROM treasury.detect_forked_entities();

ROLLBACK;
```

Expected: `forks_detected = 1`, `pair` naming both Birchwoods.
**Zero here means the detector did not fire — stop and fix Task 3.**

- [ ] **Step 3: Verify the rollback**

```sql
select (select count(*) from treasury.municipalities) as total_rows,
       (select count(*) from treasury.municipalities where state='MN' and lower(name) like 'birchwood%') as birchwood_rows,
       (select count(*) from treasury.municipality_aliases where state='MN' and lower(alias_name)='birchwood') as alias_restored,
       (select count(*) from treasury.detect_forked_entities()) as forks;
```

Expected: `total_rows = 8182`, `birchwood_rows = 1`, `alias_restored = 1`, `forks = 0`.

- [ ] **Step 4: Full gates**

Run: `npm test` → green. Run: `npm run build` → clean.
Run `scripts/detectForkedEntities.sql` → zero rows.

- [ ] **Step 5: Write the verification record and commit**

Record each command, its actual output, and the row counts before and after.
State plainly anything that did not pass.

```bash
git add -f docs/superpowers/plans/2026-09-16-stable-key-verification.md
git commit -m "docs: verification record for stable-key loader identity"
```

---

### Task 8: Answer the approach-C question

**Files:**
- Modify: `docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md` (fill in open question 2)

> Approach C is the only mechanism here that *prevents* a fork rather than
> catching it, and the spec's open question — whether MN OSA publishes a stable
> unit id — is cheap to answer and gates all future C work. Answering it is the
> task; adopting C is not.

- [ ] **Step 1: Look for an id column in the MN OSA source**

Inspect the file `scripts/loadMNOSA.js` reads, and list its columns. Look for a
unit/entity/gov id that is stable across years — not the city name, not a row
number.

- [ ] **Step 2: Record the answer in the spec**

Replace open question 2 with the finding: the column name if one exists, or a
plain statement that MN OSA publishes no stable id and approach C is therefore
unavailable for the publisher that caused both incidents. **Either answer is
useful; a negative answer is not a failure.**

- [ ] **Step 3: Commit**

```bash
git add -f docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md
git commit -m "docs: answer whether MN OSA publishes a stable unit id"
```

---

## Self-Review

**Spec coverage.** Alias table → 1; review queue → 2; detector-as-function and the `distinct` suppression → 3; lookup order and backfill → 4; helper and load-end check → 5; 30 call sites → 6; validation against the real fork → 7; approach-C open question → 8.

**Changed from the first version of this plan, after measurement:** the `BEFORE INSERT` guard (previously Task 8) is gone, along with the `TT001` SQLSTATE, the RPC exception handler, the quarantine return shape, and `treasury.municipality_name_core` as a standalone function — the normalisation now lives inside the detector function, its only consumer. Ten known-distinct pairs are written into Task 3's self-check as a permanent regression test so the rejected rule cannot creep back.

**Deliberate non-goals:** the 16 direct-insert sites are not migrated (with no insert-time guard there is nothing to bypass, and they are covered by the same load-end detection); no review UI; no loader adopts approach C.
