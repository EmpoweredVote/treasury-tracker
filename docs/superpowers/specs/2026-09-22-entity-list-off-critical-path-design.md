# Taking the entity list off Treasury Tracker's critical path — design

**Status:** proposed, 2026-09-22.
**Decision owner:** Chris
**Related:** #197 + ev-accounts#571 (the `?slug=` fast path, financials only), #125 (summary mode), #213 (request dedupe + the entity-object loader), `project_financials_page_load_perf`

## The problem

Every Treasury Tracker page load fetches `GET /api/treasury/cities?datasets=summary`:
**8,149 rows, 3.05 MB decoded** (403 KB brotli). Measured on production 2026-09-22.

It is not a transfer problem and not a cold start — both were ruled out in the
09-20 investigation and re-confirmed here. It is one large query and one large
response, and its server time is what a reader feels.

**⭐⭐ THE SYMPTOM IS VARIANCE, WHICH IS WHY IT KEEPS GETTING DISMISSED.** Two
loads of the *same* production URL, minutes apart, nothing changed between them:

    https://treasurytracker.empowered.vote/?entity=los-angeles-ca&year=2024

    run 1    first figure on screen   12,148 ms
    run 2    first figure on screen    3,168 ms

A single fast measurement does not clear this page. The recorded p95 for
`/cities` alone is 4.5–4.9 s.

**⚠ The payload is O(total entities) and grows with every statewide load** —
1,144 → 8,149 so far (MI, PA, FL, IN, MN, SC). Trimming the constant does not
stop that. Not fetching it does.

## Why #197 did not already fix this

ev-accounts#571 added `?slug=`, and it works: production request 1 on the
financials host is a 311-byte lookup. But `loadBudgetData` then resolved a
municipality **name** against the full list two layers down, so the 3.05 MB
arrived anyway. #213 fixed that by passing the entity object the caller already
held, and the financials host now loads **1.17 MB in ~1.0 s**, down from
4.31 MB in ~2.6 s.

Treasury Tracker did not benefit, because its own panels and switcher genuinely
consume the list. That is what this design removes.

## What actually consumes the list

Measured by reading every `municipalities` reference in `App.tsx`.

| Consumer | Needs | Renders on |
|---|---|---|
| `jurisdictionParents` | federal + state-by-abbrev + county-by-id | every page |
| `EntitySwitcher` | substring search + "N places" count | every page, **only when opened** |
| `AlphaLanding` | search over everything | landing / not-found only |
| `StatesInFederalPanel` | `entity_type = 'state'` | federal page |
| `CitiesInCountyPanel` | `county_id = X` ∧ city-tier | county page |
| `CountiesInStatePanel` | `state = X` ∧ `entity_type = 'county'` | state page |
| `CitiesInStatePanel` | `state = X` ∧ not state/federal/county/nonprofit | state page |

**⭐ THE KEY FINDING: ALL FOUR PANELS ARE GATED ON `entity_type` OF
FEDERAL / COUNTY / STATE. A CITY PAGE RENDERS NONE OF THEM.** The common case
needs the list for exactly two things — three parent rows, and a switcher
nobody has opened yet.

`navigateToEntity(entity, list)` is not a consumer; it only calls
`setMunicipalities(list)`.

## Sizing, measured

    current  ?datasets=summary                        8,149 rows   3.05 MB
    lean index (id,name,state,type,county_id,has_data)             1,127 KB   36.1%
    a city page's real need (~52 rows)                             ~20 KB

`dataset_summary` is most of the weight. A lean index is a 3× win; not fetching
it on a city page is the whole win.

## Design

### 1. Backend — `ev-accounts`, additive only

`GET /api/treasury/cities` gains four optional parameters:

| Param | Meaning |
|---|---|
| `?entity_type=city,town,village` | CSV; rows whose `entity_type` is in the set |
| `?state=CA` | exact match on `m.state` |
| `?county_id=<uuid>` | exact match on `m.county_id` |
| `?fields=index` | lean column set + a `has_data` boolean |

**⚠⚠ THE FIRST THREE ARE WHERE CLAUSES ON THE EXISTING QUERY AND NOTHING ELSE** —
same `LEFT JOIN`, same `GROUP BY m.id`, same `HAVING COUNT(b.id) > 0 OR (county
with children)`, same columns, same `ORDER BY m.name`. A row that comes back is
byte-for-byte the row the unfiltered list would have carried. This is the
property `?slug=` established and it is what makes the filters safe to adopt
incrementally.

