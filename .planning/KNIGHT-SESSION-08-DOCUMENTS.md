# Knight Session 8 — Document Hunt

**Run 2026-08-30.** The seven orphan entities. Recon (fiscal months, FAC identity)
was already done and is in `KNIGHT-COMMUNITIES-PROGRESS.md`; this file records the
**documents** — every access route, every verification, and every gap.

**Result: 70 load-ready documents staged at `_acfr-work/s8/`** with
`_acfr-work/s8/manifest.json` (entity, fiscal_year, route, url, bytes, note).
Every one was fetched, magic-byte checked, text-extracted, and verified for
issuer, fiscal year, statement presence and text quality. Nothing below is
asserted from a filename, a search summary, or a URL pattern.

---

## 1. ⭐⭐ THE FAC BULK CSV REMOVES THE `DEMO_KEY` BLOCKER ENTIRELY

The worklist filed "get a real FAC API key" as blocking-ish, because `DEMO_KEY`
rate-limited after ~2 queries and stopped report_id lookups for six of seven
entities. **It is not needed.** The bulk download carries `report_id` for every
filing:

    https://app.fac.gov/dissemination/public-data/gsa/full/general.csv

**269 MB, 4.5 seconds, no key, no rate limit.** It yielded all 58 report_ids in
one pass. The PDF endpoint already needed no key, so the whole route is now
unauthenticated end to end. ⚠ Coverage still starts at **audit year 2016**;
earlier years still need the publisher.

**The API key follow-up should be downgraded, not closed** — a live query is
still the only way to see a filing accepted after the CSV snapshot.

## 2. ⚠⚠ FILTER FAC BY `auditee_ein`, NEVER BY `auditee_state`

A state filter (`auditee_state in (SD,MS,ND,KY)`) **silently dropped City of
Grand Forks FY2025**, which FAC files with **`auditee_state = MN`**. It was
recovered only by re-querying on EIN, and its cover page reads "City of Grand
Forks, North Dakota … December 31, 2025".

This is the reference's "`auditee_state` is not clean" warning costing a real
document rather than adding a spurious one. The name-trap warning also held
exactly: a name query returned all five LFUCG siblings plus the Lexington
Convention & Visitors Bureau, the Public Library and Commerce Lexington.

**Rule: EIN selects the government; report_id is the join; name and state are
display fields.**

## 3. ⚠⚠ TEXT DENSITY IS NOT TEXT QUALITY — A NEW GATE

**City of Biloxi FY2023 is a garbled scan** whose cover extracts as:

> `CITY Of' 80.,0XI, MJSSISSll'l'I FINANCIAL llliPOffl' SEPTEMBER30, 2023`

It carries **1,912 chars/page — above this corpus's median** — so a
density / `LOW-TEXT` check *passes* it. That is the Myrtle Beach FY2018 failure
mode wearing a disguise the existing gate cannot see.

The gate that does work is **lexical**, and it separated the corpus with no
borderline case:

| measure | 57 good documents | Biloxi FY2023 |
|---|---|---|
| known-vocabulary token share | **39.5 – 47.2 %** | **24.4 %** |
| digit-welded tokens per page (`Sta1cmc111`) | **0.0 – 2.0** | **29.8** |
| pages with a numeric REV/EXP/fund-balance statement | 3 – 19 | **0** |

⭐ **Adopt all three; a document that fails any of them must FAIL, not pass.**

### ⚠⚠ Biloxi FY2023 is unloadable from EVERY publisher

Checked **three independent copies** — FAC, the city's own site, and MS OSA.
All three are the same damaged scan (the OSA copy merely adds a 5-page wrapper):
24.4 % / 24.4 % / 24.5 % vocabulary, zero numeric statement pages in all three.
**The damage originates with the publisher.** Not a fetch problem, not
recoverable by re-hosting: record the gap, do not parse it.

⚠ And the inverse also happened: **Biloxi FY2024 has NO text layer on the city's
site but is born-digital at FAC.** Per-year quality differs *between copies of
the same year*, so the routes are complements, not substitutes.

## 4. ⚠⚠ BROWN COUNTY SD IS NOT GAAP — IT IS MODIFIED CASH

FAC flags it `not_gaap`, and the document says so in its own words:

> "the financial statements are prepared on the **modified cash basis of
> accounting, which is a basis of accounting other than accounting principles
> generally accepted in the United States of America**"

Checked per entity: **six of the seven are GAAP; Brown County alone is OCBOA.**
It cannot be loaded as `audited_gaap`, and its "General Fund" is not comparable
to the other six without saying so. **This is a grade/basis decision for Chris
before the load, not a loader detail.**

## 5. ⚠ HARRISON COUNTY MS CARRIES QUALIFIED — AND ONE ADVERSE — OPINIONS

Straight from FAC's structured `gaap_results`, so no OCR and no polarity gate is
involved (7b's inverted `qualifiedopinion`-inside-`UNqualifiedopinion` bug cannot
arise here):

