---
phase: 127-context-sensitivity-live-uat
verified: 2026-07-08
status: passed
score: 2/2 must-have requirements verified (TETH-03, VER-01)
overrides_applied: 0
---

# Phase 127: Context-Sensitivity + Live UAT — Verification Report

**Phase Goal:** Prove the Essentials tether is context-sensitive end-to-end (TETH-03) and
pass Chris's live-app UAT across every entity tier (VER-01). Verify-and-fix capstone of v2.16.

**Verified:** 2026-07-08
**Status:** PASSED
**Full acceptance record:** `127-UAT.md` (matrix + live-behavior + visual checks + sign-off)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Context-sensitivity holds end-to-end: covered city/county/state + federal SHOW the icon → correct Essentials destination; uncovered city and geoid-less-covered city show NO icon (TETH-03) | VERIFIED | Part A executed the **real** resolver modules (`matchEntityToCoverage`→`resolveFeatureIcons`→`buildEssentialsHref`) against the **live** `coverage.json` and the **real TT DB entity records** for all 7 matrix rows — 7/7 produced the exact expected icon-or-absence + href. Bloomington IN confirmed *covered-with-empty-geoids → no icon* (D-127-01), distinct from Fresno CA *uncovered → no icon* (D-127-02). Federal "United States" SHOWS the icon (the v2.16 headline reversal). |
| 2 | Live-app verification + Chris UAT sign-off (VER-01) | VERIFIED | `127-UAT.md`: Chris confirmed the browser-only dimensions live at treasurytracker.empowered.vote (graceful degrade, clean console, light/dark legibility, narrow-viewport title clearance, one-fetch/session Network count, click-through) and gave the VER-01 sign-off ("all good, sign it off", 2026-07-08). |
| 3 | Live network behavior the fixtures couldn't prove (D-127-04) | VERIFIED | (a) Real cross-origin fetch: `200` + `access-control-allow-origin: *` confirmed by `npm run smoke:essentials` (11/11) AND the Part A live harness; (b) graceful degrade: `fetchCoverage` never-throws→`null`→`resolveFeatureIcons(null)`=`[]` (Part A) + Chris UX confirm; (c) console clean (Chris); (d) one-fetch cache: `fetchCoverage()` returns the same cached object (Part A) + Chris Network count. |

**Score:** 2/2 requirements verified; 0 defects found (no in-phase fix loop needed).

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `scripts/essentials-live-smoke.mjs` + `npm run smoke:essentials` | VERIFIED | Offline-safe live-fetch smoke check; 11/11 checks PASS, exit 0; asserts CORS `*` + shape + matrix anchors + Fresno absent. Not wired into `test`/`build` (offline vitest stays deterministic). |
| `127-UAT.md` | VERIFIED | Full matrix (exact hrefs), D-127-04 live checks, D-126-03 + narrow-viewport visual checks, all green; Chris VER-01 sign-off recorded. |

### Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| TETH-03 | Context-sensitivity end-to-end (uncovered→none, federal→shows, covered→correct) | SATISFIED — 7/7 matrix rows verified against live data + real code |
| VER-01 | Live-app verification + Chris UAT sign-off | SATISFIED — sign-off recorded in 127-UAT.md |

### Notable Correction

The CONTEXT.md uncovered-city candidate **Plano TX was falsified during planning** — it IS in
Essentials coverage. Replaced with **Fresno CA** (verified in `treasury.municipalities` as a
`city`, verified absent from the 136 covered cities) — a stronger negative case (uncovered city
inside a *covered* state, proving city-tier gating specifically).

### Anti-Patterns Found

None. No product source was modified (zero defects surfaced), so no regression surface introduced.
The Phase-126 T-126-01 same-origin href guard remains intact (unchanged + still green in vitest).

### Gaps Summary

No gaps. Both phase requirements verified; the milestone stays self-contained (no punted fixes).

---

_Verified: 2026-07-08 — Part A by Claude (executable, real code × live data); Part B + VER-01
sign-off by Chris (live app)._
