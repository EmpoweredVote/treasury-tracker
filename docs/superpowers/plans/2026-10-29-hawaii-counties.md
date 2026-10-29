# Hawaii's Four Counties — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load General Fund revenue + operating actuals for all four Hawaii county governments, FY2016–FY2025, from their own audited ACFRs, at full drill-down depth, every figure citable.

**Architecture:** A direct sibling of the proven `ak-local-acfr-gf` family. A roster module holds entity facts and FAC `report_id`s; a fetcher downloads each ACFR behind six guards and deletes anything it cannot prove; a thin Python wrapper declares one `CityConfig` per county over the shared `scripts/lib/acfrGF.py`; a seeder creates the four governments; a driver runs `scripts/lib/acfrGfLoad.mjs` once per county. No new write path, no new RPC, no `src/` change.

**Tech Stack:** Node ESM + vitest, Python 3 (`py -3` / `python` — probe, per `reference_python_toolchain_location`), `pdftotext -table` from poppler, Supabase JS client.

**Spec:** `docs/superpowers/specs/2026-10-29-hawaii-counties-design.md`

## Global Constraints

- **Family:** `hi-local-acfr-gf`. The `Hawaii / state` node is `state-acfr-gf` and **must not be touched**.
- **Roster is exactly 4 entities and 38 filings.** Honolulu FY2016–2025 (10), Maui FY2016–2025 (10), Hawaii County FY2016–2024 (9), Kaua'i FY2016–2024 (9).
- **EINs:** Honolulu `996001257`, Maui `996000618`, Hawaii County `996000567`, Kaua'i `996000658`. **Key on EIN. Never join FAC by name.**
- **Typing:** Honolulu → `entity_type='city'`, `county_id=null`. Hawaii/Maui/Kaua'i → `entity_type='county'`, `county_id=null`. **No new `entity_type` value.**
- **Names:** `Honolulu`, `Hawaii County`, `Maui County`, `Kauai County` (no ʻokina).
- **Populations (census vintage 2024):** Honolulu 998,747 · Hawaii County 209,790 · Maui County 163,688 · Kauai County 73,840. `population_year = 2024`.
- **GEOIDs:** `15003` / `15001` / `15009` / `15007`.
- **Fiscal year:** all four end **June 30** → `fyEndMonthDay: '06-30'`, `fiscalYearStartMonth: 7`. Asserted per filing, never carried.
- **Kalawao County must never be created.** It has no government.
- **`source_url` is the FAC permalink**, built by `documentUrlFor(key, fy)`. **Never `res.url`.**
- **Each county's tree mirrors its own report.** No cross-county label normalisation.
- **Scope/basis:** `fund_scope='general_fund'`, `basis='actual'`, `audit_grade` asserted from each document's own opinion.
- `npm run build` is the type gate. **`npx tsc --noEmit` checks nothing here.**
- Never push to `main`; branch is `hi-counties-deep-seed`, work merges by PR.

## Review Focus

1. **A `units` error is invisible to the tie gate.** Honolulu prints *Amounts in thousands*; a county printing whole dollars that is read as thousands ties perfectly at 1000× wrong. Pinned by the per-capita guard test in Task 5.
2. **A ciphered text layer passes the density guard.** Alaska had three, at ~1,650–1,900 chars/page, where the entity's own name appeared zero times. Only the auditee-identity guard catches it. Pinned in Task 2.
3. **Non-unique labels across parents.** Honolulu prints `Miscellaneous:` under *both* Revenues and Current expenditures, `Other` as a child of both, and repeats five function names under `Capital Outlay:` that already appear under `Current:`. Parenting by label alone yields a wrong tree that ties at $0. Pinned in Task 3.
4. **A fifth Hawaii entity.** Kalawao, `Department of Water, County of Kauai` (EIN `472810526`), or any of the 295 state bodies entering the roster. Pinned in Tasks 1 and 4.
5. **`Hawaii County` colliding with the existing `Hawaii` state node.** They differ by one word and `check:forks` is the only thing that looks. Pinned in Task 4.

