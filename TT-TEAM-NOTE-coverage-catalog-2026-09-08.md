# Note for the Treasury Tracker team — a geoid-keyed coverage catalog, and the Bloomington fallback

**From:** Civic Spaces · **Date:** 2026-09-08
**Touches your repo:** Ask 3 is implemented (#158, merged). Asks 1 and 2 are requests only.
**Re:** Civic Spaces Phase 15 (shipped 2026-09-08), which deliberately shipped *without* a
Treasury Tracker row

Three requests. None of them needs Civic Spaces to change first, and all three stand on
their own merits.

**Status:** Ask 3 was a live bug affecting TT users who have never heard of Civic Spaces,
and it is **done — #158, merged 2026-09-08.** Asks 1 and 2 (the geoid key and the published
catalog) are still open, and are what the Treasury row in Civic Spaces waits on.

---

## Why we are asking

Civic Spaces places each member into civic slices (city, county, state, federal) and shows
a "Tools for This Community" box in the sidebar. We want a row that opens **that member's
own government budget in Treasury Tracker** — Federal tab to the federal budget, an
Indiana member's State tab to Indiana, a Bloomington member's City tab to Bloomington.

We could not do it safely, so we shipped the box with the Essentials row only. The blocker,
precisely:

- Civic Spaces knows a jurisdiction **only as a Census FIPS geoid** — 5-digit county, 
  7-digit place, 2-digit state prefix. That is what `civic_spaces.slices.geoid` stores, and
  that app never geocodes or stores addresses, so a geoid is all we will ever have.
