# MA-01 — Massachusetts DLS Reconciliation: Evidence of Record

**Status:** Recon COMPLETE — both axes pinned. No production writes.
**Measured:** 2026-08-18, against the live `treasury.budgets` table (79,939 rows).
**Purpose:** establish what the 16,816 MA rows actually are, so
`FUND_SCOPE_REGISTRY` can classify them with the evidence SCOPE-01 requires.

---

## Bottom line

The framing "one MA ACFR unblocks 16,816 rows" is right in shape but wrong in
mechanism. The MA rows are **four sources, not one**; one of the four is
**mislabelled as a different fund type**; and the DLS figure equals **neither** of
the two totals an ACFR reports. It is a **third basis**, and the relationship is
now pinned to the dollar for expenditures.

`validateRegistry` requires `evidence.document` **and** `evidence.figures`, so a
taxonomy-only citation cannot pass. This document is the figures half.

**Both axes are pinned, at different strengths** (§4b, confirmed on two towns):

- **Revenues — strong.** Once the two financing columns DLS folds into its total
  are separated out, the revenue-proper subtotal ties within **0.017%–0.10%** on
  both Natick and Lexington, against a raw-total control that misses by >1.2%.
- **Expenditures — directionally right, precision town-dependent.** $1–$2 on
  Natick, ~0.34% on Lexington FY2023–24, and FY2025 inverts. UMAS is applied with
  local judgement, so this will never be exact for every town.

All 16,816 rows are classifiable as `general_fund`; the *scope* conclusion does
not rest on the figure precision. Read §6 before writing anything: the
classification must go per *dataset* across both eras, not per source, or the
seam detector gains 336 new seams.

---

## 1. The 16,816 rows are FOUR sources

| rows | munis | dataset | years | `data_source` label |
|---:|---:|---|---|---|
| 6,843 | 351 | operating | FY2002–2025 | `<Town> — MA General Fund Expenditures` |
| 6,663 | 351 | revenue | FY2002–2020 | `<Town> — MA General Fund Revenues` |
| 1,750 | 350 | revenue | FY2021–2025 | `<Town> — MA DLS General Fund Revenue by Source` |
| 1,560 | 336 | operating | FY2021–2025 | `<Town> — MA DLS Schedule A — Special Revenue Funds` |

6,843 + 6,663 + 1,750 + 1,560 = **16,816**. Every town sampled carries all four,
48 rows, FY2002–2025 — the structure is uniform statewide, so one town's
reconciliation evidences the taxonomy for all 351.

**Not in this bucket:** Cambridge (`cambridge-open-data`, 18 rows FY2021–2026) is
the one MA city loaded from its own portal. It **cannot** evidence DLS.

## 2. ⚠ The `Special Revenue Funds` label on 1,560 rows is WRONG

Those rows take over the operating series at FY2021. If the label were accurate,
the figures would collapse — special revenue funds run a small fraction of a
general fund. Measured across every municipality present in both years:

| | operating | revenue |
|---|---|---|
| municipalities compared | 350 | 350 |
| median FY2020→FY2021 ratio | **1.021** | 1.040 |
| mean | 1.025 | 1.045 |
| within ±25% | 345 / 350 | 346 / 350 |
| **below 0.5** | **0** | **0** |

Continuity at ~1.0 proves these are **General Fund figures carrying a wrong
source label**. The figures are sound; the audit trail is not.

**Why nothing caught it:** every MA row is `fund_scope = unknown`, so a source
change produces no scope seam — `detectSeams` compares scopes, and `unknown` on
both sides is not a change. **The `unknown` bucket hides source changes by
construction.** Worth carrying into any future seam work.

## 3. THE KEY FINDING — MA DLS is a third basis

Natick FY2021 General Fund has three different "General Fund" totals:

| basis | revenues | expenditures |
|---|---:|---:|
| ACFR **GAAP** (governmental funds statement) | $180,554,368 | $182,405,937 |
| ACFR **budgetary** (UMAS, non-GAAP), incl. encumbrances | $154,137,719 | $167,375,942 |
| **our MA DLS row** | **$160,383,112** | **$157,667,368** |

