# 122-03 — DEEP-05 Closeout

**Executed:** 2026-07-05 (inline, no subagents). Read-only verification + honest-floor documentation. The only writes were the two idempotency re-runs of already-loaded FYs (0 net change by design).

## Final Windows (all four DEEP-05 targets, DB-verified)

| State | Node | Before Ph122 | **After Ph122** | Added | Rev+Exp rows |
|-------|------|--------------|-----------------|-------|--------------|
| **CA** | `e1007bf5…f850` | FY2008–FY2025 | **FY2002–FY2025 (24yr)** | **+6** (FY2002–2007) | 24 op / 24 rev |
| **FL** | `adb19ea0…8a1a` | FY2021–FY2024 | **FY2003–FY2024 (22yr)** | **+18** (FY2003–2020) | 22 op / 22 rev |
| **NY** | `1a7f871c…16f4` | FY2003–FY2024 | **FY2003–FY2024 (22yr)** | **0** (floor) | 22 op / 22 rev |
| **TX** | Texas/TX/state | FY2015–FY2024 | **FY2015–FY2024 (10yr)** | **0** (floor) | 10 op / 10 rev |

Total newly-recovered state-FYs this phase: **24** (6 CA + 18 FL) × 2 dataset_types = **48 new rows**, every one tied at exact $0 to its printed GENERAL / GENERAL FUND column total.

## Honest Holes (DEEP-05 success criterion 3 — all surfaced, none faked)

| Target | Hole | Reason | Disposition |
|--------|------|--------|-------------|
| **CA** | ≤FY2001 | SCO returns a soft-404 (HTTP-200 `text/html`, 11,561 bytes) for every naming variant | **Durable floor at FY2002** (the GASB-34 first year). Not attempted, not faked. |
| **NY** | ≤FY2002 | `comprehensive-annual-financial-report-2002.pdf` and earlier return honest 404s; OSC's `/reports/finance` listing only enumerates back to FY2003 | **Genuine durable floor at FY2003.** 0 recoverable years — no code change. |
| **FL** | FY2000–FY2002 | Durable `application/pdf` URLs exist (16–24 MB) but `pdftotext` fails on damaged xref (~216 bytes out); **qpdf not installed** and adding a package crosses the no-new-packages line | **Repair-pending** (durability-satisfied / extractability-blocked). Pre-GASB-34 status unconfirmed pending a future repair pass. Not faked. |
| **TX** | ≤FY2014 | No durable per-year statewide-ACFR URL located within recon budget; the `96-542.pdf` candidate is a different single-agency report (rejected) | **Durable floor at FY2015.** FY2016 within-window file-id gap was closed in Phase 99-01, re-confirmed live 200. 0 recoverable years — no code change. |

## Whole-phase verification results

- **Idempotency:** CA `--fy 2002` and FL `--fy 2003` (op + rev) re-runs each → **0 net change** (totals + leaf counts identical, no duplicate categories).
- **Ties:** every added CA + FL FY ties at exact $0 (extract_gf `rev_tie`/`exp_tie` True across all 24). Bookends: CA FY2002 rev $63,942,875K / FY2007 $96,309,497K; FL FY2003 rev $19,857,818K / FY2020 $40,534,343K.
- **0 residue (LOAD-01):** FL loaders + CA revenue loader use the ephemeral data_sources lifecycle → 0 `fl-%`/`ca-…-revenue` rows; CA operating keeps exactly 1 persistent registry row (`ca-acfr-gf-operating`, 24 years). No orphan/duplicate rows.
- **P2 clamp:** CA FY2002–2007 have no negatives (clamp not fired); FL FY2004 (−$78,773K) + FY2009 (−$374,931K) "Investment earnings" clamped → leaf at 0, root nets. Matches the FY2021/FY2022 precedent.
- **Cohort untouched:** loads were node-scoped to the CA + FL node ids only. NY + TX windows unchanged (22/10 rows, same min/max FY). **All 50 state nodes still carry operating rows** (cohort intact — nothing regressed).
- **Money In:** CA, NY, FL, TX each retain ≥1 revenue row → Money In enabled on all four.
- **Pre-existing windows untouched:** CA FY2008 + FY2025 and FL FY2021 + FY2024 totals byte-identical to pre-load (all new years loaded per-`--fy`, never re-writing the existing window).

## Deviation recorded (D-02, resolved)

The ROADMAP phase text — "CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016" — was **stale v2.11-era language**. Phase 104 (v2.12) already deepened CA/NY/FL and Phase 99-01 closed the TX FY2016 gap. Recon (`117-DEEPEN-SOURCES.md`) corrected the premise and established the true current windows before digging; this phase dug **below the actual current windows** (CA→FY2002, FL→FY2003) and reconfirmed the NY (FY2003) and TX (FY2015) floors. This is a Rule-1-class correction, resolved at recon.

## DEEP-05 status: **CLOSED**

All four success criteria satisfied:
1. ✅ CA/FL extended as deep as durable URLs allow (CA +6→FY2002, FL +18→FY2003); NY/TX floors reconfirmed (0 recoverable).
2. ✅ Every added year ties exactly to its printed GF total; honest GAAP basis labels (no pre-GASB-34 dig needed — CA FY2002+ and FL FY2003+ are all modern-layout).
3. ✅ All four unrecoverable/repair-pending holes documented honestly (above), nothing faked.
4. ✅ Idempotent; existing rows untouched; 0 residue; no manual re-clean.

## Hand-off
- **Phase 123** (NASBORT-01): retire NASBO to fallback-only. DEEP-05 nodes are all ACFR-sourced.
- **Phase 124** (VER-09/VER-10): loader-independent blind re-derivation of the 24 newly-deepened CA/FL state-FYs + 50-state cohort audit; Chris live-app UAT should sample a deepened node (CA FY2002–2007 or FL FY2003–2020) to confirm the extended history renders with real sourced revenue-by-source + spending-by-function.
