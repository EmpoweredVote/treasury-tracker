# Typing a government the current census vintage cannot name — design

**Status:** proposed, 2026-10-19.
**Decision owner:** Chris
**Related:** `scripts/buildGaStatewideEntities.mjs`, `scripts/data/gaRlgfAnomalies.mjs`
(`GA_OUT_OF_SCOPE_FINDINGS`), `scripts/data/flCensusAliases.mjs` (`FL_DISSOLVED`),
`scripts/buildFlStatewideEntities.mjs`, #273 (GA FY2009–2015),
`reference_entity_type_declarations`, `feedback_milledgeville_rule`,
`reference_stacked_prs_get_no_ci`

## The problem

TT types an entity **from the census** — `entity_type` and population both — and
never from the word a publisher prints. That discipline is load-bearing and was
measured into place: in Georgia alone, DCA's own City/Town designator
**contradicts the census's in 20 of 530 municipalities**, so a government typed
from DCA's string would be typed wrong twenty times over.

The census file TT reads is **Vintage 2024**. A 2024 vintage cannot name a
government that stopped existing before 2024. So the discipline that protects
every live entity silently refuses every dead one, and the refusal is total:
no type, therefore no entity, therefore no rows.

In Georgia this holds out **43 verified filings** — fetched, converted, oracled,
nothing left to measure. They are not one problem but two:

| | filings | why held out |
|---|---|---|
| 7 municipalities | 37 | the census cannot name them → cannot type them |
| Bibb County FY2009–13, Echols County FY2009 | 6 | the census names both counties fine; they have **no registry entry** (`GA_FIRST_YEAR = 2016`, absorbed-county CICOIDs) |

⚠ The second group is an **identity-across-consolidation** problem that has been
filed under the typing heading. Separating them is most of the work here.

⚠ **43 is the FY2009–2015 count, and it is not the whole recovery.** Ranger and
Sunny Side still file — from FY2017 and FY2016 — and the FY2016–2025 municipal
sweep refused them for this same census reason, recording it as "Ranger and
Sunny Side have NO census row — refused, not guessed". Typing them unblocks
those years as well, in a window already loaded for every other municipality.
The plan must count the recovered filings on both sides of FY2015 rather than
inheriting 43 from this document.

**This is not Georgia-specific.** `cache/` holds `sub-est2024_NN.csv` for **26
states** and nothing older, so every state TT has loaded carries the same blind
spot for any government that ended before 2024.

## What was measured

All of it on 2026-10-19, from free keyless Census Bureau files under
`https://www2.census.gov/programs-surveys/popest/datasets/`.

### Every one of the seven *is* nameable — just not by Vintage 2024

| DCA name | CICOID | filings | census name | type | PLACE FIPS | newest vintage naming it |
|---|---|---|---|---|---|---|
| Ranger Town | 2064902 | FY2009 | `Ranger town` | town | 63560 | **2019** |
| Sunny Side City | 2126003 | FY2009–2015 | `Sunny Side city` | city | 74572 | **2019** |
| Helena | 2134001 | FY2009–2014 | `Helena city` | city | 37816 | **2014** |
| McRae | 2134004 | FY2009–2014 | `McRae city` | city | 49084 | **2014** |
| Payne City | 2011002 | FY2009–2013 | `Payne city` | city | 59584 | **2014** |
| Riverside Town | 2035008 | FY2009–2015 | `Riverside town` | town | 65604 | **2014** |
| Macon City | 2011001 | FY2009–2013 | `Macon city` | city | 49000 | **2013** |

So the answer to the question in the title is **not a new authority and not a
human judgement**: it is *the newest census vintage that can name the
government*. The type still comes from the census, and the vintage that supplied
it is recorded alongside it.

⭐ In all seven, the census's type token happens to agree with DCA's word. That
is a result, not a reason — the point is that the type is now **sourced**
rather than asserted, so the twenty known contradictions cannot reach a
recovered entity either.

### The census retired Macon's place code rather than continuing it

| vintage | PLACE 49000 | PLACE 49008 |
|---|---|---|
| 2013 | `Macon city` | — |
| 2014 | — | `Macon-Bibb County` |
| 2019 | — | `Macon-Bibb County` |
| 2024 | — | `Macon-Bibb County` |

