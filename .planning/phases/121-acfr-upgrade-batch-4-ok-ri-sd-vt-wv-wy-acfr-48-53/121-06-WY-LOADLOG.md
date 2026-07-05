# Wyoming (WY) ACFR-53 Load Log

**Phase:** 121 (ACFR Upgrade Batch 4) | **Plan:** 121-06 | **State node:** `4009951b-8a23-457e-9591-1597356dfe34`
**This is the FINAL state — completing WY puts all 50 states on ACFR.**

## Node Disambiguation Confirmation (T-121-06-A)

Three municipalities named "Wyoming" exist in the DB:

| Node | id | entity_type | Role |
|------|----|----|------|
| **Wyoming (state)** | `4009951b-8a23-457e-9591-1597356dfe34` | state | **TARGET — the only node written by this plan** |
| Wyoming, MN | `1604b5eb-283d-4f65-91a4-e9de651a4241` | city | Unrelated — NEVER touched |
| Wyoming, OH | `dacac0e3-13ca-46b1-bcad-50b1099032d0` | city | Unrelated — NEVER touched |

Both generated loaders (`processWYAcfr.js`, `processWYRevenueAcfr.js`) resolve the state node
by `name='Wyoming' AND state='WY' AND entity_type='state'`, then assert the resolved id equals
the hardcoded `EXPECTED_MUNI_ID` (`4009951b...`) before any write — a mismatch aborts with no
write. Both city nodes were queried before AND after the full load (see Task 2/Task 3
verification below) and confirmed **byte-for-byte identical** (same row counts, same
`data_source` labels, same totals) — never queried by the WY loader itself.

- Wyoming, MN (city): 24 budgets rows (12 FY x 2 datasets, Minnesota OSA source) — unchanged.
- Wyoming, OH (city): 20 budgets rows (10 FY x 2 datasets, Ohio AOS source) — unchanged.

## Source

State of Wyoming Auditor's Office (SAO) — Annual Comprehensive Financial Report (ACFR, formerly
CAFR). Landing page: `https://sao.wyo.gov/publications/`. Statement: *Statement of Revenues,
Expenditures, and Changes in Fund Balances — Governmental Funds*, **General Fund** column (1st
of 6: General Fund | Foundation Program Fund | Common School Land Fund | Permanent Mineral Trust
Fund | Pandemic Relief Fund [FY2021+] | Nonmajor Governmental Funds | Total).

## Load Disposition

**Window loaded: FY2005–FY2025 (21 years) — ZERO honest holes.** Every year downloaded cleanly
(`%PDF` magic + size >1.5MB, no soft-404s) and tied to $0 diff on BOTH the revenue and
expenditure printed GENERAL FUND totals on the **first extraction pass** (after the one-off
colon-less-header post-process documented below — a label-only fix, no value changes).

FY1980–FY2004 intentionally NOT attempted (out of scope per the 117 recon: FY2002 spot-check
found poor-quality OCR-scan text — "flna,nce", "STaMe", corrupted digits — FY2005 is the
clean-text floor).

