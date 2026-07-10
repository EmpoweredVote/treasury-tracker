# Phase 125: Essentials Coverage Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 125-essentials-coverage-contract
**Areas discussed:** Publish mechanism (COV-01), Catalog scope & shape, Entity→coverage matching (COV-03), Fetch/cache/degradation (COV-02), Federal tether (scope change)

---

## Publish mechanism (COV-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Generated static coverage.json | Build step in essentials repo emits public/coverage.json from coverage.js; served at Essentials static origin; needs CORS for TT | ✓ |
| Endpoint on accounts-api | Public GET /api/coverage on the separate backend repo — truest mirror of /treasury/cities but more friction | |
| Hand-written coverage.json | Static file maintained by hand — drifts from coverage.js (two sources of truth) | |

**User's choice:** Generated static coverage.json
**Notes:** Keeps COV-01 inside the scoped `essentials` repo, no backend/second-repo change, matches static hosting. CORS header for TT origin flagged as a research item (D-01a).

---

## Catalog scope & shape

| Option | Description | Selected |
|--------|-------------|----------|
| Cities + counties + all 50 states | Matches Essentials reality; state tier always tethers; hasContext informational; school districts/townships excluded | (base accepted) |
| Cities + counties only | States excluded — state tier never tethers | |
| Everything in coverage.js | Also school districts + townships — beyond TT's matchable tiers | |

**User's choice:** Recommended tiers accepted, **plus federal** (note: "And federal").
**Notes:** The "And federal" note triggered a dedicated deep-dive (below). Base tiers (cities + counties + all 50 states) taken as accepted; federal added.

---

## Entity→coverage matching (COV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Tier-aligned + state-scoped, loose names | Tier-matched, normalizePlace reuse, strip County/, ST suffixes, null on wrong/absent state, GEOID array | ✓ |
| Exact match only | No fuzzy handling — false misses on St./Saint/County/punctuation | |
| Loose, cross-tier allowed | Match by name+state ignoring tier — risks county↔city wrong link | |

**User's choice:** Tier-aligned + state-scoped, loose names
**Notes:** Mirrors Essentials' treasury.js disambiguation (Salem UT ≠ Salem MA).

---

## Fetch/cache/degradation (COV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory cache, async pop-in | Mirror wikiImage.ts: module cache, once/session, never throw, async icon pop-in, VITE_ESSENTIALS_URL | ✓ |
| Add a timeout cap | Same + ~3s abort — mostly belt-and-suspenders since async already non-blocking | |
| sessionStorage cache | Persist across reloads — marginal benefit, stale-on-deploy concern | |

**User's choice:** In-memory cache, async pop-in
**Notes:** Banner paints immediately; icon renders when/if coverage resolves.

---

## Federal tether (scope change)

| Option | Description | Selected |
|--------|-------------|----------|
| Handle as null (no icon), tested | Keep TETH-03 — federal resolves to null, no icon; just first-class + tested | |
| Reserve federal in the contract | Publish federal record with target:null now; future-proof, no icon yet | |
| Add an Essentials federal target now | New national-officials browse on Essentials so federal actively tethers this milestone | ✓ |

**User's choice:** Add an Essentials federal target now — then, on structure: **Fold into Phase 125 / COV-01**.
**Notes:** Feasibility confirmed by codebase probe — federal-officials data already exists and is classified (`classify.js` FEDERAL_ORDER; Results.jsx renders NATIONAL_EXEC/UPPER/LOWER). Work = a new national-scope browse route, not data seeding. Reverses TETH-03 for the federal case → roadmap/requirements updates required (captured in CONTEXT Deferred).

## Claude's Discretion
- Exact coverage.json field names + generator location.
- Exact new federal browse param name (browse_federal_officials illustrative).
- TT fetch/match module layout (new essentialsCoverage.ts alongside wikiImage.ts).

## Deferred Ideas
- Roadmap/REQUIREMENTS updates for the federal scope change (TETH-03 reversal + new COV/TETH requirement + Phase 126/127 + VER-01 federal case).
- Compass / Read & Rank tether wiring (TETH-FUT-01) — reserved slots only this milestone.
- Banner imagery (BANR-FUT-02) + population/stats slot (BANR-FUT-01) — out of scope.
