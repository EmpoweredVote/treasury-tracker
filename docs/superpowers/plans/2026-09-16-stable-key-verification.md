# Stable-key loader identity — verification record

**Run 2026-09-16.** Every command below was executed; the output is transcribed,
not summarised. Anything that did not pass is stated.

## Database state, before and after

| | before | after |
|---|---|---|
| municipalities | 8,182 | 8,182 |
| budget rows | 287,017 | 287,017 |
| Birchwood Village budgets | 24 | 24 |
| Birchwood Village money | $12,165,239 | $12,165,239 |
| forked cities detected | 0 | 0 |

**No production data moved.** Every probe ran inside a transaction or was undone
in the same migration.

## Migrations applied

    20260916090000  municipality_aliases
    20260916091000  municipality_fork_reviews
    20260916092000  detect_forked_entities_fn
    20260916093000  ensure_municipality_alias_lookup
    20260916094000  seed_historical_aliases
    20260916095000  expose_detect_forked_entities

Each self-verifies. Each was also verified independently afterwards with a
separate read, because a migration's own success report is not evidence.

## 1. The alias path resolves, and creates nothing

```sql
select public.treasury_ensure_municipality('Birchwood', 'MN', 'city', 863) as resolved,
       (select id from treasury.municipalities
         where state='MN' and lower(name)='birchwood village') as expected;
```

    resolved  = b7291e76-2c08-4719-925f-93c7f952149a
    expected  = b7291e76-2c08-4719-925f-93c7f952149a
    total_rows = 8182        (unchanged — nothing was created)

✅ A republished `Birchwood` now lands on the surviving city.

## 2. Without the alias, the detector catches the real fork

The alias was deleted and the pre-#185 fork rebuilt inside a transaction:

    forks_detected      = 1
    pair                = Birchwood  <->  Birchwood Village   gap=0  sim=1.00
    via_public_wrapper  = 1

✅ Caught, and caught through the same `public.detect_forked_entities()` wrapper
the loaders call — not just the inner function.

## 3. The rollback left nothing behind

    total_rows        8182
    birchwood_rows       1
    alias_restored       1
    forks                0
    birchwood_budgets   24
    birchwood_money     12165239
    probe_leaked         0

## 4. The ten known-distinct pairs stay silent

Asserted inside `20260916092000`'s self-check, so it is a permanent regression
test rather than a one-off observation:

    Bell/Bell Gardens · Chino/Chino Hills · Avon/Avon Lake · Bedford/Bedford Heights
    Braddock/Braddock Hills · Langhorne/Langhorne Manor · Warren/Warren Park
    Madison/Madison Lake · Lake City/Lake Mary · Pine City/Pine Island

✅ Zero reported. These are the ten that killed the insert-time guard.

## 5. Gates

    npm test        124 files / 2,478 tests   green
    npm run build   clean
    npm run check:forks   "OK — no forked cities."   exit 0
    node --check    0 syntax failures across 29 modified loaders
    direct .rpc('treasury_ensure_municipality') calls outside the helper: 0

`check:forks` was also run on its failure paths: a fork listing exits 1 with
resolution guidance; a transport failure exits 1 *without* it.

## ⚠ What did not go to plan

**1. The insert-time guard was removed before implementation.** Measured against
the live table, ten existing pairs satisfied its rule and all ten were distinct
governments — a 100% false-positive rate. Enforcement moved to the end of a
load, where the temporal signals exist. Spec and plan were revised first.

**2. The call-site transformation nearly shipped 32 deleted error guards.** The
first version stripped `if (error) ...` with a global regex: 62 removals instead
of 30, including `RPC transport error` guards unrelated to this work. Reverted
and rewritten to match each call with its own adjacent check. Final audit: 25
removed, every one the RPC's own, and 30 − 5 unchecked calls = 25 reconciles.

**3. `check:forks` reported success and exited 127.** A libuv assertion on
Windows from `process.exit()` with open handles. A check that passes while
exiting non-zero is worse than no check. Now sets `process.exitCode`.

**4. The Marine alias was refused, correctly.** Task 1's guard rejected it: a
name cannot be both an entity and an alias. Marine's spellings differ only in
case, which #182 already absorbs, so no alias was needed. The seed is Birchwood
only.

## ⚠ Success criteria not met

The spec says **"every loader calls `assertNoNewForks` before reporting
success."** It does not. The 29 loaders do not share a shape — 18 have a
locatable `main()`, 8 declare no client under either common name, most create
the client inside `main()` — so enforcement became an advertised
`npm run check:forks` instead, matching the repo's existing `verify:frozen`
convention. Chris chose this over partial enforcement or 29 hand edits.

**The check is global, so one run sees what a per-loader call would. What is
lost is that nothing forces you to run it.**

## Still open

- **Approach C for MN OSA is now unblocked**: `GovEntityID`, first of 149
  columns, 852/852 distinct, 0 blank. Not yet proven stable across years — only
  one year's file is on disk. Fetch an FY2020 file and confirm Birchwood is also
  `168` there while its published name still reads `Birchwood`. If it is,
  approach C would have prevented the fork outright.
- No loader passes `source` / `sourceEntityKey` yet; the plumbing exists.
- No review-queue UI. Resolution is a SQL statement.
- Overlapping-year forks and renames into unrelated names remain undetectable.
