# Phase 127 — Discussion Log

**Date:** 2026-07-08 · Mode: discuss (standard) · For human reference only (not consumed by downstream agents).

Phase 127 is the v2.16 capstone (TETH-03 + VER-01). Phase 126 already built the gate logic, so this is a verify-and-fix phase. Four gray areas discussed.

## Area 1 — Geoid-less covered places
- **Options:** (a) No icon is correct; (b) add a label-only fallback link.
- **Selected:** No icon is correct.
- **Note:** A covered place with no GEOID (Bloomington IN) shows no icon because the deep-link needs `browse_government_list=<geoid>`. Honors ICON-03; verification-only, no new code. Resolves the Phase-126 open item. → D-127-01.

## Area 2 — UAT failure handling
- **Options:** (a) Fix inline within 127; (b) log bugs, close as verified-with-issues.
- **Selected:** Fix inline within 127.
- **Note:** 127 closes only when the full UAT matrix is green; milestone stays self-contained. → D-127-03.

## Area 3 — Pass bar for VER-01
- **Options:** (a) Visual + live-fetch behavior; (b) visual correctness only.
- **Selected:** Visual + live-fetch behavior.
- **Note:** Also verify real cross-origin fetch (CORS), graceful degrade if Essentials unreachable, no console errors, ~one fetch/session — the live dimensions the fixture couldn't prove. → D-127-04.

## Area 4 — UAT entity matrix (multi-select)
- **Selected:** Covered city (Long Beach CA), Covered state + federal, Covered county.
- **NOT selected:** Uncovered city.
- **Claude flag / override:** Kept the uncovered-city negative case anyway — TETH-03/VER-01 explicitly require verifying no-icon on a genuinely uncovered place (distinct from the geoid-less case). Surfaced to Chris. → D-127-02.
- **Grounding done this session:** live coverage.json has 16 counties; TT ∩ Essentials counties = **Los Angeles County CA (06037)** and **Salt Lake County UT (49035)** → concrete covered-county picks. → D-127-05.

## Deferred
- Label-only fallback for geoid-less places (declined, D-127-01).
- Compass / Read & Rank live resolvers (reserved slots, future milestone).
- Banner imagery (out of v2.16 from the start).
