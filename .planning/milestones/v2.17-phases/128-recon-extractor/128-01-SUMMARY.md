---
phase: 128
plan: "128-01"
title: "Recon: enumerate Tucson ACFR years, pin durable URLs, bookend-tie GF column, lock window"
status: complete
requirements: [TUC-01]
completed: 2026-07-10
commit: 4e6feef
---

# Plan 128-01 Summary — Tucson ACFR recon + window lock

**Outcome:** TUC-01 satisfied. Enumerated, pinned, downloaded, and GF-bookend-tied **10 contiguous Tucson ACFR years (FY2015–FY2024)** at exactly $0; locked that as the clean-extract window with zero interior holes.

## What was done
- **Enumeration + durable URLs.** The city ACFR HTML index is CDN-bot-blocked (403 even with a browser UA), but direct PDF assets serve fine. Resolved per-year direct URLs via web search + HTTP verification; every pinned URL returns **HTTP 200 `application/pdf`** on `tucsonaz.gov`. Filenames are inconsistent across eras (`cot-2024-…`, `city-of-tucson-fy-2023-…-final`, `acfr-2021-2022`, `2020.pdf`, `2014-2015-acfr`), so each was verified individually — no blind pattern trust.
- **Download.** All 10 PDFs saved to `docs/Tucson/cot-<FY>-acfr.pdf` (gitignored via `docs/*`; on `main`, not a worktree).
- **Bookend tie.** For each year located the primary governmental-funds *Statement of Revenues, Expenditures and Changes in Fund Balances*, extracted via `pdftotext -table`, isolated the **General Fund column (col 0)** positionally, and confirmed `Σ GF revenue rows == printed Total revenues` and `Σ GF expenditure rows == printed Total expenditures`, both `Δ = 0`. FY2024 reproduces the §0 scoping probe exactly ($773,493,270 / $648,657,363).
- **Window locked.** `FY2015–FY2024`, recorded in `128-RECON.md` with per-year table, durable URLs, statement pages, tie deltas, and format-era notes.

## Key findings (fed into Plan 128-02)
- Statement **title wraps** across lines in older years → page-finder must be whitespace-flexible or it silently selects a self-tying *combining* page.
- Two layout eras: single-page (FY2023–24) vs column-split `(Continued)` (FY2015–22) — GF is fully on the title page either way.
- **No printed intermediate sub-totals** (Current/Debt service are label-only parents; value = Σ children).
- Self-tie is necessary but not sufficient — must select the *primary* statement (monotonic GF-revenue $468M→$773M is the sanity cross-check).

## Deliverable
`.planning/phases/128-recon-extractor/128-RECON.md` (committed `4e6feef`). PDFs in `docs/Tucson/` (gitignored).

## Boundaries honored
No seed, no load, no schema touch (those are Phase 129). Newest boundary: FY2025 not yet published (honest gap). Oldest: FY2015 (pre-2015 deferred, not blocked).
