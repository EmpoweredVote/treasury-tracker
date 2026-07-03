# Phase 115 Research — Deepening: Recoverable Holes + Pre-GASB-34 Extractor

**Researched:** 2026-07-03 (inline, this session — no researcher subagent per project feedback)
**Phase requirement IDs:** DEEP-02, DEEP-03, DEEP-04

## RESEARCH COMPLETE

---

## 1. The gap inventory (verified against v2.13 loadlogs, archived under `.planning/milestones/v2.13-phases/`)

| Target | Years | Source of record | Verified state |
|--------|-------|------------------|----------------|
| MA modern holes | FY2001, 2002, 2004, 2005, 2014, 2021 (6) | `108-02-MA-LOADLOG.md` (post-generalization UPDATE: 19 loaded FY2003–2025, 6 holes) | PDFs + pdftotext txt **already cached** in `_acfr-work/ma/` (MA2001–MA2025, 25 files) |
| CT FY2006 | 1 year | `109-02-CT-LOADLOG.md` | `CT2006.pdf` cached (4.8MB) — scanned, **no text layer** (`CT2006.txt` = 164 bytes). OCR-only. |
| NJ pre-FY2020 | FY2002–FY2019 candidates | `108-01-NJ-LOADLOG.md` §deferred | Landing `nj.gov/treasury/omb/fr.shtml`; probed HEAD 200 OK: `19fr/NJFR2019 Complete.pdf` (10.0MB), `18fr/FR 2018 Secured Final.pdf` (8.7MB), `10fr/pdf/fullfr2010.pdf` (12.1MB). Era-varying names — enumerate from landing page. |
| CT pre-GASB-34 | FY1988–FY2001 (14) | `109-02-CT-LOADLOG.md` | PDFs + txt **already cached** in `_acfr-work/ct/` (CT1988+). URLs: `osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY{YYYY}.pdf` |
| WI pre-GASB-34 | FY2000–FY2001 (2) | `109-03-WI-LOADLOG.md` | PDFs + txt **already cached** in `_acfr-work/wi/` (WI2000, WI2001). Pre-FY2000 = 4-section multi-file era, **out of scope** (per 109 plan). |

## 2. Loader architecture — these are RUNTIME-EXTRACTION loaders, not embedded-data

Unlike the Phase 113/114 generated loaders (embedded `EXPENDITURES`/`REVENUE` maps), the four Phase 108/109 loaders (`processMAAcfr.js`, `processCTAcfr.js`, `processNJAcfr.js`, `processWIAcfr.js` + Revenue twins) download the PDF, run `pdftotext -table`, and **parse at run time** (MA via `scripts/maAcfrExtract.mjs` token-order + positional variants; CT/WI/NJ via in-file parsers). Deepening therefore means:
- **extending per-year URL maps** (CT/WI `SRC = {}` maps; MA `urlFor()` pattern; NJ needs a new pre-2020 URL map), and
- **extending/fixing extractors** for the failing year formats.

Re-running a full loader re-loads all years idempotently (RPC `treasury_sync_budget_tree` keyed on (muni, fy, dataset_type)) — existing modern rows are re-written in place with identical data, satisfying "existing modern-era rows untouched" as long as extraction for those years is unchanged. **Safer contract for this phase: run deepening loads per-`--fy` for only the new years** so modern rows are provably untouched (DB row-count + spot-hash before/after).

Key loader facts:
- MA: `UNITS=1_000`, `TOL=5`, URL `macomptroller.org/wp-content/uploads/acfr_fy-{YYYY}.pdf` (FY2017 `acfr_fy2017.pdf`) — pattern resolves ALL of FY2001–FY2025.
- CT: `UNITS=1_000`, per-year `SRC` map, browser UA required constant already present.
- NJ: **`UNITS=1` — DOLLARS, the only non-thousands state.** Node resolution by name/state/entity_type.
- WI: `UNITS=1_000`, three URL path families documented in 109-03 loadlog.
- All four predate Phase 114's WR-01/WR-05/WR-06 hardening (`parseArgs strict:false` etc.). Fix-while-touching is in scope ONLY for files a plan already modifies; no fleet-wide sweep (that's a REVIEW concern, not DEEP).
- Phase 111's ephemeral `data_sources` lifecycle IS already present in all four (all-35-loader fix).

## 3. Pre-GASB-34 statement structure (DEEP-02) — confirmed extractable

