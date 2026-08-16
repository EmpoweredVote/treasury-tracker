# WA-CITIES-01 — Closeout

**Milestone:** onboard the six largest Washington cities not already in Treasury
Tracker onto the WA State Auditor pipeline built in v2.22, at General Fund parity
with every figure durably sourced.
**Branch:** `feat/wa-cities-01` · **Closed:** 2026-08-16
**Result:** 6 cities, 4 nav-only county nodes, **214 new rows**; with v2.22's
Kitsap and Bainbridge the WA cohort is **286 rows under one roster**.

**Verification at close:** re-derivation 286/286 at exactly $0, 0 blockers ·
audit 8/8 across 286 rows · tether definitive, all 12 entities NOT COVERED ·
203 vitest · 166 acfrGF selftests · check (h) and all four new enrichment guards
mutation-tested rather than assumed live.

---

## 1. Where each city's floor landed, and what stopped it

The floor rule walks back one year at a time and stops at two CONSECUTIVE
unreadable years. Every stop below is a property of the documents, not of the
parser.

| City | Window | Yrs | Rows | What stopped it |
|---|---|---|---|---|
| Tacoma | FY2003–FY2024 | 19 | 38 | Reached the top of the ARN manifest (FY2003 is the oldest filing). FY2011/2018/2021 are isolated text-layer defects inside the window; FY2025 is source timing. |
| Spokane | FY2004–FY2024 | 20 | 40 | Top of the manifest. Only FY2012 unreadable (statement pages return SAO page furniture only); FY2025 is source timing. |
| Vancouver | FY2005–FY2023 | 19 | 38 | **FY2004 is an image-only scan** — the walk stopped there. FY2024's text layer drops glyphs and its money digits are absent; FY2025 has no filing at all. |
| Bellevue | FY2008–FY2023 | 12 | 24 | **FY2004–FY2007 are four CONSECUTIVE image-only scans** — the only city where the floor rule itself ended the window. Five more isolated defects inside it. |
| Kent | FY2004–FY2024 | 18 | 36 | Top of the manifest, via an **approved deviation** (§4). |
| Everett | FY2004–FY2024 | 19 | 38 | Top of the manifest. FY2005 and FY2010 unreadable but **not consecutive**, so the rule never fired. |

**Four of six cities ran to the top of their manifest.** The floor rule ended
exactly one window (Bellevue) and was deliberately overridden in exactly one
(Kent). That is the single most useful number here for sizing the next WA batch:
document quality, not the rule, is what determines depth.

## 2. Which cities were substituted, and why

**None.** The spec called the self-publishing-GAAP-filer risk "the single largest
open risk in the milestone" — that Tacoma, Spokane or Vancouver might file only an
opinion letter with the SAO, forcing either a v2.21-style own-ACFR fetcher or
substitution of the next largest city.

**It did not materialise.** All six cities' SAO filings carry the full bound
statements, in every year of every window, and the Tacoma pilot answered it at
first fetch. No substitution, no second fetcher, no second extractor shape.

Worth recording for the next WA milestone: the risk was correctly identified and
correctly placed (the pilot existed to answer it), and the answer was "no". Seattle
remains the only WA entity in Treasury Tracker sourced from the city rather than
the SAO.

## 3. The measured per-city cost

⚠ **What is honestly measurable here is defect discovery, not effort.** There is no
wall-clock or token instrumentation on this branch, so a "cost per city" figure
would be invented. Commit counts are given as a weak proxy and should be read as
one — Spokane's single commit hides the milestone's most expensive single finding.

| City | Yrs avail. | Loaded | Refused | Residues | New reader classes | Commits |
|---|---|---|---|---|---|---|
| Tacoma | 22 | 19 | 3 | 0 | **4** | 5 |
| Spokane | 21 | 20 | 1 | 0 | **3** + form-feed | 1 |
| Vancouver | 21 | 19 | 2 | 2 | 1 | 1 |
| Bellevue | 21 | 12 | 9 | 11 | **3** + 2 label | 2 |
| Kent | 21 | 18 | 3 | 0 | **3** + 10 data | 3 |
| Everett | 21 | 19 | 2 | 0 | 2 | 3 |

