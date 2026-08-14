# Seattle + King County — independent re-derivation and source-chain audit

**Task 13 of the Seattle WA + King County onboarding plan.** Written 2026-08-14.
Branch `feat/seattle-king-county-onboarding`.

| Harness | Command | Result | Exit |
|---|---|---|---|
| Blind re-derivation | `node scripts/verify-seattle-rederive.mjs` | **PASS** — 50/50 FY × mode tie at exactly $0 | 0 |
| Six-check audit | `node scripts/verify-seattle-audit.mjs` | **PASS** — all six checks | 0 |
| Essentials tether | `node scripts/verify-seattle-tether.mjs` | Seattle **COVERED**, King County **COVERED** | 0 |

---

## 1. What "independent" means here

The extractors must not be able to vouch for themselves. `scripts/verify-seattle-rederive.mjs`
does **not** import, require, or shell out to `scripts/extractSeattle.py`,
`scripts/extractKingCounty.py` or `lib/acfrGF.py`. It re-reads each of the 25 source PDFs with
its own `pdftotext -table` call and a from-scratch JS parser, then diffs the result
leaf-for-leaf and subtotal-for-subtotal against the live production database.

Every mechanism was built differently on purpose, so that a shared blind spot would have to
survive two unlike implementations:

| Concern | Python loader | This harness | Independent? |
|---|---|---|---|
| Statement page | anchors on the schedule id `B-4` | structural scoring: title + both `Total` rows + a General-Fund column caption + a page-type exclusion list | **yes** — and the filter leaves *exactly one* candidate on all 50 combinations, so "first survivor wins" never decides anything. The count is printed per run. |
| Section bounds | scans **forward** from a header guarded by a five-layer prefix test | finds the `Total …` row and scans **backward** to the nearest header, which makes the document title unmatchable by construction (it contains *both* section words) | **yes** |
| Units | reads `units: 1000` from a config dict | reads `(In Thousands)` off the page and refuses to run if the page does not declare a scale; multiplier applied in exactly one function, to leaf values only | **yes** |
| Grouping | explicit `parents` / `root_leaves` / `revenue_group_members` name lists | derived from the statements: GASB's character classification on the expenditure side, and "a revenue line whose label ends in *taxes* joins the open Taxes group" on the revenue side | **yes** — and it infers per-entity shape the Python has to be *told* (Seattle's `Capital Outlay` is a parent, King County's is a root leaf) |
| Fiscal year | reads the statement page's own period statement | reads the statement page's own period statement | **no — shared.** All 50 pages confirm their year from their own "year ended December 31, `<FY>`" sentence. Filenames are never trusted. |
| Column isolation | ordinal | **ordinal — the same strategy.** A positional attempt was tried first and *refuted by the documents* (§5). | **no — shared.** What protects this axis is the printed-vs-summed reconciliation, which is internal to the PDF. |

The last two rows are stated plainly because an earlier draft of this document and of the
harness header claimed the column strategy was an axis of independence. **It is not**, and a
verification artifact that overstates its own strength is precisely the failure this suite exists
to catch.

Tolerance is exact `$0` on every figure — grand total, every subtotal, every leaf, matched by
label as well as by value. There is no dispositioned quirk and no approximate mode.

The units check deserves a note: a *symmetric* scale error ties at $0 on both sides and is
invisible to a tie gate. This harness defeats that by reading the scale off the page rather
than being told it, and audit check (e) pins the two anchor figures in dollars.

---

## 2. FY windows actually loaded

| Entity | `municipality_id` | Window | Rows | Excluded years |
|---|---|---|---|---|
| Seattle (city, WA) | `6e1e8ab5-c8dd-4a6b-bfd7-a31e57120493` | **FY2009 – FY2025**, 17 consecutive years | 34 (17 × 2 datasets) | **none** |
| King County (county, WA) | `5d47592a-61d2-47ae-84ad-e869f1dd6208` | **FY2018 – FY2025**, 8 consecutive years | 16 (8 × 2 datasets) | **none** |

**No year was excluded, so the excluded-years table is empty and every `tie_delta` below is 0.**
That is worth stating plainly because the plan did not assume it: twelve of Seattle's seventeen
years and six of King County's eight had never been extraction-tested when the plan was written,
and the plan explicitly refused to promise they would pass. They all did.

