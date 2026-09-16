# Stable-Key Loader Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a publisher's rename from silently creating a second entity and severing a city's budget history.

**Architecture:** A `municipality_aliases` table absorbs known renames; a `BEFORE INSERT` trigger on `treasury.municipalities` refuses an unknown name that looks like a rename, using whole-word containment on a normalised name core; refusals are recorded in a `municipality_fork_reviews` queue that a human clears, and clearing it is what admits the entity. The RPC catches the refusal server-side and returns NULL so one bad entity quarantines instead of aborting a 1,856-unit load.

**Tech Stack:** PostgreSQL 15 (Supabase), plpgsql, Node ESM scripts, vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md`

## Global Constraints

- **Never rename an existing entity on load.** `?entity=` slugs derive from `name`; rewriting it invalidates every shared link. Applies to alias hits too.
- **Null is a correct answer; a wrong identity is not.** Prefer refusing to guessing.
- **Whole-word containment, never trigram similarity.** MI/PA disambiguate same-named townships by appending a county (117 names covering 302 townships); a similarity threshold false-refuses hundreds on the first MI load.
- **Guards live in triggers, not the RPC.** 16 sites `INSERT` into `municipalities` directly.
- **Migrations self-verify** with a `DO $$` block that probes real existing rows, counts before/after, accumulates a `bad` counter, and `RAISE EXCEPTION`s at the end — the pattern in `20260914000100_municipality_name_match_case_insensitive.sql`.
- **CI runs no database.** SQL-level proof lives in migration self-verification blocks; vitest covers only pure JS.
- **Apply migrations with `mcp__supabase-local__apply_migration`, then verify independently** with a separate `execute_sql` read — never trust a migration's own success report alone.
- Run scripts as `node --env-file=.env <script>`; `dotenv` is not installed.

---

## Task Order And Why It Matters

Two ordering constraints are load-bearing:

1. **Aliases are seeded (Task 5) before the guard is enabled (Task 8).** The seed closes a hole that is open *right now*: both merges removed a row whose name the publisher has already printed, so a republished FY2012-2020 figure under `Birchwood` would re-fork the city merged in #185.
2. **Call sites are migrated (Task 7) before the guard is enabled (Task 8).** Every caller today does `if (error) throw`. Enabling refusal first would turn one ambiguous town into an aborted statewide load — the exact pressure that gets a check disabled.

---

### Task 1: Name-core normalisation function

**Files:**
- Create: `supabase/migrations/20260916T0900_municipality_name_core.sql`

**Interfaces:**
- Produces: `treasury.municipality_name_core(text) RETURNS text` — IMMUTABLE. Used by Task 4 (guard trigger) and Task 2's mutual-exclusion check.

- [ ] **Step 1: Write the migration with its self-verification block**

```sql
-- The normalised comparison key for a municipality name.
--
-- Folds accents, lowercases, collapses non-alphanumerics to single spaces, and
-- strips designators that publishers add or drop freely.
--
-- ⚠⚠ IMMUTABLE requires the two-argument `unaccent(regdictionary, text)`.
-- The one-argument `unaccent(text)` is only STABLE — it resolves the default
-- dictionary at runtime — and a function calling it cannot be IMMUTABLE, which
-- would block any future index on this expression.
CREATE OR REPLACE FUNCTION treasury.municipality_name_core(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
           regexp_replace(
             regexp_replace(
               btrim(regexp_replace(
                 lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_name)),
                 '[^a-z0-9]+', ' ', 'g')),
               '\s+(city|town|township|village|borough|municipality|urban county|county)$', '', 'g'),
             '^(city|town|village|borough|township) of\s+', '', 'g'));
$$;

COMMENT ON FUNCTION treasury.municipality_name_core(text) IS
  'Normalised name key for fork detection. Folds accents/case/punctuation and strips leading and trailing designators. See docs/superpowers/specs/2026-09-15-stable-key-loader-identity-design.md.';