| FY | Rev total ($) | Exp total ($) | Tie | Source URL |
|----|---------------|---------------|-----|------------|
| 2005 | 1,590,602,744 | 1,630,762,733 | $0/$0 | `.../2020/01/2005-CAFR.pdf` |
| 2006 | 1,682,881,108 | 1,754,918,335 | $0/$0 | `.../2020/01/2006-CAFR.pdf` |
| 2007 | 1,892,489,729 | 1,999,049,841 | $0/$0 | `.../2020/01/2007-CAFR.pdf` |
| 2008 | 1,835,210,503 | 2,264,989,654 | $0/$0 | `.../2020/01/2008-CAFR.pdf` |
| 2009 | 1,598,980,555 | 2,228,008,386 | $0/$0 | `.../2020/01/2009-CAFR.pdf` |
| 2010 | 1,856,786,453 | 2,230,948,005 | $0/$0 | `.../2020/01/2010-CAFR.pdf` |
| 2011 | 2,604,557,547 | 2,218,332,531 | $0/$0 | `.../2020/01/2011-CAFR.pdf` |
| 2012 | 2,573,780,154 | 2,253,477,647 | $0/$0 | `.../2020/01/2012-CAFR.pdf` |
| 2013 | 2,406,105,195 | 2,363,376,486 | $0/$0 | `.../2020/01/2013-CAFR.pdf` |
| 2014 | 2,750,388,194 | 2,305,091,475 | $0/$0 | `.../2020/01/2014-CAFR.pdf` |
| 2015 | 2,606,828,798 | 2,385,695,869 | $0/$0 | `.../2020/01/2015-CAFR.pdf` |
| 2016 | 2,156,616,633 | 2,488,603,134 | $0/$0 | `.../2020/01/2016-CAFR.pdf` |
| 2017 | 2,455,083,218 | 2,341,750,501 | $0/$0 | `.../2020/01/2017-CAFR.pdf` |
| 2018 | 2,596,456,614 | 2,343,828,093 | $0/$0 | `.../2019/10/2018-CAFR.pdf` |
| 2019 | 2,723,680,549 | 2,293,172,905 | $0/$0 | `.../2020/04/CAFR_2019.pdf` |
| 2020 | 2,443,495,399 | 2,324,993,843 | $0/$0 | `.../2021/03/FY-20-CAFR-2.26.21.pdf` |
| 2021 | 2,797,188,612 | 2,364,290,760 | $0/$0 | `.../2022/06/ACFR-FY2021-5.31.22.pdf` |
| 2022 | 3,349,849,253 | 2,670,977,767 | $0/$0 | `.../2023/02/ACFR-FY2022-1.31.23.pdf` |
| 2023 | 3,574,386,471 | 2,867,806,754 | $0/$0 | `.../2024/02/2023-ACFR-State-of-Wyoming.pdf` |
| 2024 | 3,649,083,441 | 2,944,593,681 | $0/$0 | `.../2025/01/2024-ACFR-State-of-Wyoming.pdf` |
| 2025 | **4,027,001,270** | 3,206,868,645 | $0/$0 | `.../2026/01/2025-ACFR-12.22.25.pdf` |

**Bookend confirmation:** FY2025 = $4,027,001,270, FY2005 = $1,590,602,744 — both exactly
match the plan's expected values, whole-dollar (UNITS=1, no ×1,000 skew).

**FY2020 URL discovery note:** the 117 recon's SOURCES map enumerated every naming era EXCEPT
FY2020 (jumped from FY2019's `CAFR_2019.pdf` directly to FY2021's `ACFR-FY2021-5.31.22.pdf`).
Fetched the live `sao.wyo.gov/publications/` landing page at load time (2026-07-05) and found
FY2020 at `https://sao.wyo.gov/wp-content/uploads/2021/03/FY-20-CAFR-2.26.21.pdf` — a genuine
gap in the recon's own enumeration, not a load-time failure; resolved live, HTTP 200, valid PDF,
tied exactly. No honest hole resulted.

## Units Verification (T-121-06-B)

UNITS=1 (dollars) hard-set in `gen_state.py CONFIGS['WY']`. Both bookends asserted at whole-dollar
scale with zero ×1,000 skew: FY2025 revenue = 4,027,001,270 (not 4,027,001), FY2005 revenue =
1,590,602,744 (not 1,590,603). Confirmed via `--dry-run --fy 2025` / `--fy 2005` grep checks
before any live write.

## Colon-less Subsection Header Fix (VT precedent, generalized)

WY's printed statement prints THREE subsection headers with NO trailing colon (confirmed on the
raw `pdftotext -table` output for all 21 loaded years):

1. **Revenues:** a single "Taxes" header ahead of "Sales and Use Taxes" — merges via
   `extract_gf.py`'s generic wrapped-label pending accumulator into
   `"Taxes Sales and Use Taxes"`.