Both entity ids were asserted, not trusted — the harness looks each entity up by
name/state/entity_type and fails if the id differs from the one Task 9 recorded.

### Per-combination results (all 50)

`page` is the printed PDF page the harness independently located; `units` is the scale it read
off that page.

| Entity | FY | mode | page | units | independent PDF ($) | live DB ($) | subtotals | leaves | delta |
|---|---|---|---|---|---|---|---|---|---|
| Seattle | 2009 | revenue | 68 | ×1000 | 942,408,000 | 942,408,000 | 7 | 7 | **0** |
| Seattle | 2009 | operating | 68 | ×1000 | 737,604,000 | 737,604,000 | 3 | 12 | **0** |
| Seattle | 2010 | revenue | 68 | ×1000 | 954,024,000 | 954,024,000 | 7 | 7 | **0** |
| Seattle | 2010 | operating | 68 | ×1000 | 737,702,000 | 737,702,000 | 2 | 10 | **0** |
| Seattle | 2011 | revenue | 70 | ×1000 | 1,000,344,000 | 1,000,344,000 | 7 | 7 | **0** |
| Seattle | 2011 | operating | 70 | ×1000 | 775,224,000 | 775,224,000 | 3 | 12 | **0** |
| Seattle | 2012 | revenue | 68 | ×1000 | 1,061,261,000 | 1,061,261,000 | 7 | 7 | **0** |
| Seattle | 2012 | operating | 68 | ×1000 | 772,904,000 | 772,904,000 | 3 | 13 | **0** |
| Seattle | 2013 | revenue | 68 | ×1000 | 1,098,175,000 | 1,098,175,000 | 7 | 7 | **0** |
| Seattle | 2013 | operating | 68 | ×1000 | 855,584,000 | 855,584,000 | 3 | 12 | **0** |
| Seattle | 2014 | revenue | 60 | ×1000 | 1,160,753,000 | 1,160,753,000 | 7 | 7 | **0** |
| Seattle | 2014 | operating | 60 | ×1000 | 897,493,000 | 897,493,000 | 3 | 14 | **0** |
| Seattle | 2015 | revenue | 64 | ×1000 | 1,218,733,000 | 1,218,733,000 | 7 | 7 | **0** |
| Seattle | 2015 | operating | 64 | ×1000 | 902,662,000 | 902,662,000 | 3 | 13 | **0** |
| Seattle | 2016 | revenue | 64 | ×1000 | 1,330,045,000 | 1,330,045,000 | 7 | 7 | **0** |
| Seattle | 2016 | operating | 64 | ×1000 | 1,021,753,000 | 1,021,753,000 | 3 | 13 | **0** |
| Seattle | 2017 | revenue | 61 | ×1000 | 1,404,724,000 | 1,404,724,000 | 7 | 7 | **0** |
| Seattle | 2017 | operating | 61 | ×1000 | 1,083,903,000 | 1,083,903,000 | 3 | 13 | **0** |
| Seattle | 2018 | revenue | 61 | ×1000 | 1,541,640,000 | 1,541,640,000 | 7 | 7 | **0** |
| Seattle | 2018 | operating | 61 | ×1000 | 1,548,449,000 | 1,548,449,000 | 3 | 16 | **0** |
| Seattle | 2019 | revenue | 58 | ×1000 | 1,685,569,000 | 1,685,569,000 | 7 | 7 | **0** |
| Seattle | 2019 | operating | 58 | ×1000 | 1,564,503,000 | 1,564,503,000 | 3 | 14 | **0** |
| Seattle | 2020 | revenue | 49 | ×1000 | 1,574,981,000 | 1,574,981,000 | 7 | 7 | **0** |
| Seattle | 2020 | operating | 49 | ×1000 | 1,621,131,000 | 1,621,131,000 | 3 | 13 | **0** |
| Seattle | 2021 | revenue | 51 | ×1000 | 1,975,716,000 | 1,975,716,000 | 7 | 11 | **0** |
| Seattle | 2021 | operating | 51 | ×1000 | 1,720,046,000 | 1,720,046,000 | 2 | 13 | **0** |
| Seattle | 2022 | revenue | 53 | ×1000 | 2,025,706,000 | 2,025,706,000 | 7 | 11 | **0** |
| Seattle | 2022 | operating | 53 | ×1000 | 1,821,526,000 | 1,821,526,000 | 3 | 15 | **0** |
| Seattle | 2023 | revenue | 55 | ×1000 | 2,178,269,000 | 2,178,269,000 | 7 | 11 | **0** |
| Seattle | 2023 | operating | 55 | ×1000 | 1,966,991,000 | 1,966,991,000 | 2 | 14 | **0** |
| Seattle | 2024 | revenue | 56 | ×1000 | 2,272,762,000 | 2,272,762,000 | 7 | 11 | **0** |
| Seattle | 2024 | operating | 56 | ×1000 | **2,390,575,000** | **2,390,575,000** | 2 | 13 | **0** |
| Seattle | 2025 | revenue | 59 | ×1000 | 2,407,090,000 | 2,407,090,000 | 7 | 11 | **0** |
| Seattle | 2025 | operating | 59 | ×1000 | 2,300,612,000 | 2,300,612,000 | 2 | 13 | **0** |
| King County | 2018 | revenue | 43 | ×1000 | 863,031,000 | 863,031,000 | 7 | 9 | **0** |
| King County | 2018 | operating | 43 | ×1000 | 770,097,000 | 770,097,000 | 3 | 6 | **0** |
| King County | 2019 | revenue | 43 | ×1000 | 915,992,000 | 915,992,000 | 7 | 9 | **0** |
| King County | 2019 | operating | 43 | ×1000 | 828,400,000 | 828,400,000 | 3 | 6 | **0** |
| King County | 2020 | revenue | 41 | ×1000 | 991,547,000 | 991,547,000 | 7 | 9 | **0** |
| King County | 2020 | operating | 41 | ×1000 | 915,529,000 | 915,529,000 | 3 | 6 | **0** |
| King County | 2021 | revenue | 43 | ×1000 | 1,002,618,000 | 1,002,618,000 | 7 | 9 | **0** |
| King County | 2021 | operating | 43 | ×1000 | 869,667,000 | 869,667,000 | 3 | 6 | **0** |
| King County | 2022 | revenue | 44 | ×1000 | 1,124,279,000 | 1,124,279,000 | 7 | 9 | **0** |
| King County | 2022 | operating | 44 | ×1000 | 983,521,000 | 983,521,000 | 3 | 8 | **0** |
| King County | 2023 | revenue | 44 | ×1000 | 1,103,432,000 | 1,103,432,000 | 7 | 9 | **0** |
| King County | 2023 | operating | 44 | ×1000 | 1,072,171,000 | 1,072,171,000 | 3 | 9 | **0** |
| King County | 2024 | revenue | 48 | ×1000 | 1,202,912,000 | 1,202,912,000 | 7 | 9 | **0** |
| King County | 2024 | operating | 48 | ×1000 | **1,137,458,000** | **1,137,458,000** | 3 | 8 | **0** |
| King County | 2025 | revenue | 46 | ×1000 | 1,163,048,000 | 1,163,048,000 | 7 | 9 | **0** |
| King County | 2025 | operating | 46 | ×1000 | 1,203,126,000 | 1,203,126,000 | 3 | 8 | **0** |

