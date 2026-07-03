---
phase: 116-verification-source-chain-audit-uat-ver-07-ver-08
plan: 03
requirement: VER-08
status: pending
signed_off_by:
signed_off_date:
production-confirmed: "2026-07-03 HTTP 200 at treasurytracker.empowered.vote"
---

# Phase 116 — Live-App UAT Checklist (VER-08)

**Purpose:** Human sign-off that the v2.14 tranche-3 data (10 new ACFR GAAP states: IN, AZ, OR,
MO, CO, SC, KY, UT, AL, LA) and the deepened-history data (NJ back to FY2002, CT back to FY1988,
WI back to FY2000, MA back to FY2001, plus CT's FY2006 OCR recovery) render correctly to a
citizen in the live app. Data correctness was independently proven in Plan 116-01 (blind
re-derivation, 75/75 exact $0 ties, `116-REDERIVATION.md`) and the 50-node source-chain audit is
clean (Plan 116-02, 12/12 invariants, `116-COHORT-AUDIT.md`, including the LOAD-01 idempotency
proof). This UAT is the final check that what the DB says matches what the app shows.

**App URL:** https://treasurytracker.empowered.vote

**Entity slug pattern** (confirmed against `src/App.tsx`'s `toSlug()` — `${name}-${state}`
lowercased, spaces to hyphens — and cross-checked against the live `treasury.municipalities`
state rows before finalizing every deep-link below): e.g. `new-jersey-nj`, `south-carolina-sc`.
One deep-link (`?entity=indiana-in&year=2025&dataset=revenue`) was fetched live and returned
HTTP 200 before finalizing the rest; the app is a client-rendered SPA so a full render check of
each entity/year combination is Chris's job in Task 2, not something curl can validate.

**The 5 standard checks at every anchor** (unless the anchor says otherwise):
1. **Money In (revenue-by-source)** — the revenue view renders with by-source rows.
2. **Spending-by-function** — the operating view renders with function/department rows.
3. **Basis label** — the data-source label says State ACFR / **GAAP basis** (or the distinct
   **pre-GASB-34 combined statement basis** label where noted) — NOT NASBO (unless the anchor is
   the NASBO-control anchor).
4. **Source chip** — shows a real source URL + date; the link opens the state's ACFR/CAFR.
5. **Money In enabled** — the Money In card/toggle is available on the node.

Record **PASS / FAIL + notes** per anchor. Expected values below come from the independent
re-derivation (`116-REDERIVATION.md`), never from the loaders.

---

## Anchor 1 — IN FY2025 (tranche-3 units-sanity)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=indiana-in&year=2025&dataset=revenue
- Standard checks 1–5.
- **Magnitude check:** revenue total displays ≈ **$23.2B** ($23,203,835,000) — NOT $23T or $23M.
  Operating ≈ **$19.1B** ($19,123,203,000).
- Basis label = State ACFR / GAAP basis.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 2 — MO FY2022 (tranche-3 clamp year, largest in cohort)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=missouri-mo&year=2022&dataset=revenue
- **Clamp check:** a revenue category tied to "Fair Value of Investments" (or equivalently-named
  net-loss line) renders **at 0** with the net-loss magnitude shown in its label (the printed
  root already nets **-$309,337K**, the largest MO clamp in the cohort); the root revenue total
  still displays **≈ $30.0B** ($29,984,198,000) — i.e. the parent total is intact, only the leaf
  clamps to 0.
- Standard checks 1–5.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 3 — AZ FY2024 (Drive-link caveat, newest AZ year)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=arizona-az&year=2024&dataset=revenue
- Standard checks 1–5. Revenue ≈ **$44.0B** ($44,045,434,000); operating ≈ **$45.0B**
  ($45,047,271,000). Basis label = GAAP.
- **Source-chip caveat check:** the source chip/link for this year points at a Google Drive URL
  (not a durable gao.az.gov link) — confirm the link still opens and shows the AZ ACFR (a known,
  documented durability caveat, not a defect — do not fail the anchor solely for the Drive
  hosting, only if the link is dead or wrong).
- **Honest-absence check:** the year selector on the AZ node does **NOT** offer FY2025 (not yet
  sourced at load time) — confirm FY2024 is the newest selectable year.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 4 — KY honest-hole (FY2023)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=kentucky-ky&year=2025&dataset=revenue
- Standard checks 1–5 on FY2025 (revenue ≈ **$15.5B** / $15,541,675,000; operating ≈ **$14.5B** /
  $14,495,976,000) to confirm the node renders normally around the hole.
- **Honest-hole check (revenue):** switch `dataset=revenue` and open the year selector — **FY2023
  must be ABSENT** (no interpolated/fabricated figure); FY2022 and FY2024 must both be present
  and selectable.
- **Honest-hole check (operating, documented exception):** switch `dataset=operating` — FY2023
  **IS present** here (the loader intentionally kept the old NASBO row rather than fabricate a
  GAAP figure for a broken-font source PDF), but its basis label reads **NASBO**, not GAAP/ACFR —
  this is the one documented exception in an otherwise all-ACFR-labelled KY node. Confirm the
  label is visibly different (NASBO) from KY's other (ACFR/GAAP) years.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 5 — AL FY2025 (Sep-30 fiscal year-end)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=alabama-al&year=2025&dataset=revenue
- Standard checks 1–5. Revenue ≈ **$3.40B** ($3,399,417,000); operating ≈ **$2.60B**
  ($2,597,406,000). Basis label = GAAP.
- **Sep-30 check:** the source chip / source date reads **2025-09-30** (Alabama's Oct–Sep fiscal
  year), not June 30 or December 31.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 6 — CT FY1988 (deepening, pre-GASB-34 archive floor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=connecticut-ct&year=1988&dataset=revenue
- **Year-selector-reach check:** the CT year selector reaches back to **FY1988** (the archive
  floor — no older CT CAFR exists) and FY1988 is selectable and renders its own rows (not a
  blank/error state).
- Standard checks 1–5. Revenue ≈ **$5.03B** ($5,030,680,000); operating ≈ **$5.07B**
  ($5,066,954,000).
- **Distinct pre-34 label check:** the basis label reads **"pre-GASB-34 combined statement
  basis"** — visibly distinct from the "GAAP basis" label. To confirm the distinction, also open
  a modern CT year in the same session (e.g. `?entity=connecticut-ct&year=2025&dataset=revenue`)
  and compare the two basis labels side by side.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 7 — CT FY2006 (deepening, OCR-recovered hole fill)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=connecticut-ct&year=2006&dataset=revenue
- Standard checks 1–5. Revenue ≈ **$14.94B** ($14,941,201,000); operating ≈ **$13.92B**
  ($13,924,122,000).
- **Basis check:** this year was recovered from a scanned (no-text-layer) PDF page via
  independent re-render + OCR, but it is GASB-34-era — the basis label must read **GAAP basis**,
  NOT the pre-34 label (confirm it does not carry the pre-34 label used on Anchor 6).

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 8 — NJ FY2002 (deepening, full-dollars archive floor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=new-jersey-nj&year=2002&dataset=revenue
- **Year-selector-reach check:** the NJ year selector reaches back to **FY2002** (NJ's archive
  edge — NJ adopted GASB 34 in FY2002 itself, so there is no older/pre-34 NJ boundary to check).
- Standard checks 1–5.
- **Magnitude/units check:** revenue total displays ≈ **$21.9B** ($21,939,257,600) — NJ is stored
  in full dollars (not thousands); confirm the displayed figure is NOT ×1000 off (i.e. not
  showing ~$21.9T or ~$21.9M). Operating ≈ **$24.1B** ($24,075,099,379).

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 9 — MA FY2001 (deepening, pre-GASB-34) + MA hole honesty
**Deep-link:** https://treasurytracker.empowered.vote/?entity=massachusetts-ma&year=2001&dataset=revenue
- **Year-selector-reach check:** the MA year selector reaches back to **FY2001**.
- Standard checks 1–5. Revenue ≈ **$13.62B** ($13,623,688,000); operating ≈ **$11.21B**
  ($11,211,746,000).
- **Distinct pre-34 label check:** basis label reads **"pre-GASB-34 combined statement basis"**.
  Compare against a modern MA year in the same session (e.g.
  `?entity=massachusetts-ma&year=2025&dataset=revenue`, GAAP-labelled) to confirm the visual
  distinction.
- **Hole-honesty check:** open the MA year selector and confirm **FY2002, FY2004, FY2005, and
  FY2021 are ABSENT** (no interpolated/fabricated values for any of these 4 documented holes);
  FY2001, FY2003, FY2006–2020, FY2022–2025 (i.e., everything else) should be present.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 10 — WI FY2000 (deepening, pre-GASB-34 archive floor)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=wisconsin-wi&year=2000&dataset=revenue
- **Year-selector-reach check:** the WI year selector reaches back to **FY2000** (the pre-2000
  WI format is a 4-section multi-file era explicitly out of scope — FY2000 is the correct floor).
- Standard checks 1–5. Revenue ≈ **$15.50B** ($15,498,923,000); operating ≈ **$14.10B**
  ($14,103,791,000).
- **Distinct pre-34 label check:** basis label reads **"pre-GASB-34 combined statement basis"**.
  Compare against a modern WI year in the same session (e.g.
  `?entity=wisconsin-wi&year=2025&dataset=revenue`, GAAP-labelled) to confirm the distinction.

**Result:** [ ] PASS / [ ] FAIL — notes:

## Anchor 11 — NASBO control: Alaska (regression guard)
**Deep-link:** https://treasurytracker.empowered.vote/?entity=alaska-ak&year=2024
- AK STILL renders **operating-only** with **NASBO** provenance (label says NASBO State
  Expenditure Report, budgetary basis) — proof the tranche-3/deepening upgrade did not leak into
  the untouched 21-state NASBO cohort.
- **Money In card is DISABLED/absent** (AK has no revenue dataset).
- Manually visiting `...?entity=alaska-ak&year=2024&dataset=revenue` falls back gracefully (no
  crash, no empty-forever view).

**Result:** [ ] PASS / [ ] FAIL — notes:

---

## Sign-off

All 11 anchors PASS → sign and date below; any FAIL that is a data-correctness or source-chain
defect is fixed in-phase (source-safe never-overwrite path) and re-tested before sign-off;
cosmetic items are logged, not gated. Data correctness itself (the totals, the basis labels, the
window bounds) was already proven independently in Plans 116-01/116-02 — this UAT is checking
that the live app renders it honestly, not re-litigating the numbers.

**Signed off by:** _(pending — Chris Cantrell to complete after live-app walkthrough)_
**Date:** _(pending)_
