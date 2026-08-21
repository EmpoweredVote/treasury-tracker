# LA-01 — Los Angeles City: reconcile Socrata against an audited ACFR (DRIVING DOC)

**Created:** 2026-08-20, at Chris's request, to be worked unattended overnight.
**Status:** PROBE COMPLETE, SECOND YEAR RUN — **the §9 verdict DID NOT SURVIVE it.**
**The live verdict is §10. §9 is SUPERSEDED and must not be acted on.**
No DB write was made, and on this evidence none is warranted.
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

1. Fetch `acfr23.pdf` into `_acfr-work/la-city/` (gitignored).
   ⚠ **NOT `_acfr-work/la/` — that is LOUISIANA.** `_acfr-work/` is keyed by STATE
   code and `la/` already holds the Louisiana state ACFR corpus (LA2002–LA2025 from
   `doa.la.gov`, with `HEALTH & WELFARE` / `CORRECTIONS` / `MILITARY & VETERANS`
   categories). I nearly built on it as if it were Los Angeles. Use `la-city/`.
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

- **2026-08-20 ~18:4x** — SECOND-YEAR CONFIRMATION RUN, AND IT FAILED. §9 is
  SUPERSEDED by §10. Ruled out the ISF residue hypothesis outright (LA has NO
  internal service funds — "Internal Service" occurs 0 times in both the FY2023
  and FY2022 ACFRs). Found the line §9 missed (`Interest Income from Leases`
  17,016) which drives FY2023 revenue to a $5,077 residue — and then showed
  that this is FITTING, not scope identity: 7 of 128 subsets tie FY2023 revenue
  inside 0.5%, FY2022 is won by a DIFFERENT subset, and §9's formula misses
  FY2022 by +2.36%. Government-wide (zero fitting freedom) fails too, with the
  sign FLIPPING between years. Verdict: leave `unknown`. No DB write.
- **2026-08-20 ~05:2x** — PROBE DONE. Verdict in §9: **H1 confirmed, Socrata is
  `all_funds / actual`**, residues 0.080% (revenue) and 0.147% (expenditure) after
  decomposing non-operating revenue + capital contributions; nearest rival scope out
  by 45–51%. Stopped before any DB write. Trap avoided: `_acfr-work/la/` is
  LOUISIANA, not Los Angeles.
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

---

## 9. ~~VERDICT — H1 CONFIRMED. Socrata is ALL FUNDS ACTUALS.~~

> 🛑 **SUPERSEDED 2026-08-20 by §10. DO NOT ACT ON THIS SECTION.**
> Retained verbatim so the error stays auditable. Its FY2023 "tie" is one of
> SEVEN subset assemblies that land inside 0.5% in that year alone, and the
> very formula it endorses misses FY2022 by +2.36%. Kept as a record of how a
> fitted result can look decisive.

**Probe:** City of Los Angeles FY2023 ACFR, `https://controller.lacity.gov/acfr23.pdf`
(450pp, 16,780,245 bytes, "Year Ended June 30, 2023", amounts in **thousands**).
Governmental funds statement pp.63–64; proprietary funds statement pp.71–72.
Read with `scripts/acfrPrintedTotal.py` + `scripts/acfrContinuedTotal.py`
(pdfplumber coordinates), the `Total` column recovered by the additive identity
with exactly ONE candidate row on each side.

### The printed figures (thousands)

| | Revenue | Expenditure |
|---|---|---|
| General Fund | 6,744,996 | 5,999,543 |
| **Total Governmental** | **10,378,641** | **9,939,996** |
| Enterprise funds, operating | 9,854,989 | 8,195,396 |
| Enterprise investment income | 154,710 | — |
| Enterprise grant revenues | 119,074 | — |
| Enterprise capital contributions | 616,983 | — |

Enterprise columns sum exactly to their printed total:
`1,752,855 (Airports) + 656,400 (Harbor) + 4,958,539 (Power) + 1,661,278 (Water)
+ 775,945 + 49,972 = 9,854,989` ✓

### The reconciliation

**REVENUE** — governmental + enterprise operating + investment income + grants + capital contributions:
`10,378,641 + 9,854,989 + 154,710 + 119,074 + 616,983 = 21,124,397` (thousands)
= **$21,124,397,000** vs stored Socrata **$21,141,407,923**
→ residue **$17,010,923 = 0.080%**

**EXPENDITURE** — governmental + enterprise operating expenses:
`9,939,996 + 8,195,396 = 18,135,392` (thousands)
= **$18,135,392,000** vs stored Socrata **$18,162,091,478**
→ residue **$26,699,478 = 0.147%**

### Candidate scopes — the discrimination is not close