Each row is three figures agreeing, not two: the DB total, the harness's **summed** total, and
the **printed** `Total revenues` / `Total expenditures` cell the harness read out of the PDF
independently. A parse that dropped or duplicated a row would break the summed-vs-printed
comparison inside the PDF alone, before the DB was consulted at all.

---

## 3. The six audit checks

All six pass. `node scripts/verify-seattle-audit.mjs` → exit 0.

**(a) PASS — every row has a non-null, correct-per-FY `source_url` that resolves 200
`application/pdf`.** All 50 rows carry a URL; the two datasets of a given FY share one URL;
no two fiscal years share a URL; every URL carries its own fiscal year. All 25 documents
answered `200 application/pdf`. The check also asserts the exact
`(fiscal_year, dataset_type)` inventory, not merely the row count, so a row with an unexpected
dataset type or a year outside the declared window would be caught.

This check was strengthened beyond the plan's wording: for each of the 25 URLs the harness also
compares the **served content length** against the local PDF the re-derivation actually parsed.
All 25 match exactly. That closes the loop between "the figures are right" and "they came from
the document we cite" — without it, (a) would only prove that *some* PDF lives at that URL.

⚠ **This is a length comparison, not a hash.** Nothing is downloaded in full (a 1-byte ranged
GET reports the total), so it would not detect a same-size substitution at the same URL. Say
*length-matching*, never *byte-matching*. If a server omits `Content-Length` the check **fails
closed** rather than degrading to a note — "the server didn't tell us" must never read as
"verified".

