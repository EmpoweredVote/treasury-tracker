# 98 — ACFR Source Location + Extraction (RECON-02)

**Status:** Latest-FY located + `pdftotext -table` confirmed for ALL FOUR states (RECON-02 floor met). Full-window backfill (D-06) **pending a pacing checkpoint** — see bottom.
**Method proven:** `pdftotext -table` (NOT `-layout`, which floats numbers to wrong rows). Extraction is $0 (no AI). All four state ACFRs downloaded over plain `curl` — **no CDN/TLS block** (state ACFRs are far more accessible than the city ACFRs in `.planning/followups/ca-acfr-reconciliation.md`).

---

## Per-state located statement (latest FY)

| State | Latest ACFR | FY end | Durable URL pattern | Statement | GF column | Units |
|-------|------------|--------|---------------------|-----------|-----------|-------|
| **CA** | FY2025 | Jun 30 | `https://www.sco.ca.gov/Files-ARD/ACFR/acfr{NN}web.pdf` (NN=2-digit FY; `acfr25web.pdf`) | Govtl Funds Stmt of Rev/Exp/Changes (printed p.46 / PDF p.64–65) | "General" (1st col) | thousands |
| **TX** | FY2024 | Aug 31 | `https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/{YYYY}/96-471.pdf` | Govtl Funds Stmt of Rev/Exp/Changes (PDF p.52–53) | "General Revenue Fund" (1st col) | thousands |
| **NY** | FY2024 | Mar 31 | `https://www.osc.ny.gov/files/reports/finance/pdf/annual-comprehensive-financial-report-{YYYY}.pdf` | Govtl Funds Stmt of Rev/Exp/Changes (printed p.43 / PDF p.43–44) | "General" (1st col) | **millions** |
| **FL** | FY2024 | Jun 30 | `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf` | Govtl Funds Stmt of Rev/Exp/Changes (printed p.34 / PDF p.33–35) | "General Fund" (1st col) | thousands |

> **NY use the finance/reports ACFR, not the pension ACFR.** `osc.ny.gov` also publishes an NYSLRS (retirement) ACFR with a similar filename — the State BFR is under `/files/reports/finance/pdf/`.
> **TX `96-471.pdf`** is the full ACFR file id; the library goes back to ~FY2015 under `/comprehensive-annual-financial/{YYYY}/`.

## Latest-FY extraction confirmation (GF column, `-table`)

| State | FY | GF "Total revenues" (as printed) | NASBO GF (current node) | Δ / note |
|-------|----|----------------------------------|-------------------------|----------|
| **CA** | 2025 | **$221,591,201K** — 15 revenue line items sum **exactly** to printed total ✅ TIE | op $205.7B (FY2024) | ACFR GF rev > NASBO op; basis+year differ |
| **NY** | 2024 | $93,894M | $91.07B | ~+3% (GAAP vs budgetary) — the expected MN-like spread |
| **FL** | 2024 | $59,810,603K | $51.6B | ~+16% |
| **TX** | 2024 | $161,416,562K (General **Revenue** Fund) | $50.5B | **~3× — MATERIAL.** TX's ACFR "General Revenue Fund" is a far broader consolidated operating fund than NASBO's general-fund concept. See risk below. |

## Findings / risks surfaced

1. **TX General Revenue Fund ≠ NASBO General Fund (scope mismatch).** Replacing NASBO TX ($50.5B) with the ACFR GR Fund ($161.4B) is not a like-for-like swap — the node total triples. Phase 99 must decide deliberately: (a) accept the GR-Fund as TX's GF node (re-label basis honestly), or (b) extract a narrower GF subset. **Recommend (a)** — the ACFR GR Fund is the audited GAAP "general fund equivalent" Texas reports; relabel + document. Flag for Chris.
2. **NY is in millions** (CA/TX/FL in thousands) — the loader must scale NY ×1,000 when writing dollars. Granularity is coarser but the GF column is clean.
3. **`-table` is mandatory; `-layout` misaligns.** Confirmed on CA (`-layout` floated revenue values up one row; `-table` paired them correctly and the total tied). This is the D-07 cleanup lever — `-table` IS the clean read for these statements.
4. **Access is clean.** All four downloaded over plain `curl` (HTTP 200, real PDFs, 300–382 pp, 10–21 MB). No `--insecure`/browser-fallback needed for the latest FY. (Older archived years still TBD in the backfill.)

