# Note to Civic Spaces — the coverage catalog is live

**2026-09-15. From Treasury Tracker. Reply to `TT-TEAM-NOTE-coverage-catalog-2026-09-08.md`.**

All three of your asks are done. The endpoint you asked for is deployed and verified
against production, not just against its tests.

```
https://ev-accounts-api.onrender.com/api/treasury/coverage
```

`ev-accounts#504`, merged to `master` as `60d85183`.

---

## Three things you need before you wire it up

These are the only parts that will cost you time if you find them yourself.

### 1. Hit the API origin directly

```
✅  https://ev-accounts-api.onrender.com/api/treasury/coverage
❌  https://treasurytracker.empowered.vote/api/treasury/coverage
```

That second host only reaches the API through a static-site proxy hop
(`public/_redirects`). It is not the canonical path to this endpoint and you should not
depend on it.

**CORS is verified from a foreign origin.** The response carries
`access-control-allow-origin: *` and deliberately carries **no**
`access-control-allow-credentials` header — a browser rejects that header alongside a
wildcard origin, so its absence is what makes a cross-origin `fetch()` work. A plain
`fetch()` from `civicspaces.empowered.vote` needs no proxy and no special options.

One header will look alarming and is not: helmet sets
`cross-origin-resource-policy: same-origin`. CORP is only enforced for `no-cors`
requests, and a JSON `fetch()` is `cors` mode, so it does not apply to you. If something
does get blocked, though, that is the first header to check.

### 2. The federal slug is `united-states-us`

```json
"federal": { "label": "United States", "slug": "united-states-us" }
```

This answers the open question in your original note. Note that `federal` is an
**object, not an array** — that matches the Essentials catalog shape TT already consumes,
so your existing client shape holds. `.length` on it is `undefined`; that is correct.

### 3. ⚠ Michigan will look absent to you, and it is not a coverage gap

**Township geoids are 10-digit county-subdivision (MCD) codes.** They will not match a
7-digit place-FIPS slice, so under your "no match, no row" rule Michigan will simply have
no rows — even though TT's coverage there is effectively complete.

With a number on it, so you can predict exactly what you will see:

| | |
|---|---|
| MI city-tier rows in the catalog | **1,773** |
| of those, carrying a 10-digit MCD geoid | **1,240** |
| so, invisible under a 7-digit place slice | **~70% of Michigan** |

The underlying cause is on the **ev-accounts** side and outside this PR: the `G4040`
boundary layer (10-digit MCDs) has **zero rows for MI and PA**, while `G4110` (7-digit
places) is what `connect.resolve_user_jurisdiction` fills `city` from. Four states have
G4040 coverage — WI 1,243, IN 1,012, CA 404, MA 293.

**Please do not "fix" this by loosening to a name match.** A wrong deep link renders a
real budget for the wrong place, which is worse than a missing row, because the page
looks authoritative. A missing row is the correct behaviour until the boundary data
exists. We'd rather you show nothing for Michigan than show Ann Arbor's neighbour.

---

## What it actually serves

Counts below are measured against the live response, not the mock.

| tier | records |
|---|---|
| cities | 7,372 |
| counties | 699 |
| states | 50 |
| federal | 1 |
| **total** | **8,122 — every slug distinct** |

```json
{
  "generatedAt": "2026-09-15T17:25:50.141Z",
  "cities":   [ { "label": "Marana", "geoids": ["0444270"], "state": "AZ", "slug": "marana-az" } ],
  "counties": [ ... ],
  "states":   [ { "label": "Kansas", "abbrev": "KS", "slug": "kansas-ks" } ],
  "federal":  { "label": "United States", "slug": "united-states-us" }
}
```

Three things worth knowing about the shape:

- **`slug` is served, so never reconstruct it.** That was the point of the field — it
  means no consumer reimplements TT's `toSlug` and drifts from it. Build your link as
  `https://treasurytracker.empowered.vote/?entity=<slug>`.
- **State rows carry `abbrev` and no `geoids` key.** A naive "rows missing geoids" count
  returns 51 (50 states + federal) and that is correct, not a defect. Every city and
  county row does carry geoids — we checked: zero exceptions.
- **An entity with no geoid is omitted entirely**, never emitted as `geoids: []`, exactly
  as your note asked. Only entities with at least one budget a reader can actually open
  are advertised.

**Size:** ~790 kB raw, but gzip is enabled on this route specifically, so it is
**~115 kB on the wire** — well under the ~500 kB line you drew, and no tier-splitting is
needed. Cached `public, max-age=3600`.

---

## Your Ask 3 shipped a week ago

`?entity=` no longer resolves an unknown slug to Bloomington — TT PR #158, merged
2026-09-08. There is a real not-found state now that names the entity that was requested.
You were right that it was the one not to leave sitting: it was silently rendering
**Bloomington, Indiana's actual budget** for every stale or renamed link.

`toSlug` now lives in `src/utils/entityRouting.ts` and the writer and reader of a link
share it, so they cannot drift.

## Ask 1 shipped too

`geoid` and `geoid_basis` are on `treasury.municipalities` — TT PR #178, merged
2026-09-12 — covering all but a couple of dozen of TT's geographic entities, derived
offline from Census bulk files with no API and no key. Exact per-state counts are in that
PR rather than restated here.

One finding from that work is worth passing on, because it nearly shipped two wrong
governments: length checks, row counts and a byte-exact checksum **all passed** on a run
that had written the wrong entity twice. Only `count(distinct geoid) == count(geoid)`
caught it — "Elizabeth" plus the Census designator keys identically to the town actually
named "Elizabethtown". A checksum confirms you wrote what you meant; only uniqueness
confirms you meant the right thing.

---

## Open, and honest about it

- **G4040 boundaries for MI and PA.** The real fix behind Michigan looking absent. Not
  scoped, and it is ev-accounts work rather than TT work.
- We have not load-tested this endpoint. It is a cached, compressed static-ish catalog,
  but if Civic Spaces is going to fetch it per page view rather than per session, tell us
  and we will look at it properly.

Questions to the Treasury Tracker repo, or reply here.
