# 103 — Pilot Deepening Sources (RECON-04, pilot half)

**Status:** All four pilots probed; deeper-history durable URLs located + bookend-tie-confirmed via `pdftotext -table`. $0 spend (pdftotext only, no AI). Method = bookend (CONTEXT D-03): old-end + a current-end re-confirm; in-between FYs are extracted by Phase 104 at load time.

**Headline:** Two of the four pilots extend **much** deeper than the 98 gap log predicted. The 98 recon probed only one URL path per state and recorded CA/FL deeper history as "not durably sourceable." This deeper probe found durable archives at **different paths**:
- **CA** deeper history lives at `/Files-ARD/CAFR/` (98 only probed `/Files-ARD/ACFR/`, which soft-404s for FY≤2019).
- **FL FY2021** works with the *same* `fye-{YYYY}-…` naming (98 marked FY≤2021 as 404 — off by one).

---

## Per-pilot deepening table

| Pilot | Current window (v2.11) | Durable deepened window | Added FYs | Old-end bookend tie | Per-year URL pattern for added years | Units |
|-------|------------------------|-------------------------|-----------|---------------------|--------------------------------------|-------|
| **NY** | FY2015–FY2024 | **FY2003–FY2024** | +FY2003–FY2014 (12) | FY2003 General Total revenues **$29,250M** ✅ (line items sum to col total; cols sum to printed $84,699M total) | `https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-{YYYY}.pdf` (FY2003–2021); FY2022+ already on `annual-comprehensive-financial-report-{YYYY}.pdf` | **millions** (loader ×1000) |
| **TX** | FY2015–FY2024 (FY2016 hole) | **FY2015–FY2024 (contiguous)** | +FY2016 (1) | FY2016 General Total Revenues **$96,239,551K** ✅ (line items sum to col total; cols sum to printed $111,259,520K total) | FY2016 only: `https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2016/docs/96-471.pdf` (**note `docs/` infix** — differs from other years' `{YYYY}/96-471.pdf`) | thousands |
| **CA** | FY2020–FY2025 | **FY2008–FY2025** | +FY2008–FY2019 (12) | FY2008 General Total revenues **$97,774,378K** ✅ (cols sum exactly to printed $177,290,329K total) | `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (NN=08…19) — **different dir from the `/Files-ARD/ACFR/acfr{NN}web.pdf` used for FY2020+** | thousands |
| **FL** | FY2022–FY2024 | **FY2021–FY2024** | +FY2021 (1) | FY2021 General Fund Total revenues **$46,989,188K** ✅ (line items sum exactly to col total) | `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf` (same pattern as FY2022+; works for FY2021) | thousands |

**Current-end re-confirm:** NY FY2024 ($93,894M), TX FY2024 ($161,416,562K), CA FY2025 ($221,591,201K), FL FY2024 ($59,810,603K) were all tie-confirmed in 98 — windows are bookend-confirmed at both ends.

---

## Deepening gap log

| Pilot | FY | Issue | Disposition |
|-------|----|-------|-------------|
| NY | ≤FY2002 | `comprehensive-annual-financial-report-{YYYY}.pdf` → HTTP 404 for FY2002 and earlier | Durable predictable naming stops at FY2003. FY2003 is the durable old-end. No deeper extension (no durable URL). |
| TX | FY2016 | RESOLVED — `…/2016/96-471.pdf` 404'd (98), but the file is at `…/2016/docs/96-471.pdf` (extra `docs/` path segment that year) | Located + tie-confirmed. The TX `SOURCES` map needs FY2016 special-cased with the `docs/` infix. |
| CA | FY2002–FY2007 | Durable PDFs exist but under **variant naming**: `cafr06.pdf`, `cafr07.pdf` (no `web`), `2002_cafr02.pdf`…`2005_cafr05.pdf` (year-prefixed) under `/Files-ARD/CAFR/` | Durably sourceable but not a single clean pattern. FY2008–FY2019 is the clean `cafr{NN}web.pdf` extension (the recommended deepening). FY2002–2007 is an **optional further extension** (per-year URLs enumerable from the SCO ARD landing page `https://www.sco.ca.gov/ard_state_acfr.html`). |
| FL | ≤FY2020 | Neither the `annual-comprehensive` nor the older `comprehensive-annual` word-order naming resolves to a PDF at the `transparency-docs/cafr/` path for FY≤2020 (returns HTML, not PDF) | Located-but-not-durably-sourceable within the D-01 effort budget — **excluded** per D-02. FL's durable old-end is FY2021. (Deeper FL history may exist behind a different DFS/archive path; deferred.) |

---

## Per-pilot extraction-confidence + Phase-104 load notes

- **NY — 12 added FYs (FY2003–FY2014), HIGH confidence.** Predictable `comprehensive-annual-financial-report-{YYYY}.pdf`, all real PDFs (1.1–4.0 MB) FY2003–FY2014; FY2002 404s. Units = millions (loader's existing ×1000 scaling applies to the deeper years). Main govtl-funds statement columns: General | Federal Special Revenue | Other Governmental | Eliminations | Total — read with `-table` (`-layout` scrambles it). Phase 104 transcribes FY2003–FY2014 General-column blocks.
- **TX — 1 added FY (FY2016), HIGH confidence.** The only change is one special-cased `SOURCES` entry (the `docs/` infix). Column header is just "General" (the consolidated General Revenue Fund concept, ~$96B — consistent with 98's accept-relabel of TX's General Revenue Fund). FY-end Aug 31.
- **CA — 12 added FYs (FY2008–FY2019), HIGH confidence; deeper optional.** Clean `cafr{NN}web.pdf` pattern under `/Files-ARD/CAFR/`. Columns: General | Federal | Transportation | Nonmajor Governmental | Total. FY2008 full-column sum tied exactly. FY2002–2007 reachable under variant naming (optional further extension).
- **FL — 1 added FY (FY2021), HIGH confidence.** Same `fye-{YYYY}-…` pattern. **FY2021 General Fund has a NEGATIVE "Investment earnings (losses)" line (−$398,287K)** → the P2 negative-category clamp will fire on the FY2021 revenue load (per ACFR-08, like OH FY2022). Phase 104 must clamp.

**Idempotency reminder for Phase 104:** the deepening adds only the new older-FY `SOURCES` keys + their transcribed GF blocks. Existing v2.11 pilot rows (CA FY2020–25, TX FY2015 + FY2017–24, NY FY2015–24, FL FY2022–24) and their `SOURCES` entries are left untouched (never-overwrite).
