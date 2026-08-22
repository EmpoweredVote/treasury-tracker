# SCOPE-04 — closeout

**Derived Total Governmental for California, and the enterprise slice.**
Branch `feat/scope-04`. Spec `docs/superpowers/specs/2026-08-21-scope-04-design.md`,
plan `docs/superpowers/plans/2026-08-21-scope-04.md`, verification record
`SCOPE-04-RECON.md`.

> ✅ **Status: written and verified.** 7,650 derived rows across 488 California entities.
> All figures below are from the actual run.

---

## 1. What a reader gets

Every eligible California city and county now has a **second, honestly-labelled fund
scope**, so the tax-funded government can be seen apart from the utilities the city
happens to operate. Modesto FY2024 is the whole milestone:

```
All Funds            588,042,068   published
Total Governmental   291,641,122   derived      <- new
  enterprise slice   296,400,946   = the difference
     Internal Service 122.1M · Water 89.0M · Sewer 53.6M
     Other 15.5M · Solid Waste 14.5M · Airport 1.7M
```

**50.4% of Modesto's "city budget" is not the tax-funded city.**

Every derived figure declares itself: `derivation='derived'` in the database, the inert
label *computed by Treasury Tracker* beside its series, and a disclosure sentence naming
what the scope excludes.

---

## 2. What the tie gate could NOT see

This is the section worth reading twice. Five defects this milestone found or fixed move
**no dollar figure**, so no arithmetic gate could have caught any of them.

### 2.1 The figure invariant had been dead for three milestones

`figures_frozen` was **already violated before SCOPE-04 wrote anything**, and was
*permanently unreconstructable*: LA-02 deleted 11 rows on Chris's call, the digest hashes
surviving ids, and the backup archive preserved ids for only 7 of the 11.

Root cause: `excluded_ids_file` was a **single** path holding SCOPE-02's 12 ids and went
un-updated across v2.27, v2.28 and v2.29 — so both harnesses reported a moved digest on
every run in that window, which is how an invariant stops being read.

The count reconciles exactly: `79,939 + 140 − 11 + 8 = 80,076`. Repaired in `f8fc0f9`:
`excluded_ids_files` is a list, `postV224CreatedIds.json` records the 148 missing ids, and
the digest was rebased with the full accounting in `scopeBaseline.json`
`_rebased_at_v2_30`. It then verified both SCOPE-04 migrations, so it is load-bearing again.

⚠ **Not proven:** that no *surviving* row's figure moved. That needs the v2.24 id list,
which was never committed. An id-free reconstruction via the composite digest returned the
right row count (79,927) but a different hash, and that test is **inconclusive** — the
archive's figures came through PostgREST's lossy JSON encoding and carry at least one float
artifact.

### 2.2 The registry would have un-derived all 7,664 rows

`fundScopeRegistry`'s `ca-sco-expenditures` is anchored on
`/^CA State Controller - Expenditures$/`. Had the derived rows inherited their parent's
`data_source`, the next `classifyFundScope` run would have matched them and **overwritten
`total_governmental` back to `all_funds`**, silently converting 7,664 derived figures into
duplicate all-funds rows. Fixed at the source by giving the derived rows their own labels.
Found in spec self-review.

### 2.3 The disclosure copy had no renderer, and the copy around it said "published"

`DERIVED_COPY.explainer` was defined and unit-tested from Task 5 onward and **rendered
nowhere** — it would have passed its test forever while telling no reader anything.

Worse: the toggle copy asserted "published" three times (`heading`, `intro`, `single`), and
all three render beside the *computed by Treasury Tracker* marker. After this write every CA
city carries a published `all_funds` series next to a derived one, so **"Which published
figures" would have headed a list containing a computed option on all 488 entities.**

### 2.4 A racing paged read invented 27 rows of drift that did not exist

Running `classifyFundScope --dry-run` **while the 7,650-row write was in flight** reported
eight entries over-matching by 27 rows — `mn-osa +11`, `oh-aos +2`, `ma-dls +4`,
`ca-sco-* +9`, `state-acfr-gf +1`. I read that as pre-existing baseline drift and reported
it as such, reasoning that a California-only milestone cannot add Minnesota rows.

**That reasoning is true and does not exonerate the numbers.** Paging is LIMIT/OFFSET, so
rows inserted during the scan shift later pages and rows *already present* get counted
twice. Re-run after the load, every entry matched exactly. The fabricated drift was
indistinguishable from a genuine stale baseline — and there *was* a genuine one two hours
earlier (§2.1), which is what made it plausible.

Recorded in `EXPECTED_ROWS` itself: **never run a partition gate while a load is in flight.**

### 2.5 `_treasury_insert_tree` swaps two amount columns

It writes `approved_amount` from the JSON key `'aa'` and `actual_amount` from `'a'` —
inverted from the column names. `bulkLoadStateController` sets both to the same value, so
the swap is invisible there and would have been invisible here too. Mapped correctly;
measured 0 of 438,197 SCO line items with the two differing, so the carry-over is provably
lossless.

---

