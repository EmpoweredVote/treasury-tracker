# 117-05 — DEEP-05 Deepening Sources (RECON-11, DEEP-05 half)

**Status:** All four targets probed live (2026-07-03); deeper-history durable URLs located + bookend-tie-confirmed via `pdftotext -table` (poppler 4.00). $0 spend (curl + pdftotext only, no AI). Method = bookend (D-05): tie the new old-end + re-confirm the pre-existing current-end; in-between FYs are extracted by Phase 122 at load time. Mirrors the `103-DEEPEN-SOURCES.md` shape.

## ⚠️ Premise correction (read first)

The phase objective's stated "current window" for each target — **CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016** — is **stale**. It describes each pilot's *v2.11* (pre-Phase-104) window. **Phase 104 (v2.12) already deepened three of the four** and the fourth was already resolved in Phase 99-01 (v2.11). Verified directly from the live loader source (`scripts/process{CA,NYAcfr,FLAcfr,TX}.js`, `scripts/process{CA,NY,TX}RevenueAcfr.js` / `processFLRevenueAcfr.js`) and corroborated by `103-DEEPEN-SOURCES.md` + the v2.12 PROJECT.md changelog:

| Target | Plan-stated window (stale) | **Actual current window (verified 2026-07-03)** |
|--------|------------------------------|---------------------------------------------------|
| CA | pre-FY2020 | **FY2008–FY2025** (Phase 104 deepened FY2008–2019 under `/Files-ARD/CAFR/`) |
| NY | pre-FY2015 | **FY2003–FY2024** (Phase 104 deepened FY2003–2014, ×millions) |
| FL | pre-FY2022 | **FY2021–FY2024** (Phase 104 added FY2021) |
| TX | FY2016 gap | **FY2015–FY2024, already contiguous** (FY2016 file-id gap closed in Phase 99-01, v2.11 — re-confirmed live below, still 200) |

Per D-02 ("go as deep as durable URLs allow — no hard FY floor"), this recon **digs below the actual current window** established above, not the stale plan text. This is a Rule-1-class correction (the plan's premise was factually wrong; the recon's job — establishing the true current state before digging further — required correcting it). Documented as a deviation in the plan's SUMMARY.

---

## Per-target deepening table

| Target | Actual current window | **New durable old-end reached** | Added FYs | Bookend tie evidence | Per-year URL pattern (new years) | Units | Pre-GASB-34 flag |
|--------|------------------------|----------------------------------|-----------|----------------------|-----------------------------------|-------|-------------------|
| **CA** | FY2008–FY2025 | **FY2002** | +FY2002–FY2007 (6) | FY2002 GENERAL col Total revenues **$63,942,875K** ✅ (7-line column sum ties exactly: 32,874,734+21,348,052+4,553,105+1,599,064+1,434,999+4,177+48,346+15,363+124,927+246,202+39,002+768,452+886,452 = 63,942,875); FY2007 GENERAL col Total revenues **$96,309,497K** ✅ (13-line sum ties exactly); current-end FY2025 $221,591,201K already tied (Phase 99/104, unchanged) | `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}.pdf` (no "web" suffix) for FY2006–2007; `https://www.sco.ca.gov/Files-ARD/CAFR/{YYYY}_cafr{NN}.pdf` for FY2002–2005 (year-prefixed variant, e.g. `2002_cafr02.pdf`) | thousands (same as current window) | **No** — FY2002 statement is already the modern "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds" (GASB-34) layout, column header "General", identical shape to FY2008+. FY2002 IS the GASB-34 first year; no dig crossed below it. |
| **NY** | FY2003–FY2024 | **No durable extension — FY2003 remains the floor** | 0 | N/A (no new years) | N/A | millions | N/A |
| **FL** | FY2021–FY2024 | **FY2003** (clean); FY2000–FY2002 durable-but-corrupted (see gap log) | +FY2003–FY2020 (18 clean) | FY2003 GENERAL FUND col Total revenues **$19,857,818K** ✅ (7-line sum ties exactly: 18,801,456+94,847+386,627+10,342+537,369+26,509+668 = 19,857,818); FY2020 GENERAL FUND col Total revenues **$40,534,343K** ✅ (7-line sum ties exactly); current-end FY2021 $46,989,188K already tied (Phase 100/104, unchanged); FY2010 + FY2015 spot-confirmed extractable (GENERAL FUND statement present, `-table` clean, in-between transcription deferred to Phase 122 per D-05) | Per-year filename map discovered (all under `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/`): FY2000–2012 = `cafr{YYYY}.pdf`; FY2013–2017 = `{YYYY}cafr.pdf`; FY2018–2019 = `cafr{YYYY}.pdf`; FY2020 = `{YYYY}cafr.pdf` (alternates year-to-year, no single rule — full per-year map recorded below) | thousands (same as current window) | **Deferred, not applied** — the clean block (FY2003–2020) is entirely post-GASB-34 layout (same "Governmental Funds" statement, matches current FY2021+ format exactly). FY2000–FY2002 (which would need the flag if the dig crosses FY2002) are durable-URL-confirmed but **extraction-corrupted** — pre34 status unconfirmed pending repair (see gap log). |
| **TX** | FY2015–FY2024 (already contiguous) | **No durable extension found within budget — FY2015 remains the floor** | 0 | FY2016 file-id gap **re-confirmed still resolved and live** (`.../2016/docs/96-471.pdf` → HTTP 200, 14.8MB, still the URL `processTX.js` uses) — not a new tie, a re-confirmation that the v2.11/Phase-99-01 fix hasn't rotted | N/A | thousands | N/A |

