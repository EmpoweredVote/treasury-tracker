# Georgia DCA RLGF — the FY2009–2015 form generation ("V1")

Companion to `GA-RLGF-RECON.md`, which covers the FY2016–2025 generation ("V2",
the one with a `LOAD1` sheet). Read that first: the access route, the CICOID
selector, the audit grading and the Milledgeville Rule all carry over unchanged
and are not repeated here.

This document records what was **measured** on 222 FY2009–2015 workbooks
(34 governments: 81 county, 109 municipal, 32 consolidated filings), fetched
2026-10-19 and byte-proven, converted with `xlsToXlsx.py --check`
(1,279,506 cells round-trip).

---

## 1. Why there are two readers, and how one is chosen

DCA changed the workbook between FY2015 and FY2016. The two generations share a
URL pattern, a CICOID space and a government roster, and share almost nothing
else inside the file.

| | V2 — FY2016–2025 | V1 — FY2009–2015 |
|---|---|---|
| extract sheet | `LOAD1` | `Exportable Data` **and a redundant `Data` twin** |
| key space | UCOA codes (`31_1100`, `4400A`) | **V-codes — the form's own line numbers** (`401`) |
| where the key is printed | a dedicated code column | **beside its own money cell** |
| Part V shape | 7 sections × 77 functions | **flat: 36 functions, no sections** |
| Part V object columns | 4 | **3** |
| revenue roots | 1A 1B 1C 1D · 2 · 3A 3B | **the same 7** |
| Part numbering | VII capital, VIII personnel, X intergov exp, XI debt | **VII personnel, VIII intergov personnel, IX intergov exp, X debt, XI cash** |

⚠⚠ **THE READER IS CHOSEN BY THE SHEET, NEVER BY THE FISCAL YEAR.** The sheet is
a fact about the file in hand; the year is an inference about what DCA did that
year. `LOAD1` present → V2. `Exportable Data` present → V1. Neither → refuse by
name. A file that somehow carries both is a refusal too, not a preference.

⚠ The loaded Parts are numbered **identically** in both generations — I taxes,
II intergovernmental revenue, III service charges, V expenditures, with IV and
VI the excluded enterprise tables. It is only the UNLOADED parts that renumber.
Do not "fix" a V1 Part VII reference against the V2 meaning.

---

## 2. `Exportable Data` and `Data` are the same table twice

Both sheets hold the identical block structure — `REV1 REV2 REV3 EXP1..EXP5
DET1..DET5 AUTH_LIST FNLOG` — each block being a marker row, a `CICOID` header
row, and exactly one value row. Measured across all 222:

| | count |
|---|---|
| keys agreeing | 122,992 |
| keys disagreeing | 270 |
| **`#REF!` in `Data`, real value in `Exportable Data`** | **5,770** |
| `#REF!` in `Exportable Data`, real value in `Data` | 8 |
| **`#REF!` in both** | **2** |

So the two copies **shadow each other**, and the V1 reader uses both: a figure is
taken from the page, and corroborated against *each* extract copy independently.
Where the copies disagree with one another, the disagreement localises the break
rather than merely flagging it — a capability V2 never had.

⚠⚠ **`Data` CARRIES EXACTLY 34 ERROR CELLS IN ALL 222 WORKBOOKS** — a perfect
constant, independent of entity, size and year. They are `DET5` (26) +
`tblAuthority_list` (5) + `FN_Log` (3), none of them a revenue or expenditure
flow. This is a fixed template artifact, **not** per-filing damage, and it is
the whole of the "1,393 `#REF!` cells" that deferred this work twice. The 2
cells errored in both copies are Athens-Clarke FY2012/FY2013 `V1213`, in `DET5`
— also outside the loaded flows.

⚠⚠ **NEVER READ `MO` FROM THE `Data` SHEET.** It is one of the 270 divergences
and it is garbage there — Banks reads `2005`/`2007`/`2009`, Cobb and DeKalb read
`0` — while `Exportable Data` reads the true `June 30` / `September 30`.

