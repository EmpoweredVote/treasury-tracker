---
phase: 110-verification-source-chain-audit-uat-ver-05-ver-06
plan: 03
requirement: VER-06
status: pending
production-confirmed: "2026-07-01 HTTP 200 at treasurytracker.empowered.vote"
---

# Phase 110 — Live-App UAT Checklist (VER-06)

**Purpose:** Human sign-off that the v2.13 tranche-2 data (10 new ACFR GAAP states: NJ, MA, NC,
GA, MD, TN, CT, WI, WA, MI — 250 state-FY rows) renders correctly to a citizen in the live app.
Data correctness was independently proven in Plan 110-01 (49/49 exact $0 ties,
110-REDERIVATION.md) and the 50-node source-chain audit is clean (Plan 110-02, 10/10 invariants,
110-COHORT-AUDIT.md). This UAT is the final check that what the DB says matches what the app shows.

**App URL:** https://treasurytracker.empowered.vote

**The 5 standard checks at every anchor** (unless the anchor says otherwise):
1. **Money In (revenue-by-source)** — the revenue view renders with by-source rows.
2. **Spending-by-function** — the operating view renders with function/department rows.
3. **Basis label** — the data-source label says State ACFR / **GAAP basis** (NOT NASBO).
4. **Source chip** — shows a real source URL + date; the link opens the state's ACFR.
5. **Money In enabled** — the Money In card/toggle is available on the node.

Record **PASS / FAIL + notes** per anchor. Expected values below come from the independent
re-derivation (110-REDERIVATION.md), never from the loaders.

---

## Anchor 1 — NJ FY2025 (dollars-unit sanity)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=new-jersey-nj&year=2025&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$61.0B** ($60,979,024,211) — NOT $61T or $61M
  (NJ is the tranche's only full-dollars source; a units slip would be ×1000 off).
- Operating ≈ $59.6B ($59,603,886,014).

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 2 — MA FY2025 + hole honesty
**Deep-link:** https://treasurytracker.empowered.vote/?entity=massachusetts-ma&year=2025&dataset=revenue
- Standard checks 1–5. Revenue ≈ $61.9B ($61,907,573,000).
- **Hole honesty:** the year selector offers FY2003, FY2006–2013, FY2015–2020, FY2022–2025 —
  **FY2014 and FY2021 (and FY2004/2005) must be absent**, not shown with interpolated values.

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 3 — NC FY2012 (deep floor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=north-carolina-nc&year=2012&dataset=revenue
- Standard checks 1–5 on the oldest NC year. Revenue ≈ $35.4B ($35,413,469,000);
  operating ≈ $36.5B ($36,460,325,000).

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 4 — GA FY2023 (F-97-01 supersede)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=georgia-ga&year=2023
- **Supersede check:** operating total shows the ACFR GAAP actual ≈ **$59.9B** ($59,893,783,000) —
  NOT the old $29.3B NASBO value. Basis label says GAAP.
- Standard checks 1–5.

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 5 — MD FY2022 (clamp year)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=maryland-md&year=2022&dataset=revenue
- **Clamp check:** the revenue category **"Interest and other investment income (net loss — shown
  at 0)"** renders at 0 with that label; the root total **$50,540,136,000** still nets the
  −$275,992K (i.e. the total is preserved, only the leaf is clamped).
- Standard checks 1–5.

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 6 — TN FY2025 (source chip live)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=tennessee-tn&year=2025&dataset=revenue
- Standard checks 1–5. Revenue ≈ $35.5B ($35,473,625,000).
- **Source-chip navigation:** clicking the source link opens the tn.gov ACFR in the browser
  (tn.gov blocked CLI clients; normal browser navigation should work).

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 7 — CT FY2002 (oldest FY in the whole cohort)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=connecticut-ct&year=2002&dataset=revenue
- Standard checks 1–5 on the pre-GASB-34-boundary edition. Revenue ≈ $11.7B ($11,745,453,000);
  operating ≈ $12.6B ($12,554,181,000).

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 8 — WI FY2013 (clamp year)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=wisconsin-wi&year=2013&dataset=revenue
- **Clamp check:** **"Interest Income (net loss — shown at 0)"** renders at 0 (the −$838K
  zero-rate-era loss); root total **$23,786,216,000** intact.
- Standard checks 1–5.

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 9 — WA FY2022 (the tranche's largest clamp)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=washington-wa&year=2022&dataset=revenue
- **Clamp check:** **"Investment income (loss) (net loss — shown at 0)"** renders at 0 (the
  −$216,940K adverse-bond-market loss); root total **$53,683,370,000** intact.
- Standard checks 1–5.

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 10 — MI FY2025 (3.5× relabel + Sep-30 FY-end)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=michigan-mi&year=2025&dataset=revenue
- Standard checks 1–5. Revenue ≈ **$53.8B** ($53,788,610,000) — the honest ~3.5× jump from the
  old ~$15B NASBO scope (~$30.3B federal-agency passthrough now inside the GAAP GF).
- **Sep-30 check:** the source chip / source date reads **2025-09-30** (Michigan's Oct–Sep fiscal
  year), not June 30.

**Result:** [ ] PASS / [ ] FAIL — Notes:

## Anchor 11 — NASBO control: Colorado (regression guard)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=colorado-co&year=2024
- CO STILL renders **operating-only** with **NASBO** provenance (label says NASBO State
  Expenditure Report, budgetary basis).
- **Money In card is DISABLED/absent** (CO has no revenue dataset).
- Manually visiting `...?entity=colorado-co&year=2024&dataset=revenue` falls back gracefully
  (no crash, no empty-forever view).

**Result:** [ ] PASS / [ ] FAIL — Notes:

---

## Sign-off

All 11 anchors PASS → sign and date below; any FAIL that is a data-correctness or source-chain
defect is fixed in-phase (source-safe never-overwrite path) and re-tested before sign-off;
cosmetic items are logged, not gated.

**Signed off by:** ____________  **Date:** ____________
