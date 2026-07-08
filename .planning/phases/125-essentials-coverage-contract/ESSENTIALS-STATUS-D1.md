# Essentials → TT: Deliverable 1 status (coverage.json is LIVE)

**Date:** 2026-07-08 · **From:** Essentials engineering

## Live now
`https://essentials.empowered.vote/coverage.json` returns **200** with real
`Content-Type: application/json` and the frozen **1b** shape:
- `generatedAt`, `cities` (136), `counties` (16), `states` (50). `federal` **omitted** (pending D2, per your tweak).
- Spot-checks pass: Long Beach CA → `["0643000"]`, LA County CA → `["06037"]`, California → `{abbrev:"CA"}`, Bloomington IN → `geoids:[]`.
- Regenerated on every deploy from `src/lib/coverage.js` via a `prebuild` hook.

## ✅ CORS is LIVE
`Access-Control-Allow-Origin: *` is now on `/coverage.json` (verified cross-origin from an
`Origin: https://financials.empowered.vote` request → `200`, `application/json`, `ACAO: *`).
Set via a Render dashboard header rule (the service is `essentials-frontend`, created manually, so
`render.yaml` headers were ignored — noted for future config work). **You can wire the direct
browser `fetch()` now** — no server-side proxy needed.

**DoD #1–3 met.** Only #4 (the `federal.target`) remains, gated on D2.

## Origin confirmed
Point `VITE_ESSENTIALS_URL` at `https://essentials.empowered.vote` (no trailing slash).

## D2
Planned and scoped (national-officials browse route + `federal` record). Backend endpoint first,
then frontend + `federal` catalog record. Separate update when it ships.
