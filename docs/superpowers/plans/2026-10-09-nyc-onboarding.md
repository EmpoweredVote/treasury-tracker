# New York City Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the City of New York into Treasury Tracker from its own ACFR — revenue-by-source and expenditure-by-function, FY2002–FY2025, in two fund scopes, every row audited GAAP and durably sourced.

**Architecture:** A thin per-entity extractor wrapper over the existing shared `pdftotext -table` reader (`scripts/lib/acfrGF.py`), driven twice per year — once on the General Fund column and once on the Total Governmental Funds column. A scope-aware loader modelled on `scripts/loadInCountyAcfrs.mjs` writes both series. An independent pdfplumber coordinate reader corroborates every year, and each book's prior-year column provides a third cross-check.

**Tech Stack:** Node ESM (`.mjs`), Python 3 via `scripts/lib/pythonBin.mjs` `resolvePython()`, `pdftotext -table` (poppler), pdfplumber, Supabase RPC `treasury_sync_city_budget`, vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-nyc-onboarding-design.md`

## Global Constraints

- **Window: FY2002–FY2025, 24 fiscal years.** FY2001 is excluded (pre-GASB-34; see spec §3.1).
- **Units = 1000.** The statement caption reads `(in thousands)`.
- **`fiscal_year_start_month = 7`**, set explicitly on every row. Never left to the column default.
- **`fyEndMonthDay = '06-30'`** → `source_date = {FY}-06-30`.
- **`basis = 'actual'`, `derivation = 'published'`.**
- **Two fund scopes:** `general_fund` and `total_governmental`. Exact strings from `scripts/lib/fundScope.mjs`.
- **Entity:** `name='New York City'` (never bare `New York` — that is the state node `1a7f871c-7f2e-4786-9c55-5ab3409716f4`), `entity_type='city'`, `state='NY'`, `county_id=NULL`, `geoid='3651000'`.
- **Target row count: 96** = 24 years × 2 datasets × 2 scopes.
- **`exclude_ignore=('reconciliation', 'net position')`** on the extractor config.
- **Base URL:** `https://comptroller.nyc.gov/wp-content/uploads/documents/`
- **`docs/*` is gitignored** — plans, specs and any committed doc are force-added (`git add -f`). Fetched PDFs under `docs/NYC/` are NOT committed.
- **No shebang on anything under `scripts/lib/`.** A test guards it; `#!` plus CRLF breaks the whole Vite suite with an error naming no file.
- **Never bulk-edit a source file with PowerShell `Set-Content -Encoding utf8`** — it adds a BOM and rewrites every line ending. Use Edit.
- **Branch and open a PR.** Never push directly to `main`. Branch is `feat/nyc-onboarding`.

## Review Focus

Five failure modes the spec implies that no task's happy path exercises. Each has a test pinned to the task that owns the code.

1. **A future fiscal year's filename constructed by pattern.** FY2025 is `ACFR-2025-7-28-2026.pdf` — a date stamp unrelated to the year. A reader that extends the `ACFR-{YYYY}.pdf` rule to FY2026 either 404s or fetches the wrong document. `nycAcfrFilename(2026)` must **throw**, not guess. → Task 1.
2. **The blank Adjustments cell.** FY2015–FY2018 each print exactly one five-cell row (`Public safety and judicial`) where the Adjustments column is empty rather than dashed. A reader trusting token count drops a whole function from Total Governmental expenditures — 9,129,695 to 10,418,804 thousands. → Task 4.
3. **The budgetary General-Fund page read as the statement.** Pages 85–86 of each modern book are `GENERAL FUND … BUDGET AND ACTUAL`, whose last column is a *variance* (`Better (Worse) Than Modified Budget`). Reading it under a `total_governmental` label would publish variance figures as actuals. → Task 3.
4. **The second scope overwriting the first.** `treasury.budgets` is keyed by the RPC on `(municipality_id, fiscal_year, dataset_type, fund_scope, basis)`. A delete or lookup that omits `fund_scope` makes the `total_governmental` write destroy the `general_fund` row for the same year. → Task 6.
5. **A units error.** `units=1000` is invisible to the tie gate — every figure on the page scales together. Only the per-capita plausibility check can catch it. → Task 6.

---

### Task 1: Per-fiscal-year source map

**Files:**
- Create: `scripts/lib/nycAcfrSources.mjs`
- Test: `tests/nycAcfrSources.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `NYC_FYS: number[]` (2002..2025), `NYC_ACFR_BASE: string`, `nycAcfrFilename(fy: number): string`, `nycAcfrUrl(fy: number): string`. All later tasks resolve URLs through these.

- [ ] **Step 1: Write the failing test**

```js
// tests/nycAcfrSources.test.mjs
import { describe, it, expect } from 'vitest';
import {
  NYC_FYS, NYC_ACFR_BASE, nycAcfrFilename, nycAcfrUrl,
} from '../scripts/lib/nycAcfrSources.mjs';

