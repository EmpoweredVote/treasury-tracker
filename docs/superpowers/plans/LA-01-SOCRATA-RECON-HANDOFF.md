# LA-01 — Los Angeles City: reconcile Socrata against an audited ACFR (DRIVING DOC)

**Created:** 2026-08-20, at Chris's request, to be worked unattended overnight.
**Status:** IN PROGRESS — see §7 Running log for where I actually am.
**Branch:** create `fix/la-city-series` off `main` (do NOT work on `main`).

> **Read this file first if you are a fresh session.** It is written to be
> self-sufficient after a `/clear`. Everything needed to resume is here.

---

## 1. Why this exists

Chris, during AUSTIN-TRAVIS-01 UAT: *"I want to highly prioritize the Los Angeles
experience, which still feels broken."* He is right, and SCOPE-03's claim to have
"fixed LA" is true but narrow — it made LA's series *reachable*; the data
underneath is fragmented.

**He chose the cheapest first probe:** reconcile the Socrata source against ONE
audited LA ACFR year, before committing to a full reload.

---

## 2. What is actually wrong with LA City

`municipality_id = 391bf791-1c1f-424f-a7a5-1b698c79093f` (Los Angeles, CA, city,
pop 3,878,704). Its Money In / Money Out history is stitched from five sources
across three series:

| Fiscal years | Source | Series | Rows |
|---|---|---|---|
| FY2003–FY2020 | `CA State Controller - Expenditures` / `- Revenues` | `all_funds / actual / unknown` ✅ | 36 |
| FY2021–FY2025 | `Socrata: https://data.lacity.org` | `unknown / unknown / unknown` | 9 |
| FY2025 revenue | `LA City Revenue (ACFR)` | `unknown / unknown / unknown` | 1 |
| FY2026 operating | `LA City Budget & Expenditures` | `unknown / unknown / unknown` | 1 |

**Five distinct defects, worst first:**

1. **The series is SEVERED at FY2020/FY2021.** The only classified series ends
   FY2020. SCOPE-03 correctly refuses to mix series, so a reader sees FY2003–2020
   *or* FY2021–2026, never a continuous LA. That is the "feels broken".
2. **FY2025 mixes two sources inside one year** — operating from Socrata
   ($25.06B), revenue from the ACFR ($23.46B). Different documents, presented as
   one year's in-vs-out. Subtracting them is the exact error the SCOPE arc exists
   to prevent, and both are `unknown` so nothing flags it.
3. **FY2026 is an ADOPTED budget in the actuals lane** — `LA City Budget &
   Expenditures`, $28.92B, operating only, no revenue. The Long Beach −75% seam
   pattern.
4. **All 11 FY2021+ rows have `source_url = NULL` and `source_date = NULL`.** No
   citation whatsoever, against this project's always-sourced rule.
5. **A half-finished migration.** Memory (`project_la_city_revenue_acfr_sourced`)
   records the intent *"LA City Money In = ACFR GAAP, not Socrata"*, but only
   FY2025 revenue ever moved.

### The stored Socrata figures (the numbers to reconcile against)

| FY | operating | revenue |
|---|---|---|
| 2021 | $16.17B | $17.56B |
| 2022 | $17.45B | $19.28B |
| **2023** | **$18.16B** | **$21.14B** |
| 2024 | $19.97B | $21.61B |
| 2025 | $25.06B | $23.46B ← ACFR, not Socrata |

For continuity context, the CA SCO `all_funds` series ends FY2020 at
**$16.99B operating / $17.08B revenue** — i.e. Socrata FY2021 ($16.17B/$17.56B)
sits in the *same magnitude band*, which is the basis of the hypothesis below.

---

## 3. The hypothesis to test

**H1: Socrata's LA figures are ALL FUNDS actuals** — the same scope as the CA SCO
series they continue, in which case classifying the Socrata source
`all_funds / actual` rejoins the severed series and fixes defect 1 cheaply.

Competing possibilities that must be ruled out, not assumed:

- **H2: total governmental only** — then it is NOT continuous with the SCO
  all-funds series and joining them would create a fake step change.
- **H3: an adopted budget, not actuals** — Socrata is a city open-data portal and
  may serve budget rather than audited actuals. If so it must be `adopted`, and
  the "continuous history" idea dies.
- **H4: it reconciles to nothing** — no combination of ACFR columns reproduces
  it. Then the honest outcome is to leave it `unknown` and plan a real ACFR load.

⚠ **Do not let the magnitude coincidence in §2 substitute for a reconciliation.**
LA has enormous proprietary funds (LADWP, LAWA/airport, Harbor), so several
different scope combinations land in the high teens of billions.

---

## 4. The probe

**Year: FY2023.** Chosen because the stored Socrata figures exist for it AND the
audited ACFR is directly fetchable.

**Source, verified reachable 2026-08-20:**
- `https://controller.lacity.gov/acfr23.pdf` → **HTTP 200, 16,780,245 bytes**
- `https://controller.lacity.gov/acfr22.pdf` → **HTTP 200, 17,516,950 bytes** (backup/second probe)
- ⚠ `acfr24.pdf` and `acfr25.pdf` are **404** — FY24/25 live under a different
  path; find them from `https://controller.lacity.gov/reports` if needed.
- LA City fiscal year ends **June 30** (so `fiscal_year_start_month` = 7).

**Method — reuse what already exists, do not write a new extractor:**

