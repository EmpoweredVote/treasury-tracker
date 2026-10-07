# Redmond, WA Onboarding — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish 11 fiscal years (22 rows) of City of Redmond, WA General Fund operating and revenue figures, sourced from WA State Auditor bound financial statements, every row tying at exactly $0.

**Architecture:** Redmond joins the existing WA SAO pipeline as a ninth entity. No new subsystem and no schema change. A per-entity `CityConfig` drives the shared `scripts/lib/acfrGF.py` extractor; a thin `processRedmond.js` driver over `scripts/lib/waSaoLoad.mjs` writes trees through the source-safe `treasury_sync_budget_tree` RPC; three existing harnesses (re-derive, audit, tether) gain Redmond coverage automatically once it is in the roster.

**Tech Stack:** Node 24 (ESM, `.mjs`), Python 3.14 via `scripts/lib/pythonBin.mjs`, poppler (`pdftotext -table` / `-lineprinter`, `pdfinfo`, `pdfimages`), vitest, Supabase RPC.

**Spec:** `docs/superpowers/specs/2026-10-06-redmond-duvall-accounting-basis-design.md` (§1.1 phasing, §2 Redmond, §5 verification, §6 ARNs)

---

## Global Constraints

- **MCAG `0425`, a STRING.** Leading zeros are significant. A numeric literal silently makes it 425 — a different government, loading in a perfectly self-consistent way that every arithmetic gate passes.
- **Window: FY2011–FY2024, less FY2017/FY2018/FY2019 = 11 years, 22 rows.** Settled in spec §2.1.1. Do not extend it.
- **FY2004–FY2010 are excluded by POLICY and five of them are perfectly readable.** Any step that loads one is a defect, not a bonus.
- **Amounts are WHOLE DOLLARS — `units=1`.** Tacoma and Bellevue are the thousands issuers in this cohort; never carry their setting here.
- **Fiscal year ends December 31** — `fy_end=('December', 31)`.
- **The tie gate is `$0` and is never widened.** A tolerance would let a genuine one-digit mis-parse through. A confirmed printed-total artifact is registered as an EXACT delta in `source_rounding`, adjudicated by rendering the page (`pdftoppm -r 160`), never by reading the text layer.
- **A tie proves ARITHMETIC ONLY** — not labels, not nesting, not units.
- **NO SHEBANG on anything under `scripts/lib/`.** A `#!` plus CRLF breaks the whole vitest suite with a `SyntaxError` naming no file. Entry-point scripts in `scripts/` keep theirs.
- **`py` and `python` on PATH are Microsoft Store stubs.** Use `resolvePython()` from `scripts/lib/pythonBin.mjs`.
- **`docs/*` is gitignored** — force-add plans, specs and PDFs with `git add -f`.
- **Never bulk-edit a source file with PowerShell + `Set-Content -Encoding utf8`** — it adds a BOM and rewrites every line ending. Use Edit.
- **Branch and open a PR; never push directly to `main`.** Branch is `feat/redmond-duvall-accounting-basis`.
- **Phase 1 must not write a basis claim anywhere** — not into `data_source`, not into a dataset label. Redmond's rows read `accounting_basis = unknown` until phase 2 stamps them (spec §4.5).
- **Test command:** `npm test` (vitest run). Single file: `npx vitest run tests/<file>`.

---

## Review Focus

Five failure modes the spec implies that no task's happy path exercises. Each has a test pinned to the task that owns the code.

1. **A policy-excluded readable year loads anyway.** FY2006–FY2010 parse fine; only the roster window stops them. A `fiscalYears` typo or a loader that discovers PDFs from disk instead of the roster publishes five unauthorised years that all tie at $0. → Task 8, exclusion assertion.
2. **A wrong statement page that ties at $0.** During WA-CITIES-01 Task 5, nine of ten silent wrong-page hits tied at $0. Ambiguous page identity must be fatal, never a warning. → Task 2 probe + Task 7 re-derivation.
3. **A units error that the tie gate cannot see.** The tie is unit-invariant, so a 1000× error ties perfectly. Only the per-capita band fires. → Task 5, band derived from Redmond's own spread.
4. **A label defect invisible to every arithmetic gate.** Bainbridge shipped `_____…_____ Interest and Investment Revenue` to production with a correct figure and a $0 tie. → Task 7, label-surface assertions.
5. **A future library change "fixes" FY2017–FY2019 by decoding zeros.** The digits are absent, not encoded; a decode that returns a complete tree of correctly-named rows and no money must fail loudly rather than publish zeros. → Task 3, cipher selftest.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/fetchWaCities.mjs` | **Modify** — add `REDMOND_ARNS` + register in `ARNS_BY_CITY` |
| `scripts/extractRedmond.py` | **Create** — Redmond's `CityConfig` + probe evidence in its docstring |
| `scripts/lib/acfrGF.selftest.py` | **Modify** — add Redmond's page shape and the cipher fixture |
| `scripts/lib/waRoster.mjs` | **Modify** — add the Redmond entity |
| `tests/waRoster.test.mjs` | **Modify** — extend the roster-shape expectations |
| `scripts/processRedmond.js` | **Create** — thin loader driver |
| `scripts/seedWaCities.mjs` | **No change** — picks Redmond up from the roster once `fiscalYears` is set |
| `tests/waRederiveReaders.test.mjs` | **Modify** — add Redmond reader fixtures |
| `scripts/data/wa-cities-pdf-sha256.json` | **Modify** — pin Redmond's 11 PDFs |

---

### Task 1: Pin Redmond's ARNs and fetch the PDFs

**Files:**
- Modify: `scripts/fetchWaCities.mjs` (add `REDMOND_ARNS`, register in `ARNS_BY_CITY`)
- Test: `tests/waSao.test.mjs`

**Interfaces:**
- Consumes: `fetchReportPdf`, `classifyReport` from `scripts/lib/waSao.mjs`
- Produces: `REDMOND_ARNS` — `Record<number, number>`, 11 entries keyed by fiscal year; `ARNS_BY_CITY.Redmond`

- [ ] **Step 1: Write the failing test**

Add to `tests/waSao.test.mjs`:

```javascript
import { REDMOND_ARNS, ARNS_BY_CITY } from '../scripts/fetchWaCities.mjs';

