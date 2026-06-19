# 70-01 SUMMARY — county seed + link + city display-name fix (UCO-02)

**Status:** ✅ Code + data complete; live-app human-verify (Task 3) pending Chris sign-off (folded into a single 70-02 app review). $0.

## Task 1 — `--cities` member-list path in seedCountyLinks.js (D-70-02) ✅
Added a `cities: { type: 'string' }` flag. When `--cities "A,B,C"` is passed, the explicit list is used and the CA-only SCO Socrata fetch (`fetchCountyCityNames`) is bypassed; when absent, the original CA path is byte-for-byte unchanged. `node --check` passes. Commit `1143a2a`.

## Task 2 — seed 5 counties + link 10 cities ✅
- Confirmed (read-only) the Utah **state node already exists** (`name='Utah'`, `entity_type='state'`, id `740cffee-…`) — reused as parent, NOT re-seeded.
- Dry-ran all 5 counties (all members resolved, 0 "Not yet in DB"), then live-seeded the 5 `entity_type='county'` rows and linked the 10 cities via `county_id`:
  - **Salt Lake County** [`40b445ad`] → Salt Lake City, Sandy, West Jordan, West Valley City
  - **Utah County** [`73ec3a7c`] → Provo, Orem, Lehi
  - **Davis County** [`935d3b7a`] → Layton
  - **Weber County** [`9fb03463`] → Ogden
  - **Washington County** [`c925e6bf`] → St. George
- DB-verified: exactly 5 county rows; state node still single (not duplicated); all 10 cities non-NULL `county_id`, 0 mis-links.

## Mid-plan correction — Utah city display names ✅ (Chris-approved)
Chris flagged during review that 8 cities read as "Provo City / Orem City / Ogden City…". Root cause: **Phase 69** loaded municipalities under Utah's Transparent Utah legal `entity_name` (every entity carries a "City" suffix). Only **Salt Lake City** and **West Valley City** legitimately keep it.

Fix (commit `c7b26b3`):
- Renamed the 8 city rows in-DB to display names (Provo City→**Provo**, etc.). `county_id` links + budget rows unaffected (both keyed by municipality id).
- `loadUtahTransparency.js`: added `UT_DISPLAY_NAME` map + `toDisplayName()` — queries BigQuery by the raw `entity_name` but stores/looks up the municipality by display name, so **re-loads and Phase 71 salaries target the renamed rows, no `…City` duplicates**.
- `loadUTPopulation.js`: `DB_NAME` map now points at the clean display names.

## Requirements
- **UCO-02:** county entities seeded + all 10 cities linked + state parent confirmed. Breadcrumb/Cities-in-County render pending live-app confirmation (SC#3).

## Self-Check: PASSED
seeder `node --check` ok; 5 counties + correct links verified in DB; display-name rename verified (links + 24 budget rows/city intact).