**The cost curve did not flatten the way a batch is supposed to.** The premise of
Phase A was that Tacoma would absorb the shape-finding and the remaining five
would be cheap. Tacoma did expose four reader-defect classes — and then Spokane
exposed three more plus the form-feed discovery, Bellevue three more plus two
letter-spaced labels, Kent three more plus ten corrupted published labels, and
Everett two more. **Thirteen classes across six cities, with new ones still
arriving at city six.**

The reason is worth carrying forward: each city is a different *issuer* with its
own typesetting, and the defects were in the **rendering**, not in the pipeline.
A batch of WA cities is not one problem solved six times; it is six document
corpora sharing an API. Budget accordingly.

Cheapest city: **Everett** — flat revenue side, zero incomplete rows, zero
valueless rows, one config, no era split, no wrong-page trap. Most expensive:
**Kent** (ten published label defects) and **Bellevue** (12 loadable years out of
21, 11 adjudicated residues, two letter-spaced labels).

## 4. Every source-document refusal

**Nineteen document defects**, plus six source-timing gaps. Not one refusal is a
parser limitation — every document defect below was confirmed by reading the
filing, and in no case were the digits recoverable.

**Image-only scans (no text layer at all)**
Vancouver FY2004 · Bellevue FY2004, FY2005, FY2006, FY2007

**Text layer present, statement pages carry ONLY the SAO page furniture**
(rule line, credit line, page number — ~150 characters, no labels, no digits)
Spokane FY2012 · Everett FY2005, FY2010

**Ciphered / defective text layer, money digits absent**
Tacoma FY2011, FY2018 (constant +29 byte shift), FY2021 · Bellevue FY2011,
FY2017, FY2019 · Kent FY2019, FY2020, FY2023 · Bellevue FY2024 (renders as
consonant soup, no numerals)

**Text layer both collapses AND injects spaces inside words and numbers**
Bellevue FY2014 (`$1 5,205`) — digits present but unparseable without a
de-spacing heuristic the library refuses, because such a heuristic would corrupt
legitimate labels

**Source timing (no filing exists yet)**
FY2025 for all six: Tacoma and Spokane hold only a Contracted CPA report or
opinion letter; Vancouver, Bellevue and Kent hold nothing; Everett holds a 5-page
opinion letter.

⚠ **`classifyReport` cannot detect two of these.** It passed Everett FY2005 and
FY2010 because the **table of contents** contains the string "Statement of
Revenues, Expenditures". The fetch-time guard distinguishes a document that names
the statement from one that contains a readable one — the page-identity probe is
what catches it. Worth tightening in the next WA milestone.

## 5. What the report-type names do below FY2014 — ANSWERED

Spec §4 recorded the type-name inversion as known for FY2014+ and explicitly
**unknown below it**, asking recon to establish it as a finding.

**Established by content, not inference.** Pre-FY2014 filings typed
*Annual Comprehensive Financial Report* were fetched and classified:

| Filing | Type | Pages | Verdict |
|---|---|---|---|
| Everett FY2007 ARN 75029 | Annual Comprehensive Financial Report | **2** | opinion letter |
| Everett FY2009 ARN 1003927 | Annual Comprehensive Financial Report | **2** | opinion letter |
| Everett FY2012 ARN 1010535 | Annual Comprehensive Financial Report | **3** | opinion letter |
| Everett FY2012 ARN 1010534 | Financial and Federal | **99** | statements present |

**The inversion holds below FY2014, and is more extreme there:** pre-FY2014
opinion letters run 2–3 pages against the 4–6 seen above it, all titled
"INDEPENDENT AUDITOR'S REPORT". Corroborated across the whole milestone — all
**127 ARNs** pinned across the six cities span FY2003–FY2024, every one is typed
"Financial and Federal", and every one passed the content guard.

**Selecting by content remains correct and needs no change.** The finding does not
license trusting a type name; it closes the open question with evidence.

