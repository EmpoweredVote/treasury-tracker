---
phase: 130-verification-live-uat
plan: "02"
subsystem: verification
tags: [tucson, pima-county, essentials, tether, coverage, tuc-09]

# Dependency graph
requires:
  - phase: 125-127 (v2.16, archived)
    provides: the generic tether mechanism + src/utils/essentialsCoverage.ts matcher this plan mirrors
provides:
  - TUC-09 pre-determined verdict — both Tucson + Pima County COVERED by live coverage.json
  - scripts/verify-phase130-tether.mjs (re-runnable probe, exit 0 = fetched_ok)
  - .planning/phases/130-verification-live-uat/130-TETHER-VERDICT.md (prediction for UAT confirmation)
affects: [130-03-uat-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ported the shipped matcher (normalizePlace/stripLabel/matchEntityToCoverage city+county branch/isValidCatalogShape) verbatim into a Node probe rather than importing the Vite/ESM browser module"
    - "Explicit fetched_ok{covered|not_covered} vs fetch_failed distinction so a network failure is never mislabeled a coverage gap"

key-files:
  created:
    - scripts/verify-phase130-tether.mjs
    - .planning/phases/130-verification-live-uat/130-TETHER-VERDICT.md
  modified: []

key-decisions:
  - "Set process.exitCode + drain (with an unref'd 1s safety force-exit) instead of calling process.exit() directly — abrupt process.exit while the undici keep-alive fetch socket was mid-close triggered the Windows libuv UV_HANDLE_CLOSING assertion / exit 127 (cosmetic, after output); the drain pattern exits cleanly (0)."
  - "D-10 cross-repo gap path NOT triggered — Essentials already publishes a Tucson city record and a Pima County record."

# Result
result: PASS (both covered)
evidence:
  - "coverage.json fetched HTTP 200 (generatedAt 2026-07-10T16:27:17.210Z; 137 cities, 17 counties, 50 states, federal)"
  - "Tucson (city, AZ) → COVERED, GEOID 0477000; Pima County (county, AZ) → COVERED, GEOID 04019"
  - "Icon EXPECTED to render + deep-link on both banners; live confirmation is UAT scenario (j) in Plan 130-03"
---

# Plan 130-02 Summary — TUC-09 tether pre-determination

Turned the tether check into a confirmation (D-09). `verify-phase130-tether.mjs` fetches
the live Essentials `coverage.json` and runs the same deterministic matcher the app
ships (mirrored, not imported) for Tucson (city/AZ) and Pima County (county/AZ). **Both
are COVERED** — Tucson → Census place GEOID `0477000`, Pima County → county GEOID
`04019` — so the v2.16 tethered Essentials icon is expected to render and deep-link on
both banners. No cross-repo Essentials coverage gap applies (D-10 not triggered). The
probe distinguishes not-covered from fetch-failed so a transient network failure can't
be misread as a gap. Prediction recorded in `130-TETHER-VERDICT.md` for Chris to confirm
live in Plan 130-03 (scenario j).
