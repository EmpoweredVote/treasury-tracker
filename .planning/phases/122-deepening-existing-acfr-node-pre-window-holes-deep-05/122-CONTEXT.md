# Phase 122: Deepening — Existing ACFR Node Pre-window Holes (DEEP-05) - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning
**Source:** Derived inline from Phase 117 recon (`117-DEEPEN-SOURCES.md`, RECON-11 DEEP-05 half) — the recon IS the locked research/decision set for this phase. No discuss-phase run; all four targets were probed live 2026-07-03 with bookend ties confirmed via `pdftotext -table`, $0 spend.

<domain>
## Phase Boundary

Recover the recorded pre-window history on the **existing** CA / NY / FL / TX State-ACFR nodes — dig **below each node's actual current window** as deep as durable, tie-able public URLs allow. This phase extends four already-built pilot loaders (`processCA.js` + `processCARevenueAcfr.js`, `processFLAcfr.js` + `processFLRevenueAcfr.js`); it does **not** create new states, new loaders, or touch the 46 batch-loaded ACFR nodes. NY and TX yield 0 recoverable years — their contribution is an honest, documented durable-floor record, not a load.

**In scope:** CA FY2002–FY2007 (6 clean yrs), FL FY2003–FY2020 (up to 18 clean yrs), NY/TX honest-floor documentation, whole-phase idempotency + 0-residue + cohort-untouched verification.
**Out of scope:** the 46 batch ACFR nodes, NASBO retirement (Phase 123), FY1980s–1990s deep archives, CA ≤FY2001 / NY ≤FY2002 / TX ≤FY2014 (no durable tie-able URL — honest holes), FL FY2000–FY2002 (durable URL exists but xref-corrupted; optional repair attempt only).
</domain>

<decisions>
## Implementation Decisions

### D-01 — CA target + window extension
Upgrade the existing **California** state node `e1007bf5-bac9-4b1c-878e-f6834885f850` **in place**. Add **FY2002–FY2007 (6 clean years)** to `scripts/processCA.js` (operating) and `scripts/processCARevenueAcfr.js` (revenue), extending the window from FY2008–FY2025 to **FY2002–FY2025 (the full available public archive)**. CA stores **full dollars** (no `UNITS` constant — printed ACFR thousands are ×1,000 by hand at transcription, exactly as FY2008–FY2025 already are). Both bookend tie targets are the **printed GENERAL column** figures: FY2002 Total revenues **$63,942,875K** (→ store `63_942_875_000`), FY2007 Total revenues **$96,309,497K**.

### D-02 — Dig below the actual current window, no hard FY floor (premise correction)
The ROADMAP phase text ("CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016") is **stale v2.11 language**; Phase 104 (v2.12) already deepened three of the four and Phase 99-01 resolved the fourth. Recon-verified **actual current windows**: CA FY2008–FY2025, NY FY2003–FY2024, FL FY2021–FY2024, TX FY2015–FY2024. This phase digs **below those actual windows**, not the stale text. Recording this correction in the SUMMARY is a Rule-1-class deviation already resolved by recon.

### D-03 — CA URL patterns + no pre-GASB-34 flag
CA new-year URLs (all under `https://www.sco.ca.gov/Files-ARD/CAFR/`): FY2006–2007 = `cafr{NN}.pdf` (**no** "web" suffix); FY2002–2005 = `{YYYY}_cafr{NN}.pdf` (year-prefixed, e.g. `2002_cafr02.pdf`). **No pre-GASB-34 flag needed** — FY2002 IS the GASB-34 first year (already the modern "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds", column header "General", identical shape to FY2008+). No dig crosses below FY2002.