| Candidate | Revenue vs Socrata | Expenditure vs Socrata |
|---|---|---|
| `general_fund` | −68.1% | −67.0% |
| `total_governmental` | −50.9% | −45.3% |
| **`all_funds`** | **−0.080%** | **−0.147%** |

The nearest rival is out by 45–51%. This is well inside the precedent set by
`ca-sco-county-rev`, which was accepted as `all_funds` on a 0.547% residue with a
decomposed explanation while its alternatives sat at 15.87% and 67.04%.

### The unexplained remainder, stated honestly

Both residues are small, same-signed (Socrata slightly HIGHER on both sides) and
of similar magnitude ($17.0M / $26.7M). The most likely cause is **Internal
Service Funds**, which I did NOT locate in this pass — LA's proprietary statement
pp.71–72 carries enterprise columns only, with no ISF column, so its ISF activity
is presented elsewhere. That is the first thing to check before writing a registry
entry. ⚠ Note the asymmetry: revenue needs non-operating and capital
contributions added to reconcile, expenditure does not — the same shape as the
documented MA DLS trap where "revenue folds transfers in, expenditure doesn't,
so Money In − Money Out is NOT a surplus". **Do not present an LA surplus/deficit
from these two figures without settling that.**

### Consequence for the product

Socrata continues the CA State Controller series on the SAME scope
(`all_funds / actual`). SCO ends FY2020 at $16.99B/$17.08B and Socrata FY2021
opens at $16.17B/$17.56B — continuous, no step change. **So classifying the
Socrata source rejoins LA's severed history and fixes defect 1.**

### NOT DONE — deliberately stopped here

The task Chris set was the reconciliation, and it has a verdict. The DB write was
contingent on that verdict and is a separate step, not started:

1. Locate LA's Internal Service Funds and try to close the $17.0M / $26.7M
   residues (or record them as an accepted, decomposed remainder).
2. Confirm on a SECOND year (`acfr22.pdf` is already known-reachable, HTTP 200)
   before classifying 9 rows off one probe.
3. Then: registry entries for `Socrata: https://data.lacity.org`
   (`all_funds` / `actual`), row-count gates, dry run, stamp, verify.
4. Backfill the NULL `source_url` / `source_date` on the 11 FY2021+ rows.
5. Chris's §8 questions still stand — particularly whether he'd rather have a
   direct ACFR load than a classified portal feed.

---

## 10. VERDICT (LIVE) — H4. Socrata reconciles to NOTHING STABLE. Leave it `unknown`.