1. Fetch `acfr23.pdf` into `_acfr-work/la/` (gitignored).
2. `python scripts/acfrPrintedTotal.py <pdf>` — pdfplumber coordinate reader,
   independent of `pdftotext -table`. Gives every printed fund column on the
   `Total revenues` / `Total expenditures` rows of the governmental-funds
   statement. Use `--page N` to skip the slow page search once the page is known.
3. `python scripts/acfrContinuedTotal.py <pdf> --page N` if LA splits its fund
   columns across two pages (it likely does — it has six-plus major funds).
4. For an ALL-FUNDS comparison the governmental-funds statement is **not enough** —
   proprietary funds (LADWP, Harbor, Airport) are in the *Statement of Revenues,
   Expenses and Changes in Net Position*. Read that too and sum
   governmental + proprietary. This is the CA-CITIES-01 method: see
   `docs/superpowers/plans/CA-CITIES-01-RECON.md` §for how Modesto was decomposed
   (`ACFR Total Governmental + SCO enterprise & ISF = SCO total`, tied to the
   dollar) — that is the template for proving an all-funds figure.
5. Compare each candidate against the stored Socrata $18.16B / $21.14B and record
   the percentage gap for EVERY candidate, not just the winner.

**Decision rule — write it down before looking:**

| Outcome | Action |
|---|---|
| A candidate ties to the dollar, or within ~0.5% with a decomposable residue | Classify the Socrata source on that evidence; write `LA-01-RECON.md`; add registry entries; re-run `classifyFundScope.mjs` + `stampBudgetAxes.mjs` |
| Best candidate is off by >2% with no decomposition | **STOP.** Leave `unknown`, write up the failure, recommend the ACFR load path |
| Socrata looks like a budget, not actuals | Classify `basis: adopted` (which is itself valuable — it stops it charting as actuals) and report that continuity is impossible |

---

## 5. Guardrails for unattended work

- ✅ May fetch documents, extract, reconcile, write docs, write registry entries,
  create the branch, commit, run all gates.
- ✅ May apply a DB classification **only if** the reconciliation ties per the
  decision rule above. The registry is evidence-gated by design; if there is no
  evidence, there is no entry, and nothing gets stamped.
- 🛑 **Do NOT** reload, delete or overwrite any LA budget row. No `bulkLoad*`, no
  `treasury_sync_*` against LA.
- 🛑 **Do NOT** touch the FY2025 mixed pair or the FY2026 adopted row yet — they
  are separate decisions Chris has not made.
- 🛑 **Do NOT** merge to `main`. `main` is branch-protected on the `build` check;
  open a PR and leave it for review.
- Every DB write must be preceded by a dry run and followed by a verify pass.

---

## 6. Useful facts (do not rediscover these)

- `scripts/acfrPrintedTotal.py` — pdfplumber oracle. Handles dot-leader-shredded
  digits, split number fragments, `Net Revenues` as a subtotal label. `--page N`
  skips the slow search.
- `scripts/acfrContinuedTotal.py` — recovers the `Total` column when it is carried
  onto a label-less continued page, via a self-validating additive identity.
- `scripts/reconcileAcfrGfScope.mjs` — the batch harness; its `fetchPdf` falls
  back fetch → curl → PowerShell (needed for hosts with broken TLS chains).
- Real Python is `C:\Users\Chris\AppData\Local\Python\pythoncore-3.14-64\python.exe`.
  `python` / `python3` / `py` on PATH are **Microsoft Store stubs that are not Python**.
- Registry files: `scripts/data/fundScopeRegistry.mjs`, `basisRegistry.mjs`,
  `reportingEntityRegistry.mjs`. Row-count gates in `scripts/classifyFundScope.mjs`
  (`EXPECTED_ROWS`) and `scripts/stampBudgetAxes.mjs` (`EXPECTED_BASIS_ROWS`,
  `EXPECTED_REPORTING_ENTITY_ROWS`). An entry with no evidence cannot classify.
- ⚠ Match patterns must be **anchored/enumerated**. `/ ACFR — General Fund/` looked
  reasonable and claimed 1,784 rows across families nobody had reconciled.
- ⚠ Paged Supabase reads must order by the **primary key last**, and PostgREST caps
  a response at 1000 rows — an unpaged `.limit()` silently returns a partial set.
- Gates: `npm test` (479 expected), `npm run build`, and
  `<real python> scripts/lib/acfrGF.selftest.py` (166 expected).

---

## 7. Running log

<!-- APPEND ONLY. Newest at the bottom. Keep this honest — including dead ends. -->

- **2026-08-20 ~05:0x** — Doc created. Confirmed the five defects in §2 against
  the live DB and API. Confirmed `acfr23.pdf` / `acfr22.pdf` return HTTP 200 and
  `acfr24/25.pdf` are 404. Nothing fetched or written yet. Next: create the
  branch, fetch `acfr23.pdf`, locate its governmental-funds statement page.

---

## 8. Open questions for Chris (do not guess these)

1. **If Socrata reconciles as all-funds actuals** — classify it and rejoin the
   series to FY2025, or still prefer a direct ACFR load for trustworthiness?
   (My recommendation: classify now for the immediate fix, ACFR load later.)
2. **FY2025's mixed pair** — operating from Socrata, revenue from the ACFR. Which
   source wins for that year? They should not stay mixed.
3. **FY2026's adopted operating row** — classify `adopted` so it stops reading as
   actuals, or withdraw it from the chart until a revenue counterpart exists?
4. **The 11 null `source_url`s** — acceptable to backfill with the dataset landing
   page (`https://data.lacity.org`), or does each row need a per-FY dataset URL
   the way AUSTIN-TRAVIS-01 did it?