## 3. The scope caveat, disclosed rather than hidden

⚠ **`derived_TG` is the State Controller's governmental scope, which is NOT identical to an
ACFR's "Total Governmental Funds".** The two differ by redevelopment successor-agency funds.

Proven at Napa FY2017, to the dollar:

```
REVENUE      97,277,497 printed − 18,524 successor agency + 79,307 sale of capital assets
             = 97,338,280 == derived                                          ✅
EXPENDITURE  97,734,046 printed − 23 successor agency
             = 97,734,023 == derived                                          ✅
```

Both figures are individually correct, so **no arithmetic gate can ever surface this** — a
tie test compares two right answers to different questions. Chris's ruling (2026-08-22):
**keep the name, disclose the exclusion.** The disclosure is `DERIVED_COPY.scopeNote`,
rendered beneath the series pills whenever the figure on screen is derived.

⚠ **The magnitude is UNMEASURED beyond Napa.** The copy deliberately never says "slightly"
or "minor" — a unit test fails if those words appear — because Napa's gap was immaterial and
that is one city.

⚠ **The stopping rule was NOT met as written.** It asked for ≥10 assessable city-years;
**1 of 16 sample targets was assessed** before Chris directed the milestone to proceed to
the write. Recorded here plainly because the alternative is a closeout that reads as though
the gate passed. What *was* established: two independent controls tie exactly, and the one
fresh target reconciles to the dollar under two documented mechanisms.

---

## 4. The write, and the invariants

| | |
|---|---|
| rows before | 80,076 |
| **derived TG written** | **7,650** across **488 entities**, 0 failed |
| quarantined | 8 — Brisbane FY2017, Turlock FY2021, Scotts Valley FY2021, Trinidad FY2019 (×2 datasets) |
| excluded | 6 — derived TG > all_funds, every one with a negative enterprise total |
| rows after | **87,726** = 80,076 + 7,650 ✅ |
| `figures_frozen` | ✅ **unchanged at `4cce9d6a…`**, 79,916 frozen rows |
| `composite_frozen` | ✅ unchanged at `9e1bf9fd…` |
| `unknown` counts | ✅ unmoved at 9,426 — the derived rows were classified at write time and never passed through `unknown` |
| `total_governmental` | 28,410 → **36,060** |
| created ids | 7,650, proven an **exact set match** against the rows carrying `derivation='derived'` |

Per-row assertions across all 7,650: `basis='actual'` 7,650/7,650 · `fiscal_year_start_month=7`
7,650/7,650 · `source_url` present 7,650/7,650 · derived `data_source` label 7,650/7,650.

### The stampers do NOT un-derive the rows

Run **for real**, not dry — both `classifyFundScope` and `stampBudgetAxes`. The 7,650 rows
are byte-identical before and after: `total_governmental / actual / unknown / derived`.
This was a genuine risk, not a formality: both stampers write `unknown` on a source they do
not recognise, and the `ca-sco-expenditures` pattern would have reclaimed these rows
entirely had they inherited their parent's `data_source` (§2.2).

### The duplicate rule went stale — for the third time in this arc

Every CA city-year now holds an `all_funds/actual` row beside a
`total_governmental/actual` row: two rows sharing a basis, on 7,650 groups. SCOPE-02's rule
("a hazard whatever their scopes") was correct when the only legal pair was actuals beside
adopted-budget. `classifyDuplicates` gains a third bucket, `scopeSplit`, on the same
structural test the period-split rule uses. **Reported, never suppressed** — summing a
city-year across scopes double-counts, because `all_funds` *contains* `total_governmental`.

### In the app

Modesto FY2024 renders a two-pill toggle. Selecting **Total Governmental · actuals**
(*computed by Treasury Tracker*) moves Money Out from **$588.0M → $291.6M** — the spec's
headline figure to the dollar — with the successor-agency disclosure beneath. The heading
reads *"Which set of figures"*, not *"Which published figures"*.

---

## 5. Follow-ups

1. **The 12 rootless `$0` rows** — Hollister FY2022, Humboldt County FY2020+FY2021,
   Mendocino County FY2022, Novato FY2022, Woodland FY2023 (× operating and revenue). The
   SCO returned nothing and the loader wrote an empty row anyway. These render as `$0`
   today. **Pre-existing, reported, not repaired.**
2. **The remaining 15 sample targets** — and read them for *successor-agency magnitude*,
   not only for a tie. That is the number nobody has.
3. **`/treasury/cities` payload projection** — a per-entity projection is the real
   structural fix; lives in `C:\EV-Accounts`.
4. **The 6 excluded rows** — negative enterprise totals in the SCO feed. A disclosure
   problem in the source, not a derivation bug.
5. **`reporting_entity` stays `unknown`** for all derived rows. Resolving it needs the SCO
   entity boundary reconciled against a city ACFR's component-unit presentation.
6. **Austin's ACFR year regex** reports `fiscal_year: 2222` on FY2024 — pre-existing quirk
   in `acfrPrintedTotal.py`, harmless to the figures, noticed in passing.