Verified in cached text (`_acfr-work/ct/CT1995.txt` line 2513; `_acfr-work/wi/WI2000.txt` line 1426):
- Statement title: **"Combined Statement of Revenues, Expenditures, and Changes in Fund Balances — All Governmental Fund Types (and Expendable Trust Funds)"** — structurally different from the modern Governmental Funds statement.
- **General (Fund) is column 1** in both states; amounts in thousands; `pdftotext -table` output is clean (not scanned) for all cached CT 1988–2001 and WI 2000–2001 files.
- CAUTION: the same pre-34 CAFRs contain OTHER "Combined Statement of Revenues…" variants (Higher Education/University Hospital funds — seen at CT1995.txt:198; proprietary funds). The extractor MUST anchor on the "All Governmental Fund Types" title line, not the first "Combined Statement" match.
- Column lineups vary by year (CT1995: General | Special Revenue | Debt Service | Capital Projects; WI2000 adds Expendable Trust + Memorandum-Only Totals) — anchor on General = 1st numeric column, same principle as the modern extractor.
- Totals rows present ("Total Revenues", "Total Expenditures") → same tie-gate discipline (every loaded FY ties to printed General column total or is skipped as an honest hole).

**Extractor placement:** committed `scripts/pre34Extract.mjs` (mirroring committed `scripts/maAcfrExtract.mjs` — NOT in gitignored `_acfr-work/`), consumed by the CT/WI loaders for pre-34 years.

**Basis label (success criterion 1):** the app surfaces `budgets.data_source` text per row. Modern rows: `"{State} State ACFR — General Fund (FY{fy} actual, GAAP basis)"`. Pre-34 rows MUST carry a distinct honest label, e.g. `"{State} State CAFR — General Fund (FY{fy} actual, pre-GASB-34 combined statement basis)"` — visibly different alongside GAAP-labelled years in the same series. No frontend change needed.

## 4. CT FY2006 OCR path (DEEP-03) — free tooling confirmed installed

- `pdftoppm` (Poppler 25.07, winget) on PATH; **Tesseract 5.4 installed at `C:\Program Files\Tesseract-OCR\tesseract.exe`** (NOT on PATH — invoke by full path or add for session).
- Approach: locate the Governmental Funds statement pages (CT2006 follows the FY2005/FY2007 layout — statement sits in the basic financial statements section; nearby years' page numbers give a search window), `pdftoppm -r 300 -png -f <p> -l <p>`, `tesseract <img> stdout`, transcribe the General Fund column, tie to printed totals. OCR digit errors are the risk — the $0/±TOL tie gate is the defense: if the transcription doesn't tie, iterate on OCR quality (400dpi, `--psm 6`) or document unrecoverable.
- FY2006 is GASB-34-era (modern statement format, GAAP basis label — NOT pre-34).

## 5. NJ pre-FY2020 (DEEP-03)

- Names shift by era: `{YY}fr/NJFR{YYYY} Complete.pdf` (2019), `{YY}fr/FR {YYYY} Secured Final.pdf` (2018), `{YY}fr/pdf/fullfr{YYYY}.pdf` (~2002–2017). Enumerate exact URLs from `fr.shtml` landing page — never derive blindly (per project memory: recon URL details unreliable; enumerate at load).
- NJ adopted GASB-34 around FY2002–FY2003; the executor must detect the statement format per year and STOP at the boundary — pre-34 NJ years are NOT in scope (DEEP-03 is modern-era; DEEP-04 names only CT/WI).
- NJ dollars units (UNITS=1) — verify each deep year's statement units note ("(In Thousands)" vs dollars); if a pre-2020 era is in thousands, that era needs a per-year units override. TREAT AS OPEN QUESTION for the executor with a hard tie gate: a 1000× units error cannot tie to the printed total AND per-capita sanity (~$2k–$8k/person) catches it.

## 6. Idempotency / never-overwrite contract (success criterion 4)

- Deepening loads run per-`--fy` for new years only. Before/after DB assertions: (a) modern-era row count and a spot year's `total_budget` unchanged; (b) re-run of one deepened FY = 0 net change; (c) 0 `data_sources` residue for the four states' dataset_ids (ephemeral lifecycle).
- MA note: `processMAAcfr.js` skips non-tying years automatically (hole-tolerant loop) — full-run behavior is safe, but per-FY runs still preferred for provability.

## 7. Cost / safety

- $0 spend: free state PDFs (already mostly cached), pdftotext/pdftoppm/tesseract all free local tools, Supabase writes. No paid AI APIs anywhere in this phase.
- BigQuery: NOT involved (Utah BQ cost incident does not apply — no UT in this phase).

## Validation Architecture

- **No test framework** — this project's loaders self-validate: every loader run (dry or live) executes per-FY tie gates (category sum vs printed General Fund total, tolerance ≤ TOL or skip-as-hole/exit-2).
- **Quick check (per task commit):** affected loader `--dry-run --fy <year>` prints a PASS tie for each newly recovered year.
- **Full check (per plan):** full-loader `--dry-run` exits 0 with all loaded years tying; live per-FY loads verified by read-only DB selects (row present, total matches, basis label correct, modern rows untouched, 0 data_sources residue).
- **Phase gate (pre-verify-work):** all four states' loaders `--dry-run` exit 0; DB cohort spot-check (one untouched 113/114 state) unchanged.
- Automated commands are per-loader node invocations; no Wave-0 infrastructure install needed.

---
*Phase: 115 — researched inline 2026-07-03*