⭐ The Census Bureau treats the 2014 consolidation as **a new government, not a
continuation of Macon**. That is independent corroboration for refusing to
splice a predecessor's series onto Macon-Bibb's — the decision taken below.

### Vintage 2024 drops exactly the two governments in question

Diffing the Georgia SUMLEV-162 rosters:

    Vintage 2019   538 places
    Vintage 2024   537 places

    present 2019, absent 2024:   Ranger town, Sunny Side city
    new in 2024:                 Mableton city        (incorporated 2022)

Two removals, and they are **precisely** the two extant governments DCA still
shows filing — Sunny Side from FY2016, Ranger from FY2017. This is not a
systematic artefact of the estimates programme; the Census Bureau believes
these two ceased to exist, and Georgia's publisher does not.

⚠⚠ **Why they disagree is NOT measured.** Georgia dissolves inactive
municipalities by statute, and `MosRptd` is already known to lie about stubs
(Talbot, Georgetown-Quitman — only the money finds them), so a post-2019
"filing" may be an empty shell. **Nothing in this design assumes an answer.**

## Decisions taken

Both Chris's, 2026-10-19:

1. **Bibb County FY2009–2013 loads as its own entity**, with no series
   continuity to Macon-Bibb. Bibb alone reports $92.0M–$115.7M operating;
   Macon-Bibb reports $195.3M in FY2016. Appending one to the other shows a
   ~1.7x step that reads as growth and is a change of scope — the Fulton
   FY2017/FY2018 reader-distortion shape, where 92% of an apparent jump was not
   growth at all.
2. **Scope = a general helper, Georgia wired to it now, plus a read-only audit**
   of the other 25 loaded states. The audit prices the gap elsewhere instead of
   leaving "not Georgia-specific" as a belief.

## Design

### 1. `scripts/lib/censusVintages.mjs` — the vintage ladder

One module, callable by any state loader.

```
resolvePlace(stateFips, publisherName, opts) →
    { censusName, entityType, placeFips, vintage, population, how }
  | { why: 'named by no vintage of 2024, 2019, 2014, 2013' }
```

It walks the ladder **newest → oldest** and stops at the first vintage that
names the government, so the answer always reflects the most current legal
status available. It reuses the existing `joinPlace` suffix → legal → retyped
cascade **per vintage**, in that order, so the `Garden City` / `Peachtree City`
legal-name trap stays handled on older vintages too.

The ladder ships as `[2024, 2019, 2014, 2013]`, which spans the 2010s series and
covers all seven cases. It is a parameter, not a constant buried in a function:
a government that died before 2010 needs the 2000s series appended, and that
should be a caller's decision rather than an edit.

**`vintage` is part of the return, never optional.** An entity typed by a
non-current vintage must carry which one typed it, or the recovered entity is
exactly the unsourced estimate that `project_state_node_unsourced_estimates` was
about.

Two constraints that are design, not detail:

* ⚠⚠ **Read columns by header name, never by position.** The 2013 layout has no
  `PRIMGEO_FLAG`, so `NAME` sits at index 7 in 2013 and index 8 from 2014 on.
  Positional reads return `Georgia` for every name — which is how the first
  probe of the 2013 file failed, visibly and harmlessly, but a positional read
  inside a loader would have typed four governments `Georgia`.
* ⚠⚠ **Tests read committed fixtures, never `cache/`.** `cache/` is gitignored;
  a test reading it passes locally and takes the whole file down in CI. That is
  `reference_stacked_prs_get_no_ci`, and it cost #268 and #269 a merge.

A separate fetch script populates `cache/` for a state and ladder; the fixtures
are small committed GA slices, the way SC already does it.

### 2. Georgia

* `GA_FIRST_YEAR` 2016 → 2009.
* The `no-population` refusal becomes a ladder call. A government named by no
  vintage is still refused, and the refusal now lists every vintage tried.
* Recovered entities carry `censusVintage` and `placeFips`, and
  `population: null` — the honest value when no current estimate exists, and
  consistent with FL's two dissolved municipalities and the 17 already in TT.
* ⚠⚠ **The type is identity, not presentation.** `treasury_ensure_municipality`
  keys on `(name, state, entity_type)`, so the ladder's answer decides whether a
  row joins an entity or silently creates a second one. The build asserts that
  no recovered entity collides with an entity already loaded.