The ACFR's own budgetary-to-GAAP reconciliation note lists the bridging items.
The largest is **MTRS on-behalf payments, $25,099,907** — the Commonwealth pays
teacher pensions on the town's behalf; GAAP records them as both a revenue and an
expenditure, the budgetary basis excludes them. **This is why the evidence town
had to run its own schools:** the schools line is where the bases diverge most,
and a regional-district town would not exercise it.

### The rule, for expenditures

> **MA DLS Schedule A operating = the ACFR's General Fund budgetary-basis (UMAS,
> non-GAAP) ACTUAL total expenditures — the `Actual` column, EXCLUDING
> encumbrances and continuing appropriations.**

Confirmed by reading the labelled statement, not by pattern-matching. FY2024:

```
TOTAL EXPENDITURES..  196,075,913 | 197,642,755 | 185,379,535 | 10,922,891 | 1,340,329
                       Original       Final        ACTUAL       Encumbrances   Variance
```
our DLS FY2024 operating = **185,379,533** → **$2 apart**.

FY2021, same schedule, right-hand block:
```
157,458,088 | 9,917,854 | 167,375,942 | 3,350,322
  ACTUAL      Encumbr.    Actual+Enc.    Variance
```
our DLS FY2021 = 157,667,368 → 0.133%. Note the *note*'s $167,375,942 is the
Actual **+ encumbrances** column; DLS follows `Actual`.

### Verification across Natick's audited years

Method: take our DLS figure, search the ACFR text for the closest number, then
read the surrounding statement. ⚠ Closest-number matching is **suggestive, not
proof** — a large document contains many numbers. Rows marked **✔** are those
where the containing statement and column were confirmed by reading them.

| FY | our DLS operating | ACFR match | diff | confirmed |
|---|---:|---:|---:|---|
| 2006 | 90,943,398 | 91,102,675 | 0.175% | |
| 2007 | 90,481,268 | 90,552,520 | 0.079% | |
| 2008 | 100,614,053 | 100,572,515 | 0.041% | |
| 2009 | 97,976,552 | 97,767,341 | 0.214% | |
| 2010 | 100,269,889 | 100,593,033 | 0.322% | |
| 2011 | 103,346,509 | 103,250,690 | 0.093% | |
| 2012 | 108,794,351 | 108,724,737 | 0.064% | |
| 2013 | 113,746,055 | 113,715,791 | 0.027% | |
| 2014 | 119,454,674 | 119,430,856 | 0.020% | |
| 2015 | 124,222,531 | 124,239,903 | 0.014% | |
| **2016** | 125,986,233 | 125,986,232 | **$1** | **✔** |
| 2017 | 131,971,767 | 131,904,451 | 0.051% | |
| 2018 | — | — | — | scanned PDF, no text layer |
| **2019** | 145,388,452 | 145,377,129 | 0.008% | **✔** |
| 2020 | 154,570,500 | 154,363,020 | 0.134% | |
| **2021** | 157,667,368 | 157,458,088 | 0.133% | **✔** |
| 2022 | 165,972,327 | 166,090,303 | 0.071% | |
| 2023 | 174,709,588 | 174,663,992 | 0.026% | |
| **2024** | 185,379,533 | 185,379,535 | **$2** | **✔** |

**18 of 19 years land within 0.33%; two are exact to the dollar.** FY2018 is a
scanned image with no text layer and was not verified — recorded, not glossed.

## 4. The revenue rule — PINNED, via the source workbooks

The first attempt failed and the failure was informative. Searching each ACFR for
the DLS revenue total gave a median miss of 0.383%, and in **FY2012, FY2017 and
FY2019 there was no number anywhere in the document within 1%**. A figure that is
not in the document cannot be a line of the document. (Calibration matters here:
each ACFR holds 560–1,140 distinct numbers above $1M, with only ~2–4 within 1% of
any given target, so a lone tight match is not by itself evidence.)

