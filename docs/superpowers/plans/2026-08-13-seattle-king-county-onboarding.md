# Seattle WA + King County Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load real, sourced General Fund finances for the City of Seattle (FY2009–FY2025) and King County (FY2018–FY2025) into Treasury Tracker, on the same ACFR GAAP basis as every existing TT city.

**Architecture:** Extend the shared `scripts/lib/acfrGF.py` with four config-gated capabilities (unit scaling, an ordinal column reader, 2-level revenue trees, and per-entity statement/FY anchors), add two thin extractor wrappers, then load through the existing source-safe `treasury_sync_budget_tree` pipeline modelled on `scripts/processBend.js`. Every library change defaults to current behaviour so the eight already-loaded cities are provably untouched.

**Tech Stack:** Python 3 (stdlib only, invoked as `py -3`), `pdftotext` from Poppler (`-table` mode), Node 20 ESM, `@supabase/supabase-js`, vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-seattle-wa-onboarding-design.md`

## Global Constraints

- **Python is `py -3`.** Bare `python` is a WindowsApps stub that exits 9009.
- **`pdftotext -table` only** for values. `-layout` is for inspecting indentation only — on King County it desynchronises labels from values entirely and must never be used to read numbers.
- **Amounts in both sources are printed IN THOUSANDS.** Every loaded figure must be multiplied by 1000. The tie gate is unit-invariant and cannot detect a missing multiplier.
- **`tie_delta` must be exactly 0** for every (FY, mode). Non-zero aborts that FY. Never widen this into a tolerance.
- **Load only through `treasury_sync_budget_tree`.** Never `treasury_sync_city_budget`, which overwrites existing `(muni, fy, dataset)` rows and keeps stale labels.
- **`data_sources` rows are ephemeral** — created at run start, deleted in a `finally` block. Durable provenance lives on `budgets.source_url` / `source_date` / `data_source`.
- **`source_date` is the fiscal-year end = `<FY>-12-31`** for both entities (calendar fiscal year). Do not copy Bend's `-06-30`.
- **Work sequentially on branch `feat/seattle-king-county-onboarding`.** Worktrees are unsafe: loaders need the gitignored `.env` and gitignored `docs/` PDFs.
- **`docs/*` is gitignored.** Committing anything under `docs/` requires `git add -f`. PDFs must NOT be committed.
- **`npm run lint` is a known-broken gate in this repo** — it never exits 0. Do not treat it as a signal.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/acfrGF.py` *(modify)* | Shared GF extraction machinery. Gains `units`, `column_strategy`, `revenue_parents`, `statement_anchor`, `section_header_mode`, `fy_end`. |
| `scripts/lib/acfrGF.selftest.py` *(create)* | Stdlib `unittest` over pure functions with synthetic lines copied from real PDFs. No PDF or network needed. |
| `scripts/goldenExtractors.mjs` *(create)* | Captures/compares every existing extractor's output — the regression net for `acfrGF.py`. |
| `scripts/fetchSeattleKingCounty.mjs` *(create)* | Downloads all source PDFs into gitignored `docs/Seattle/` and `docs/KingCounty/`. |
| `scripts/extractSeattle.py` *(create)* | Thin `CityConfig` wrapper for Seattle. |
| `scripts/extractKingCounty.py` *(create)* | Thin `CityConfig` wrapper for King County. |
| `scripts/seedWashingtonSeattle.js` *(create)* | Idempotent entity seeder: Seattle city + King County county node. |
| `scripts/processSeattle.js` *(create)* | Loads Seattle rows. |
| `scripts/processKingCounty.js` *(create)* | Loads King County rows. |
| `data/seattleEnrichment.mjs` *(create)* | Enrichment copy for both entities. |
| `scripts/loadSeattleEnrichment.mjs` *(create)* | Loads enrichment, delete-then-insert. |
| `scripts/verify-seattle-rederive.mjs` *(create)* | Independent from-scratch re-derivation vs live DB. |
| `scripts/verify-seattle-audit.mjs` *(create)* | Source-chain + unit + residue audit. |

---

## What the probes already established

These were verified against the real PDFs during scoping. They are facts, not assumptions — do not re-derive them, but do not silently contradict them either.

| Case | Result with the CURRENT library |
|---|---|
| Seattle FY2019, FY2015 | Both modes tie **$0** already |
| Seattle FY2024, FY2025 | `operating` ties $0; **`revenue` returns an EMPTY tree** |
| Seattle FY2009 | **EXIT 3 — statement not found** |
| King County FY2020–FY2025 | Both modes tie $0, **but revenue labels are glued** (`"Taxes Property taxes"`) |
| King County FY2018, FY2019 | **TIE FAILURE**, short by exactly the ragged-column rows |

Root causes, each confirmed:

1. **Seattle FY2024/25 revenue** — the `REVENUES` line also carries the fund column headers (`REVENUES … General Fund  Transportation  Governmental  2024`), so the whole-line section-header match never fires and the section never opens.
2. **Seattle FY2009** — the statement title wraps and `Page 1 of 2` is printed *between* `…AND CHANGES` and `IN FUND BALANCES`, breaking the `_TITLE` regex. The page is tagged `B-4`, which every Seattle vintage carries.
3. **King County FY2018/19** — `pdftotext -table` renders some GF values at an x-position nearer the *next* column's anchor, so the positional reader assigns them to column 1 and GF reads 0. FY2018 revenue is short by exactly `4,034 + 8,075 = 12,109`.
4. **Glued revenue labels** — `build_revenue` is flat-only, so a label-only `Taxes` / `Taxes:` parent row is treated as a wrapped label and prefixed onto its first child. **The tie still passes**, which is why this is invisible without reading labels.

**The ordinal fix is already prototyped and proven.** Treating standalone dash-runs as column slots and taking slot 0 as the General Fund ties **$0** on all three previously-failing cases:

```
KC2018  revenues     computed=863,031  printed=863,031  delta=+0
KC2018  expenditures computed=770,097  printed=770,097  delta=+0
KC2019  revenues     computed=915,992  printed=915,992  delta=+0
KC2019  expenditures computed=828,400  printed=828,400  delta=+0
SEA2009 revenues     computed=942,408  printed=942,408  delta=+0
SEA2009 expenditures computed=737,604  printed=737,604  delta=+0
```

Also established: **the GF column and both `Total` rows are wholly on page 1** of every two-page statement (Seattle FY2009 p68, King County p48), so **no multi-page support is required** — the spec's mention of it is superseded by this plan. And Seattle's FY2015-era comparative-year columns sit to the *right* of the General column, so column 0 remains correct and **no comparative-column rejection is required** either.

---

### Task 1: Golden-diff baseline for the existing eight cities

`scripts/lib/acfrGF.py` is shared by Bend, Sherwood, Tualatin, Beaverton, Hillsboro, Tigard, Cornelius and Gresham. Capture their exact output **before** touching it. This is the regression net for Tasks 3–6.

**Files:**
- Create: `scripts/goldenExtractors.mjs`

**Interfaces:**
- Produces: CLI `node scripts/goldenExtractors.mjs capture <dir>` and `node scripts/goldenExtractors.mjs compare <dir>`; exit 0 = identical, exit 1 = drift.

**Precondition:** the gitignored `docs/<City>/` PDF directories must be present. If any city's PDFs are missing, the script must **skip that city loudly and record the skip in the manifest** — a silent skip would make a later `compare` falsely pass.

- [ ] **Step 1: Write the harness**

```js
#!/usr/bin/env node
/**
 * Golden-diff harness for scripts/lib/acfrGF.py.
 *
 * Runs every per-city extractor across every PDF and both modes, and records
 * the exact stdout. Capture BEFORE changing the shared library, compare AFTER.
 * A byte-identical compare is the only evidence that a shared-library change
 * did not silently alter an already-loaded city.
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const CITIES = [
  { name: 'Bend',      script: 'scripts/extractBend.py',      docs: 'docs/Bend' },
  { name: 'Sherwood',  script: 'scripts/extractSherwood.py',  docs: 'docs/Sherwood' },
  { name: 'Tualatin',  script: 'scripts/extractTualatin.py',  docs: 'docs/Tualatin' },
  { name: 'Beaverton', script: 'scripts/extractBeaverton.py', docs: 'docs/Beaverton' },
  { name: 'Hillsboro', script: 'scripts/extractHillsboro.py', docs: 'docs/Hillsboro' },
  { name: 'Tigard',    script: 'scripts/extractTigard.py',    docs: 'docs/Tigard' },
  { name: 'Cornelius', script: 'scripts/extractCornelius.py', docs: 'docs/Cornelius' },
];
const MODES = ['revenue', 'operating'];

function runAll() {
  const out = {}, skipped = [];
  for (const c of CITIES) {
    if (!existsSync(c.script)) { skipped.push(`${c.name}: no extractor ${c.script}`); continue; }
    if (!existsSync(c.docs))   { skipped.push(`${c.name}: no PDF dir ${c.docs}`); continue; }
    const pdfs = readdirSync(c.docs).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    if (!pdfs.length) { skipped.push(`${c.name}: 0 PDFs in ${c.docs}`); continue; }
    for (const pdf of pdfs) {
      for (const mode of MODES) {
        const r = spawnSync('py', ['-3', c.script, path.join(c.docs, pdf), '--mode', mode],
                            { encoding: 'utf8' });
        out[`${c.name}/${pdf}/${mode}`] = { status: r.status, stdout: r.stdout ?? '' };
      }
    }
  }
  return { out, skipped };
}

const [cmd, dir] = process.argv.slice(2);
if (!cmd || !dir) { console.error('usage: goldenExtractors.mjs <capture|compare> <dir>'); process.exit(2); }
const { out, skipped } = runAll();
const file = path.join(dir, 'golden.json');

if (cmd === 'capture') {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ skipped, out }, null, 2));
  console.log(`captured ${Object.keys(out).length} outputs -> ${file}`);
  if (skipped.length) console.log('SKIPPED:\n  ' + skipped.join('\n  '));
  process.exit(0);
}

const prev = JSON.parse(readFileSync(file, 'utf8'));
if (JSON.stringify(prev.skipped) !== JSON.stringify(skipped)) {
  console.error('DRIFT: skip list changed.'); console.error('  before:', prev.skipped);
  console.error('  after :', skipped); process.exit(1);
}
const keys = new Set([...Object.keys(prev.out), ...Object.keys(out)]);
let bad = 0;
for (const k of keys) {
  if (JSON.stringify(prev.out[k]) !== JSON.stringify(out[k])) { console.error(`DRIFT: ${k}`); bad++; }
}
console.log(bad === 0 ? `IDENTICAL across ${keys.size} outputs` : `${bad} DRIFTED`);
process.exit(bad === 0 ? 0 : 1);
```

- [ ] **Step 2: Capture the baseline**

Run: `node scripts/goldenExtractors.mjs capture .golden-baseline`
Expected: `captured N outputs`, N > 0. **Read the SKIPPED list aloud.** If a city you expected is skipped, stop and restore its PDFs — a baseline that skips a city cannot protect it.

- [ ] **Step 3: Prove the harness detects drift**

Temporarily append a stray line to `scripts/lib/acfrGF.py`'s `norm_label` return (e.g. `s = s + ' X'`), then run:
`node scripts/goldenExtractors.mjs compare .golden-baseline`
Expected: exit 1, several `DRIFT:` lines. **Revert the edit** and re-run — expected exit 0, `IDENTICAL`.

A harness that has never failed is not evidence of anything. This step is what makes Tasks 3–6 trustworthy.

- [ ] **Step 4: Commit**

```bash
echo ".golden-baseline/" >> .gitignore
git add scripts/goldenExtractors.mjs .gitignore
git commit -m "test: golden-diff harness for the shared ACFR extractor library"
```

---

### Task 2: Acquire the source PDFs

**Files:**
- Create: `scripts/fetchSeattleKingCounty.mjs`

**Interfaces:**
- Produces: `docs/Seattle/seattle-<FY>-acfr.pdf`, `docs/KingCounty/kingcounty-<FY>-acfr.pdf`; exports `SEATTLE_URLS` and `KING_COUNTY_URLS` (`{[fy:number]: string}`) — Tasks 10 and 11 import these so the loader stamps exactly the URL that was fetched.

- [ ] **Step 1: Write the fetcher**

Both hosts serve to plain `curl`/`fetch` given a browser UA and the `Sec-Fetch-*` trio. No Chromium, no `fetchViaBrowser.mjs`.

```js
#!/usr/bin/env node
/**
 * Downloads Seattle + King County ACFRs into gitignored docs/ directories.
 *
 * King County FY2018 is served from the Internet Archive: the issuer's own URL
 * is dead (the Sitecore /~/media/ path was decommissioned) and FY2018 is the
 * ONLY pre-2019 year that is recoverable at all -- 2007 and 2015 are scans and
 * 2017's capture is truncated at exactly 2^20 bytes. Fetch with the `id_`
 * suffix, which returns the raw bytes rather than the archive's wrapper page.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Dest': 'document',
  'Upgrade-Insecure-Requests': '1',
};

const S = 'https://www.seattle.gov/documents/Departments/CityFinance/FinancialServices/CAFR';
export const SEATTLE_URLS = {
  2025: `${S}/2025%20Annual%20Comprehensive%20Financial%20Report%20-%20City%20of%20Seattle.pdf`,
  2024: `${S}/2024%20Annual%20Rep%20-%20City%20of%20Seattle.pdf`,
  2023: `${S}/2023%20Annual%20Report%20-%20City%20of%20Seattle.pdf`,
  2022: 'https://www.seattle.gov/documents/Departments/InvestorRelations/2023%20Documents/2022%20Annual%20Report%20Final%20Draft%202023-06-29.pdf',
  2021: `${S}/comprehensive-annual-financial-report-2021.pdf`,
  2020: `${S}/comprehensive-annual-financial-report-2020.pdf`,
  2019: `${S}/comprehensive-annual-financial-report-2019.pdf`,
  2018: `${S}/CAFR%202018%2010-28.pdf`,
  2017: `${S}/comprehensive-annual-financial-report-2017.pdf`,
  2016: `${S}/comprehensive-annual-financial-report-2016.pdf`,
  2015: `${S}/comprehensive-annual-financial-report-2015.pdf`,
  2014: `${S}/comprehensive-annual-financial-report-2014.pdf`,
  2013: `${S}/comprehensive-annual-financial-report-2013.pdf`,
  2012: `${S}/comprehensive-annual-financial-report-2012.pdf`,
  2011: `${S}/comprehensive-annual-financial-report-2011.pdf`,
  2010: `${S}/comprehensive-annual-financial-report-2010.pdf`,
  2009: `${S}/comprehensive-annual-financial-report-2009.pdf`,
};

const K = 'https://cdn.kingcounty.gov/-/media/king-county/depts/executive-services/finance-business-operations/financial-management/financial-reports/acfr';
export const KING_COUNTY_URLS = {
  2025: `${K}/2025-acfr-en.pdf`, 2024: `${K}/2024-acfr-en.pdf`,
  2023: `${K}/2023-acfr-en.pdf`, 2022: `${K}/2022-acfr-en.pdf`,
  2021: `${K}/2021-acfr-en.pdf`, 2020: `${K}/2020-acfr-en.pdf`,
  2019: `${K}/2019-acfr-en.pdf`,
  2018: 'https://web.archive.org/web/20201029080417id_/https://www.kingcounty.gov/~/media/depts/finance/financial-management-services/CAFR-2018/2018-comprehensive-annual-financial-report.ashx?la=en',
};

async function fetchOne(url, dest) {
  if (existsSync(dest) && statSync(dest).size > 100_000) return 'cached';
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) return `HTTP ${res.status}`;
  const buf = Buffer.from(await res.arrayBuffer());
  // Both hosts answer a miss with a ~1,245-byte HTML page, not a 404 body only,
  // so the magic-number check -- not the status code -- is the real gate.
  if (buf.subarray(0, 4).toString() !== '%PDF') return `not a PDF (${buf.length}B)`;
  // A capture truncated to an exact power of two is the Wayback failure mode
  // that produced an unreadable 2017 file. Reject it rather than load it.
  if ((buf.length & (buf.length - 1)) === 0) return `suspect truncation (${buf.length}B)`;
  writeFileSync(dest, buf);
  return `${(buf.length / 1e6).toFixed(1)} MB`;
}

const sets = [
  ['docs/Seattle', SEATTLE_URLS, 'seattle'],
  ['docs/KingCounty', KING_COUNTY_URLS, 'kingcounty'],
];
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  for (const [dir, urls, prefix] of sets) {
    mkdirSync(dir, { recursive: true });
    for (const fy of Object.keys(urls).map(Number).sort((a, b) => b - a)) {
      const dest = `${dir}/${prefix}-${fy}-acfr.pdf`;
      let r; try { r = await fetchOne(urls[fy], dest); } catch (e) { r = `ERROR ${e.message}`; }
      console.log(`${prefix} FY${fy}: ${r}`);
    }
  }
}
```

- [ ] **Step 2: Run it**

Run: `node scripts/fetchSeattleKingCounty.mjs`
Expected: King County FY2018–FY2025 all succeed (8 files). Seattle: FY2024, FY2025, FY2019, FY2015, FY2009 are **known-good** and must succeed. Other Seattle years were never fetch-tested — **record the exact failures; do not silently narrow the window.** A failing Seattle year most likely needs its URL corrected (filenames are inconsistent per era and FY2022 lives on a different path), not abandoning.

- [ ] **Step 3: Confirm nothing large got staged**

Run: `git status --porcelain`
Expected: `scripts/fetchSeattleKingCounty.mjs` only. **No `.pdf` may appear** — `docs/*` is gitignored and must stay that way.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetchSeattleKingCounty.mjs
git commit -m "feat: fetch Seattle + King County ACFR source PDFs"
```

---

### Task 3: Library — unit scaling (`units`)

The highest-risk change in the plan. The tie gate multiplies both sides, so it cannot catch a missing or wrong multiplier; the self-test below is the only mechanical check.

**Files:**
- Modify: `scripts/lib/acfrGF.py`
- Create: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `CityConfig(units: int = 1)`; `column_value(line, col_anchors, cfg) -> int | None` returning an already-scaled value; `classify(line, col_anchors, cfg) -> (str, str, int | None)` — **note the new third parameter**, which Tasks 4–6 rely on.

- [ ] **Step 1: Write the failing self-test**

```python
#!/usr/bin/env python3
"""Self-test for scripts/lib/acfrGF.py.

Pure-function tests over synthetic lines transcribed from the real PDFs, so
they run with no PDF, no pdftotext and no network. Run: py -3 scripts/lib/acfrGF.selftest.py
"""
import pathlib, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from lib.acfrGF import CityConfig, column_value, anchors

# Transcribed from City of Seattle FY2024 ACFR p56 (amounts in thousands).
SEA_TOTAL_REV = '     Total Revenues                                                         2,272,762     392,312         946,644        3,611,718'
SEA_PROPERTY  = '     Property Taxes                                        $                379,415    $  110,500      $  395,000     $  884,915'

class TestUnits(unittest.TestCase):
    def test_units_default_is_unscaled(self):
        cfg = CityConfig(city='X', parents=('current',))
        a = anchors(SEA_TOTAL_REV)
        self.assertEqual(column_value(SEA_PROPERTY, a, cfg), 379415)

    def test_units_thousands_scales_to_dollars(self):
        cfg = CityConfig(city='X', parents=('current',), units=1000)
        a = anchors(SEA_TOTAL_REV)
        self.assertEqual(column_value(SEA_PROPERTY, a, cfg), 379_415_000)

    def test_units_never_turns_absent_into_zero(self):
        cfg = CityConfig(city='X', parents=('current',), units=1000)
        a = anchors(SEA_TOTAL_REV)
        self.assertIsNone(column_value('     Some Label With No Numbers', a, cfg))

if __name__ == '__main__':
    unittest.main(verbosity=2)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: FAIL — `ImportError: cannot import name 'column_value'`.

- [ ] **Step 3: Implement**

In `CityConfig.__init__`, add the parameter and store it:

```python
    def __init__(self, city, parents, root_leaves=(), source_rounding=None,
                 label_fixes=None, units=1):
        ...
        self.units = units
```

Document it in the `CityConfig` docstring:

```
    units        multiplier applied to every extracted amount. Seattle and King
                 County print "(IN THOUSANDS)", so both use units=1000; every
                 other city prints whole dollars and uses the default 1.

                 THIS CANNOT BE VALIDATED BY THE TIE GATE. tie_delta compares a
                 computed sum against a printed total read through the SAME
                 multiplier, so it is 0 whether or not the scaling is right.
                 A wrong `units` ships a silently 1000x-wrong row. It is checked
                 instead by acfrGF.selftest.py and by the loader's per-capita
                 plausibility guard.
```

Add the wrapper immediately after `gf_value`:

```python
def column_value(line, col_anchors, cfg):
    """The General Fund cell of `line`, scaled to dollars, or None if absent."""
    v = gf_value(line, col_anchors)
    return None if v is None else v * cfg.units
```

Thread `cfg` through `classify` and both builders, and use it for the printed totals in `extract`:

```python
def classify(line, col_anchors, cfg):
    ...
    if not nums_with_pos(line):
        dz = dash_zero_label(line)
        if dz is not None:
            return 'data', dz, 0
        ...
    gv = column_value(line, col_anchors, cfg)
```

Update the two call sites inside `build_revenue` / `build_operating` to `classify(l, col_anchors, cfg)`, and in `extract` replace both `printed = gf_value(...)` calls with `printed = column_value(..., cfg)`.

- [ ] **Step 4: Run the self-test to verify it passes**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: `OK (3 tests)`.

- [ ] **Step 5: Prove the eight existing cities are untouched**

Run: `node scripts/goldenExtractors.mjs compare .golden-baseline`
Expected: exit 0, `IDENTICAL across N outputs`. `units` defaults to 1, so every existing city must be byte-identical. **If anything drifted, the threading is wrong — fix it before continuing.**

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/acfrGF.py scripts/lib/acfrGF.selftest.py
git commit -m "feat(acfrGF): config-gated unit scaling for thousands-denominated statements"
```

---

### Task 4: Library — ordinal column strategy

Fixes King County FY2018/FY2019 and Seattle FY2009, where `-table` renders GF values nearer the next column's anchor.

**Files:**
- Modify: `scripts/lib/acfrGF.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `column_value`, `CityConfig` from Task 3.
- Produces: `CityConfig(column_strategy: str = 'positional')` accepting `'positional'` or `'ordinal'`; `slots(line) -> list[int]`.

- [ ] **Step 1: Write the failing test**

Append to `acfrGF.selftest.py`:

```python
# Transcribed from King County FY2018 ACFR p43. `4,034` and `8,075` are the two
# General Fund values that render nearer column 1's anchor than column 0's --
# the positional reader drops them and the FY is short by exactly 12,109.
KC_TOTAL_REV = 'TOTAL REVENUES                                   863,031                                 297,708            1,135,158        2,295,897'
KC_BUSINESS  = 'Business and other taxes                                                       4,034                 17     18,190           22,241'
KC_RETAIL    = 'Retail sales and use taxes                       144,422                                             --     99,735           244,157'
KC_PHYSICAL  = 'Physical environment                                                           --                    --     21,278           21,278'

class TestOrdinalColumns(unittest.TestCase):
    def test_positional_reader_drops_the_ragged_value(self):
        cfg = CityConfig(city='X', parents=('current',))
        self.assertNotEqual(column_value(KC_BUSINESS, anchors(KC_TOTAL_REV), cfg), 4034)

    def test_ordinal_reader_recovers_the_ragged_value(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_BUSINESS, anchors(KC_TOTAL_REV), cfg), 4034)

    def test_ordinal_counts_a_dash_as_an_occupied_column(self):
        # GF is present (144,422); the dash marks the BLANK second column. If
        # dashes were skipped, 99,735 would slide left and GF would be wrong.
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_RETAIL, anchors(KC_TOTAL_REV), cfg), 144422)

    def test_ordinal_reads_a_leading_dash_as_zero(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value(KC_PHYSICAL, anchors(KC_TOTAL_REV), cfg), 0)

    def test_ordinal_composes_with_units(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal', units=1000)
        self.assertEqual(column_value(KC_BUSINESS, anchors(KC_TOTAL_REV), cfg), 4_034_000)

    def test_hyphenated_label_is_not_read_as_a_column(self):
        cfg = CityConfig(city='X', parents=('current',), column_strategy='ordinal')
        self.assertEqual(column_value('Non-departmental                    12,500    3,000', anchors(KC_TOTAL_REV), cfg), 12500)
```

- [ ] **Step 2: Run to verify it fails**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: FAIL — `TypeError: __init__() got an unexpected keyword argument 'column_strategy'`.

- [ ] **Step 3: Implement**

Add the slot tokenizer beside `nums_with_pos`:

```python
# A COLUMN SLOT is either a money token or a standalone dash-run standing in for
# a $0/blank cell. Counting dashes as slots is what makes ordinal reading exact:
# it keeps every later column in its true position instead of sliding it left.
# The lookarounds require surrounding whitespace, so a hyphen inside a label
# ("Non-departmental") is never mistaken for a column.
_SLOT = re.compile(r'\((?:\d[\d,]*)\)|\$?\s*\d[\d,]*|(?<=\s)[-–—]{1,3}(?=\s|$)')

def slots(line):
    """Every column slot on `line`, left to right. A dash-run yields 0."""
    out = []
    for m in _SLOT.finditer(line):
        t = m.group().replace('$', '').replace(' ', '').strip()
        if not t:
            continue
        if re.fullmatch(r'[-–—]{1,3}', t):
            out.append(0)
            continue
        v = parse_money(t)
        if v is not None:
            out.append(v)
    return out
```

Rewrite `column_value` to dispatch:

```python
def column_value(line, col_anchors, cfg):
    """The General Fund cell of `line`, scaled to dollars, or None if absent.

    'positional' assigns each number to its nearest column anchor. It is the
    default and what the eight already-loaded cities were parsed with.

    'ordinal' ignores x-positions entirely and takes the FIRST column slot,
    counting dash-runs as occupied columns. Required where `-table` renders a
    value nearer the next column's anchor -- King County FY2018/FY2019 and
    Seattle FY2009, where the positional reader silently drops GF cells and the
    tie fails by exactly the dropped rows.
    """
    if cfg.column_strategy == 'ordinal':
        s = slots(line)
        v = s[0] if s else None
    else:
        v = gf_value(line, col_anchors)
    return None if v is None else v * cfg.units
```

Add to `CityConfig.__init__` (`column_strategy='positional'`), validating the value so a typo fails loudly rather than silently falling back to positional:

```python
        if column_strategy not in ('positional', 'ordinal'):
            raise ValueError('column_strategy must be "positional" or "ordinal", got %r' % column_strategy)
        self.column_strategy = column_strategy
```

In ordinal mode the label must end at the first *slot*, not the first money token, or a leading dash column is absorbed into the label. Add beside `label_of`:

```python
def label_of_slots(line):
    """Row label for ordinal mode: text before the first COLUMN SLOT."""
    m = _SLOT.search(line)
    return norm_label(line[:m.start()] if m else line)
```

and in `classify`, choose per strategy:

```python
    lbl = label_of_slots(line) if cfg.column_strategy == 'ordinal' else label_of(line)
```

Finally widen the trailing-dash stripper in `norm_label` so multi-hyphen runs are removed (`--` currently survives, leaving labels like `Physical environment -- --`):

```python
    s = re.sub(r'(?:\s+[-–—]+)+$', '', s)
```

- [ ] **Step 4: Run the self-test**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: `OK (9 tests)`.

- [ ] **Step 5: Prove no regression**

Run: `node scripts/goldenExtractors.mjs compare .golden-baseline`
Expected: exit 0, `IDENTICAL`.

⚠ The `norm_label` widening is the one edit here that changes a *shared* code path rather than a gated one. If it drifts any existing city, that city had a `--` in a label and its stored labels are already affected — **stop and report rather than adjusting the baseline**.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/acfrGF.py scripts/lib/acfrGF.selftest.py
git commit -m "feat(acfrGF): ordinal column strategy for ragged -table output"
```

---

### Task 5: Library — 2-level revenue trees (`revenue_parents`)

`build_revenue` is flat-only, so a label-only `Taxes` / `Taxes:` row is glued onto its first child. **This does not break the tie** — King County FY2020–FY2025 currently tie $0 while emitting `"Taxes Property taxes"`.

**Files:**
- Modify: `scripts/lib/acfrGF.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `classify`, `CityConfig` from Tasks 3–4.
- Produces: `CityConfig(revenue_parents: tuple = (), revenue_group_members: tuple = ())`. `build_revenue` returns the same `(tree, total, zero_rows)` triple; with `revenue_parents` set, `tree['c']` may contain nodes carrying their own `'c'` list. **Both fields are required together** — `revenue_parents` opens the group, `revenue_group_members` decides which later rows stay in it. Setting the first without the second closes the group after its first child.

- [ ] **Step 1: Write the failing test**

```python
from lib.acfrGF import build_revenue

KC_REV_LINES = [
    'REVENUES',
    'Taxes:',
    'Property taxes                                   417,446    3,871    -',
    'Retail sales and use taxes                       196,647    -        4,569',
    'Licenses and permits                             6,915      -        -',
    'Total revenues                                   621,008    3,871    4,569',
]
KC_ANCHOR = 'Total revenues                                   621,008    3,871    4,569'

class TestRevenueParents(unittest.TestCase):
    def _cfg(self, parents=()):
        # revenue_group_members is what CLOSES the group: 'Retail sales and use
        # taxes' ends in 'taxes' so it stays inside, 'Licenses and permits' does
        # not so it closes the group and lands at root. Passing parents without
        # group members would close the group after its FIRST child.
        return CityConfig(city='X', parents=('current',), column_strategy='ordinal',
                          revenue_parents=parents,
                          revenue_group_members=('taxes',) if parents else ())

    def test_without_config_the_parent_label_is_glued_onto_its_child(self):
        tree, _, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg())
        self.assertEqual(tree['c'][0]['n'], 'Taxes Property taxes')

    def test_with_config_taxes_becomes_a_parent_node(self):
        tree, total, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg(('taxes',)))
        names = [c['n'] for c in tree['c']]
        self.assertEqual(names, ['Taxes', 'Licenses and permits'])
        taxes = tree['c'][0]
        self.assertEqual([c['n'] for c in taxes['c']], ['Property taxes', 'Retail sales and use taxes'])
        self.assertEqual(taxes['a'], 417446 + 196647)
        self.assertEqual(total, 417446 + 196647 + 6915)

    def test_parent_total_still_equals_the_flat_sum(self):
        flat, ftotal, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg())
        nested, ntotal, _ = build_revenue(KC_REV_LINES, anchors(KC_ANCHOR), self._cfg(('taxes',)))
        self.assertEqual(ftotal, ntotal)
```

- [ ] **Step 2: Run to verify it fails**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: FAIL — unexpected keyword `revenue_parents`.

- [ ] **Step 3: Implement**

Add `revenue_parents=()` to `CityConfig.__init__` (`self.revenue_parents = tuple(p.lower() for p in revenue_parents)`), documenting why it is separate from `parents`:

```
    revenue_parents
                 lowercase labels that introduce a group in the REVENUE section
                 (e.g. ('taxes',)). Separate from `parents`, which governs the
                 expenditure section only -- an entity can group one side and
                 not the other, and Seattle does exactly that: `Taxes` is a flat
                 leaf in its 2015-era statements and a parent with five children
                 from 2024.

                 Leaving this empty where the source DOES group is the quiet
                 failure: the parent row is read as a wrapped label and prefixed
                 onto its first child ("Taxes Property taxes"). Amounts are
                 unaffected, so tie_delta stays 0 and only the labels are wrong.
```

Rewrite `build_revenue` to mirror `build_operating`'s parent handling:

```python
def build_revenue(lines, col_anchors, cfg):
    """GF revenue-by-source tree. Flat unless cfg.revenue_parents groups it.
    $0 sources are recorded in zero_rows and dropped."""
    root_children, zero_rows = [], []
    parent = None
    pending = ''
    for l in _section(lines, _SEC_REVENUES, _END_REVENUES):
        kind, lbl, val = classify(l, col_anchors, cfg)
        low = (lbl or '').lower()

        if kind == 'wrapped' and low in cfg.revenue_parents:
            parent = {'n': lbl, 'a': 0, 'c': []}
            root_children.append(parent)
            pending = ''
            continue
        if kind == 'skip':
            continue
        if kind == 'wrapped':
            pending = norm_label('%s %s' % (pending, lbl))
            continue

        full = _fix_label(norm_label('%s %s' % (pending, lbl)) if pending else lbl, cfg)
        pending = ''
        if not full:
            continue
        if val == 0:
            zero_rows.append(full)
            continue

        node = {'n': full, 'a': val}
        if parent is not None:
            parent['c'].append(node)
        else:
            root_children.append(node)

    for n in root_children:
        if 'c' in n:
            n['a'] = sum(ch['a'] for ch in n['c'])
    root_children = [n for n in root_children if n.get('c') or 'c' not in n]

    total = sum(n['a'] for n in root_children)
    return {'n': 'General Fund Revenue by Source', 'a': total, 'c': root_children}, total, zero_rows
```

**A revenue group also needs an explicit way to CLOSE.** In the expenditure tree a `root_leaves` entry closes the open parent, but revenue has no equivalent — once `Taxes` opens, every later source would nest under it and the tree would claim `Licenses and permits` is a kind of tax. Both entities print their tax group first and their ungrouped sources after, so the group must end somewhere. `-table` has already flattened the indentation that says where, so the rule has to be explicit.

Add a second `CityConfig` field alongside `revenue_parents`:

```
    revenue_group_members
                 lowercase label SUFFIXES that remain inside an open revenue
                 group. Both entities name every member of the tax group so it
                 ends in "taxes" ("Property taxes", "Retail sales and use
                 taxes"), while the first ungrouped source does not
                 ("Licenses and permits") -- so ('taxes',) closes the group in
                 exactly the right place.

                 Required whenever revenue_parents is set. Leaving it empty
                 closes the group after its FIRST child; omitting the close
                 entirely swallows every later source into the group. Both
                 still tie $0 -- only the shape is wrong.
```

and close the group in `build_revenue`, immediately before the `node = {...}` assignment:

```python
        # Close an open revenue group once a row is no longer one of its members.
        if parent is not None and parent['c'] and not any(
                low.endswith(sfx) for sfx in cfg.revenue_group_members):
            parent = None
```

- [ ] **Step 4: Run the self-test**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: `OK (12 tests)`. In particular `test_with_config_taxes_becomes_a_parent_node` must show `Licenses and permits` at ROOT, not nested under `Taxes`.

- [ ] **Step 5: Prove no regression**

Run: `node scripts/goldenExtractors.mjs compare .golden-baseline`
Expected: exit 0, `IDENTICAL` — `revenue_parents` defaults to empty, so every existing city takes the flat path.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/acfrGF.py scripts/lib/acfrGF.selftest.py
git commit -m "feat(acfrGF): optional 2-level revenue trees via revenue_parents"
```

---

### Task 6: Library — statement anchor, section-header mode, fiscal-year end

Three small config knobs that together unblock Seattle FY2009 and FY2024/25, and stop both entities depending on a year appearing in the filename.

**Files:**
- Modify: `scripts/lib/acfrGF.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Produces: `CityConfig(statement_anchor: str | None = None, section_header_mode: str = 'exact', fy_end: tuple = ('June', 30))`.

- [ ] **Step 1: Write the failing test**

```python
from lib.acfrGF import find_statement_page, parse_fy, _is_section_header

# Seattle FY2009 p68 -- "Page 1 of 2" is printed BETWEEN "AND CHANGES" and
# "IN FUND BALANCES", so the title regex cannot span the wrap.
SEA2009_PAGE = '\n'.join([
    'The City                 of  Seattle', '',
    'B-4                                STATEMENT OF REVENUES, EXPENDITURES, AND                 CHANGES', '',
    'Page 1 of 2                                           IN FUND BALANCES', '',
    '                                                      GOVERNMENTAL FUNDS', '',
    '                                          For the Year Ended December 31, 2009', '',
    '                                                            General         Transportation', '',
    'REVENUES', 'Taxes                          756,909    63,321',
    'Total Revenues                 942,408    167,604',
    'EXPENDITURES', 'General Government             100,000    5,000',
    'Total Expenditures             737,604    277,816',
])
# Seattle FY2024 p56 -- the REVENUES line also carries the fund column headers.
SEA2024_REV_HEADER = '     REVENUES                                                 General Fund             Transportation  Governmental      2024'

class TestPageAndHeaders(unittest.TestCase):
    def test_title_regex_alone_cannot_find_the_2009_page(self):
        self.assertEqual(find_statement_page([SEA2009_PAGE], None)[0], None)

    def test_schedule_id_anchor_finds_the_2009_page(self):
        self.assertEqual(find_statement_page([SEA2009_PAGE], r'^\s*B-4\b')[0], 0)

    def test_exact_header_mode_rejects_a_header_carrying_column_titles(self):
        self.assertFalse(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'exact'))

    def test_prefix_header_mode_accepts_it(self):
        self.assertTrue(_is_section_header(SEA2024_REV_HEADER.strip(), 'revenues', 'prefix'))

    def test_prefix_mode_still_rejects_the_wrapped_statement_title(self):
        # Trap 2: a prefix match on the wrapped title would open the expenditure
        # section at the TITLE and swallow the entire revenue block.
        self.assertFalse(_is_section_header(
            'EXPENDITURES, AND CHANGES IN FUND BALANCES', 'expenditures', 'prefix'))

    def test_december_fiscal_year_end_is_read_from_the_document(self):
        self.assertEqual(parse_fy([SEA2009_PAGE], 'no-year-in-this-path.pdf', ('December', 31)), 2009)

    def test_june_remains_the_default(self):
        page = 'For the Fiscal Year Ended June 30, 2025'
        self.assertEqual(parse_fy([page], 'x.pdf', ('June', 30)), 2025)
```

- [ ] **Step 2: Run to verify it fails**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: FAIL — `find_statement_page() takes 1 positional argument but 2 were given`.

- [ ] **Step 3: Implement**

Add the three `CityConfig` fields, documenting the anchor:

```
    statement_anchor
                 optional regex identifying the statement page by its SCHEDULE
                 ID rather than its title (Seattle tags every vintage `B-4`).
                 Used in ADDITION to the title match, not instead of it.

                 Needed because Seattle's FY2009-era statement prints
                 "Page 1 of 2" between "...AND CHANGES" and "IN FUND BALANCES",
                 so no title regex can span the wrap. Page 2 of 2 carries the
                 same `B-4`, but `find_statement_page` returns the EARLIEST
                 qualifying page and the General Fund column plus both `Total`
                 rows are wholly on page 1, so page 1 always wins.

    section_header_mode
                 'exact' (default) requires the section header to be the WHOLE
                 line. 'prefix' allows trailing text, which Seattle's 2024-era
                 statements need because the `REVENUES` line also carries the
                 fund column headers.

                 'prefix' is safe ONLY where no line begins with the section
                 word for another reason. Verify against the wrapped statement
                 title before enabling it -- a prefix match there is trap 2 and
                 inflates the operating total roughly 3x.

    fy_end       (month_name, day) of the fiscal-year end, used to read the year
                 off the statement. Defaults to ('June', 30). Seattle and King
                 County close on December 31.

                 Without this the year falls back to a regex over the FILE PATH,
                 which silently mislabels a row whenever a filename is wrong.
```

Make the FY pattern config-driven and the page finder anchor-aware:

```python
def _fy_re(fy_end):
    month, day = fy_end
    return re.compile(
        r'(?:for\s+the\s+)?(?:fiscal\s+)?year\s+ended\s+%s\s+%d,\s*(\d{4})' % (month, day), re.I)

def parse_fy(pages, pdf_path, fy_end=('June', 30)):
    pat = _fy_re(fy_end)
    for pg in pages:
        m = pat.search(pg)
        if m:
            return int(m.group(1))
    m = re.search(r'(20\d{2})', pdf_path)
    return int(m.group(1)) if m else None
```

```python
def find_statement_page(pages, statement_anchor=None):
    anchor = re.compile(statement_anchor, re.I | re.M) if statement_anchor else None
    cands = []
    for i, pg in enumerate(pages):
        low = pg.lower()
        if not (_TITLE.search(pg) or (anchor and anchor.search(pg))):
            continue
        if 'total revenues' not in low or 'total expenditures' not in low:
            continue
        if 'general' not in low or 'fund' not in low:
            continue
        if any(x in low for x in _EXCLUDE):
            continue
        cands.append((i, pg))
    if not cands:
        return None, None
    cands.sort()
    return cands[0]
```

```python
def _is_section_header(line, want, mode='exact'):
    s = re.sub(r'\s+', '', line).strip().rstrip('$').rstrip(':').lower()
    if mode == 'prefix':
        # Trap 2 guard: the wrapped title collapses to
        # "expendituresandchangesinfundbalances" and must NEVER open a section.
        if 'changesinfund' in s:
            return False
        return s.startswith(want)
    return s == want
```

Thread `mode` through `_section(lines, start_word, end_pat, mode)` and its two callers, and update `extract` to pass `cfg.statement_anchor` and `cfg.fy_end`.

- [ ] **Step 4: Run the self-test**

Run: `py -3 scripts/lib/acfrGF.selftest.py`
Expected: `OK (19 tests)`.

- [ ] **Step 5: Prove no regression**

Run: `node scripts/goldenExtractors.mjs compare .golden-baseline`
Expected: exit 0, `IDENTICAL`. All three knobs default to today's behaviour.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/acfrGF.py scripts/lib/acfrGF.selftest.py
git commit -m "feat(acfrGF): statement anchor, prefix section headers, configurable FY end"
```

---

### Task 7: Seattle extractor + window sweep

**Files:**
- Create: `scripts/extractSeattle.py`

**Interfaces:**
- Consumes: `CityConfig`, `run_cli` from `scripts/lib/acfrGF.py`.
- Produces: CLI `py -3 scripts/extractSeattle.py <pdf> --mode operating|revenue` emitting the standard JSON result (`fiscal_year`, `tree`, `computed_total`, `printed_total`, `tie_delta`, `zero_rows`).

- [ ] **Step 1: Write the wrapper**

```python
#!/usr/bin/env python3
"""
City of Seattle ACFR — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

Seattle specifics
-----------------
* AMOUNTS ARE IN THOUSANDS -> units=1000. The tie gate cannot catch this.
* Three format eras, all handled by one config:
    2009   statement split across two pages; GF column and both Total rows are
           wholly on page 1. "Page 1 of 2" interrupts the wrapped title, which
           is why statement_anchor='^\\s*B-4\\b' is required -- Seattle tags the
           statement B-4 in every vintage checked (2009/2015/2019/2024/2025).
    2015   four fund columns PLUS two comparative-year columns. The General
           column is leftmost, so slot 0 stays correct and no comparative
           rejection is needed. `Taxes` is a FLAT leaf in this era.
    2024+  `Taxes` becomes a PARENT with five children, and the REVENUES line
           also carries the fund column headers -> section_header_mode='prefix'.
* column_strategy='ordinal' because the FY2009 statement renders GF values that
  the positional reader mis-assigns; verified to tie $0 on 2009/2015/2019/2024/2025.
* revenue_parents=('taxes',) is harmless in the eras where `Taxes` is flat --
  a flat `Taxes` row carries a value, so it is data, not a group header.

Usage:
  py -3 scripts/extractSeattle.py "docs/Seattle/seattle-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Seattle, WA',
    parents=('current', 'capital outlay', 'debt service'),
    root_leaves=(),
    revenue_parents=('taxes',),
    revenue_group_members=('taxes',),
    column_strategy='ordinal',
    units=1000,
    statement_anchor=r'^\s*B-4\b',
    section_header_mode='prefix',
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

- [ ] **Step 2: Verify the five known-good years**

```bash
for fy in 2009 2015 2019 2024 2025; do
  for m in revenue operating; do
    py -3 scripts/extractSeattle.py "docs/Seattle/seattle-$fy-acfr.pdf" --mode $m \
      | py -3 -c "import json,sys; r=json.load(sys.stdin); print(f\"SEA{r['fiscal_year']} {r['mode']:9} delta={r['tie_delta']:+} total={r['computed_total']:,}\")"
  done
done
```

Expected: ten lines, every `delta=+0`. FY2024 must read `revenue total=2,272,762,000` and `operating total=2,390,575,000` — **note the trailing three zeros; that is the ×1000 landing.** A total of `2,272,762` means `units` is not applied.

- [ ] **Step 3: Sweep the full window and record the truth**

```bash
for fy in $(seq 2009 2025); do
  for m in revenue operating; do
    f="docs/Seattle/seattle-$fy-acfr.pdf"
    [ -f "$f" ] || { echo "SEA$fy $m NO-PDF"; continue; }
    py -3 scripts/extractSeattle.py "$f" --mode $m >/dev/null 2>&1 \
      && echo "SEA$fy $m OK" || echo "SEA$fy $m FAIL"
  done
done
```

Expected: FY2009/2015/2019/2024/2025 OK. **The other twelve years are genuinely unknown — record exactly which pass.** Do not adjust the config to force a year through; a `FAIL` here is the gate doing its job. Note each failure and its `tie_delta` for the deferred-items log.

- [ ] **Step 4: Read the labels, not just the ties**

```bash
py -3 scripts/extractSeattle.py "docs/Seattle/seattle-2024-acfr.pdf" --mode revenue \
  | py -3 -c "import json,sys; t=json.load(sys.stdin)['tree']; [print(c['n'], '->', [g['n'] for g in c.get('c',[])]) for c in t['c']]"
```

Expected: a `Taxes` node with five children (`Property Taxes`, `Sales Taxes`, `Business Taxes`, `Excise Taxes`, `Other Taxes`) and the remaining sources at root. **No label may begin with `Taxes ` glued to another word**, and none may contain a stray `-` or `--`. A $0 tie proves arithmetic and never labels.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractSeattle.py
git commit -m "feat: Seattle ACFR General Fund extractor"
```

---

### Task 8: King County extractor + window sweep

**Files:**
- Create: `scripts/extractKingCounty.py`

**Interfaces:**
- Produces: CLI `py -3 scripts/extractKingCounty.py <pdf> --mode operating|revenue`, same JSON shape as Task 7.

- [ ] **Step 1: Write the wrapper**

```python
#!/usr/bin/env python3
"""
King County, WA ACFR — General Fund extractor (GAAP actuals).

Thin wrapper over scripts/lib/acfrGF.py.

King County specifics
---------------------
* AMOUNTS ARE IN THOUSANDS -> units=1000.
* Statement splits across two pages in every year; the GF column and both Total
  rows are wholly on page 1, so no multi-page handling is needed.
* Expenditure tree is the Bend/Tualatin shape: `Current:` and `Debt service:`
  are parents, `Capital outlay` is a VALUED LEAF at root.
* column_strategy='ordinal' is REQUIRED, not cosmetic. In FY2018/FY2019
  `pdftotext -table` renders some GF values nearer column 1's anchor; the
  positional reader drops them and FY2018 revenue comes up short by exactly
  4,034 + 8,075 = 12,109. FY2020+ tie either way, but one strategy per entity
  keeps every year on the same reading.
* revenue_parents=('taxes',) fixes labels only. Without it FY2020-FY2025 STILL
  TIE $0 while emitting "Taxes Property taxes" -- the silent trap.
* County vocabulary differs from any TT city: `Intergovernmental revenues`,
  `Investment gains`/`Interest earnings`, `Law, safety and justice`.
* FY2018-era drift: totals are printed UPPERCASE, and there is an extra
  debt-service child `Payment to escrow` absent from later years.

Usage:
  py -3 scripts/extractKingCounty.py "docs/KingCounty/kingcounty-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='King County, WA',
    parents=('current', 'debt service'),
    root_leaves=('capital outlay',),
    revenue_parents=('taxes',),
    revenue_group_members=('taxes',),
    column_strategy='ordinal',
    units=1000,
    fy_end=('December', 31),
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

- [ ] **Step 2: Sweep all eight years**

```bash
for fy in $(seq 2018 2025); do
  for m in revenue operating; do
    py -3 scripts/extractKingCounty.py "docs/KingCounty/kingcounty-$fy-acfr.pdf" --mode $m \
      | py -3 -c "import json,sys; r=json.load(sys.stdin); print(f\"KC{r['fiscal_year']} {r['mode']:9} delta={r['tie_delta']:+} total={r['computed_total']:,}\")" \
      || echo "KC$fy $m FAIL"
  done
done
```

Expected: sixteen lines, every `delta=+0`. FY2024 must read `revenue total=1,202,912,000` and `operating total=1,137,458,000`; FY2018 `revenue total=863,031,000` and `operating total=770,097,000`.

⚠ FY2020–FY2025 tied $0 under the *positional* reader during scoping, but only FY2018/FY2019 were proven under *ordinal* at the library's chosen page. **If any of FY2020–FY2025 now fails, the cause is the ordinal reader on that era — report it rather than special-casing**, since a per-era strategy split would mean two readings of one document.

- [ ] **Step 3: Read the labels**

```bash
py -3 scripts/extractKingCounty.py "docs/KingCounty/kingcounty-2018-acfr.pdf" --mode operating \
  | py -3 -c "import json,sys; t=json.load(sys.stdin)['tree']; [print(c['n'],'->',[g['n'] for g in c.get('c',[])]) for c in t['c']]"
```

Expected: `Current` with its function children, `Debt service` with `Principal` / `Interest and other debt service costs` / `Payment to escrow`, and `Capital outlay` as a root-level leaf. **No label may contain `--`** — that artifact was visible in scoping (`Physical environment -- --`) and Task 4's `norm_label` widening is what removes it.

- [ ] **Step 4: Commit**

```bash
git add scripts/extractKingCounty.py
git commit -m "feat: King County ACFR General Fund extractor"
```

---

### Task 9: Entity seeder

**Files:**
- Create: `scripts/seedWashingtonSeattle.js`

**Interfaces:**
- Consumes: `treasury_ensure_municipality` RPC, `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Produces: exports `getSeattleId(supabase)` and `getKingCountyId(supabase)` returning UUIDs; Tasks 10–12 import these rather than hardcoding IDs.

- [ ] **Step 1: Confirm the current DB state**

Run this before writing anything, so the seeder is written against reality:

```sql
select id, name, state, entity_type, population, county_id
from treasury.municipalities
where state = 'WA' order by entity_type, name;
```

Expected today: exactly one row — `Washington` (state, pop 7,705,281). If Seattle or King County already exist, **stop and report**: this plan assumes a fresh insert and would otherwise need to become an update.

- [ ] **Step 2: Write the seeder**

Model it on `scripts/seedTucsonArizona.js` (Tucson + Pima County is the same city-under-county shape). Requirements:
- Seattle: `entity_type='city'`, `state='WA'`.
- King County: `entity_type='county'`, `state='WA'`.
- Link Seattle to King County via a **NULL-or-same `county_id` guard** — only set `county_id` when it is currently NULL or already King County's id, so a re-run can never repoint an entity.
- Populations **pinned from live Census Vintage-2024 CSVs at seed time**, never a remembered figure. Print the value and its source URL.
- Insert **zero** `data_source` rows.
- Idempotent: a second run must report 0 changes.
- Fail loudly (non-zero exit) on any RPC error.

The `county_id` link is the subtle part — write it exactly this way:

```js
/**
 * Link Seattle to King County under a NULL-or-same guard.
 *
 * The guard exists so a re-run can never REPOINT an entity that something else
 * already claimed. An unconditional update would silently move a city between
 * counties on any future run; failing loudly is the only safe response to an
 * unexpected existing value.
 */