* 6 absorbed-county CICOIDs gain registry entries.
* ⚠ A recovered government loads **its whole filing history**, not just
  FY2009–2015. Ranger and Sunny Side have FY2016+ filings the municipal sweep
  refused for this same reason; they are in scope here because the cause is the
  same and leaving them would split one government's series across two changes.

### 3. Bibb, Echols, and the contradiction

**Bibb — a separate entity.** `Bibb County`, FY2009–2013, its own county
government, which genuinely existed until 2014. Asserted never to gain an
FY2014+ row, and Macon-Bibb asserted never to extend below FY2014. Nothing
splices, in either direction.

**Echols — an alias.** Its FY2010 county-prefix filing reports operating
$2,679,270, **identical** to the Echols County CG FY2010 filing already loaded
under `3050050`. Echols has no municipalities, so the unified government covers
the same territory and the same money: this is one government under two CICOIDs,
and FY2009 is a genuine continuation of the series TT already shows.

⚠⚠ `GA_ALL_ENTITIES` currently forbids two CICOIDs mapping to one entity **by
assertion, and that assertion is load-bearing** —
`project_sync_city_budget_not_source_safe`: a second entity would *duplicate*
rows rather than collide visibly. So the alias is explicit, not a relaxation:
the assertion changes from "no two CICOIDs share an entity" to "no two CICOIDs
share an entity **except by a declared alias**", and FY2010 — the single
measured overlap in the whole state — stays refused as a double-count.

**Ranger and Sunny Side — loaded and flagged.** Two sources contradict each
other and the Milledgeville rule says load it and flag it. The flag records the
measurement above. Which source is wrong is settled **by the money** — whether
the post-2019 filings carry figures or are stubs — and that measurement belongs
in the implementation plan, not in an assumption here.

### 4. The cross-state audit

Read-only, loads nothing: for each of the 26 states with a cached vintage,
report the entities its builder refused for a missing census row, and which
ladder vintage would name them. Output is a table to price the gap — whether any
of it is worth loading stays a separate decision per state.

### 5. Verification

* **TDD throughout**, against committed fixtures.
* Ladder tests: the newest naming vintage wins; a name in no vintage is refused
  and names every vintage tried; the 2013 layout is read correctly by header;
  the legal-name cascade still beats `retyped` on an older vintage; the seven
  resolve to exactly the (type, FIPS, vintage) triples in the table above.
* ⚠⚠ **The load asserts dollar totals** — not `tree.length`, not
  presence-of-amount. A `length === 0` guard put three $0 rows into production.
* Full ceremony: register deficit matches rows, `check:forks` clean,
  `verify:frozen` unchanged at **`62587 / 60098de6`**.
* ⚠ Sweep for blank Parts **before** the `--commit` load; the guard refuses one
  filing at a time and killed a run mid-write on Upson FY2010.
* ⚠ Long jobs are OOM-reaped: `--limit` / `--resume` / `--slice`, foreground.

## What this does not do

* **No retrofit of the other 25 states.** The audit reports; it does not load.
* **No new `entity_type` values.** Every recovered government types to `city`,
  `town` or `county`, all of which already exist in all six declarations. If a
  future state's ladder returns a type TT lacks, that is
  `reference_entity_type_declarations` work and a separate change — and the
  TS union must go first, or the rest is impossible.
* **No historical population series.** Population stays `null` for an entity no
  current vintage names. The naming vintage's figure is recorded in the registry
  so it is not lost, but nothing renders it; mixing vintages in a population
  column is a reader problem nobody asked to have.
* **No pre-2010 vintages.** The 2000s series is not fetched. Georgia's earliest
  filing is FY2009 and all seven resolve by 2013.

## Open questions, carried into the plan

1. **Why does Vintage 2024 drop Ranger and Sunny Side?** Measured that it does
   and that it drops nothing else; not measured why. Resolved by the money.
2. **How large is the gap in the other 25 states?** That is what the audit is
   for. If it is large, the per-state loads are their own scopes.
3. **Does any recovered Georgia entity collide with a loaded one?** Asserted
   rather than assumed — `Helena` and `McRae` against `McRae-Helena City`,
   `Macon City` against `Macon-Bibb County`, `Bibb County` against
   `Macon-Bibb County`. The names differ, so the expectation is no collision,
   but `treasury_ensure_municipality` keys on the type too and the assertion is
   cheap.
