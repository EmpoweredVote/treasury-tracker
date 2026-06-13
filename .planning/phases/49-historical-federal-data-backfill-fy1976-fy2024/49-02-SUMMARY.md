# Plan 49-02 Summary — Function-lens backfill loader

**Status:** Complete (build + dry-run verified; real writes deferred to 49-05)
**Commit:** `feat(49-02): parameterize function loader across FY1976-2024 + TQ`
**Requirements:** HIST-01, HIST-04, CTX-01

## What changed
- `scripts/loadFederalFunctions.js` — replaced hardcoded `FY = 2025` / `OMB_OUTLAYS` literal with `--fy <N>` / `--tq` args. Same PBD outlays file + Hist 3.2 titles; extracts the matching year column (`header.index(COLUMN)`), with `--tq` extracting the literal `TQ` column. `buildTree` / offsets / excluded logic unchanged.

## Key decisions & deviations
- **Anchor source = `treasury.federal_annual_summary`** (already holds OMB Hist 1.1 outlays FY1962–2025), a fast DB read — chosen over re-downloading/parsing Hist 1.1 per run. Tolerance is 0.5% (the summary value is rounded to the million; the PBD net is to the thousand).
- **Tier-1 fallback (Hist 3.2 function·subfunction rebuild) intentionally NOT implemented.** Evidence from dry-runs: account-level PBD data reconciles to the OMB anchor essentially exactly for every sample year (FY1976 0.0001%, FY2000 0.0000%, FY2024 0.0000%) — the PBD *is* the account decomposition of the published total, so it ties by construction. Building a Hist 3.2 middle tier would be dead code. **Tier-2 (load-anyway + `visual_vs_official_*` disclosure) is implemented** as the safety net so no year is ever dropped (HIST-04). If a future year fails to reconcile, it loads with a recorded gap rather than halting.
- **`p_period_label` passed only for the TQ.** Normal years call the original 7-arg RPC unchanged → FY1976–2024 loads do NOT depend on migration 49-01; only the TQ does (gated in 49-05 after the migration).

## Verification (dry-run, $0)
| Period | PBD column | Account rows | Net | Anchor delta | Tier |
|--------|-----------|--------------|-----|--------------|------|
| FY2024 | `2024` | 5760 | $6,735.3B | 0.0000% | account |
| FY2000 | `2000` | 5760 | $1,789.0B | 0.0000% | account |
| FY1976 | `1976` | 5760 | $371.8B | 0.0001% | account |
| TQ     | `TQ`   | 5760 | $96.0B | self-anchored | account |

R-02 (account depth back to FY1976) and the TQ-column existence: **confirmed**. Current PBD edition is `outlays_fy2027.xlsx` (actuals through FY2024).

## Follow-ups for later plans
- 49-03 agency loader reuses this exact download/extract path, regrouped by agency→bureau→account.
- TQ self-anchors (no `federal_annual_summary` TQ row); its figure is the PBD `TQ` column sum. Acceptable — Phase 51 explains the TQ.