async function linkSeattleToKingCounty(supabase, seattleId, kingCountyId) {
  const { data: row, error } = await supabase.schema('treasury').from('municipalities')
    .select('county_id').eq('id', seattleId).single();
  if (error) throw new Error(`Could not read Seattle's county_id: ${error.message}`);

  if (row.county_id === kingCountyId) { console.log('  county_id already correct - no change'); return; }
  if (row.county_id !== null) {
    throw new Error(
      `Seattle.county_id is already ${row.county_id}, not King County (${kingCountyId}). ` +
      `Refusing to repoint an existing link.`);
  }
  const { error: upErr } = await supabase.schema('treasury').from('municipalities')
    .update({ county_id: kingCountyId }).eq('id', seattleId).is('county_id', null);
  if (upErr) throw new Error(`county_id update failed: ${upErr.message}`);
  console.log(`  Linked Seattle -> King County (${kingCountyId})`);
}
```

- [ ] **Step 3: Dry-run, then run**

Run: `node scripts/seedWashingtonSeattle.js --dry-run` then without the flag.
Expected: two entities created, Seattle's `county_id` = King County's id.

- [ ] **Step 4: Verify idempotency**

Run: `node scripts/seedWashingtonSeattle.js`
Expected: 0 changes reported. Then re-run the Step 1 SQL — expected three WA rows (state, county, city) with populations set and Seattle's `county_id` populated.

- [ ] **Step 5: Commit**

```bash
git add scripts/seedWashingtonSeattle.js
git commit -m "feat: seed Seattle city + King County node"
```

---

### Task 10: Seattle loader

**Files:**
- Create: `scripts/processSeattle.js`

**Interfaces:**
- Consumes: `scripts/extractSeattle.py`; `SEATTLE_URLS` from `scripts/fetchSeattleKingCounty.mjs`; `getSeattleId` from `scripts/seedWashingtonSeattle.js`.
- Produces: `budgets` rows keyed `(municipality_id, fiscal_year, dataset_type)` for every passing FY × mode.

- [ ] **Step 1: Write the loader**

Copy `scripts/processBend.js` as the structural model and change exactly these things:

- `source_date` is **`${fy}-12-31`**, not `-06-30`.
- `source_url` comes from `SEATTLE_URLS[fy]` — the same URL the fetcher used.
- Ephemeral `data_sources` `dataset_id`s: `seattle-acfr-gf-revenue` / `seattle-acfr-gf-operating`; `base_url` the Seattle ACFR index page.
- Tree mapping is unchanged from Bend's: a root child **with** `.c` maps to `{n, a, i:[...children]}`; a root child **without** `.c` maps to a single-item leaf. Seattle's revenue tree now has both shapes (a `Taxes` parent plus flat siblings), so **both branches are exercised on the revenue side** — Bend only ever hit them on the operating side.
- Keep the pre-load delete keyed on `(municipality_id, fiscal_year, dataset_type)`, the `try/finally` ephemeral cleanup, and per-FY `throw` (never `process.exit`) from inside `processMode`.

- [ ] **Step 2: Add the unit plausibility guard**

This is the only mechanical defence against a ×1000 error reaching the DB. Add to `loadFiscalYear`, before the RPC call:

```js
// The tie gate is unit-invariant: it reads $0 whether or not the thousands
// multiplier was applied. Per-capita is the cheapest oracle that is NOT.
// Seattle GF spend is ~$2.4B over ~780k residents ~= $3,065/resident; a missing
// x1000 lands at ~$3.07 and a doubled one at ~$3.07M. Anything outside this
// band is a unit error, not an unusual budget year.
const perCapita = total / population;
if (perCapita < 500 || perCapita > 25000) {
  throw new Error(
    `FY${fy} ${datasetType}: $${perCapita.toFixed(2)}/resident is outside the ` +
    `plausible band [500, 25000]. Total=$${total.toLocaleString()}, pop=${population}. ` +
    `This is almost certainly a units error -- check CityConfig.units.`);
}
```

- [ ] **Step 3: Dry-run**

Run: `node scripts/processSeattle.js --dry-run`
Expected: one line per FY × mode with `row_count` and `total`. FY2024 operating must print `$2,390,575,000`. **Confirm every total ends in three zeros.**

- [ ] **Step 4: Load, then verify against the DB**

Run: `node scripts/processSeattle.js`
Then:

```sql
select fiscal_year, dataset_type, total_budget, source_date, left(source_url, 60) as url
from treasury.budgets
where municipality_id = '<seattle-id>' order by fiscal_year desc, dataset_type;
```

Expected: two rows per passing FY, `source_date = '<FY>-12-31'`, distinct correct-per-FY URLs, `total_budget` matching the dry-run.

- [ ] **Step 5: Verify idempotency and zero residue**

Run: `node scripts/processSeattle.js` a second time, then:

```sql
select count(*) from treasury.data_sources where dataset_id like 'seattle-%';
```

Expected: row count and totals unchanged; residue count **0**.

- [ ] **Step 6: Commit**

```bash
git add scripts/processSeattle.js
git commit -m "feat: load Seattle General Fund operating + revenue from ACFRs"
```

---

### Task 11: King County loader

**Files:**
- Create: `scripts/processKingCounty.js`

**Interfaces:**
- Consumes: `scripts/extractKingCounty.py`; `KING_COUNTY_URLS`; `getKingCountyId`.

- [ ] **Step 1: Write the loader**

Same structure as Task 10, with:
- `dataset_id`s `kingcounty-acfr-gf-revenue` / `kingcounty-acfr-gf-operating`.
- `source_date = ${fy}-12-31`.
- Per-capita band computed against King County's population (~2.3M), so FY2024 operating ≈ $1.14B / 2.3M ≈ **$495/resident**. That sits below Seattle's floor, so **use a band of `[100, 25000]` here** and state the reason in a comment — a county's GF per-capita is legitimately much lower than a city's because most county services run through enterprise and special revenue funds.

- [ ] **Step 2: Handle the FY2018 archive citation explicitly**

FY2018's `source_url` is a `web.archive.org` URL. Make that visible rather than incidental:

```js
// King County FY2018 is cited to the Internet Archive because the issuer's own
// URL is dead -- the /~/media/ Sitecore path was decommissioned and FY2018 is
// the only recoverable pre-2019 year. This is the ONLY archive-cited row in TT;
// the audit in Task 13 asserts that it stays the only one.
function dataSourceLabel(fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const base = `King County ACFR General Fund ${kind} (GAAP actuals)`;
  return fy === 2018 ? `${base} (via Internet Archive)` : base;
}
```

- [ ] **Step 3: Dry-run, load, verify**

Run: `node scripts/processKingCounty.js --dry-run`, then without the flag.
Expected: 16 rows. FY2024 operating `$1,137,458,000`; FY2018 revenue `$863,031,000`.

```sql
select fiscal_year, dataset_type, total_budget, data_source
from treasury.budgets where municipality_id = '<king-county-id>'
order by fiscal_year, dataset_type;
```

Expected: FY2018's two rows carry the `(via Internet Archive)` label; no other row does.

- [ ] **Step 4: Verify idempotency and residue**

Run the loader again; expected 0 net change and `select count(*) from treasury.data_sources where dataset_id like 'kingcounty-%'` → **0**.

- [ ] **Step 5: Commit**

```bash
git add scripts/processKingCounty.js
git commit -m "feat: load King County General Fund operating + revenue from ACFRs"
```

---

### Task 12: Category enrichment

**Files:**
- Create: `data/seattleEnrichment.mjs`
- Create: `scripts/loadSeattleEnrichment.mjs`

**Interfaces:**
- Consumes: `getSeattleId`, `getKingCountyId`.
- Produces: `category_enrichment` rows scoped by `municipality_id`.

- [ ] **Step 1: Enumerate the live keys**

```sql
select distinct bc.name_key
from treasury.budget_categories bc
join treasury.budgets b on b.id = bc.budget_id
where b.municipality_id in ('<seattle-id>', '<king-county-id>')
order by 1;
```

Write copy for **every** key returned. A key without enrichment renders bare in the UI.

- [ ] **Step 2: Write the copy**

Model on `data/tucsonEnrichment129.mjs`. Two hard requirements:

1. **No `$` figures and no locality bleed.** Enrichment is reused across years; a hardcoded amount goes stale silently.
2. **The fund-scope caveat must appear**, because GF-only understates both entities more than any prior TT city. Include, on the root categories:
   > These figures cover the General Fund only. Seattle also operates City Light, Seattle Public Utilities and a major Transportation fund outside the General Fund, so this reflects roughly a quarter of total city spending.

   and for King County:
   > These figures cover the General Fund only. King County's Metro Transit and wastewater treatment operate as enterprise funds outside the General Fund and are not included here.

- [ ] **Step 3: Write the loader**

Model on `scripts/loadTucsonEnrichment.mjs`. Requirements:
- **Delete-then-insert**, never upsert: the `category_enrichment` unique index is `NULLS DISTINCT`, so an upsert on a NULL `municipality_id` inserts duplicates instead of updating.
- Every row scoped to a `municipality_id` — never NULL, which would bleed Seattle's text onto other cities.
- **Abort on 0 live keys** rather than reporting a vacuous success.
- $0 cost — no paid AI calls.

The write must be delete-then-insert, not upsert:

```js
/**
 * The category_enrichment unique index is NULLS DISTINCT, so an upsert on
 * (name_key, municipality_id) does NOT match an existing row when
 * municipality_id is NULL -- it inserts a duplicate instead of updating.
 * Delete-then-insert is the only write that is correct for both scoped and
 * universal rows, so it is used unconditionally.
 */
