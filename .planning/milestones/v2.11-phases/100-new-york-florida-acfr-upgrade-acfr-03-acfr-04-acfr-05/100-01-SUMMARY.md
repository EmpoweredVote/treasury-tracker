# 100-01 SUMMARY — Build NY+FL ACFR loaders + extend cleanup (dry-run)

**Executed:** 2026-06-29 inline (no executor subagent, per v2.11 constraint). $0 spend (pdftotext only, D-10). Zero production DB writes.

## Result: all three tasks done; extraction risk retired.

### Files created / modified
| File | Role | Status |
|------|------|--------|
| `scripts/processNYAcfr.js` | NY GF operating (spend-by-function), FY2015–2024, "General" col, **MILLIONS ×1,000,000** | dry-run clean |
| `scripts/processNYRevenueAcfr.js` | NY GF revenue-by-source + P2 clamp, FY2015–2024, millions | dry-run clean |
| `scripts/processFLAcfr.js` | FL GF operating, FY2022–2024, "General Fund" col, thousands | dry-run clean |
| `scripts/processFLRevenueAcfr.js` | FL GF revenue-by-source + P2 clamp, FY2022–2024, thousands | dry-run clean |
| `scripts/cleanupStaleStateGFDataSources.mjs` | extended with NY+FL targets + `--state NY\|FL` | dry-run clean, CA/TX regression OK |

### DEVIATION — operating loader filenames (processNYAcfr.js / processFLAcfr.js, not processNY.js / processFL.js)
The plan named the operating loaders `processNY.js` / `processFL.js`. **Both already existed** as git-tracked legacy v1.7 loaders (NY: openbudget.ny.gov enacted-plan; FL: flsenate.gov GRF) — the dead loaders that originally fed the now-stale `ny-gf-operating` / `fl-gf-operating` data_sources (0 live rows; superseded by the v2.10 NASBO load). They have **zero references** anywhere in the repo. Rather than clobber pre-existing files I didn't author, I followed the repo's existing `*Acfr.js` convention (cf. `processOHAcfr.js`, `processCARevenueAcfr.js`) and created **new** `processNYAcfr.js` / `processFLAcfr.js`. The legacy loaders are left intact (harmless dead code); Phase 102's audit can decide whether to remove them. Net effect on the phase goal: none — the ACFR loaders are the ones that run in 100-02 / 100-03.

### Extraction method (proven, $0)
`pdftotext -table` (NOT `-layout`) on local PDFs in `_acfr-tmp/{ny,fl}/`. Downloaded the 9 missing PDFs (NY FY2016–2023, FL FY2023) over plain `curl` — all real PDFs, no soft-404. The GENERAL column is the 1st numeric token per row. **Every FY's transcribed line items sum exactly (0 diff) to the printed General-column Total**, asserted by each loader's `validate()` (exit 2 on >tolerance mismatch).

#### NY — General column, MILLIONS (×1,000,000 → dollars). All 10 FYs tie.
| FY | Total revenues | Total expenditures |
|----|---------------:|-------------------:|
| 2015 | 55,139 | 60,612 |
| 2016 | 50,674 | 62,756 |
| 2017 | 50,793 | 64,454 |
| 2018 | 56,638 | 66,475 |
| 2019 | 42,185 | 69,553 |
| 2020 | 41,469 | 70,322 |
| 2021 | 68,121 | 83,878 |
| 2022 | 68,634 | 101,018 |
| 2023 | 92,791 | 109,474 |
| 2024 | **93,894** ✓ recon bookend | 115,828 |

Stored dollars = printed millions × 1,000,000 (FY2024 rev → $93,894,000,000, confirmed in dry-run). NY's GENERAL column has **no negative revenue categories** (investment income sits inside positive "Miscellaneous") — the P2 clamp is wired but does not fire on NY (same as CA in Phase 99). Used the finance/reports ACFR (not NYSLRS pension); URL naming flips at FY2022 (≤2021 `comprehensive-annual-…`, ≥2022 `annual-comprehensive-…`).

#### FL — General Fund column, thousands (×1,000). All 3 FYs tie.
| FY | Total revenues | Total expenditures |
|----|---------------:|-------------------:|
| 2022 | **57,241,428** ✓ recon bookend | 36,205,183 |
| 2023 | 59,446,062 | 44,464,013 |
| 2024 | **59,810,603** ✓ recon bookend | 50,141,014 |

**P2 clamp (ACFR-05) FIRES on FL FY2022 revenue** — two negative GF categories: Investment earnings (losses) −$1,573,844,000 and Other −$56,189,000. Both render at 0 area with the signed magnitude in the label ("(net loss — shown at 0)"); the FY total ($57,241,428,000) preserves the net. FL is a like-for-like GF (no TX-style scope mismatch): FY2024 ACFR exp $50.1B vs NASBO budgetary $51.6B.

### Cleanup script (dry-run)
- `--state NY` → would-delete `ny-gf-operating` + `ny-gf-revenue`, each backs **0** budgets rows (0-row assertion PASS).
- `--state FL` → would-delete `fl-gf-operating` + `fl-gf-revenue`, each **0** rows.
- Neither names a `*-gf-operating-nasbo` row or any other state. No deletes performed.
- Regression: default (all 4 states) shows CA/TX already-gone (deleted in Phase 99) + NY/FL would-delete; bad `--state XX` is rejected.

### Verification
- `node scripts/processNYAcfr.js --dry-run` + revenue: 10/10 FY PASS; FY2024 rev = $93,894,000,000.
- `node scripts/processFLAcfr.js --dry-run` + revenue: 3/3 FY PASS; FY2022 = $57,241,428,000, FY2024 = $59,810,603,000; FY2022 negatives clamped.
- Cleanup `--state NY` / `--state FL` dry-runs list the 4 stale ids, 0-row asserted, no deletes; CA/TX unchanged.
- No row written to treasury.budgets or treasury.data_sources.

## Next
100-02 (live NY load, human checkpoint) + 100-03 (live FL load, human checkpoint). Both run the loaders without `--dry-run`, then `cleanupStaleStateGFDataSources.mjs --state {NY|FL} --apply` (the script's real delete flag is `--apply`, not a `--dry-run` toggle — the 100-02/100-03 plan text says "without --dry-run"; the live delete command is `--apply`).
