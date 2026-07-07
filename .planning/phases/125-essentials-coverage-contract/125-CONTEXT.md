# Phase 125: Essentials Coverage Contract - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish and consume the **reciprocal coverage contract** between Empowered Vote Essentials and Treasury Tracker — the mirror of Essentials' Phase 187 (which already learns TT's coverage via `/treasury/cities`).

Two sides, both in this phase:

1. **Essentials side (cross-repo, `essentials`):** publish the coverage catalog as a public, unauthenticated, fetchable resource, **and** add the national-officials browse route that gives the federal entity a real deep-link target.
2. **TT side (frontend-only, this repo):** fetch + cache that catalog at runtime with graceful degradation, and resolve the banner's *current entity* to a coverage record (GEOID(s) or target) via loose, tier-aligned matching.

This phase delivers the **data + resolution contract only**. The visible icon row, chip styling, tooltips, and link *rendering* are Phase 126; end-to-end context-sensitivity + live UAT is Phase 127.

**⚠ Scope change locked this session (federal tether):** The milestone as originally written (TETH-03) said the federal "United States" entity shows **no** Essentials icon because Essentials had no federal browse target. Chris reversed this: Phase 125 now **also creates** an Essentials national-officials browse route so TT's federal entity actively tethers. See D-05 and the "Roadmap/Requirements updates required" note in Deferred.
</domain>

<decisions>
## Implementation Decisions

### Publish mechanism (COV-01)
- **D-01:** Essentials publishes a **generated static `coverage.json`**, not a backend endpoint. A build step in the `essentials` repo emits `public/coverage.json` from `src/lib/coverage.js` (the single source of truth — no hand-maintained second copy), built into `/dist` and served at the Essentials static origin. Rationale: stays inside the scoped `essentials` repo, no change to the separate `accounts-api` backend repo, and matches Essentials' static (Render/Netlify) hosting.
- **D-01a (research flag):** TT (`financials.empowered.vote`) fetches this cross-origin, so `coverage.json` must be served with a **CORS header** allowing TT's origin. Netlify (`_headers`/`netlify.toml`) and Render static both support this — planner/researcher to pin the exact mechanism and confirm the canonical Essentials public origin/URL.

