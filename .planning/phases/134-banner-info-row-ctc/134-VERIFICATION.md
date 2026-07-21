---
status: passed
phase: 134-banner-info-row-ctc
verified_at: "2026-07-21T23:25:00.000Z"
method: automated-checks + live UAT
---

# Phase 134 Verification — Banner Info-Row + CTC Tether

**Status: PASSED.** Phase goal achieved — the TT hero banner adopts Essentials'
population + feature-chip info-row and adds a per-location Civic Trivia
Championship (CTC) tether chip.

## Automated evidence

- `tsc -b` — clean (exit 0).
- `vitest run` — **35/35 pass**, including 12 new `triviaCoverage` matcher tests
  (tier alignment, prefix strip, wrong-state, missing-state, unsupported tiers,
  empty/null catalog) and the unchanged Essentials/featureIcons suites.
- `npm run build` — production build succeeds.
- Deployed: commits 8985d8d / 11c80d0 / 4b052fd; Render deploy live
  (bundle `index-CNkPhEAJ.js`); `trivia-symbol-dark.svg` reachable (200).

## Live UAT (Chris, 2026-07-21) — 6/6 pass, 0 issues

See `134-UAT.md`.

1. City banner info-row layout (population top-left + chips to its right; title bottom-left; no overlap) — pass
2. CTC trophy chip appears where a collection exists, absent otherwise (proxy reachable) — pass
3. Chip tooltips + Essentials/CTC deep-links — pass
4. Population box omitted for nonprofit / no-population entities — pass
5. Federal + state tiers render the info-row — pass
6. Dark-mode legibility (navy scrim + chips + trophy) — pass

## Success criteria (from PLAN.md)

1. Left-anchored POPULATION scrim + Essentials/CTC chips; title bottom-left; hidden for nonprofits/0 — ✅ (UAT 1, 4)
2. CTC chip gated per location, deep-links to ctc.empowered.vote; degrades cleanly — ✅ (UAT 2, 3)
3. tsc clean, tests green, real CTC brand trophy on the navy chip — ✅ (automated evidence)

## Deferred follow-up (non-blocking)

- If the `/trivia/collections` proxy is auth-gated, anonymous visitors may not
  see the CTC chip. UAT confirmed the trophy renders (proxy reachable in the
  tested session); a public CTC catalog (parity with Essentials' public
  `coverage.json`) remains an optional future improvement.
