# AUSTIN-TRAVIS-01 — City of Austin + Travis County onboarding (CLOSEOUT)

**Date:** 2026-08-19
**Branch:** `feat/austin-travis-onboarding`
**Status:** SHIPPED to the database — 76 rows, every one verified against an independent oracle.

---

## 1. What landed

| Entity | Type | FY window | Years | Rows | Units |
|---|---|---|---|---|---|
| City of Austin, TX | `city` (county_id → Travis County) | FY2010–FY2025 | 16 | 32 | thousands (`units=1000`) |
| Travis County, TX | `county` | FY2004–FY2025 | 22 | 44 | whole dollars (`units=1`) |

Both entities: `operating` (GF expenditure-by-function) + `revenue` (GF
revenue-by-source), General Fund only, ACFR **GAAP actuals**, read from the
General Fund column of each year's governmental-funds *Statement of Revenues,
Expenditures and Changes in Fund Balances*.

Population (Census PEP Vintage 2024, the same program `loadTXPopulation.js`
already uses): Austin **993,588**, Travis County **1,363,767**.

`fiscal_year_start_month = 10` on every row — both entities run October 1 –
September 30. `source_date` is the fiscal-year end (`<FY>-09-30`), never a
fabricated issue date.

### Source discovery

* **Austin** publishes through a **Widen DAM** (`austin.widen.net`). The legacy
  `austintexas.gov/sites/default/files/.../CAFR/*.pdf` paths that search engines
  still return are ALL 404 — the city migrated. 28 reports exist (FY1998–FY2025).
* **Travis County** publishes flat files at `tctransparency.traviscountytx.gov`.
  22 reports exist (FY2004–FY2025); FY2003 and earlier are not published
  (both filename spellings 404) — an upstream absence, not an extraction failure.

Both corpora are downloaded by `scripts/fetchAustinTravis.mjs` into gitignored
`docs/Austin/` and `docs/TravisCounty/`, each with a `manifest.json` recording
the URL that actually served each file plus its sha256, so `source_url` names
the bytes that were parsed rather than a reconstructed guess.

---

## 2. Austin's excluded years — 12 of 28, both eras adjudicated

Austin's full corpus is FY1998–FY2025 and all 28 reports were downloaded. Twelve
are deliberately NOT loaded, in two distinct eras with two distinct causes.
Neither is a shrug — both were diagnosed to the specific mechanism.

### FY2002–FY2009 (8 years) — `-table` splits the General Fund column

This era's statement is a **four-column comparative** layout
(General Fund | Nonmajor | Total | prior-year Total). `pdftotext -table` renders
the General Fund column at **two different character positions**: rows carrying
the `$` sign align at one offset, every other row ~24 columns right.

`acfrGF.py` anchors its columns from the fully-populated `Total revenues` row, so
the second group is assigned to the *Nonmajor* column and **seven of nine revenue
sources read as $0**. FY2009 fails by **−122,669** (thousands) — loudly, which is
the whole point of the tie gate.

`-layout` does not rescue it: it shears values off their own labels (FY2009's
`Total revenues` row emits `33,655`, a figure belonging to a different line).