---

## 3. Page geometry, declared

⚠⚠ **DECLARED EXPLICITLY, NEVER SCANNED.** On this form a $402 expenditure and
V-code 402 are the same bare integer in adjacent columns; there is no way to
tell them apart by value. An early census that guessed codes by numeric range
reported 31 distinct Part V shapes. Re-run with declared columns it reported
**one**. That gap is the whole argument for this section.

Zero-indexed columns. `money`/`code` are positional pairs.

| page | part | label | money | code | notes |
|---|---|---|---|---|---|
| Page 1 | I | 0 | 5 | 7 | sections A–D |
| Page 2 | II | 0 | 5, 9, 11 | 6, 10, 12 | three source columns |
| Page 2 | III | 0 | 11 | 12 | sections A–B |
| Page 3 | V | 0 | 7, 9, 11 | 8, 10, 12 | three object columns |

⚠ **Columns 11–12 of Page 1 hold the government dropdown list** (`Bartow County`
/ `1008008`, …) bleeding into the sheet. They are not data and are never read.
Page 1's money is column 5 and nothing else.

⚠ **Page 2 Part II column 7 is `Govt ID No.`** — a text field with its own
V-code in column 8. It is not money and is not summed. The money pairs are
(5,6) state, (9,10) other local governments, (11,12) federal.

⚠⚠ **TWO MEMO ROWS SIT *AFTER* `Total Part II`** — "General revenue sharing"
(V257–V260) and "Physical health and mental health grants" (V261–V264). They are
outside the Part II total by the form's own arithmetic. Reading to the end of the
section folds them in and overstates intergovernmental revenue.

⚠⚠ **Page 2 row 43 column 9 is a MEMO, not money.** "Fines, forfeits and court
costs" carries an annotation cell reading "Portion in Blk 312 derived from …"
with its own figure in column 9, and the reported figure in column 11. Summing
the row double-counts.

⚠ **Part III's own printed totals are ragged**: `Total Section A` puts its money
in column 10 while its items are in column 11, and `Total Section B` is back in
column 11. This never matters, because of §4.

---

## 4. Items from the page, subtotals from the extract

This mirrors V2 exactly and is not a new decision: `checkSectionTotals` has
always read `TTL_*` from the extract while values came from the pages.

* **Values and labels: the printed page.** It is the form the government filed,
  and the extract is derived from it by cell reference — so agreement is by
  construction and it is the disagreements that carry information.
* **Subtotals: `Exportable Data`, cross-checked against `Data`.** This sidesteps
  the ragged total columns of §3 entirely.

⭐ **V1 is strictly easier to join than V2.** The page prints the extract's own
key beside each money cell, so the page↔extract join is exact. V2 needed
`aliasBareCodes` and `parseCodeCell` because the printed UCOA code dropped its
suffix; none of that class of trap exists here.

⚠ **V-code cell types are mixed.** "Parks and recreation" stores codes `'473'`
and `'474'` as strings while `475` is a number, in all 222 workbooks. Every
V-code is coerced to string on both sides of the join. A lookup that does not
would silently lose that one function's money.

---

## 5. The trees

### Revenue — the same 7 roots as V2

`1A` `1B` `1C` `1D` (Part I sections A–D) · `2` (Part II) · `3A` `3B`
(Part III sections A–B). The leaf vocabulary differs from V2, but the roots are
identical, so a revenue series runs continuously across the generation boundary
at root level.

### Expenditure — flat, as printed

36 functions, V-codes 401–508, three object columns summed per function; the
root is `TOTAL PART V` (V509/V510/V511). Verified as **one single shape across
all 222 workbooks**.

```
General administration and support services   401 402 403
Financial administration                      404 405 406
Tax commissioner                              407 408 409
...
Public utility systems                        500 501 502
Legal fees                                    503 504 505
Other expenditures - Attach list              506 507 508
TOTAL PART V                                  509 510 511
```