**The unlock is that the DLS source files are IN THIS REPO.** `docs/MA/` holds all
48 workbooks, `GenFundExpenditures{YYYY}.xlsx` and `GenFundRevenues{YYYY}.xlsx`
FY2002–FY2025, loaded by `scripts/loadMaGFExcel.js` with an explicit
`totalCol` of `Total Expenditures` / `Total Revenues`. There was no need to
reverse-engineer anything — the column structure *is* the answer.

### ⚠ The two DLS products are NOT symmetric

| | columns |
|---|---|
| `GenFundRevenues` | Taxes · Service Charges · Licenses and Permits · Federal Revenue · State Revenue · Revenue from Other Governments · Special Assessments · Fines and Forfeitures · Miscellaneous · **Other Financing Sources** · **Transfers** · Total Revenues |
| `GenFundExpenditures` | General Government · Public Safety · Education · Public Works · Human Services · Culture and Recreation · Fixed Costs · Intergov Assessments · Other Expenditures · Debt Service · Total Expenditures |

**Revenue includes other financing sources and transfers IN; expenditure excludes
transfers OUT.** So the DLS revenue and expenditure totals are not like-for-like,
and the difference between them is not a surplus. Natick FY2021 reads
$160,383,112 in against $157,667,368 out — but $6,374,182 of that "in" is
financing sources and transfers. **Anything comparing MA Money In to Money Out
must account for this**, and it applies to all 351 municipalities.

### The rule

> **MA DLS General Fund revenue total = revenue-proper + Other Financing Sources
> + Transfers.** It is the **revenue-proper subtotal** (the total less those two
> columns) that corresponds to the ACFR's General Fund budgetary-basis actual
> Total Revenues.

Natick FY2021: 132,457,936 + 2,919,915 + 2,268,209 + 100,000 + 14,524,987 +
42,831 + 2,131 + 38,610 + 1,654,311 = **154,008,930**, then + 355,000 + 6,019,182
= 160,383,112. ACFR budgetary actual Total Revenues = **154,137,719** (0.084%).

| | raw DLS total | revenue-proper |
|---|---|---|
| years within 0.5% of an ACFR figure | 12 / 18 | **18 / 18** |
| median miss | 0.383% | **0.102%** |
| years with NO match within 1% | 3 | **0** |

Confirmed by reading the labelled statement, not by proximity:

- **FY2021** — `Budgetary Basis as Reported… $154,137,719`, also the Actual column
  of the budget-and-actual schedule. DLS revenue-proper $154,008,930.
- **FY2022** — `Budgetary Basis as Reported… $162,201,959`. DLS revenue-proper
  $162,243,865, **0.026%**.

The residual ~0.1% is bounded and consistent, and is smaller than the differences
between UMAS Schedule A revenue categories and the ACFR's revenue presentation
(refund and abatement netting; DLS `Transfers` 6,019,182 vs the ACFR's
`Transfers In` 5,816,508 in FY2021). It does not disturb the **scope** question,
which is what the registry needs: these are General Fund revenue categories,
reconciling to the General Fund budgetary statement.

## 4b. SECOND-TOWN CONFIRMATION — Lexington. One rule held, one did not.

⚠ **This section corrects §3.** The expenditure precision claimed there is
Natick-specific and was over-claimed as the rule. Confirming on a second town is
what caught it, which is why it was listed as the weakest link.

Lexington: a town that runs its own K–12 district, a different auditor, a
different document layout, audited statements at
`lexingtonma.gov/DocumentCenter/View/{13089,16407,17397}` for FY2023–25. All
figures below are read from each ACFR's **named** `Budgetary Basis` reconciliation
line and its stated encumbrances — no proximity matching.

### Revenue — CONFIRMED, and it is the stronger of the two rules

| FY | DLS total | OFS + Transfers | revenue-proper | ACFR budgetary revenues | diff |
|---|---:|---:|---:|---:|---:|
| 2023 | 275,550,318 | 4,351,871 | 271,198,447 | 271,245,502 | **0.017%** |
| 2024 | 292,486,320 | 4,041,527 | 288,444,793 | 288,174,636 | **0.094%** |
| 2025 | 305,292,240 | 4,073,643 | 301,218,597 | 301,053,298 | **0.055%** |

