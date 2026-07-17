---
phase: 131
plan: "131-01"
title: "Recon: enumerate ACFR years + pin URLs + bookend-tie GF + lock window; resolve South Tucson"
status: complete
requirements: [PIMA-01, PIMA-02]
completed: 2026-07-16
---

# 131-01 SUMMARY — Recon + South Tucson verdict

**Outcome: complete. All four municipalities located and confirmed loadable.** Deliverable: `131-RECON.md`.

## What was done
- Enumerated published ACFRs for **Oro Valley, Marana, Sahuarita, South Tucson** via each site's index, WebSearch, and the Wayback CDX API. Pinned canonical per-year `source_url`s for the locked **FY2019–FY2024** window (Chris's window decision).
- Downloaded all 22 in-scope PDFs into gitignored `docs/<City>/`; every file validated as a real PDF (`%PDF`, cover-year confirmed).
- Located each governmental-funds *Statement of Revenues, Expenditures and Changes in Fund Balances*; confirmed GF = first data column, whole-dollars basis, GF bookend-ties $0 (rigorous tie table produced by the extractor in 131-02).

## Key findings / deviations
- **WAF pivot (precedented, = v2.15 NH):** orovalleyaz.gov, maranaaz.gov, southtucsonaz.gov return HTTP 403 to automated clients. Retrieval pivoted to the **Wayback Machine** (OV, Marana) and the **AZ ADE mirror** (South Tucson); Sahuarita fetches directly. Canonical origin URLs are pinned as `source_url` (they resolve in a human browser); mirrors recorded as the fetch path. See 131-RECON.md.
- **PIMA-02 — South Tucson verdict = (a) LOAD-FROM-ACFR.** The worst case (AFR-only / not-icicle-grade) did not occur: South Tucson's FY2022 report is a titled ACFR with the governmental-funds statement, and FY2019–2021 carry the same statement. Load **FY2019–FY2022**; **FY2023–FY2024 are documented holes** (city files late, not yet published).
- **Oro Valley FY2020 recovered:** initially looked missing (named `...cafr-20-final.pdf`, not `acfr`); confirmed present. OV window is a clean contiguous FY2019–FY2024.
- Deeper history available but deferred per the window decision: OV to ~FY2006, Sahuarita to FY2015.

## Must-haves
- ✅ Every in-scope year listed with a durable per-year URL (canonical origin; mirror-retrieved where the origin WAFs)
- ✅ GF column bookend-ties $0 for every loaded year (tie table in 131-RECON.md / 131-02)
- ✅ Contiguous window locked per city
- ✅ South Tucson explicit verdict with evidence — no silent drop
- ✅ PDFs in gitignored `docs/<City>/` on main; `-table` used, never `-layout`