⚠⚠ **TT DOES NOT INVENT THE 7 SECTIONS HERE.** The printed V1 Part V has no
section headings at all. Grouping the 36 functions under V2's `5A`–`5G` roots
would assert a structure the publisher never printed in this generation — the
"uniform is not correct" trap from the fiscal-month arc, and the same instinct
the Milledgeville Rule exists to resist. The V1 expenditure tree is 2 levels and
the V2 tree is 3; that discontinuity is a true fact about the source.

⚠ `Public utility systems` (V500–502) is a **Part V** function and counts toward
Total Part V. Part VI is a separate enterprise table and stays excluded, exactly
as in V2. Do not confuse them.

---

## 6. The oracle

| | revenue | expenditure |
|---|---|---|
| V2 | 7 section checks + part rollups | 7 section checks |
| **V1** | **the same 7 roots** | **1 check** — V509/V510/V511 |

A flat Part has one subtotal, so the expenditure oracle is weaker by
construction. What compensates is the **three-way cell check**: 36 functions ×
3 columns = 108 expenditure cells, each verified against two independent extract
copies. V2 had one extract and therefore one opinion per cell.

Measured on the 222-filing sample, the refusal rule does not bite:

| refusal rule, as read | refused | survive |
|---|---|---|
| any error cell anywhere in the workbook | 222 | 0 |
| any error in `Exportable Data` | 6 | 216 |
| any error in a `REV*`/`EXP*` flow block | 4 | 218 |
| **a subtotal the oracle reads is an error** | **0** | **222** |

All four flow-block hits are the same pair in the same year — `V312`/`V312A` in
`REV3`, FY2014 only, in every FY2014 workbook examined — and **all four are
recoverable from the `Data` twin**. The only printed-form errors in the sample
are Danville FY2009's four `#N/A`, every one in an unlabelled spacer row.

⚠ A skipped check is reported and never counted as a pass. That rule is
unchanged and is the reason this generation could be scoped at all.

---

## 7. ⚠⚠ Dropping below the FY2016 floor un-protects the consolidated governments

`GA-STATEWIDE-SWEEP.md` records that 8 counties file nothing in FY2016–2025 —
exactly the 8 with a consolidated counterpart — and that *"Bibb's county-prefix
filings stop at FY2013 and Echols' at FY2010, both below the FY2016 floor, so
nothing double-counts."*

**That protection is a side effect of the floor, and this work removes it.**
Below FY2016 a county-prefix CICOID and its consolidated successor can both have
filed for the same fiscal year, and loading both would count one government
against itself twice.

The register `GA_CONSOLIDATION_OVERLAP` names, per consolidated government, the
county-prefix CICOID it absorbed and the first fiscal year from which the
consolidated entity is the reporting government. A county-prefix filing at or
after that year is **refused by name**, never dropped silently.

---

## 8. Window constants

`GA_LOAD_WINDOW` becomes `GA_FORM_GENERATIONS`:

```js
{ v1: { first: 2009, last: 2015 }, v2: { first: 2016, last: 2025 } }
```

because the window now *selects a reader* rather than merely bounding a loop.
The three pinned sites move together with their test:
`buildGaStatewideEntities.mjs`, `georgiaRlgfEntities.mjs`,
`fetchGeorgiaRLGF.mjs`, and `gaStatewide.test.mjs`.

⚠ DCA lists **FY2008** (3 filings, 3 governments) and **FY2026** (6 filings).
FY2008 is probed and admitted only if it reads as the V1 generation; FY2026 is a
question about the V2 ceiling and is out of scope here.

✅ **Atlanta reports a June 30 year-end (start month 7) in all seven years**, and
**0 of the 34 sampled governments change calendar inside FY2009–2015**. The
older note about Atlanta changing calendar via a 6-month stub in 2006 describes
a period DCA does not serve at all, and is not carried forward.
