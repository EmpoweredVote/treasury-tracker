---
phase: 124-verification-cohort-audit-uat-ver-09-ver-10
plan: 03
requirement: VER-10
status: pending
signed_off_by:
signed_off_date:
production-confirmed: "2026-07-05 HTTP 200 at treasurytracker.empowered.vote"
---

# Phase 124 — Live-App UAT Checklist (VER-10)

**Purpose:** Human sign-off that the v2.15 "Final Tail + NASBO Retirement" milestone — the last
21 states upgraded NASBO→ACFR (Phases 118–121), the CA/FL deepening (Phase 122), and the NASBO
loader retired to fallback-only (Phase 123) — renders correctly and honestly to a citizen in the
live app. All 50 states now carry State-ACFR GAAP data. Data correctness was independently proven
in Plan 124-01 (149/151 exact $0 ties, 2 EXPLAINED pre-approved rounding; `124-REDERIVATION.md`)
and the 50-node, 1,560-row cohort source-chain audit is clean (Plan 124-02, 14/14 invariants PASS,
50/50-ACFR, NASBORT-01 confirmed; `124-COHORT-AUDIT.md`). This UAT is the final check that what
the DB says matches what the app shows.

**App URL:** https://treasurytracker.empowered.vote

**The 5 standard checks at every ACFR anchor** (unless the anchor says otherwise):
1. **Revenue-by-source** — the Money In / revenue view renders with by-source rows.
2. **Spending-by-function** — the operating view renders with function/department rows.
3. **Basis label** — the data-source label says State ACFR / **GAAP basis** (NOT NASBO), except
   where a pre-GASB-34/CAFR-era or FY-end-specific label is explicitly called out below.
4. **Source chip** — shows a real source URL + date; the link opens the state's ACFR/CAFR.
5. **Money In enabled** — the Money In card/toggle is available on the node.

Record **PASS / FAIL + notes** per anchor. Expected values below come from the independent
re-derivation (`124-REDERIVATION.md`) and the cohort audit (`124-COHORT-AUDIT.md`), never from
the loaders.

---