| FY | gaap_results |
|---|---|
| 2016 | unmodified, **qualified, adverse** |
| 2017 | unmodified, **qualified** |
| **2018** | **qualified only** |
| **2019** | **qualified only** |
| 2020–2023 | unmodified, **qualified** |

Every other entity-year in the corpus is `unmodified_opinion`. **FY2018 and
FY2019 have no unmodified component at all.** Grade these from the filing, not
from a family default.

## 6. Routes, per entity — each proved by a real fetch

| Entity | FYE | Route(s) | Staged | Years |
|---|---|---|---|---|
| Aberdeen SD | Dec 31 | FAC + city CivicPlus archive | 13 | 2006–2009, 2016–2024 |
| Brown County SD | Dec 31 | FAC + **SD DLA** | 4 | 2016, 2020, 2023, 2024 |
| Biloxi MS | Sep 30 | FAC + city site | 18 | 2002–2004, 2009–2012, 2014–2022, 2024–2025 |
| Harrison County MS | Sep 30 | FAC | 8 | 2016–2023 |
| Grand Forks ND | Dec 31 | FAC | 10 | 2016–2025 |
| Grand Forks County ND | Dec 31 | FAC | 7 | 2016–2017, 2020–2024 |
| Lexington-Fayette KY | Jun 30 | FAC | 10 | 2016–2025 |

**Fiscal months confirmed a second time**, from each document's own cover page,
against the recon table: SD and ND = month 1, MS = month 10, KY = month 7.

### The per-publisher facts that cannot be inferred

* **LFUCG's FAC upload is titled "Single Audit Report in Accordance with Uniform
  Guidance", not an ACFR — but it BUNDLES the complete governmental-funds
  statements.** Verified: FY2024 p.60 is "STATEMENT OF REVENUES, EXPENDITURES,
  AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS", General Fund column, Total
  Revenues **$492,988,023**. Only FY2016 is titled as the CAFR. **Do not reject
  these packages on their cover title.**
* ⚠ LFUCG's fund columns are General / **Urban Services** / Federal and State
  Grants / Other Governmental — a consolidated-government layout.
* **LFUCG FY2022 and FY2023 each have TWO report_ids** (a re-submission). Both
  pairs were downloaded and **proven text-identical**; the manifest keeps the
  later-accepted GSAFAC id. Decided by comparison, not by pattern.
* ⚠ **LFUCG also publishes on Google Drive** (opaque file ids, read from the
  Accounting page, never derivable). Its link labelled "fiscal year 2025" is a
  **20-page summary with no numeric statement — NOT the ACFR.** A publisher's own
  label is not evidence of what the file is.
* **Aberdeen's CivicPlus ids run DESCENDING by year** — 47=FY2009, 48=FY2008,
  49=FY2007, 50=FY2006. Derivable-looking and therefore dangerous; read from the
  archive and confirmed on each cover page, the Wichita ADID lesson.
* **Biloxi filenames lie about the year.** `COBAuditReport.pdf` = **FY2003** and
  `City-of-Biloxi-CAFR-1.pdf` = **FY2017**; neither is guessable. Cover pages
  decided both.
* **`grandforksgov.com` 403s curl AND browser headers** — the charlottenc.gov
  fingerprint. FAC serves every year of it regardless.
* ⚠ **The ND State Auditor mirror has already rotted**: the indexed
  `2019 Grand Forks County.pdf` now 404s. It currently serves only FY2022–2024
  city ACFRs, which FAC already holds permanently. **FAC is the durable route.**
* **SD DLA lists only the CURRENT report per entity** (`/reports/County/Brown
  County 2024.pdf`) — no archive. That single listing is still the only source
  anywhere for **Brown County FY2024**.

## 7. Gaps, and what would close them

| Gap | Status |
|---|---|
| **Biloxi FY2023** | ⛔ **Closed as unobtainable** — 3 publishers, same damaged scan |
| Biloxi FY2005–2008, FY2013 | Image-only on the city site. **MS OSA is the live lead** |
| Aberdeen FY2010–2015 | Not on the city archive; before FAC. No route found |
| Aberdeen FY2003–2005 (probable) | Archive items 51/52/53 have **no text layer**; years unconfirmed |
| Brown County 2017–2019, 2021, 2025 | Biennial + below the $750k threshold. SD DLA holds only the current year |
| Grand Forks County FY2018, FY2019 | Absent from FAC; the ND mirror's copy has rotted |
| Harrison County FY2024, FY2025 | ⛔ **Not published by anyone yet** — see below |
| LFUCG pre-FY2016 | Google Drive "previous years" folder — not yet enumerated |

### ⚠ THE MS OSA INDEX WAS READ — AND IT CLOSES NOTHING FOR SESSION 8

The index is real, and it is at
`https://www.osa.ms.gov/reports/audit-reports?title=<name>` (a Drupal exposed
filter; `field_category_target_id=67` County Audit, `75` Municipality Report).
Scraped in full to `_acfr-work/s8/osa-index/` with `osa_scrape.py`. **Every one
of the three hopes for it failed, for three different reasons:**

