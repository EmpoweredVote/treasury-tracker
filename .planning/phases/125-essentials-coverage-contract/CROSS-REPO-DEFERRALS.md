# Phase 125 — Cross-repo deferrals (RESOLVED)

Per the plan's `scope_note`, SC1 (Essentials serves `coverage.json` with CORS) and the
Essentials half of SC5 (the national-officials browse route live) are producer-side
work tracked and executed in the `essentials` repo, not by this plan. As of this
plan's execution both are **DONE and verified on production** — this note upgrades
the plan's original "deferred, verify post-deploy" language to a resolved record.

## SC1 — `coverage.json` served + CORS — LIVE

Live smoke test run during Task 125-04 (2026-07-08):

```
curl -s -i -H "Origin: https://financials.empowered.vote" https://essentials.empowered.vote/coverage.json
```

Result: `200 OK`, `Content-Type: application/json`, `access-control-allow-origin: *`
(Cloudflare-fronted, header passes through). Shape confirmed live:

- `generatedAt`, `cities` (136), `counties` (16), `states` (50), `federal` (1) — all
  five top-level keys present.
- `federal`: `{"label":"United States","target":"/results?browse_federal_officials=1&browse_label=United+States"}`
  — byte-for-byte the target this plan's fixture and matcher expect.

See `ESSENTIALS-STATUS-D1.md` and `ESSENTIALS-STATUS-D2.md` in this directory for
the full producer-side handoff.

## SC5 (Essentials half) — national-officials browse route — LIVE

Per `ESSENTIALS-STATUS-D2.md`: `GET https://accounts-api.empowered.vote/api/essentials/browse/federal/officials`
returns 571 federal officials, and `https://essentials.empowered.vote/results?browse_federal_officials=1&browse_label=United+States`
renders them with no console errors. Not independently re-verified by this plan
(out of repo scope) — recorded as producer-attested per their DoD.

## What this plan verifies instead

This plan's own verification (Task 125-04) proves the **TT-side consumer** against
a committed fixture (`src/utils/__fixtures__/coverage.sample.json`) matching the
now-confirmed-live contract shape: `npx tsc -b`, `npx vitest run` (14/14 assertions
incl. the federal target), and `npm run build` all exit 0. The one live-network
touchpoint exercised here was the read-only smoke-test curl above — TT's actual
runtime `fetch()` call path (`src/utils/essentialsCoverage.ts`'s `fetchCoverage`)
is not invoked from a Node test environment in this plan (it targets a browser
`fetch`), so full end-to-end live-fetch behavior in the deployed app is confirmed
functionally correct by contract match, not by an in-browser run — that
end-to-end UAT is Phase 127's job (VER-01).