### D-04 — FL target + window extension + per-year filename map
Upgrade the existing **Florida** state node `adb19ea0-de7c-4cd5-9445-cbf2108a8a1a` **in place**. Add **up to FY2003–FY2020 (18 clean years)** to `scripts/processFLAcfr.js` (operating) and `scripts/processFLRevenueAcfr.js` (revenue), extending FY2021–FY2024 to **FY2003–FY2024 (22yr)**. FL uses **`UNITS = 1_000`** (data objects hold raw thousands; ×1,000 → dollars, unchanged from existing FL years). Bookend ties (printed GENERAL FUND column): FY2003 Total revenues **$19,857,818K** (→ data object `19_857_818`), FY2020 **$40,534,343K**. FL filenames alternate `cafr{YYYY}.pdf` ↔ `{YYYY}cafr.pdf` **with no single rule** (all under `https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/`) — the loader must use the **per-year filename map** from `117-DEEPEN-SOURCES.md`, probing both variants per year (never guessing a formula). Content-Type `application/pdf` distinguishes a real file from the 3,224-byte HTML soft-404.

### D-05 — NY: 0 recoverable years, honest floor
NY node `1a7f871c-7f2e-4786-9c55-5ab3409716f4` stays **FY2003–FY2024, no code change**. FY2003 is the genuine durable floor — `comprehensive-annual-financial-report-2002.pdf` and earlier return honest 404s, and OSC's own `/reports/finance` listing only enumerates back to FY2003. Document the floor honestly in the LOADLOG; do not fake or partially-transcribe.

### D-06 — TX: 0 recoverable years, honest floor
TX node (resolved by name/state/entity_type; FY-end **Aug 31**) stays **FY2015–FY2024 contiguous, no code change**. FY2015 is the durable floor within recon budget; the FY2016 within-window file-id gap was closed in Phase 99-01 and re-confirmed live 200 on 2026-07-03. `≤FY2014` has no durable statewide-ACFR URL (the `96-542.pdf` candidate is a different single-agency report, rejected). Document honestly in the LOADLOG.

### D-07 — Bookend tie discipline + extraction method
Every added year must tie its transcribed GF categories to the **printed GENERAL / GENERAL FUND column total** for both revenues and expenditures — the loaders' `validate()` refuses to write on a mismatch (>$10M → `process.exit(2)`); bookends were recon-confirmed at exact $0. Extraction = `pdftotext -table` (NOT `-layout`) on local PDF copies in gitignored `_acfr-tmp/ca/` and `_acfr-tmp/fl/`, isolating the 1st ("General") numeric column via `_acfr-work/extract_gf.py`. Reuse `scripts/pre34Extract.mjs` **only** if a dig crosses below the GASB-34 boundary — **not needed** for the CA FY2002+ / FL FY2003+ clean blocks (all post-GASB-34, modern layout).

### D-08 — Idempotent never-overwrite + P2 clamp
Extending an existing loader is idempotent by construction: the `treasury_sync_budget_tree` RPC is keyed `(data_source_id, fy, dataset_type)` and each loader upserts **exactly one persistent `data_sources` row per `dataset_id`** (ca-acfr-gf-operating / -revenue, fl-acfr-gf-operating / -revenue) — extending the year list updates the same row, creating no new/orphan rows, so **LOAD-01 (0 residue)** holds trivially. A second live run of any FY = 0 net change. Negative GF lines (e.g. CA market-loss investment income in FY2003/FY2009-class years; FL "Investment earnings (losses)") render via the existing `clampForRender` P2 path (slice→0, signed magnitude in label, parent nets) — check every added year, not just bookends. Existing FY2008+/FY2021+ rows and all 46 batch ACFR nodes are untouched.

### D-09 — Honest holes documented, not faked
Any year that 404s, won't tie, or won't extract is **omitted and logged** with its reason, never faked or estimated. Documented durable floors / repair-pending holes: CA ≤FY2001 (SCO soft-404, all naming variants); NY ≤FY2002 (honest 404); FL FY2000–FY2002 (durable `application/pdf` URLs exist but `pdftotext` fails on damaged xref — a **repair candidate**, e.g. `qpdf --qdf --replace-input`, optional for this phase; pre-GASB-34 layout status unconfirmed pending repair); TX ≤FY2014 (no durable statewide-ACFR URL). Success criterion 3 requires these be surfaced, not silently dropped.

