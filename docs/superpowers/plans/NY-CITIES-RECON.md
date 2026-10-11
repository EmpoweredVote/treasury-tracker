# NY cities — ACFR reconciliation

**Task 12** of `docs/superpowers/plans/2026-10-10-ny-cities-onboarding.md`.
Date: 2026-10-11.

Tasks 1–11 established that Treasury Tracker reads OSC faithfully — CHECK 5
re-derives every stored total from the archive to the cent. **Nothing before
this document tested whether OSC itself is right.** That is what this is for.

---

## 1. Verdict, up front

**The load is NOT verified against audited statements, and must not be
described as if it were.**

Two separate results, and they point in opposite directions:

* ✅ **Fiscal calendars reconcile exactly, 5 of 5**, against a first-party
  federal filing. This is a clean, independent confirmation of CHECK 4.
* ⚠️⚠️ **General Fund TOTALS DO NOT reconcile**, and for two of the five
  cities the difference is enormous — **−17% (Buffalo revenue) and −19%
  (Rochester revenue)** against the audited figure.

The second result is not evidence that TT mis-read OSC. It is evidence that
**OSC's General Fund and the ACFR's General Fund are not the same thing.**
That distinction is invisible to a reader of a TT city page today, which is
why it is written here rather than left in a session log.

---

## 2. How the audited statements were obtained

⭐ **The Federal Audit Clearinghouse serves the complete audited ACFR as a
PDF, free, no key, no WAF** — `https://app.fac.gov/dissemination/report/pdf/<report_id>`.

This mattered. The cities' own sites were not usable:

* `cityofrochester.gov` returned **403 to every client tried** — curl with
  browser headers and `Sec-Fetch-*`, WebFetch, and PowerShell — on the exact
  PDF URLs its own ACFR index page publishes.
* Searching for Albany's and Utica's own ACFRs returned Albany **California**,
  Albany **Georgia**, Albany **County**, and Utica component units.

⚠️ **FAC coverage starts at audit year 2016.** See §5 — the old schema era
cannot be reconciled this way at all.

Report ids used (all FY2021):

| City | FAC report id | audited FY end |
|---|---|---|
| Albany | `2021-12-CENSUS-0000206595` | 2021-12-31 |
| Buffalo | `2021-06-CENSUS-0000158537` | 2021-06-30 |
| Rochester | `2021-06-CENSUS-0000158642` | 2021-06-30 |
| Utica | `2021-03-CENSUS-0000158746` | 2021-03-31 |
| Olean | `2021-05-CENSUS-0000207831` | 2021-05-31 |

⚠️ `pdftotext -layout` **scrambles these statements** — on Albany and Olean it
associated labels with figures from other rows entirely. Every figure below was
read instead from **pdfplumber glyph coordinates**, grouping words into rows by
`top` and sorting by `x0`. The `-layout` output is not trustworthy here and was
discarded.

---

## 3. ✅ Fiscal calendars — 5 of 5 exact

FAC's `fy_end_date` is filed by the auditee under federal penalty. It is a
genuinely independent statement of the fiscal year.

| City | TT `fiscal_year_start_month` | implied FY end | FAC audited FY end | |
|---|---|---|---|---|
| Albany | 1 | Dec 31 | 2021-12-31 | ✅ |
| Buffalo | 7 | Jun 30 | 2021-06-30 | ✅ |
| Rochester | 7 | Jun 30 | 2021-06-30 | ✅ |
| Utica | 4 | Mar 31 | 2021-03-31 | ✅ |
| Olean | 6 | May 31 | 2021-05-31 | ✅ |

This covers four of the five calendars in the load, including both rare ones
(Utica is 1 of 4 cities on Mar 31; **Olean is the only city in the state on
May 31**). The months were read per entity per year from the archive and never
carried — and an external auditor agrees with all five.

---

## 4. ⚠️⚠️ General Fund totals — they do not reconcile