- TT deep-links by **name-derived slug**: `?entity=<slug>`, where the slug is
  `` `${m.name.toLowerCase().replace(/\s+/g, '-')}-${m.state.toLowerCase()}` ``
  (`src/utils/entityRouting.ts` since #158; it was `src/App.tsx:72`).
- `grep -rn geoid supabase/migrations/` returns **nothing**. `municipalities` is
  `id / name / state / entity_type / population / county_id / hero_image_url`. So there is
  no key the two apps share.
- Constructing the slug from a name and hoping is unsafe *specifically because of Ask 3*.

Essentials already solved this in the other direction: it publishes a public catalog at
`essentials.empowered.vote/coverage.json`, and **you already consume it** in
`src/utils/essentialsCoverage.ts` (as you do CTC's collections list in
`triviaCoverage.ts`). We are asking you to publish the mirror of a thing you have already
built the client for — same shape, same conventions, so a consumer points one matcher at
either catalog.

---

## Ask 1 — put a geoid on TT entities

Add a `geoid` to `municipalities` and backfill the 2,812 rows.

| `entity_type` | geoid | Backfill source |
|---|---|---|
| `state` | 2-digit state FIPS | static table, 50 rows |
| `county` | 5-digit county FIPS | Census API by name + state |
| city-tier (`city`, `town`, `village`, `borough`, `municipality`, `township`) | 7-digit place FIPS | Census API by name + state |
| `federal` | none — consumers special-case it | n/a |
| `nonprofit`, `special_district`, `school_district`, `conservancy`, `library` | none / null | out of scope |

Notes for whoever does the backfill:

- 🔴 **A township is not a place.** Michigan and Pennsylvania minor civil divisions are
  keyed by *county subdivision* FIPS (10-digit), not place FIPS. Your own type union
  already carries the scars of that distinction (the `borough` comment in
  `src/types/budget.ts`). If one will not resolve cleanly, **leave it null.** Null is a
  correct answer; a wrong geoid is not.
- `county_id` already links a city row to its parent county — useful for disambiguating
  same-named places within a state.
- Expect genuine misses. Aim for a high-confidence subset, not full coverage.

**A cheaper variant, if the schema change is unwelcome:** you already resolve your own
entities to geoids at runtime by matching against Essentials' catalog
(`essentialsCoverage.ts`), so that match could run at build time to emit the catalog with
no new column. **We do not recommend it** — the geoids would only be as good as loose name
matching, and any entity Essentials does not cover would stay invisible to every consumer.
But it is real, and it is faster.

## Ask 2 — publish `/coverage.json`

Mirror Essentials' shape. The types you already consume are in
`src/utils/essentialsCoverage.ts`; reuse those field names.

**Values below are illustrative** — we have not verified these FIPS codes. Only the field
names and types are the request:

```json
{
  "generatedAt": "2026-09-08T00:00:00.000Z",
  "cities":   [{ "label": "Bloomington", "geoids": ["1805860"], "state": "IN", "slug": "bloomington-in" }],
  "counties": [{ "label": "Monroe County", "geoids": ["18105"], "state": "IN", "slug": "monroe-county-in" }],
  "states":   [{ "label": "Indiana", "abbrev": "IN", "slug": "indiana-in" }],
  "federal":  { "label": "United States", "slug": "<please fill in>" }
}
```

The one addition over Essentials' shape is **`slug`**, since you address entities by slug
rather than by geoid. Emitting it means no consumer ever reconstructs `toSlug` or drifts
from its definition in `src/utils/entityRouting.ts`.

We could not determine the **federal** entry from outside: you have an `entity_type` of
`federal` and a `/treasury/federal/context` endpoint, but the slug depends on that row's
`name` and `state`. Please fill it in — for us federal is one fixed link, so the value
matters more than the mechanism.

Requirements:

- **Omit an entity with no geoid** rather than emitting `geoids: []`. Absent means "we
  cannot key this"; an empty array invites a consumer to fall back to label matching.
- Include only entities that **have at least one budget dataset**. A row whose budget a
  member cannot actually read should not be advertised as coverage.
- Serve it CORS-readable (`Access-Control-Allow-Origin: *`) — public data, and cross-origin
  `fetch` is exactly how Essentials serves its own.
- Regenerate on deploy. `generatedAt` lets consumers see staleness.
- Keep it small. Essentials' is **29 KB for 247 records**; 2,812 in this shape should land
  in the low hundreds of KB. Past ~500 KB, split by tier (`/coverage/counties.json`) rather
  than making every consumer download all of it.

**Where to serve it from is your call, and we would like to know which you pick** — it
decides the URL we hardcode:

1. A static file in `public/`, like Essentials.
2. An endpoint on the shared API — `public/_redirects` already proxies `/api/*` to
   `ev-accounts-api.onrender.com`, and Civic Spaces already talks to `api.empowered.vote`,
   so this needs no new origin.

**On the public host**, we will use **`https://treasurytracker.empowered.vote`** (where the
landing page's TT card points, `ev-landing-main/index.html:1499`) unless you say otherwise.
Flagging a contradiction worth your attention: Essentials defaults `VITE_TREASURY_URL` to
`https://financials.empowered.vote` (`essentials/src/lib/treasury.js:10`), and that host is
the **EV Financials surface** — `src/App.tsx:158` sets `isFinancialsHost`, retitles the page
"Empowered Vote Finances", and defaults the entity to `empowered-vote-ca`. So Essentials may
be sending people to a surface branded as EV's own financials when they asked for a city
budget. Your call, not ours, but the two apps should agree.

## Ask 3 — 🔴 stop resolving an unknown entity to Bloomington

> ✅ **Done in #158** (merged 2026-09-08). An unmatched `?entity=` now resolves to an
> `entity_not_found` landing state that names the requested slug and offers the city
> search. The decision moved to `src/utils/entityRouting.ts`, which is now also the single
> definition of `toSlug` — `App.tsx` imports it for `syncURL` rather than keeping a second
> copy. 12 regression tests assert an unknown slug resolves to neither Bloomington nor
> `list[0]`. **The rest of this section is kept as the record of why.**

Independent of everything above, and the reason we will not ship a guessed link.

`src/App.tsx:415`:

```js
const listEntry = matched ?? list.find(m => m.name === 'Bloomington' && m.state === 'IN') ?? list[0];
```

When `?entity=` does not match, TT **silently renders Bloomington, Indiana's budget** — with,
as far as we can see, nothing on the page saying the requested entity was not found. Someone
who follows a link for their own county and reads Bloomington's numbers has been misinformed
in the quietest possible way. **A real budget for the wrong place is worse than no link**,
because nothing signals the error.

This reaches much further than Civic Spaces. It hits every stale bookmark and every shared
link — and because the slug derives from `name`, **renaming an entity silently invalidates
every link ever shared to it**, and each one lands on Bloomington.

What we would like instead: an unmatched `?entity=` shows a not-found state naming the
requested entity, with the picker available. Falling back to `list[0]` has the identical
problem and is not an improvement.

Two smaller notes in the same area:

- The Bloomington default reads like leftover development convenience — TT being a
  Bloomington-origin project — rather than a product decision. Worth confirming with Chris
  before anyone treats it as intended.
- `App.tsx:407` defaulting `entity` to `empowered-vote-ca` on the financials host is
  deliberate and should stay. It is only the *unmatched-slug* path we are asking about.

---

## What Civic Spaces does once this lands

One row added to a pure `buildToolRows` function (`src/lib/toolCoverage.ts`): match the
slice geoid against your catalog, take the `slug`, build `?entity=<slug>` with
`URLSearchParams`, render a Treasury Tracker row. No match, **no row** — the rule for this
feature is that a tool row appears only when a real deep link exists.

So **your coverage gaps are safe for us.** A missing entity means a missing row, never a
wrong link. What we cannot defend against is a link that *looks* resolved and is not, which
is Ask 3.

We treat the catalog as untrusted remote data, per the same T-125-01 rule your
`essentialsCoverage.ts` header sets out: hrefs built via `URLSearchParams`, never string
concatenation, and no `slug` interpolated into a URL.

## Acceptance, from the consumer side

1. `GET <host>/coverage.json` returns 200, JSON, CORS-readable cross-origin.
2. A known city, county and state each appear with a correct geoid and a `slug` that,
   passed as `?entity=`, lands on that entity.
3. Every entity in the catalog resolves — no catalog entry produces the not-found state.
4. `?entity=definitely-not-a-real-place-zz` shows not-found, **not** Bloomington.
   — ✅ satisfied by #158; covered by `src/utils/entityRouting.test.ts`.

No rush on our side: Phase 15 shipped without the Treasury row and the Essentials row works
today, so nothing is broken while Asks 1 and 2 wait. Ask 3, the one we would not have left
sitting, is already fixed.

Questions to Chris. The consumer-side design, if you want the other half of the picture, is
`Civic Spaces/.planning/phases/15-tool-deep-links/15-DESIGN.md`.