---

## FL per-year filename map (FY2000–FY2020, discovered 2026-07-03)

All URLs are `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/{filename}` — confirmed via `curl -I` (Content-Type: application/pdf, real file sizes 1–24MB; the 404 variants return `text/html` at 3,224 bytes, easily distinguished from a soft-404):

| FY | Filename | Status |
|----|----------|--------|
| 2000 | `cafr2000.pdf` | 200, downloads (23.9MB) — pdftotext fails (damaged xref) |
| 2001 | `cafr2001.pdf` | 200 (22.8MB) — not extraction-tested (same corrupted-era pattern as 2000/2002, deferred) |
| 2002 | `cafr2002.pdf` | 200, downloads (16.5MB, confirmed genuine PDF v1.3 via `file`) — pdftotext fails (damaged xref, both `-table` and plain modes) |
| 2003 | `cafr2003.pdf` | 200 — **clean, tied** (bookend) |
| 2004 | `cafr2004.pdf` | 200 — clean (GENERAL FUND statement present) |
| 2005 | `cafr2005.pdf` | 200 — clean (GENERAL FUND statement present) |
| 2006 | `cafr2006.pdf` | 200 — not extraction-tested (same naming era as 2005/2007) |
| 2007 | `cafr2007.pdf` | 200 — not extraction-tested |
| 2008 | `cafr2008.pdf` | 200 — not extraction-tested |
| 2009 | `cafr2009.pdf` | 200 — not extraction-tested |
| 2010 | `cafr2010.pdf` | 200 — **clean, spot-confirmed** (GENERAL FUND statement present, `-table` extracts) |
| 2011 | `cafr2011.pdf` | 200 — not extraction-tested |
| 2012 | `cafr2012.pdf` | 200 — not extraction-tested |
| 2013 | `2013cafr.pdf` | 200 — not extraction-tested (filename convention flips here) |
| 2014 | `2014cafr.pdf` | 200 — not extraction-tested |
| 2015 | `2015cafr.pdf` | 200 — **clean, spot-confirmed** (GENERAL FUND statement present, `-table` extracts) |
| 2016 | `2016cafr.pdf` | 200 — not extraction-tested |
| 2017 | `2017cafr.pdf` | 200 — not extraction-tested |
| 2018 | `cafr2018.pdf` | 200 — not extraction-tested (flips back) |
| 2019 | `cafr2019.pdf` | 200 — not extraction-tested |
| 2020 | `2020cafr.pdf` | 200 — **clean, tied** (bookend) |
| 2021–2024 | `fye-{YYYY}-state-of-florida-annual-comprehensive-financial-report.pdf` | already loaded (Phase 100/104), unchanged |

