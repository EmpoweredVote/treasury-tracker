# NY school districts — reconciled against their own audited ACFRs

Spec §11.1's independent oracle, run 2026-10-19.
Tool: `node scripts/reconcileNyOscSchoolsFac.mjs` · reader:
`scripts/lib/nySchoolAcfrGF.py` · roster: `scripts/data/nyOscSchoolFacReports.mjs`.

**What this establishes:** TT publishes New York school-district figures from
OSC's Annual Financial Report, which is **self-reported**. #258 proved TT reads
OSC faithfully. It did **not** show that OSC is right. This does — for the two
districts the spec named as highest-value, because they close the §1 partition
from both sides.

---

## ⭐ The headline

**Rochester City School District ties to the dollar in 8 of the 9 readable
years**, FY2016–FY2025 — once a *definitional* difference between the two
filings is accounted for:

```
OSC revenue      ==  ACFR `Total revenues`     + other financing SOURCES
OSC expenditure  ==  ACFR `Total expenditures` + other financing USES
```

OSC's AFR folds other financing sources and uses **into** revenue and
expenditure; the ACFR reports them below the line. Rochester FY2021:

| | |
|---|---|
| ACFR `Total revenues`, General Fund | 736,920,574 |
| `+` Net premium on debt issuance | 1,814,378 |
| `+` Transfers in | 3,890,822 |
| **= 742,625,774** | **TT publishes 742,625,774** |

and on the other side, `602,986,637 + 86,316,186` transfers out
`= 689,302,823`, which is TT's expenditure figure exactly.

⚠ **Comparing the two `Total revenues` lines directly would have made a
faithful filing look wrong by the size of its transfers** — $86.3m on
Rochester's FY2021 spending side alone.

---

## Rochester City School District — EIN 166002010

| FY | ACFR revenues | + sources | = expected | OSC / TT | Δ |
|---|---|---|---|---|---|
| 2016 | 675,767,451 | 4,981,432 | 680,748,883 | 680,748,883 | **0** |
| 2017 | 704,089,663 | 671,528 | 704,761,191 | 704,761,191 | **0** |
| 2018 | 727,807,876 | 4,564,376 | 732,372,252 | 732,372,252 | **0** |
| 2019 | 756,576,972 | 11,373,263 | 767,950,235 | 767,950,235 | **0** |
| 2020 | — | — | — | 813,271,322 | **REFUSED** |
| 2021 | 736,920,574 | 5,705,200 | 742,625,774 | 742,625,774 | **0** |
| 2022 | 792,291,752 | 3,083 | 792,294,835 | 792,294,835 | **0** |
| 2023 | 815,902,390 | 0 | 815,902,390 | 815,902,390 | **0** |
| 2024 | 869,082,789 | 1,092 | 869,083,881 | 869,083,878 | 3 |
| 2025 | 917,834,411 | 0 | 917,834,411 | 917,834,411 | **0** |

**FY2024 differs by $3**, and expenditure differs by $1 in five years
(FY2017/2019/2022/2024/2025). Both documents are read exactly as printed and
every other-financing block rebuilds its own printed net, so these are genuine
differences between two separately-prepared filings — at most **3 dollars on
$869 million**, about four parts per billion.

### ⚠ FY2020 is REFUSED, not reconciled

The FAC copy is **dense but garbled**: 8,413 characters per page, every glyph
extracting as `(cid:0)` — a broken font encoding. `pdftotext` recovers prose
but **zero** money figures. A `chars/page` check passes this document happily,
which is exactly why that check is not the gate. Not OCR-guessed; recorded as
unreadable. The remedy is the district's own published copy — FAC and the
publisher are complements, not substitutes.

---

## Board of Education, City of Buffalo — EIN 166001554

