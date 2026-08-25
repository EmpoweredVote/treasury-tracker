# NC-DURHAM-AVL-01 — Closeout

**City of Durham · Durham County · City of Asheville · Buncombe County**
North Carolina's first LOCAL entities. The state previously had only its state
node (FY2012–FY2025, from the state-ACFR arc).

Branch `feat/nc-durham-asheville-onboarding`.

---

## 1. What shipped

| Entity | Type | County link | FY window | Years | Rows | Primary reader |
|---|---|---|---|---|---|---|
| City of Durham | `city` | Durham County | FY2009–FY2024 | 16 | 32 | `pdftotext -table` |
| Durham County | `county` | — | FY2005–FY2025 | 21 | 42 | glyph coordinates |
| City of Asheville | `city` | Buncombe County | FY2009–FY2025 (14 of 17) | 14 | 28 | glyph coordinates |
| Buncombe County | `county` | — | FY2008–FY2025 (unbroken) | 18 | 36 | `pdftotext -table` |

**138 rows.** General Fund GAAP actuals, `general_fund / actual /
primary_government`, **whole dollars** for all four, **July–June fiscal year**
(`fiscal_year_start_month = 7`, `source_date = <FY>-06-30`) — statutory for every
NC local unit under **N.C.G.S. 159-8(b)**, and matching the NC state node already
in the table.

Populations, US Census PEP Vintage 2024: Durham 301,870 · Durham County 343,628 ·
Asheville 94,992 · Buncombe County 279,210.

Every one of the 138 rows ties at **exactly $0** through its primary reader.

---

## 2. The load-bearing lessons

### ⚠ The issuer guard, and why its first version was wrong

