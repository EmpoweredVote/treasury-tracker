---
phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0
plan: "103-02"
subsystem: data
tags: [acfr, recon, pdftotext, state-gf, pennsylvania, illinois]
requires:
  - phase: 98-recon
    provides: "ACFR location method + TX scope-mismatch precedent + bookend approach"
provides:
  - "PA + IL ACFR GF statements located + bookend-tie-confirmed, four facts pinned, scope-vs-NASBO + recent-window verdicts"
  - "103-PA-IL-SOURCES.md — per-state source table, durable per-year URLs, accept-relabel recommendation"
affects: [105-pa-il-upgrade, 103-03-synthesis]
tech-stack:
  added: []
  patterns: ["WebFetch publisher ACFR landing page to enumerate per-year URLs; final-audited-only guard for IL interim ACFRs"]
key-files:
  created:
    - .planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-PA-IL-SOURCES.md
key-decisions:
  - "PA GF (~$91B) ~2x NASBO + IL GF (~$74-78B) ~1.5x NASBO — both TX-style (federal/intergovernmental inside GAAP GF) -> accept-and-relabel (D-04)"
  - "Both PA + IL recent-window FY2023+FY2024 COVERED by final-audited ACFRs -> D-06 greenlight, no strand"
  - "IL must use ACFR Final {YYYY} files only, never the Interim/unaudited variants (GAAP audited-actuals rule)"
  - "PA durable FY2016-FY2025 (filename hyphen->space at FY2024); IL durable FY2021-FY2025 (per-year variant naming)"
patterns-established:
  - "Pin units BEFORE extracting (PA MD&A says millions, basic stmt says thousands — read the basic statement, not MD&A)"
requirements-completed: [RECON-04]
duration: 40min
completed: 2026-06-30
---

# Plan 103-02 Summary — PA + IL ACFR source location

## What was done

Located both new states' ACFR Governmental Funds *Statement of Rev/Exp/Changes in Fund Balances* (General Fund column, GAAP, thousands, FY-end Jun 30), bookend-tie-confirmed via `pdftotext -table`, pinned the four risk facts, documented scope-vs-NASBO, and ran the D-06 recent-window check. Wrote `103-PA-IL-SOURCES.md`. $0 spend.

## Tie-confirmed (General Fund Total revenues)

- **PA** FY2024 = **$91,293,027K** (line items sum exactly; cols sum to $106,814,395K); FY2023 = **$95,231,042K** (cols tie; cross-confirms FY2024 MD&A comparative). Durable FY2016–FY2025.
- **IL** FY2023 = **$73,827,795K** (line items sum exactly; cols sum to $112,874,196K); FY2025 = **$78,342,927K** (cols tie). Durable final-audited FY2021–FY2025.

## Key findings

- **Both states show a TX-style scope divergence** vs NASBO: PA ACFR GF ~2× NASBO (Intergovernmental/federal $42.3B inside the GAAP General Fund), IL ~1.5× (Federal $22.1B inside). Recommend accept-and-relabel honestly (D-04), confirmed at Phase-105 load.
- **D-06 recent-window: both GREENLIT** — final audited ACFRs exist through FY2024/FY2025 for both, so replacing the NASBO FY2023/FY2024 rows is a strict upgrade (no strand).
- **IL guard:** the comptroller publishes a separate "Interim … unaudited" ACFR per FY — the loader must use the `ACFR Final {YYYY}` files only.
- **Naming gotchas:** PA filename switches hyphen→space at FY2024; IL uses per-year variant naming ("Bookmarked" suffix FY2023–25, plain FY2021) — both need explicit per-year SOURCES entries.

## Self-Check: PASSED
- PA + IL GF statements located (correct Governmental Funds statement + General Fund column) with durable per-year URLs ✓
- Oldest+latest clean FY GF totals tie via `-table` ✓
- Four D-05 facts pinned per state; scope-vs-NASBO + accept-relabel per state ✓
- D-06 recent-window verified per state ✓; no DB writes; $0 spend ✓