Against a control of the *raw* DLS total, which misses by 1.280% and 1.327% in
FY2023–24. The decomposition transfers cleanly to a second town.

### Expenditure — DOES NOT transfer cleanly

| FY | DLS total | ACFR budgetary exp | encumbrances | vs exp − encumbr | vs exp |
|---|---:|---:|---:|---:|---:|
| 2023 | 247,552,273 | 259,009,722 | 12,301,146 | **0.342%** | 4.424% |
| 2024 | 264,827,741 | 272,537,067 | 8,616,082 | **0.344%** | 2.829% |
| 2025 | 279,365,730 | 278,838,659 | 4,184,162 | 1.715% | **0.189%** |

The *direction* is confirmed — Lexington's own note says
`Add end-of-year appropriation carryforwards to expenditures 8,616,082`, and its
ENCUMBRANCES disclosure states the same figure, so DLS excluding encumbrances is
right for FY2023–24 at a suspiciously consistent ~0.34%. But **FY2025 inverts**:
DLS *exceeds* the ACFR budgetary total, which excluding encumbrances cannot
produce.

**Why it varies.** Lexington's reconciliation carries town-specific UMAS
reclassifications that Natick's does not — Enterprise Fund indirect cost
transfers +1,894,067, BAN transfers +549,644, OPEB contribution transfer
−1,979,721, Enterprise Fund debt service −289,516. UMAS is applied with local
judgement, so the DLS Schedule A total will not equal the ACFR budgetary total
for every town. **Natick's $1–$2 is the best case, not the rule.**

⚠ Proximity matching produced another coincidence here, exactly as in §4:
Lexington FY2024's "nearest number" to the DLS expenditure total was
**265,620,280 — the Total OPEB Liability.** Always read the label.

### What this does and does not change

- **The scope conclusion stands.** Both DLS products are General Fund products,
  their categories are General Fund categories, and both reconcile to the ACFR's
  General Fund budgetary statement within a small bounded margin on two
  independent towns. Classifying all 16,816 rows `general_fund` is evidenced.
- **The figure precision claim must be stated as a range, not a point.**
  Expenditures tie within $2 (Natick) to ~1.7% (Lexington FY2025); revenues
  within 0.017%–0.10% across both towns. `evidence.figures` should cite **both
  towns**, not Natick's $2 alone, which would misrepresent the precision.

## 4a. The loaded figures are byte-exact against the source workbooks

Every MA row FY2020–FY2025 was compared to its workbook cell:

| dataset | years | rows compared | exact | differ |
|---|---|---|---|---|
| operating | FY2020–2025 | 2,095 | 2,095 | **0** |
| revenue | FY2020–2025 | 2,106 | 2,096 | 10 |

**This proves the mislabel outright.** The 1,560 rows labelled
`MA DLS Schedule A — Special Revenue Funds` carry figures identical to
`GenFundExpenditures{YYYY}.xlsx` — the *General Fund* expenditure workbook. The
earlier ratio evidence (§2) inferred it; this settles it. The label came from
`scripts/scrapeMaDLS.js`, which took the DLS Gateway report name; the figures
came from the Excel loader.

⚠ The 10 revenue exceptions are rows where the **workbook holds 0** and the
database holds a figure — FY2024 Holyoke ($205,834,091) and Hudson
($107,521,743), plus 8 in FY2025. Those municipalities had not filed when the
workbook was captured, so those specific figures came from elsewhere (portal
scrape) and are **not** covered by this reconciliation. Check them before relying
on FY2024–25 for those towns.

## 5. The fetch route

The 403 wall is **narrow, not statewide**. With the full browser header set from
`.planning/OREGON-CITIES-RECON.md` (`Sec-Fetch-Mode`, `Sec-Fetch-Dest`,
`Upgrade-Insecure-Requests` are the load-bearing ones):

- **403:** Newton, Arlington, Brockton
- **200:** Cambridge, Worcester, Somerville, Framingham, Lowell, Springfield,
  Lexington, Natick, Winchester, Andover, Marblehead