## 6. Did the config registry beat the per-file convention? — NO, KEEP PER-FILE

Spec §5 deferred this to the pilot with an explicit criterion: *"If configs differ
only in field values, the registry wins; if they need per-city code, the per-file
convention wins."*

**Measured, by parsing all six extractors' ASTs:**

```
top-level statements: docstring · imports · one CONFIG assignment · if __main__
functions/classes defined: NONE — in all six files
```

**Zero per-city code.** By the spec's stated criterion, the registry wins.

**Recommendation: keep the per-file convention anyway, because the criterion was
aimed at the wrong cost.** Two pieces of evidence, both from this milestone:

1. **The "shared bug needs six edits" fear never materialised.** The shared logic
   already lives in `scripts/lib/acfrGF.py`. Every library fix this milestone made
   — `empty_rows`, revenue-side trap 6, the `label_of` truncation — was **one edit
   in one file**, and `git log` confirms `acfrGF.py` was touched by exactly one
   commit. The per-city files were never edited for a shared bug, only for their
   own facts.
2. **65–95% of each file is per-city PROSE, and that is the valuable part.**
   Bellevue's CONFIG block alone carries 95 comment lines adjudicating 11 rounding
   residues off rendered page images. Kent's records four label-defect classes and
   an approved floor deviation. That knowledge is irreducibly per-city; a registry
   would either force six cities' worth of it into one file or strip it.

The registry would consolidate the 13–122 lines per city that are already
consolidated, and disperse the documentation that is not. **The criterion measured
code duplication; the actual cost was documentation location.**

## 7. Carried forward for the next WA milestone

- **Tighten `classifyReport`** so a table-of-contents mention cannot pass (§4).
- **`acfrGF.py` still splits pages naively** on form feeds. Harmless today (its
  `statement_page` is never persisted) but it disagrees with the audit's (h) line,
  and `pdftotext -table` form feeds are **not** page breaks.
- **The audit deliberately duplicates the page-identity regexes** rather than
  importing them. That has already cost one round of divergence: fix such a regex
  in BOTH files.
- **Thirteen reader-defect classes** are recorded with transcribed fixtures in
  `tests/waRederiveReaders.test.mjs` and `scripts/lib/acfrGF.selftest.py`. Add a
  new city's shape there rather than debugging against the live corpus.
- **The lesson worth the most:** when a harness reader disagrees with a document,
  do **not** conclude the loaded data is fine because the reader is provably wrong.
  Kent's three "harness gaps" were reader defects whose fix immediately exposed the
  same defects in the extractor — both had been written from the same misreading.

---

## Open for the Phase D conversation (§9)

Three questions the spec reserved for Chris. Evidence above, recommendations here.

**Is the rest of Washington worth a follow-on milestone, and at what batch size?**
Washington has ~280 cities. This batch delivered 214 rows from six. The
cost-per-city did not flatten (§3), so a large batch is not obviously cheaper per
city than a small one — but the *pipeline* is now genuinely reusable and the
roster/harness generalisation is done. Recommendation: yes, and **at four to six
cities**, chosen by population, with the explicit expectation of one to three new
reader classes per city rather than a flat curve.

**Are county finances as cheap as they look?** The four county nodes here are
nav-only by design. Kitsap County (v2.22) loaded 36 rows on the same pipeline, so
the shape is proven for a WA county. Unknown: whether county statements carry the
same column-geometry pathologies. Kitsap's did — `-table` rendered its General
Fund column in two disjoint zones — which is the reason `column_strategy` exists.
Recommendation: cheap, but not free; treat each county as a city for budgeting.

**Does the floor rule want tightening or loosening?** It fired once in six cities
(Bellevue) and was overridden once (Kent). The Kent override was correct and cost
nothing — the 15 years below the gap parsed on the same config. Recommendation:
**loosen it to what Kent actually did** — continue past a consecutive gap when the
years below parse on the unchanged config, and stop only when continuing would
require new work. That is the rule's stated purpose already; Kent showed the
mechanical form was stricter than the intent.
