---
phase: 133-verification-live-uat
requirement: PIMA-09
kind: tether-pre-determination (determine-then-confirm, D-09)
date: 2026-07-17
essentials_origin: https://essentials.empowered.vote/coverage.json
coverage_generated_at: 2026-07-17T17:10:21.568Z
fetch: fetched_ok
verdict: ALL FOUR COVERED — icon expected on Oro Valley, Marana, Sahuarita, and South Tucson banners
cross_repo_gap: none (D-10 not triggered for any of the four)
---

# Phase 133 — PIMA-09 Tether Verdict (pre-determination)

**Verdict: COVERED for all four new Pima County municipalities.** The live
Essentials `coverage.json` (fetched 2026-07-17, HTTP 200, generated
`2026-07-17T17:10:21.568Z`) contains matching city records for Oro Valley,
Marana, Sahuarita, and South Tucson — Essentials' v22.0 "Tucson & Arizona"
deep-seeds (Phases 195–198) already published all four as city records
ahead of this verification. The v2.16 tethered Essentials icon is therefore
**expected to render** on all four new municipality banners, deep-linking
each into Essentials. **No cross-repo Essentials coverage gap applies to
any of the four** (D-10 path not triggered).

This is the prediction Chris confirms against the live banners in Plan
133-03 (UAT scenario covering all four Pima munis' tether icons). A live
render that does **not** match this prediction is a PIMA-09 finding
(investigate the match/fetch path), not an expected outcome.

## Method (D-09)

- **Probe:** `scripts/verify-phase133-tether.mjs` — a clone of the shipped
  `scripts/verify-phase130-tether.mjs` (Tucson + Pima County), extended to
  the four new municipalities. Fetches the live catalog and mirrors the
  shipped deterministic matcher (`normalizePlace`, `stripLabel`, the city
  branch of `matchEntityToCoverage`, and `isValidCatalogShape`) from
  `src/utils/essentialsCoverage.ts` verbatim in behavior. Read-only,
  off-repo fetch only; no DB; $0 AI spend.
- **Distinguishes** `fetched_ok` → {covered | not_covered} from
  `fetch_failed` (network / non-OK / malformed body), which also degrades
  to no-icon in the app and must not be conflated with a genuine coverage
  gap.
- **Stored display names:** all four municipalities are `entity_type='city'`
  in TT with display names carrying no "Town of" prefix (Oro Valley,
  Marana, Sahuarita, South Tucson) — the matcher's `stripLabel`/
  `normalizePlace` was fed these exact stored names, matching how the
  app's live `matchEntityToCoverage` call is fed the entity's `name` field.

## Catalog snapshot

| Field | Value |
|-------|-------|
| Fetch status | `fetched_ok` (HTTP 200) |
| `generatedAt` | 2026-07-17T17:10:21.568Z |
| cities / counties / states / federal | 143 / 18 / 50 / yes |
| AZ cities in catalog | Tucson, **Oro Valley, Marana, Sahuarita, South Tucson** |
| AZ counties in catalog | Pima County |

## Per-entity verdict

| Municipality | Fetch | Verdict | GEOID | Label | Gap pointer |
|--------------|-------|---------|-------|-------|-------------|
| Oro Valley | fetched_ok | **COVERED** | `0451600` | Oro Valley | n/a |
| Marana | fetched_ok | **COVERED** | `0444270` | Marana | n/a |
| Sahuarita | fetched_ok | **COVERED** | `0462140` | Sahuarita | n/a |
| South Tucson | fetched_ok | **COVERED** | `0468850` | South Tucson | n/a |

All four GEOIDs are correct Census place codes for AZ (state FIPS `04`):
Oro Valley `51600`, Marana `44270`, Sahuarita `62140`, South Tucson `68850`.

## Per-municipality disposition (covered branch)

Every municipality below is **covered** — the expected GEOID+label the live
banner should link to is recorded, and Plan 133-03 confirms the live render
matches.

- **Oro Valley** — expect the Essentials tethered icon to show on the Oro
  Valley banner, deep-linking to GEOID `0451600` ("Oro Valley").
- **Marana** — expect the Essentials tethered icon to show on the Marana
  banner, deep-linking to GEOID `0444270` ("Marana").
- **Sahuarita** — expect the Essentials tethered icon to show on the
  Sahuarita banner, deep-linking to GEOID `0462140` ("Sahuarita").
- **South Tucson** — expect the Essentials tethered icon to show on the
  South Tucson banner, deep-linking to GEOID `0468850` ("South Tucson").

No municipality triggered the not-covered (D-10) branch this run, so there
is no cross-repo Essentials coverage gap to document for PIMA-09. (For
reference, had any municipality come back `not_covered`, the remediation
pointer would have been: Essentials must add that municipality's city
record — label / `state=AZ` / Census place GEOID — to its generated
coverage catalog, requiring **no TT code change**; reference the Essentials
repo `C:/transparent motivations/essentials` — `src/lib/coverage.js`
[normalizePlace source of truth] + the generated `coverage.json`. The icon
would appear automatically once Essentials publishes.)

## Expected live-banner behavior (for UAT)

- **Oro Valley, Marana, Sahuarita, South Tucson banners:** the Essentials
  tethered icon **shows** on each and deep-links that municipality into
  Essentials.
- If any icon is **absent** in the live app, that is a mismatch vs this
  prediction → a PIMA-09 finding (check `fetchCoverage`/
  `matchEntityToCoverage` and the live `coverage.json` at that moment),
  **not** a coverage gap — the catalog covers all four.

## Reproduce

```bash
node scripts/verify-phase133-tether.mjs   # exit 0 = fetched_ok; prints per-entity verdict
```

## Note

D-10's cross-repo remediation path is **not needed** for any of the four
new municipalities — Essentials already publishes city records for Oro
Valley, Marana, Sahuarita, and South Tucson (alongside the pre-existing
Tucson + Pima County records confirmed in Phase 130). Should a future
catalog regeneration ever drop one of these, the remediation pointer is:
`C:/transparent motivations/essentials` — `src/lib/coverage.js`
(normalizePlace source of truth) + the generated `coverage.json`; the TT
mechanism is generic and requires no TT change.
