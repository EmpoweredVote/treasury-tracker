---
phase: 125
plan: "125"
title: "TT-side Essentials coverage contract: fetch + cache + tier-aligned matcher"
wave: 1
depends_on: []
files_modified:
  - src/utils/essentialsCoverage.ts
  - src/utils/essentialsCoverage.test.ts
  - src/utils/__fixtures__/coverage.sample.json
  - vitest.config.ts
  - package.json
  - .env.example
  - src/App.tsx
autonomous: true
requirements: [COV-02, COV-03, COV-04]
must_haves:
  - "A new src/utils/essentialsCoverage.ts fetches the Essentials coverage.json once per session, caches it in-memory, and returns null (never throws) on slow/failed/empty/non-OK responses (COV-02)"
  - "matchEntityToCoverage resolves a TT Municipality tier-aligned: city→city records, county→county records, state→by abbrev, federal→the federal record; returns null on wrong/absent state (COV-03)"
  - "Loose matching reuses Essentials normalizePlace semantics (lowercase, drop punctuation, St./Saint) plus strips trailing 'County' and ', ST'; St. Mary's County and Los Angeles County resolve, and BOTH county-label forms Essentials emits — 'Washington County, OR' (suffixed) and 'Washington County' UT (bare) — resolve to their own state's record, never each other (COV-03)"
  - "A known covered place (Bloomington IN, Long Beach CA) resolves to its GEOID(s); a known-uncovered place resolves to null; the federal entity resolves to the federal record's target (COV-04)"
  - "Verification exists and passes: vitest suite over a committed fixture proves the above; tsc build and eslint pass"
  - "App.tsx consumes the resolver on entity change and exposes a real data-essentials-coverage seam on the hero banner (covered|none) for Phase 126 — no icon rendered yet, no dead/unused code"
scope_note: >
  TT side only (per discuss-phase decision). The Essentials-side producer — the
  generated coverage.json + CORS header + the browse_federal_officials national
  route + the federal catalog record (COV-01, COV-04 producer half) — is tracked
  and executed in the essentials repo separately, NOT in this plan. Success
  criteria 1 and the Essentials half of 5 (a live cross-origin fetch against the
  deployed catalog) are therefore verified post-deploy, not by this plan; this
  plan verifies the consumer against a committed fixture matching the agreed
  contract shape.
---

# Plan 125 — TT-side Essentials coverage contract

**Mode:** standard
**Goal:** Give Treasury Tracker the ability to learn Essentials' coverage and resolve
the banner's *current entity* to an Essentials coverage record — the reciprocal of
Essentials' `treasury.js`. Deliver a fetch-once/cache/never-throw loader plus a
tier-aligned, loose-matching resolver, proven by a fixture-backed vitest suite, and
wire it into `App.tsx` as an invisible-but-real DOM seam that Phase 126's icon row
will consume. No icon is rendered in this phase.

**Contract shape (agreed in CONTEXT.md D-02c)** — the fixture and the parser both use:
```json
{
  "cities":   [{ "label": "Long Beach", "geoids": ["0643000"], "state": "CA", "hasContext": true }],
  "counties": [{ "label": "Los Angeles County", "geoids": ["06037"], "state": "CA", "hasContext": true }],
  "states":   [{ "label": "California", "abbrev": "CA" }],
  "federal":  { "label": "United States", "target": "/results?browse_federal_officials=1&browse_label=United States" }
}
```