All 19 Natick PDFs downloaded with that header set. `pdftotext -table` reads the
fund columns; **`-layout` scrambles them** and must not be used here.

Andover's `/224/Financial-Reports` returns **zero document links** to a plain
fetch — the CivicPlus client-side-injection case documented for Beaverton. It
needs the cached Playwright Chromium route
(`--headless=new --dump-dom`, see OREGON-CITIES-RECON §Obstacle 1).

## 6. Next steps — CLASSIFICATION APPLIED 2026-08-18

`node scripts/classifyFundScope.mjs` stamped 70,232 rows across all 11 registry
entries (the MA families plus every previously-evidenced source, which the
stamper rewrites idempotently). Result:

| fund_scope | before | after |
|---|---:|---:|
| `general_fund` | 1,734 (2.2%), 54 munis | **18,550 (23.2%), 405 munis** |
| `unknown` | 26,523 (33.2%) | **9,707 (12.1%)** |
| `total_governmental` | 28,410 | 28,410 unchanged |
| `all_funds` | 23,272 | 23,272 unchanged |

`figures_frozen` **unchanged** at `3bc12db8…82a2`; frozen row count 79,927;
composite unchanged; all four harnesses exit 0.

### ⚠ Cambridge lost its six most recent years from the chart

Predicted by simulating the write before running it, and it happened exactly as
simulated: seams went **21 → 23**, the two new ones being

```
Cambridge, MA  operating  FY2020→2021  general_fund → unknown  $561.9M → $606.2M
Cambridge, MA  revenue    FY2020→2021  general_fund → unknown  $695.8M → $732.4M
```

Cambridge is the **only** MA municipality with a mixed source history: 19 MA DLS
rows (FY2002–2020) and 6 `cambridge-open-data` rows (FY2021–2026) per series.
Classifying the DLS era `general_fund` while the open-data era stays `unknown`
splits it into two series, and `chooseDisplaySeries` takes the widest — the
19-year one — so FY2021–2026 now renders as a **gap**.

**RESOLVED — and the premise was wrong.** See §7.

## 7. `cambridge-open-data` was MA DLS all along — a THIRD wrong label

Investigating the regression showed `cambridge-open-data` is not a different
source at all. Its stored category names are **exactly the MA DLS Schedule A
taxonomy** — operating roots Education, Public Safety, Fixed Costs, Debt Service,
General Government, Intergov Assessments, Public Works, Human Services, Culture
and Recreation, Other Expenditures (all ten columns), and revenue roots including
`Transfers` and `Other Financing Sources`. A city's own open-data portal does not
publish in the state's Schedule A taxonomy.

Proven the same way the 1,560 were — against the workbooks:

| FY | DB operating | xlsx Total Exp | DB revenue | xlsx Total Rev |
|---|---:|---:|---:|---:|
| 2021 | 606,245,838 | 606,245,838 | 732,355,439 | 732,355,439 |
| 2022 | 621,077,310 | 621,077,310 | 757,378,045 | 757,378,045 |
| 2023 | 695,363,085 | 695,363,085 | 831,741,384 | 831,741,384 |
| 2024 | 741,021,949 | 741,021,949 | 917,998,626 | 917,998,626 |
| 2025 | 815,852,939 | 815,852,939 | 952,578,856 | 952,578,856 |

**All 10 byte-identical.** A corroborating signal had been visible and unread all
along: `ma-dls-gf-rev-by-source` matched **350** strings, not 351 — Cambridge was
the missing one.

Migration `20260818000400` relabels those 10 rows, id-scoped.

**Deliberately not touched:** FY2026 operating and revenue, both exactly
$992,181,320. Revenue equalling expenditure to the dollar is the
balanced-adopted-budget signature, no FY2026 workbook exists, and the FY2021–2025
rows have revenue ≠ operating — it is an adopted budget, not DLS actuals. Also
untouched: all 6 salary rows, which lie outside both workbooks.

**Outcome — the seam moved rather than vanishing, which is correct:**

```
was  Cambridge FY2020→2021  general_fund → unknown   6 years lost
now  Cambridge FY2025→2026  general_fund → unknown   1 year lost
```

