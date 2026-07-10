---
phase: 130-verification-live-uat
requirement: TUC-09
kind: tether-pre-determination (determine-then-confirm, D-09)
date: 2026-07-10
essentials_origin: https://essentials.empowered.vote/coverage.json
coverage_generated_at: 2026-07-10T16:27:17.210Z
fetch: fetched_ok
verdict: BOTH COVERED — icon expected on Tucson AND Pima County banners
cross_repo_gap: none (D-10 not triggered)
---

# Phase 130 — TUC-09 Tether Verdict (pre-determination)

**Verdict: COVERED for both Tucson and Pima County.** The live Essentials
`coverage.json` (fetched 2026-07-10, HTTP 200, generated `2026-07-10T16:27:17.210Z`)
contains matching records for both entities, so the v2.16 tethered Essentials icon is
**expected to render** on both the Tucson city banner and the Pima County nav-node
banner, deep-linking each into Essentials. **No cross-repo Essentials coverage gap
applies** (D-10 path not triggered).

This is the prediction Chris confirms against the live banner in Plan 130-03 (UAT
scenario j). A live render that does **not** match this prediction is a TUC-09 finding
(investigate the match/fetch path), not an expected outcome.

## Method (D-09)

- **Probe:** `scripts/verify-phase130-tether.mjs` — fetches the live catalog and mirrors
  the shipped deterministic matcher (`normalizePlace`, `stripLabel`, the city/county
  branch of `matchEntityToCoverage`, and `isValidCatalogShape`) from
  `src/utils/essentialsCoverage.ts` verbatim in behavior. Read-only, off-repo fetch only;
  no DB; $0 AI spend.
- **Distinguishes** `fetched_ok` → {covered | not_covered} from `fetch_failed`
  (network / non-OK / malformed body), which also degrades to no-icon in the app and
  must not be conflated with a genuine coverage gap.

## Catalog snapshot

| Field | Value |
|-------|-------|
| Fetch status | `fetched_ok` (HTTP 200) |
| `generatedAt` | 2026-07-10T16:27:17.210Z |
| cities / counties / states / federal | 137 / 17 / 50 / yes |
| AZ cities in catalog | **Tucson** |
| AZ counties in catalog | **Pima County** |

## Per-entity verdict

| Entity | Tier | Outcome | Expected icon | GEOID(s) | Label |
|--------|------|---------|---------------|----------|-------|
| Tucson | city | **COVERED** | present, deep-links into Essentials | `0477000` | Tucson |
| Pima County | county | **COVERED** | present, deep-links into Essentials | `04019` | Pima County |

Both GEOIDs are correct Census codes: `0477000` = AZ (state FIPS 04) + Tucson place
(77000); `04019` = AZ + Pima county (019).

## Expected live-banner behavior (for UAT scenario j)

- **Tucson banner:** the Essentials tethered icon **shows** and deep-links Tucson into
  Essentials.
- **Pima County banner:** the Essentials tethered icon **shows** and deep-links Pima
  County into Essentials.
- If either icon is **absent** in the live app, that is a mismatch vs this prediction →
  a TUC-09 finding (check `fetchCoverage`/`matchEntityToCoverage` and the live
  `coverage.json` at that moment), **not** a coverage gap — the catalog covers both.

## Reproduce

```bash
node scripts/verify-phase130-tether.mjs   # exit 0 = fetched_ok; prints per-entity verdict
```

## Note

D-10's cross-repo remediation path (add a Tucson city record to Essentials' catalog) is
**not needed** — Essentials already publishes both a Tucson city record and a Pima County
record. Should a future catalog regeneration ever drop them, the remediation pointer is:
`C:/transparent motivations/essentials` — `src/lib/coverage.js` (normalizePlace source of
truth) + the generated `coverage.json`; the TT mechanism is generic and requires no TT
change.
