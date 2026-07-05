# 122-02 — Florida DEEP-05 Load Log

**Executed:** 2026-07-05 (inline, no subagents). **Node:** Florida STATE `adb19ea0-de7c-4cd5-9445-cbf2108a8a1a` (upgraded in place). **$0 AI spend** — `curl` + `pdftotext -table` + `extract_gf.py`. **UNITS=1000** (data objects raw thousands ×1,000 → dollars).

## Load Disposition — FY2003–FY2020 (18 clean years, all loaded)

| FY | Filename (variant) | Rev tie | Exp tie | Op total (raw K) | Rev total (raw K) |
|----|--------------------|---------|---------|------------------|-------------------|
| 2003 | `cafr2003.pdf` | **$0 ✅** | $0 ✅ | 21,723,170 | **19,857,818** |
| 2004 | `cafr2004.pdf` | $0 ✅ | $0 ✅ | 23,059,543 | 21,829,932 |
| 2005 | `cafr2005.pdf` | $0 ✅ | $0 ✅ | 25,075,833 | 25,171,792 |
| 2006 | `cafr2006.pdf` | $0 ✅ | $0 ✅ | 26,984,180 | 32,233,584 |
| 2007 | `cafr2007.pdf` | $0 ✅ | $0 ✅ | 29,420,281 | 31,546,749 |
| 2008 | `cafr2008.pdf` | $0 ✅ | $0 ✅ | 29,208,561 | 28,595,132 |
| 2009 | `cafr2009.pdf` | $0 ✅ | $0 ✅ | 25,236,426 | 24,105,954 |
| 2010 | `cafr2010.pdf` | $0 ✅ | $0 ✅ | 23,143,096 | 25,978,531 |
| 2011 | `cafr2011.pdf` | $0 ✅ | $0 ✅ | 25,320,228 | 27,288,574 |
| 2012 | `cafr2012.pdf` | $0 ✅ | $0 ✅ | 24,781,947 | 28,554,204 |
| 2013 | `2013cafr.pdf` *(flip)* | $0 ✅ | $0 ✅ | 26,731,972 | 30,304,288 |
| 2014 | `2014cafr.pdf` | $0 ✅ | $0 ✅ | 28,873,415 | 31,577,252 |
| 2015 | `2015cafr.pdf` | $0 ✅ | $0 ✅ | 30,388,938 | 33,317,827 |
| 2016 | `2016cafr.pdf` | $0 ✅ | $0 ✅ | 32,082,585 | 34,525,423 |
| 2017 | `2017cafr.pdf` | $0 ✅ | $0 ✅ | 33,466,690 | 36,178,507 |
| 2018 | `cafr2018.pdf` *(flip back)* | $0 ✅ | $0 ✅ | 34,599,033 | 37,715,324 |
| 2019 | `cafr2019.pdf` | $0 ✅ | $0 ✅ | 35,825,555 | 40,405,714 |
| 2020 | `2020cafr.pdf` | $0 ✅ | $0 ✅ | 36,963,807 | **40,534,343** |

**Filename variants confirmed:** convention alternates `cafr{YYYY}.pdf` (FY2003–2012, FY2018–2019) ↔ `{YYYY}cafr.pdf` (FY2013–2017, FY2020) with **no single rule** — each filename curl-confirmed `application/pdf` before parsing (the recon's empirical map held exactly). All 18 downloaded as genuine PDFs (`%PDF`, 2–16 MB).

**Bookends (recon-confirmed, re-verified live):** FY2003 Total revenues **$19,857,818K**, FY2020 **$40,534,343K** — both tie at exact $0 (extract_gf `rev_tie`/`exp_tie` True on all 18). Stored **×1,000 → dollars** (FY2003 rev = $19,857,818,000; FY2020 = $40,534,343,000).

**Window:** FL extended from FY2021–FY2024 → **FY2003–FY2024 (22 contiguous years)** on both operating + revenue. No interior holes FY2003–FY2020.

## Honest hole — FY2000–FY2002 (repair-pending, NOT loaded)
- `cafr2000.pdf` (23.9MB), `cafr2001.pdf` (22.8MB), `cafr2002.pdf` — durable URLs exist and return genuine `application/pdf`, but `pdftotext -table` yields only ~216 bytes (**damaged xref**, confirmed on FY2000; recon flagged the same on FY2000/FY2002).
- **`qpdf` is not installed** in this environment, and adding a new package crosses the milestone's no-new-packages line. A single cheap repair pass was not available → **logged as repair-pending, not faked.** Pre-GASB-34 layout status for these 3 years remains unconfirmed pending a future repair pass.
- This is a durability-satisfied / extractability-blocked hole (D-06 concerns durability, not extractability) — the URLs are durable; only the PDF internals are corrupted.

## Basis / P2 clamp
- Entire FY2003–FY2020 block is post-GASB-34 (same "Governmental Funds" statement as FY2021+). No `pre34Extract.mjs`.
- **P2 clamp fired (2 years):** FY2004 "Investment earnings" −$78,773K and FY2009 "Investment earnings" −$374,931K (market-loss years). Both stored via `clampForRender` → leaf renders at **0** with the net-loss preserved in the label (e.g. FY2009 leaf `"Investment earnings (net loss — shown at 0)"`, amount 0); the FY root total nets the negative (FY2009 root = $24,105,954,000). Every added year checked, not just bookends. Matches the FY2021/FY2022 negative precedent.
- Category names transcribed verbatim; genuine ACFR wording drift kept as-printed: expenditures `State courts` (≤FY2017) → `Judicial branch` (FY2018+); revenue `Other revenue` (≤FY2008) → `Other` (FY2009+), `Investment earnings` (≤FY2012) → `Investment earnings (losses)` (FY2013+). Footnote refs `(Note N)` stripped from labels (not category names).

## Idempotency + residue (LOAD-01)
- **Idempotency:** re-ran FL `--fy 2003` (op + rev) live → **0 net change** (op 21,723,170,000 / 10 nodes; rev 19,857,818,000 / 8 nodes — identical, no duplicate leaves).
- **data_sources residue:** both FL loaders use the **ephemeral** lifecycle (delete → insert → RPC → delete-at-end) → **0 `fl-%` data_sources rows** remain. 0 residue, cohort-wide.

## Pre-existing window untouched
- FY2021 op = 37,277,963,000, FY2024 op = 50,141,014,000, FY2021 rev = 46,989,188,000, FY2024 rev = 59,810,603,000 — all **byte-identical** to the pre-load baseline (loaded per-`--fy`, FY2021–2024 never re-written).

## Money In
- FL retains revenue rows (now FY2003–FY2024) → Money In stays enabled.

## Deviation (D-02, resolved)
- ROADMAP "FL pre-FY2022" text was stale v2.11 language; Phase 104 already added FY2021. Recon corrected the premise; this load digs below FY2021 to FY2003. Recorded per Rule-1.

**Local PDFs** in gitignored `_acfr-tmp/fl/` (not committed).