Cambridge draws **FY2002–2025 continuously — 24 years, five recovered** — and
FY2026 renders as a gap, which is honest for an unevidenced adopted budget.
`general_fund` 18,550 → 18,560; `unknown` 9,707 → 9,697; `figures_frozen`
unchanged; all four harnesses exit 0.

⚠ **Three wrong source labels have now been found in this one family** (Special
Revenue Funds ×1,560, cambridge-open-data ×10, and the still-true-but-inconsistent
by-source split). Each was found by the same test — compare the stored figure to
the committed workbook cell. Any future MA row whose label is not one of the three
registry patterns should be run through that test before anything else.

### Still open

1. **Registry entries** for the four sources. `evidence.document` = the Natick
   **and Lexington** ACFR URLs + statements; `evidence.figures` must cite **both
   towns and the observed range** — Natick FY2024 expenditure
   `$185,379,535 / $185,379,533` beside Lexington FY2024
   `$263,920,985 / $264,827,741` (0.34%), and Natick FY2022 revenue
   `$162,201,959 / $162,243,865` beside Lexington FY2023
   `$271,245,502 / $271,198,447` (0.017%). Citing Natick's $2 alone would
   misrepresent the precision (§4b).
2. ⚠ **Classify per DATASET, across both eras — never per source.** The operating
   rows come from two sources partitioning at FY2021. Classify one era and not
   the other and the seam detector gains **336 new FY2020→FY2021 seams**,
   swamping the 21-seam backlog. The Natick verification deliberately spans the
   boundary (FY2016 and FY2024 sit on opposite sides), so each dataset is safe to
   classify as a unit. The same applies to revenue's own FY2002–2020 /
   FY2021–2025 split.
3. ~~Correct the 1,560 mislabelled `Special Revenue Funds` labels.~~ **DONE
   2026-08-18** — migration `20260818000300`, 1,560 rows relabelled to
   `<Town> — MA General Fund Expenditures`, 0 remaining. `figures_frozen`
   unchanged at `3bc12db8…82a2`, total rows unchanged at 79,939, all four
   harnesses exit 0, and the partition gate now reads **ma-dls-gf-exp
   8,403/8,403**. The ids are committed at `scripts/data/ma01RelabelledIds.json`
   because the reversal cannot key on the label: 180 rows in FY2021–2025 already
   carried the correct label before the write, so a year-scoped revert would
   corrupt rows this migration never touched.
4. ~~Second-town confirmation~~ — **DONE (§4b, Lexington).** It found a real
   over-claim: the expenditure precision was Natick-specific. A third town would
   further characterise the expenditure spread, but the scope conclusion no
   longer depends on it.
5. ~~Check the 10 workbook-blank rows~~ — **SWEPT IN, on Chris's explicit
   decision 2026-08-18.** They classify `general_fund` with the rest because the
   SOURCE is the same DLS General Fund product. Their *figures* still came from
   the portal scrape rather than the workbooks and remain outside the
   reconciliation: FY2024 Holyoke $205,834,091 and Hudson $107,521,743, plus
   eight in FY2025. Recorded so the caveat survives the decision.
6. **Decide how the revenue/expenditure asymmetry (§4) is surfaced.** MA revenue
   includes transfers in; MA expenditure excludes transfers out. Money In minus
   Money Out is not a surplus for any MA municipality.
7. FY2018 could be OCR'd if a 19th year is wanted; not required.

## Appendix — reproduce

- MA source taxonomy: filter `fetchScopeRows()` to `state === 'MA'`, strip the
  `<Town> — ` prefix from `data_source`, group.
- Handover ratio: per municipality, FY2021 ÷ FY2020 by `dataset_type`.
- Natick documents: `https://www.natickma.gov/171/Financial-Statements-Audit-Related-Docum`
  → `/DocumentCenter/View/<id>/Basic-Financial-Statements---FY<year>-Audit-PDF`
  (FY2024 id 21443, FY2021 id 13656, FY2016 id 5113, FY2019 id 10488).
