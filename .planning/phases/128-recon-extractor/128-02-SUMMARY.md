---
phase: 128
plan: "128-02"
title: "Build extractTucson.py: GF revenue + 2-level expenditure trees, $0 tie per windowed FY"
status: complete
requirements: [TUC-02]
completed: 2026-07-10
commit: 74ddd19
---

# Plan 128-02 Summary — `extractTucson.py`

**Outcome:** TUC-02 satisfied. Built `scripts/extractTucson.py`; all 10 windowed years × 2 modes dry-run **tie $0**, and a mis-tie fails loud (non-zero exit).

## What was built
`scripts/extractTucson.py` — positional `pdf_path`, `--mode operating|revenue`, JSON to stdout (mirrors the `extractGresham.py` CLI contract; stdlib-only, no pdfplumber).
- Extraction via `pdftotext -table` subprocess (**args array, `shell=False`**; `-layout` never used).
- **Positional GF-column isolation:** anchors the fund columns' right-edges from the fully-populated `Total revenues`/`Total expenditures` rows; assigns each row's numbers to the nearest column; GF = column 0. Blank GF cells (e.g. `Developer fees`) correctly resolve to 0 rather than borrowing the Non-Major column.
- `--mode revenue` → flat GF revenue-by-source tree.
- `--mode operating` → 2-level tree: `Current → {functions}`, `Capital outlay`, `Capital projects`, `Debt service → {components}`. Parents are label-only headers whose value = Σ children (Tucson prints no intermediate sub-totals).
- **Label-driven:** reads each year's printed vocabulary, so it handles cross-era variance (`Current:` vs `Current -`; case; `General government` vs `Non-Departmental`; FY2015 `Debt Issuance Costs`; FY2020 no `Fiscal agent fees`) and the wrapped `Community enrichment and`/`development` label.
- **Fail-loud tie gate:** emits `{fiscal_year, mode, tree, computed_total, printed_total, tie_delta}`; `tie_delta != 0` dumps offending leaves to stderr and **exits 1**.

## Verification performed
- **Full-window sweep:** FY2015–FY2024 × {revenue, operating} — 20/20 `tie_delta == 0`.
- **FY2024 tree** matches the TUC-02 spec exactly (Current→5 functions, Capital outlay, Capital projects, Debt service→3); computed rev $773,493,270 / exp $648,657,363.
- **Fault injection:** blanking the GF `Taxes` value → `tie_delta -405,003,757`, TIE FAILURE to stderr, **exit code 1** (fail-loud confirmed).
- **Cross-check:** `revenue − operating == printed Excess` (FY2024: $124,835,907 ✓); holds by construction since both modes tie their printed totals.
- Dry-run table appended to `128-RECON.md`.

## Deliverables
`scripts/extractTucson.py`; dry-run results section in `128-RECON.md` (committed `74ddd19`).

## Boundaries honored
Extractor only reads local PDFs and prints JSON — no seed, no live load, no schema touch (Phase 129).