All figures FY2021, General Fund column of the audited governmental-funds
statement. Rochester's statement is **(000's Omitted)** and has been scaled.

| City | | TT (from OSC) | ACFR (audited) | difference |
|---|---|---|---|---|
| **Albany** | revenue | 198,933,966 | **196,973,897** | +1,960,069 (+1.0%) |
| | expenditure | 200,378,228 | **193,366,852** | +7,011,376 (+3.6%) |
| **Buffalo** | revenue | 432,341,635 | **522,246,353** | −89,904,718 (−17.2%) |
| | expenditure | 417,528,158 | **487,927,061** | −70,398,903 (−14.4%) |
| **Rochester** | revenue | 431,870,114 | **533,833,000** | −101,962,886 (−19.1%) |
| | expenditure | 402,610,852 | **492,233,000** | −89,622,148 (−18.2%) |
| **Utica** | expenditure | 68,905,933 | **65,497,299** | +3,408,634 (+5.2%) |
| **Olean** † | revenue | 17,447,897 | **17,423,503** | +24,394 (+0.1%) |
| | expenditure | 17,200,264 | **15,856,767** | +1,343,497 (+8.5%) |

Sources: Albany p.24 · Buffalo p.30 · Rochester p.45 · Utica p.20 · Olean p.19.

† ⚠️ **Olean's is a BUDGET-TO-ACTUAL statement, not the GAAP governmental-funds
statement** — the figure quoted is its *actual* column, and its expenditures
exclude $98,559 of encumbrances. A different basis, so its agreement is weaker
evidence than it looks.

⚠️ Utica's `Total revenue` row wraps and its figures could not be read from the
glyph coordinates. **Not read is not the same as agreeing** and it is left blank.

### 4.1 The cause, traced to the dollar

⚠ An earlier draft of this section said the city's audited General Fund
"carries the dependent school district". **That is wrong and is corrected
here.** The district is roughly TWICE the size of the city's entire General
Fund (§4.3) and is nowhere inside it. What the ACFR General Fund carries is
the city's **education support payment** and the intergovernmental aid behind
it — both of which OSC's city AFR omits, because OSC captures the district as
a separate filer.

**The expenditure side is now a closed identity, exact to $26 on $488 million:**

```
  OSC A-fund expenditures            417,528,158
  − OSC "Other Uses" (transfers out)    −423,881   ACFR reports these BELOW its total
  + ACFR "Education"                 +70,822,758   OSC's city file has NO such category
  ───────────────────────────────────────────────
  = predicted ACFR total             487,927,035
    actual ACFR total                487,927,061
    residue                                   26
```

Measured directly: **OSC's Buffalo A-fund contains no Education category at
all.** Its ten expenditure categories are Public Safety, Employee Benefits,
General Government, Transportation, Debt Service, Culture and Recreation,
Community Services, Sanitation, Other Uses and Social Services.

**The revenue side is localised but not closed.** The gap, net of transfers,
is **98,488,278**, and it sits in intergovernmental revenue:

| | ACFR GF | OSC A-fund | difference |
|---|---|---|---|
| Intergovernmental | 330,639,303 | 225,891,169 (State Aid + Federal Aid) | **104,748,134** |

That is education aid the city receives and OSC's city file does not record.
⚠ Note the asymmetry: the city takes in ~$105M more than OSC shows but spends
only $70.8M on Education. The ~$34M difference is close to the $34,319,292
excess of revenues over expenditures its own statement reports, which it then
transfers out — plausible, **not verified**, and recorded as such.

Rochester shows the same shape (Education $119,100,000 in its GF) but its gap
does not land on that line, so only Buffalo's is traced to the dollar. One
exact identity is not a proven rule for the other 60 cities.

### 4.2 This is not a hole in OSC's data

Checked directly: **Buffalo City School District files its own OSC AFR**, over
the same period (2020-07-01 → 2021-06-30), with a General Fund of
**$916,884,897 revenue / $870,179,312 expenditure** — more than twice the
city's. Rochester City School District likewise: **$742,625,774 /
$689,302,823**. Neither district's filing contains any row naming the city.

