# Stable-key loader identity — design

**Status:** proposed, 2026-09-15
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
| `detectForkedEntities.sql` (#186) | Finds forks that already exist | After the fact; must be run; cannot see overlapping-year forks |

The unique index is the right model and the wrong key. It makes a duplicate
**impossible from any path** rather than merely discouraged — but it keys on
the one thing publishers change.

## Decisions taken

1. **Both mechanisms.** A known rename resolves silently through an alias; an
   unknown name that trips the fork signature is refused.
2. **Quarantine, do not abort.** One suspicious entity is skipped and recorded;
   the other 1,855 units in the load proceed.
3. **The reviewer clears the queue, and clearing it admits the entity.** The
   decision is recorded permanently in data, so it never re-trips.
4. **Approach A now, approach C incrementally** (see *Chosen approach*).

## Chosen approach

**A — alias table plus a trigger guard.** Name remains the lookup key. A new
`municipality_aliases` table maps alternate published names onto an existing
entity. A `BEFORE INSERT` trigger on `treasury.municipalities` refuses a name
that trips the fork signature.

Universal: works for every publisher with no per-source work, and reuses a
signature already validated against a real fork.

**C — the publisher's own stable ID — is the better identity, incrementally.**
Most publishers (MN OSA, IN Gateway, FL DFS) emit a unit identifier that does
not change when they re-spell a name. Keying on `(data_source,
source_entity_key)` removes names from identity altogether. It is per-loader
work and only possible where a publisher exposes an ID, so it is adopted loader
by loader, storing its key in the same alias table.

**B — geoid as identity — is rejected.** It makes Census the single point of
failure for identity, 34 geographic entities legitimately have no geoid
(dissolved municipalities among them), and every loader would need name→geoid
resolution — the exact step that failed on 22 entities and required
hand-adjudication in #184. It moves the fragile matching earlier rather than
removing it.

⚠ **A does not prevent the first fork of an unknown rename.** It converts a
silent split into a loud quarantine. Only C prevents it, and only where the
publisher has an ID. This is the central limitation of the chosen approach and
should not be forgotten when judging whether the problem is "solved".

## ⚠⚠ The hard part: an INSERT has no budgets yet

`detectForkedEntities.sql` is reliable because it uses five signals. **Three of
them do not exist at INSERT time**, because the new entity has no budgets yet:

| Signal | Available in the detector | Available in the trigger |
|---|---|---|
| same state | yes | yes |
| related names | yes | yes |
| population proximity | yes | yes |
| one shared publisher | yes | **no** — no budget rows yet |
| adjacent non-overlapping years | yes | **no** — no budget rows yet |

So the trigger must decide on name, state, entity_type and population alone.
That is a weaker test and will produce false positives. The design absorbs this
in two ways: the rule is deliberately narrow (below), and a false positive costs
one queue entry rather than a wrong write.

### The insert-time rule

Refuse the insert when **all** hold against an existing row in the same
`state` and `entity_type`:

1. **Whole-word containment.** The normalised candidate name extends an
   existing name, or vice versa — `birchwood village` ⊃ `birchwood`. Normalise
   by folding accents, lowercasing, collapsing non-alphanumerics to spaces, and
   stripping leading/trailing designators (`city`, `town`, `township`,
   `village`, `borough`, `municipality`).
2. **Population within 25%** — *when both are known*.

   ⚠ `p_population` defaults to `0` and many loaders pass nothing, so an
   unknown population is the common case, not the edge case. When either side
   is `0` or `NULL` the population test **cannot discriminate, and the rule
   falls back to containment alone — that is, it still refuses.** This is
   deliberate: a false quarantine costs one queue entry that a human clears in
   seconds, while a missed fork silently severs a city's history and is found
   only by accident, if ever. The asymmetry is the whole point of the feature.

⚠⚠ **Containment, not trigram similarity.** This is the single most important
choice in the rule. Michigan and Pennsylvania disambiguate same-named townships
by appending a county — TT holds 117 township names covering 302 townships. A
trigram threshold refuses `Washington, Oakland` because `Washington, Macomb`
exists, and a 1,856-unit MI load would generate hundreds of false quarantines
on its first run. Under containment neither name extends the other (both carry
a distinct suffix), so both pass. Verified shapes:

    Birchwood Village  ⊃ Birchwood                      REFUSE   (true fork)
    Springfield Township ⊃ Springfield                  REFUSE   (false positive, reviewed once)
    Washington, Oakland vs Washington, Macomb           PASS     (neither contains the other)
    Marine On Saint Croix vs Marine on Saint Croix      already impossible — unique index

3. **Not already resolved by an alias.** Alias lookup happens before the guard.

### Where the guard lives

In a **`BEFORE INSERT` trigger**, not in the RPC. Measured: **16 sites insert
into `treasury.municipalities` directly**, bypassing `treasury_ensure_municipality`
entirely. A guard in the RPC would leave sixteen open doors. This follows the
reasoning already written into the unique index: *the RPC is the polite path,
not the only one.*

The trigger raises a dedicated SQLSTATE so callers can distinguish a fork
refusal from any other failure.

## Components

### 1. `treasury.municipality_aliases`

    municipality_id   uuid not null references treasury.municipalities(id) on delete cascade
    alias_name        text not null
    state             text not null
    entity_type       text not null
    source            text            -- the publisher that printed this spelling, when known
    source_entity_key text            -- approach C's stable key, when the publisher has one
    note              text not null   -- why this alias exists
    created_at        timestamptz not null default now()

    UNIQUE (lower(alias_name), state, entity_type)
    UNIQUE (source, source_entity_key) WHERE source_entity_key IS NOT NULL

The second unique constraint is where approach C lands with no further schema
work: a loader that knows the publisher's ID writes it here, and lookup by
`(source, source_entity_key)` takes precedence over name entirely.

⚠ **A name is either an entity or an alias, never both** — and no database
constraint can express that across two tables. It is enforced by a `BEFORE
INSERT OR UPDATE` trigger on `municipality_aliases` that refuses an
`alias_name` matching an existing `municipalities` row on
`(lower(name), state, entity_type)`, plus the symmetric check in the
`municipalities` trigger. Without both halves, an alias could shadow a real
entity and silently redirect its loads — a worse failure than the one this
design exists to prevent.

### 2. `treasury.municipality_fork_reviews` — the quarantine queue

    id                uuid primary key default gen_random_uuid()
    candidate_name    text not null
    state             text not null
    entity_type       text not null
    population        integer
    suspected_id      uuid references treasury.municipalities(id)  -- what it looked like
    source            text            -- which loader hit it
    status            text not null default 'open'   -- open | alias | distinct
    resolved_by       text
    resolved_at       timestamptz
    note              text
    created_at        timestamptz not null default now()

    UNIQUE (lower(candidate_name), state, entity_type)

**Clearing the queue is the escape hatch.** Two terminal states:

- `alias` — it is the same city. Resolving writes a `municipality_aliases` row
  pointing at `suspected_id`. The next load resolves silently, forever.
- `distinct` — it is genuinely a new government. Resolving records that
  decision, and the trigger consults it: a candidate with a `distinct` review
  is admitted. It never re-trips.

The unique index means a repeated load re-hits the same row rather than piling
up duplicates.

### 3. `treasury_ensure_municipality` — lookup order

    1. (source, source_entity_key)   -- approach C, when the caller supplies it
    2. lower(name) + state + entity_type          -- today's behaviour
    3. lower(alias_name) + state + entity_type    -- new: known renames
    4. INSERT  -- which the trigger may refuse

Gains two optional parameters, `p_source` and `p_source_entity_key`, both
defaulting to NULL so **all 30 existing call sites keep working unchanged**.

⚠ Existing behaviour that must not regress: when a row is found, the stored
name is left alone even if the incoming casing differs. `?entity=` slugs derive
from `name`, so rewriting it on load would invalidate every shared link. The
same applies to an alias hit — resolving through an alias must **never** rename
the entity.

### 4. `scripts/lib/ensureMunicipality.mjs` — the shared helper

All 29 calling files are ESM (13 `.js`, 16 `.mjs`), so one module serves them
all. It wraps the RPC, catches the fork SQLSTATE, records the review row, and
returns a discriminated result:

    { id: uuid }                      -- resolved or created
    { quarantined: true, review_id }  -- skip this entity, keep loading

This is the same consolidation already applied to `toSlug`, where the writer
and reader of a link share one implementation so they cannot drift.

## Migration

**Call sites: 30 invocations across 29 files.** The RPC's signature is
backwards-compatible, so the sites compile unchanged; each must be edited to
handle the `quarantined` result rather than assuming an id. Uniform shape
today:

    const { data, error } = await db.rpc('treasury_ensure_municipality', {...});
    if (error) throw ...;

**16 direct-insert sites** are not migrated. They hit the trigger and fail as an
ordinary error. Most are one-off seeders (`insertLeonardtownMunicipality.js`,
`seedFlorida.mjs`); a hard failure there is acceptable and correct. They are
listed in the plan so the choice is deliberate rather than accidental.

## Backfill — and one live risk this closes

Seed aliases for the two merges already performed:

    "Birchwood"             -> Birchwood Village (MN)
    "Marine On Saint Croix" -> Marine on Saint Croix (MN)

⚠⚠ **This is not tidying; it closes an open hole.** Both merges removed a row
whose name the publisher has already printed. If MN OSA republishes any FY2012-2020
figure under `Birchwood`, today's loader finds no match and **creates the entity
again**, re-forking the city we just merged. The alias makes the old spelling
resolve to the survivor permanently.

## Testing

**The validation pattern is established and should be reused:** rebuild a known
fork inside a transaction, assert the mechanism fires, roll back, then verify
the rollback. This is how `detectForkedEntities.sql` was validated in #186 —
an empty result from an unvalidated guard proves nothing.

1. **Trigger fires** — insert `Birchwood Village` alongside `Birchwood`; expect
   refusal with the fork SQLSTATE.
2. **Trigger does not over-fire** — insert `Washington, Oakland` alongside
   `Washington, Macomb`; expect success. This is the MI/PA regression test and
   the one most likely to break under a future rule change.
3. **Alias resolves** — with an alias seeded, `Birchwood` returns the survivor's
   id, and the survivor's **name is unchanged**.
4. **`distinct` review admits** — resolve a review to `distinct`, re-run,
   expect the insert to succeed.
5. **Quarantine does not abort** — a load containing one tripping entity and
   several clean ones loads the clean ones and returns one review row.
6. **Direct insert is still guarded** — a raw `INSERT` bypassing the RPC is
   refused.
7. **Detector agrees** — `detectForkedEntities.sql` returns zero afterwards.

⚠ CI runs no Python and does not exercise the database; these are SQL-level
tests run the way the migration self-checks are run. Do not assume CI covers
them — see `reference_ci_and_io_test_timeouts`.

## What this does not fix

- **The first fork of an unknown rename** still stops the entity, rather than
  resolving it. Only approach C prevents it.
- **Overlapping-year forks** (a re-load under a new name, rather than a clean
  handover) are invisible to both the trigger and the detector.
- **A genuine renaming into an unrelated name** (a town incorporating under a
  new name) trips nothing, because nothing looks similar.
- **Entity identity in ev-accounts** is out of scope; this is TT's `treasury`
  schema only.

## Success criteria

1. Replaying the Birchwood fork against the new schema produces a **quarantine
   row, not a second entity**.
2. A 1,856-unit Michigan load produces **zero** false quarantines.
3. All 30 call sites handle the quarantined result; no load aborts on one
   entity.
4. `detectForkedEntities.sql` returns zero, and the aliases for both historical
   merges are present.
5. The stored display name of an entity is never changed by a load.

## Open questions

1. **Who reviews the queue, and how?** No UI is proposed — resolution is a SQL
   statement today. If the queue is expected to be cleared by anyone other than
   Chris, it needs a surface, and that is a separate piece of work.
2. **Which publisher gets approach C first?** MN OSA is the obvious candidate,
   having caused both incidents — but only if its files actually carry a stable
   unit ID, which has not been verified. That check should precede any C work.