async function writeEnrichment(supabase, muniId, rows) {
  if (!rows.length) throw new Error(`Refusing to write 0 enrichment rows for ${muniId}`);
  const { error: delErr } = await supabase.schema('treasury')
    .from('category_enrichment').delete().eq('municipality_id', muniId);
  if (delErr) throw new Error(`enrichment delete failed: ${delErr.message}`);

  const payload = rows.map(r => ({ ...r, municipality_id: muniId }));
  if (payload.some(r => !r.municipality_id)) {
    throw new Error('An enrichment row has no municipality_id -- a NULL scope bleeds this copy onto every other city.');
  }
  const { error: insErr } = await supabase.schema('treasury')
    .from('category_enrichment').insert(payload);
  if (insErr) throw new Error(`enrichment insert failed: ${insErr.message}`);
  console.log(`  Wrote ${payload.length} enrichment rows for ${muniId}`);
}
```

- [ ] **Step 4: Run and verify coverage**

Run: `node scripts/loadSeattleEnrichment.mjs`

```sql
select m.name, count(*) as enriched
from treasury.category_enrichment ce
join treasury.municipalities m on m.id = ce.municipality_id
where ce.municipality_id in ('<seattle-id>', '<king-county-id>')
group by m.name;
```

Expected: coverage equal to the Step 1 key count for each entity, with **0 rows** where `municipality_id is null`.

- [ ] **Step 5: Commit**

```bash
git add data/seattleEnrichment.mjs scripts/loadSeattleEnrichment.mjs
git commit -m "feat: category enrichment for Seattle + King County"
```

---

### Task 13: Independent verification

The extractors must not be able to vouch for themselves. This task re-derives everything on a separate code path.

**Files:**
- Create: `scripts/verify-seattle-rederive.mjs`
- Create: `scripts/verify-seattle-audit.mjs`

**Interfaces:**
- Consumes: the live DB and the PDFs in `docs/`.
- Produces: `docs/superpowers/plans/SEATTLE-REDERIVATION.md`; both scripts exit non-zero on any mismatch.

- [ ] **Step 1: Write the re-derivation**

Requirements:
- Its **own** `pdftotext -table` pass and its **own** parser written in JS. It must **not** import `extractSeattle.py`, `extractKingCounty.py` or `lib/acfrGF.py` — a shared bug would otherwise verify itself.
- Compare **leaf-for-leaf and subtotal-for-subtotal**, not just roll-ups, against `treasury.budgets` + `budget_categories` + `budget_line_items`.
- Require exact `$0`. Model: `scripts/verify-phase130-rederive.mjs`.

- [ ] **Step 2: Run it**

Run: `node scripts/verify-seattle-rederive.mjs`
Expected: every FY × mode for both entities at delta `$0`, exit 0.

- [ ] **Step 3: Write the audit**

It must assert all of:
- (a) every loaded row has a non-null, correct-per-FY `source_url` that resolves **200 `application/pdf`**;
- (b) `source_date = '<FY>-12-31'` on every row;
- (c) **0** residue in `data_sources` matching `seattle-%` or `kingcounty-%`;
- (d) no label anywhere contains `--`, or begins with a glued parent name such as `Taxes `;
- (e) **the units landed** — assert FY2024 Seattle operating is exactly `2390575000` and King County operating exactly `1137458000`, read from the DB. This is the check the tie gate structurally cannot perform;
- (f) **exactly two rows FOR KING COUNTY cite `web.archive.org`**, both FY2018. More means the exception spread within this load; fewer means FY2018 did not load.

  ⚠️ **Corrected 2026-08-14.** This check originally read "exactly two rows in the entire `budgets` table", on the spec's claim that no existing row cited an archive. That claim was **false** and the check would have failed. **New Hampshire (state) already has 16 archive-cited rows, FY2017–FY2024**, predating this work entirely — verified in the live database. So the assertion must be scoped to King County's `municipality_id`. Do NOT assert an application-wide count of 2. Optionally also assert that the pre-existing New Hampshire rows are unchanged, which is the more useful invariant: this load added exactly 2 archive-cited rows and touched no others.

- [ ] **Step 4: Run it**

Run: `node scripts/verify-seattle-audit.mjs`
Expected: all six checks pass, exit 0.

- [ ] **Step 5: Check the Essentials tether**

Model on `scripts/verify-phase130-tether.mjs`: fetch the live `coverage.json` and mirror `matchEntityToCoverage` for Seattle (city) and King County (county) to predict whether the banner icon appears. A gap is a **cross-repo Essentials note, not a TT change** — Madison hit exactly this and it was correctly recorded rather than worked around.

⚠ Set `process.exitCode` and let the process drain rather than calling `process.exit()`; an abrupt exit races undici's keep-alive socket into a Windows libuv `UV_HANDLE_CLOSING` assert.

- [ ] **Step 6: Write up and commit**

Record in `SEATTLE-REDERIVATION.md`: the final per-entity FY windows actually loaded, every year excluded **with its `tie_delta`**, all six audit results, and the tether verdict.

```bash
git add scripts/verify-seattle-rederive.mjs scripts/verify-seattle-audit.mjs
git add -f docs/superpowers/plans/SEATTLE-REDERIVATION.md
git commit -m "test: independent re-derivation and source-chain audit for Seattle + King County"
```

- [ ] **Step 7: Hand off for UAT**

Present at `treasurytracker.empowered.vote`: both entities' Money Out and Money In, the icicle drill-down on Seattle's `Taxes` group and King County's `Current`, the source chip reading `as of <FY>-12-31`, and the `US → Washington → King County → Seattle` navigation path.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: scope/windows → Tasks 7, 8, 10, 11; the `units` requirement → Task 3 plus guards in Tasks 10, 11, 13; ordinal/ragged columns → Task 4; revenue trees → Task 5; the `B-4` anchor → Task 6; source acquisition incl. the FY2018 archive → Task 2; the entity/nav model → Task 9; enrichment and the fund-scope caveat → Task 12; all five verification items → Task 13; the golden-diff guardrail → Task 1.

**Two spec requirements are deliberately dropped**, both because probing disproved them: **multi-page statement support** (the GF column and both `Total` rows are wholly on page 1 of every split statement) and **comparative-column rejection** (Seattle's comparative columns sit right of the General column, so slot 0 is unaffected; FY2015 already ties $0). Building either would be dead code. This plan supersedes the spec on both points.

**One spec number changed:** King County's per-capita floor. The spec implied a single plausibility band; a county's GF per-capita (~$495) is legitimately far below a city's (~$3,065), so Task 11 sets its own band with the reason recorded.

**Known-unknown, stated rather than hidden:** twelve of Seattle's seventeen years and six of King County's eight have not been extraction-tested. Tasks 7 and 8 sweep them and record the truth; the plan does not assume they pass, and the tie gate — not the plan — decides the final window.

**One deliberate deviation from plan-writing convention.** Tasks 9–13 say "model on `scripts/processBend.js` / `seedTucsonArizona.js` / `verify-phase130-rederive.mjs`, changing exactly these things" plus an enumerated diff, rather than transcribing those files. Reproducing ~440 lines of `processBend.js` inline would create a second copy that drifts from the real one the moment either changes, and the enumerated diff is the part that is actually specific to this work. The subtle, easy-to-get-wrong pieces — the `county_id` NULL-or-same guard, the delete-then-insert enrichment write, the per-capita unit guard, the archive-citation label — are written out in full. If the named model file is missing when a task is executed, stop and report rather than improvising a loader from scratch.

**Type consistency verified.** `CityConfig` gains `units` (T3), `column_strategy` (T4), `revenue_parents` + `revenue_group_members` (T5), `statement_anchor` + `section_header_mode` + `fy_end` (T6); Tasks 7 and 8 use only those plus the pre-existing `city` / `parents` / `root_leaves`. `column_value(line, col_anchors, cfg)` and `classify(line, col_anchors, cfg)` keep one signature from T3 onward. Self-test counts chain 3 → 9 → 12 → 19.