### Claude's Discretion
- Exact per-year category name normalization (use verbatim ACFR function/source names as the existing years do).
- Whether to attempt the optional FL FY2000–FY2002 `qpdf` repair pass within this phase or defer it as a logged hole (default: log as repair-pending, attempt only if cheap).
- Number of plan files and wave layout (planned: CA + FL in parallel wave 1, verification/doc in wave 2).
- Order of FY transcription within a target.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recon / source-of-truth (do NOT re-research — recon already probed live)
- `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-DEEPEN-SOURCES.md` — the DEEP-05 recon: per-target windows, new old-ends, bookend tie evidence, CA + FL per-year URL/filename maps, consolidated gap log, one-line-per-target load statement.
- `.planning/REQUIREMENTS.md` — DEEP-05 requirement + milestone-wide standing acceptance criteria (LOAD-01, honest-hole, idempotency).
- `.planning/ROADMAP.md` — Phase 122 goal + success criteria (note the stale-window premise correction in D-02).

### Loaders to extend (read the existing shape before editing)
- `scripts/processCA.js` — CA GF operating loader (full-dollar values, no UNITS, `SOURCES` map + `EXPENDITURES` object + hardcoded `years` array in `main()`).
- `scripts/processCARevenueAcfr.js` — CA GF revenue loader (P2 clamp already wired).
- `scripts/processFLAcfr.js` — FL GF operating loader (`UNITS = 1_000`, per-FY `SOURCES`, `EXPENDITURES` in raw thousands).
- `scripts/processFLRevenueAcfr.js` — FL GF revenue loader (P2 clamp wired; FY2021/FY2022 negative investment-earnings precedent).

### Tooling
- `_acfr-work/extract_gf.py` — position-anchored GENERAL-column extractor (1st numeric column).
- `scripts/pre34Extract.mjs` — pre-GASB-34 extractor (reference only; NOT needed for CA FY2002+/FL FY2003+).
</canonical_refs>

<specifics>
## Specific Ideas

- **CA load statement:** +FY2002–FY2007 (6) → FY2002–FY2025. `cafr06.pdf`/`cafr07.pdf` (no "web") for FY2006–07; `{YYYY}_cafr{NN}.pdf` for FY2002–05. Full-dollar storage. No pre-GASB-34 flag.
- **FL load statement:** +FY2003–FY2020 (up to 18) → FY2003–FY2024. Per-year filename map (probe both `cafr{YYYY}.pdf` / `{YYYY}cafr.pdf`). Raw-thousands + UNITS=1000. FY2000–FY2002 repair-pending hole (optional).
- **NY / TX:** 0 new years — honest floor record only, no code change.
- Local PDF workdirs `_acfr-tmp/ca/`, `_acfr-tmp/fl/` are already gitignored (as is `_acfr-work/`).
- Soft-404 guard: `%PDF` magic + Content-Type `application/pdf` + real size; the SCO soft-404 is HTTP-200 `text/html` (11,561 bytes for CA), FL's is 3,224-byte `text/html`.
</specifics>

<deferred>
## Deferred Ideas

- FL FY2000–FY2002 PDF-repair recovery (durable URL exists, xref damaged) — attempt only if a `qpdf`/reconstruction pass is cheap; otherwise log as repair-pending hole.
- CA / NY / TX deep archives below their recon-confirmed durable floors (no durable tie-able URL within recon budget) — permanent honest holes, not future work.
- NASBO retirement to fallback-only — Phase 123 (NASBORT-01), out of scope here.
- Blind re-derivation + 50-state cohort audit + Chris UAT — Phase 124 (VER-09 / VER-10).
</deferred>

---

*Phase: 122-deepening-existing-acfr-node-pre-window-holes-deep-05*
*Context derived 2026-07-05 inline from Phase 117 DEEP-05 recon (no discuss-phase; recon is the locked decision set)*
