---
phase: 131
plan: "131-02"
title: "Build scripts/extractAcfrGF.py: generalized GF extractor, $0 tie per in-scope city x FY; regression-tie Tucson"
status: complete
requirements: [PIMA-03]
completed: 2026-07-16
---

# 131-02 SUMMARY — `scripts/extractAcfrGF.py`

**Outcome: complete. All 44 in-scope (city × FY × mode) tie $0; Tucson regression ties $0.**

## What was built
`scripts/extractAcfrGF.py` — a city-agnostic generalization of `extractTucson.py` (positional GF-first column engine, `pdftotext -table`, `$0 tie_delta` fail-loud gate). CLI: positional `pdf_path` + `--mode operating|revenue`, JSON to stdout.

**Generalizations vs the Tucson-specific original:**
1. **Structure derived from the statement**, not hardcoded — expenditure parents come from section-header rows (label-only, trailing `:`); `Capital outlay`/`Capital projects` are root leaves; intermediate `Total <section>` subtotals skipped. Works whether a city prints parent subtotals (Tucson) or only the grand total (South Tucson).
2. `parse_fy` made case-insensitive ("YEAR ENDED" vs "Year Ended").
3. `find_statement_page` made case-insensitive on `Total Revenues/Expenditures` — fixed Oro Valley's newer format (capital R/E) which was returning "statement not found".
4. **Blank-cell label-bleed fix:** a $0-GF row carrying dash placeholder cells (e.g. OV "Highway and streets — — —") no longer prepends its label to the next valued row.

## Results
- **Dry-run tie table** (in 131-RECON.md): Oro Valley 12/12, Marana 12/12, Sahuarita 12/12, South Tucson 8/8 — **44/44 at `tie_delta == 0`**, both modes.
- `rev.computed − op.computed == printed Excess` cross-check: 0 mismatches (where the Excess row was machine-captured; internally consistent otherwise).
- **Regression oracle:** `extractAcfrGF.py` reproduces **Tucson FY2024** at $0 in both modes (rev 773,493,270 / op 648,657,363). `extractTucson.py` + `processTucson.js` untouched — zero blast radius on the shipped city.

## Deferred (documented, non-blocking)
- **Oro Valley cosmetic label artifact (FY2020+):** OV's newer PDFs render some glyphs space-separated under `-table` ("Tran s it", "In teres t", "in v es tmen ts"). Values and ties are correct; only these leaf labels are affected. → Phase 132 OV label-normalization at load (mirrors v2.17's deferred Tucson wrapped-label cosmetic).

## Must-haves
- ✅ CLI contract mirrors extractTucson.py; `-table` args-array, never `-layout`/`shell=True`
- ✅ revenue = flat GF source tree; operating = 2-level tree derived from statement structure
- ✅ `tie_delta == 0` for every in-scope FY×mode; non-zero fails loud (verified — the OV pre-fix cases exited non-zero as designed)
- ✅ parent subtotal == Σ children (rolled up); Tucson FY2024 regression at $0