Buncombe County and the **Buncombe County Board of Education** ("Buncombe County
Schools") each publish an ACFR. The schools' FY2024 report is a genuine 137-page,
4.9 MB PDF whose cover reads *"Buncombe County Board of Education / Asheville,
North Carolina / Annual Comprehensive Financial Report / For the Fiscal Year
Ended June 30, 2024"*, and it **outranks the county's own report in web search**.
Magic bytes, byte size, page count and the fiscal-year assertion all pass on it
untouched.

The first guard required the issuer's name and forbade the neighbour's. **It
accepted the impostor** — verified against the real file, not reasoned about:

- "Buncombe County Board of Education" *contains* "Buncombe County", so the
  required name matches the wrong document. The county's own covers read
  "BUNCOMBE COUNTY, NORTH CAROLINA", never "County of Buncombe", so the name
  cannot be tightened to exclude the school board.
- Every genuine county ACFR mentions its Board of Education as a **discretely
  presented component unit**, so forbidding that phrase outright rejects every
  real year. The escape hatch that fixed *that* is exactly what let the fake one
  through.

A cover-page-only rule does not rescue it either: **21 of the 58 reports have an
image-only page 1** (`pdftotext` yields one character), so it could not verify
36% of the corpus.

**The rule that holds requires positive evidence of authorship** — an any-of
governing-body marker, measured across all 58 files:

| Corpus | Marker | Impostor |
|---|---|---|
| Durham County (21/21) | `county manager` | absent |
| Buncombe County (18/18) | `county manager` + `board of commissioners` | absent |
| City of Durham (16/16) | `mayor` + `city council` + `city manager` | absent |
| City of Asheville (14/14) | `mayor` | absent |
| Buncombe County Schools | — | `superintendent`, `board of education` |

`city council` alone would have failed on Asheville FY2024–25, which is why
`governing` is an **any-of set**, not a single pattern.
`tests/ncAcfrSources.test.mjs` pins this against the real front matter of both
documents, including regression tests for the two facts that broke version one.

### ⚠ A sign flip found in shipped code

Asheville FY2022 emits its **negative** investment earnings as two words 0.1 pt
apart — a lone `(` then `372,058)`. `merge_split_numbers` required every fragment
to contain a **digit**, so the lone paren never merged and `parse_money` returned
**+372,058 for a printed (372,058)**.

The components then over-summed the printed total by exactly
2 × 372,058 = **744,116**, which is the only reason it surfaced. **Had that row
been last, or the statement printed no total, the sign would have shipped
inverted.** Fixed as `acfrPrintedTotal._is_lone_open_paren`, which merges
**forward only**, so a bare paren can never be absorbed onto a completed number.

This touched the module El Paso County depends on, so Colorado was **re-verified
rather than assumed**: `acfrGF.selftest.py` 166/166 and `verify-colorado.mjs`
64 rows / 58 corroborated / ALL CHECKS PASSED.

`verify-nc.mjs` CHECK 11 now compares the **count of negative components**
between reader and database on every row, because a sign flip moves a total by
twice the figure and is invisible to any check on absolute values.

### ⚠ The reader is chosen per ENTITY, on a diagnosed cause

Picking per *year* whichever reader happened to tie $0 is **curve-fitting** — the
error that got the LA-01 scope verdict retracted. Each coordinate-read entity is
there for a mechanical failure identified by arithmetic that lands on the dollar:

- **Durham County** — `-table` renders the General Fund column at **two character
  offsets** in FY2006–FY2011. FY2008's four dropped rows sum to
  1,049,599 + 4,859,005 + 2,062,145 + 659,642 = **8,630,391**, which *is* the tie
  delta `-table` reports. Same mechanism as El Paso County FY2020 and Austin
  FY2002–FY2009.
- **City of Asheville** — FY2021/FY2022 **letter-space every glyph** on the page
  ("A d valo rem taxes", "T o t a l e xpe ndit ure s"), so not even the printed
  totals that *qualify* the page match. `label_fixes` cannot reach it: the page
  is rejected before any label repair could run.

The other reader is kept as an **independent cross-check** on every year it can
still read, and rows it cannot read are reported **by name** as single-reader,
never folded into the pass count.

### ⚠ `CityConfig.exclude_ignore` (new, defaults empty)

Buncombe County FY2011–FY2018 print the **government-wide reconciliation at the
foot of the fund statement itself**, so the genuine primary page carries
`reconciliation` and `net position` — two words `_EXCLUDE` treats as proof a page
is *not* the primary statement. Without the override those eight years report
"statement not found" and the county's series has a seven-year hole through its
middle.

The value is **validated against `_EXCLUDE` at construction**: a typo would
disable nothing while looking like it had. Because it *widens* which pages can
qualify, `verify-nc.mjs` re-derives every Buncombe year through the coordinate
reader, which finds its own page independently.

### ⚠ A welded label that passed every gate — and the check that now catches it

**Eleven of Buncombe County's operating rows shipped the category
`Intergovernmental Education`.** The county prints `Intergovernmental:` as a
**root-level group heading** with `Education` as its only child; the `-table`
reader, not told that `intergovernmental` is a parent, read the heading as a
wrapped label and fused it onto its child.

**Every existing gate passed.** The extractor tied at exactly $0 — a weld moves
no money. CHECK 1 passed: the total is unaffected. CHECK 2 passed: the heading
carried $0, so the **leaf multiset is identical either way**. The fragment-label
check passed: `Intergovernmental Education` is not a fragment. It surfaced only
**incidentally**, when an unrelated glyph defect on FY2008 forced a component
comparison that happened to disagree.

The placement was then decided on **measured indentation, not on plausibility** —
"intergovernmental spending sounds like a current cost" would have nested it
under `Current:` and inflated that subtotal by the county's entire education
transfer ($79,225,390 in FY2015) while still tying at $0. FY2015 glyph x0:

```
Current:                47.40   <- root
  General government    55.68
Intergovernmental:      47.40   <- ROOT, same depth as Current
  Education             55.68
Capital outlay          47.40   <- root
Debt service:           47.40   <- root
```

Fixed by `parents=('current', 'intergovernmental', 'debt service')`, all 16 years
re-extracted (totals unchanged, ties still $0) and the 16 operating rows
reloaded. FY2021+ drop the heading, so the entry simply never matches there.

**`verify-nc.mjs` CHECK 12 now compares root-level subtotals** between document
and database — the only check in the harness that can see a weld. Compared as
*amounts*, never as label strings, because the two readers legitimately render
labels differently on documents that fuse or split glyphs.

### ⚠ The same defect in the other direction — and the checker was the guilty one

CHECK 12 then caught a root-structure disagreement on **Asheville FY2023** — and
this time **the stored data was right and the CHECKER was wrong.** Worth stating
plainly: a disagreement does not say which side is at fault.

The city renames its GASB-87/96 lease-debt heading **every year**:

| FY | Heading |
|---|---|
| 2021 | *(absent — pre-GASB-87)* |
| 2022 | `Leases` |
| 2023 | `Leases/SBITA's` |
| 2024 | `Lease/subscription debt service` |
| 2025 | `Lease/subscription debt service` |

`extractAsheville.py` (the `-table` cross-check) declared only the FY2024
wording, so on FY2023 the heading fell through as a wrapped label and welded
onto its own child — producing a category literally named
`Leases/SBITA's Principal`. The coordinate reader, which **loads** this entity,
reads the hierarchy from printed indentation and was unaffected.

That contrast is the argument for the coordinate reader: a hand-declared
`parents` list is a standing bet that the issuer will not rename anything, and
this issuer renamed the same heading **three times in four years**.

### ⚠ A PDF that FUSES its words — the inverse of Asheville

City of Durham **FY2023** renders under pdfplumber with **no spaces at all**:
`CITYOFDURHAM,NORTHCAROLINA`,
`StatementofRevenues,ExpendituresandChangesinFundBalances`, `Totalrevenues`.
Every `\s+` in the coordinate family failed on it, so the whole family reported
"statement page not found" for a statement plainly there — and that year would
have had **no independent corroboration at all**.

This is the exact inverse of Asheville FY2021/22, which *splits* every word, and
the same class as the `June\s*30` gap already in the fiscal-year regexes.
Widened `\s+` → `\s*` in the title, total-row and continued-page regexes, and
made the page-qualifying substring tests match with whitespace collapsed. FY2023
now reads and ties at $0 (261,479,460 / 238,584,751), corroborating the loaded
figures. Colorado re-verified after the change: **ALL CHECKS PASSED**.

### ⚠ Structural absences that look exactly like mis-parses

Two entities publish **fewer expenditure categories in their early years**, and
the tie still passes:

- **City of Durham FY2016–FY2021** — one category, not two.
- **Durham County FY2005–FY2021** — one category, not two or three.

Both are **genuine**. Each General Fund prints a dash for its debt-service lines
(the debt sat in a separate Debt Service Fund, which Durham County's own MD&A
names as a major fund), and the `Current` children sum exactly to the printed
`Total expenditures`. Confirmed by **both readers independently** — `-table`
reports them in `zero_rows`, the coordinate reader reports `cell: "dash"` —
because "a category vanished for seventeen years and the tie still passed" is
precisely the shape a mis-parse takes.

---

## 3. Retrieval — four hosts, four problems

| Entity | Trap |
|---|---|
| City of Durham | DocumentCenter ids are **not monotonic in fiscal year** — FY2010–16 were re-uploaded in 2020 above FY2017's id, so any year-from-id inference mis-assigns seven years |
| Durham County | **Five naming conventions in 21 years**; skips exactly FY2014 in an otherwise unbroken run; and **misspells its own name** in the FY2025 filename (`Duhram`) |
| City of Asheville | Publishes to **Google Drive**, whose `/file/d/<id>/view` is a viewer page, not the bytes |
| Buncombe County | One series split across **three hosts**, with the GFOA rename landing *inside* one of them (FY2020 `comprehensive-annual-`, FY2021+ `annual-comprehensive-`) |

**The decoy is the theme.** All four issuers publish a second, shorter annual
document beside the ACFR, and on three of four hosts it sorts adjacent:

- City of Durham — "Citizens Financial Report" / "Durham Financial Report"
- Durham County — a PAFR **and** its real FY2020 ACFR named
  `FY-2020-Financial-Report.pdf`, the decoy convention applied to the genuine
  article
- Asheville — FY2021 ships **two** Drive links, one the single-audit "Compliance
  Audit"
- Buncombe — DocumentCenter **6519 is the FY2019 PAFR**, between 6518 (FY2018
  ACFR) and 6520 (FY2019 ACFR)

FY2020 Durham County is the reason **the filename is never the filter**; the
document's own content is.

---

## 3a. ⚠ Asheville was a five-year series because the city DELINKED its own archive

The first pass shipped Asheville as **FY2021–FY2025 only**, on the evidence that its ACFR
page lists nothing earlier. That was true of the page and **false of the city**.

Wayback snapshots of *the city's own page* — 2019-08 and 2021-12 — list Google Drive ids for
**FY2007 through FY2020**, and **every one of those files is still live on Drive**. The city
removed the links, not the documents. Nine years were recovered this way, taking Asheville
from 5 years to **14** and the milestone from 116 rows to **134**.

**The bytes are still first-party.** The archive was used only to *discover* the addresses;
every file is fetched from the city's own Drive at load time and `source_url` records that
live URL, never a `web.archive.org` one. Had a file been gone from Drive, the honest options
were a Wayback-sourced row **labelled as such**, or no row — not a silent archive fetch under
a first-party URL.

⚠ **The lesson generalises past this entity:** "the issuer publishes only N years" is a claim
about a *page*, and a page is not an archive. Checking the issuer's own historical page cost
one CDX query and returned nine years.

⚠ **FY2019 and FY2020 are a different kind of gap from anything else here** — those documents
were published and are now **gone** (HTTP 404). Recovering them needs the NC LGC, whose
FY2019–FY2021 archive is a JavaScript app with no file listing and whose FY2022+ sibling is a
Power Apps portal behind `/_services/entity-grid-data.json`, or a request to the city.

### ⚠ And Buncombe's two-year hole was a NAMING gap, not an absence

Buncombe first shipped as FY2008 + FY2011–FY2025, with FY2009 and FY2010 recorded as *"not
published anywhere the county exposes"*. The evidence for that was real — every two-digit year
and several casings were probed against the flat `cafr/CAFR<yy>.pdf` scheme, and both 404 —
but it was evidence about the **scheme**, not about the county.

Asking the archive what the county *used to* publish turned up a **fourth naming convention**:
a per-year subdirectory, with a different filename inside each one.

| FY | Path | Filename pattern |
|---|---|---|
| 2007 | `cafr/cafr07/CAFR2007.pdf` | 4-digit year |
| 2009 | `cafr/cafr09/cafr.pdf` | **no year at all** |
| 2010 | `cafr/cafr10/CAFR10.pdf` | 2-digit year |

**All three are live on the county's own host.** The archive was used only to learn the
convention existed. Buncombe is now **FY2008–FY2025 unbroken, 18 years**.

⚠ Note what made this findable: not a cleverer guess at filenames, but asking a *different
question* — "what has this host ever served?" rather than "does this name resolve?". The full
`cafr/*` index also settled FY2005 and FY2006 as genuinely never published, which no amount of
name-probing could have established.

---

## 4. Diagnosed absences

| Gap | Cause |
|---|---|
| City of Durham FY2025 | Upstream — the city has published its FY2025 *Citizens* Financial Report, not its FY2025 ACFR |
| Buncombe County FY2005, FY2006 | **Never published** — the archive's full index of `common/finance/cafr/*` contains exactly four subdirectories (`cafr07`–`cafr10`) |
| Buncombe County FY2007 | ⚠ **Retrievable and still unreadable.** Its largest revenue line, `Ad valorem taxes` at **$139,141,442**, produces **no token in either reader**, and its font has a broken ToUnicode CMap (labels render as `(cid:51)(cid:72)…` / `3HUPLWVDQGIHHV`, every character displaced by 29). The figure is *arithmetically forced* by the printed total (246,360,973 − 107,219,531) and is **still not loaded**: recovering a line item by subtracting the rest from the total is **deriving** a figure, not reading one, and it would tie at $0 by construction so the tie gate would confirm nothing |
| City of Durham FY2004–FY2006 | ⚠ **Retrievable, parseable, and deliberately not loaded.** They exist only in the Internet Archive — the city's legacy host `ci.durham.nc.us` is dead. All three extract cleanly at $0 ($146.6M / $162.9M / $168.5M revenue, slotting in coherently ahead of FY2009's $196.6M). **Chris's call: keep the invariant that every stored figure has a live, first-party `source_url`.** Loading them would have needed a new provenance class saying so on screen |
| City of Durham FY2001–FY2003, FY2007, FY2008 | FY2001–03 are published as **dozens of per-page PDFs** (`cafr_01/001.pdf`, `003.pdf`, …); FY2007's archived snapshot is not replayable; FY2008 is not archived anywhere found |
| City of Asheville FY2007, FY2008 | **Image-only scans** — 292 and 172 characters of text in 183 and 172 pages. No text layer to read |
| City of Asheville FY2013 | **Hybrid scan** — only 18 of its 240 pages carry text, and the fund statements are not among them (the auditor's report page is born-digital, the statements are images) |
| City of Asheville FY2019, FY2020 | ⚠ **Published, then DELETED.** The Drive ids are recorded from the 2021-12 snapshot and both now return HTTP 404. Every other id from the same snapshots still resolves, so this is deletion by the city, not rot in the archive |

⚠ **Accepted, not fixed:** a missing year is silent about *why*. Buncombe offers
FY2008 then jumps to FY2011 with nothing telling a visitor those reports were
never published. Same open item CO-SPRINGS-EPC-01 recorded for El Paso FY2006–08.
A per-year "published but not machine-readable / not published" note would close
it.

---

## 5. Verification

`scripts/verify-nc.mjs` — 12 checks, reading the database and re-deriving from
the PDFs by routes sharing no code with the loader that wrote each row. The four
entities are cross-checked **in opposite directions**: the two `-table`-loaded
entities are checked by glyph coordinates, the two coordinate-loaded entities by
`-table`, and `acfrPrintedTotal.py` runs as a third route on every row it can
read.

A database self-check would be **tautological** — the loader computes the total
as the sum of the nodes it passes to the RPC, so `total = Σ items` agrees by
construction and passes on a completely mis-parsed statement.

**Result: ALL CHECKS PASSED. 138 rows checked, 121 corroborated by a second
implementation.**

The **17 uncorroborated rows are named**, never folded into the pass count, and
each has a diagnosed cause:

| Rows | Reason |
|---|---|
| Durham County FY2006–FY2011 (12) | `-table` renders the GF column at two character offsets |
| City of Asheville FY2021–FY2022 (4) | the PDFs letter-space every glyph |
| Buncombe County FY2008 operating (1) | the issuer **overprints** one row, so pdfplumber sees every glyph doubled (`ddeevveellooppmmeenntt`, `77553388887766`). The `-table` reader is unaffected and ties at $0, and `acfrPrintedTotal` agrees on the total, so the stored figure is right and it is the *checker* that cannot read the page |

⚠ **CHECK 8 earned its place during this milestone.** Reloading Buncombe's 16
operating rows after the label fix re-created them with the column DEFAULT
`unknown`, and the check flagged all 16. The axes were re-stamped and confirmed
in SQL: all 116 rows on `general_fund / actual / primary_government`.

---

## 6. Scope classification

A new **`nc-local-acfr-gf`** family in all three axis registries, evidenced by
**eleven probes** across all four entities — at least two each, one recent and
one from the hardest era of its corpus. Asheville carries five, because nine of
its years were recovered later and come from an **earlier era of the city's
typesetting**, so the column layout could not be assumed to carry back: FY2009,
FY2015 and FY2018 were probed as well, and all three close the additive identity
exactly (GF at 90.2% / 95.4% / 92.6% of total governmental revenue).

`scripts/ncScopeProbe.py` identifies the Total Governmental column by a
**self-validating additive identity** (the other fund columns must sum to it
*exactly*) rather than by taking the rightmost number, which on a statement whose
last column is a nonmajor fund is silently wrong by the size of that fund.

| Probe | GF revenue / expenditure | Total Governmental | GF share |
|---|---|---|---|
| Durham City FY2024 | 272,219,369 / 258,674,094 | 387,053,497 / 373,281,225 | 70.3% / 69.3% |
| Durham City FY2012 | 173,529,729 / 168,283,156 | 220,820,108 / 250,083,705 | 78.6% / 67.3% |
| Durham County FY2024 | 653,273,050 / 558,341,960 | 698,294,751 / 821,398,625 | 93.6% / 68.0% |
| Durham County FY2008 | 410,763,108 / 373,328,462 | 430,812,088 / 463,732,424 | 95.3% / 80.5% |
| Asheville FY2024 | 165,122,861 / 158,194,252 | 179,393,546 / 195,930,715 | 92.0% / 80.7% |
| Asheville FY2022 | 153,677,325 / 130,597,069 | 173,494,316 / 164,070,306 | 88.6% / 79.6% |
| Buncombe FY2024 | 406,010,643 / 416,293,947 | 616,166,627 / 651,997,848 | 65.9% / 63.8% |
| Buncombe FY2015 | 289,342,572 / 286,305,444 | 360,732,789 / 447,781,825 | 80.2% / 63.9% |

⚠ **Durham County is the weakest discriminator on the revenue side** — its
General Fund is 93–95% of total governmental *revenue*, because its capital
projects funds are financed by debt issuance, an **other financing source** and
not revenue. That is why the expenditure side is stated alongside it: there the
same county is 68.0% / 80.5%. A registry entry resting on the 93.6% figure alone
would have looked thin and been thin.

⚠ **Recorded, not corrected:** Buncombe states *"The Reappraisal Reserve Fund is
legally budgeted, but is consolidated into the General Fund for reporting
purposes."* That is the issuer's own GAAP General Fund column — the column stored
— so the scope label is right, but a reader comparing TT against the county's
**budget ordinance** would otherwise find an unexplained difference.

Partition gates green on both writers with **no pre-existing count moved**:
`classifyFundScope` 78,416 claimed + 9,426 unknown = 87,842/87,842;
`stampBudgetAxes` the same on basis and reporting_entity. Table total moved
**87,726 → 87,864, exactly +138**.

---

## 7. Gates

| Gate | Result |
|---|---|
| `npm test` | 632/632, 41 files |
| `npm run build` | clean |
| `acfrGF.selftest.py` | 166/166 |
| `verify-colorado.mjs` | 64 rows, 58 corroborated, ALL CHECKS PASSED (re-run after the paren fix **and** after the El Paso refactor) |
| Extraction tie gate | 138/138 rows at exactly $0 |
| `verify-nc.mjs` | **ALL CHECKS PASSED** — 138 rows, 121 corroborated, 17 named single-reader |
| `classifyFundScope --dry-run` | partition gate ✅ |
| `stampBudgetAxes --dry-run` | partition gate ✅ |

`extractElPasoCountyCoords.py` was collapsed onto the shared
`lib/acfrGfCoords.py` — proved by running all 26 El Paso years through both
implementations in both modes: **52/52 byte-identical**.

---

## 8. Open items

1. **UAT not yet run.** No milestone is done until a human has seen the figures
   on screen. This is the only outstanding gate.
2. **A missing year is silent about why** (§4) — carried over from
   CO-SPRINGS-EPC-01, not introduced here.
3. **NC LGC AFIR remains the bulk-source milestone for North Carolina.** It
   covers every NC county and municipality, but it is **self-reported** (a lower
   audit grade than these ACFRs) and 2012+ sits behind the stateful LOGOS web app
   with no bulk export — the same trap as the CO DOLA compendium. Only 1994–2011
   has direct downloads. Scoped out of this milestone deliberately.
