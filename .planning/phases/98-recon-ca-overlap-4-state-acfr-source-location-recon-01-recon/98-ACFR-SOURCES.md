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

## Per-state clean FY window + gap log

_Pending the full-window backfill (D-06)._ Latest FY confirmed clean for all four (above). Deep-history extraction (as-deep-as-clean, per-state independent, no NASBO floor — CONTEXT D-01/02/03) is the remaining bulk.

---

## ⏸ CHECKPOINT — full-window backfill pacing (plan 98-02 is `autonomous: false`)

The two scariest unknowns are now retired: **ACFR access works for all 4** and **`-table` extraction is clean + tie-confirmed**. CA's overlap question (98-01) also resolved to a non-issue. What remains in 98-02 is the **full-window pre-extract** (D-06): locate + download + `-table`-extract + tie-check **every cleanly-extractable prior FY** for all four states — potentially ~40–60 more PDF downloads (CA history alone runs to `acfr20web.pdf` and earlier `cafr##web.pdf`; TX to ~FY2015; NY/FL similar). This is mechanical but large.

This is the right point to confirm depth/pacing with Chris before the marathon (see the assistant message).
