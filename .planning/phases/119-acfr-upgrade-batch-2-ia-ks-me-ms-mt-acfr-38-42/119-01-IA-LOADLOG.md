# 119-01 IA — Iowa ACFR Load Log (ACFR-38)

**Status:** COMPLETE — IA live on full State-ACFR GAAP, FY2002–FY2025 minus one honest hole
(FY2008), 23 of the target 24 years, $0 spend.
**Node:** Iowa `6e71a93f-a43d-4972-a239-85ddbebe2545` · **Units:** thousands (UNITS=1000) ·
**FY-end:** June 30.

## Load Disposition

- **Window loaded:** FY2002–FY2007 + FY2009–FY2025 (23 contiguous-minus-one years), operating +
  revenue = **46 rows**, every FY tie-verified at $0 diff on BOTH the expenditure total and the
  NET REVENUES total.
- **Bookends (NET REVENUES tie, per recon):** FY2025 **$24,251,676,000** ✅; FY2002
  **$9,752,220,000** ✅ (both exact — confirmed live in `treasury.budgets`, not just dry-run).
- **NET-REVENUES-not-GROSS handling:** Iowa's Governmental Funds statement prints GROSS REVENUES
  (sum of Taxes, Receipts from other entities, Investment income, Fees/licenses/permits,
  Refunds & reimbursements, Sales/rents/services, Miscellaneous[, Contributions]), then a
  "Less revenue refunds" contra line, then NET REVENUES — there is no literal "Total revenues"
  line for the standard extract_gf.py anchor to key on. A dedicated post-processor
  (`_acfr-work/ia_extract.py`) pops the GROSS REVENUES / Less revenue refunds / NET REVENUES
  triple back out of extract_gf.py's generic item list and stores "Revenue refunds" as a
  NEGATIVE category (same P2-clamp render mechanism as CO's TABOR Excess Revenue line) so the
  stored revenue tree total resolves to NET REVENUES, not GROSS, at every loaded year.
- **Honest hole (FY2008):** the FY2008 ACFR (184 pages, RC4-encrypted print:yes/copy:no) is
  genuinely text-bearing — `pdftoppm` renders real vector financial-statement text on the
  budgetary-comparison page — but `pdftotext` (-table and plain) and `pypdf`'s decrypt+
  extract_text() both return zero characters for every page past the front matter, and
  `pdffonts` finds no font resources at all in that range. No OCR/qpdf/mutool/ghostscript
  tooling was available in this environment as a fallback (KY FY2023 no-ToUnicode-CMap
  precedent — a genuine, documented extraction failure, not a scanned-image case). NOT loaded.
  FY2007 and FY2009 bracket the gap; FY1997–FY2001 remain out of this pass's scope per the
  Phase-117 recon (pre-GASB-34 boundary not verified).
- **NASBO replaced in place:** FY2023 NASBO $8,216,000,000 → ACFR operating $21,215,674,000;
  FY2024 NASBO $8,560,000,000 → ACFR operating $22,795,198,000. Confirmed via row `id`
  continuity (same UUIDs before/after the load — UPDATE, not insert+delete). 0 NASBO labels
  remain anywhere on the IA node; exactly one operating row per (IA, fy).
- **Scope (ACFR-38):** ~**2.83×** NASBO (FY2025 ACFR NET REVENUES $24,251,676K vs FY2024 NASBO
  operating $8,560,000K) — "Receipts from other entities" ($10,668,647K FY2025, mostly federal/
  intergovernmental) is consolidated into the GAAP General Fund column; NASBO's narrower
  budgetary GF concept excludes most of it. Accept-and-relabel honest (TX/AR precedent); GAAP
  basis label on every live row.
- **Dual expenditure-subsection (FY2004):** repeats the same function-name lineup under
  "Current:" and "Capital Outlay:" — real GAAP distinction, not a duplicate. Resolved via a
  generalized `gen_state.py` `default_exp_name()` rule (LA precedent) appending
  " — Capital Outlay" to the second occurrence; zero collisions in the generated tree.
- **FY2003 wrap defect (hand-patched):** `pdftotext -table` split the "Agriculture & Natural
  Resources" (Current) row so its GENERAL FUND value (139,493) landed alone on the PRECEDING
  physical line with no label; the label line itself only carried later columns (6,318 /
  149,625). `ia_extract.py` filters the resulting phantom numeric-only "label" generically; the
  true GF value was hand-patched directly into `ia_all.json` with the printed-row evidence.
  Confirmed the corrected Current-subsection sum ties FY2003's printed TOTAL EXPENDITURES
  $10,004,502K exactly ($0 diff).
- **P2 clamp exercised:** FY2022 "Investment income (loss)" = **-$65,193K** (real GAAP
  fair-value loss, not an extraction artifact) — rendered at 0 with the signed value in the
  label; the "Revenue refunds" contra line is clamped at 0 in every year by the same mechanism.
  No year shows a negative NET REVENUES total.
- **Idempotency:** re-ran IA `--fy 2025` live a second time (both operating and revenue) →
  `Loaded 0 rows` for both; DB confirms exactly 2 rows for (IA, FY2025) afterward (same row
  `id`s, same totals as the first load) — 0 net change.
- **0 `data_sources` residue (LOAD-01):** confirmed via `mcp__supabase-local` — `SELECT * FROM
  treasury.data_sources WHERE dataset_id ILIKE 'ia-%'` returns 0 rows after the run.
- **Money In auto-enabled:** IA has 23 `dataset_type='revenue'` rows (data-driven, no frontend
  change needed).
- **Cohort untouched (spot-check):** California (`e1007bf5-bac9-4b1c-878e-f6834885f850`, 36
  rows, `California State ACFR — General Fund[...]` labels) and Alaska (Batch 1 sibling,
  `b268c415-0058-4fea-8ba1-24f49fb434b4`, 40 rows, `Alaska State ACFR — General Fund[...]`
  labels) unchanged; Wyoming (un-upgraded, `4009951b-8a23-457e-9591-1597356dfe34`) still carries
  exactly its 2 pre-existing `NASBO State Expenditure Report` rows, untouched.

### Tooling generalizations added this load (reusable, in gitignored `_acfr-work/`)

- New `ia_extract.py` — IA-specific post-processor over `extract_gf.py`'s line-parser, handling
  the GROSS REVENUES → Less revenue refunds → NET REVENUES triple (no literal "Total revenues"
  line) and filtering the numbers-line-before-label wrap defect discovered in FY2003.
- `gen_state.py` `default_exp_name()` generalized with a "Capital Outlay" dual-subsection
  disambiguation rule (LA's "Intergovernmental" precedent) — reusable for any future state that
  repeats its function-name lineup under both Current: and Capital Outlay: subsections.

## Per-FY totals loaded (raw dollars)

| Fiscal Year | GF Revenue (NET REVENUES) | GF Spending (operating) |
|-------------|---------------------------|--------------------------|
| FY2002 | $9,752,220,000 | $9,968,538,000 |
| FY2003 | $9,739,805,000 | $10,004,502,000 |
| FY2004 | $9,819,365,000 | $9,825,703,000 |
| FY2005 | $10,185,629,000 | $9,741,692,000 |
| FY2006 | $10,938,743,000 | $10,367,339,000 |
| FY2007 | $10,872,388,000 | $10,463,448,000 |
| FY2008 | — (honest hole, not loaded) | — (honest hole, not loaded) |
| FY2009 | $13,019,055,000 | $12,847,469,000 |
| FY2010 | $13,723,441,000 | $13,302,322,000 |
| FY2011 | $14,390,230,000 | $13,866,211,000 |
| FY2012 | $14,440,976,000 | $13,903,599,000 |
| FY2013 | $14,773,573,000 | $13,854,019,000 |
| FY2014 | $14,996,066,000 | $14,686,043,000 |
| FY2015 | $15,851,942,000 | $15,807,540,000 |
| FY2016 | $16,400,906,000 | $16,194,808,000 |
| FY2017 | $16,636,399,000 | $16,311,631,000 |
| FY2018 | $16,944,158,000 | $16,536,924,000 |
| FY2019 | $17,855,287,000 | $17,111,166,000 |
| FY2020 | $19,230,313,000 | $17,998,468,000 |
| FY2021 | $21,711,615,000 | $19,992,644,000 |
| FY2022 | $23,855,338,000 | $21,459,336,000 |
| FY2023 | $23,366,953,000 | $21,215,674,000 (was NASBO $8,216,000,000) |
| FY2024 | $24,463,693,000 | $22,795,198,000 (was NASBO $8,560,000,000) |
| FY2025 | $24,251,676,000 | $23,947,143,000 |

Loaders: `scripts/processIAAcfr.js` + `scripts/processIARevenueAcfr.js` (gen_state.py
`CONFIGS['IA']`, node 6e71a93f, no `rev_boundary` needed — IA's revenue lines carry no
subsection headers).
