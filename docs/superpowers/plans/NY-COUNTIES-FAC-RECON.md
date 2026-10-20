# New York counties — reconciliation against their own audited ACFRs

Spec §11.1 of `2026-10-19-ny-towns-villages-counties-design.md`, and the county
analogue of #272's school-district reconciliation.

Run: `npm run ny:recon-counties-fac` (no credential — TT's side is re-derived
from the archive with the loader's own library).

---

## Why this exists

**OSC publishes line items only. There is no total row anywhere in this
source.** Every TT total is `Σ items` by construction, so "total = sum of
items" is true automatically and proves nothing. The load's own verifier
establishes that TT read OSC faithfully. **Only this tests whether OSC is
right.**

## ⭐ The route, and the one thing that made it cheap

The Federal Audit Clearinghouse serves the complete audited ACFR as a PDF,
free and unauthenticated, at
`https://app.fac.gov/dissemination/report/pdf/<report_id>`. Report ids come
from the cached bulk CSV (`cache/fac-general.csv`, snapshot 2026-09-03).

⭐⭐ **The school districts' reader works on a county ACFR unmodified.**
`scripts/lib/nySchoolAcfrGF.py` anchors the General Fund column on a TOTAL row
rather than on a layout, so it reads a county's governmental-funds statement
without a line of change — verified before this script was written. Its 33
selftests therefore still cover this path. That was the entire risk in the
task, and it evaporated in one command.

## ⚠⚠ Select by EIN — New York's counties re-prove the districts' lesson

322 NY auditees have "COUNTY" in their name; only 90 look like a government at
all. The rest are BOCES, Cornell Cooperative Extension associations, Industrial
Development Agencies and nonprofits (`CHILD AND FAMILY SERVICES OF ERIE
COUNTY`). And one government files under two name forms:

* `COUNTY OF FULTON` and `COUNTY OF FULTON NEW YORK` — both EIN 146002626
* `CHENANGO COUNTY` and `COUNTY OF CHENANGO` — both EIN 156000451

⚠ An EIN is **not** sufficient on its own either: a county and its Industrial
Development Agency can share one, so the name must still match a government
form. Both filters are applied.

⚠ A duplicate `(EIN, audit_year)` is a **resubmission**, not two audits. Albany
FY2023 carries two report ids; the later supersedes.

## Coverage, and what it cannot reach

Four counties spanning the size range, so a discrepancy can be told apart from
a scale effect: **Albany** and **Orange** (large), **Tompkins** (mid),
**Schuyler** (smallest with a long run). Nine audit years each, FY2016–FY2024.

**36 documents read · 1 refused · 0 not reconcilable.**

⚠⚠ **FAC begins at audit year 2016**, and a county appears only in a year it
expended $750k of federal awards. TT loads FY1995–FY2025, so **21 of the 31
loaded years have no audit route at all** and are not claimed as checked.
**33 of New York's 57 counties never appear in FAC**; this reconciles four.

⚠ Orange FY2018 is **REFUSED**, not counted as a mismatch: the other-financing
components do not rebuild the printed net (off by 3,584,000), so the read is
not trustworthy and is discarded rather than compared.

---

## The result — and it does NOT transfer cleanly from the districts

The rule proven for school districts in #272:

    OSC revenue      ==  ACFR `Total revenues`     + other financing SOURCES
    OSC expenditure  ==  ACFR `Total expenditures` + other financing USES

For Rochester's district that tied **to the dollar in 8 of 9 years**. For these
counties it does not.

| | ties to the dollar | within 1 part per million | largest residual |
|---|---:|---:|---|
| revenue | **4 / 35** | 12 / 35 | 6,284,003 (Tompkins FY2019) |
| expenditure | **3 / 35** | 15 / 35 | 6,284,001 (Tompkins FY2019) |

**That is the honest headline: the county General Fund figures are NOT
corroborated to the dollar by this route.** Reporting it as a clean tie would
have been the easy and false thing to write.

## ⭐⭐ But the residuals are not noise — they are a presentation difference

Look at Tompkins FY2019: the revenue residual is **+6,284,003** and the
expenditure residual is **+6,284,001**. Orange FY2016: **−102,004** and
**−102,004**. The two residuals are *the same number*, repeatedly, across
different counties and years. That is not two independent errors.

    (ACFR_rev + sources) − OSC_rev  ==  (ACFR_exp + uses) − OSC_exp

rearranges to

    (ACFR_rev − ACFR_exp) + (sources − uses)  ==  OSC_rev − OSC_exp

— **the two publishers agree on the NET CHANGE IN FUND BALANCE while differing
on gross revenue and expenditure by one shared amount.** That is the signature
of a presentation difference (an item one source reports gross and the other
nets, or an intra-fund flow one eliminates), not of a figure being wrong.

**21 of 35 county-years agree on the net change.** Those years are corroborated
on their bottom line and unexplained on their gross.

⚠ The $100 threshold for "the same number" is **evidenced, not tuned**: on the
county-years that reconcile outright, the reader's residual runs up to **$48**
on figures of $40m–$830m. A tighter threshold would count reader noise as
disagreement.

## ⚠⚠ The 14 county-years that are NOT corroborated at all

Where the two residuals disagree, neither the gross nor the net is
corroborated, and this route says nothing in their favour:

```
Albany   2018 2019 2020 2021 2022 2023 2024
Orange   2020 2021 2022
Schuyler 2021 2022 2023 2024
```

⚠ **Albany is the worst of the four — 7 of 9 years.** Its FY2021 revenue is off
by $3.59m while its expenditure ties to **$2**, which is exactly the shape that
rules out a scale effect or a reader fault and points at a specific
revenue-side reclassification. Not chased.

⭐ **Tompkins is the best — 9 of 9 county-years agree on the net change**, four
of them tying outright. A single county reconciling perfectly while another
does not is itself evidence that the method works and the differences are real.

## What this establishes, and what it does not

* ✅ TT's reading of OSC is **not** systematically wrong: 21 of 35 county-years
  agree with an independently audited statement on the net change in fund
  balance, and several tie to the dollar on both sides.
* ✅ The districts' reader generalises to county ACFRs, so this route is cheap
  to extend to any of the other 24 counties FAC covers.
* ❌ It does **not** establish that OSC's county General Fund equals the ACFR's
  General Fund. It demonstrably does not, in at least 14 county-years.
* ❌ It says nothing about FY1995–FY2015, two-thirds of the loaded series.
* ❌ It says nothing about the 933 towns or 561 villages, which are below the
  $750k Single Audit threshold far more often than counties are.

`audit_grade` stays **`self_reported_unaudited`**, which is exactly what this
result supports.

## Follow-ups, none of them started

1. **Chase one residual to its line.** Albany FY2021 (revenue off $3.59m,
   expenditure off $2) is the cleanest specimen; identifying the line would
   likely explain most of the 14.
2. **Extend to the other 24 FAC-covered counties** — the script takes
   `--county`, and the marginal cost is one PDF fetch per year.
3. Towns and villages have no comparable route at scale.