describe('NYC ACFR source map', () => {
  it('covers FY2002-FY2025 and nothing else', () => {
    expect(NYC_FYS).toHaveLength(24);
    expect(NYC_FYS[0]).toBe(2002);
    expect(NYC_FYS.at(-1)).toBe(2025);
  });

  it('uses lowercase cafr for FY2002-FY2011', () => {
    expect(nycAcfrFilename(2002)).toBe('cafr2002.pdf');
    expect(nycAcfrFilename(2011)).toBe('cafr2011.pdf');
  });

  it('uses uppercase CAFR for FY2012-FY2020', () => {
    expect(nycAcfrFilename(2012)).toBe('CAFR2012.pdf');
    expect(nycAcfrFilename(2020)).toBe('CAFR2020.pdf');
  });

  it('uses ACFR- for FY2021-FY2024', () => {
    expect(nycAcfrFilename(2021)).toBe('ACFR-2021.pdf');
    expect(nycAcfrFilename(2024)).toBe('ACFR-2024.pdf');
  });

  // Review Focus 1.
  it('returns FY2025 from the one-off table, not the ACFR- pattern', () => {
    expect(nycAcfrFilename(2025)).toBe('ACFR-2025-7-28-2026.pdf');
  });

  // Review Focus 1 -- the load-bearing case.
  it('THROWS for a year with no known convention rather than guessing', () => {
    expect(() => nycAcfrFilename(2026)).toThrow(/look it up/i);
    expect(() => nycAcfrFilename(2001)).toThrow(/pre-GASB-34/i);
  });

  it('builds a full URL on the comptroller host', () => {
    expect(nycAcfrUrl(2024)).toBe(`${NYC_ACFR_BASE}ACFR-2024.pdf`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nycAcfrSources.test.mjs`
Expected: FAIL — `Failed to resolve import "../scripts/lib/nycAcfrSources.mjs"`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/nycAcfrSources.mjs
// NO SHEBANG -- a test guards this for everything under scripts/lib/.
/**
 * Per-fiscal-year NYC ACFR locations (NYC Comptroller).
 *
 * All 24 years FY2002-FY2025 were probed on 2026-10-09; every one returned
 * HTTP 200. THREE naming eras, and casing is load-bearing: `cafr2015.pdf`
 * 404s while `CAFR2015.pdf` is 200, and the reverse holds for 2010.
 *
 * ⚠⚠ FY2025 CANNOT BE DERIVED FROM ITS YEAR. It is `ACFR-2025-7-28-2026.pdf`
 * -- a date stamp unrelated to the fiscal year. Any future year must be LOOKED
 * UP and added to ONE_OFFS or the era table, never constructed. A loader that
 * extends the `ACFR-{YYYY}` rule to FY2026 will 404, or worse, silently fetch
 * a document for the wrong period.
 */

export const NYC_ACFR_BASE = 'https://comptroller.nyc.gov/wp-content/uploads/documents/';

/** FY2002..FY2025. FY2001 is deliberately absent -- see `nycAcfrFilename`. */
export const NYC_FYS = Array.from({ length: 24 }, (_, i) => 2002 + i);

/** Years whose filename follows no pattern. Verified individually. */
const ONE_OFFS = new Map([
  [2025, 'ACFR-2025-7-28-2026.pdf'],
]);

export function nycAcfrFilename(fy) {
  if (!Number.isInteger(fy)) {
    throw new TypeError(`fiscal year must be an integer, got ${JSON.stringify(fy)}`);
  }
  const oneOff = ONE_OFFS.get(fy);
  if (oneOff) return oneOff;
  if (fy === 2001) {
    throw new RangeError(
      'FY2001 is out of window: its book is pre-GASB-34 and its General Fund '
      + 'expenditures miss the printed total by -7,348,865 (thousands). Its '
      + 'figures are readable from the FY2002 book but are RESTATED and '
      + 'disagree with what FY2001 itself printed. See spec section 3.1.');
  }
  if (fy >= 2021 && fy <= 2024) return `ACFR-${fy}.pdf`;
  if (fy >= 2012 && fy <= 2020) return `CAFR${fy}.pdf`;
  if (fy >= 2002 && fy <= 2011) return `cafr${fy}.pdf`;
  throw new RangeError(
    `No known NYC ACFR filename convention for FY${fy}. Do not guess -- look it `
    + 'up on comptroller.nyc.gov and add it to ONE_OFFS or extend the era table. '
    + 'FY2025 is proof the pattern is not safe to extrapolate.');
}

export function nycAcfrUrl(fy) {
  return `${NYC_ACFR_BASE}${nycAcfrFilename(fy)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nycAcfrSources.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nycAcfrSources.mjs tests/nycAcfrSources.test.mjs
git commit -m "feat(nyc): per-FY ACFR source map, refusing to guess a filename"
```

---

### Task 2: Fetch the 24 ACFRs

**Files:**
- Create: `scripts/fetchNYC.mjs`

**Interfaces:**
- Consumes: `NYC_FYS`, `nycAcfrUrl` from Task 1.
- Produces: files at `docs/NYC/nyc-{fy}-acfr.pdf`. Task 3 onward read this directory. Filename shape must match `filePattern` in Task 6.

- [ ] **Step 1: Write the fetcher**

```js
#!/usr/bin/env node
/**
 * Fetch every in-window NYC ACFR to docs/NYC/.
 *
 * First-party only -- every byte comes from comptroller.nyc.gov. Skips a file
 * that already exists so re-runs are cheap. `docs/*` is gitignored, so nothing
 * here is committed.
 *
 * Usage:
 *   node scripts/fetchNYC.mjs
 *   node scripts/fetchNYC.mjs --fy 2024
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { NYC_FYS, nycAcfrUrl } from './lib/nycAcfrSources.mjs';

const DIR = 'docs/NYC';
const arg = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
const only = arg('--fy');
const fys = only ? [Number(only)] : NYC_FYS;

await mkdir(DIR, { recursive: true });

let fetched = 0;
let skipped = 0;
for (const fy of fys) {
  const dest = `${DIR}/nyc-${fy}-acfr.pdf`;
  try {
    await access(dest);
    skipped += 1;
    continue;
  } catch { /* not present -- fetch it */ }

  const url = nycAcfrUrl(fy);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FY${fy}: HTTP ${res.status} for ${url}`);
    process.exit(2);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  // A WAF error page is ~91KB of HTML and returns 200 on some hosts. An ACFR
  // is never under 500KB; refuse anything that small rather than extract it.
  if (buf.length < 500_000 || buf.subarray(0, 5).toString() !== '%PDF-') {
    console.error(`FY${fy}: not a PDF (${buf.length} bytes) from ${url}`);
    process.exit(2);
  }
  await writeFile(dest, buf);
  console.log(`FY${fy}: ${(buf.length / 1e6).toFixed(1)} MB -> ${dest}`);
  fetched += 1;
}
console.log(`\n${fetched} fetched, ${skipped} already present.`);
```

- [ ] **Step 2: Run it**

Run: `node scripts/fetchNYC.mjs`
Expected: 24 files under `docs/NYC/`, none rejected. Total ~230 MB.

- [ ] **Step 3: Verify the guard works**

Run: `node scripts/fetchNYC.mjs --fy 2026`
Expected: exits non-zero with the "look it up" message from Task 1, **before** any network call.

- [ ] **Step 4: Commit**

```bash
git add scripts/fetchNYC.mjs
git commit -m "feat(nyc): first-party ACFR fetcher with a PDF-shape guard"
```

---

### Task 3: The extractor wrapper — General Fund

**Files:**
- Create: `scripts/extractNYC.py`

**Interfaces:**
- Consumes: `scripts/lib/acfrGF.py` `CityConfig` / `run_cli`.
- Produces: a CLI emitting the standard extractor JSON (`fiscal_year`, `mode`, `tree`, `computed_total`, `printed_total`, `tie_delta`, `zero_rows`). Invoked as
  `py -3 scripts/extractNYC.py <pdf> --mode {revenue|operating}`.
  Task 6 shells out to exactly this.

- [ ] **Step 1: Write the wrapper**

```python
#!/usr/bin/env python3
"""
City of New York ACFR — General Fund extractor (GAAP actuals).

Thin per-entity wrapper over `scripts/lib/acfrGF.py`.

  --mode revenue    flat GF revenue-by-source tree
  --mode operating  GF expenditure-by-function tree, one parent (Debt Service)

NYC specifics
-------------
* **Fiscal year ends June 30.**
* **Units = 1000** — the caption reads `(in thousands)`. ⚠ A units error is
  INVISIBLE to the tie gate; every figure on the page scales together. The
  caption was read on this document, not carried from another entity.

* ⚠⚠ **`exclude_ignore=('reconciliation', 'net position')` IS REQUIRED.**
  NYC prints the government-wide reconciliation note at the FOOT of the genuine
  primary statement:

      "The reconciliation of the net change in fund balances of governmental
       funds to the change in net position of governmental activities in the
       Statement of Net Position is presented in an accompanying schedule."

  That one sentence puts BOTH `reconciliation` and `net position` — two
  `_EXCLUDE` terms — on the right page. With the default list EVERY year in the
  window reports "primary GF statement not found" and NYC gets no series at
  all. Same case as Buncombe County; see `scripts/extractBuncombeCounty.py`.

* ⚠⚠ **THE ANCHOR MUST REQUIRE "GOVERNMENTAL FUNDS", AND ITS ORDER IS THE
  REVERSE OF MARION COUNTY'S.** Pages 85-86 of each modern book are:

      THE CITY OF NEW YORK
      GENERAL FUND
      STATEMENT OF REVENUES, EXPENDITURES,
      AND CHANGES IN FUND BALANCE
      BUDGET AND ACTUAL

  `_EXCLUDE` catches that page on 'budget and actual', and this wrapper does
  NOT ignore that term — so the page is already excluded. The anchor is defence
  in depth, because that page's LAST column is `Better (Worse) Than Modified
  Budget`: a VARIANCE column. Were it ever to qualify, `target_column='last'`
  would publish variance figures as audited actuals.

  ⚠ NYC prints `GOVERNMENTAL FUNDS` BEFORE the statement title, where Marion
  County prints it after. The anchor is NOT copyable from
  `extractMarionCountyIN.py` — the two halves are in the opposite order.

* **Revenue is flat.** Eleven peers (real estate taxes, sales and use taxes,
  personal income tax, other income taxes, other taxes, Federal/State and other
  categorical aid, unrestricted Federal and State aid, charges for services,
  tobacco settlement, investment income, other revenues) with no group heading.
  Read off the printed statement, so `revenue_parents` stays empty.

* **Expenditures carry exactly one parent: `Debt Service:`**, whose children are
  Interest, Redemptions and a third line that is `Rental payments` in the modern
  books and `Lease payments` in the FY2015 era. Both sit in the same slot under
  the same parent, so the label change needs no config. Every other function
  (General government ... Administrative and other) is a root-level leaf.

Usage:
  py -3 scripts/extractNYC.py "docs/NYC/nyc-2024-acfr.pdf" --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

# ⚠ "Governmental Funds" FIRST, then the title -- the reverse of Marion County.
STATEMENT_ANCHOR = (
    r'Governmental\s+Funds[\s\S]{0,200}?'
    r'Statement\s+of\s+Revenues,?\s+Expenditures,?\s+and\s+Changes\s+in\s+Fund'
    r'\s+Balances'
)

CONFIG = CityConfig(
    city='New York City',
    parents=('debt service',),
    root_leaves=(),
    fy_end=('June', 30),
    units=1000,
    statement_anchor=STATEMENT_ANCHOR,
    exclude_ignore=('reconciliation', 'net position'),
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

- [ ] **Step 2: Run it against the newest year**

Run: `py -3 scripts/extractNYC.py "docs/NYC/nyc-2024-acfr.pdf" --mode revenue`
Expected: JSON with `"tie_delta": 0` and `printed_total` 112387407000 (112,387,407 thousands × 1000).

- [ ] **Step 3: Run the operating mode**

Run: `py -3 scripts/extractNYC.py "docs/NYC/nyc-2024-acfr.pdf" --mode operating`
Expected: `"tie_delta": 0`, `printed_total` 105270980000.

- [ ] **Step 4: Prove the anchor rejects the budgetary page**

Confirm the chosen page is the Governmental Funds statement, not pages 85-86. The emitted tree must contain `Real estate taxes` at root and must NOT contain any column named or valued from `Better (Worse)`. Spot-check `Real estate taxes` = 32987024000.

- [ ] **Step 5: Confirm the shared selftests still pass**

Run: `npm run test:acfr`
Expected: PASS — 183 `acfrGF` + 39 `acfrGfCoords`. This task adds a wrapper and changes no library, so the count must not move.

- [ ] **Step 6: Commit**

```bash
git add scripts/extractNYC.py
git commit -m "feat(nyc): GF extractor wrapper; anchor demands Governmental Funds"
```

---

### Task 4: Resolve the open question — `target_column='last'`

This is spec §5.3, and it is the one thing the design deliberately did not assume. **Do not proceed to Task 5 until it is answered.**

**Files:**
- Create: `scripts/probeNycTotalColumn.mjs`
- Modify: `scripts/extractNYC.py` (add the total-governmental config)

**Interfaces:**
- Consumes: `scripts/extractNYC.py` from Task 3.
- Produces: `scripts/extractNYC.py` accepting `--scope {general|total}`, defaulting to `general`. Task 6 passes `--scope` explicitly for both series.

- [ ] **Step 1: Add the second scope to the wrapper**

Add to `scripts/extractNYC.py`, after `CONFIG`:

```python
# The SAME statement, read on its last column (Total Governmental Funds). The
# scope label is derived by the library from `target_column`, so this config
# cannot claim a scope it does not read.
CONFIG_TOTAL = CityConfig(
    city='New York City',
    parents=('debt service',),
    root_leaves=(),
    fy_end=('June', 30),
    units=1000,
    statement_anchor=STATEMENT_ANCHOR,
    exclude_ignore=('reconciliation', 'net position'),
    target_column='last',
)

if __name__ == '__main__':
    # ⚠ Parsed before `run_cli`, which owns every other flag.
    scope = 'general'
    if '--scope' in sys.argv:
        i = sys.argv.index('--scope')
        scope = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    if scope not in ('general', 'total'):
        raise SystemExit(f"--scope must be 'general' or 'total', got {scope!r}")
    run_cli(CONFIG_TOTAL if scope == 'total' else CONFIG)
```

Replace the existing `if __name__ == '__main__':` block with the above.

- [ ] **Step 2: Write the probe**

```js
#!/usr/bin/env node
/**
 * Does `acfrGF.py`'s own `target_column='last'` reproduce a $0 tie on NYC?
 *
 * Spec section 5.3 left this open on purpose. The 2026-10-09 spike proved the
 * SOURCE ties, but it did so with a throwaway reader that took the right-most
 * token on each row. `acfrGF.py` resolves 'last' differently -- its `ordinal`
 * strategy counts dash-runs and its `positional` strategy cannot anchor an
 * all-dash column -- so the spike's result does NOT transfer by assumption.
 *
 * ⚠⚠ THE HARD CASE IS FY2015-FY2018. Each prints exactly ONE five-cell row,
 * always `Public safety and judicial`, where the Adjustments/Eliminations cell
 * is EMPTY rather than dashed. A reader that trusts token count drops it:
 *
 *     FY2015  9,129,695   FY2017  10,058,916
 *     FY2016  9,652,787   FY2018  10,418,804   (thousands)
 *
 * Exit 0 = `-table` reproduces and NYC stays on the shared reader.
 * Exit 3 = a DIAGNOSED mechanical failure; move the entity to the coordinate
 *          reader per Task 7, for a reason written into the wrapper.
 */
import { spawnSync } from 'node:child_process';
import { resolvePython } from './lib/pythonBin.mjs';
import { NYC_FYS } from './lib/nycAcfrSources.mjs';

const python = resolvePython();
const failures = [];

for (const fy of NYC_FYS) {
  for (const mode of ['revenue', 'operating']) {
    const r = spawnSync(python, [
      'scripts/extractNYC.py', `docs/NYC/nyc-${fy}-acfr.pdf`,
      '--mode', mode, '--scope', 'total',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    if (r.status !== 0) {
      failures.push(`FY${fy} ${mode}: extractor exit ${r.status} ${r.stderr?.slice(0, 200)}`);
      continue;
    }
    let d;
    try { d = JSON.parse(r.stdout); } catch {
      failures.push(`FY${fy} ${mode}: unparseable output`);
      continue;
    }
    if (d.tie_delta !== 0) {
      failures.push(`FY${fy} ${mode}: tie_delta ${d.tie_delta} `
        + `(computed ${d.computed_total} vs printed ${d.printed_total})`);
    } else {
      console.log(`FY${fy} ${mode}: tie $0  printed=${d.printed_total}`);
    }
  }
}

if (failures.length) {
  console.error(`\n${failures.length} of 48 checks FAILED:`);
  for (const f of failures) console.error('  ' + f);
  console.error('\n-table does not reproduce on this entity. See Task 7.');
  process.exit(3);
}
console.log('\n48/48 total-governmental checks tie at $0. -table reproduces.');
```

- [ ] **Step 3: Run the probe**

Run: `node scripts/probeNycTotalColumn.mjs`
Expected: one of two outcomes, both of which are answers:
- **Exit 0** — 48/48 tie. NYC stays on `-table`. Proceed to Task 5.
- **Exit 3** — record which years failed in the wrapper docstring as the diagnosed reason, then implement Task 7's coordinate reader as the *primary* reader and re-run this probe against it.

⚠⚠ **Do not choose per year whichever reader tied.** That is curve-fitting — the error that got the LA-01 scope verdict retracted. The choice is per ENTITY, with the reason written down.

- [ ] **Step 4: Verify the General Fund scope is unaffected**

Run: `py -3 scripts/extractNYC.py "docs/NYC/nyc-2015-acfr.pdf" --mode operating --scope general`
Expected: `"tie_delta": 0`, `printed_total` 70196875000. The blank cell is in the Adjustments column; the General Fund is column 0 and is never the blank one.

- [ ] **Step 5: Commit**

```bash
git add scripts/extractNYC.py scripts/probeNycTotalColumn.mjs
git commit -m "feat(nyc): total-governmental scope + the probe that proves it ties"
```

---

### Task 5: Seed the entity

**Files:**
- Create: `scripts/seedNewYorkCity.mjs`
- Test: `tests/nycEntityShape.test.mjs`

**Interfaces:**
- Consumes: `scripts/lib/ensureMunicipality.mjs`.
- Produces: exported `NYC_ENTITY` object `{ name, entityType, state, geoid, countyId }` consumed by Task 6's loader, and one row in `treasury.municipalities`.

- [ ] **Step 1: Write the failing test**

```js
// tests/nycEntityShape.test.mjs
import { describe, it, expect } from 'vitest';
import { NYC_ENTITY } from '../scripts/seedNewYorkCity.mjs';

describe('NYC entity shape', () => {
  it('is named New York City, never bare New York', () => {
    // A bare "New York" collides with the state node in every name-keyed
    // lookup and in ?entity= alias resolution.
    expect(NYC_ENTITY.name).toBe('New York City');
    expect(NYC_ENTITY.name).not.toBe('New York');
  });

  it('is a city with no county parent, so it renders beside the state', () => {
    // NYC is LARGER than the five counties inside it. TT orders large to
    // small, so the city occupies the tier a county normally would.
    expect(NYC_ENTITY.entityType).toBe('city');
    expect(NYC_ENTITY.countyId).toBeNull();
  });

  it('carries the FIPS place geoid', () => {
    expect(NYC_ENTITY.state).toBe('NY');
    expect(NYC_ENTITY.geoid).toBe('3651000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nycEntityShape.test.mjs`
Expected: FAIL — cannot resolve `../scripts/seedNewYorkCity.mjs`

- [ ] **Step 3: Write the seeder**

```js
#!/usr/bin/env node
/**
 * Seed the City of New York -- TT's first New York local government.
 *
 * ⚠ `county_id` IS NULL BY DESIGN. NYC is larger than every one of the five
 * counties inside it. TT's navigation orders large to small, so the city sits
 * directly beneath the New York STATE node, in the tier a county would
 * normally occupy. If the boroughs are ever loaded they nest UNDER this row.
 * 322 existing cities already carry a NULL county_id, so this needs no schema
 * change.
 *
 * ⚠ The name is `New York City`. The bare string `New York` is the state node
 * (1a7f871c-7f2e-4786-9c55-5ab3409716f4).
 *
 * Usage:
 *   node --env-file=.env scripts/seedNewYorkCity.mjs --dry-run
 *   node --env-file=.env scripts/seedNewYorkCity.mjs
 */
import { ensureMunicipality } from './lib/ensureMunicipality.mjs';

export const NYC_ENTITY = {
  name: 'New York City',
  entityType: 'city',
  state: 'NY',
  geoid: '3651000',   // FIPS place
  countyId: null,
};

if (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, '/')}`) {
  const dryRun = process.argv.includes('--dry-run');
  const id = await ensureMunicipality({ ...NYC_ENTITY, dryRun });
  console.log(`${dryRun ? '[dry-run] ' : ''}New York City -> ${id}`);
}
```

⚠ Before writing, open `scripts/lib/ensureMunicipality.mjs` and match its **actual** exported signature and parameter names. If it does not accept `countyId` or `geoid`, set those with a follow-up update in this same script rather than inventing an interface.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nycEntityShape.test.mjs`
Expected: PASS, 3 tests

- [ ] **Step 5: Dry-run against the database**

Run: `node --env-file=.env scripts/seedNewYorkCity.mjs --dry-run`
Expected: reports the row it would create; writes nothing.

- [ ] **Step 6: Commit**

```bash
git add scripts/seedNewYorkCity.mjs tests/nycEntityShape.test.mjs
git commit -m "feat(nyc): seed New York City beside the state node"
```

---

### Task 6: The two-scope loader

⚠⚠ **`scripts/lib/acfrGfLoad.mjs` CANNOT be used for this entity.** Two reasons, both verified on 2026-10-09:
1. Its delete and its `treasury_sync_budget_tree` call key on `(municipality_id, fiscal_year, dataset_type)` with **no `fund_scope`**, so the `total_governmental` write would delete the `general_fund` row for the same year.
2. Its `dataSourceLabel()` hardcodes the words `General Fund` into the provenance string, which would be a lie on half of NYC's rows.

The correct model is `scripts/loadInCountyAcfrs.mjs`, which is scope-aware and already passes `p_fund_scope` / `p_basis`.

**Files:**
- Create: `scripts/loadNYCAcfrs.mjs`
- Test: `tests/nycLoaderLabels.test.mjs`

**Interfaces:**
- Consumes: `NYC_FYS` (Task 1), `scripts/extractNYC.py` (Tasks 3-4), `NYC_ENTITY` (Task 5).
- Produces: exported `FUND_SCOPES`, `sourceNameFor(datasetType, fiscalYear, fundScope)`, `sourcePrefixFor(fundScope)`, and 96 rows in `treasury.budgets`.

- [ ] **Step 1: Write the failing test**

```js
// tests/nycLoaderLabels.test.mjs
import { describe, it, expect } from 'vitest';
import { FUND_SCOPES, sourceNameFor, sourcePrefixFor } from '../scripts/loadNYCAcfrs.mjs';

describe('NYC loader provenance labels', () => {
  it('loads exactly the two scopes', () => {
    expect(FUND_SCOPES).toEqual(['general_fund', 'total_governmental']);
  });

  // Review Focus 4 -- the label must state the scope it actually read.
  it('names the General Fund scope honestly', () => {
    expect(sourceNameFor('revenue', 2024, 'general_fund'))
      .toBe('New York City ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)');
  });

  it('names the Total Governmental scope honestly', () => {
    expect(sourceNameFor('operating', 2015, 'total_governmental'))
      .toBe('New York City ACFR — Total Governmental Funds Expenditure by Function (FY2015 actual, GAAP basis)');
  });

  it('gives each scope a DISTINCT prefix, so the guard cannot confuse them', () => {
    expect(sourcePrefixFor('general_fund')).not.toBe(sourcePrefixFor('total_governmental'));
    expect(sourceNameFor('revenue', 2024, 'general_fund'))
      .toMatch(new RegExp(`^${sourcePrefixFor('general_fund')}`));
  });

  it('refuses an unknown scope rather than mislabelling', () => {
    expect(() => sourceNameFor('revenue', 2024, 'all_funds')).toThrow(/unknown fund scope/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nycLoaderLabels.test.mjs`
Expected: FAIL — cannot resolve `../scripts/loadNYCAcfrs.mjs`

- [ ] **Step 3: Write the label helpers and the loader**

```js
#!/usr/bin/env node
/**
 * New York City ACFR -> treasury.budgets. FY2002-FY2025, TWO fund scopes.
 *
 * ⚠⚠ NOT built on scripts/lib/acfrGfLoad.mjs. That loader keys its delete and
 * its RPC on (municipality_id, fiscal_year, dataset_type) with NO fund_scope,
 * so the second scope would DESTROY the first; and its dataSourceLabel()
 * hardcodes "General Fund", which would be false on half these rows. The model
 * here is scripts/loadInCountyAcfrs.mjs, which is scope-aware.
 *
 * Usage:
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs --dry-run
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs --fy 2024
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolvePython } from './lib/pythonBin.mjs';
import { NYC_FYS, nycAcfrUrl } from './lib/nycAcfrSources.mjs';

export const FUND_SCOPES = ['general_fund', 'total_governmental'];
export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
export const FISCAL_YEAR_START_MONTH = 7;   // July 1 - June 30
export const UNITS_NOTE = 'thousands';

const SCOPE_FACE = new Map([
  ['general_fund', 'General Fund'],
  ['total_governmental', 'Total Governmental Funds'],
]);

/** The extractor CLI value for a fund scope. */
export function scopeFlag(fundScope) {
  if (fundScope === 'general_fund') return 'general';
  if (fundScope === 'total_governmental') return 'total';
  throw new Error(`unknown fund scope: ${fundScope}`);
}

export function sourcePrefixFor(fundScope) {
  const face = SCOPE_FACE.get(fundScope);
  if (!face) throw new Error(`unknown fund scope: ${fundScope}`);
  return `New York City ACFR — ${face}`;
}

export function sourceNameFor(datasetType, fiscalYear, fundScope) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${sourcePrefixFor(fundScope)} ${face} (FY${fiscalYear} actual, GAAP basis)`;
}
```

⚠ `toRpcTree` is **module-private** in `loadInCountyAcfrs.mjs` — it is not
exported, so it cannot be imported. Define a local copy:

```js
/** The `{n,a,c}` shape the RPC expects, from the extractor's own tree. */
function toRpcTree(tree) {
  const node = (r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map(node) }
    : { n: r.n, a: r.a });
  return (tree.c || []).map(node);
}
```

Then the write path. Model it line-for-line on `scripts/loadInCountyAcfrs.mjs` lines 318-380, with these differences:

```js
      // ⚠⚠ `.eq('fund_scope', fundScope)` IS LOAD-BEARING. NYC publishes TWO
      // scopes for the same (municipality, fiscal_year, dataset_type). Omit it
      // and the total_governmental pass finds the general_fund row, decides a
      // different publisher owns it, and either skips or overwrites -- either
      // way one of the two series is lost.
      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', fy)
        .eq('dataset_type', datasetType)
        .eq('fund_scope', fundScope)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').startsWith(sourcePrefixFor(fundScope))) {
        console.log(`  SKIP FY${fy} ${datasetType} ${fundScope} — "${existing[0].data_source}" preserved`);
        conflicts += 1;
        continue;
      }

      const { data, error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: fy,
        p_dataset_type: datasetType,
        p_total: built.tree.a,
        p_tree: toRpcTree(built.tree),
        p_row_count: toRpcTree(built.tree).length,
        p_data_source_name: sourceNameFor(datasetType, fy, fundScope),
        p_source_url: nycAcfrUrl(fy),          // the EXACT filing, not a landing page
        p_source_date: `${fy}-06-30`,          // FYE June 30
        p_fiscal_year_start_month: FISCAL_YEAR_START_MONTH,
        // ⚠⚠ LOAD-BEARING. The RPC keys on these; omit them and both default to
        // 'unknown', so a re-run matches nothing, takes the INSERT branch, and
        // silently duplicates every row.
        p_fund_scope: fundScope,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as an error.
      if (error) throw new Error(`RPC transport error (FY${fy} ${datasetType} ${fundScope}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (FY${fy} ${datasetType} ${fundScope}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success (FY${fy} ${datasetType} ${fundScope}): ${JSON.stringify(data)}`);
      }
```

- [ ] **Step 4: Add the tie gate that refuses to write**

Before any RPC call, for every (fy, mode, scope):

```js
  const r = spawnSync(resolvePython(), [
    'scripts/extractNYC.py', `docs/NYC/nyc-${fy}-acfr.pdf`,
    '--mode', mode, '--scope', scopeFlag(fundScope),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`FY${fy} ${mode} ${fundScope}: extractor exit ${r.status}`);
    process.exit(2);
  }
  const d = JSON.parse(r.stdout);
  if (d.tie_delta !== 0) {
    console.error(`FY${fy} ${mode} ${fundScope}: TIE FAILED, delta ${d.tie_delta}. Refusing to write.`);
    process.exit(2);
  }
```

- [ ] **Step 5: Add the per-capita plausibility guard (Review Focus 5)**

```js
// ⚠ The ONLY check that can catch a wrong `units`. A units error ties at $0
// because every figure on the page scales together. NYC's population is
// ~8.26M; FY2024 General Fund spending of $105.27B is ~$12,750/capita. A
// factor-of-1000 error lands at $12.75 or $12.75M per capita -- both absurd.
const perCapita = totalDollars / population;
if (perCapita < 500 || perCapita > 60_000) {
  console.error(`FY${fy} ${mode} ${fundScope}: $${perCapita.toFixed(0)}/capita is outside `
    + 'the plausible band. This is what a wrong `units` looks like. Refusing to write.');
  process.exit(2);
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/nycLoaderLabels.test.mjs`
Expected: PASS, 5 tests

- [ ] **Step 7: Dry-run the full window**

Run: `node --env-file=.env scripts/loadNYCAcfrs.mjs --dry-run`
Expected: 96 rows reported, 96 ties at $0, 0 writes.

- [ ] **Step 8: Commit**

```bash
git add scripts/loadNYCAcfrs.mjs tests/nycLoaderLabels.test.mjs
git commit -m "feat(nyc): scope-aware two-series loader with tie and units gates"
```

---

### Task 7: Independent corroboration

The library's own docstring requires it: `exclude_ignore` **widens** which pages can qualify, so it "must be paired with evidence that the page chosen is the RIGHT one." This is the Buncombe / `verify-nc.mjs` pattern.

**Files:**
- Create: `scripts/extractNYCCoords.py`
- Create: `scripts/verify-nyc.mjs`

**Interfaces:**
- Consumes: `scripts/lib/acfrGfCoords.py` `CoordsConfig`, `NYC_FYS`.
- Produces: a verifier exiting non-zero on any disagreement.

⚠⚠ **`scripts/lib/acfrGfCoords.py` IS GENERAL-FUND-ONLY.** Its `CoordsConfig`
accepts no `target_column` — verified 2026-10-09, the string does not occur in
the file. So the coordinate reader **cannot corroborate the
`total_governmental` scope**, and this plan does not pretend otherwise.

Coverage is therefore split, and both halves are genuinely independent:

| Scope | CHECK 1 (coordinates) | CHECK 2 (cross-book) |
|---|---|---|
| `general_fund` | ✅ all 24 years | ✅ 23 overlapping pairs |
| `total_governmental` | ❌ not supported | ✅ 23 overlapping pairs |

Cross-book agreement is a real second source for the total column: a different
document, typeset in a different year, read independently. It is weaker than a
second *reader* but it is not nothing, and combined with the tie gate it is the
same standard several loaded entities already meet. **Do not add
`target_column` to `acfrGfCoords.py` as part of this work** — that is library
surgery the spec put out of scope, and it would need its own corpus diff
against the eight entities already on that reader.

- [ ] **Step 1: Write the coordinate wrapper (General Fund scope)**

```python
#!/usr/bin/env python3
"""
City of New York ACFR — INDEPENDENT coordinate re-derivation (General Fund).

Corroboration only. `scripts/extractNYC.py` is the loader's reader; this one
exists so that `exclude_ignore` -- which WIDENS which pages can qualify -- is
paired with evidence that the page chosen is the right one. It finds its own
page and reads pdfplumber glyph x-coordinates, sharing no code and no strategy
with the `pdftotext -table` character grid.

⚠ GENERAL FUND ONLY. `CoordsConfig` has no `target_column`, so the
total-governmental series is corroborated by cross-book agreement instead --
see `scripts/verify-nyc.mjs` CHECK 2.

Usage:
  py -3 scripts/extractNYCCoords.py "docs/NYC/nyc-2024-acfr.pdf" --mode revenue
"""

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGfCoords import CoordsConfig, run_cli   # noqa: E402

CONFIG = CoordsConfig(
    city='New York City',
    units=1000,                                        # "(in thousands)"
    exclude_ignore=('reconciliation', 'net position'),  # same reason as the -table wrapper
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

⚠ Confirm `run_cli` is the actual exported entry point of `acfrGfCoords.py`
before writing — match its real name and signature rather than assuming it
mirrors `acfrGF.py`.

- [ ] **Step 2: Write the verifier with four checks**

```js
#!/usr/bin/env node
/**
 * Independent verification of the NYC series. Four checks, all must pass.
 *
 * CHECK 1  Coordinate re-derivation, GENERAL FUND ONLY (CoordsConfig has no
 *          target_column). Every (fy, mode) is re-read by
 *          scripts/extractNYCCoords.py, which finds its own page. Any
 *          disagreement with the -table reader is a failure -- including a
 *          disagreement about WHICH PAGE, which is the whole point of the
 *          check given exclude_ignore widens the candidate set.
 *
 * CHECK 2  Cross-book agreement. Every NYC ACFR prints the current year AND
 *          the prior year. FY(n) read from book n must equal FY(n) read from
 *          book n+1, for all 23 overlapping pairs, in both modes and BOTH
 *          scopes. This is the ONLY independent corroboration the
 *          total_governmental series gets, so it is not optional.
 *
 * CHECK 3  Audit opinion. Every book in the window must carry an UNMODIFIED
 *          opinion. ⚠⚠ The gate must not match `qualified` INSIDE
 *          `unqualified` -- that has shipped before. Match on the opinion
 *          paragraph ("present fairly, in all material respects") and assert
 *          the ABSENCE of a modified-opinion phrase, rather than substring
 *          matching a word that contains its own negation.
 *          ⚠ FY2018's opinion page has an interleaved text layer
 *          (`deritaollrys,atchceepfitnedanicniathl...`). The statement pages
 *          are clean; this page is not. Expect to special-case FY2018 with a
 *          recorded reason, not to loosen the gate for every year.
 *
 * CHECK 4  Database parity. Every loaded row's total equals the extractor's
 *          printed total x 1000, with the right fund_scope, basis,
 *          fiscal_year_start_month and source_url.
 */
```

⚠ CHECK 3 exists because spec §6.2 grades every NYC row as audited GAAP. A
grade nothing verifies is a claim, not a grade. Model the opinion reader on
`scripts/verifyInCountyOpinions.py`.

⚠ CHECK 2 is NYC-specific and valuable: it is a free second document for 23 of the 24 years. Expect FY2001-style restatements to be absent inside the window, but if any pair disagrees, **do not average or pick one** — stop and report, exactly as the FY2001 restatement decided the window floor.

- [ ] **Step 3: Run the verifier**

Run: `node --env-file=.env scripts/verify-nyc.mjs`
Expected: all four checks pass; non-zero exit on any disagreement.

CHECK 1 runs 48 comparisons (24 years x 2 modes, General Fund only).
CHECK 2 runs 92 comparisons (23 pairs x 2 modes x 2 scopes).
CHECK 3 runs 24 opinion reads. CHECK 4 runs 96 row comparisons.

- [ ] **Step 4: Commit**

```bash
git add scripts/extractNYCCoords.py scripts/verify-nyc.mjs
git commit -m "feat(nyc): coordinate + cross-book corroboration for all 24 years"
```

---

### Task 8: Live load, verification, and PR

**Files:**
- Modify: `.planning/ROADMAP.md`, `.planning/MILESTONES.md`

- [ ] **Step 1: Seed the entity for real**

Run: `node --env-file=.env scripts/seedNewYorkCity.mjs`
Expected: one new row; record its UUID.

- [ ] **Step 2: Load one year as a checkpoint**

Run: `node --env-file=.env scripts/loadNYCAcfrs.mjs --fy 2024`
Expected: 4 rows (2 datasets × 2 scopes). **Stop and eyeball them** before loading the rest — this is the first production write for a new state cohort.

- [ ] **Step 3: Load the full window**

Run: `node --env-file=.env scripts/loadNYCAcfrs.mjs`
Expected: 96 rows total.

- [ ] **Step 4: Confirm the row shape in the database**

```sql
select fund_scope, dataset_type, count(*) as rows,
       min(fiscal_year) as min_fy, max(fiscal_year) as max_fy,
       count(*) filter (where fiscal_year_start_month <> 7) as wrong_fysm,
       count(*) filter (where source_url is null) as unsourced,
       count(distinct basis) as bases
from treasury.budgets
where municipality_id = '<uuid from step 1>'
group by 1, 2 order by 1, 2;
```

Expected: four groups of 24, `min_fy`=2002, `max_fy`=2025, `wrong_fysm`=0, `unsourced`=0, `bases`=1.

- [ ] **Step 5: Prove idempotence**

Run: `node --env-file=.env scripts/loadNYCAcfrs.mjs` a second time, then re-run the query from Step 4.
Expected: still exactly 96 rows. Any increase means `p_fund_scope` / `p_basis` were dropped somewhere and the RPC took the INSERT branch.

- [ ] **Step 6: Run the full suite**

Run: `npm test && npm run test:acfr`
Expected: PASS. ⚠ `npm run lint` has never exited 0 in this repo — it is a broken gate, not a signal.

- [ ] **Step 7: Live UAT**

Open the NYC city page. Confirm: it renders beside the New York state node (not under a county); both fund-scope series are selectable; the icicle drills; the source chip shows the ACFR URL and an `as of` date; per-capita figures are plausible (~$12,750/capita GF spending FY2024).

- [ ] **Step 8: Update planning docs and open the PR**

```bash
git add -f .planning/ROADMAP.md .planning/MILESTONES.md
git commit -m "docs(planning): record the NYC onboarding milestone"
git push -u origin feat/nyc-onboarding
gh pr create --title "feat(nyc): New York City onboarding — ACFR, two scopes, FY2002–FY2025"
```

⚠ Never push directly to `main`.