---

### Task 1: The roster module

**Files:**
- Create: `scripts/lib/facCitable.mjs`
- Create: `scripts/lib/hiCountySources.mjs`
- Modify: `scripts/lib/akBoroughSources.mjs` (re-export the two moved symbols)
- Test: `tests/hiCountySources.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `facCitable.mjs`: `FAC_PDF_BASE: string`, `assertCitable(url: string): string`
  - `hiCountySources.mjs`: `HI_COUNTIES: readonly {key, name, entityType, state, ein, geoid, population, sourcePage}[]`, `FAC_ROSTER: Readonly<{[key]: {[fy]: {report_id, name, ein, uei, fy_end}}}>`, `countyByKey(key): object`, `fysFor(key): number[]`, `documentUrlFor(key, fy): string|null`

`assertCitable` and `FAC_PDF_BASE` move out of `akBoroughSources.mjs` unchanged so both families share one definition; `akBoroughSources.mjs` re-exports them, so every existing importer and `tests/akBoroughSources.test.mjs` keep working untouched. That existing test file is the regression gate for the move and **must stay green without edits**.

The four `key` values are `honolulu`, `hawaii`, `maui`, `kauai`. `report_id`s come from `cache/fac-general.csv` filtered on the four EINs (§2.1 of the spec); they are data, transcribed, not computed.

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest';
import { HI_COUNTIES, FAC_ROSTER, countyByKey, fysFor, documentUrlFor } from '../scripts/lib/hiCountySources.mjs';
import { FAC_PDF_BASE, assertCitable } from '../scripts/lib/facCitable.mjs';

describe('the Hawaii county roster', () => {
  it('holds exactly four governments', () => {
    expect(HI_COUNTIES).toHaveLength(4);
    expect(HI_COUNTIES.map(c => c.key).sort()).toEqual(['hawaii', 'honolulu', 'kauai', 'maui']);
  });

  // Kalawao (pop 81) is administered by the state Health Department and files
  // nothing. Creating it would mint a government that does not exist.
  it('does not contain Kalawao', () => {
    expect(JSON.stringify(HI_COUNTIES)).not.toMatch(/kalawao/i);
  });

  // `Department of Water, County of Kauai` is a COMPONENT UNIT with its own
  // EIN and its own filings — the Kodiak Island Housing Authority lookalike.
  it('keys on the four government EINs only', () => {
    expect(HI_COUNTIES.map(c => c.ein).sort())
      .toEqual(['996000567', '996000618', '996000658', '996001257']);
    expect(JSON.stringify(FAC_ROSTER)).not.toContain('472810526');
  });

  it('types Honolulu city and the other three county', () => {
    expect(countyByKey('honolulu').entityType).toBe('city');
    for (const k of ['hawaii', 'maui', 'kauai']) {
      expect(countyByKey(k).entityType).toBe('county');
    }
  });

  // Measured live 2026-10-29: Hawaii County and Kaua'i have NOT filed FY2025.
  it('spans 38 filings, with two counties stopping at FY2024', () => {
    expect(fysFor('honolulu')).toEqual([2016,2017,2018,2019,2020,2021,2022,2023,2024,2025]);
    expect(fysFor('maui')).toEqual([2016,2017,2018,2019,2020,2021,2022,2023,2024,2025]);
    expect(fysFor('hawaii').at(-1)).toBe(2024);
    expect(fysFor('kauai').at(-1)).toBe(2024);
    expect(HI_COUNTIES.reduce((n, c) => n + fysFor(c.key).length, 0)).toBe(38);
  });

  it('builds every document URL from the citable FAC endpoint', () => {
    for (const c of HI_COUNTIES) {
      for (const fy of fysFor(c.key)) {
        const u = documentUrlFor(c.key, fy);
        expect(u.startsWith(FAC_PDF_BASE)).toBe(true);
        expect(() => assertCitable(u)).not.toThrow();
      }
    }
  });

  it('carries the 2024 census populations and county GEOIDs', () => {
    expect(countyByKey('honolulu')).toMatchObject({ population: 998747, geoid: '15003' });
    expect(countyByKey('hawaii')).toMatchObject({ population: 209790, geoid: '15001' });
    expect(countyByKey('maui')).toMatchObject({ population: 163688, geoid: '15009' });
    expect(countyByKey('kauai')).toMatchObject({ population: 73840, geoid: '15007' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/hiCountySources.test.mjs`