Recovering this era needs **coordinate-based** column isolation, not a config
change. `scripts/acfrPrintedTotal.py` (written for this milestone's verification)
already reads these pages correctly, which is a proven starting point.

### FY1998–FY2001 (4 years) — pre-GASB-34, and printed in whole dollars

Pre-GASB-34 combined statements, printed in **whole dollars** rather than
thousands. Revenue extraction **ties at exactly $0 for all four years while being
1000× wrong** ($261 *billion* for FY1998) — precisely the trap
`CityConfig.units` documents: `tie_delta` compares a sum against a printed total
read through the same multiplier and is structurally blind to the scaling.

The loader's per-capita guard rejects them, but they are excluded at config level
so the guard never has to. Operating fails outright on this era's different
nesting (`Nondepartmental expenditures`; FY2001 exposes a
`General Fund Expenditure by Function` schedule instead).

---

## 3. Five real defects found, all fixed

Every one of these produced *plausible* output. Three of them tied at exactly
$0 while being wrong.

1. **Travis host was hallucinated during scoping.** A summarizing fetch returned
   `financialtransparency.traviscountytx.gov` for every Travis URL. That host
   404s on every path; the real one is `tctransparency`. Caught by verifying the
   URL instead of trusting the summary. Now asserted in `tests/txAcfrLoad.test.mjs`.

2. **Austin's published links are viewer pages, not files.** `/view/pdf/<id>/…pdf`
   serves `text/html`; a naive `curl -o x.pdf` writes a 24KB pdf.js HTML shell
   *named* `.pdf`. The downloadable path is `/content/<id>/pdf/…pdf`. The
   fetcher's `%PDF` magic-byte guard is what makes this impossible to ship.

3. **Austin FY2022 mis-nesting (tied at $0).** Austin renamed its lease line
   mid-window — `Lease financing principal` (FY2022) vs
   `Lease and IT subscription financing principal` (FY2023+). Configured to the
   later wording alone, FY2022's row failed the `root_leaves` prefix test and was
   filed as a **child of `Debt service:`** instead of a root-level peer, in a year
   where all three real debt-service lines print `--`. Total unchanged, tie
   unchanged, shape wrong. Fixed by widening the prefix to `'lease '`; the
   re-sweep confirmed the total was byte-identical and only the tree moved.

4. **Verification oracle read the wrong fund column.** The oracle's first version
   grouped words into rows by `round(midpoint / 2.5)`. Austin's FY2024 statement
   sets the GF total 1.2pt below its own label, so it fell into the *next* bucket
   while the Nonmajor figure stayed in — and the oracle confidently reported
   `$1,534,052K` (Nonmajor) as the General Fund total. Any fixed grid has this
   failure mode. Replaced with single-linkage clustering on a genuine vertical gap.

5. **Verification oracle vs. split number glyphs.** Travis FY2018/FY2021/FY2022
   split the *leading digit* of a total into its own word (`'6'` + `'27,129,640'`
   at a 0.1pt gap; these statements report `size=0.0` for every char). The oracle
   read `6` and reported a 627-million-dollar discrepancy against a database row
   that was correct. Fixed by merging touching numeric fragments, guarded so
   label words and real column boundaries (50–90pt apart) can never merge.

---

## 4. Verification

`node scripts/verify-austin-travis.mjs` → **76 rows checked, ALL CHECKS PASSED.**

The load-bearing check is deliberately **not** a database self-check. "Does
`total_budget` equal the sum of its line items" is *tautological* here — the
loader computes `p_total` as the sum of the nodes it passes to the RPC, so the
two agree by construction and would agree on a completely mis-parsed statement.
(The same tautology bit SCOPE-04, whose handoff reported a "0 of 23,260 rows tie"
green light for `total = Σ roots`, which is an identity.)

The extractor's own `tie_delta == 0` is stronger but still internal to one parse:
it holds under a wrong `units` and under wrong nesting.

So the assertion that carries weight is **two independent implementations reading
the same printed figure**:

| | loader path | verification path |
|---|---|---|
| tool | `pdftotext -table` | `pdfplumber` glyph coordinates |
| method | nearest-column-anchor assignment, then sum components and compare to printed total | read the printed TOTAL cell only |
| code shared | — none — | |

All 76 figures agree **exactly**. Plus: row inventory (no missing, no extra),
`source_url`/`source_date`/`data_source` present on every row, `source_date` ==
the Sept 30 FY end, `fiscal_year_start_month == 10`, zero `data_sources` residue,
and Austin confirmed as a `city` linked to Travis County with no duplicate
name/type row (the Utah phantom-row defect).

Repo gates: `npm test` **471 passed** (30 files, including 8 new), `acfrGF.selftest.py`
**166 passed**, `npm run build` clean.

---

## 5. Follow-ups (not done, deliberately)

1. **Austin FY2002–FY2009 (8 years, 16 rows).** Needs a coordinate-based
   extractor for the four-column comparative era. `acfrPrintedTotal.py` already
   reads these pages, so the remaining work is extracting *components*, not just
   totals.
2. **Austin FY1998–FY2001 (4 years).** Pre-GASB-34 shape plus `units=1`. Lower
   value: a different statement basis, and the repo already has
   `scripts/pre34Extract.mjs` for that boundary.
3. ~~**Classification axes.**~~ **DONE 2026-08-19** — all 76 rows are now
   `general_fund / actual / primary_government`, via three evidenced
   `tx-local-acfr-gf` registry entries rather than an ad-hoc loader stamp.
   Reconciliation of record: **`AUSTIN-TRAVIS-01-SCOPE-RECON.md`**. The live API
   confirms `{"general_fund/actual/primary_government": 32}` for Austin and
   `{…: 44}` for Travis. Every whole-table `unknown` tally fell by exactly 76
   (`fund_scope` 9,773 → 9,697; `basis` 26,434 → 26,358; `reporting_entity`
   56,487 → 56,411) and no loaded figure moved.

   Two things worth carrying forward from that work:

   * **The pattern is anchored to the two entity names on purpose.** The
     tempting general `/ ACFR — General Fund/` claims **1,784** rows — the 1,448
     already owned by `state-acfr-gf`, these 76, and **260 rows across sixteen
     other city/state ACFR families** (Bend 36, State of Minnesota 36, Seattle
     34, Sherwood 22, Tucson 20, …) that no reconciliation covers. Those stay
     `unknown`: nobody has read Bend's statement. **That 260 is the real
     remaining prize** — the same three-probe method would close most of it, and
     the extractors already exist.
   * **A pre-existing gate failure surfaced and was fixed.**
     `stampBudgetAxes.mjs`'s `EXPECTED_BASIS_ROWS` still held the pre-backfill
     10,438 / 10,446 for the two CA SCO city entries, while
     `classifyFundScope.mjs` had already been corrected to 10,448 / 10,448 for
     the same cause — so that gate had been failing on those entries since the
     SCOPE-02 Task 10 backfill, independently of this milestone. Re-verified
     against the live table before editing: the 12 ids in
     `scripts/data/scope02CreatedIds.json` return exactly 12 rows splitting
     10 Expenditures + 2 Revenues, precisely the overage.
   * Also noted, not acted on: three of those 260-row families are STATE ACFRs
     labelled `State of Minnesota ACFR — …` rather than `… State ACFR — …`, so
     `state-acfr-gf`'s pattern misses them. Pre-existing gap in another entry.

   `verify-austin-travis.mjs` now asserts all three axes (CHECK 7), because both
   stampers write the column default on a fresh row — so re-running the loader
   would silently drop these rows back out of scope-matched comparison.
4. **Austin straddles three counties** (Travis 922,309 / Williamson 70,212 /
   Hays 1,067). `county_id → Travis` is a *predominance* claim (92.8% of
   population, and the seat of city government), not an identity. Worth knowing
   before any county-rollup arithmetic treats city populations as partitioning
   their county.

---

## 6. Files

**Created**
- `scripts/fetchAustinTravis.mjs` — dual-host fetcher, 4 content guards, writes `manifest.json`
- `scripts/extractAustin.py` / `scripts/extractTravis.py` — `CityConfig` wrappers over `scripts/lib/acfrGF.py`
- `scripts/lib/txAcfrLoad.mjs` — shared loader core, 5 guards
- `scripts/processAustin.js` / `scripts/processTravis.js` — thin per-entity drivers
- `scripts/seedAustinTravis.mjs` — the two `municipalities` rows + phantom-row guard
- `scripts/sweepAustinTravis.mjs` — FY-window recon harness (tie + shape per year)
- `scripts/acfrPrintedTotal.py` — independent pdfplumber oracle
- `scripts/verify-austin-travis.mjs` — 6-check verification harness
- `tests/txAcfrLoad.test.mjs` — 8 tests

**Modified:** none. No shipped extractor, loader or config was touched, so no
existing entity could regress.