## Anchor 1 — CA FY2002 (deepening floor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=california-ca&year=2002&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$63.9B** ($63,942,875,000) — NOT $64T or $64M.
- Operating ≈ $73.9B ($73,900,709,000).
- **Extended-window check:** the year selector reaches back to **FY2002** (the new deepened
  floor — previously CA started at FY2020) and Money In is enabled across the full FY2002–2025
  window, not just the newer years.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 2 — FL FY2003 (deepening floor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=florida-fl&year=2003&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$19.9B** ($19,857,818,000).
- Operating ≈ $21.7B ($21,723,170,000).
- **Extended-window check:** the year selector spans **FY2003–2024** (the new 18-year deepened
  run — previously FL started at FY2022).
- **Hole honesty:** FY2000–2002 must be honestly **absent** from the year selector (damaged-xref
  repair-pending source, no interpolation) — not shown with a fabricated/interpolated value.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 3 — ID FY2004 (mixed-unit year)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=idaho-id&year=2004&dataset=revenue
- Standard checks 1–5.
- **Magnitude / no-skew check:** revenue total displays ≈ **$2.3B** ($2,314,492,000) — this is
  ID's ONLY year printed in whole dollars (every other ID year prints in thousands); confirm it
  renders at the SAME order of magnitude as neighboring years (e.g. FY2025 ≈ $6.66B), with
  **no visible 1000× skew** either up or down. Operating ≈ $1.67B ($1,670,288,000).

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 4 — NV FY2019 (dollar-unit state, UNITS=1)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=nevada-nv&year=2019&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$10.41B** ($10,411,179,917) — NOT $10.4T or
  $10.4M (NV is stored in full dollars, not thousands; a units slip would be ×1000 off).
  Operating ≈ $10.14B ($10,143,797,415).
- By-source rows present; GAAP basis label; source chip shows url + date.

**Alternate anchor (if NV FY2019 is unavailable):** ND FY2025 —
https://treasurytracker.empowered.vote/?entity=north-dakota-nd&year=2025&dataset=revenue —
revenue ≈ $4.51B ($4,510,201,793), also UNITS=1 full dollars, no ×1000 skew.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 5 — NM FY2022 (hand-transcribed from raster image, P2 clamp)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=new-mexico-nm&year=2022&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$26.16B** ($26,161,736,000). Operating ≈
  $20.16B ($20,159,689,000). (This year's statement was a raster image with no text layer —
  independently re-rendered + re-OCR'd, tied exact $0 in 124-REDERIVATION.md.)
- **Clamp check:** the revenue category **"Investment Income (Loss)"** (or equivalent negative
  investment-income line) renders **at 0** with a net-loss-clamp label — the parent/root revenue
  total ($26.16B) stays intact (i.e. it already nets the negative, only the leaf line is clamped
  to 0 for display).

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 6 — OK FY2019 (hand-transcribed from embedded JPEG)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=oklahoma-ok&year=2019&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$19.42B** ($19,417,878,000). Operating ≈
  $18.34B ($18,344,756,000). (Source statement was a single embedded JPEG image with no text
  layer — independently re-rendered + re-OCR'd, tied exact $0.)
- By-source rows render correctly; source chip shows url + date.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 7 — SD FY2007 (whole-document-scanned, hand-transcribed)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=south-dakota-sd&year=2007&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$917.99M** ($917,987,000). Operating ≈
  $1.092B ($1,092,097,000). (One of 9 whole-document-scanned years in SD's window, FY2003–2011
  excl. FY2002 — independently re-rendered + re-OCR'd, tied exact $0.)
- **Near-parity check:** this year should sit close to the old NASBO-era scope (~1.03× — the
  smallest divergence in the whole v2.15 tail), i.e. no dramatic unexplained jump vs. prior
  NASBO figures for SD.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 8 — AR FY2024 (single-fund state, widest divergence)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=arkansas-ar&year=2024&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$24.0B** ($24,045,611,000). Operating ≈
  $22.16B ($22,159,960,000).
- **Basis-note check:** a prominent, honest basis note is visible explaining that Arkansas's
  single "Statement of Revenues, Expenditures, and Changes in Fund Balance" (not a plural
  multi-fund statement) IS the General Fund — i.e. the whole governmental-activity statement
  folds into what's displayed as the GF, the widest scope divergence in the v2.15 tail (~3.96×
  vs. the old NASBO scope). The note must NOT be hidden or absent — a citizen should be able to
  see why AR's number looks different from other states.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 9 — NV FY2024 (NASBO FALLBACK #1 — honest disclosure)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=nevada-nv&year=2024
- **NASBO label check:** the FY2024 **operating** view shows the honest **NASBO State
  Expenditure Report** label (budgetary basis) — NOT a GAAP/ACFR label. NV's ACFR covers
  FY2019–FY2023; the FY2024 ACFR has not yet been published, so this is the loader's documented,
  disclosed fallback (confirmed in 124-COHORT-AUDIT.md §1 NASBORT-01: exactly 2 NASBO rows exist
  cohort-wide, this is one of them).
- **No-false-ACFR check:** no ACFR/GAAP label is shown for FY2024 operating — the honest NASBO
  label is not disguised or blended with GAAP language.
- **Revenue-absence check:** switching to `?dataset=revenue` for FY2024 shows **no revenue data**
  for FY2024 (NV's ACFR revenue series ends at FY2023) — absent, not a fabricated/interpolated
  value. FY2023 (both op + rev) should still show full ACFR GAAP as normal.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 10 — KY FY2023 (NASBO FALLBACK #2 — one-year island)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=kentucky-ky&year=2023
- **NASBO island check:** FY2023 **operating** shows the honest **NASBO State Expenditure
  Report** label — sandwiched as a one-year island between FY2022 (ACFR GAAP) and FY2024 (ACFR
  GAAP). This is KY's documented broken-font-PDF hole (carried unchanged from Phase 116/121;
  confirmed the cohort's other NASBO fallback in 124-COHORT-AUDIT.md's NASBORT-01 check).
- **Year-selector gap check:** the year selector should show the surrounding ACFR years (FY2022,
  FY2024) without pretending FY2023 is also ACFR.
- **Revenue-absence check:** switching to `?dataset=revenue` for FY2023 shows **no revenue data**
  for FY2023 — honestly absent, no interpolation across the gap.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 11 — ME FY2002 (FY-end semantics anchor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=maine-me&year=2002&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$2.30B** ($2,302,006,000). Operating ≈
  $2.60B ($2,604,696,000).
- **FY-end disclosure check:** the source chip / source date reads a standard **June-30**
  fiscal-year-end (confirmed DB-side in 124-COHORT-AUDIT.md INV-ME: all 48 ME rows carry
  `fiscal_year_start_month`=1 and `source_date` ending `-06-30` — the earlier "non-June to
  watch" recon flag is resolved). The date shown must NOT be mislabelled as a different FY-end.

**Alternate anchor (if ME FY2002 is unavailable):** MI FY2025 —
https://treasurytracker.empowered.vote/?entity=michigan-mi&year=2025&dataset=revenue — confirm
the source chip / source date reads **2025-09-30** (Michigan's Oct–Sep fiscal year), not
June 30 — the non-standard FY-end is disclosed, not mislabelled.

**Result:** ☐ PASS ☐ FAIL — Notes:

## Anchor 12 — WY FY2025 (REGRESSION GUARD — 50/50 completion node)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=wyoming-wy&year=2025&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$4.03B** ($4,027,001,270 — UNITS=1 full
  dollars, no ×1000 skew). Operating ≈ $3.21B ($3,206,868,645).
- **Regression check (the critical anchor):** Wyoming was the LAST state loaded, completing
  50/50 states on State-ACFR GAAP. This node must render **full ACFR GAAP** revenue-by-source +
  spending-by-function with a GAAP basis label, Money In enabled, and **ZERO** occurrence of the
  word "NASBO" anywhere on the node (label, source chip, tooltip, or basis note). If any NASBO
  text appears here, the NASBO-retirement guard (Phase 123, NASBORT-01) has regressed.

**Result:** ☐ PASS ☐ FAIL — Notes:

---

## Sign-off

All 12 anchors must PASS → sign and date below. Any FAIL that is a data-correctness or
source-chain defect must be fixed in-phase (via the source-safe never-overwrite
`treasury_sync_budget_tree` RPC — never `treasury_sync_city_budget`) and re-confirmed before
sign-off; cosmetic/code-quality items are logged, not gated.

**Signed off by:** _______________ **Date:** _______________ — **___/12 anchors PASS, ___
defects fixed in-phase, ___ cosmetic items logged.** VER-10 satisfied.