**⚠ An unmatched filter returns `[]`, never a substitute.** Same rule as
`?slug=`; it is what stops a bad link rendering a different government's budget
(TT #158).

**⚠ `?fields=index` is the only one that changes COLUMNS**, so like
`datasets=summary` it is strictly opt-in. Absent or unrecognised, the response
is byte-for-byte what it is today. This endpoint is a cross-app contract;
trimming it by default would be a silent breaking change for every other
consumer.

**⚠⚠ THE SERVER MUST NOT LEARN WHAT "CITY-TIER" MEANS.** The client sends the
type list; the API only filters by what it is given. `CITY_TIER_TYPES`
(`src/utils/cityTierTypes.ts`) is deliberately the ONE definition, with
`tests/cityTierTypes.test.mjs` asserting other copies match it — because four
divergent copies once made PA's 949 boroughs invisible to coverage matching and
to their own county's panel, while three verification scripts each held a copy
saying it was fine. A server-side notion of "city tier" would be a fifth copy,
in another repo, beyond that test's reach.

**Combining:** parameters AND together. `?state=CA&entity_type=county` is
California's counties.

**Validation, and the distinction matters:**

- an `entity_type` value that is not a known type is a **422** — it is a
  caller bug, and answering `[]` would let a typo read as "no such places"
- a well-formed filter that matches nothing is **`[]`** — the `?slug=` rule
- `?state=` is not validated against a list of states; an unknown one simply
  matches nothing and returns `[]`

Caching is unchanged (`public, max-age=300, stale-while-revalidate=3600`).

### 2. Frontend — each consumer asks for what it needs

| Consumer | Request | Rows |
|---|---|---|
| `jurisdictionParents` | `?entity_type=state,federal` + `/cities/:county_id` | ~52 |
| `StatesInFederalPanel` | `?entity_type=state` | 50 |
| `CitiesInCountyPanel` | `?county_id=X&entity_type=<CITY_TIER_TYPES>` | tens |
| `CountiesInStatePanel` | `?state=X&entity_type=county` | tens |
| `CitiesInStatePanel` | `?state=X&entity_type=<its own list>` | hundreds |
| `EntitySwitcher` | `?fields=index`, **on first open** | 8,149 lean |
| `AlphaLanding` | `?fields=index`, when that view renders | 8,149 lean |

A city page goes from 8,149 rows to ~52, and no page has a large fetch on its
critical path.

The `?slug=` entity-resolution fast path, today gated to the financials host,
**widens to every host** — it was gated only because TT's parents needed the
list, which after this they do not.

### 3. Deploy ordering — designed not to matter

The API ships first, but TT must tolerate an API that ignores the new
parameters, which is exactly today's behaviour (verified: `?entity_type=state`
returns a byte-identical full payload, md5 `a20cf5b3…`).

**⚠⚠ THEREFORE EVERY CONSUMER KEEPS ITS CLIENT-SIDE PREDICATE.** The fetch
narrows the response; the predicate still filters what arrives. Against an old
API the page renders correctly and merely slowly. This is #197's own device —
re-derive rather than trust the server filter — and it buys a second property:
a future drift between filter and predicate shows up as a visibly wrong list,
not as silent substitution.

### 4. Testing

**Backend contract tests** — the ones that matter are about identity, not counts:

- a filtered row is a MEMBER of the unfiltered set, byte-for-byte
- an unmatched filter returns `[]`, never a row
- no parameters → response byte-identical to today
- `?fields=index` omits the heavy columns and carries `has_data`

**Frontend tests** — each consumer requests its narrow URL, AND still filters
client-side, so a stale API is safe.

**Browser measurement** — before/after payload and time-to-first-figure on a
city, county, state and federal page. **⚠ Repeated, not once:** the defect's
signature is variance, and a single fast run proves nothing. This is also the
only check that sees the real result; no test in this repo renders TSX.

## Risks

- **The switcher's "N places with data" count** is computed over the full list.
  It moves to the lean index and is therefore unknown until the index loads. It
  needs a deliberate loading state — rendering `0 places` would be a false
  statement about coverage, which is worse than rendering nothing.
- **`AlphaLanding` still pulls 1.1 MB** on the landing/not-found view. That is
  the page whose job is browsing, so it is accepted here and paginated later
  rather than widening this change.
- **Opening the switcher costs 1.1 MB once.** Acceptable — it is a deliberate
  action, and it is 36% of what every page pays today.

## ⚠ A discrepancy found while writing this, NOT fixed here

`CitiesInCountyPanel` selects city-tier with `CITY_TIER_TYPES` (six types).
`CitiesInStatePanel` selects it by EXCLUSION — anything that is not state,
federal, county or nonprofit. Today those agree **by accident**: the only types
present are `city, town, township, village, borough, municipality, county,
state, nonprofit, federal`. They diverge the moment a `special_district` or any
new type is loaded, and then a place appears in its state's list but not its
county's.

This design preserves each panel's CURRENT behaviour exactly — each sends its
own type list — so nothing changes silently. Reconciling the two is a separate
decision and belongs in its own change.

## Out of scope

- Server-side `?q=` search for the switcher (the option that would make nothing
  O(entities)); revisit if the 1.1 MB index proves too heavy in practice.
- Paginating `AlphaLanding`.
- The double `?slug=` lookup on the financials host (311 bytes each).
- Reconciling the two city-tier definitions above.
