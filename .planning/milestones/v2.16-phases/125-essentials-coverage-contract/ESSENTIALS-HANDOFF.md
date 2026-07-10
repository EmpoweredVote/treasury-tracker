# Essentials → Treasury Tracker: Coverage Contract Handoff

**From:** Treasury Tracker (financials.empowered.vote), milestone v2.16 Phase 125
**To:** Essentials engineering (`essentials` repo)
**Date:** 2026-07-07
**Status:** Spec — ready to implement

---

## Why

Essentials' Phase 187 already tethers **into** Treasury Tracker: Essentials' banner learns
TT's coverage by calling TT's public `/treasury/cities` and deep-links
`financials.empowered.vote/?entity=<name-state>`.

TT is now building the **mirror** (v2.16): TT's hero banner will show a small Essentials
icon that deep-links the banner's *current entity* (city / county / state / federal) into
Essentials — **but only where Essentials actually covers that location.**

For that, TT needs to learn Essentials' coverage the same way Essentials learned TT's.
Today Essentials' coverage lives only in the frontend module `src/lib/coverage.js` (bundled,
not fetchable) and there is **no federal browse target**. This handoff asks for two additions,
both inside the `essentials` repo:

1. **Publish the coverage catalog** as a public, unauthenticated, CORS-enabled
   `coverage.json` (reciprocal of TT's `/treasury/cities`).
2. **Add a national-officials browse route** so TT's federal entity has a real target,
   and include a `federal` record in the catalog pointing at it.

Nothing else in Essentials changes. No backend (accounts-api) change is required for
deliverable 1; deliverable 2 touches the browse/query path (details below).

---

## Deliverable 1 — Publish `coverage.json` (reciprocal of `/treasury/cities`)

### 1a. Build-time generator (mirror `scripts/gen-population.mjs`)

Add `scripts/gen-coverage.mjs` that imports the existing exports from `src/lib/coverage.js`
(the single source of truth — do **not** hand-maintain a second copy) and writes
`public/coverage.json`. Vite copies `public/` → `dist/`, so the file ships at the site root.

Wire it into the build so it always regenerates:

```jsonc
// package.json
"scripts": {
  "gen:coverage": "node scripts/gen-coverage.mjs",
  "prebuild": "node scripts/gen-coverage.mjs",   // npm runs this automatically before `build`
  "build": "vite build"
}
```

(Recommend **gitignoring** `public/coverage.json` and generating at build, exactly like a
derived artifact — `coverage.js` stays the only source of truth. Committing it is fine too if
you prefer diff visibility.)

### 1b. Output shape (the contract TT consumes)

TT's parser expects this exact top-level shape. Field names matter.

```json
{
  "generatedAt": "2026-07-07T00:00:00Z",
  "cities": [
    { "label": "Long Beach", "geoids": ["0643000"], "state": "CA", "hasContext": true }
  ],
  "counties": [
    { "label": "Los Angeles County", "geoids": ["06037"], "state": "CA", "hasContext": true }
  ],
  "states": [
    { "label": "California", "abbrev": "CA" }
  ],
  "federal": {
    "label": "United States",
    "target": "/results?browse_federal_officials=1&browse_label=United+States"
  }
}
```

**Mapping from `coverage.js` → contract:**

| Contract field | Source in `coverage.js` |
|---|---|
| `cities[]` | `COVERAGE_STATES[].areas[]` → `{ label: area.label, geoids: area.browseGovernmentList ?? [], state: area.browseStateAbbrev ?? parent.abbrev, hasContext: !!area.hasContext }` |
| `counties[]` | `COVERAGE_COUNTIES[]` → `{ label, geoids: browseGovernmentList ?? [], state: browseStateAbbrev, hasContext: !!hasContext }` |
| `states[]` | `COVERAGE_BROWSE_STATES[]` → `{ label, abbrev: browseState }` (all 50) |
| `federal` | new — see Deliverable 2 |

Notes:
- **Exclude** `COVERAGE_SCHOOL_DISTRICTS` — TT has no matching tier this milestone.
- **Geoid-less cities** (e.g. Bloomington IN carries `address`, not `browseGovernmentList`):
  include them with `geoids: []`. TT will treat them as *covered* but will not render a
  city deep-link until a GEOID exists (TT builds the link from `browse_government_list=<geoid>`).
  If you can resolve Bloomington's place GEOID (`1805860`) into `coverage.js`, TT will then
  render its icon — nice-to-have, not required.
- Keep GEOIDs as **strings** (leading zeros matter: `"0643000"`, `"06037"`).

### 1c. CORS + content type

TT fetches this cross-origin from `financials.empowered.vote` (and `treasurytracker.empowered.vote`).
The catalog is public, read-only data, so a wildcard is fine:

```
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
```

Both hosts you deploy on need the header on `/coverage.json`:

**Netlify** — add to `netlify.toml` (or a `public/_headers` file):
```toml
[[headers]]
  for = "/coverage.json"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Cache-Control = "public, max-age=3600"
```

**Render (static site)** — add to `render.yaml` under the service:
```yaml
    headers:
      - path: /coverage.json
        name: Access-Control-Allow-Origin
        value: "*"
```

### 1d. Confirm the canonical origin

TT reads the catalog from `VITE_ESSENTIALS_URL` (defaulting to
`https://essentials.empowered.vote`) + `/coverage.json`. **Please confirm the production
origin** the site is served from so TT points at the right host. If it differs, tell us and
we'll set the env var — no code change on our side.

---

## Deliverable 2 — National-officials browse route + `federal` catalog record

### Context / feasibility

TT's banner has a federal "United States" entity. Essentials already classifies federal-tier
officials — `src/lib/classify.js` defines `FEDERAL_ORDER` (`U.S. Senate`, `U.S. House`,
`President / VP`, `Cabinet`, `Federal Judiciary`, `Independent Agencies & Commissions`) and
`Results.jsx` already renders `NATIONAL_EXEC` / `NATIONAL_UPPER` / `NATIONAL_LOWER`. So the
**data exists** — what's missing is a *national-scope* browse entry point. Today the only
officials browse is `browse_state_officials=<abbr>`, which is state-scoped (it happens to
include that state's US Senators).

### 2a. New browse param

Add a `browse_federal_officials=1` route to `Results.jsx`'s browse-param handling that renders
**all federal-tier officials nationally** — everything classified into the `Federal` tier
(`FEDERAL_ORDER`), grouped in that order, independent of any state.

- Model it on the existing `browse_state_officials` path, but without the state filter — the
  selection predicate is "office is federal tier" (the `NATIONAL_*` datatypes /
  `applies_federal`) rather than "belongs to state X".
- Respect `browse_label` for the header (TT passes `browse_label=United States`).
- If the officials fetch is a filtered query against accounts-api, you may need a query/endpoint
  that returns federal-tier officials without a state constraint. **This is the one place that
  might touch the data layer** — you own that call; TT only needs the resulting URL to work.

**Acceptance:** visiting `https://<essentials-origin>/results?browse_federal_officials=1&browse_label=United+States`
renders federal officials (President/VP, both chambers, Cabinet, Judiciary, Independent Agencies)
and does not error.

### 2b. `federal` record in `coverage.json`

Have `gen-coverage.mjs` emit the `federal` object shown in 1b, with `target` set to the exact
path from 2a:
```
/results?browse_federal_officials=1&browse_label=United+States
```

---

## The deep-link contract (for reference — TT builds these)

TT constructs Essentials URLs from the catalog. You don't need to build these, but they define
what the GEOIDs/abbrevs in the catalog are used for, so the shapes must stay compatible with
your existing `coverageAreaToPath` routing:

| TT entity | Essentials URL TT will open |
|---|---|
| City / County | `/results?browse_government_list=<geoid[,geoid]>&browse_state=<abbr>&browse_label=<label>` |
| State | `/results?browse_state_officials=<abbr>&browse_label=<label>` |
| Federal | `/results?browse_federal_officials=1&browse_label=United+States` *(new, Deliverable 2)* |

---

## Definition of done (how TT will verify)

1. `GET https://<essentials-origin>/coverage.json` returns **200**, `Content-Type: application/json`,
   and `Access-Control-Allow-Origin: *`, from a cross-origin request.
2. The JSON matches the shape in **1b**: `cities[]`, `counties[]`, `states[]` (all 50), and a
   `federal` object with a `target`.
3. A spot check resolves: Long Beach CA → `["0643000"]`; Los Angeles County CA → `["06037"]`;
   California → `{abbrev:"CA"}`; `federal.target` opens the national-officials browse.
4. The URL in `federal.target` renders federal officials without error (**Deliverable 2**).

Once 1–4 are live, TT flips `VITE_ESSENTIALS_URL` to the confirmed origin and the Essentials
tether icon lights up across covered cities/counties, every state, and the federal entity.

---

## Scope guardrails (please don't over-build)

- **No auth** — the catalog is public, like TT's `/treasury/cities`.
- **No new coverage data** — publish what `coverage.js` already has; don't expand coverage here.
- **No changes to Essentials' own banner / Phase 187** — that side already ships.
- **Free only** — no paid APIs; the generator needs no API key (unlike `gen-population.mjs`).

Questions → Chris / the Treasury Tracker side. TT's consuming code (fetch + matcher) is being
built in parallel against a fixture of this exact shape, so the sooner the contract lands, the
sooner we can point at the live origin.
