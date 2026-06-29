# Phase 97 — Live-App UAT Checklist (SGFS-05 / D-97-02)

**App:** https://treasurytracker.empowered.vote (no login needed — inform-tier/unauthenticated has full read access)
**Driver:** Chris · **Recorder:** agent · **Date:** ______ (2026-06-__)
**Nodes (D-97-02):** Minnesota (ACFR op+rev) · California (operating-only NASBO, the "large" node) · Georgia (NASBO pilot, F-97-01-fixed year)

> BLOCKING checkpoint. The phase does not complete without Chris's explicit sign-off. Record pass/fail per row.

## Pre-flight (confirmed read-only, 2026-06-29)
- Minnesota: pop 5,706,494 · operating + revenue present (18 FYs each; latest FY2025: 11 spending functions, 12 revenue sources) · basis GAAP · source mn.gov/mmb ACFR
- California: pop 39,500,000 · operating-only (no revenue dataset) · FY2023 $195.189B / FY2024 $205.671B · basis budgetary · source 2025 NASBO SER
- Georgia: pop 10,711,908 · operating-only · FY2023 $29.266B (F-97-01 fixed) / FY2024 $34.594B · basis budgetary · source 2025 NASBO SER

---

## A — Minnesota (ACFR; the op+rev differentiator)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A1 | Open app → State Governments → Minnesota | MN node loads; breadcrumb shows US → Minnesota | ☐ |
| A2 | Look at the dataset cards | BOTH "Money Out" and "Money In" cards are **enabled** (MN has operating + revenue) | ☐ |
| A3 | Money Out (spending) | Icicle renders ~11 functions (General Education, Health & Human Services, …); total ≈ **$35.1B** (FY2025) | ☐ |
| A4 | Money In (revenue) — click the "Money In" card | Revenue icicle renders ~12 sources (Individual Income Taxes, Sales Taxes, …); total ≈ **$35.5B** (FY2025) | ☐ |
| A5 | Source chip | Resolves to a real, citizen-openable MN ACFR / mn.gov/mmb document | ☐ |
| A6 | Basis label | Visible and reads **GAAP basis** (honest, not hidden) | ☐ |
| A7 | Per-capita | Renders a per-resident figure (pop 5.71M) | ☐ |
| A8 | (optional) Switch year to FY2023 | Money Out ≈ $26.6B, Money In ≈ $33.5B (the 97-01 reconciled figures) | ☐ |

## B — California (operating-only NASBO; D-97-03 live check)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| B1 | State Governments → California | CA node loads | ☐ |
| B2 | Dataset cards | "Money Out" enabled; **"Money In" card is greyed/disabled (not clickable, no number)** — NOT an empty or broken revenue view (D-97-03) | ☐ |
| B3 | Money Out | Icicle renders 6 functions (Elementary & Secondary Education, All Other, Medicaid, Higher Education, Corrections, Transportation); total ≈ **$205.7B** (FY2024) | ☐ |
| B4 | Source chip | Resolves to the 2025 NASBO State Expenditure Report (real, openable) | ☐ |
| B5 | Basis label | Visible and reads **budgetary basis** (distinct from MN's GAAP — mix is shown honestly) | ☐ |
| B6 | Per-capita | Renders (pop 39.5M) | ☐ |

## C — Georgia (NASBO pilot; F-97-01-fixed year)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| C1 | State Governments → Georgia | GA node loads | ☐ |
| C2 | Money Out (FY2024 default) | 6 functions; total ≈ **$34.594B** | ☐ |
| C3 | "Money In" card | Greyed/disabled (operating-only) — no broken revenue view | ☐ |
| C4 | Switch year to FY2023 | Total ≈ **$29.266B**; Medicaid shows **$3.39B** (post F-97-01); the 6 visible function slices visually fill the parent with no overflow/gap | ☐ |
| C5 | Source chip | Resolves to the 2025 NASBO SER | ☐ |
| C6 | Basis label | Visible, **budgetary basis** | ☐ |
| C7 | Per-capita | Renders (pop 10.71M) | ☐ |

---

## Result

- Items passed: **21 / 21** ✓
- Failures / notes: none — all rows pass, including ⭐B2 (operating-only "Money In" disabled, not broken) and ⭐C4 (GA FY2023 $29.266B with Medicaid $3.39B after F-97-01, slices fill the parent cleanly)
- **Chris sign-off (SGFS-05 UAT): APPROVED — Chris Cantrell**  **Date:** 2026-06-29

*On a clean run this closes Phase 97 and the v2.10 State General Fund Sourcing milestone (→ /gsd-complete-milestone).*