⚠ Header trap, carried forward from Task 2: `web.archive.org` answers **HTTP 498** to the
desktop-Chrome `User-Agent` that `seattle.gov` and `cdn.kingcounty.gov` **require**. The audit
picks headers per host. A single shared header set cannot satisfy both.

**(b) PASS — `source_date` is `<FY>-12-31` on every row.** 50/50. Both entities have a
December 31 fiscal year end.

**(c) PASS — zero `data_sources` residue** matching `seattle-%` or `kingcounty-%`. The loaders
create an ephemeral registry row and delete it; nothing was left behind.

**(d) PASS — no label corruption.** 736 category and line-item labels scanned across both
entities. None contains a `--` dash run; none begins with a glued parent name
(`Taxes `, `Current `, `Capital Outlay `, `Debt Service ` followed by further text). These are
the two corruption classes this build actually hit and fixed during Tasks 4 and 5, so the check
is aimed at real history rather than hypothetical damage.

**(e) PASS — the units landed.** Read from the DB: Seattle FY2024 operating is exactly
`2,390,575,000` and King County FY2024 operating exactly `1,137,458,000`. This is the check a
tie gate structurally cannot perform, because a scale error applied symmetrically to both sides
still ties at $0.

**(f) PASS — exactly two *King County* rows cite `web.archive.org`,** both FY2018 (operating and
revenue), and both carry the `(via Internet Archive)` label in `data_source`. Seattle cites an
archive on 0 rows.

> ⚠ **This check is scoped to King County's `municipality_id`, deliberately.** It was originally
> specified as "exactly two rows in the entire `budgets` table", resting on the claim that no
> existing TT row cited an archive. **That claim was false and the check would have failed.**
> **New Hampshire (state, `c54f6dbd-3f2a-453e-b0b9-259e377aef67`) already carries 16
> archive-cited rows, FY2017–FY2024**, predating this work entirely. The application-wide count
> is therefore **18**, not 2, and the harness prints that number explicitly so a future reader
> cannot mistake it for a regression. The plan was corrected in commit `5621b5c`.
>
> The audit additionally asserts the New Hampshire baseline is **still 16**, *and* asserts the
> application-wide total equals exactly `16 + 2 = 18`. The last of those is what actually states
> the invariant: King County == 2 and New Hampshire == 16 would both still hold if some *third*
> entity started citing an archive. Pinning the total closes that: *this load added exactly two
> archive-cited rows and disturbed no others.*

---

## 4. Essentials tether verdict

`node scripts/verify-seattle-tether.mjs` → exit 0. Live catalog fetched from
`https://essentials.empowered.vote/coverage.json`, `generatedAt 2026-08-14T18:42:52.523Z`
(169 cities, 24 counties, 50 states, federal present).

| Entity | Verdict | GEOIDs | Banner icon |
|---|---|---|---|
| Seattle (city, WA) | **COVERED** | `["5363000"]` | **expected to appear** |
| King County (county, WA) | **COVERED** | `["53033"]` | **expected to appear** |

Both are the only WA entries in their tiers. **No cross-repo Essentials note is needed** — unlike
Madison, this pair is already covered on the Essentials side, so there is no gap to record and
nothing to work around in TT.

The GEOIDs corroborate the Census identifiers Task 9 used for population: Seattle `5363000` is
state 53 + place 63000, King County `53033` is state 53 + county 033 — the same two records the
controller pulled from the live Census files when confirming populations of 780,995 and
2,340,211.

All three harnesses set `process.exitCode` and let the event loop drain rather than calling
`process.exit()`; an abrupt exit races undici's keep-alive socket into a Windows libuv
`UV_HANDLE_CLOSING` assertion.

⚠ **Read the tether verdict, not its exit code.** Exit 0 here means "the catalog answered", not
"both entities are covered". Asserting coverage would be wrong — it would turn a legitimate,
expected Essentials gap into a red build on the Treasury Tracker side, which the plan explicitly
says not to do. What the harness *does* now enforce is the distinction it exists to make: a body
that carries no usable tier arrays (an Essentials error page, an empty payload) is reported as
**FETCH FAILED / inconclusive, exit 3**, never as a definitive "NOT COVERED". The app's own
shape check is deliberately permissive because it degrades to "no icon" and must never throw;
that leniency is wrong for a verification harness, which would otherwise file an Essentials
regression as a documented coverage gap while the icon silently vanished in production.