-- ── Self-verification: prove the behaviour, do not assert it ───────────────
DO $$
DECLARE bad int := 0;
BEGIN
  IF treasury.municipality_name_core('Birchwood Village') <> 'birchwood' THEN
    bad := bad + 1; RAISE WARNING 'trailing designator not stripped';
  END IF;
  IF treasury.municipality_name_core('Town of Pines') <> 'pines' THEN
    bad := bad + 1; RAISE WARNING 'leading designator not stripped';
  END IF;
  IF treasury.municipality_name_core('La Cañada Flintridge')
     <> treasury.municipality_name_core('La Canada Flintridge') THEN
    bad := bad + 1; RAISE WARNING 'accents not folded';
  END IF;
  IF treasury.municipality_name_core('Marine On Saint Croix')
     <> treasury.municipality_name_core('Marine on Saint Croix') THEN
    bad := bad + 1; RAISE WARNING 'case not folded';
  END IF;
  -- ⚠ THE MICHIGAN CASE. These are two different governments and their cores
  -- must stay different, or the guard in Task 4 refuses half of Michigan.
  IF treasury.municipality_name_core('Washington, Oakland')
     = treasury.municipality_name_core('Washington, Macomb') THEN
    bad := bad + 1; RAISE WARNING 'two distinct MI townships collapsed to one core';
  END IF;
  IF bad > 0 THEN
    RAISE EXCEPTION 'municipality_name_core: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — name core folds case, accents and designators, and keeps MI county suffixes distinct';
END $$;
```

- [ ] **Step 2: Apply it**

Use `mcp__supabase-local__apply_migration` with name `municipality_name_core` and the SQL above (omit nothing — the `DO` block is the test).
Expected: `{"success": true}`. A failure raises and applies nothing.

- [ ] **Step 3: Verify independently**

Run via `mcp__supabase-local__execute_sql`:

```sql
select treasury.municipality_name_core('Birchwood Village') as a,
       treasury.municipality_name_core('Birchwood')         as b,
       treasury.municipality_name_core('Washington, Oakland') as c,
       treasury.municipality_name_core('Washington, Macomb')  as d;
```

Expected: `a='birchwood'`, `b='birchwood'`, `c='washington oakland'`, `d='washington macomb'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916T0900_municipality_name_core.sql
git commit -m "feat(db): normalised municipality name core for fork detection"
```

---

### Task 2: Alias table and mutual exclusion

**Files:**
- Create: `supabase/migrations/20260916T0910_municipality_aliases.sql`

**Interfaces:**
- Consumes: `treasury.municipality_name_core(text)` (Task 1)
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
-- this whole design exists to prevent.
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

  -- An alias that duplicates a real entity name must be REJECTED.
  BEGIN
    INSERT INTO treasury.municipality_aliases
      (municipality_id, alias_name, state, entity_type, note)
    VALUES (probe_id, probe_name, probe_state, probe_type, 'self-test, should fail');
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
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `municipality_aliases`.
Expected: `{"success": true}`.

- [ ] **Step 3: Verify independently**

```sql
select count(*) as alias_rows,
       (select count(*) from pg_trigger
         where tgname = 'municipality_aliases_not_an_entity') as guard_present