Expected: FAIL — cannot resolve `scripts/lib/hiCountySources.mjs`

- [ ] **Step 3: Create `scripts/lib/facCitable.mjs` and re-export from `akBoroughSources.mjs`**

Move `FAC_PDF_BASE` and `assertCitable` verbatim. In `akBoroughSources.mjs` replace the definitions with `export { FAC_PDF_BASE, assertCitable } from './facCitable.mjs';`.

- [ ] **Step 4: Run the Alaska regression gate**

Run: `npx vitest run tests/akBoroughSources.test.mjs`
Expected: PASS, with no edits to that file

- [ ] **Step 5: Build `scripts/lib/hiCountySources.mjs`**

Transcribe the 38 `report_id`s from `cache/fac-general.csv` keyed on the four EINs. Header comment carries: why Hawaii has no municipalities, why Kalawao is absent, why Alaska's census typing rule does not apply, and the component-unit trap.

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run tests/hiCountySources.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/facCitable.mjs scripts/lib/hiCountySources.mjs scripts/lib/akBoroughSources.mjs tests/hiCountySources.test.mjs
git commit -m "feat(hi): roster for Hawaii's four county governments"
```

---

### Task 2: The fetcher

**Files:**
- Create: `scripts/fetchHiCounties.mjs`
- Test: `tests/hiCountyFetchGuards.test.mjs`

**Interfaces:**
- Consumes: `HI_COUNTIES`, `fysFor`, `documentUrlFor`, `countyByKey` (Task 1); `assertCitable` from `facCitable.mjs`.
- Produces: `docs/HiCounties/<key>/<key>-<fy>-acfr.pdf` + `docs/HiCounties/<key>/manifest.json`, each entry `{fiscalYear, url, servedUrl, sha256, bytes, pages}`. Exports `identityPattern(key): RegExp` and `assertFiscalYear(text, fy): boolean` for test.

Modelled on `scripts/fetchAkBoroughs.mjs`; carries its six guards unchanged (spec §6). `docs/*` is gitignored, so the PDFs never enter the repo.

⚠ `url` in the manifest is `documentUrlFor(...)` — the permalink requested. `servedUrl` records the ephemeral redirect target for the record and is offered to nobody.

- [ ] **Step 1: Write the failing test**

```js
// Guard (e) is the only one that catches a CIPHERED text layer: Alaska had
// three at ~1,650-1,900 chars/page in which the entity's own name appeared
// zero times, sailing through the <400 c/p density guard. A ciphered page
// yields spurious NUMBERS, not an empty tree.
it('matches each county on its own distinctive cover-page stem', () => {
  expect(identityPattern('honolulu').test('CITY AND COUNTY OF HONOLULU')).toBe(true);
  expect(identityPattern('honolulu').test('COUNTY OF MAUI')).toBe(false);
  expect(identityPattern('kauai').test("COUNTY OF KAUA'I")).toBe(true);
  expect(identityPattern('kauai').test('COUNTY OF KAUAI')).toBe(true);
  // The component unit must NOT satisfy its parent county's identity guard.
  expect(identityPattern('kauai').test('DEPARTMENT OF WATER, COUNTY OF KAUAI')).toBe(false);
  // Hawaii County must not be satisfied by the STATE's own filings.
  expect(identityPattern('hawaii').test('STATE OF HAWAII DEPARTMENT OF TRANSPORTATION')).toBe(false);
});

it('rejects a document naming a different fiscal year', () => {
  expect(assertFiscalYear('FOR THE FISCAL YEAR ENDED JUNE 30, 2025', 2025)).toBe(true);
  expect(assertFiscalYear('FOR THE FISCAL YEAR ENDED JUNE 30, 2024', 2025)).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/hiCountyFetchGuards.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `scripts/fetchHiCounties.mjs`**

Guards a–f per spec §6. `MIN_PAGES` and `MIN_BYTES` are tuned to this cohort, not copied from Alaska's 40/300 KB — Honolulu FY2025 is 362 pages / 9.7 MB, and Kaua'i is far smaller; set the floor from the smallest file actually fetched and record the measured range in the header. CLI: `--entity <key>`, `--fy <year>`, `--probe`.

⚠ `identityPattern('kauai')` must match `COUNTY OF KAUA'I` and `COUNTY OF KAUAI` while rejecting `DEPARTMENT OF WATER, COUNTY OF KAUAI` — a leading-boundary match, not a substring search.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/hiCountyFetchGuards.test.mjs`
Expected: PASS

- [ ] **Step 5: Fetch the corpus**

Run: `node scripts/fetchHiCounties.mjs`
Expected: 38 PDFs across four directories, or a named guard failure per missing file. **Record every rejection and its cause** — a guard failure is a finding, not an error to retry around.

- [ ] **Step 6: Commit**

```bash
git add scripts/fetchHiCounties.mjs tests/hiCountyFetchGuards.test.mjs
git commit -m "feat(hi): ACFR fetcher with the six Alaska guards"
```

---

### Task 3: The extractor wrapper

**Files:**
- Create: `scripts/extractHiCounty.py`
- Test: `scripts/lib/acfrGF.selftest.py` (extend) — run via `npm run test:acfr`

**Interfaces:**
- Consumes: `CityConfig`, `extract` from `scripts/lib/acfrGF.py`.
- Produces: CLI `python scripts/extractHiCounty.py --entity <key> <pdf> --mode <revenue|operating>` emitting the extractor tree as JSON on stdout — the contract `acfrGfLoad.extractPDF` already expects.

One file, four `CONFIGS` entries, following `scripts/extractAkBorough.py`'s precedent for a single cohort.

⚠⚠ **Honolulu's config is the only one this plan can pin**, because it is the only statement measured. The other three are *derived by reading their own statements* in Step 3 — that is the work, and guessing them produces a $0 tie with a wrong tree.

- [ ] **Step 1: Write the failing test**

Add to `scripts/lib/acfrGF.selftest.py` a case over Honolulu FY2025 asserting the measured figures (spec §3.1), in thousands:

```python
def test_honolulu_fy2025_general_fund():
    tree = run_extract('honolulu', HONOLULU_FY2025_PDF, mode='revenue')
    assert tree['total'] == 2_088_725_000      # units=1000 applied
    assert tree['children'][0]['label'].lower().startswith('taxes')
    assert tree['children'][0]['value'] == 1_842_801_000
    # `Miscellaneous:` is a GROUP on the revenue side with three children,
    # and `Other` is one of them -- the same two labels also appear on the
    # expenditure side under `Current:`. Parenting by label alone is the
    # failure this pins.
    misc = [c for c in tree['children'] if c['label'].lower().startswith('misc')][0]
    assert [g['label'] for g in misc['children']] == ['Recoveries', 'Interest', 'Other']

def test_honolulu_fy2025_expenditures():
    tree = run_extract('honolulu', HONOLULU_FY2025_PDF, mode='operating')
    assert tree['total'] == 1_519_815_000
    assert [c['label'] for c in tree['children']] == ['Current', 'Capital Outlay', 'Debt service']
    current, capital, debt = tree['children']
    assert current['value'] == 1_490_289_000
    assert capital['value'] == 10_731_000
    assert debt['value'] == 18_795_000
    # Five function names repeat under BOTH `Current:` and `Capital Outlay:`.
    assert 'General government' in [c['label'] for c in current['children']]
    assert 'General government' in [c['label'] for c in capital['children']]
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:acfr`
Expected: FAIL — no `honolulu` config

- [ ] **Step 3: Write `CONFIGS['honolulu']`, then derive the other three**

Honolulu, measured: `parents=('current', 'capital outlay', 'debt service')`, `root_leaves=()`, `units=1000`, `fy_end=('June', 30)`, revenue group `Miscellaneous:` closed by `revenue_group_members`.

For `hawaii`, `maui` and `kauai`: run `pdftotext -layout` on each statement page — **`-layout`, which preserves the leading whitespace `-table` flattens, is what reveals parent vs root-leaf** — and read off that county's own `parents`, `root_leaves`, total-row wording and caption units. Record the evidence per entry in a comment.

⚠⚠ **Read the caption block per entity and per year.** Honolulu prints *( Amounts in thousands )*. Another county twenty minutes away may print whole dollars — Boulder city and Boulder County differ exactly this way. A `units` error is invisible to the tie.

⚠ `statement_anchor` must require the words **"Governmental Funds"**. Honolulu's document holds 14 statements with similar titles, including combining statements and a budgetary schedule. Do not weaken `_EXCLUDE`.

- [ ] **Step 4: Run the whole corpus dry**

Run: `node scripts/testAcfrExtract.mjs` across all four entities, both modes, every fetched year.
Expected: every FY×mode either ties at **exactly $0** or is recorded in `KNOWN_DOCUMENT_GAPS` with its measured cause. **A gap is never written as $0.**

- [ ] **Step 5: Assert each filing's audit opinion**

`audit_grade` must be read from each document's own opinion, never assumed from
the family. Run the opinion check (`scripts/checkOpinionType.py`, the gate
`scripts/verifyCoKsOpinions.py` wraps) across all 38 filings.

⚠⚠ **The opinion gate has two known blind spots, both found in Alaska:** an
**inverted GAAP phrase** (all 10 North Slope filings) and **"In MY opinion"**
from a sole practitioner (8 Haines filings). A third: a **plural statement
title** ("STATEMENTS OF…") hid all 18 Haines reads. Read the phrasing on at
least one filing per county by eye before trusting the gate's verdict.

Expected: a recorded verdict per filing. A filing whose opinion is **not**
unmodified GAAP is loaded at the grade it honestly supports **and flagged** —
never silently upgraded, never held out.

- [ ] **Step 6: Run to verify the selftest passes**

Run: `npm run test:acfr`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/extractHiCounty.py scripts/lib/acfrGF.selftest.py
git commit -m "feat(hi): General Fund extractor, one config per county"
```

---

### Task 4: The seeder

**Files:**
- Create: `scripts/seedHiCounties.mjs`
- Test: `tests/hiCountySeed.test.mjs`

**Interfaces:**
- Consumes: `HI_COUNTIES`, `countyByKey` (Task 1).
- Produces: four rows in `treasury.municipalities`. Exports `seedPayloadFor(key): {name, state, entity_type, county_id, population, population_year, geoid, geoid_basis}` so the payload is testable without a database.

Idempotent: re-running updates rather than duplicating.

⚠ **Honolulu cannot take San Francisco's `census-pep-162-exact` basis.** It has no SUMLEV 162 geography — its only census geography *is* the county — so its `geoid` is the county FIPS under a basis value that says so. Name it honestly; it is a new value and the header comment must state why it exists.

- [ ] **Step 1: Write the failing test**

```js
it('types Honolulu as a parentless city and the rest as parentless counties', () => {
  expect(seedPayloadFor('honolulu')).toMatchObject({
    name: 'Honolulu', state: 'HI', entity_type: 'city', county_id: null,
    population: 998747, population_year: 2024, geoid: '15003',
  });
  expect(seedPayloadFor('hawaii')).toMatchObject({ name: 'Hawaii County', entity_type: 'county', county_id: null });
  expect(seedPayloadFor('kauai')).toMatchObject({ name: 'Kauai County', geoid: '15007' });
});

// `Hawaii County` and the existing `Hawaii` state node differ by one word.
it('never emits a payload colliding with the HI state node', () => {
  for (const c of HI_COUNTIES) {
    const p = seedPayloadFor(c.key);
    expect([p.name, p.entity_type]).not.toEqual(['Hawaii', 'state']);
  }
});

it('refuses to emit a payload for a non-government', () => {
  expect(() => seedPayloadFor('kalawao')).toThrow();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/hiCountySeed.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `scripts/seedHiCounties.mjs`**

⚠ **Before creating any entity, read Note 1 — the reporting-entity note — in that county's own ACFR and confirm what the document says it is.** Alaska nearly typed Yakutat `city` off its name and was saved by this. The name is not the evidence. Record each confirmation in the header.

Post-seed assertion: re-read the four rows and fail loudly if any `entity_type` differs from the payload — a wrong value mints a second government rather than mislabelling this one.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/hiCountySeed.test.mjs`
Expected: PASS

- [ ] **Step 5: Seed, then prove no fork**

```bash
node --env-file=.env scripts/seedHiCounties.mjs
npm run check:forks
```
Expected: 4 rows created; `check:forks` clean, with `Hawaii` and `Hawaii County` distinct.

- [ ] **Step 6: Commit**

```bash
git add scripts/seedHiCounties.mjs tests/hiCountySeed.test.mjs
git commit -m "feat(hi): seed the four Hawaii county governments"
```

---

### Task 5: The loader

**Files:**
- Create: `scripts/processHiCounties.js`
- Test: `tests/hiCountyLoad.test.mjs`

**Interfaces:**
- Consumes: `run` from `scripts/lib/acfrGfLoad.mjs`; `HI_COUNTIES`, `fysFor`, `countyByKey`, `documentUrlFor` (Task 1).
- Produces: 76 rows in `treasury.budgets` plus their categories and line items. Exports `runConfigFor(key): object` — the `run()` config — so it is assertable without a database.

⚠⚠ **Always pass `--entity`.** Running bare re-loads every county, and a re-load deletes and re-writes rows under **new `budgets.id`s**, staling the id-keyed frozen-figure registry.

- [ ] **Step 1: Write the failing test**

```js
it('cites the FAC permalink, never the URL that served the bytes', () => {
  const cfg = runConfigFor('honolulu');
  expect(cfg.baseUrl).toMatch(/^https:\/\/app\.fac\.gov\/dissemination\/report\/pdf\//);
  expect(cfg.baseUrl).not.toMatch(/X-Amz-|amazonaws/i);
});

it('sets the June-30 calendar on all four', () => {
  for (const c of HI_COUNTIES) {
    expect(runConfigFor(c.key)).toMatchObject({ fyEndMonthDay: '06-30', fiscalYearStartMonth: 7 });
  }
});

// A `units` error scales every figure on the page together, so the tie gate
// cannot see it. The per-capita ceiling is the only guard that can.
it('leaves the shared per-capita ceiling in place', () => {
  for (const c of HI_COUNTIES) expect(runConfigFor(c.key).perCapitaMax).toBeUndefined();
});

it('drives each county from its own extractor config', () => {
  expect(runConfigFor('maui')).toMatchObject({
    extractScript: 'scripts/extractHiCounty.py', extractArgs: ['--entity', 'maui'],
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/hiCountyLoad.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `scripts/processHiCounties.js`**

A thin driver over `run(cfg)`, modelled on `scripts/processAkBoroughs.js`, with `pdfDir: docs/HiCounties/<key>`, `datasetIdPrefix: <key>-acfr-gf`, `baseUrl: documentUrlFor(key, fy)`, `flattenThirdLevel` unset.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/hiCountyLoad.test.mjs`
Expected: PASS

- [ ] **Step 5: Dry-run, then load, one county at a time**

```bash
node --env-file=.env scripts/processHiCounties.js --entity honolulu --dry-run
node --env-file=.env scripts/processHiCounties.js --entity honolulu
```
Expected per county: every FY×mode ties at **exactly $0**; gaps reported, never written as $0. Repeat for `hawaii`, `maui`, `kauai`.

⚠ If an extractor fights a template, **stop and report** rather than grinding. Three loaded counties and one flagged gap beats a blown afternoon.

- [ ] **Step 6: Commit**

```bash
git add scripts/processHiCounties.js tests/hiCountyLoad.test.mjs
git commit -m "feat(hi): load four counties, FY2016-2025 General Fund"
```

---

### Task 6: Verification and the ceremony

**Files:**
- Create: `scripts/verifyHiCounties.mjs`

**Interfaces:**
- Consumes: the loaded rows; `HI_COUNTIES`, `fysFor`, `documentUrlFor` (Task 1).
- Produces: a pass/fail report. **Independent of the loader** — it re-derives from the PDFs, it does not re-run `acfrGfLoad`.

- [ ] **Step 1: Write the re-derivation**

From each PDF on disk, re-derive every FY×mode roll-up, every category subtotal and every leaf, and compare against the database. This is the Tucson/NY standard: a from-scratch, loader-independent re-derivation, not a re-run of the loader.

- [ ] **Step 2: Run it**

Run: `node --env-file=.env scripts/verifyHiCounties.mjs`
Expected: every row ties at exactly $0; row count equals 2 × filings loaded.

- [ ] **Step 3: Prove one `source_url` per entity actually resolves**

⚠⚠⚠ **No gate reads a `source_url`.** 253 Alaska rows shipped a link dead in 30 seconds with every check green. Fetch one back per entity and record the HTTP status in the PR body.

Expected: 4 × HTTP 200 on an `app.fac.gov/dissemination/report/pdf/...` URL. Any failure blocks the PR.

- [ ] **Step 4: Prove nothing else moved**

Diff the registry against its pre-load state: **0 existing entities changed, 0
lost**, and the register union equals the deficit **exactly** — the gate every
recent bulk load has run. A union that merely *covers* the deficit is a fail,
not a pass.

Expected: entity count rises by exactly 4; `treasury.budgets` rises by exactly
the number of FY×mode pairs loaded; no pre-existing row's `id` changed.

- [ ] **Step 5: Run the ceremony**

```bash
npm run verify:frozen     # expect 62587 / 60098de6 UNCHANGED
npm run check:forks       # expect clean
npm run build             # expect green -- tsc --noEmit proves nothing here
npx vitest run            # expect green
```

⚠ If `verify:frozen` fails, **do not** reach for `--set-baseline`; the script says it must never be used to make a failing check pass.

- [ ] **Step 6: Confirm the live API serves all four**

Run: `curl 'https://treasurytracker.empowered.vote/api/treasury/cities?state=HI&datasets=summary'`
Expected: four entities, Honolulu typed `city` and the rest `county`. No deploy should be needed — confirm nothing under `src/` changed.

- [ ] **Step 7: Open the PR**

Body states: rows loaded, every tie, the four `source_url` statuses, the frozen digest, `check:forks`, any `KNOWN_DOCUMENT_GAPS` with causes, and — per the Milledgeville rule — **that Hawaii County and Kaua'i stop at FY2024 because they have not filed FY2025, which is the publisher's gap and not TT's.**

```bash
gh pr create --title "feat(hi): Hawaii's four counties — a deep seed, 76 General Fund rows"
```

---

## Follow-ups (filed, not in this plan)

- **A.** The 38 county deep-link hunts (spec §7.3.3), 1.5–2.5 h, may be empty for the two 403 counties.
- **B.** The two-link `SourceChip` + migration + `e2e/` journey — only worth deploying once A has links to show.
- **C.** The `Hawaii / state` node's 42 rows carry `audit_grade='unknown'` and will read as less sourced than its own counties (spec §13.4).
- **D.** Hawaii has **no county boundaries** in `essentials.geofence_boundaries` — only the state — so the Civic Spaces map tether cannot resolve for these four.