---

## 5. Disclosure: where the two column readings disagree

The General Fund is column 0 of a multi-fund statement, and there are two defensible ways to
find it. This harness computes **both** and reports every row where they differ, rather than
silently resolving them.

- **Positional** — column bands derived from the section's own fully-populated `Total` row; a
  cell belongs to the column whose band contains its centre.
- **Ordinal** — the General Fund is leftmost, so it is the first cell on the row, dash
  placeholders included.

**24 rows across 5 FY × mode disagree — all of them King County FY2018–FY2020.** Seattle agrees
on all 34 combinations, and King County agrees on FY2021–FY2025. In every divergent row the
positional reader found *no cell in band 0* at all (it never found a *conflicting* value):
`pdftotext -table` places some King County General Fund figures up to 30 columns right of their
own column while preserving cell **order**.

The document's own printed `Total` adjudicates, and it selects the ordinal reading unambiguously.
The clearest instance is King County FY2018 revenue, where the positional reading comes up short
by exactly **12,109** — the sum of two rows it dropped, `Business and other taxes` 4,034 and
`Licenses and permits` 8,075.

That figure is worth dwelling on. **This harness, written from scratch and with no sight of the
extractor's code, reproduced the exact failure signature the plan's own scoping had documented
months earlier — same total shortfall, same two rows, same two amounts.** Two unlike
implementations converging on the same defect and the same fix is much stronger evidence than
either one passing alone.

The affected rows are listed individually in the harness output so any of them can be checked by
hand against the PDF.

---

## 6. Carry-forward for whoever reads these charts

**Seattle FY2018 is a structural break and is *not* year-over-year comparable to FY2017.** The
Department of Education and Early Learning Fund was converted into the General Fund in 2018
(Seattle FY2018 ACFR **Note 17, printed p.149**; fund description **p.173**), which is why
General Fund operating jumps **+42.9%** and Health and Human Services goes from absent in FY2017
to about **$57.0M** in FY2018. The extraction is correct; the discontinuity is real and is an
accounting-scope change, not a spending surge.

A related claim was **refuted** during Task 7 and must not creep back: the Housing and Community
Development Revenue Sharing Fund did **not** move into the General Fund. The FY2018 ACFR states
three separate times that it was closed in 2018 and its fund balances split between Human
Services Operating and Low-Income Housing.

Seattle's other three discontinuities are economic and ACFR-attributed rather than structural:
FY2024 operating +21.5%, FY2021 revenue +25.4% (the ACFR itself attributes a new payroll-expense
tax creating "$248m of new revenue for 2021"), FY2020 revenue −6.6% (the ACFR itself attributes
the business-tax change to "the economic impact of the Corona Virus Pandemic"). None of these
was supplied from general knowledge; each is quoted from the relevant ACFR.

---

## 7. Review, and proof that the harness bites

A harness that cannot fail is worse than no harness, because it manufactures confidence. Two
independent reviews were run over the three scripts: one for spec compliance and code quality,
one adversarial, whose only brief was to find ways the harness could report PASS while the data
was wrong.

The adversarial pass injected **18 semantic mutations** and found four genuine gaps, all now
closed. The table below records the mutations that matter, re-run against the fixed harnesses:

| Injected defect | Harness | Caught? |
|---|---|---|
| Units multiplier 1000 → 1 | rederive | **caught** — 8 blockers, exit 1 |
| A real non-zero leaf silently zeroed, then pruned | rederive | **caught** by `PRINTED vs SUMMED`, *before* the DB is consulted |
| Two leaf values swapped inside one root (sum preserved, total still ties) | rederive | **caught** at leaf level, exit 1 |
| Pruning disabled (zero leaves kept) | rederive | **caught** — the set of dropped rows is itself asserted |
| A leaf label altered | rederive | **caught** — `LEAF ONLY IN PDF` / `LEAF ONLY IN DB` |
| `Taxes` header treated as a wrap fragment | rederive | **caught** — reproduces the exact `"Taxes Property Taxes"` gluing trap |
| Label key truncated to force a collision | rederive | **caught** — duplicate-key guard fires on both sides |
| Wrong entity UUID | rederive | **caught** |
| Missing PDF / exception mid-run | rederive | **caught** — exit 1 / exit 2, no PASS banner |
| **Empty FY window (verify nothing, claim everything)** | rederive | **was MISSED → now caught**, exit 1 |
| **FY2023 PDF read as FY2024** | rederive | **was MISSED → now caught** — "statement page states *year ended December 31, 2023* but this document is being read as FY2024" |
| Served length ≠ local file | audit | **caught** |
| **Server omits `Content-Length`** | audit | **was a silent PASS → now fails closed** |
| Anchor constant, NH baseline, or expected row count corrupted | audit | **caught** |
| **A third entity starts citing an archive** | audit | **was MISSED → now caught** by the app-wide assertion |
| **Essentials serves `{"error":"internal"}`** | tether | **was a false "NOT COVERED" at exit 0 → now FETCH FAILED at exit 3** |

Two mutations were *legitimately* missed as equivalent mutants and are recorded as such: taking
the last rather than the first candidate statement page (there is only ever one), and loosening
the tax-membership rule from `/taxes$/` to `/tax/` (no revenue label outside the tax group
contains "tax" in this corpus).

**An independent corroboration the harness does not itself use.** On statements whose final
column is "Total governmental funds", each row's per-fund cells must sum to that column. The
adversarial reviewer checked this invariant separately and it holds **exactly, with zero
exceptions**, on Seattle FY2020–FY2025 and King County FY2018–FY2020 — which includes *all four*
King County years carrying the ordinal/positional divergences. That is row-level confirmation,
from a direction neither implementation relies on, that the first cell really is the General
Fund precisely where the two column readings disagree.

## 8. Known limits of this verification

Stated rather than hidden:

- **Coverage is the General Fund only.** Both entities run large operations outside it —
  Seattle's City Light, Seattle Public Utilities and Transportation fund; King County's Metro
  Transit and wastewater treatment. The Task 12 enrichment copy carries this caveat on the root
  categories. Nothing here verifies figures TT does not display.
- **Line-item order is not asserted.** `budget_categories` carries a `sort_order` and is compared
  in order; `budget_line_items` has no ordering column, so leaves are matched by
  `(category, label)` and value. Asserting position would be asserting something the schema does
  not promise.
- **Zero-valued rows are dropped on both sides.** The application does not store a $0 leaf, so
  the harness prunes them too and reports the count it pruned rather than hiding it.
- **(a) proves the cited URL serves the parsed bytes today.** It is not a permanent archival
  guarantee; King County FY2018 already needed the Internet Archive because the issuer's own URL
  had gone.
- **The grouping rules are read off these statements, not universal.** "A revenue line ending in
  *taxes* joins the open Taxes group" holds for both entities across all 25 documents, and a
  wrong grouping would fail loudly against the DB's labels — but it is not a general rule for
  other issuers. It also has slack: `/tax/` would behave identically on this corpus, so the rule
  is not uniquely pinned by the data.
- **The column strategy is shared, not independent** (§1, §5). Both implementations read the
  General Fund ordinally. The protection on that axis is the printed-vs-summed reconciliation
  inside each PDF, not implementation diversity.
- **"(In Thousands)" is taken at face value.** Both the harness and the loader read the scale
  off the page caption, and check (e)'s two constants were themselves derived under that
  assumption — so (e) is a *regression pin against later drift*, not an independent proof of
  scale. It cannot detect a document that mislabels its own units. The outside-the-tie oracle
  that does address this is human plausibility, plus Seattle's own FY2024 MD&A narrative, which
  states a General Fund "deficiency of revenues of $117.8 million" against the extracted
  `2,272,762 − 2,390,575 = −117,813` thousand.
- **A genuinely blank General Fund cell is not handled.** Under the ordinal reading, a row whose
  GF cell is empty with no dash placeholder would borrow the next fund's value. No such row
  exists in this corpus, and one would inflate the section sum and break the printed-vs-summed
  reconciliation loudly — but it is a disclosed limit, not a handled case.
- **Nothing here verifies the category enrichment text** loaded in `aa2d8e4`. These three
  harnesses cover `budgets`, `budget_categories` and `budget_line_items` only.