| FY | ACFR revenues | + sources | = expected | OSC / TT | Δ |
|---|---|---|---|---|---|
| 2016 | 812,589,555 | 133,378 | 812,722,933 | 812,722,406 | 527 |
| 2017 | 847,609,997 | 34,367 | 847,644,364 | 847,619,809 | 24,555 |
| 2018 | 878,636,210 | 132,925 | 878,769,135 | 878,769,133 | 2 |
| 2019 | 911,107,907 | 411,262 | 911,519,169 | 911,519,167 | 2 |
| 2020 | 912,938,876 | *netted* | — | 913,519,570 | **n/a** |
| 2021 | 911,684,853 | *netted* | — | 916,884,897 | **n/a** |
| 2022 | 939,532,889 | *netted* | — | 939,239,500 | **n/a** |
| 2023 | 1,009,141,025 | *netted* | — | 1,009,518,950 | **n/a** |
| 2024 | 1,071,455,510 | *netted* | — | 1,071,381,717 | **n/a** |
| 2025 | 1,092,228,573 | *netted* | — | 1,092,112,605 | **n/a** |

### ⚠⚠ FY2020–FY2025 are NOT RECONCILABLE, which is not the same as wrong

From FY2020 Buffalo's ACFR prints **`Operating transfers, net`** instead of
gross `Interfund transfers in` / `out`. The rule above needs the **gross
inflow**, and a netted statement does not contain it. These years are reported
as *not reconcilable* rather than as mismatches, because the missing quantity
is missing from **the ACFR**, not from OSC.

⭐ The arithmetic corroborates that reading. For FY2021, the inflow implied by
the revenue side is `916,884,897 − 911,684,853 = 5,200,044`; feeding that same
figure through the expenditure side closes it to **$8** on $870m. Consistent —
but *implied*, so it is recorded as corroboration and not as a tie.

FY2016–FY2019 **do** print transfers gross, and those are the four years that
reconcile: two of them to within **$2**.

---

## ⚠⚠ Buffalo's district nearly went missing — a name search said it had never filed

A search of FAC for `buffalo.*school` returns seven Buffalo **charter schools**
and four out-of-state districts, and **not the district itself**. The first
pass therefore concluded Buffalo City School District files no Single Audit at
all. It files **all ten years**, as

> `BOARD OF EDUCATION, CITY OF BUFFALO, NEW YORK`

under EIN **166001554** — and spells itself three different ways across those
ten years. Four separate governments are also named `CITY OF BUFFALO` (NY, MN,
MO, TX).

**The EIN selects the government; the name is a display field.** This is the
documented FAC rule and it was re-learned here the expensive way.

### The city's ACFR cannot stand in for the district's

The City of Buffalo (EIN 166002533) presents the Board as a **discretely
presented component unit**, which appears only in the government-wide,
full-accrual statements. There is no General Fund column for the district in
the city's document, so it is not a substitute oracle.

⭐ **This closes the §1 partition from both sides.** Buffalo's district reports
~$911.7m of General Fund revenue in its own audited FY2021 statement — more
than twice the City of Buffalo's entire General Fund. #258's claim that OSC's
*city* file leaves half the partition on the floor is confirmed by an
independent, audited document.

---

## ⚠ What this does NOT establish

* **FY1995–FY2015 — nineteen of the thirty-one loaded years — have no audit
  route at all.** FAC begins at audit year 2016. Those years are not claimed as
  checked, here or anywhere.
* **Two districts, not 717.** Rochester and Buffalo were chosen because §11.1
  names them. Nothing here generalises to the other 715 without running them.
* Six Buffalo years are *unreconcilable from the document*, above.
* Audit grade is `unmodified_opinion` for all twenty filings
  (FAC `gaap_results`), which is a statement about the **audit**, not about
  OSC's separate AFR.

## Reproducing

```sh
node scripts/reconcileNyOscSchoolsFac.mjs --fetch   # ACFRs from FAC, no key
node scripts/reconcileNyOscSchoolsFac.mjs
npm run test:acfr                                   # the reader's 33 selftests
```

PDFs land in `cache/fac-pdfs/<ein>/` — **gitignored**, never committed.
TT's side is re-derived from `docs/NY/school_all_years.zip` with the same
library the loader used, so no database credential is involved.
