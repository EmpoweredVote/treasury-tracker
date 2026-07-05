---
phase: 122-deepening-existing-acfr-node-pre-window-holes-deep-05
plan: "122-01"
status: complete
completed: 2026-07-05
requirements: [DEEP-05]
---

# 122-01 Summary — California DEEP-05 Deepening (FY2002–FY2007)

## What shipped
Extended both California State-ACFR pilot loaders to add **6 clean years (FY2002–FY2007)** to the existing CA state node `e1007bf5-bac9-4b1c-878e-f6834885f850`, taking its window from FY2008–FY2025 to **FY2002–FY2025 (24 contiguous years)**:
- `scripts/processCA.js` — GF spending-by-function (operating): +6 `SOURCES`, +6 `EXPENDITURES` entries, `years` + `fiscal_years` extended.
- `scripts/processCARevenueAcfr.js` — GF revenue-by-source (revenue): +6 `SOURCES`, +6 `REVENUE` entries, `years` + `fiscal_years` extended.

All 6 years downloaded from `sco.ca.gov/Files-ARD/CAFR/` (FY2006–07 `cafr{NN}.pdf` no-web; FY2002–05 `{YYYY}_cafr{NN}.pdf`), extracted via `pdftotext -table` + `extract_gf.py`, transcribed as **full dollars** (printed thousands ×1,000).

## Verification (all pass)
- **Ties:** every year ties at exact **$0** on both revenues and expenditures (extract_gf `rev_tie`/`exp_tie` True). Bookends live-verified: FY2002 rev **$63,942,875,000**, FY2007 rev **$96,309,497,000**.
- **Leaves persisted:** 11 operating + 12–13 revenue category leaves per year in `treasury.budget_categories`.
- **Idempotent:** CA `--fy 2002` re-run → 0 net change (no duplicate leaves).
- **0 residue (LOAD-01):** revenue loader ephemeral (0 `ca-acfr-gf-revenue` rows); operating keeps 1 registry row (`ca-acfr-gf-operating`, 24 years). No orphans.
- **Pre-existing window untouched:** FY2008 + FY2025 op/rev totals byte-identical to pre-load (loaded per-FY, never re-wrote FY2008+).
- **Money In:** stays enabled (CA revenue rows now FY2002–FY2025).

## Notes / deviations
- **No pre-GASB-34 flag** — FY2002 is the GASB-34 first year (modern layout); `pre34Extract.mjs` not used.
- **No negative GF lines** in FY2002–FY2007 → P2 `clampForRender` wired but does not fire these years.
- **D-02 (resolved):** ROADMAP "CA pre-FY2020" text was stale v2.11 language; recon corrected the premise (CA was already FY2008+). This dig went below FY2008 to the true FY2002 durable floor.
- **CA ≤FY2001** = documented honest soft-404 floor (not attempted, not faked).
- Ran inline (no subagents) per standing directive.

## Hand-off
- Phase 122 remaining (paused at user request): **122-02** (FL FY2003–FY2020) + **122-03** (NY/TX honest-floor doc + DEEP-05 closeout).
- Phase 124 (VER-09/VER-10): blind re-derivation of the 6 new CA state-FYs + Chris UAT sampling a deepened node.

Full detail: `122-01-CA-LOADLOG.md`.