**Note for Phase 122:** the filename convention has **no single rule** — it alternates between `cafr{YYYY}.pdf` and `{YYYY}cafr.pdf` year to year with no discernible pattern (confirmed empirically, not guessed). Phase 122 must probe each year's actual filename (both variants) rather than assume a formula, exactly as this recon did. All filenames above were positively confirmed via `curl -I` (Content-Type: application/pdf), not assumed.

---

## Consolidated deepening gap log

| Target | FY | Issue | Disposition |
|--------|----|----|-------------|
| CA | ≤FY2001 (all variants: `cafrNN.pdf`, `cafrNNweb.pdf`, `{YYYY}_cafrNN.pdf`) | Every naming variant tried returns the known SCO soft-404 (HTTP 200, `Content-Type: text/html`, exactly 11,561 bytes) | Durable floor confirmed at FY2002 — no deeper extension exists at any predictable URL within the recon budget. Excluded per D-06 (soft-404 ≠ a real document, never mistaken for one here — every candidate was Content-Type-validated). |
| NY | ≤FY2002 | `comprehensive-annual-financial-report-2002.pdf` and earlier all return an honest HTTP 404; independently corroborated by OSC's own `/reports/finance` listing page, which itself only enumerates ACFRs back to FY2003 (no broken/older links present at all) | FY2003 is the genuine durable floor — re-confirmed 2026-07-03, matches the 103-DEEPEN-SOURCES.md v2.12 finding exactly. No further work possible within budget. |
| FL | FY2000–FY2002 | Real, durable PDF URLs exist (200 OK, `Content-Type: application/pdf`, `file` confirms genuine PDF v1.3, sizes 16.5–23.9MB) but `pdftotext` fails on all three ("Couldn't read xref table" / "damaged" even after `-table`-off plain-mode retry) | **Not** an unavailable hole (D-06 is about durability, not extractability) — a **light-cleanup / repair candidate** for Phase 122 (e.g. `qpdf --qdf --replace-input` repair, or an alternate PDF reconstruction pass). Pre-GASB-34 layout status for these 3 years is unconfirmed pending repair. |
| TX | ≤FY2014 | No durable per-year URL for the full statewide ACFR located within the recon budget. Two candidate patterns ruled out: (a) `.../comprehensive-annual-financial/{YYYY}/96-471.pdf` and `.../docs/96-471.pdf` both 404 for FY2010–2014; (b) `.../annual-financial/{YYYY}/96-542.pdf` resolves (200) back to FY2015 but is a **different, single-agency report** (the Comptroller's own agency-level Annual Financial Report, not the statewide ACFR with the General Revenue Fund statement) — confirmed by reading its title page, rejected as not fit for purpose. | TX's public online transparency archive for the statewide comprehensive-annual-financial report begins at FY2015 within what this recon could locate. Gap-logged; no further work possible within budget. |

---

## Phase 122 one-line-per-target load statement

- **CA:** Phase 122 can load **6 additional clean FYs (FY2002–FY2007)**, extending the window to **FY2002–FY2025 (24yr, the full available public archive)** — `cafr06.pdf`/`cafr07.pdf` (no "web") for FY2006–2007, `{YYYY}_cafr{NN}.pdf` for FY2002–2005. No pre-GASB-34 flag needed (FY2002 is the GASB-34 boundary year itself, already in modern layout).
- **NY:** **0 additional FYs** — FY2003 stays the durable floor; nothing for Phase 122 to add below the current window.
- **FL:** Phase 122 can load **up to 18 additional clean FYs (FY2003–FY2020)**, extending the window to **FY2003–FY2024 (22yr)** — per-year filename map above (no single formula, probe both `cafr{YYYY}.pdf`/`{YYYY}cafr.pdf` per year). FY2000–FY2002 remain a documented repair-pending hole (durable URL exists, extraction currently fails) — optional further recovery if Phase 122 wants to attempt a PDF repair pass.
- **TX:** **0 additional FYs** below FY2015; the FY2016 within-window file-id gap is **reconfirmed already closed** (Phase 99-01, still live 2026-07-03) — window stays FY2015–FY2024 contiguous (10yr).

**Existing CA/NY/FL/TX ACFR rows are untouched by this recon** (documentation only, no DB writes, no loader code changes). **$0 spend** — `curl` (network fetch) + `pdftotext` (poppler, local) only, no AI calls.