from treasury.municipality_aliases;
```

Expected: `alias_rows = 0`, `guard_present = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916T0910_municipality_aliases.sql
git commit -m "feat(db): municipality_aliases table, with alias/entity mutual exclusion"
```

---

### Task 3: Fork review queue

**Files:**
- Create: `supabase/migrations/20260916T0920_municipality_fork_reviews.sql`

**Interfaces:**
- Produces: table `treasury.municipality_fork_reviews(id, candidate_name, state, entity_type, population, suspected_id, source, status, resolved_by, resolved_at, note, created_at)`. Task 4 reads `status='distinct'`; Task 6 reads rows by `(candidate_name, state, entity_type)`.

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

-- A repeated load re-hits the same row rather than piling up duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS municipality_fork_reviews_candidate_uniq
  ON treasury.municipality_fork_reviews (lower(candidate_name), state, entity_type);

COMMENT ON TABLE treasury.municipality_fork_reviews IS
  'Quarantined entities that looked like a rename of an existing one. status=alias means same city (write a municipality_aliases row); status=distinct means genuinely new, and the guard then admits it.';

GRANT SELECT ON treasury.municipality_fork_reviews TO service_role;

DO $$
DECLARE bad int := 0;
BEGIN
  BEGIN
    INSERT INTO treasury.municipality_fork_reviews
      (candidate_name, state, entity_type, status)
    VALUES ('Self Test Town', 'ZZ', 'city', 'not-a-valid-status');
    bad := bad + 1; RAISE WARNING 'the status CHECK did not reject an invalid value';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  DELETE FROM treasury.municipality_fork_reviews WHERE state = 'ZZ';

  IF bad > 0 THEN
    RAISE EXCEPTION 'municipality_fork_reviews: % checks failed', bad;
  END IF;
  RAISE NOTICE 'OK — review queue created, status constrained to open/alias/distinct';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `municipality_fork_reviews`.

- [ ] **Step 3: Verify independently**

```sql
select count(*) as reviews, (select count(*) from treasury.municipality_fork_reviews where state='ZZ') as leftovers
from treasury.municipality_fork_reviews;
```

Expected: `reviews = 0`, `leftovers = 0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916T0920_municipality_fork_reviews.sql
git commit -m "feat(db): municipality_fork_reviews quarantine queue"
```

---

### Task 4: RPC lookup order — aliases resolve, nothing is refused yet

**Files:**
- Create: `supabase/migrations/20260916T0930_ensure_municipality_alias_lookup.sql`

**Interfaces:**
- Consumes: `treasury.municipality_aliases` (Task 2)
- Produces: `public.treasury_ensure_municipality(p_name text, p_state text, p_entity_type text DEFAULT 'city', p_population integer DEFAULT 0, p_source text DEFAULT NULL, p_source_entity_key text DEFAULT NULL) RETURNS uuid`

- [ ] **Step 1: Write the migration**

```sql
-- ⚠⚠ ADDING PARAMETERS CREATES AN OVERLOAD, IT DOES NOT REPLACE.
-- `CREATE OR REPLACE FUNCTION` matches on the argument list, so the 4-argument
-- function would survive alongside the 6-argument one and PostgREST could pick
-- either. Drop the old signature explicitly. Callers use NAMED parameters, so
-- the existing 4-argument call sites resolve against the new function's
-- defaults with no edit.
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
    SELECT municipality_id INTO v_id
      FROM treasury.municipality_aliases
     WHERE source = p_source AND source_entity_key = p_source_entity_key;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  -- 2. Today's behaviour: case-insensitive name match.
  SELECT id INTO v_id
    FROM treasury.municipalities
   WHERE lower(name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  -- 3. New: a known rename resolves to the entity it renamed.
  SELECT municipality_id INTO v_id
    FROM treasury.municipality_aliases
   WHERE lower(alias_name) = lower(p_name)
     AND state = p_state
     AND entity_type = p_entity_type;
  -- ⚠ Resolving through an alias must NEVER rename the entity. The `?entity=`
  -- slug derives from `name`; rewriting it here invalidates every shared link.
  IF FOUND THEN RETURN v_id; END IF;

  -- 4. Create. Task 8 adds a trigger that may refuse this.
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

  -- 1. Case-variant lookup still returns the same id (no regression on #182).
  returned_id := public.treasury_ensure_municipality(upper(probe_name), probe_state, probe_type, 0);
  IF returned_id IS DISTINCT FROM probe_id THEN
    bad := bad + 1; RAISE WARNING 'case-variant lookup regressed';
  END IF;

  -- 2. An alias resolves to its entity, and does NOT rename it.
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

  -- 3. Nothing was created by any lookup.
  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'lookups created % row(s)', rows_after - rows_before;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'ensure_municipality alias lookup: % checks failed', bad;
  END IF;
  RAISE NOTICE 'OK — aliases resolve, case match intact, nothing renamed, nothing created';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `ensure_municipality_alias_lookup`.

- [ ] **Step 3: Verify the old overload is gone**

```sql
select count(*) as overloads, max(pg_get_function_identity_arguments(p.oid)) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'treasury_ensure_municipality';
```

Expected: `overloads = 1`, and `args` lists six parameters. **If `overloads = 2` the drop failed and PostgREST may call either one — stop and fix before continuing.**

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916T0930_ensure_municipality_alias_lookup.sql
git commit -m "feat(db): resolve known renames through municipality_aliases"
```

---

### Task 5: Seed the two historical aliases

**Files:**
- Create: `supabase/migrations/20260916T0940_seed_historical_aliases.sql`

**Interfaces:**
- Consumes: `treasury.municipality_aliases` (Task 2), the alias lookup (Task 4)

- [ ] **Step 1: Write the migration**

```sql
-- ⚠⚠ THIS CLOSES A HOLE THAT IS OPEN RIGHT NOW, it is not tidying.
--
-- #185 and 20260914000000 each deleted a row whose name the publisher HAS
-- ALREADY PRINTED. If the MN Office of the State Auditor republishes any
-- FY2012-2020 figure under "Birchwood", today's loader finds no match and
-- CREATES THE ENTITY AGAIN — re-forking the city that was just merged.
--
-- Ids are resolved by name rather than hardcoded, so this fails loudly if the
-- survivor is not where it is expected.
DO $$
DECLARE
  birchwood_id uuid;
  marine_id    uuid;
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

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE v_id uuid; expect_id uuid; rows_before int; rows_after int; bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  SELECT id INTO expect_id FROM treasury.municipalities
   WHERE state = 'MN' AND entity_type = 'city' AND lower(name) = 'birchwood village';

  -- The old spelling must now resolve to the survivor, and create NOTHING.
  v_id := public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863);
  IF v_id IS DISTINCT FROM expect_id THEN
    bad := bad + 1; RAISE WARNING '"Birchwood" resolved to %, expected %', v_id, expect_id;
  END IF;

  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'the old spelling CREATED % row(s) — the re-fork is still open',
      rows_after - rows_before;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'historical aliases: % checks failed', bad;
  END IF;
  RAISE NOTICE 'OK — a republished "Birchwood" now resolves to Birchwood Village and creates nothing';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `seed_historical_aliases`.

- [ ] **Step 3: Verify independently**

```sql
select a.alias_name, m.name as resolves_to, a.state
from treasury.municipality_aliases a
join treasury.municipalities m on m.id = a.municipality_id
order by a.alias_name;
```

Expected exactly two rows: `Birchwood → Birchwood Village`, `Marine On Saint Croix → Marine on Saint Croix`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916T0940_seed_historical_aliases.sql
git commit -m "fix(mn): alias the pre-merge spellings so a republish cannot re-fork"
```

---

### Task 6: The shared helper

**Files:**
- Create: `scripts/lib/ensureMunicipality.mjs`
- Test: `tests/ensureMunicipality.test.mjs`

**Interfaces:**
- Produces: `ensureMunicipality(db, { name, state, entityType, population, source, sourceEntityKey })` → `Promise<{ id: string } | { quarantined: true, name, state, entityType }>`; and the exported constant `FORK_SQLSTATE = 'TT001'`.

> **Note on a deliberate deviation from the spec.** The spec sketched the helper
> returning `review_id`. It does not: the RPC `RETURNS uuid`, so a review id
> coming back through the same channel is indistinguishable from a municipality
> id — precisely the class of confusion this project keeps paying for. The
> review row is keyed by `(candidate_name, state, entity_type)` and is found by
> those instead.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/ensureMunicipality.test.mjs
import { describe, it, expect } from 'vitest';
import { ensureMunicipality } from '../scripts/lib/ensureMunicipality.mjs';

/** Minimal fake of the supabase client's .rpc() surface. */
const fakeDb = (impl) => ({ rpc: async (fn, args) => impl(fn, args) });

describe('ensureMunicipality', () => {
  it('returns the id when the RPC resolves an entity', async () => {
    const db = fakeDb(async () => ({ data: 'aaaaaaaa-0000-0000-0000-000000000001', error: null }));
    const out = await ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' });
    expect(out).toEqual({ id: 'aaaaaaaa-0000-0000-0000-000000000001' });
  });

  it('reports quarantined when the RPC returns null', async () => {
    const db = fakeDb(async () => ({ data: null, error: null }));
    const out = await ensureMunicipality(db, {
      name: 'Birchwood Village', state: 'MN', entityType: 'city',
    });
    expect(out).toEqual({
      quarantined: true, name: 'Birchwood Village', state: 'MN', entityType: 'city',
    });
  });

  it('throws on a real error, so a broken load still fails loudly', async () => {
    const db = fakeDb(async () => ({ data: null, error: { message: 'connection reset' } }));
    await expect(
      ensureMunicipality(db, { name: 'Napa', state: 'CA', entityType: 'city' }),
    ).rejects.toThrow(/connection reset/);
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
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/ensureMunicipality.test.mjs`
Expected: FAIL — cannot resolve `../scripts/lib/ensureMunicipality.mjs`.

- [ ] **Step 3: Write the helper**

```javascript
// scripts/lib/ensureMunicipality.mjs
/**
 * The one way a loader turns a published name into a TT entity id.
 *
 * ⚠⚠ Loaders used to call `treasury_ensure_municipality` directly and treat a
 * non-error as an id. The RPC can now decline to create an entity that looks
 * like a rename of an existing one — it records a row in
 * `treasury.municipality_fork_reviews` and returns NULL. A caller that assumes
 * an id would write a NULL municipality_id and fail somewhere far away from the
 * cause, or worse, skip silently.
 *
 * Callers MUST branch on the result:
 *
 *     const r = await ensureMunicipality(db, { name, state, entityType, population });
 *     if (r.quarantined) { skipped.push(r.name); continue; }
 *     useTheId(r.id);
 */

/** SQLSTATE the fork guard raises. Exported so callers can recognise it. */
export const FORK_SQLSTATE = 'TT001';

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

  if (error) {
    throw new Error(`ensureMunicipality(${name}, ${state}): ${error.message}`);
  }

  // NULL is the quarantine signal, not a failure. The guard has already
  // recorded the review row server-side.
  if (data === null || data === undefined) {
    return { quarantined: true, name, state, entityType };
  }

  return { id: data };
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run tests/ensureMunicipality.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ensureMunicipality.mjs tests/ensureMunicipality.test.mjs
git commit -m "feat(scripts): shared ensureMunicipality helper with quarantine handling"
```

---

### Task 7: Migrate all 29 call sites

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
- Consumes: `ensureMunicipality` (Task 6)

- [ ] **Step 1: Write the failing guard test**

```javascript
// tests/noDirectEnsureMunicipalityRpc.test.mjs
/**
 * The RPC may return NULL to quarantine an entity. A caller that goes straight
 * to `.rpc('treasury_ensure_municipality')` and treats the result as an id will
 * write a NULL municipality_id and fail far from the cause.
 *
 * ⚠ This is a grep-shaped test on purpose. The repo has been bitten by fixes
 * that were correct in one file and re-broken by the next merge; a rule that
 * scans every file is the only kind that survives a merge.
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

For every file, replace the raw RPC call with the helper and branch on the result. Add the import at the top of the file:

```javascript
import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
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
const r = await ensureMunicipality(db, {
  name: ent.name, state: ent.state,
  entityType: ent.entityType, population: ent.population,
});
if (r.quarantined) {
  quarantined.push(`${r.name} (${r.state})`);
  continue;                    // ⚠ skip THIS entity, keep loading the rest
}
ids.set(ent.key, r.id);
```

Declare `const quarantined = [];` alongside the loop's other accumulators, and after the loop report rather than swallow:

```javascript
if (quarantined.length) {
  console.warn(
    `\n⚠ ${quarantined.length} entit${quarantined.length === 1 ? 'y' : 'ies'} quarantined as suspected renames:\n  ` +
    `${quarantined.join('\n  ')}\n` +
    `  Resolve in treasury.municipality_fork_reviews (status: alias | distinct), then re-run.\n`,
  );
}
```

⚠ Where the call is not inside a loop (`scripts/seedNashville.mjs`, `scripts/seedTucsonArizona.js`, `scripts/seedWisconsinMadison.js`, `scripts/seedWashingtonSeattle.js` — single-entity seeders), there is nothing to continue past. Throw instead, because a single-entity seeder that quarantines its only entity has done nothing and must not report success:

```javascript
const r = await ensureMunicipality(db, { name, state, entityType, population });
if (r.quarantined) {
  throw new Error(
    `${name} (${state}) was quarantined as a suspected rename. ` +
    `Resolve it in treasury.municipality_fork_reviews, then re-run.`,
  );
}
const municipalityId = r.id;
```

- [ ] **Step 4: Run the guard test and the full suite**

Run: `npx vitest run tests/noDirectEnsureMunicipalityRpc.test.mjs`
Expected: PASS, `offenders` empty.

Run: `npm test`
Expected: the whole suite green, no new failures.

Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/ tests/noDirectEnsureMunicipalityRpc.test.mjs
git commit -m "refactor(loaders): route every entity lookup through ensureMunicipality"
```

---

### Task 8: Enable the fork guard

**Files:**
- Create: `supabase/migrations/20260916T0950_municipality_fork_guard.sql`

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 4
- Produces: trigger `municipalities_fork_guard`; SQLSTATE `TT001`; RPC returns NULL on quarantine

⚠ **Do not start this task until Task 7 is merged.** Every unmigrated caller does `if (error) throw`, so enabling refusal first converts one ambiguous town into an aborted statewide load.

- [ ] **Step 1: Write the migration**

```sql
-- ── The guard ─────────────────────────────────────────────────────────────
--
-- ⚠⚠ AT INSERT TIME THE NEW ENTITY HAS NO BUDGETS, so three of the five signals
-- scripts/detectForkedEntities.sql relies on — one shared publisher, adjacent
-- non-overlapping year ranges — DO NOT EXIST YET. This decides on name, state,
-- entity_type and population alone.
--
-- ⚠⚠ CONTAINMENT, NOT TRIGRAM SIMILARITY. MI and PA disambiguate same-named
-- townships by appending a county (117 township names covering 302 townships).
-- A similarity threshold refuses "Washington, Oakland" because
-- "Washington, Macomb" exists, and a 1,856-unit Michigan load would generate
-- hundreds of false quarantines on its first run. Under containment neither
-- name extends the other, so both pass.
--
-- ⚠ Suffix extension is deliberately NOT matched. "North Birchwood" is
-- ordinarily a different place from "Birchwood"; only a PREFIX extension
-- ("Birchwood Village") carries the rename signature.
--
-- ⚠ When either population is 0 or NULL the population test cannot
-- discriminate and the rule falls back to containment alone — it still
-- refuses. p_population defaults to 0 and many loaders pass nothing, so this is
-- the common path. A false quarantine costs one queue row a human clears in
-- seconds; a missed fork silently severs a city's history and is found only by
-- accident, if ever.
CREATE OR REPLACE FUNCTION treasury.guard_municipality_fork()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_core       text := treasury.municipality_name_core(NEW.name);
  v_match_id   uuid;
  v_match_name text;
BEGIN
  -- A recorded 'distinct' decision admits the entity, permanently.
  IF EXISTS (
    SELECT 1 FROM treasury.municipality_fork_reviews
     WHERE lower(candidate_name) = lower(NEW.name)
       AND state = NEW.state AND entity_type = NEW.entity_type
       AND status = 'distinct'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT m.id, m.name INTO v_match_id, v_match_name
    FROM treasury.municipalities m
   WHERE m.state = NEW.state
     AND m.entity_type = NEW.entity_type
     AND (
          treasury.municipality_name_core(m.name) = v_core
       OR v_core LIKE treasury.municipality_name_core(m.name) || ' %'
       OR treasury.municipality_name_core(m.name) LIKE v_core || ' %'
     )
     AND (
          NEW.population IS NULL OR NEW.population = 0
       OR m.population  IS NULL OR m.population  = 0
       OR abs(m.population - NEW.population)::numeric
          / greatest(m.population, NEW.population) <= 0.25
     )
   ORDER BY m.id
   LIMIT 1;

  IF v_match_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'TT001',
      MESSAGE = format('suspected fork: "%s" looks like a rename of "%s"', NEW.name, v_match_name),
      DETAIL  = v_match_id::text,
      HINT    = 'resolve in treasury.municipality_fork_reviews as alias or distinct, then re-run';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS municipalities_fork_guard ON treasury.municipalities;
CREATE TRIGGER municipalities_fork_guard
  BEFORE INSERT ON treasury.municipalities
  FOR EACH ROW EXECUTE FUNCTION treasury.guard_municipality_fork();

-- ── The RPC catches the refusal and quarantines instead of exploding ──────
--
-- A plpgsql BEGIN/EXCEPTION block opens an implicit savepoint, so the failed
-- INSERT is rolled back to it and the function can still write the review row
-- and return normally. Direct-INSERT callers get the raw exception, which is
-- the intended behaviour for the 16 sites that bypass this function.
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
  v_id         uuid;
  v_suspect_id uuid;
BEGIN
  IF p_source IS NOT NULL AND p_source_entity_key IS NOT NULL THEN
    SELECT municipality_id INTO v_id FROM treasury.municipality_aliases
     WHERE source = p_source AND source_entity_key = p_source_entity_key;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  SELECT id INTO v_id FROM treasury.municipalities
   WHERE lower(name) = lower(p_name) AND state = p_state AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  SELECT municipality_id INTO v_id FROM treasury.municipality_aliases
   WHERE lower(alias_name) = lower(p_name) AND state = p_state AND entity_type = p_entity_type;
  IF FOUND THEN RETURN v_id; END IF;

  BEGIN
    INSERT INTO treasury.municipalities (name, state, entity_type, population)
    VALUES (p_name, p_state, p_entity_type, p_population)
    RETURNING id INTO v_id;
    RETURN v_id;
  EXCEPTION WHEN SQLSTATE 'TT001' THEN
    -- Re-find the suspect for the record. The guard puts its id in DETAIL, but
    -- a plpgsql handler cannot read DETAIL, so it is recomputed here.
    SELECT m.id INTO v_suspect_id
      FROM treasury.municipalities m
     WHERE m.state = p_state AND m.entity_type = p_entity_type
       AND (
            treasury.municipality_name_core(m.name) = treasury.municipality_name_core(p_name)
         OR treasury.municipality_name_core(p_name) LIKE treasury.municipality_name_core(m.name) || ' %'
         OR treasury.municipality_name_core(m.name) LIKE treasury.municipality_name_core(p_name) || ' %'
       )
     ORDER BY m.id LIMIT 1;

    INSERT INTO treasury.municipality_fork_reviews
      (candidate_name, state, entity_type, population, suspected_id, source)
    VALUES (p_name, p_state, p_entity_type, p_population, v_suspect_id, p_source)
    ON CONFLICT (lower(candidate_name), state, entity_type) DO NOTHING;

    RETURN NULL;
  END;
END;
$function$;

-- ── Self-verification ─────────────────────────────────────────────────────
DO $$
DECLARE
  base_id uuid; v_id uuid; rows_before int; rows_after int; bad int := 0;
BEGIN
  SELECT count(*) INTO rows_before FROM treasury.municipalities;

  -- Probe entity in a state TT does not load, so nothing real is touched.
  INSERT INTO treasury.municipalities (name, state, entity_type, population)
  VALUES ('Selftest Harbor', 'ZZ', 'city', 1000) RETURNING id INTO base_id;

  -- 1. A prefix extension with a close population must be REFUSED.
  v_id := public.treasury_ensure_municipality('Selftest Harbor Village', 'ZZ', 'city', 1010);
  IF v_id IS NOT NULL THEN
    bad := bad + 1; RAISE WARNING 'a prefix-extension rename was ACCEPTED (id %)', v_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM treasury.municipality_fork_reviews
                  WHERE state = 'ZZ' AND lower(candidate_name) = 'selftest harbor village') THEN
    bad := bad + 1; RAISE WARNING 'no review row was recorded for the refusal';
  END IF;

  -- 2. ⚠ THE MICHIGAN REGRESSION. Two county-suffixed names must BOTH load.
  INSERT INTO treasury.municipalities (name, state, entity_type, population)
  VALUES ('Selftest, Alpha', 'ZZ', 'township', 500);
  BEGIN
    INSERT INTO treasury.municipalities (name, state, entity_type, population)
    VALUES ('Selftest, Beta', 'ZZ', 'township', 520);
  EXCEPTION WHEN SQLSTATE 'TT001' THEN
    bad := bad + 1;
    RAISE WARNING 'the guard refused two distinct county-suffixed townships — MI/PA would break';
  END;

  -- 3. A 'distinct' decision admits the entity.
  UPDATE treasury.municipality_fork_reviews
     SET status = 'distinct', resolved_by = 'selftest', resolved_at = now()
   WHERE state = 'ZZ' AND lower(candidate_name) = 'selftest harbor village';
  v_id := public.treasury_ensure_municipality('Selftest Harbor Village', 'ZZ', 'city', 1010);
  IF v_id IS NULL THEN
    bad := bad + 1; RAISE WARNING 'a resolved-distinct candidate was still refused';
  END IF;

  -- Clean up every probe row.
  DELETE FROM treasury.municipality_fork_reviews WHERE state = 'ZZ';
  DELETE FROM treasury.municipalities WHERE state = 'ZZ';

  SELECT count(*) INTO rows_after FROM treasury.municipalities;
  IF rows_after <> rows_before THEN
    bad := bad + 1; RAISE WARNING 'self-test leaked % row(s)', rows_after - rows_before;
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'fork guard: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — renames refused and queued, MI-style county suffixes pass, distinct admits, no leaks';
END $$;
```

- [ ] **Step 2: Apply it**

`mcp__supabase-local__apply_migration`, name `municipality_fork_guard`.
Expected: `{"success": true}`. A failing self-check raises and applies nothing.

- [ ] **Step 3: Verify independently — no probe rows leaked**

```sql
select (select count(*) from treasury.municipalities where state = 'ZZ') as probe_municipalities,
       (select count(*) from treasury.municipality_fork_reviews where state = 'ZZ') as probe_reviews,
       (select count(*) from treasury.municipalities) as total_rows,
       (select count(*) from pg_trigger where tgname = 'municipalities_fork_guard') as guard_present;
```

Expected: `probe_municipalities = 0`, `probe_reviews = 0`, `total_rows = 8182`, `guard_present = 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260916T0950_municipality_fork_guard.sql
git commit -m "feat(db): refuse and quarantine suspected entity forks at insert time"
```

---

### Task 9: End-to-end proof against the real fork

**Files:**
- Create: `docs/superpowers/plans/2026-09-16-stable-key-verification.md` (the record of this run)

**Interfaces:**
- Consumes: everything above

> **Why this task exists.** Tasks 1-8 each self-verify against synthetic probes.
> This one replays the fork that actually happened. An empty result from an
> unvalidated guard proves nothing — the guard must be shown to fire on the real
> historical case, exactly as `detectForkedEntities.sql` was validated in #186.

- [ ] **Step 1: Rehearse the real fork inside a rolled-back transaction**

Run via `mcp__supabase-local__execute_sql`:

```sql
BEGIN;

-- Rebuild the pre-#185 state: Birchwood Village exists; "Birchwood" arrives.
-- Remove the alias first, so this tests THE GUARD rather than the alias path.
DELETE FROM treasury.municipality_aliases
 WHERE state = 'MN' AND lower(alias_name) = 'birchwood';

CREATE TEMP TABLE r AS
SELECT public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863) AS returned_id;

SELECT (SELECT returned_id FROM r) AS returned_id,
       (SELECT count(*) FROM treasury.municipality_fork_reviews
         WHERE state = 'MN' AND lower(candidate_name) = 'birchwood') AS review_rows,
       (SELECT count(*) FROM treasury.municipalities
         WHERE state = 'MN' AND lower(name) LIKE 'birchwood%') AS birchwood_rows;

ROLLBACK;
```

Expected: `returned_id = NULL`, `review_rows = 1`, `birchwood_rows = 1`.
**A non-null `returned_id` means the guard did not fire — stop and fix Task 8.**

- [ ] **Step 2: Verify the rollback**

```sql
select count(*) as birchwood_rows,
       (select count(*) from treasury.municipality_aliases
         where state='MN' and lower(alias_name)='birchwood') as alias_restored,
       (select count(*) from treasury.municipality_fork_reviews) as reviews
from treasury.municipalities where state='MN' and lower(name) like 'birchwood%';
```

Expected: `birchwood_rows = 1`, `alias_restored = 1`, `reviews = 0`.

- [ ] **Step 3: Confirm the alias path still short-circuits the guard**

```sql
select public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863) as resolved,
       (select id from treasury.municipalities
         where state='MN' and lower(name)='birchwood village') as expected;
```

Expected: `resolved = expected`, both non-null. **This is the ordering that matters: a known rename must resolve silently and never reach the guard.**

- [ ] **Step 4: Run the detector and the full suite**

Run `scripts/detectForkedEntities.sql` via `mcp__supabase-local__execute_sql`.
Expected: zero rows.

Run: `npm test` → green. Run: `npm run build` → clean.

- [ ] **Step 5: Write the verification record and commit**

Record in `docs/superpowers/plans/2026-09-16-stable-key-verification.md`: each step's command, its actual output, and the row counts before and after. State plainly anything that did not pass.

```bash
git add -f docs/superpowers/plans/2026-09-16-stable-key-verification.md
git commit -m "docs: verification record for stable-key loader identity"
```

---

## Self-Review

**Spec coverage.** Every section maps to a task: alias table → 2; review queue → 3; insert-time rule and containment → 1, 8; guard-as-trigger → 8; lookup order → 4, 8; helper → 6; 30 call sites → 7; 16 direct inserts → left unmigrated by design, stated in Task 8's header; backfill → 5; testing → each task's self-verification plus 9.

**Deviations from the spec, deliberate and noted at the point they occur:**
1. The helper returns `{quarantined:true, name, state, entityType}` rather than a `review_id` — the RPC `RETURNS uuid` and a review id on that channel is indistinguishable from a municipality id.
2. The guard's suspect id is recomputed in the RPC's exception handler rather than read from `DETAIL`, which a plpgsql handler cannot access.

**Not covered, and out of scope by the spec:** overlapping-year forks, renames into unrelated names, and any review UI. Approach C is enabled by the schema (`source`, `source_entity_key`, and their unique index) but no loader adopts it here — that is per-loader work, and the spec's open question about whether MN OSA even publishes a stable unit id must be answered first.
