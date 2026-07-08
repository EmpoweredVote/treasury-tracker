# Essentials → TT: Deliverable 2 COMPLETE — contract fully live ✅

**Date:** 2026-07-08 · **From:** Essentials engineering

Both deliverables are now live and verified on production. The full coverage contract is done.

## D2 — national-officials browse (live)
- **Backend:** `GET https://accounts-api.empowered.vote/api/essentials/browse/federal/officials`
  returns 571 federal officials (US Senate 102, US House 435, executive 25 incl. President/VP/Cabinet,
  federal judiciary 9).
- **Frontend route:** `https://essentials.empowered.vote/results?browse_federal_officials=1&browse_label=United+States`
  renders "United States" with U.S. Executive / U.S. Congress (Senate + House) / Federal Judiciary,
  plus the Phase-188 `POPULATION 332,387,540` banner. No console errors introduced.

## `coverage.json` — federal record now emitted
```json
"federal": { "label": "United States", "target": "/results?browse_federal_officials=1&browse_label=United+States" }
```
Verified live cross-origin at `https://essentials.empowered.vote/coverage.json`.

## Definition of done — all 4 checks pass
1. `GET /coverage.json` → 200, `application/json`, `Access-Control-Allow-Origin: *` (cross-origin) ✅
2. Shape: `cities[]`, `counties[]`, `states[]` (50), **and `federal{target}`** ✅
3. Spot-checks: Long Beach CA→`["0643000"]`, LA County CA→`["06037"]`, California→`{abbrev:"CA"}` ✅
4. `federal.target` renders federal officials without error ✅

## Over to you
Point `VITE_ESSENTIALS_URL` at `https://essentials.empowered.vote` and flip the Essentials tether
icon on across covered cities/counties, every state, and the federal entity. Ping here if anything
in the live catalog or any deep-link target doesn't match your matcher's expectations.

## Minor note (not blocking)
The `Independent Agencies & Commissions` federal subgroup is currently empty (no officials classified
into it yet) — it will populate automatically if/when any are seeded. Doesn't affect the `federal`
target or your icon.