2. **Expenditures (FY2015–FY2025 only — FY2005–FY2014 use colon-terminated `"Current:"` /
   `"Debt Service:"` headings and are unaffected):** "Current" merges into "General Government"
   → `"Current General Government"`; "Debt Service" merges into "Principal Retirement" →
   `"Debt Service Principal Retirement"`.

A dedicated `_acfr-work/wy_assemble.py` post-process pass strips the three known header-prefix
strings back off the merged labels (`"Sales and Use Taxes"`, `"General Government"`,
`"Principal Retirement"` with `sub='Debt Service'` set explicitly so `gen_state.py`'s
`default_exp_name()` disambiguation renames it to `"Debt service — Principal Retirement"`,
matching FY2005–FY2014's own formatting) and propagates `sub='Debt Service'` onto the following
`"Interest"` line for FY2015–FY2025 (consistency with FY2005–FY2014, which already carry
`sub='Debt Service'` on both lines via their colon-terminated heading). **Values untouched
throughout** — every year's revenue and expenditure sum-vs-total tie was re-verified identical
before and after the label fix.

## Per-Year P2 Clamp Monitoring (T-121-06-C, checked at EVERY year, not just bookends)

Full-cohort negative-value scan across all 21 loaded years, both revenue and expenditure
sections:

| FY | Negative line | Value ($) | Note |
|----|---------------|-----------|------|
| 2006 | Net Increase/(Decrease) in the Fair Market Value of Investments | -39,894,527 | mark-to-market loss |
| 2008 | Net Increase/(Decrease) in the Fair Market Value of Investments | -17,477,960 | mark-to-market loss |
| 2009 | Net Increase/(Decrease) in the Fair Market Value of Investments | -23,909,726 | mark-to-market loss |
| 2013 | Net Increase/(Decrease) in the Fair Market Value of Investments | -165,133,848 | mark-to-market loss (largest) |
| 2015 | Net Increase/(Decrease) in the Fair Market Value of Investments | -62,965,920 | mark-to-market loss |
| 2017 | Net Increase/(Decrease) in the Fair Value of Investments | -21,735,124 | mark-to-market loss |
| 2018 | Net Increase/(Decrease) in the Fair Value of Investments | -21,806,236 | mark-to-market loss |
| 2019 | Sale of Assets | -188,575 | immaterial, book-value-exceeds-proceeds |
| 2021 | Sale of Assets | -37,314 | immaterial |
| 2022 | Sale of Assets | -76,530 | immaterial |

All 10 negative-line years are real GAAP facts (mark-to-market investment losses / minor asset
disposal shortfalls), not extraction artifacts. **Both bookend years (FY2025, FY2005) are
positive on every line** — the recon's caution about a plausible-negative interior year is
confirmed exercised: 7 years hit the Fair-Market-Value-of-Investments clamp, 3 hit the
Sale-of-Assets clamp. `clampForRender()` renders each negative slice at 0 with the signed
magnitude preserved in the category label (confirmed via `--dry-run --fy 2013` / `--fy 2022`
spot-checks: `[Note: ... true value: -165,133,848 (clamped at render)]`). No year shows a
negative GF Total.

## NASBO Replacement Confirmation (T-121-06-F)

**Pre-load** (WY state node): 2 NASBO operating rows only — FY2023 $1,525,000,000, FY2024
$1,654,000,000, source label `"NASBO State Expenditure Report — General Fund (FY{fy} actual,
budgetary basis)"`. 0 revenue rows. 0 data_sources rows.

**Post-load:** FY2023 operating = $2,867,806,754 (ACFR, source `"Wyoming State ACFR — General
Fund (FY2023 actual, GAAP basis)"`), FY2024 operating = $2,944,593,681 (ACFR). **Exactly ONE
operating row per (4009951b, fy)** for all 21 loaded years — the RPC's `(muni, fy,
'operating')` key replaced the two NASBO years in place (UPDATE, not duplicate insert). Zero
NASBO-labelled rows remain on the state node (confirmed via DB grep for `%NASBO%` in
`data_source` — 0 matches on WY's node; the only 2 remaining NASBO rows DB-wide are pre-existing
documented exceptions on Kentucky FY2023 and Nevada FY2024, unrelated to this plan, unchanged).

## Scope vs NASBO — ~2.43x Investment-Income-Driven Divergence (T-121-06-H)

WY ACFR GF revenue (FY2025 $4,027,001,270) vs NASBO GF operating (FY2024 $1,654,000,000) ≈
2.43x. **Driver is UNUSUAL among the whole v2.15 cohort** (distinct from the typical
federal-passthrough or tax-consolidation mechanism seen in OK/WV/RI/MS/AR/LA): TWO large lines
consolidate into the GENERAL FUND column simultaneously —

1. **Federal** (FY2025 $1,108,650,901, ~28% of GF revenue) — routine federal-passthrough.
2. **Investment Income** (FY2025 $1,414,203,323, ~35% of GF revenue) — the SINGLE LARGEST GF
   revenue line, driven by Permanent Mineral Trust Fund earnings routed partly through the
   General Fund. This is a genuinely unusual driver: no other Batch-4 (or prior-batch) state has
   investment income exceed its own federal-passthrough line as the dominant scope-divergence
   driver.

Accepted-and-relabelled honestly (TX precedent for wide-divergence acceptance), with this
prominent basis note recorded in the loader's `head_note` and here.

## Idempotency + 0-Residue Verification (Task 3)

Re-ran BOTH loaders live for FY2025 (`--fy 2025`, no `--dry-run`) after the full 21-year load
completed. Queried `treasury.budgets` for the WY state node before and after the re-run:
**byte-for-byte identical JSON** (all 42 rows, same totals, same fiscal years/dataset types) —
0 net change. Queried `treasury.data_sources` for any row with `dataset_id ILIKE 'wy-%'`: **0
rows** both before and after — 0 residue (LOAD-01 holds).

## Cohort-Untouched Verification (Task 3)

- **Vermont (existing ACFR node, loaded in 121-04):** 22 budgets rows (11 FY x 2 datasets)
  unchanged, bookends match the VT loadlog exactly (FY2015 rev $1,392,033,404 / FY2025 rev
  $2,543,030,123).
- **Wyoming, MN (city node):** 24 budgets rows, Minnesota OSA source — unchanged.
- **Wyoming, OH (city node):** 20 budgets rows, Ohio AOS source — unchanged.
- **DB-wide NASBO residue:** exactly 2 rows remain (Kentucky FY2023, Nevada FY2024) — both
  pre-existing documented exceptions from prior phases (Phase 116-02 KY exception; unrelated to
  WY), NOT new residue introduced by this plan.

## Money In Auto-Enable Confirmation

WY state node now carries 21 revenue rows (`dataset_type='revenue'`, FY2005–FY2025) — Money In
and `?dataset=revenue` auto-enable data-driven with zero frontend changes required, per the
established pattern from every prior ACFR-upgraded state.

## MILESTONE: ALL 50 STATES NOW ON ACFR

Wyoming (ACFR-53) was the final state in the v2.15 "State ACFR Long Tail — Final Tail + NASBO
Retirement" milestone's Batch 4 load (Phase 121, ACFR-48..53: OK/RI/SD/VT/WV/WY). With WY's
FY2005–FY2025 window live, GAAP-labelled, tie-verified, and NASBO-replaced-in-place, **all 50
US states now carry a State-ACFR-sourced General Fund** (revenue-by-source AND
spending-by-function), completing the milestone's core deliverable ahead of Phase 123 (NASBO
Retirement — demote/guard `loadStateGF.mjs`, document the 50/50 end state) and Phase 124
(Verification + Cohort Audit + UAT). The only 2 remaining NASBO-labelled rows DB-wide (Kentucky
FY2023, Nevada FY2024) are documented single-year exceptions on already-ACFR-upgraded states,
not un-upgraded states — zero states remain wholly NASBO-served.