**Supersedes §9.** §9 classified on a single year. This section runs the second
year §9 itself said was mandatory ("Confirm on a SECOND year before classifying 9
rows off one probe"), plus a test §9 never ran — how many *other* assemblies fit
just as well. Both break it.

Probes: FY2023 `acfr23.pdf` (450pp) and FY2022 `acfr22.pdf` (434pp, 17,516,950
bytes as predicted). Every figure below is read off a **GAAP** statement by
pdfplumber glyph coordinates — page titles were verified to exclude the
`Budget and Actual (Non-GAAP Budgetary)` statement, which sits a page or two
later in both books and is a live trap.

### 10.1 The ISF hypothesis is dead — LA has no internal service funds

§9 guessed the residues were Internal Service Funds. They are not, and this is
not a failure to find them: the string `Internal Service` occurs **0 times** in
both ACFRs (FY2023 450pp, FY2022 434pp; extraction verified complete by form-feed
count, and re-scanned with `grep -a` after the first pass tripped grep's binary
heuristic — an absence proved by a grep that bailed early is worth nothing).
LA's MD&A says it plainly: *"the City's **six** enterprise funds"*. Proprietary
= enterprise, full stop.

### 10.2 The line §9 missed, and why it is a trap rather than a fix

§9 omitted `Interest Income from Leases` (FY2023: **17,016**). Adding it:

`10,378,641 + 9,854,989 + 154,710 + 17,016 + 119,074 + 616,983 = 21,141,413`
vs stored **21,141,407.923** → residue **$5,077 on $21.1B = 0.000024%**.

Six-significant-figure agreement. §9's 0.080% residue was simply this missing
line. It is extremely tempting and it is **not** evidence, because:

### 10.3 The fit test — the method has no discriminating power

Enumerating every subset of the optional nonoperating/capital components over the
base (governmental total + enterprise operating), against the stored figure:

| Year / side | base residue | subsets within 0.5% | best fit |
|---|---|---|---|
| FY2023 revenue | +4.2938% | **7 of 128** | −0.00002% (§9's + lease interest) |
| FY2023 expenditure | +0.1470% | **10 of 128** | +0.053% = base + *lease interest* |
| FY2022 revenue | +2.3623% | **5 of 64** | +0.085% = base + lease interest + other income net |
| FY2022 expenditure | +2.2575% | **6 of 64** | −0.076% = base + other income net + capital contributions + transfers out |

Three things kill the classification:

1. **No two year/side pairs agree on the winning assembly.** §9's FY2023 formula
   gives **+2.36%** on FY2022 — outside the STOP threshold in §4.
2. **Several best fits are accounting nonsense.** FY2023 expenditure's top fit
   adds *Interest Income from Leases* — a revenue — to expenditures. FY2022
   expenditure's adds capital contributions and transfers out.
3. **A sub-0.5% hit is guaranteed by construction.** Six or seven optional
   components spanning 17,016 to 1,162,020 generate subset sums that densely
   cover a ±1M band around an ~19M base. Hitting 0.5% is arithmetic, not scope
   identity. This is the tautology trap in a new costume — same family as the
   `total = Σ items` check and the "0/23,260 rows tie" green light.

### 10.4 The zero-degrees-of-freedom candidate also fails, and its sign flips

Government-wide Statement of Activities (primary government, full accrual) is a
single printed pair — nothing to assemble, so nothing to fit:

| | FY2023 | FY2022 |
|---|---|---|
| ACFR total expenses | 19,564,849 | 16,555,364 |
| Socrata operating | 18,162,091 | 17,447,659 |
| **Δ** | **−7.72%** | **+5.11%** |
| ACFR total revenues | 21,633,543 | 19,952,927 |
| Socrata revenue | 21,141,408 | 19,280,740 |
| **Δ** | **−2.33%** | **−3.49%** |

Socrata is 7.7% *below* government-wide expenses one year and 5.1% *above* the
next. A scope relationship cannot change sign. This is not a scope difference.

### 10.5 Full candidate table

| Candidate | FY2023 rev | FY2023 exp | FY2022 rev | FY2022 exp |
|---|---|---|---|---|
| `general_fund` | −68.1% | −67.0% | — | — |
| `total_governmental` | −50.9% | −45.3% | — | — |
| `all_funds` (gov + enterprise operating) | +4.29% | +0.15% | +2.36% | +2.26% |
| government-wide primary government | −2.33% | −7.72% | −3.49% | +5.11% |
| any fitted subset | ties | ties | ties | ties — *differently each time* |

Nothing is stable. Per the §4 decision rule — *"best candidate off by >2% with no
decomposition → STOP, leave `unknown`"* — **H4 is the outcome. Socrata stays
`unknown`. No registry entry, no stamp, no DB write.**

### 10.6 What Socrata probably is (hypothesis, NOT established)

Stored Socrata figures carry **cents** in FY2025 (`25,063,362,950.98`), so they
are transaction-level rollups out of LA's financial management system, not
statement figures. On the fund-statement base, Socrata is higher on **both** sides
in FY2022 (+2.36% / +2.26%) — the signature of **interfund activity that was
never eliminated**, which a raw ledger rollup would double-count and an audited
statement removes. That would make the figures internally coherent but
**not comparable to any ACFR scope, and not consolidatable** — worth stating
plainly rather than classifying around.

⚠ Do not resurrect the §2 magnitude-continuity argument (SCO ends FY2020 at
$16.99B, Socrata FY2021 opens at $16.17B). §3 already warned that LA's huge
proprietary funds put several unrelated scopes in the same band, and §10.3 shows
exactly how that band produces false ties.

### 10.7 Recommendation

1. **Leave the Socrata rows `unknown`.** That is the honest state and it is what
   the evidence gate is for. LA stays severed — the severance is *real*, and
   papering it over with a fitted classification would print a continuous LA
   history that no audited document supports.
2. **The fix is a direct ACFR load for FY2021–FY2025**, not a classification.
   Encouragingly, the audited all-funds base *is* continuous with the CA SCO
   series: SCO ends FY2020 at $16.99B expenditure; the FY2022 ACFR base is
   $17.05B. So an ACFR load rejoins the history **on evidence** rather than on a
   coincidence. `acfr22.pdf`/`acfr23.pdf` are already extracted and known-good;
   `acfr24.pdf`/`acfr25.pdf` are 404 and must be found from
   `https://controller.lacity.gov/reports`.
3. **Do not present an LA surplus/deficit** from the current stored pair under any
   circumstance — FY2025 already mixes two different documents (§2 defect 2).
4. §8's questions all still stand, and Q1 is now answered: *classify now* is off
   the table.

### 10.8 Cost of the correction

Two ACFRs read, ~40 printed figures transcribed by coordinates, 384 subset
combinations enumerated. It cost one session to avoid stamping **9 rows** — and,
worse, to avoid publishing a continuous Los Angeles history built on a
coincidence, in the flagship city Chris flagged as "still feels broken".