## Per-state clean FY window + gap log (bookend-confirmed)

**Approach (Chris, 2026-06-29):** bookend per state — tie-confirm the OLDEST + LATEST cleanly-available FY now (pins the window at both ends + proves older PDFs still `-table`-extract), record the per-year URL, and let **Phase 99 extract the in-between years as it loads**. Windows are per-state independent, no NASBO floor (CONTEXT D-01/02/03).

| State | Confirmed clean window | # FYs | Old-end tie | Latest-end tie | Per-year URL |
|-------|------------------------|-------|-------------|----------------|--------------|
| **CA** | **FY2020 – FY2025** | 6 | FY2020 GF Total rev **$155,923,876K** ✅ | FY2025 **$221,591,201K** ✅ exact | `…/ACFR/acfr{NN}web.pdf`, NN=20…25 |
| **TX** | **FY2015 – FY2024** | 10 (–FY2016) | FY2015 GR Fund Total rev **$95,574,830K** ✅ | FY2024 **$161,416,562K** ✅ | `…/comprehensive-annual-financial/{YYYY}/96-471.pdf` |
| **NY** | **FY2015 – FY2024** | 10 | FY2015 GF personal income **$30,380M** ✅ (stmt clean) | FY2024 GF Total rev **$93,894M** ✅ | FY≥2022 `annual-comprehensive-financial-report-{YYYY}.pdf`; FY≤2021 `comprehensive-annual-financial-report-{YYYY}.pdf` |
| **FL** | **FY2022 – FY2024** | 3 | FY2022 GF Total rev **$57,241,428K** ✅ | FY2024 **$59,810,603K** ✅ | `…/cafr/fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf` |

### Gap log (dropped / needs-cleanup FYs)

| State | FY | Issue | Disposition (light cleanup — D-07) |
|-------|----|-------|------------------------------------|
| TX | 2016 | `96-471.pdf` → HTTP 404 (the `96-471` file-id wasn't used that year) | Phase 99: locate FY2016's alternate ACFR file-id on the same archive page; not a data problem |
| CA | ≤2019 | `acfr{NN}web.pdf` / `cafr{NN}web.pdf` for FY≤2019 return an **11,561-byte HTML soft-404** (not a PDF) at the standard ARD path | Deeper CA history exists only behind the SCO ARD archive page (no clean predictable URL). FY2020–2025 is the clean window; going deeper is an optional Phase-99/follow-up extension, not blocking. |
| FL | ≤2021 | `fye-{YYYY}-…` naming returns 404 for FY≤2021 (the durable naming starts FY2022) | Older FL ACFRs need the `myfloridacfo.com` FL-ACFR archive page (different per-year naming). FY2022–2024 is the clean window; deeper = optional Phase-99 extension. |
| NY | ≤2014 | not probed (FY2015 is the bookend old-end) | NY almost certainly goes deeper (predictable `comprehensive-annual-financial-report-{YYYY}.pdf` naming); Phase 99 can extend below FY2015 if desired. |

**Soft-404 caution for Phase 99:** the CA SCO server returns HTTP **200 with an HTML body** for missing files — filter downloads by `Content-Type: application/pdf` (or size > ~1 MB), never by HTTP status alone. (TX/FL return honest 404s.)

---

## Status: 98-02 COMPLETE (bookend)

RECON-02 satisfied: all four ACFR Governmental-Funds GF statements located (correct statement, General/General-Revenue column, GAAP), durable per-year URL recorded, `-table` extraction tie-confirmed at **both** ends of each state's window, gap log written, access quirks noted. Per-FY in-between extraction is deferred to Phase 99's load (bookend decision). $0 spend (pdftotext only).