* **Harrison County FY2024/FY2025 — not there.** OSA's county audits stop at
  FY2023 for Harrison. FY2024 *is* being published for **55 other counties** and
  FY2025 for 9, so this is Harrison's own filing lag, not a coverage limit.
  **No publisher has these years.** FAC stops at FY2023 too.
* **Biloxi FY2005–2008, FY2013 — not there.** OSA's coverage **begins at FY2015**.
* **Harrison County FY2015 — there, and UNUSABLE.** It is an image-only scan:
  **1 page of 126 carries text**, at 5 chars/page.

⚠ Everything else OSA holds for these two entities duplicates FAC or the city.
**Net yield for session 8: zero documents.** The manifest is unchanged at 70.

### ⚠⚠ AND IT CORRECTED THE NEW GATE — DENSITY AND VOCABULARY ARE COMPLEMENTARY

Harrison County FY2015 scores **45.7 % vocabulary and 0.0 welds/page** — it
sails through the §3 lexical gate — because its *only* text is OSA's clean
English disclaimer page. Biloxi FY2021 at OSA does the same: **48.8 % vocab on
1 text page of 113.**

**The lexical gate does not REPLACE the density check; it covers the opposite
failure.** Run all four, and fail on any one:

| check | catches | threshold used |
|---|---|---|
| chars/page | image-only scan (near-empty text layer) | **>= 400** |
| vocabulary share | dense but garbled OCR | **>= 30 %** |
| welded tokens/page | dense but garbled OCR | **<= 12** |
| numeric REV/EXP/FB pages | both, and a wrong-document | **>= 1** |

⭐ The numeric-statement count is the one check that caught **every** bad
document in this campaign on its own. Prefer it as the primary gate.

## 8. ⭐⭐ THE REAL PRIZE: MS OSA IS A STATEWIDE MISSISSIPPI SOURCE

It closed nothing for session 8, but reading the index found a **statewide bulk
source the campaign had recorded as not existing** — on the scale of PA DCED:

| category | records | distinct entities | years |
|---|---|---|---|
| **Municipality Report** (75) | **2,668** | **299** | **FY2015–2025** |
| **County Audit** (67) | **805** | ~82 (120 name variants) | **FY2015–2025** |

Mississippi has ~298 municipalities and 82 counties, so this is **effectively
complete statewide coverage** — ~270 municipal and ~84 county audits per year.
Free, anonymous, no WAF, no key, no ToS gate. Full index scraped to
`_acfr-work/s8/osa-index/` (`osa-county-audits.json`, `osa-municipality.json`).

⚠ **These are audited financial statements, not a compiled dataset** — each row
is a PDF, so it is icicle-grade only after extraction, one document at a time.
⚠ Most are marked "(Contract Audit)" and carry an OSA disclaimer page: *"not
prepared by the Office of the State Auditor … prepared by and submitted to"* a
private CPA firm. **That makes the grade `audited_gaap` on the CPA's opinion,
not on OSA's authority** — OSA explicitly disclaims responsibility for content.
⚠ **Two path roots, and the older one is DOUBLE-ENCODED** (`…/2024-08/22cHarrison%2520County-cpa.pdf`).
Ids are not derivable in either: 27 probes of plausible names returned 0 hits.
**Read the index.**
⚠ Quality is per document, not per root: FY2019 and FY2022 sampled clean,
FY2015 and Biloxi FY2021 are image-only.

**Filed as a candidate statewide milestone, not as session-8 work.**

## 9. Reproducing this

```
# 1. report ids (no key, no rate limit)
curl -L -o general.csv https://app.fac.gov/dissemination/public-data/gsa/full/general.csv
#    filter on auditee_ein — NOT name, NOT state

# 2. the documents (no key)
curl -L https://app.fac.gov/dissemination/report/pdf/<report_id>

# 3. verify EVERY file: %PDF- magic, issuer, cover fiscal year,
#    vocab share >= 30%, welded tokens/page <= 12, >=1 numeric REV/EXP/FB page
```

⚠ A cover-page year check alone is not sufficient: **Grand Forks FY2021's cover
extracts as "December 31, 202"** — a truncated glyph — and the year is confirmed
only from the dominant date elsewhere in the document. Let the gate fall back to
the modal fiscal-year-end date, and never to the filename.

**The seven EINs — the stable keys:**

| Entity | EIN | FAC auditee id |
|---|---|---|
| Aberdeen SD | `466000010` | `0000170919` |
| Brown County SD | `466000011` | `0000170841` |
| Biloxi MS | `646000153` | `0000152296` |
| Harrison County MS | `646000425` | `0000152168` |
| Grand Forks ND | `456002085` | `0000161952` |
| Grand Forks County ND | `456002215` | `0000161876` |
| Lexington-Fayette KY | `610858140` | `0000146075` |

⚠ Census-era ids are `<FY>-<MM>-CENSUS-<auditee id>` where `MM` is the
fiscal-year-end month (12 / 09 / 06 here); FY2023+ use non-derivable `GSAFAC`
ids. Take both from the CSV rather than building either.