### Catalog scope & shape
- **D-02:** Published tiers = **cities + counties + all 50 states + federal**. School districts and townships are excluded (outside TT's matchable tiers for this milestone).
- **D-02a:** Because **all 50 states are "covered"** on Essentials (statewide officials always seeded), TT's **state tier always tethers** — every state entity shows the Essentials icon. This is intended.
- **D-02b:** Include `hasContext` as an informational flag per record (not a gate — an icon renders on coverage presence, not on `hasContext`).
- **D-02c (shape):** Normalize to a flat per-tier contract, e.g. `{ cities:[{label, geoids:[…], state, hasContext}], counties:[…], states:[{label, abbrev}], federal:{label, target} }`. Exact field names are a planner detail; the tier set + GEOID-array + federal-target fields are the locked contract surface.

### Entity→coverage matching (COV-03)
- **D-03:** **Tier-aligned + state-scoped, loose names.** A TT city matches only city records, a county only county records, a state by abbrev, federal by the federal record. Reuse Essentials' `normalizePlace` semantics (lowercase, drop punctuation, expand St./Saint, collapse whitespace) **and** strip a trailing `County` and a trailing `, ST` suffix so `"Los Angeles County"`, `"Washington County, OR"`, `"St. Mary's County"` all match cleanly.
- **D-03a:** Name matches but wrong/absent state → **return null** (no wrong-state link), mirroring Essentials' `treasury.js findMatchingMunicipality` disambiguation (Salem UT must not link Salem MA).
- **D-03b:** A resolved match yields the **GEOID(s)** (array — `browseGovernmentList` is already an array) for city/county, the **state abbrev** for state, or the **federal target** for federal. Cross-tier matching is explicitly disallowed.

### Fetch / cache / degradation (COV-02)
- **D-04:** Mirror `wikiImage.ts`: **module-level in-memory cache**, fetch **once per session**, **never throw** (return null on slow/failed/empty/non-OK). Banner paints immediately; the icon renders **async pop-in** if/when coverage resolves — a slow fetch never blocks or breaks the banner. No hard timeout (async pop-in already prevents blocking); no sessionStorage (marginal benefit, adds stale-on-deploy concern).
- **D-04a:** Catalog URL comes from an env var (e.g. `VITE_ESSENTIALS_URL` + a known `/coverage.json` path), mirroring Essentials' `VITE_TREASURY_URL` convention.

### Federal tether (scope change — see ⚠ in Phase Boundary)
- **D-05:** Essentials gains a **national-officials browse route** this phase (folded into the Essentials-side COV-01 deliverable) — e.g. `/results?browse_federal_officials=1` — surfacing federal-tier officials (President/VP, U.S. Senate, U.S. House, Cabinet, Federal Judiciary, Independent Agencies). **Feasibility confirmed:** the federal-officials **data already exists and is classified** (`essentials/src/lib/classify.js` `FEDERAL_ORDER`; `Results.jsx` already renders `NATIONAL_EXEC/UPPER/LOWER`). Today only `browse_state_officials=<abbr>` exists, which is state-scoped. So this is a **new national-scope browse route/param**, not a data-seeding effort — medium lift on the Essentials side.
- **D-05a:** `coverage.json` carries a **`federal` record** whose target points at that new national browse route, so TT's federal entity resolves to a real link and Phase 126 renders the federal icon like any other tier.

### Claude's Discretion
- Exact `coverage.json` field names and the generator script's location/shape.
- Exact new federal browse param name (`browse_federal_officials` is illustrative).
- Precise TS module layout for the TT fetch/match utility (a new `essentialsCoverage.ts` alongside `wikiImage.ts` is the obvious analog).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase/milestone plumbing (this repo)
- `.planning/ROADMAP.md` — v2.16 milestone, Phase 125 goal + success criteria (note: federal success criteria need updating per D-05).
- `.planning/REQUIREMENTS.md` — COV-01/02/03 (+ TETH-03 reversal for federal, see Deferred).

### Essentials side — coverage catalog + browse routing (cross-repo, `C:\transparent motivations\essentials`)
- `C:\transparent motivations\essentials\src\lib\coverage.js` — **source of truth** for the catalog. `COVERAGE_STATES` (per-city `browseGovernmentList` GEOID + `browseStateAbbrev` + `hasContext`), `COVERAGE_COUNTIES` (16), `COVERAGE_BROWSE_STATES` (all 50), `normalizePlace`, `coverageAreaToPath`, `STATE_NAME_TO_ABBREV`. The generator (D-01) reads this.
- `C:\transparent motivations\essentials\src\lib\treasury.js` — **the reciprocal matcher precedent** (Phase 187): `fetchTreasuryCities`, `findMatchingMunicipality` (state-scoped, longest-match, null-on-no-same-state), `toTreasurySlug`, `TREASURY_URL` env convention. TT's COV-02/03 utility should mirror this.
- `C:\transparent motivations\essentials\src\lib\featureIcons.js` — Phase 187 product registry (the mirror of TT's Phase 126 registry).
- `C:\transparent motivations\essentials\src\pages\Results.jsx` — browse-route param handling (`browse_government_list`, `browse_state_officials`, `browse_state`, `browse_label`, `browse_skip_overlap`) + `NATIONAL_EXEC/UPPER/LOWER` rendering; where the new federal browse route (D-05) plugs in.
- `C:\transparent motivations\essentials\src\lib\classify.js` — `FEDERAL_ORDER` + federal-tier classification (proves federal-officials data exists for D-05).
- `C:\transparent motivations\essentials\render.yaml` + `C:\transparent motivations\essentials\netlify.toml` — static deploy config; where `coverage.json` lands and where the CORS header (D-01a) is set. Backend is the separate `accounts-api` (`https://accounts-api.empowered.vote`), intentionally untouched.

### TT side (this repo)
- `src/App.tsx` — hero banner (plain `div`: image + gradient + title + Wikimedia credit) and entity model / `syncURL` / `toSlug`.
- `src/utils/wikiImage.ts` — **the graceful-fetch + in-memory-cache precedent for COV-02** (never-throws, in-memory `Map`, once-per-session, known-list gating).
- `src/types/budget.ts` §129 — `Municipality` (`name`, `state`, `entity_type`: city/county/state/federal/…).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`wikiImage.ts` (TT):** direct model for the new coverage fetch/cache utility — module-level cache, try/catch → null, resolve-once-per-session. Copy the shape for COV-02.
- **`treasury.js` (Essentials):** direct model for the matcher (COV-03) — state-scoped disambiguation, longest/normalized match, null-on-mismatch. TT's matcher is the mirror image.
- **`normalizePlace` (Essentials `coverage.js`):** the exact loose-match normalization to reuse (St./Saint, punctuation). TT reimplements it (cross-repo — copy, don't import).
- **`STATE_NAMES` (TT `wikiImage.ts`) / `STATE_NAME_TO_ABBREV` (Essentials):** abbrev↔name maps already exist on both sides for the state tier.

### Established Patterns
- TT graceful degradation = return `null`, render neutral fallback, never throw (hero image precedent). The tether icon degrades the same way.
- Essentials frontend is **static-hosted**; its API backend is a **separate repo** — hence D-01 (static `coverage.json`, not a backend endpoint).
- Cross-repo means **copy, not import** — no shared package between `essentials` and `treasury-tracker`; the contract is the JSON shape + the deep-link URL format, nothing at build time.

### Integration Points
- TT: new util (e.g. `src/utils/essentialsCoverage.ts`) called from `App.tsx` when the entity changes (alongside the existing hero-image resolve at App.tsx ~L167). Output (GEOID(s)/target or null) feeds the Phase 126 icon registry.
- Essentials: new generator script + `public/coverage.json` + CORS header; new national browse route in `Results.jsx` routing.
</code_context>

<specifics>
## Specific Ideas

- Deep-link contract (from Essentials, for Phase 126/TETH-01, captured here so the matcher returns the right fields): city/county → `/results?browse_government_list=<geoid[,geoid]>&browse_state=<abbr>&browse_label=<label>`; state → `/results?browse_state_officials=<abbr>&browse_label=<label>`; **federal → the new national route (D-05)**, e.g. `/results?browse_federal_officials=1&browse_label=United%20States`.
- Known-covered probe anchors for success-criteria/UAT: Bloomington IN, Long Beach CA (covered cities); Los Angeles County CA, Salt Lake County UT (covered counties); any state (all covered); a known-uncovered city → null; federal "United States" → now the national route.
</specifics>

<deferred>
## Deferred Ideas

- **Roadmap/Requirements updates required (do before/at planning):** The federal scope change (D-05) contradicts the milestone as written. Update:
  - `REQUIREMENTS.md` **TETH-03** — federal now renders an icon linking to the national browse (was: "federal shows no icon"). Add a COV/TETH requirement for the Essentials national-officials browse route + the federal `coverage.json` record.
  - `ROADMAP.md` Phase 125 success criteria — add the national browse route + federal catalog record; Phase 126/127 success criteria — flip the "federal shows no Essentials icon" language to "federal shows icon → national officials browse"; add federal to VER-01's live-UAT matrix.
- **Compass / Read & Rank tether icons (TETH-FUT-01):** reserved non-rendering slots ship in Phase 126; wiring them is future work once each product exposes a per-location contract.
- **Banner imagery (BANR-FUT-02) + population/stats slot (BANR-FUT-01):** explicitly out of "Smart Banner" scope.

### Reviewed Todos (not folded)
None — no matching pending todos surfaced for this phase.

</deferred>

---

*Phase: 125-essentials-coverage-contract*
*Context gathered: 2026-07-07*