So OSC's city file and OSC's school-district file are a clean partition, not a
gap. **TT loads only the city half.** That is a defensible scope, but it means
a reader looking at a TT New York city sees a smaller number than the same
city's own ACFR, for a reason nothing on the page explains.

The districts are in `schooldistrict_all_years.zip` — 692 districts in FY2021,
the same static-zip mechanism, the same two schema eras.

### 4.2 What does NOT explain the gaps

Checked and rejected: **transfers**. TT's totals include OSC's `Other Sources`
and `Other Uses` categories, which an ACFR reports below its totals as other
financing sources/uses. Removing them barely moves Albany:

```
revenue      198,933,966 − 788       = 198,933,178  (ACFR 196,973,897)
expenditure  200,378,228 − 1,789,455 = 198,588,773  (ACFR 193,366,852)
```

Albany's remaining +2.0M / +5.2M is **unexplained**. Utica's +5.2% is
**unexplained**. They are small relative to Buffalo's and Rochester's, but
small and unexplained is still unexplained.

---

## 5. ⚠️ The old era cannot be reconciled this way

FAC coverage begins at **audit year 2016**. The load runs **FY1995–FY2021**,
and the schema era boundary is at **FY2012/FY2013** — so *every* old-era year
is outside FAC entirely.

The plan called for one old-era and one modern-era year per city. **Only the
modern era was reconcilable.** FY1995–2012 — 12 of the 27 loaded years, 2,562
of the 6,357 rows — has **no audited corroboration of any kind**.

That is a gap in the evidence, not a finding about the data, and it should not
be narrated as if those years were checked.

---

## 6. What this means

1. **TT reproduces OSC faithfully.** Task 11 CHECK 5 re-derived 1,187 stored
   totals to the cent, and mutation testing proved that check can fail. Nothing
   here disturbs that.
2. **OSC's "General Fund" is not the ACFR's "General Fund"** for cities that
   support a dependent school district. For Buffalo and Rochester the audited
   General Fund is **17-19% larger** than what TT publishes under that label.
   Buffalo's expenditure difference is explained to **$26 on $488 million**
   (§4.1); its revenue difference is localised to intergovernmental aid but
   not closed. The districts themselves are a separate OSC filer, not a gap
   (§4.2).
3. **`audit_grade = self_reported_unaudited` is doing real work** and is
   correct. So is `accounting_basis = unknown`: these filings are not audited,
   and §4 is what that distinction looks like in dollars.
4. ⚠️ **A reader comparing a TT New York city's General Fund against its own
   published ACFR will find a different number**, with no explanation visible
   on the page. That is a reader-facing problem this document does not fix.

### Not done here, and deliberately

Nothing was changed, hidden, or adjusted to make the figures agree. **The
Milledgeville rule applies**: a verified figure is loaded and flagged, never
edited for looking wrong. Every figure in §4 is as published by its publisher.

### Open questions for Chris

1. Should the NY `general_fund` rows carry a caveat that OSC's city AFR
   excludes a dependent school district? This is the reader-facing half of §6.4
   and it is a product decision, not a data one.
2. Albany's +2.0M/+5.2M and Utica's +5.2% remain unexplained. Worth a line-item
   trace, or acceptable as self-reported-vs-audited drift?
3. FY1995-2012 has no audit route at all (§5). Accept, or seek another oracle?
4. **Should TT load the 692 school districts?** (§4.2) They are in the same
   archive, the same static zip, the same two schema eras, and the same loader
   shape. It would make New York's picture complete rather than city-only --
   and it is the direct answer to "why is this number smaller than my city's
   ACFR". It is also a second load of comparable size and its own scope
   question (a school district's `A` fund is its General Fund, but the ARM's
   fund letters for districts were not read for this work).
