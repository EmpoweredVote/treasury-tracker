# 117 — Batch 3 ACFR Source Location (RECON-11, NE/NV/NH/NM/ND)

**Status:** IN PROGRESS — Task 0 (workspace + D-03 triage) complete.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**States:** Nebraska (NE), Nevada (NV), New Hampshire (NH), New Mexico (NM), North Dakota (ND)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 112-BATCH1/2-SOURCES.md shape.

## Workspace

`_acfr-work/{ne,nv,nh,nm,nd}/` created (gitignored — `.gitignore` lines 108/133 cover `_acfr-work/`).
`pdftotext -v` confirms poppler 4.00 available. `_acfr-work/extract_gf.py` (the v2.14 GF-column
extractor, position-anchored on the "Total revenues" row) used unmodified for all five states.

---

## Section 0 — D-03 Triage (does a GAAP Governmental Funds ACFR with a splittable GF column exist?)

| State | Triage verdict | Basis |
|-------|---------------|-------|
| **Nebraska (NE)** | **RECON** | `das.nebraska.gov/accounting/financial_reports.php` lists direct ACFR PDF links FY2020–FY2025, fully derivable URL, confirmed `application/pdf` (not soft-404). |
| **Nevada (NV)** | **RECON** (with a recency caveat) | `controller.nv.gov` confirms a GAAP ACFR exists; the live nav page states ACFR documents are "currently being remediated" (records-request fallback), but the actual filed PDFs remain directly fetchable by explicit filename through FY2023. FY2024/FY2025 not yet found — see Section 5/6. |
| **New Hampshire (NH)** | **RECON** | Contrary to the pre-planning speculation that NH would be a leading STAY-NASBO candidate, `das.nh.gov/accounting/fy {YY}/` publishes an annual GAAP ACFR every year including FY2024 (published ~9 months after FYE). The blocker is an **access mechanism** issue (Akamai edge-blocks automated fetches — see Section 6), not a data-availability issue. |
| **New Mexico (NM)** | **RECON** | `nmdfa.state.nm.us` (Dept. of Finance & Administration) publishes an annual statewide ACFR (opaque WordPress-upload URLs, confirmed FY2019/FY2022/FY2024) with a clean Governmental Funds GENERAL FUND column. |
| **North Dakota (ND)** | **RECON** | `omb.nd.gov/financial-transparency/annual-comprehensive-financial-reports-acfr` publishes an **annual** GAAP ACFR (FY2021–FY2025, fully derivable URL) — confirms ND's ACFR is NOT limited by its biennial appropriations budget; the annual GAAP reporting cycle is unaffected. |

**Outcome: all 5 Batch-3 states pass D-03 triage — zero STAY-NASBO-exception candidates in this batch.** No accept-relabel-only or stay-NASBO disposition needed; the Phase-123 "nodes remaining NASBO-served" list gets **zero** additions from Batch 3.

---

## Section D-10 — Overlap check (read-only DB probe)

Read-only probe of `treasury.municipalities` / `treasury.budgets` confirmed all five state nodes are
clean NASBO-only nodes (2 `budgets` rows each: FY2023/operating + FY2024/operating, no
`operating_budgets` line items) — matching the `loadStateGF.mjs` NASBO-totals-only write pattern.
**No overlap for any of the 5 states** — no in-place-upgrade planning needed (same conclusion as
Phase 112 for tranche 3). Note: dead pre-v2.10 "estimated" loaders (`scripts/processNE.js`,
`processNV.js`, `processNH.js`, `processNM.js`, `processND.js` + their `*Revenue.js` counterparts)
exist in `scripts/` but were **never run against the live DB** for these nodes — confirmed by the
probe (no matching `data_source`/`source_url` residue). They are superseded/orphaned code, not a
live overlap; out of scope to delete in this doc-only recon phase.

| State | Municipality ID | Existing `budgets` rows | Verdict |
|-------|-----------------|--------------------------|---------|
| Nebraska | `ccfb8751-ae32-4974-96a9-d8c8ea85a898` | 2023/operating=$5.154B, 2024/operating=$5.314B | Clean NASBO-only |
| Nevada | `d0879e45-0b72-41ee-bdbd-a214a4f2a1d5` | 2023/operating=$4.742B, 2024/operating=$5.273B | Clean NASBO-only |
| New Hampshire | `c54f6dbd-3f2a-453e-b0b9-259e377aef67` | 2023/operating=$2.136B, 2024/operating=$1.981B | Clean NASBO-only |
| New Mexico | `1e60ff76-c9fa-48d0-9442-042f61cd40ea` | 2023/operating=$8.682B, 2024/operating=$9.975B | Clean NASBO-only |
| North Dakota | `e84aafe0-eeaa-470a-8fd3-708c88af2a80` | 2023/operating=$2.436B, 2024/operating=$2.876B | Clean NASBO-only |

---

*(Sections 1–8 below: per-state source table, bookend tie-confirmations, four risk facts, scope-vs-NASBO,
recency-floor verdicts, consolidated gap log, loader mapping, and per-state detail blocks.)*
