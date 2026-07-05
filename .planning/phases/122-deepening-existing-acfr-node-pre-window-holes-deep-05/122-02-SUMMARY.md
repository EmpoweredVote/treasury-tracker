---
phase: 122-deepening-existing-acfr-node-pre-window-holes-deep-05
plan: "122-02"
status: complete
completed: 2026-07-05
requirements: [DEEP-05]
---

# 122-02 Summary — Florida DEEP-05 Deepening (FY2003–FY2020)

## What shipped
Extended both Florida State-ACFR pilot loaders to add **18 clean years (FY2003–FY2020)** to the existing FL state node `adb19ea0-de7c-4cd5-9445-cbf2108a8a1a`, taking its window from FY2021–FY2024 to **FY2003–FY2024 (22 contiguous years)**:
- `scripts/processFLAcfr.js` — GF spending-by-function (operating): explicit per-year `SOURCES` map + 18 `EXPENDITURES` entries, `years` + `fiscal_years` extended.
- `scripts/processFLRevenueAcfr.js` — GF revenue-by-source (revenue): same, 18 `REVENUE` entries.

Downloaded from `myfloridacfo.com/…/cafr/` using the recon's per-year filename map (alternates `cafr{YYYY}.pdf` ↔ `{YYYY}cafr.pdf`, no single rule), extracted via `pdftotext -table` + `extract_gf.py`, transcribed as raw thousands (UNITS=1000).

## Verification (all pass)
- **Ties:** all 18 years tie exact **$0** on both revenues and expenditures. Bookends live-verified: FY2003 rev **$19,857,818,000**, FY2020 rev **$40,534,343,000** (×1000).
- **Leaves persisted** in `treasury.budget_categories` (7 revenue + root; 9–10 operating + root per year).
- **P2 clamp fired** for FY2004 (−$78,773K) + FY2009 (−$374,931K) "Investment earnings" → leaf shown at 0, root nets (FY2009 root $24,105,954,000). Matches FY2021/FY2022 precedent.
- **Idempotent:** FL `--fy 2003` re-run → 0 net change (no duplicate leaves).
- **0 residue (LOAD-01):** both loaders ephemeral → 0 `fl-%` data_sources rows.
- **Pre-existing window untouched:** FY2021 + FY2024 op/rev totals byte-identical to pre-load (loaded per-`--fy`).
- **Money In:** stays enabled.

## Honest hole
- **FY2000–FY2002** = repair-pending (durable `application/pdf` URLs exist but damaged xref; `pdftotext` yields ~216 bytes; **qpdf not installed** → not repaired, not faked). Documented in `122-02-FL-LOADLOG.md`.

## Notes / deviations
- Verbatim ACFR wording drift kept as-printed (`State courts`→`Judicial branch` FY2018+; `Other revenue`→`Other` FY2009+; `Investment earnings`→`Investment earnings (losses)` FY2013+). `(Note N)` footnote refs stripped from labels.
- **D-02 (resolved):** ROADMAP "FL pre-FY2022" text was stale; recon corrected (FL was already FY2021+). This dig went to FY2003.
- Ran inline (no subagents).

## Hand-off
- Phase 122 remaining: **122-03** (NY/TX honest-floor doc + DEEP-05 closeout).
- Phase 124 (VER-09/VER-10): blind re-derivation of the 18 new FL state-FYs + Chris UAT.

Full detail: `122-02-FL-LOADLOG.md`.