<threat_model>
**T-125-01 — Untrusted catalog content flows into a deep-link.** The matcher returns
`label`/`geoids`/`target` drawn from a remote JSON that TT does not control at runtime.
- *Surface:* values later composed into an external `href` (Phase 126) or into DOM.
- *Threats:* a malformed/hostile `label` or `target` could yield a broken or javascript: URL, or unexpected DOM if ever interpolated as HTML.
- *Mitigations (this plan):* treat the catalog as untrusted — validate the top-level shape before use; the matcher returns plain data only (no URL/DOM construction here); the `data-essentials-coverage` seam is written as a literal enum `covered|none` (never raw catalog text). Phase 126 must build any href via `URLSearchParams` (documented in the resolver's return type comment).
- *Block on:* high. No high-severity threat is introduced by this plan (read-only public data, no eval, no innerHTML).

**T-125-02 — Fetch stalls or fails and blocks the banner.**
- *Mitigation:* module-level cached promise, `try/catch` → `null`, resolution is async (banner paints first). Covered by COV-02 acceptance + a test simulating a rejected fetch.
</threat_model>

## Tasks

<task id="125-01" type="execute">
<action>
Create `src/utils/essentialsCoverage.ts` — the TT-side mirror of Essentials' `treasury.js`. It must export:

1. **Types:** `CoverageCatalog` and `CoverageRecord` matching the contract shape above. `CoverageRecord` (the matcher's return) is a discriminated-ish object: `{ tier: 'city'|'county'|'state'|'federal', label: string, geoids?: string[], stateAbbrev?: string, target?: string, hasContext?: boolean }`. Add a doc comment on `target`/`geoids` stating Phase 126 MUST build hrefs via `URLSearchParams` (T-125-01).
2. **`ESSENTIALS_URL`** = `import.meta.env.VITE_ESSENTIALS_URL || 'https://essentials.empowered.vote'` (mirror the `TREASURY_URL` convention in Essentials' treasury.js). Export it.
3. **`fetchCoverage(): Promise<CoverageCatalog | null>`** — module-level in-memory cached Promise (resolve once per session, like `wikiImage.ts`'s `cache` Map). `try { fetch(`${ESSENTIALS_URL}/coverage.json`) }`; return `null` on `!res.ok`, thrown error, or a body that fails a light shape check (must be an object; `cities`/`counties`/`states` arrays if present). NEVER throws. Cache the settled result (including null) so a failed fetch isn't retried mid-session.
4. **`normalizePlace(s: string): string`** — port Essentials `coverage.js` exactly: lowercase, `replace(/\./g,'')`, `replace(/\bsaint\b/g,'st')`, `replace(/[^a-z0-9]+/g,' ')`, trim.
5. **`matchEntityToCoverage(entity: Pick<Municipality,'name'|'state'|'entity_type'>, catalog: CoverageCatalog | null): CoverageRecord | null`** — tier-aligned resolution:
   - `entity_type === 'federal'` → return the `catalog.federal` record (tier 'federal') if present, else null. Location-independent (do not match on name/state).
   - state tiers (`entity_type === 'state'`) → match `catalog.states` by `abbrev === entity.state` (uppercased); return `{ tier:'state', label, stateAbbrev }`.
   - county tiers (`entity_type` is `county`) → search `catalog.counties`; city tiers (`city`,`town`,`township`,`municipality`) → search `catalog.cities`. In both: candidate matches when `normalizePlace(strip(record.label)) === normalizePlace(strip(entity.name))` AND `record.state.toUpperCase() === entity.state.toUpperCase()`. `strip()` removes a trailing ` county` and a trailing `, XX` state suffix before normalizing. On a name-match with no same-state record → return null (never a wrong-state link). Return `{ tier, label, geoids, stateAbbrev, hasContext }`.
   - Any other `entity_type` (nonprofit, special_district, school_district, library, conservancy) → null.
6. **`useEssentialsCoverage(entity: Municipality | null): CoverageRecord | null`** — a React hook: state `record`; effect keyed on `entity?.id` that calls `fetchCoverage().then(cat => setRecord(matchEntityToCoverage(entity, cat)))`, clearing to null while resolving and when entity is null. This is the seam Phase 126 consumes.

Keep `normalizePlace` and `matchEntityToCoverage` PURE (no fetch, no import.meta.env) so they are unit-testable in isolation.
</action>
<read_first>
- src/utils/wikiImage.ts (the graceful-fetch + in-memory cache precedent to mirror: never-throws, resolve-once, entity-keyed effect)
- C:/transparent motivations/essentials/src/lib/treasury.js (reciprocal matcher: state-scoped disambiguation, longest/normalized match, null-on-no-same-state, TREASURY_URL env convention)
- C:/transparent motivations/essentials/src/lib/coverage.js (normalizePlace source of truth §216-225; catalog field names — browseGovernmentList/browseStateAbbrev/hasContext; COVERAGE_COUNTIES label quirks like "Washington County, OR" and "St. Mary's County")
- src/types/budget.ts (Municipality interface §129 — name/state/entity_type union)
</read_first>
<acceptance_criteria>
- `src/utils/essentialsCoverage.ts` exists and exports `fetchCoverage`, `matchEntityToCoverage`, `normalizePlace`, `useEssentialsCoverage`, `ESSENTIALS_URL`, and the `CoverageCatalog`/`CoverageRecord` types
- `fetchCoverage` wraps `fetch` in try/catch, returns `null` on error/`!ok`/bad-shape, and memoizes a module-level promise (grep: a module-scoped `let`/`const` cache assigned inside `fetchCoverage`)
- `matchEntityToCoverage` has an explicit `entity_type === 'federal'` branch returning `catalog.federal`-derived record and a branch returning `null` for wrong/absent state
- `normalizePlace` contains `replace(/\bsaint\b/g` and `replace(/\./g` (ported from Essentials)
- File contains no `dangerouslySetInnerHTML` and builds no URL strings from catalog `label` (matcher returns data only)
</acceptance_criteria>
</task>

<task id="125-02" type="execute" depends_on="125-01">
<action>
Add a minimal vitest harness (TT currently has no test runner) and a fixture-backed test suite.

1. `npm install -D vitest` (and `jsdom` only if the hook test needs it — prefer testing the PURE functions to avoid a DOM dep).
2. Create `vitest.config.ts` with `test.environment: 'node'` and `test.include: ['src/**/*.test.ts']`.
3. Add `"test": "vitest run"` to package.json `scripts`.
4. Create `src/utils/__fixtures__/coverage.sample.json` — a small catalog in the agreed shape containing: cities Long Beach CA (geoid 0643000) + Bloomington IN (no geoid / address-only, `geoids: []` → still a covered record with hasContext); counties "Los Angeles County" CA (06037), "St. Mary's County" MD (24037), "Washington County, OR" (41067, state-suffixed label), AND "Washington County" UT (49053, bare label) — the two county-label forms Essentials confirmed both exist in source; states California/CA + Texas/TX; federal { label:"United States", target:"/results?browse_federal_officials=1&browse_label=United States" }.
5. Create `src/utils/essentialsCoverage.test.ts` importing `matchEntityToCoverage` + `normalizePlace` + the fixture, asserting (COV-03/04):
   - Long Beach CA (city) → geoids `['0643000']`
   - Bloomington IN (city) → covered record (non-null), hasContext true
   - Los Angeles County CA (county, entity name "Los Angeles County") → geoids `['06037']`
   - "St. Mary's County" MD vs fixture "St. Mary's County" → match (punctuation loose)
   - Washington County OR (name "Washington County", state OR) → matches "Washington County, OR" → geoids `['41067']` (state-suffix strip)
   - Washington County UT (name "Washington County", state UT) → matches the bare "Washington County" → geoids `['49053']`, NOT the OR record (state-scoped disambiguation across the two identical names / two label forms)
   - a Salem UT city (not in fixture) → null (no wrong-state Salem match)
   - state entity {name:'California',state:'CA',entity_type:'state'} → `{tier:'state', stateAbbrev:'CA'}`
   - federal {name:'United States',state:'US',entity_type:'federal'} → record with the browse_federal_officials target
   - a nonprofit entity → null
   - `fetchCoverage` behavior: mock global `fetch` to reject / return `{ok:false}` → resolves to `null` (never throws)
</action>
<read_first>
- src/utils/essentialsCoverage.ts (the module under test — exports + signatures)
- C:/transparent motivations/essentials/src/lib/treasury.test.js (vitest style + how the reciprocal side asserts matcher behavior + fixture shape)
- package.json (existing scripts block — where to add "test")
</read_first>
<acceptance_criteria>
- `npx vitest run` exits 0 with all assertions passing
- `vitest.config.ts` exists; package.json `scripts.test` is `vitest run`
- `src/utils/__fixtures__/coverage.sample.json` exists and contains a `federal` object with a `browse_federal_officials` target
- The suite includes an assertion that a rejected/`!ok` fetch resolves to `null` (COV-02) and that the federal entity resolves to a non-null target (COV-04)
- The suite asserts both county-label forms resolve to the correct state's GEOID: Washington County OR → `["41067"]` and Washington County UT → `["49053"]` (state-scoped, no cross-state collision)
</acceptance_criteria>
</task>

<task id="125-03" type="execute" depends_on="125-01">
<action>
Wire the resolver into `App.tsx` as an invisible, real DOM seam (no icon — that is Phase 126).

1. Import `useEssentialsCoverage` from `../utils/essentialsCoverage` (adjust relative path).
2. Call `const essentialsCoverage = useEssentialsCoverage(selectedEntity);` near the existing `heroImage` state/effect (~L166).
3. On the hero banner root `div` (the element that renders `heroImage`/gradient + title + credit), add `data-essentials-coverage={essentialsCoverage ? 'covered' : 'none'}`. This is a genuine, testable attribute (Phase 127 live-UAT + Phase 126 consumption seam) and keeps the value USED (no `noUnusedLocals` build break).
Do NOT render any icon, chip, or link in this phase.
</action>
<read_first>
- src/App.tsx (hero banner render block — locate the div that uses `heroImage`; the entity-change effect at ~L167 is the placement model)
- src/utils/essentialsCoverage.ts (the `useEssentialsCoverage` hook signature/return)
</read_first>
<acceptance_criteria>
- `src/App.tsx` imports and calls `useEssentialsCoverage(selectedEntity)`
- The hero banner div renders `data-essentials-coverage="covered"` or `"none"` (grep: `data-essentials-coverage`)
- The resolved value is consumed (used in JSX) — `tsc -b` reports no unused-local error
- No `<a>`, icon, chip, or `<img>` for a product tether is added (that is Phase 126)
</acceptance_criteria>
</task>

<task id="125-04" type="verify" depends_on="125-01,125-02,125-03">
<action>
Prove the phase goal and document the cross-repo deferrals.

1. Run and confirm green: `npx tsc -b` (typecheck), `npx vitest run` (tests), `npm run lint` (eslint).
2. Run `npm run build` to confirm the app still builds with the new module + App.tsx wiring.
3. Add a `VITE_ESSENTIALS_URL` entry to `.env.example` (create the file if absent) with a comment: `# Origin serving Essentials' public coverage.json (confirm canonical origin at Essentials deploy)`.
4. Append a short "Cross-repo deferrals" note to this phase's dir (or in the verification output) recording that SC1 (Essentials serves coverage.json) and the Essentials half of SC5 (national browse route live) are verified post-deploy in the essentials repo, and that TT's live cross-origin fetch should be smoke-tested once that origin/CORS is confirmed.
</action>
<read_first>
- package.json (build/lint/test scripts)
- .planning/phases/125-essentials-coverage-contract/125-CONTEXT.md (success criteria + D-01a CORS/origin flag + scope split)
</read_first>
<acceptance_criteria>
- `npx tsc -b`, `npx vitest run`, and `npm run lint` all exit 0
- `npm run build` exits 0
- `.env.example` contains `VITE_ESSENTIALS_URL`
- A cross-repo deferral note records that SC1 + Essentials-side SC5 are verified post-deploy (not by this plan)
</acceptance_criteria>
</task>

## Verification

- **COV-02:** `fetchCoverage` never throws and returns null on failure (unit test with mocked fetch); resolution is async so the banner paints regardless. Cached module-level promise → one fetch per session.
- **COV-03:** `matchEntityToCoverage` is tier-aligned, uses ported `normalizePlace` + suffix stripping, and returns null on wrong/absent state — proven across city/county/state fixtures incl. St./punctuation and state-suffix cases.
- **COV-04 (consumer half):** the federal entity resolves to the federal record's `browse_federal_officials` target from the fixture.
- **Deferred (not this plan):** SC1 (Essentials serves the generated coverage.json with CORS) and the producer half of SC5 (the live national route) — essentials repo + deploy.

## must_haves (goal-backward)

1. TT can fetch Essentials coverage once per session, cached, never breaking the banner (COV-02).
2. TT resolves any current entity to the correct Essentials record or null, tier-aligned + loose + state-safe, including federal (COV-03, COV-04 consumer half).
3. The capability is verified (fixture vitest suite + typecheck + build + lint) and wired into App.tsx as a real seam for Phase 126, with no dead code and no rendered icon.
