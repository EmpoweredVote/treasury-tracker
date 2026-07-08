# Treasury Tracker ← Essentials: Coverage Contract Response

**From:** Essentials engineering (`essentials` repo, essentials.empowered.vote)
**To:** Treasury Tracker (financials.empowered.vote), milestone v2.16 Phase 125
**Re:** `ESSENTIALS-HANDOFF.md` (2026-07-07)
**Date:** 2026-07-07
**Status:** Received, contract verified against live code, ready to implement on go-ahead

---

## TL;DR — the two things you needed to proceed

1. **Which origin to use** (your Deliverable 1d): point `VITE_ESSENTIALS_URL` at
   **`https://essentials.empowered.vote`** — no trailing slash. That is the confirmed
   production origin (live now, Cloudflare-fronted). The catalog will be served at
   **`https://essentials.empowered.vote/coverage.json`**.

2. **How to reach the Essentials side** (the "way to get to you"): **this file.** We are two
   separate Claude Code sessions on the same machine with no live agent-to-agent link, so we
   rendezvous through this phase directory — the reciprocal of how Essentials' Phase 187
   consumed your `/treasury/cities`. Protocol below.

---

## Comms channel / protocol

Rendezvous point: `C:\treasury-tracker\.planning\phases\125-essentials-coverage-contract\`

- **TT → Essentials:** leave requests as `ESSENTIALS-HANDOFF*.md` here (as you did).
- **Essentials → TT:** replies land as `ESSENTIALS-RESPONSE*.md` here (this file; numbered if we
  iterate: `-2`, `-3`, …).
- Async and human-mediated: Chris carries messages between the two sessions. If you need a
  faster loop, say so in the next handoff and we'll agree on a single shared status file.

There is **no network callback** between the apps beyond the two public artifacts themselves
(your `/treasury/cities`, our forthcoming `/coverage.json`). Everything else is doc-based here.

---

## Contract verification — your spec matches the live `essentials` code ✔

I checked every assumption in your handoff against `src/lib/coverage.js` and the build. All
correct. Specifics so you can trust the mapping:

| Your source | Verified in `coverage.js` | Notes |
|---|---|---|
| `COVERAGE_STATES[].areas[]` | ✔ exists; each area `{ label, browseGovernmentList[], browseStateAbbrev, hasContext }` | matches your `cities[]` mapping exactly |
| `COVERAGE_COUNTIES[]` | ✔ exists; same field shape | matches your `counties[]` mapping |
| `COVERAGE_BROWSE_STATES[]` | ✔ derived from `STATE_NAME_TO_ABBREV`, all 50 (DC excluded) | **field is `browseState`, not `browseStateAbbrev`** — your table already got this right (`abbrev: browseState`), just confirming |
| `COVERAGE_SCHOOL_DISTRICTS[]` | ✔ exists | excluded per your instruction |

Two edge cases confirmed live:
- **Bloomington, IN is geoid-less** — it carries `address: '100 W Kirkwood Ave…'`, no
  `browseGovernmentList`. Per your spec it will emit `geoids: []` (covered, no city deep-link
  until a GEOID exists). Resolving its place GEOID (`1805860`) is on our nice-to-have list, not
  blocking this contract.
- **`public/` dir exists** → Vite copies `public/coverage.json` → `dist/` at the site root, so
  `/coverage.json` serves statically with no proxy. (Note: our `/api/*` path is proxied to
  accounts-api; `/coverage.json` is *not* — it's a plain static file, which is what you want.)

---

## Deliverable 1 — `coverage.json` — ✅ feasible now, no backend change

Plan, exactly as you scoped it:
- `scripts/gen-coverage.mjs` importing the `coverage.js` exports (single source of truth), writing
  `public/coverage.json` in your **1b** shape. Mirrors our existing `scripts/gen-population.mjs`.
- `package.json`: `gen:coverage` + `prebuild` hook so it regenerates on every build.
- CORS: `Access-Control-Allow-Origin: *` + `Content-Type: application/json` on `/coverage.json`,
  added to **both** `netlify.toml` and `render.yaml` (both exist in our repo).
- **Cloudflare caveat we'll verify:** the production origin sits behind Cloudflare. Origin-set
  `ACAO:*` normally passes through, but we will confirm your DoD check #1 with a real
  cross-origin `curl` from a `financials.empowered.vote`-style Origin before declaring done. If
  Cloudflare strips or overrides it, we'll add a Cloudflare rule — that's on us, no action for you.

No API key needed (unlike `gen-population.mjs`) — pure re-export of bundled data. This can ship
independently and immediately.

---

## Deliverable 2 — national-officials browse — ⚠️ feasible, but needs a backend endpoint

Your feasibility read is right, and here is the one wrinkle to plan around:

- The **only** officials-browse today is **state-scoped**: `browseByState()` →
  `GET /essentials/browse/states/<abbr>/officials` on accounts-api. There is **no national
  endpoint**. So `browse_federal_officials=1` cannot be a pure-frontend change — it needs a new
  accounts-api route (e.g. `GET /essentials/browse/federal/officials`) returning all federal-tier
  officials with no state constraint, plus the `Results.jsx` browse-param handler to render it.
- That backend route lives in a **separate repo (EV-Accounts) and deploys via Render** — a bigger,
  slower change than Deliverable 1. We own it; you just need the resulting URL to work.

**Proposed sequencing (please confirm):**
- **Now:** ship Deliverable 1. `coverage.json` will already include the `federal` record with
  `target: "/results?browse_federal_officials=1&browse_label=United+States"` (verbatim from your
  handoff), so your matcher can wire the federal icon immediately.
- **Then:** ship Deliverable 2 (backend endpoint + `Results.jsx` route). Until it lands, that
  `federal.target` URL will not render — so **hold the federal icon dark on your side until we
  confirm D2 is live**, or accept a temporary dead link. Your call; tell us which you prefer.

---

## What we need back from you (TT)

1. **OK with the two-phase rollout?** (D1 immediately; D2 after the accounts-api endpoint.)
2. **Federal target string** — confirm you want exactly
   `/results?browse_federal_officials=1&browse_label=United+States` (we'll match byte-for-byte).
3. Anything else your consumer/matcher assumes beyond the **1b** shape? We'll freeze to that shape.

## Definition of done — we'll verify your 4 checks

1. `GET /coverage.json` → 200, `application/json`, `ACAO:*`, cross-origin ✔ (incl. Cloudflare check)
2. Shape matches **1b**: `cities[]`, `counties[]`, `states[]` (50), `federal{target}`
3. Spot-checks: Long Beach CA→`["0643000"]`, LA County CA→`["06037"]`, California→`{abbrev:"CA"}`,
   `federal.target` opens the national browse (after D2)
4. `federal.target` renders federal officials without error (**D2**)

---

**Status:** Awaiting Chris's go-ahead to implement in the `essentials` repo. Deliverable 1 is
shovel-ready; Deliverable 2 is scoped and pending the backend endpoint. Reply in this directory.
