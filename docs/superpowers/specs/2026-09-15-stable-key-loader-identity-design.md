# Stable-key loader identity — design

**Status:** proposed, 2026-09-15. **Revised 2026-09-16** — the insert-time guard was measured and removed; see *The guard that did not survive measurement*.
**Decision owner:** Chris
**Related:** `20260914000000_merge_mn_marine_on_saint_croix.sql`, `20260914000100_municipality_name_match_case_insensitive.sql` (#182), #185 (Birchwood merge), #186 (`scripts/detectForkedEntities.sql`)

## The problem

TT's loaders establish entity identity **by published name**. When a publisher
changes the name it prints, the lookup misses, a second entity is created, and
every year from that point forward lands on the new row. The city's history is
severed at that boundary.

It has happened twice, both from the Minnesota Office of the State Auditor:

    2026-09-14  Marine on Saint Croix / Marine On Saint Croix   "on" -> "On"
    2026-09-15  Birchwood            / Birchwood Village        a word added

**Neither was found by looking.** Marine surfaced because both halves claimed
the same geoid and the geoid backfill's uniqueness check refused it. Birchwood
surfaced while chasing an unrelated one-row discrepancy.

That is the defining property of this defect: **nothing fails.** Both halves
carry honest publisher data. Every total ties. Every figure is correct. Each
half looks complete. Only a reader who already knows the missing years exist
can tell that anything is wrong — and no reader does.

## Why the existing defences are not enough

| Defence | Covers | Misses |
|---|---|---|
| `lower(name)` match (#182) | `"on"` → `"On"` — the Marine shape | Any change that is not purely case |
| `UNIQUE (lower(name), state, entity_type)` | Two rows with the *same* name | A rename produces a *different* name, so the index never fires |
| `detectForkedEntities.sql` (#186) | Finds forks that already exist | Must be run by hand; nothing runs it |

## ⚠⚠ The guard that did not survive measurement

The first version of this design proposed a `BEFORE INSERT` trigger that would
refuse a name looking like a rename, using whole-word containment on a
normalised name core plus a population band. **It was measured against the
existing 8,182 rows before implementation and abandoned.**

Ten existing pairs satisfy containment *and* a 25% population band. **All ten
are genuine, distinct governments** with different geoids and separate budget
histories:

    CA  Bell      / Bell Gardens        OH  Avon      / Avon Lake
    CA  Chino     / Chino Hills         OH  Bedford   / Bedford Heights
    PA  Braddock  / Braddock Hills      PA  Langhorne / Langhorne Manor
    IN  Warren    / Warren Park         MN  Madison   / Madison Lake
    FL  Lake City / Lake Mary           MN  Pine City / Pine Island

**Zero true forks; a 100% false-positive rate.** Dropping the population band —
which the design had to do, because `p_population` defaults to `0` and many
loaders pass nothing — widens the exposure to **99 pairs across 8 states**.

⭐ **The problem is timing, not threshold.** `Bell Gardens` genuinely extends
`Bell`. What actually identified Birchwood was the *temporal* signature — one
shared publisher, adjacent non-overlapping year ranges — and **at `INSERT` time
the new entity has no budgets, so that signature does not exist yet.** The
remaining signals cannot carry the decision, and no threshold fixes an absent
signal. An unreliable block also creates exactly the pressure that gets a check
disabled the first time it stops a statewide refresh.

The measurement also exposed a normaliser artifact worth recording: stripping
the trailing designator turns **`Lake City` → `lake`** and **`Pine City` →
`pine`**, which then prefix-match every `Lake …` and `Pine …` in the state.
"City" is part of those place names. This is harmless in the detector (below),
because those pairs have *overlapping* year ranges and are excluded on that
signal — but it would have been load-bearing for an insert-time rule.

## The approach

**Enforcement moves to where the signal exists: the end of a load.**

1. **Aliases absorb known renames.** A `municipality_aliases` table maps
   alternate published names onto an entity, consulted by
   `treasury_ensure_municipality` before it creates anything. A rename that has
   been adjudicated once resolves silently forever.
2. **Every load checks itself.** After writing budgets, a loader runs the
   five-signal fork detector. A new fork fails the run and names both halves.
   By then the budgets exist, so all five signals are available — the same rule
   validated in #186, which returns **zero** false positives on production
   today against the insert-time rule's ten.
3. **Adjudications are recorded.** `municipality_fork_reviews` holds each
   detected pair. Resolving as `alias` writes the alias row and merges are done
   deliberately; resolving as `distinct` suppresses that pair permanently so the
   detector stays at zero and keeps meaning something.
4. **Approach C removes names from identity where a publisher allows it.** Most
   publishers (MN OSA, IN Gateway, FL DFS) emit a unit identifier that survives
   a re-spelling. Keying on `(data_source, source_entity_key)` is the only
   mechanism here that *prevents* a fork rather than catching it, and it is
   adopted loader by loader into the same alias table.

**Rejected: geoid as identity.** It makes Census the single point of failure for
identity, 34 geographic entities legitimately have none (dissolved
municipalities among them), and every loader would need name→geoid resolution —
the step that failed on 22 entities and required hand-adjudication in #184.

## ⚠ What this buys, stated honestly

A fork can now exist for **the duration of one load**, instead of being blocked
at the moment of creation. That is a real regression against the first design's
intent — and it is the correct trade, because the first design's block was
wrong ten times out of ten, and a check that cries wolf gets turned off.

Within a load, detection is reliable and immediate: the run fails, both halves
are named, and nothing downstream consumes the split silently for weeks.

**Only approach C prevents a fork outright**, and only for publishers that
expose a stable id.

## Components

### 1. `treasury.municipality_aliases`

    municipality_id   uuid not null references treasury.municipalities(id) on delete cascade
    alias_name        text not null
    state             text not null
    entity_type       text not null
    source            text            -- the publisher that printed this spelling
    source_entity_key text            -- approach C's stable key, when the publisher has one
    note              text not null   -- why this alias exists
    created_at        timestamptz not null default now()

    UNIQUE (lower(alias_name), state, entity_type)
    UNIQUE (source, source_entity_key) WHERE source_entity_key IS NOT NULL

The second unique constraint is where approach C lands with no further schema
work: a loader that knows its publisher's id writes it here, and lookup by
`(source, source_entity_key)` takes precedence over name entirely.

⚠ **A name is either an entity or an alias, never both** — and no cross-table
constraint can express that. It is enforced by a `BEFORE INSERT OR UPDATE`
trigger on `municipality_aliases` refusing an `alias_name` that matches an
existing `municipalities` row. Without it an alias could shadow a real entity
and silently redirect its loads, which is worse than the defect being fixed.

### 2. `treasury.detect_forked_entities()`

The five-signal rule from #186, moved from a standalone `.sql` file into a
**set-returning function**, so the file and the loaders cannot drift:

    same state · same entity_type · one shared publisher
    non-overlapping, adjacent year ranges (gap 0 or 1)
    related names after normalisation · populations within 25%
    different non-null geoids excluded

`scripts/detectForkedEntities.sql` becomes a thin
`SELECT * FROM treasury.detect_forked_entities();`. Pairs resolved `distinct`
in the review queue are excluded, so a cleared queue keeps the result at zero.

### 3. `treasury.municipality_fork_reviews`

    id, candidate_name, state, entity_type, population,
    suspected_id, source, status, resolved_by, resolved_at, note, created_at

    status: open | alias | distinct
    UNIQUE (lower(candidate_name), state, entity_type)

- `alias` — same city. Write the `municipality_aliases` row, then merge the
  entities deliberately, following `20260914000000`'s pattern of asserting the
  four CASCADE children are empty before deleting.
- `distinct` — genuinely two governments. The detector stops reporting the pair.

### 4. `treasury_ensure_municipality` — lookup order

    1. (source, source_entity_key)                -- approach C, when supplied
    2. lower(name) + state + entity_type          -- today's behaviour
    3. lower(alias_name) + state + entity_type    -- known renames
    4. INSERT

Gains two optional parameters, `p_source` and `p_source_entity_key`, both
defaulting to NULL so **all 30 existing call sites keep working unchanged**.

⚠ Existing behaviour that must not regress: when a row is found the stored name
is left alone even if the incoming casing differs. `?entity=` slugs derive from
`name`, so rewriting it on load would invalidate every shared link. **The same
applies to an alias hit** — resolving through an alias must never rename.

### 5. `scripts/lib/ensureMunicipality.mjs`

One door for entity lookup, and the home of the load-end check. All 29 calling
files are ESM (13 `.js`, 16 `.mjs`), so one module serves them all:

    ensureMunicipality(db, {name, state, entityType, population, source, sourceEntityKey}) -> {id}
    assertNoNewForks(db)  -- throws, naming both halves, if the detector returns rows

This is the consolidation already applied to `toSlug`, where the writer and
reader of a link share one implementation so they cannot drift.

## Migration

**30 invocations across 29 files.** The RPC signature stays
backwards-compatible, so nothing breaks on the way; each call site moves to the
helper, and each loader gains an `assertNoNewForks(db)` before it reports
success.

**16 direct-insert sites** are left alone. They bypass the RPC, but with no
insert-time guard there is nothing for them to bypass — they are covered by the
same load-end detection as everything else.

## Backfill — and one live risk this closes

Seed aliases for the two merges already performed:

    "Birchwood"             -> Birchwood Village (MN)
    "Marine On Saint Croix" -> Marine on Saint Croix (MN)

⚠⚠ **This is not tidying; it closes an open hole.** Both merges removed a row
whose name the publisher has already printed. If MN OSA republishes any
FY2012-2020 figure under `Birchwood`, today's loader finds no match and
**creates the entity again**, re-forking the city merged in #185.

## Testing

**The validation pattern is established and must be reused:** rebuild a known
fork, assert the mechanism fires, roll back, then verify the rollback. This is
how the detector was validated in #186 — an empty result from an unvalidated
check proves nothing.

1. **Detector fires** — rebuild the Birchwood fork; expect exactly that pair.
2. **Detector does not over-fire** — the ten known-good pairs above
   (`Bell`/`Bell Gardens` and the rest) must **not** appear. This is the
   regression test that the abandoned insert-time rule would have failed.
3. **Alias resolves** — `Birchwood` returns the survivor's id, and the
   survivor's **name is unchanged**.
4. **`distinct` suppresses** — resolving a pair `distinct` removes it from
   detector output permanently.
5. **A load fails on a new fork** — `assertNoNewForks` throws and names both
   halves.
6. **Production is clean** — the detector returns zero.

⚠ CI runs no database; SQL-level proof lives in migration self-verification
blocks. Do not assume CI covers it — see `reference_ci_and_io_test_timeouts`.

## What this does not fix

- **A fork still gets created**, and lives until the end of that load. Only
  approach C prevents one.
- **Overlapping-year forks** (a re-load under a new name rather than a clean
  handover) are invisible to the detector.
- **A rename into an unrelated name** trips nothing, because nothing looks
  similar.
- **ev-accounts entity identity** is out of scope; this is TT's `treasury`
  schema only.

## Success criteria

1. Replaying the Birchwood fork makes the detector report it, and a load
   containing it **fails**.
2. The ten known-good pairs produce **zero** detector output.
3. A republished `Birchwood` resolves to Birchwood Village and creates nothing.
4. Every loader calls `assertNoNewForks` before reporting success.
5. The stored display name of an entity is never changed by a load.

## Open questions

1. **Who clears the review queue, and how?** No UI is proposed — resolution is
   a SQL statement. If anyone but Chris is expected to clear it, that needs a
   surface, and that is separate work.
2. **Which publisher gets approach C first? ✅ ANSWERED 2026-09-16: MN OSA, and
   the column is `GovEntityID`.**

   Measured against `docs/MN/cired_22_data.xlsx`, the real published file:

       GovEntityID is the FIRST of 149 columns
       852 entities, 852 distinct ids, 0 blank
       Birchwood Village = 168        Marine on Saint Croix = 593

   ⭐ **Approach C is available for the publisher that caused BOTH incidents.**
   That is the better outcome than expected, and it was nearly missed:
   `scripts/mnOsaTreeMap.json` lists `identity_labels` as Entity Name /
   ParentEntityName / Entity Type / GAAPInd / Population / FinancialYear, with
   no id — because the tree map only maps the labels the loader needs for the
   hierarchy. **The tree map is not the file.** Reading the actual header row is
   what found it.

   ⚠ **NOT YET PROVEN STABLE ACROSS YEARS.** Only one year's file is on disk,
   so `GovEntityID` is shown to be complete and unique WITHIN FY2022, not shown
   to survive a rename. The decisive test is cheap and should precede any C
   work: fetch an FY2020 file and confirm Birchwood is also 168 there, while its
   published name reads "Birchwood". If it is, approach C would have prevented
   the fork outright.

   ⚠ Note `Marine on Saint Croix` reads with a LOWERCASE "on" in the FY2022
   file, while TT holds the capital-O spelling for FY2014-2023. The publisher's
   capitalisation is not even stable within its own series — further argument
   for keying on the id rather than the name.