describe('REDMOND_ARNS', () => {
  // The window is FY2011-FY2024 less the three ciphered years. FY2004-FY2010
  // are excluded by POLICY (spec 2.1.1) and five of them are readable, so an
  // ARN appearing here for one of them would load an unauthorised year.
  it('pins exactly the eleven loaded fiscal years', () => {
    expect(Object.keys(REDMOND_ARNS).map(Number).sort((a, b) => a - b))
      .toEqual([2011, 2012, 2013, 2014, 2015, 2016, 2020, 2021, 2022, 2023, 2024]);
  });

  it('pins no ARN for a policy-excluded or ciphered year', () => {
    for (const fy of [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2017, 2018, 2019, 2025]) {
      expect(REDMOND_ARNS[fy], `FY${fy} must not be pinned`).toBeUndefined();
    }
  });

  it('registers Redmond in ARNS_BY_CITY', () => {
    expect(ARNS_BY_CITY.Redmond).toBe(REDMOND_ARNS);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/waSao.test.mjs`
Expected: FAIL — `REDMOND_ARNS` is not exported.

- [ ] **Step 3: Add the ARN manifest**

Add to `scripts/fetchWaCities.mjs`, after `EVERETT_ARNS`:

```javascript
/**
 * Redmond, MCAG 0425. Every ARN below is the "Financial and Federal" /
 * "Financial" report titled exactly "City of Redmond" for that audit period.
 *
 * 54 of the MCAG's 59 reports are the city's own. The decoys are one
 * "Redmond, City of GASB 68 Examination Report" -- a pension-liability
 * examination, NAME INVERTED exactly like Bellevue's, so a prefix match on
 * "City of Redmond" excludes it where a "contains" match would not -- and four
 * statewide performance audits that merely mention the city ("Use of Impact
 * Fees in Federal Way, Olympia, Maple Valley, Redmond and Vancouver").
 *
 * ⚠ The report-type inversion is TOTAL on this issuer: all 14 reports typed
 * "Annual Comprehensive Financial Report" are 2-5 page opinion letters, and
 * every statement-bearing filing is typed "Financial and Federal" or
 * "Financial". Selecting by type name would yield 14 opinion letters.
 *
 * ⚠⚠ THIS MANIFEST IS THE LOADED WINDOW, NOT THE READABLE ONE. FY2006-FY2010
 * are READABLE and deliberately absent: the floor rule's era-split clause ends
 * the window at FY2011, where the statement stops splitting across two pages.
 * Their ARNs are recorded in the spec (6) so revisiting that decision needs no
 * re-recon. Do not "helpfully" restore them here.
 *
 * FY2017-FY2019 are absent for a different reason: ciphered text whose money
 * digits are absent from the stream. FY2025 has no filing.
 */
export const REDMOND_ARNS = {
  2011: 1008494, 2012: 1010466, 2013: 1012425, 2014: 1014930,
  2015: 1017176, 2016: 1019544, 2020: 1029176, 2021: 1031765,
  2022: 1035798, 2023: 1038568, 2024: 1040508,
};
```

Then add `Redmond: REDMOND_ARNS,` to the `ARNS_BY_CITY` object.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run tests/waSao.test.mjs`
Expected: PASS.

- [ ] **Step 5: Fetch the PDFs through the content guard**

Run: `node scripts/fetchWaCities.mjs Redmond`
Expected: `11 file(s) passed the content guard.` and exit 0. Each line reports size and `statements present`.

⚠ If any year fails here, STOP and report it rather than adjusting the guard. The guard rejecting a year means the document is not what the manifest claims.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetchWaCities.mjs tests/waSao.test.mjs
git add -f docs/Redmond/
git commit -m "feat(wa): pin Redmond ARNs and fetch 11 statement PDFs"
```

---

### Task 2: Probe the corpus before writing any extractor

**Files:**
- Create: `docs/superpowers/plans/REDMOND-RECON.md`
- Test: none — this task produces evidence, not code

**Interfaces:**
- Consumes: `tablePages`, `findStatementPage`, `printedIndents`, `unitsOf` from `scripts/verify-wa-rederive.mjs`
- Produces: the five config decisions Task 3 encodes — `parents`, `root_leaves`, `revenue_parents`, `column_strategy`, and whether `statement_anchor` / `label_fixes` / `empty_rows` are needed

This task exists because deriving the config from the harness's own conclusion makes the harness's later agreement vacuous. **Derive from the DOCUMENT.** This probe predicted every one of Everett's config decisions and cost nothing.

- [ ] **Step 1: Confirm page identity is unambiguous in all 11 years**

```bash
node -e "
import('./scripts/verify-wa-rederive.mjs').then(async (m) => {
  for (const fy of [2011,2012,2013,2014,2015,2016,2020,2021,2022,2023,2024]) {
    const pages = m.tablePages(\`docs/Redmond/redmond-\${fy}-acfr.pdf\`);
    const hits = m.findStatementPage(pages, \`Redmond FY\${fy}\`);
    const arr = Array.isArray(hits) ? hits : [hits];
    console.log(\`FY\${fy} candidates=\${arr.length}\`);
  }
});
"
```

Expected: `candidates=1` for all 11. **Any year with 2+ candidates is FATAL** — taking `cands[0]` IS the "true statement sorts earliest" assumption, and nine of ten silent wrong-page hits tied at $0 during WA-CITIES-01. Stop and adjudicate by caption.

- [ ] **Step 2: Confirm units are whole dollars in all 11 years**

Same loop, calling `m.unitsOf(pages[idx])`. Expected: `1` everywhere. A `1000` anywhere means a mixed-units corpus and the window must be re-cut.

- [ ] **Step 3: Count incomplete rows to choose `column_strategy`**

For each year and both sections, count rows with fewer cells than the Total row.

- **Zero incomplete rows in every year and both sections ⇒ `ordinal` is safe** (this is the documented test; Everett passed it with zero in 21 filings).
- **Any incomplete row ⇒ `positional`.** Ordinal dies when a row is short.
- Note also: positional dies when `-table` scatters a column across disjoint zones (Bellevue FY2008/09, Kitsap FY2004–16). If BOTH fail, the window is wrong.

- [ ] **Step 4: Read printed indentation to derive the tree shape**

```bash
pdftotext -layout docs/Redmond/redmond-2024-acfr.pdf - | sed -n '<statement page range>p'
```

⚠ **Use `-layout` for indentation, never `-table`**, which flattens it. ⚠ But `-layout` cannot be trusted either when a page emits every label at column 0 (Kent FY2006); cross-check with `printedIndents()`, which takes nesting from `-lineprinter` true geometry.

Record for Redmond:
- `parents` — lowercase labels introducing a group in the expenditure section (expect `('current', 'debt service')`, but **verify**).
- `root_leaves` — labels carrying a value that sit at ROOT. **The tree shape is per-city and can INVERT:** five WA cities print `Capital outlay` as a valued root leaf; Bellevue prints it as a PARENT. Guessing produces a $0 tie with a wrong tree.
- `revenue_parents` / `revenue_group_members` — often empty on this cohort. If `revenue_parents` is non-empty, `revenue_group_members` MUST be too, or the group closes after its first child and every later sibling silently reparents one level up, still tying at $0.

- [ ] **Step 5: Check for the three label hazards**

- **A leading margin rule welding onto a label** (3+ underscores, 2+ space gap, then a letter). Found in WA SAO filings only — and Redmond is a WA SAO filing.
- **A number inside a label.** The label ends at the first money token after which no word remains (`Fire District # 37 Contract`).
- **A row with money but fewer cells than the Total row is NOT a heading** — the issuer printed a blank, not a dash.

- [ ] **Step 6: Record every finding in `docs/superpowers/plans/REDMOND-RECON.md`**

One section per decision, each citing the year and page it was read from. A decision with no cited evidence is a guess.

- [ ] **Step 7: Commit**

```bash
git add -f docs/superpowers/plans/REDMOND-RECON.md
git commit -m "docs(wa): Redmond recon — page identity, units, column strategy, tree shape"
```

---

### Task 3: Write `extractRedmond.py` and its selftests

**Files:**
- Create: `scripts/extractRedmond.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `CityConfig`, `run_cli` from `scripts/lib/acfrGF.py`
- Produces: `scripts/extractRedmond.py` CLI — `<pdf> --mode operating|revenue` → JSON on stdout with `fiscal_year`, `total`, `tie_delta`, and the tree; exits non-zero on a non-zero `tie_delta`

- [ ] **Step 1: Write the failing selftests**

Add to `scripts/lib/acfrGF.selftest.py` — transcribed at the offsets `pdftotext` actually emits, **not** idealised:

```python
def test_redmond_statement_shape():
    """Redmond FY2024 p.42, the shape the extractor must read."""
    page = (
        "                                        CITY OF REDMOND\n"
        "        Statement of Revenues, Expenditures and Changes in Fund Balances\n"
        "                              Governmental Funds\n"
        "                      For the year ended December 31, 2024\n"
        # ... transcribe the real columns and rows here from the probe ...
    )
    rows = parse_page(page, REDMOND_CONFIG)
    assert rows[0].label == "Taxes"
    assert rows[0].value == <the figure read off the page>


def test_redmond_cipher_year_yields_no_money():
    """FY2017-FY2019 are ciphered with the DIGITS ABSENT, not encoded.

    A decode that returns correctly-named rows and no money is not a partial
    success -- there is nothing to load. This pins that: if a future library
    change appears to 'fix' these years, it must prove it recovered real money
    rather than silently publishing zeros.
    """
    ciphered = (
        "                     &,7<2)5('021'\n"
        "        67$7(0(172)5(9(18(6(;3(1',785(6\n"
        "          $1'&+$1*(6,1)81'%$/$1&(6\n"
    )
    # Labels decode under a constant +29 shift; digits would land on 0x13-0x1C
    # and NO byte in that range exists in the extracted page.
    assert all(not (0x13 <= ord(c) <= 0x1C) for c in ciphered)
    assert extract_money(ciphered) == []
```

- [ ] **Step 2: Run the selftests and watch them fail**

Run: `node -e "import('./scripts/lib/pythonBin.mjs').then(m => console.log(m.resolvePython()))"` to get the interpreter, then:
`<python> scripts/lib/acfrGF.selftest.py`
Expected: FAIL — `REDMOND_CONFIG` undefined.

- [ ] **Step 3: Write the extractor**

```python
#!/usr/bin/env python3
"""
City of Redmond, WA — General Fund extractor (MCAG 0425).

Thin wrapper over `scripts/lib/acfrGF.py`. Ninth WA SAO entity; King County,
alongside Bellevue and Kent.

WINDOW: FY2011-FY2024 less FY2017-FY2019 = 11 years, 22 rows.

⚠⚠ FY2006-FY2010 ARE READABLE AND DELIBERATELY NOT LOADED. The floor rule's
era-split clause ends the window at FY2011: FY2007-FY2010 print the statement
across TWO pages (`Page 1 of 2`) and would need `multipage=True`, and FY2006
captions it `Changes in Fund Balance` (SINGULAR) and would need a different
`statement_anchor`. Both are one line of config -- which is exactly why the
line is worth holding. See the spec 2.1.1. Do not add either flag here.

⚠ FY2017-FY2019 are ciphered: a constant +29 shift that decodes every LABEL
and no DIGIT. Under that shift an original '0'-'9' lands on bytes 0x13-0x1C,
and the extracted pages contain ZERO bytes in that range -- the digits are
absent from the stream, not encoded. Same class as Bainbridge FY2010, Kent
FY2019/2020/2023 and Vancouver FY2024.

⚠ FY2004/FY2005 are CCITT stencil scans (300dpi, 1-2 money tokens in the whole
document) -- a DIFFERENT defect from the cipher, needing a different probe.

AMOUNTS ARE WHOLE DOLLARS -> units=1. Like Spokane, Vancouver, Kent and
Everett; unlike Tacoma and Bellevue. The tie gate is unit-invariant, so the
roster's per-capita band is the only guard that fires on a wrong multiplier.

Usage:
  <python> scripts/extractRedmond.py "docs/Redmond/redmond-2024-acfr.pdf" --mode revenue
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib.acfrGF import CityConfig, run_cli   # noqa: E402

CONFIG = CityConfig(
    city='Redmond, WA',
    parents=(),              # fill from Task 2 Step 4 — read off the page
    root_leaves=(),          # fill from Task 2 Step 4
    revenue_parents=(),      # fill from Task 2 Step 4
    revenue_group_members=(),# MUST be non-empty if revenue_parents is
    column_strategy='',      # fill from Task 2 Step 3 — 'ordinal' or 'positional'
    units=1,
    fy_end=('December', 31),
    source_rounding={},      # Task 6 registers any confirmed printed-total artifact
)

if __name__ == '__main__':
    run_cli(CONFIG)
```

⚠ The `# fill from Task 2` fields are marked because they are **read from Redmond's own statement**. Inventing them is the specific failure this plan warns against — every one still ties at $0 when wrong.

- [ ] **Step 4: Run the selftests and watch them pass**

Run: `<python> scripts/lib/acfrGF.selftest.py`
Expected: PASS, and the pre-existing selftest count rises by exactly the tests added.

- [ ] **Step 5: Verify the extractor ties on the newest and oldest loaded years**

```bash
<python> scripts/extractRedmond.py "docs/Redmond/redmond-2024-acfr.pdf" --mode operating
<python> scripts/extractRedmond.py "docs/Redmond/redmond-2024-acfr.pdf" --mode revenue
<python> scripts/extractRedmond.py "docs/Redmond/redmond-2011-acfr.pdf" --mode operating
<python> scripts/extractRedmond.py "docs/Redmond/redmond-2011-acfr.pdf" --mode revenue
```

Expected: `tie_delta: 0` on all four, exit 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/extractRedmond.py scripts/lib/acfrGF.selftest.py
git commit -m "feat(wa): Redmond GF extractor, config derived from the statements"
```

---

### Task 4: Add Redmond to the roster

**Files:**
- Modify: `scripts/lib/waRoster.mjs`
- Test: `tests/waRoster.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: the Redmond entity object, reachable via `getEntity('Redmond')`

⚠ `perCapitaBand` stays `null` in this task. It is **derived from the loaded spread** in Task 5 and must never be inherited — Kent's `[220, 2000]` would have rejected a correct Everett load outright, and they are neighbours by size and units. The loaders assert non-null, so Task 5 fills it before any load.

- [ ] **Step 1: Write the failing test**

Extend `tests/waRoster.test.mjs`:

```javascript
it('carries Redmond with the eleven-year window', () => {
  const r = getEntity('Redmond');
  expect(r.mcag).toBe('0425');
  expect(r.entityType).toBe('city');
  expect(r.countyName).toBe('King County');
  expect(r.fiscalYears).toEqual(
    [2011, 2012, 2013, 2014, 2015, 2016, 2020, 2021, 2022, 2023, 2024]);
  expect(r.manifestSpan).toEqual([2004, 2025]);
});

it('declares a reason for every Redmond year in the manifest span that is not loaded', () => {
  const r = getEntity('Redmond');
  const [lo, hi] = r.manifestSpan;
  for (let fy = lo; fy <= hi; fy++) {
    const loaded = r.fiscalYears.includes(fy);
    const excluded = Object.prototype.hasOwnProperty.call(r.excludedYears, fy);
    expect(loaded !== excluded, `FY${fy} must be exactly one of loaded/excluded`).toBe(true);
  }
});

it('records the five policy exclusions as policy, not as defects', () => {
  // These years are READABLE. If their reasons read like document defects, a
  // later reader records Redmond as harder than it is and a future entity
  // inherits a false difficulty estimate.
  const r = getEntity('Redmond');
  for (const fy of [2006, 2007, 2008, 2009, 2010]) {
    expect(r.excludedYears[fy], `FY${fy}`).toMatch(/floor rule|policy/i);
  }
});

it('also adds Redmond to the roster name list', () => {
  expect(WA_ENTITIES.map((e) => e.name)).toContain('Redmond');
});
```

Also update the existing `carries the six WA-CITIES-01 cities...` expectation to include `'Redmond'` in its sorted array.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/waRoster.test.mjs`
Expected: FAIL — `getEntity('Redmond')` throws.

- [ ] **Step 3: Read Redmond's population from WA OFM**

⚠ **Do not invent this number.** Open `ofm_april1_population_final.xlsx` (the April 1, 2026 edition), sheet `Population`, column **`2025 Population Estimate`**, `Filter=4` city rows. Find the Redmond row and **record its line number** in `populationNote`.

The WA cohort is deliberately pinned to the **2025** column so all nine entities share one denominator and per-capita figures stay comparable. Do not use the 2026 column for Redmond alone.

- [ ] **Step 4: Add the roster entry**

Insert into `WA_ENTITIES` in `scripts/lib/waRoster.mjs`:

```javascript
{
  name: 'Redmond', mcag: '0425', entityType: 'city', countyName: 'King County',
  pdfDir: 'docs/Redmond', pdfPrefix: 'redmond', datasetIdPrefix: 'redmond-sao-gf',
  population: 0,            // fill from Step 3 — WA OFM 2025, cite the line
  populationNote: '',       // fill from Step 3
  // DERIVED in Task 5 from Redmond's own observed spread, never inherited.
  perCapitaBand: null,
  verifyPerCapitaBand: null,
  expectId: null,           // fill from Task 5 after seeding
  sanityMax: 5_000_000_000,
  // MEASURED window: 11 years on ONE config.
  fiscalYears: [2011, 2012, 2013, 2014, 2015, 2016, 2020, 2021, 2022, 2023, 2024],
  manifestSpan: [2004, 2025],
  excludedYears: {
    2004: 'CCITT stencil image-only scan — 300dpi, 1-2 money tokens in the whole document; also below the floor',
    2005: 'CCITT stencil image-only scan — same shape as FY2004; also below the floor',
    2006: 'READABLE — excluded by the floor rule, not by defect: captions the statement "Changes in Fund Balance" (singular) and would need its own statement_anchor below a three-year gap',
    2007: 'READABLE — excluded by the floor rule, not by defect: statement splits across two pages ("Page 1 of 2") and would need multipage=True below a three-year gap',
    2008: 'READABLE — excluded by the floor rule, not by defect: two-page split, as FY2007',
    2009: 'READABLE — excluded by the floor rule, not by defect: two-page split, as FY2007',
    2010: 'READABLE — excluded by the floor rule, not by defect: two-page split, as FY2007',
    2017: 'no usable text layer — constant +29 shift decodes every LABEL and no DIGIT; zero bytes in 0x13-0x1C, so the money is absent from the stream rather than encoded',
    2018: 'no usable text layer — same cipher as FY2017, and consecutive with it',
    2019: 'no usable text layer — same cipher as FY2017; third consecutive, which is what invokes the floor rule',
    2025: 'source timing — the SAO holds no City of Redmond filing for FY2025',
  },
  expectedResidues: 0,      // confirm in Task 6; a REAL number, including zero
  roundingFiles: ['extractRedmond.py'], navOnly: false,
},
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run tests/waRoster.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/waRoster.mjs tests/waRoster.test.mjs
git commit -m "feat(wa): add Redmond to the roster, 11-year window with reasons for all 11 exclusions"
```

---

### Task 5: Seed the municipality, derive the per-capita band

**Files:**
- Create: `scripts/processRedmond.js`
- Modify: `scripts/lib/waRoster.mjs` (fill `perCapitaBand`, `verifyPerCapitaBand`, `expectId`)

**Interfaces:**
- Consumes: `loadEntity`, `makeExtractorSelector` from `scripts/lib/waSaoLoad.mjs`; `REDMOND_ARNS` from `scripts/fetchWaCities.mjs`; `reportFileUrl` from `scripts/lib/waSao.mjs`; `getEntity` from `scripts/lib/waRoster.mjs`
- Produces: `scripts/processRedmond.js` CLI — `--dry-run`, `--fy <year>`

- [ ] **Step 1: Write the driver**

```javascript
#!/usr/bin/env node
/**
 * Loads City of Redmond, WA General Fund rows (operating + revenue) from the
 * WA State Auditor's bound financial statements (MCAG 0425).
 *
 * Thin driver over scripts/lib/waSaoLoad.mjs -- every guard (FY-vs-filename
 * cross-check, $0 tie gate, mapped-total == computed_total, sanity ceiling,
 * per-capita band, source_url validation, ephemeral data_sources lifecycle)
 * lives in that shared core. This file is descriptor + argv only.
 *
 * FISCAL-YEAR WINDOW: 11 years, FY2011-FY2024 less FY2017-FY2019.
 *
 * ⚠⚠ THE WINDOW IS NARROWER THAN THE READABLE CORPUS, DELIBERATELY. FY2006-
 * FY2010 parse fine and are excluded by the floor rule's era-split clause --
 * the statement stops splitting across two pages at FY2011. See the spec
 * 2.1.1. The roster is the only authority on the window; this driver must
 * never discover years from disk.
 *
 * ⚠ AMOUNTS ARE WHOLE DOLLARS (units=1). The tie gate is unit-invariant, so
 * the roster's per-capita band is the only guard that fires on a wrong
 * multiplier -- and the band is REDMOND'S OWN, derived from its observed
 * spread. Kent and Bellevue are its King County neighbours and neither band
 * would be correct here.
 *
 * Usage:
 *   node scripts/processRedmond.js --dry-run
 *   node scripts/processRedmond.js
 *   node scripts/processRedmond.js --fy 2024
 */
import { loadEntity, makeExtractorSelector } from './lib/waSaoLoad.mjs';
import { REDMOND_ARNS } from './fetchWaCities.mjs';
import { reportFileUrl } from './lib/waSao.mjs';
import { getEntity } from './lib/waRoster.mjs';

const argv = process.argv.slice(2);
const fyArg = argv.indexOf('--fy');
const E = getEntity('Redmond');

if (!E.fiscalYears) throw new Error('Redmond has no reconned fiscalYears in the roster — run recon first.');
if (!E.perCapitaBand) throw new Error('Redmond has no per-capita band in the roster — derive it from the observed spread first.');

// Fail fast and locally if the FY window and the ARN manifest ever drift apart.
const missingArns = E.fiscalYears.filter((fy) => !REDMOND_ARNS[fy]);
if (missingArns.length) {
  throw new Error(`No ARN in REDMOND_ARNS for FY ${missingArns.join(', ')} — ` +
    `the roster window and the ARN manifest must agree.`);
}

const { loaded, failed } = await loadEntity({
  entityName: E.name,
  // ONE extractor for the whole 11-year window. The statement shape is
  // identical in FY2011 and FY2024; the two-page era below FY2011 is outside
  // the window precisely so no second config is needed.
  extractorFor: makeExtractorSelector('extractRedmond.py'),
  pdfDir: E.pdfDir,
  pdfPrefix: E.pdfPrefix,
  fiscalYears: E.fiscalYears,
  population: E.population,
  perCapitaBand: E.perCapitaBand,
  datasetIdPrefix: E.datasetIdPrefix,
  sourceUrlFor: (fy) => reportFileUrl(REDMOND_ARNS[fy]),
  sanityMax: E.sanityMax,
  dryRun: argv.includes('--dry-run'),
  targetFY: fyArg === -1 ? null : Number(argv[fyArg + 1]),
});

console.log(`\nRedmond: ${loaded} loaded, ${failed} failed.`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Temporarily widen the band so the dry run can report totals**

Set `perCapitaBand: [1, 100_000]` in the roster. This is a scaffold, removed in Step 4.

- [ ] **Step 3: Dry-run all 11 years and record the spread**

Run: `node scripts/processRedmond.js --dry-run`
Expected: 22 combinations, every one `tie_delta: 0`, and a per-capita figure printed per combination.

Record the **minimum and maximum** per-capita across all 22.

- [ ] **Step 4: Derive both bands and write them to the roster**

- `perCapitaBand` (loader) ≈ `0.5 × min` .. `2 × max` — wide enough for every real year, tight enough that a 1000× units error cannot pass.
- `verifyPerCapitaBand` (harness) tighter — it rejects a **wrong page**, not a wrong scale.

Replace the scaffold with the derived values and a comment citing the measured spread, in the style of the Bellevue and Everett entries.

- [ ] **Step 5: Seed the municipality**

Run: `node scripts/seedWaCities.mjs Redmond`
Expected: `Seed OK — 1 city row(s) written, no duplicates, one King County.`

⚠ King County **already exists** from v2.21 and is reused. The script hard-fails rather than create a second one; if it reports anything other than exactly one King County, STOP.

- [ ] **Step 6: Record `expectId`**

Read the new municipality's UUID from the seed output and write it to `expectId` in the roster.

- [ ] **Step 7: Commit**

```bash
git add scripts/processRedmond.js scripts/lib/waRoster.mjs
git commit -m "feat(wa): Redmond loader driver, per-capita band derived from its own spread"
```

---

### Task 6: Load the 22 rows

**Files:**
- Modify: `scripts/extractRedmond.py` (only if a residue is confirmed)
- Modify: `scripts/lib/waRoster.mjs` (`expectedResidues`, only if non-zero)

- [ ] **Step 1: Dry-run once more against the derived bands**

Run: `node scripts/processRedmond.js --dry-run`
Expected: 22 combinations, 22 ties at $0, 0 failed, no band rejections.

- [ ] **Step 2: Adjudicate any residue by RENDERING the page**

If any combination reports a non-zero `tie_delta`:

```bash
pdftoppm -r 160 -f <page> -l <page> -png docs/Redmond/redmond-<fy>-acfr.pdf out
```

Read the General Fund column **off the image**, never off the text layer. If the document's own printed total genuinely disagrees with the sum of its own printed components, register the **exact** delta in `source_rounding` keyed `(fiscal_year, mode)`.

⚠ Deltas are in the **scaled** domain. Redmond is `units=1`, so a $1 printed disagreement registers as `1`.
⚠ Never widen the tolerance. Every real mis-parse this parser has produced was off by millions, never by a dollar.
⚠ The loaded value is always the **component sum**, never the printed total.

Update `expectedResidues` in the roster to the real number, **including zero** — asserting the zero means a residue appearing later is a finding rather than a shrug.

- [ ] **Step 3: Load**

Run: `node scripts/processRedmond.js`
Expected: `Redmond: 22 loaded, 0 failed.`

- [ ] **Step 4: Confirm the row count and that no excluded year loaded**

```bash
node -e "
import('./scripts/lib/listAllSources.mjs').then(async (m) => {
  // 22 rows, and ZERO rows for any year outside the window.
  // Use paginate() — a Supabase RPC silently caps at 1,000 rows.
});
"
```

Expected: exactly 22 rows; zero rows for FY2004–FY2010, FY2017–FY2019, FY2025.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/waRoster.mjs scripts/extractRedmond.py
git commit -m "feat(wa): load Redmond — 22 rows, all tying at \$0"
```

---

### Task 7: Blind re-derivation harness

**Files:**
- Modify: `tests/waRederiveReaders.test.mjs`
- Test: `scripts/verify-wa-rederive.mjs --only Redmond`

**Interfaces:**
- Consumes: the harness's own independent reader — it must NOT import `extractRedmond.py`'s config
- Produces: 22/22 re-derived at exactly $0

⚠ **The Kent lesson applies here.** When the harness reader disagrees with the document, never assume the loaded data is fine just because the reader is provably wrong. Fix the reader FIRST, then re-run — the extractor usually shares the defect, because both were written from the same misreading of the page.

- [ ] **Step 1: Add Redmond's page shape to the reader fixtures**

Add to `tests/waRederiveReaders.test.mjs`, transcribed at the offsets `pdftotext` actually emits. Add a new city's shape here rather than debugging against the live corpus.

- [ ] **Step 2: Run the fixtures and watch them fail**

Run: `npx vitest run tests/waRederiveReaders.test.mjs`
Expected: FAIL until the reader handles Redmond's shape.

- [ ] **Step 3: Make them pass, then run the real re-derivation**

Run: `node scripts/verify-wa-rederive.mjs --only Redmond`
Expected: `22/22 re-derived at exactly $0, 0 blockers.`

- [ ] **Step 4: Assert label surfaces directly**

Add an assertion that every published category and line-item label for Redmond:
- contains no run of 3+ underscores (the margin-rule weld),
- is non-empty after trimming,
- does not end mid-token where a number was cut from a label.

⚠ **A label defect is invisible to every arithmetic gate.** Bainbridge shipped `_____…_____ Interest and Investment Revenue` to production with a correct figure and a $0 tie, and the loader, the tie gate and the blind re-derivation all passed it.

- [ ] **Step 5: Commit**

```bash
git add tests/waRederiveReaders.test.mjs scripts/verify-wa-rederive.mjs
git commit -m "test(wa): Redmond blind re-derivation, 22/22 at \$0, label surfaces asserted"
```

---

### Task 8: Audit harness, exclusion assertions, sha manifest

**Files:**
- Modify: `scripts/data/wa-cities-pdf-sha256.json`
- Test: `scripts/verify-wa-audit.mjs --only Redmond`

- [ ] **Step 1: Run the audit**

Run: `node scripts/verify-wa-audit.mjs --only Redmond`
Expected: all 8 checks (a,b,c,d,e,h,f,g) pass.

⚠ Check **(e) is scoped to ONE CATEGORY** and cannot see a weld whose prefix was a row printed EMPTY — it passed all ten Kent defects. It is not a substitute for Task 7 Step 4.
⚠ Check **(f) is scoped to `state='WA'`** because Bellevue, OHIO exists in the DB. Redmond, OREGON also exists as a real city — confirm the scoping holds.

- [ ] **Step 2: Confirm the exclusion assertion actually fires**

This is Review Focus #1 and the single most important check in phase 1, because five of Redmond's ten excluded years are **perfectly readable**.

Mutation-test it: temporarily add `2010` to `fiscalYears`, re-run the audit, and confirm it **fails**. Then revert.

Expected: the audit reports a row present for a declared-excluded year. A gate that cannot be shown to fail is a gate that passes vacuously forever.

- [ ] **Step 3: Check for sha mismatches BEFORE re-recording**

Run: `node scripts/verify-wa-audit.mjs`
Expected: no mismatches among the existing 8 entities' PDFs.

⚠ `--record-sha` would silently bless a changed file. Check first, always.

- [ ] **Step 4: Record the digests**

Run: `node scripts/verify-wa-audit.mjs --record-sha`

⚠ `--record-sha` is **whole-corpus** and is guarded against `--only`. Its "wrote N digests" is the new TOTAL, not the number added — expect the previous total plus 11.

Review the diff before committing.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/wa-cities-pdf-sha256.json
git commit -m "test(wa): Redmond audit 8/8, exclusion gate mutation-tested, 11 PDFs pinned"
```

---

### Task 9: Tether, enrichment, and full-suite green

**Files:**
- Modify: `scripts/loadWaCitiesEnrichment.mjs` (if Redmond needs enrichment rows)

- [ ] **Step 1: Run the tether harness**

Run: `node scripts/verify-wa-tether.mjs --only Redmond`
Expected: exit 0. The harness deliberately does **not** assert coverage — exit 0 means "the catalog answered".

⚠ Essentials' `coverage.json` carried exactly one WA city and one WA county (Seattle, King County) as of 2026-08-15. `NOT COVERED` for Redmond is the expected, correct outcome and is a documented gap, not a TT bug. Do not "fix" it.

- [ ] **Step 2: Check the banner bucket**

Probe `cities/redmond.jpg` and `cities/redmond-wa.jpg`.

⚠ If an asset exists, its credit must be **transcribed** from essentials' `buildingImages.js`, never inferred from the filename — a stale credit went public three times. If no asset exists, leave Redmond on the Wikipedia fallback, which is what every other WA entity except Seattle and King County does.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all green, with the vitest count up by the tests this plan added.

⚠ `npm run lint` never exits 0 in this repo — it is a known-broken gate and is **not** a signal here.

- [ ] **Step 4: Re-run every WA harness whole-corpus**

```bash
node scripts/verify-wa-rederive.mjs
node scripts/verify-wa-audit.mjs
node scripts/verify-wa-tether.mjs
```

Expected: the previous corpus totals plus Redmond's 22 rows, everything green. This catches a Redmond change that broke a shared reader for another city.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feat/redmond-duvall-accounting-basis
gh pr create --title "feat(wa): onboard Redmond — 11 years, 22 rows, all tying at \$0" --body "<summary>"
```

The PR body states: the 11-year window and why it stops at FY2011; that FY2006–FY2010 are readable and excluded by policy; the cipher finding for FY2017–FY2019; and that phase 2 (the `accounting_basis` axis, then Duvall) follows behind.

---

## Self-Review

**Spec coverage.** §2 Redmond → Tasks 1–6. §2.1.1 floor rule → Task 4 Step 4 exclusion reasons + Task 8 Step 2 mutation test. §2.2 cipher → Task 3 Step 1 selftest, Task 4 Step 4 reasons. §2.3 recon items → Task 2 (page identity, units, column strategy, tree shape), Task 4 Step 3 (population), Task 5 Step 4 (bands). §5 verification items 1–5 and 8 → Tasks 7, 8. §5 items 6–7 are phase 2 and are correctly absent. §8 hazards → Global Constraints.

**Phase boundary.** No task touches `treasury.budgets` schema, `fundScope.mjs`, `ScopeLabel.tsx` or `auditGradeRegistry.mjs`. Per spec §4.5, no task writes a basis claim into a `data_source` or dataset label.

**Deliberate unresolved values.** Three, each with a named authority and a defined method rather than a TBD, following the WA-CITIES-01 convention: the `CityConfig` fields marked `# fill from Task 2` (read from Redmond's own statement), the population (WA OFM 2025 column, line cited), and the two per-capita bands plus `source_rounding` (derived from the observed spread, residues adjudicated by rendering the page). Inventing any of them is the specific failure each step warns against.

**Type consistency.** `REDMOND_ARNS` is `Record<number, number>` in Tasks 1 and 5. `getEntity('Redmond')` returns the roster object used in Tasks 4, 5, 6. `makeExtractorSelector('extractRedmond.py')` matches the file created in Task 3. `perCapitaBand` / `verifyPerCapitaBand` are both `[number, number]`, set in Task 5 Step 4 and consumed by the loader and harness respectively.
