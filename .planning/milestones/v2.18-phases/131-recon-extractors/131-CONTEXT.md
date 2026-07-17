---
phase: 131
title: "Recon + Extractors — Pima County municipalities (Oro Valley, Marana, Sahuarita, South Tucson)"
requirements: [PIMA-01, PIMA-02, PIMA-03]
---

# Phase 131 Context — Recon + Extractors

## Goal (from ROADMAP)

Locate and validate each municipality's ACFR source end-to-end **before any load** — enumerate published years, pin durable per-year PDF URLs, prove clean `pdftotext -table` extraction of the **General Fund** column (bookend-tie $0), resolve South Tucson's source with an explicit verdict, and build the extractor. Pure source validation + one new/generalized script — **no seed, no load, no schema touch** (that is Phase 132).

## Locked decisions (carried from v2.18 REQUIREMENTS + the Tucson precedent)

- **Basis = General Fund**, first data column of the governmental-funds *Statement of Revenues, Expenditures and Changes in Fund Balances*. `pdftotext -table` only; `-layout` is banned (scrambles the multi-fund columns).
- **Correctness oracle = $0 bookend tie.** Σ printed GF revenue rows == printed *Total revenues*; Σ printed GF expenditure rows == printed *Total expenditures*; both exactly $0. A non-tying year is an honest documented hole, never a silent drop. Second independent tie: parent sub-totals == Σ their children.
- **History depth = deepest CONTIGUOUS tying window per city** (each city locks its own window; they need not match).
- **Four target municipalities:** Oro Valley (town), Marana (town), Sahuarita (town), South Tucson (city). All link under the **existing Pima County node** in Phase 132 — no new county node.

## The reusable engine

`scripts/extractTucson.py` already does the hard part city-agnostically: positional GF-column isolation anchored on the fully-populated `Total revenues`/`Total expenditures` rows, verbatim per-year labels (no hardcoded vocabulary), `$0` `tie_delta` as a fail-loud hard gate, wrapped-label buffering, `$`/blank/paren handling. Phase 131's extractor work is **generalize that engine**, not write four from scratch.

**Decision — extractor shape:** build a city-agnostic sibling `scripts/extractAcfrGF.py` (positional `pdf_path` + `--mode operating|revenue`, JSON to stdout) rather than mutate `extractTucson.py`. Rationale: the shipped, verified Tucson loader (`processTucson.js`) depends on `extractTucson.py` — leaving it untouched keeps blast radius zero. The generalized extractor must **derive the 2-level tree from the statement's own sub-total rows** (`Total Current`, `Total Debt service`, etc.) instead of a hardcoded child list, so it adapts to each small town's own (likely simpler) function set. Regression guard: the generalized extractor must still tie **Tucson FY2024** at $0 in both modes.

## Open questions this phase RESOLVES (not assumes)

1. **Does each town publish a full ACFR with an extractable GF governmental-funds statement?** Oro Valley / Marana / Sahuarita are mid-size towns (~35k–55k) — very likely yes. Verify per year; do not assume a filename pattern holds across years.
2. **South Tucson (PIMA-02, the real unknown, ~5,600 pop):** does it publish a full City ACFR, or only an AZ Auditor General AFR/AELR (which v2.17 ruled NOT icicle-grade)? Produce an explicit written verdict: (a) load-from-ACFR like the others, (b) documented source exception, or (c) defer South Tucson to a future requirement. **No silent scope reduction.**

## Candidate source domains (STARTING POINTS — recon must verify, host-allow-list per city)

- Oro Valley → `orovalleyaz.gov`
- Marana → `maranaaz.gov`
- Sahuarita → `sahuaritaaz.gov`
- South Tucson → the city's own site if any, else AZ Auditor General `azauditor.gov`

## Constraints (standing)

Free public PDFs only ($0 / $5 AI gate). PDFs downloaded into gitignored `docs/<City>/` on main (never a worktree). `pdftotext` invoked via subprocess **args array** (`shell=False`) — no shell-string interpolation of URLs/paths. Fetch only from each city's allow-listed host; verify HTTP 200 + `Content-Type: application/pdf` before pinning (reject HTML error pages saved as `.pdf`). Executed inline (no subagents).

## Deliverables

- `.planning/phases/131-recon-extractors/131-RECON.md` — per-city per-year tie table + locked window per city + South Tucson verdict + holes + dry-run tie table.
- `scripts/extractAcfrGF.py` — generalized GF extractor, `$0` tie on every in-scope city×FY×mode.
