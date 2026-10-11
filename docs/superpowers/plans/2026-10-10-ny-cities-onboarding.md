# New York Cities Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load General Fund and Total Governmental revenue and expenditure series for all 61 New York cities other than NYC, FY1995–FY2021, from OSC's Local Government Financial Data.

**Architecture:** One pure library (`scripts/lib/nyOsc.mjs`) holds era detection, section mapping, label normalisation, the ARM-cited fund-prefix registry, fiscal-calendar derivation and the tree builder — all testable with no DB and no network. Thin scripts around it fetch, seed, load and verify. The loader writes two `fund_scope` values per city-year-dataset through `treasury_sync_city_budget`; the three assurance axes are stamped separately from registries.

**Tech Stack:** Node ESM (`.mjs`), vitest, `@supabase/supabase-js`, `treasury_sync_city_budget` / `treasury_ensure_municipality` RPCs.

**Spec:** `docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md`

## Global Constraints

- **Source zip lives at `docs/NY/city_all_years.zip`**, already on disk, sha256 `b210d3eaa1cce6f4d06920f28a54a8279b559e91f1b8887d15d88bb139c0c84e`, 32 members. The fetch script must **skip any file already present**.
- **NO SHEBANG** on any module a test imports — it breaks `npm test` on Windows and a test guards it.
- **Load window is FY1995–FY2021 inclusive** (27 years). All 61 cities filed every one of those years.
- **Sections loaded are `REVENUE` and `EXPENDITURE` only.** `GL`, `FBNP`, `BALANCE SHEET` and `CHANGE IN EQUITY` are excluded.
- **Axis values, verbatim:** `basis = 'actual'`, `audit_grade = 'self_reported_unaudited'`, `accounting_basis = 'unknown'`, `reporting_entity = 'unknown'`, `derivation = 'derived'`, `fund_scope ∈ {'general_fund','total_governmental'}`.
- **`treasury_sync_city_budget` keys on `fund_scope` + `basis`, not `data_source`.** Both parameters are mandatory on every call or a re-run duplicates every row.
- **Money parses as decimal, never integer.** `AMOUNT` carries values like `-.29` and `-1481.26`.
- **`fiscal_year = CALENDAR_YEAR`** — verified: `CALENDAR_YEAR` always equals the year of `PERIOD_END`.
- Run `npm test` (vitest) for all tests. Commit after every task.

## Review Focus

Five input classes the spec implies but which no task's happy path exercises. Each gets a pinned test in the task that owns the code.

1. **Negative amounts in revenue/expenditure** (~28 per year, e.g. Batavia `A64601` = `-.29`, Cortland `A4389` = `-1481.26`). They are genuine contra entries and must be **summed, not dropped**. A builder that filters "falsy or ≤ 0" silently shrinks totals. → Task 4.
2. **Zero amounts** — 955 in FY2021 revenue/expenditure alone. Dropping them is correct (they add nothing and bloat the tree) but must be deliberate, and dropping must never cascade into dropping negatives. → Task 4.
3. **An unrecognised fund prefix** (`CS` today; a new one if OSC changes the file). Must make that city-year's `total_governmental` `unknown` and **fail loudly**, never sum without it. → Task 3.
4. **The 2012/2013 era boundary** — a row from each era must produce the same normalised category label, or every icicle branch doubles at a $0 tie. → Task 2.
5. **A city-year missing from a year file** (FY2022+ filing lag; also guards against a future partial file). The loader must skip it cleanly rather than writing a short tree. → Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/nyOsc.mjs` | Pure: era detection, section mapping, label normalisation, fund registry, fiscal calendar, tree builder |
| `scripts/data/nyOscFundPrefixes.mjs` | The ARM-cited prefix → fund-type table |
| `scripts/data/nyOscCityEntities.mjs` | The 61-city roster, generated once from the archive |
| `scripts/fetchNyOsc.mjs` | Skip-if-present download of the archive |
| `scripts/seedNyCities.mjs` | `ensureMunicipality` for all 61 |
| `scripts/loadNyOscCities.mjs` | Build trees, write both scopes |
| `scripts/verifyNyOscCities.mjs` | The five post-load checks |
| `tests/nyOsc.test.mjs` | Library unit tests |
| `tests/nyOscFundPrefixes.test.mjs` | Registry completeness and exclusivity |

---

### Task 1: Archive reader and era detection

**Files:**
- Create: `scripts/lib/nyOsc.mjs`
- Test: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `ERA_OLD`, `ERA_NEW` (string constants `'1995-2012'`, `'2013-2026'`); `eraForHeader(header: string[]) -> '1995-2012' | '2013-2026'`; `sectionOf(row: object) -> 'REVENUE' | 'EXPENDITURE' | 'OTHER'`

- [ ] **Step 1: Write the failing test**

```js
// tests/nyOsc.test.mjs
import { describe, it, expect } from 'vitest';
import { ERA_OLD, ERA_NEW, eraForHeader, sectionOf } from '../scripts/lib/nyOsc.mjs';

const OLD_HEADER = ['CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'CLASS_DESCRIPTION',
  'COUNTY', 'FISCAL_YEAR_END', 'ACCOUNT_CODE', 'ACCOUNT_CODE_NARRATIVE',
  'FINANCIAL_STATEMENT', 'FINANCIAL_STATEMENT_SEGMENT', 'LEVEL_1_CATEGORY',
  'LEVEL_2_CATEGORY', 'OBJECT_OF_EXPENDITURE', 'AMOUNT', 'SNAPSHOT_DATE'];

const NEW_HEADER = ['CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'CLASS_DESCRIPTION',
  'COUNTY', 'PERIOD_START', 'PERIOD_END', 'ACCOUNT_CODE', 'ACCOUNT_CODE_NARRATIVE',
  'ACCOUNT_CODE_SECTION', 'LEVEL_1_CATEGORY', 'LEVEL_2_CATEGORY',
  'OBJECT_OF_EXPENDITURE', 'AMOUNT', 'SNAPSHOT_DATE'];

describe('era detection', () => {
  it('reads the era off the header, not the filename', () => {
    expect(eraForHeader(OLD_HEADER)).toBe(ERA_OLD);
    expect(eraForHeader(NEW_HEADER)).toBe(ERA_NEW);
  });

  it('refuses a header it does not recognise', () => {
    expect(() => eraForHeader(['CALENDAR_YEAR', 'AMOUNT']))
      .toThrow(/unrecognised NY OSC header/i);
  });
});

describe('sectionOf', () => {
  it('maps the new era straight through', () => {
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'REVENUE' })).toBe('REVENUE');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'EXPENDITURE' })).toBe('EXPENDITURE');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'GL' })).toBe('OTHER');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'FBNP' })).toBe('OTHER');
  });

  it('maps the old era off FINANCIAL_STATEMENT', () => {
    expect(sectionOf({ FINANCIAL_STATEMENT: 'STATEMENT OF REVENUES AND OTHER SOURCES' }))
      .toBe('REVENUE');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'STATEMENT OF EXPENDITURES AND OTHER USES' }))
      .toBe('EXPENDITURE');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'BALANCE SHEET' })).toBe('OTHER');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'CHANGE IN EQUITY' })).toBe('OTHER');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — cannot resolve `../scripts/lib/nyOsc.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/lib/nyOsc.mjs
// NO SHEBANG — a `#!` on any module a test imports breaks `npm test` on Windows.
/**
 * NY OSC Local Government Financial Data — pure readers.
 *
 * Spec: docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md
 *
 * ⚠⚠ THIS SOURCE IS TWO REPORTS. Files 1995-2012 and 2013-2026 do not share a
 * column set. The era is read off the HEADER, never off the filename, so a file
 * renamed or re-dated cannot silently pick the wrong parser.
 */

export const ERA_OLD = '1995-2012';
export const ERA_NEW = '2013-2026';

export function eraForHeader(header) {
  const cols = new Set(header);
  if (cols.has('ACCOUNT_CODE_SECTION') && cols.has('PERIOD_END')) return ERA_NEW;
  if (cols.has('FINANCIAL_STATEMENT') && cols.has('FISCAL_YEAR_END')) return ERA_OLD;
  throw new Error(`unrecognised NY OSC header: ${header.join(',')}`);
}

export function sectionOf(row) {
  const neu = row.ACCOUNT_CODE_SECTION;
  if (neu) return neu === 'REVENUE' || neu === 'EXPENDITURE' ? neu : 'OTHER';
  const fs = row.FINANCIAL_STATEMENT || '';
  if (fs.includes('REVENUES')) return 'REVENUE';
  if (fs.includes('EXPENDITURES')) return 'EXPENDITURE';
  return 'OTHER';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): read the OSC era off the header, not the filename"
```

---

### Task 2: Label normalisation across the era boundary

**Files:**
- Modify: `scripts/lib/nyOsc.mjs`
- Modify: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: Task 1's module
- Produces: `normLabel(s: string) -> string`

**Review Focus #4 lives here.**

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { normLabel } from '../scripts/lib/nyOsc.mjs';

describe('normLabel', () => {
  it('collapses the 2012/2013 casing change to one label', () => {
    // The whole reason this function exists: loaded raw, one city grows TWO
    // parallel icicle branches across the era boundary -- at an exact $0 tie,
    // because casing moves no money.
    expect(normLabel('GENERAL GOVERNMENT')).toBe(normLabel('General Government'));
    expect(normLabel('REAL PROPERTY TAXES AND ASSESSMENTS'))
      .toBe(normLabel('Real Property Taxes and Assessments'));
  });

  it('produces Title Case, matching the modern era as published', () => {
    expect(normLabel('GENERAL GOVERNMENT')).toBe('General Government');
    expect(normLabel('CULTURE AND RECREATION')).toBe('Culture and Recreation');
  });

  it('keeps small words lowercase except in first position', () => {
    expect(normLabel('USE AND SALE OF PROPERTY')).toBe('Use and Sale of Property');
    expect(normLabel('CHARGES TO OTHER GOVERNMENTS')).toBe('Charges to Other Governments');
  });

  it('trims and collapses interior whitespace', () => {
    expect(normLabel('  PUBLIC   SAFETY  ')).toBe('Public Safety');
  });

  it('is idempotent', () => {
    expect(normLabel(normLabel('STATE AID'))).toBe('State Aid');
  });

  it('passes an empty label through as empty', () => {
    expect(normLabel('')).toBe('');
    expect(normLabel(null)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — `normLabel is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/lib/nyOsc.mjs

/**
 * ⚠⚠ THE ERA BOUNDARY IS A LABEL-CASING TRAP.
 *
 * `LEVEL_1_CATEGORY` is `GENERAL GOVERNMENT` before 2013 and `General
 * Government` after. Loaded as published, every city grows two parallel icicle
 * branches across FY2012/FY2013 and every category appears twice -- while
 * tying at EXACTLY $0, because casing moves no money. Same family as NYC's
 * `Current Operations:` weld.
 *
 * Both eras normalise to the modern era's Title Case.
 */
const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on',
  'or', 'the', 'to', 'via', 'vs',
]);

export function normLabel(s) {
  if (!s) return '';
  const words = String(s).trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): collapse the 2013 label-casing split to one branch"
```

---

### Task 3: The ARM-cited fund-prefix registry

**Files:**
- Create: `scripts/data/nyOscFundPrefixes.mjs`
- Create: `tests/nyOscFundPrefixes.test.mjs`
- Modify: `scripts/lib/nyOsc.mjs`

**Interfaces:**
- Consumes: Task 1's module
- Produces: `NY_FUND_PREFIXES` (object: prefix → `{ type, name, citation }`); `GOVERNMENTAL_TYPES` (Set); `fundPrefixOf(accountCode: string) -> string`; `classifyPrefix(prefix: string) -> { type, name } | null`

**Review Focus #3 lives here.**

- [ ] **Step 1: Write the failing test**

```js
// tests/nyOscFundPrefixes.test.mjs
import { describe, it, expect } from 'vitest';
import { NY_FUND_PREFIXES, GOVERNMENTAL_TYPES } from '../scripts/data/nyOscFundPrefixes.mjs';
import { fundPrefixOf, classifyPrefix } from '../scripts/lib/nyOsc.mjs';

describe('fundPrefixOf', () => {
  it('takes the leading letters of the account code', () => {
    expect(fundPrefixOf('A1001')).toBe('A');
    expect(fundPrefixOf('EW2140')).toBe('EW');
    expect(fundPrefixOf('H5031')).toBe('H');
    expect(fundPrefixOf('A99509')).toBe('A');
  });

  it('handles the N-suffixed budget codes', () => {
    expect(fundPrefixOf('A2801N')).toBe('A');
  });

  it('returns empty for a code with no leading letter', () => {
    expect(fundPrefixOf('1001')).toBe('');
    expect(fundPrefixOf('')).toBe('');
  });
});

describe('the registry', () => {
  it('classifies the General Fund as governmental', () => {
    expect(NY_FUND_PREFIXES.A.type).toBe('general');
    expect(GOVERNMENTAL_TYPES.has(NY_FUND_PREFIXES.A.type)).toBe(true);
  });

  it('excludes every enterprise fund', () => {
    for (const p of ['EA', 'EE', 'EF', 'EH', 'EI', 'EL', 'EM', 'EP', 'ER', 'ES', 'ET', 'EW']) {
      expect(NY_FUND_PREFIXES[p].type, p).toBe('enterprise');
      expect(GOVERNMENTAL_TYPES.has(NY_FUND_PREFIXES[p].type), p).toBe(false);
    }
  });

  it('excludes internal service and self-insurance', () => {
    expect(NY_FUND_PREFIXES.M.type).toBe('internal_service');
    // MS rows say `Net Position`, not fund balance -- proprietary.
    expect(NY_FUND_PREFIXES.MS.type).toBe('internal_service');
    expect(GOVERNMENTAL_TYPES.has('internal_service')).toBe(false);
  });

  it('excludes every fiduciary fund', () => {
    for (const p of ['TA', 'TC', 'TE', 'TN', 'TX']) {
      expect(NY_FUND_PREFIXES[p].type, p).toBe('fiduciary');
    }
    expect(GOVERNMENTAL_TYPES.has('fiduciary')).toBe(false);
  });

  it('marks K and W as schedules, not funds', () => {
    expect(NY_FUND_PREFIXES.K.type).toBe('schedule');
    expect(NY_FUND_PREFIXES.W.type).toBe('schedule');
    expect(GOVERNMENTAL_TYPES.has('schedule')).toBe(false);
  });

  it('carries an ARM citation on every entry', () => {
    for (const [p, e] of Object.entries(NY_FUND_PREFIXES)) {
      expect(e.citation, `${p} has no citation`).toBeTruthy();
      expect(e.citation.length, `${p} citation is a placeholder`).toBeGreaterThan(12);
    }
  });

  it('does NOT claim the town- and county-only prefixes', () => {
    // B, D/DA/DB/DM, CN and the S_ family never occur for a city. Accepting
    // them would mean the file changed and nobody noticed.
    for (const p of ['B', 'D', 'DA', 'DB', 'DM', 'CN', 'SD', 'SF', 'SL', 'SP']) {
      expect(NY_FUND_PREFIXES[p], `${p} should not be registered for cities`).toBeUndefined();
    }
  });
});

describe('classifyPrefix', () => {
  it('returns null for an unknown prefix rather than guessing', () => {
    // CS is real and unresolved. The honest answer is null, which drives the
    // city-year to `unknown` total_governmental -- NOT a silent short sum.
    expect(classifyPrefix('CS')).toBeNull();
    expect(classifyPrefix('ZZ')).toBeNull();
  });

  it('classifies a known prefix', () => {
    expect(classifyPrefix('A')).toEqual({ type: 'general', name: 'General Fund' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOscFundPrefixes.test.mjs`
Expected: FAIL — cannot resolve `../scripts/data/nyOscFundPrefixes.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/data/nyOscFundPrefixes.mjs
// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * NY fund letter -> fund type, from OSC's Accounting and Reporting Manual
 * chapter 4, "Funds and Supplemental Schedules".
 *
 * ⚠⚠ EVERY ENTRY IS READ FROM THE ARM, never inferred from what the fund
 * spends on. `docs/NY/osc-accounting-and-reporting-manual-2021.pdf` is the
 * evidence of record; delete it and none of these claims has a basis.
 *
 * ⚠ Prefixes the ARM defines for TOWNS and COUNTIES only -- B, D/DA/DB/DM, CN
 * and the S_ special-district family -- are deliberately ABSENT. They do not
 * occur anywhere in the city archive. If one appears, the file changed, and
 * classifyPrefix() returning null is the alarm.
 *
 * ⚠ `CS` (512 lines FY1995-2021) is NOT YET RESOLVED and is deliberately
 * absent. See spec §5.4: an unclassifiable prefix makes that city-year's
 * total_governmental `unknown`, never a short sum.
 */

const ARM = 'OSC Accounting and Reporting Manual ch. 4, Funds and Supplemental Schedules';

export const NY_FUND_PREFIXES = Object.freeze({
  // ── Governmental ────────────────────────────────────────────────────────
  A:  { type: 'general', name: 'General Fund',
        citation: `${ARM}: "General Fund (A) — the principal operating fund of a local government."` },

  CB: { type: 'special_revenue', name: 'Housing Authority',
        citation: `${ARM}: "Miscellaneous Funds (C_) include Housing Authority (CB)…"` },
  CD: { type: 'special_revenue', name: 'Special Grant',
        citation: `${ARM}: "Special Grant Fund (CD) — accounts for federal and State grants…"` },
  CL: { type: 'special_revenue', name: 'Refuse and Garbage',
        citation: `${ARM}: "Miscellaneous Funds (C_) include … Refuse and Garbage (CL)"` },
  CM: { type: 'special_revenue', name: 'Miscellaneous',
        citation: `${ARM}: "Miscellaneous Funds (C_) include … Miscellaneous (CM)"` },
  CP: { type: 'special_revenue', name: 'Parking',
        citation: `${ARM}: "Miscellaneous Funds (C_) include … Parking (CP)"` },
  CR: { type: 'special_revenue', name: 'Recreation',
        citation: `${ARM}: "Miscellaneous Funds (C_) include … Recreation (CR)"` },
  CT: { type: 'special_revenue', name: 'Transportation',
        citation: `${ARM}: "Miscellaneous Funds (C_) include … Transportation (CT)"` },
  CU: { type: 'special_revenue', name: 'Urban Renewal',
        citation: `${ARM}: "Miscellaneous Funds (C_) include … Urban Renewal (CU)"` },
  FX: { type: 'special_revenue', name: 'Water',
        citation: `${ARM}: water fund, listed under Special Revenue Funds; "Water operations may also be accounted for using an enterprise fund."` },
  G:  { type: 'special_revenue', name: 'Sewer',
        citation: `${ARM}: sewer fund, listed under Special Revenue Funds; "Sewer operations may also be accounted for using an enterprise fund."` },
  L:  { type: 'special_revenue', name: 'Library',
        citation: `${ARM}: library fund, Education Law §259 — "all moneys received from taxes or other public sources for library purposes shall be kept in a separate fund."` },

  H:  { type: 'capital_projects', name: 'Capital Projects',
        citation: `${ARM}: "the capital projects fund (H)"` },
  V:  { type: 'debt_service', name: 'Debt Service',
        citation: `${ARM}: "A single debt service fund will be maintained to account for and report the payment of long-term debt."` },
  PN: { type: 'permanent', name: 'Permanent',
        citation: `${ARM}: "only earnings, not principal, may be used for purposes that benefit the local government or its residents."` },

  // ── Proprietary — EXCLUDED from total_governmental ───────────────────────
  EA: { type: 'enterprise', name: 'Airports',
        citation: `${ARM}: "Enterprise Funds (E_) include Airports (EA)…"` },
  EE: { type: 'enterprise', name: 'Electric Utilities',
        citation: `${ARM}: "Enterprise Funds (E_) include … Electric Utilities (EE)"` },
  EF: { type: 'enterprise', name: 'Health Related Facilities',
        citation: `${ARM}: "Enterprise Funds (E_) include … Health Related Facilities (EF)"` },
  EH: { type: 'enterprise', name: 'Hospitals',
        citation: `${ARM}: "Enterprise Funds (E_) include … Hospitals (EH)"` },
  EI: { type: 'enterprise', name: 'Infirmaries',
        citation: `${ARM}: "Enterprise Funds (E_) include … Infirmaries (EI)"` },
  EL: { type: 'enterprise', name: 'Refuse and Garbage',
        citation: `${ARM}: "Enterprise Funds (E_) include … Refuse and Garbage (EL)"` },
  EM: { type: 'enterprise', name: 'Miscellaneous',
        citation: `${ARM}: "Enterprise Funds (E_) include … Miscellaneous (EM)"` },
  EP: { type: 'enterprise', name: 'Parking',
        citation: `${ARM}: "Enterprise Funds (E_) include … Parking (EP)"` },
  ER: { type: 'enterprise', name: 'Recreation',
        citation: `${ARM}: "Enterprise Funds (E_) include … Recreation (ER)"` },
  ES: { type: 'enterprise', name: 'Sewer',
        citation: `${ARM}: "Enterprise Funds (E_)…"; sewer operations "may also be accounted for using an enterprise fund."` },
  ET: { type: 'enterprise', name: 'Transportation',
        citation: `${ARM}: "Enterprise Funds (E_) include … Transportation (ET)"` },
  EW: { type: 'enterprise', name: 'Water',
        citation: `${ARM}: "Enterprise Funds (E_)…"; water operations "may also be accounted for using an enterprise fund."` },

  M:  { type: 'internal_service', name: 'Internal Service',
        citation: `${ARM}: internal service fund — "revenues of the internal service fund and as expenditures/expenses of the reimbursing or insured fund."` },
  MS: { type: 'internal_service', name: 'Self-Insurance',
        citation: `${ARM}: "Self-Insurance funds account for insurance coverage when the governing body has decided to have a self-insurance program on an actuarial basis." Grouped with proprietary; its rows report Net Position, not fund balance.` },

  // ── Fiduciary — EXCLUDED ─────────────────────────────────────────────────
  TA: { type: 'fiduciary', name: 'Trust and Agency',
        citation: `${ARM}: "Fiduciary funds are provided to account for moneys received by the local government which must be held…"` },
  TC: { type: 'fiduciary', name: 'Trust and Agency',
        citation: `${ARM}: Fiduciary Funds` },
  TE: { type: 'fiduciary', name: 'Trust and Agency',
        citation: `${ARM}: Fiduciary Funds` },
  TN: { type: 'fiduciary', name: 'Trust and Agency',
        citation: `${ARM}: Fiduciary Funds` },
  TX: { type: 'fiduciary', name: 'Trust and Agency',
        citation: `${ARM}: Fiduciary Funds` },

  // ── Not funds at all — EXCLUDED ──────────────────────────────────────────
  K:  { type: 'schedule', name: 'Schedule of Non-Current Governmental Assets',
        citation: `${ARM}: "be accounted for and reported in the Schedule of Non-Current Governmental Assets."` },
  W:  { type: 'schedule', name: 'Schedule of Non-Current Governmental Liabilities',
        citation: `${ARM}: "reported in the Schedule of Non-Current Governmental Liabilities."` },
});

/** The fund types that make up `total_governmental`. */
export const GOVERNMENTAL_TYPES = Object.freeze(new Set([
  'general', 'special_revenue', 'capital_projects', 'debt_service', 'permanent',
]));
```

```js
// append to scripts/lib/nyOsc.mjs
import { NY_FUND_PREFIXES } from '../data/nyOscFundPrefixes.mjs';

/** The fund is the leading run of capitals on the account code. */
export function fundPrefixOf(accountCode) {
  const m = /^([A-Z]+)/.exec(String(accountCode || ''));
  return m ? m[1] : '';
}

/**
 * ⚠ Returns null for anything the ARM-backed registry does not cover. Null is
 * a CORRECT outcome, not a shortfall: the caller must drive that city-year's
 * total_governmental to `unknown`, never sum without the fund. Omitting a
 * governmental fund understates; including a proprietary one overstates.
 */
export function classifyPrefix(prefix) {
  const e = NY_FUND_PREFIXES[prefix];
  return e ? { type: e.type, name: e.name } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOscFundPrefixes.test.mjs`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/data/nyOscFundPrefixes.mjs scripts/lib/nyOsc.mjs tests/nyOscFundPrefixes.test.mjs
git commit -m "feat(ny): ARM-cited fund prefix registry; unknown prefixes refuse"
```

---

### Task 4: Amount parsing and the tree builder

**Files:**
- Modify: `scripts/lib/nyOsc.mjs`
- Modify: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces: `parseAmount(v: string) -> number`; `buildNyTree(rows: object[]) -> { tree: object[], total: number }`

**Review Focus #1 and #2 live here.**

Tree shape, matching what `_treasury_insert_tree` consumes:
`[{ n, a, c: [{ n, a, i: [{ d, a }] }] }]` — level 1 → level 2 → object of expenditure.

⚠ **`a` is `actual_amount` and `aa` is `approved_amount`.** This source has no
appropriations at all, so items carry `a` **only** and omit `aa`, leaving
`approved_amount` NULL. Writing `aa: 0` would assert an adopted budget of $0,
which is false — the adopted figure is unknown, not zero. The a/aa inversion
cost TT eight PRs; do not reintroduce it from the other direction.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { parseAmount, buildNyTree } from '../scripts/lib/nyOsc.mjs';

describe('parseAmount', () => {
  it('parses decimals — the archive really contains these', () => {
    // City of Batavia A64601 FY2021 is literally "-.29".
    expect(parseAmount('-.29')).toBeCloseTo(-0.29, 6);
    expect(parseAmount('-1481.26')).toBeCloseTo(-1481.26, 6);
    expect(parseAmount('61667390')).toBe(61667390);
  });

  it('treats blank and null as zero', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });

  it('refuses a non-numeric string rather than coercing it to zero', () => {
    expect(() => parseAmount('n/a')).toThrow(/non-numeric amount/i);
  });
});

describe('buildNyTree', () => {
  const row = (l1, l2, obj, amt) => ({
    LEVEL_1_CATEGORY: l1, LEVEL_2_CATEGORY: l2,
    OBJECT_OF_EXPENDITURE: obj, AMOUNT: amt,
  });

  it('nests level 1 -> level 2 -> object and totals each node', () => {
    const { tree, total } = buildNyTree([
      row('General Government', 'Administration', 'Personal Services', '100'),
      row('General Government', 'Administration', 'Contractual', '50'),
      row('General Government', 'Finance', 'Personal Services', '25'),
      row('Public Safety', 'Police', 'Personal Services', '200'),
    ]);
    expect(total).toBe(375);
    expect(tree).toHaveLength(2);
    const gg = tree.find((n) => n.n === 'General Government');
    expect(gg.a).toBe(175);
    expect(gg.c.find((c) => c.n === 'Administration').a).toBe(150);
    expect(gg.c.find((c) => c.n === 'Administration').i).toEqual([
      { d: 'Personal Services', a: 100 },
      { d: 'Contractual', a: 50 },
    ]);
  });

  it('KEEPS negative amounts — they are real contra entries', () => {
    // ~28 a year across the archive. A builder that filters `> 0` silently
    // shrinks every total that contains one.
    const { tree, total } = buildNyTree([
      row('State Aid', 'Public Safety', 'Federal Aid', '1000'),
      row('State Aid', 'Public Safety', 'Federal Aid Other Public Safety', '-1481.26'),
    ]);
    expect(total).toBeCloseTo(-481.26, 6);
    expect(tree[0].c[0].i).toHaveLength(2);
  });

  it('drops rows that are exactly zero, and only those', () => {
    const { tree, total } = buildNyTree([
      row('State Aid', 'Aid', 'Grant', '0'),
      row('State Aid', 'Aid', 'Other', '-5'),
    ]);
    expect(total).toBe(-5);
    expect(tree[0].c[0].i).toEqual([{ d: 'Other', a: -5 }]);
  });

  it('never emits `aa` — this source has no appropriations', () => {
    const { tree } = buildNyTree([row('A', 'B', 'C', '10')]);
    const item = tree[0].c[0].i[0];
    expect(item).toEqual({ d: 'C', a: 10 });
    expect('aa' in item).toBe(false);
  });

  it('normalises labels so both eras land on one branch', () => {
    const { tree } = buildNyTree([
      row('GENERAL GOVERNMENT', 'ADMINISTRATION', 'PERSONAL SERVICES', '10'),
      row('General Government', 'Administration', 'Personal Services', '10'),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('General Government');
    expect(tree[0].a).toBe(20);
  });

  it('buckets a blank object of expenditure rather than dropping the money', () => {
    const { tree, total } = buildNyTree([row('Sales and Use Tax', 'Sales Tax', '', '46685814')]);
    expect(total).toBe(46685814);
    expect(tree[0].c[0].i[0].d).toBe('Total');
  });

  it('returns an empty tree and zero total for no rows', () => {
    expect(buildNyTree([])).toEqual({ tree: [], total: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — `parseAmount is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/lib/nyOsc.mjs

/**
 * ⚠ DECIMAL, NOT INTEGER. The archive contains values like `-.29` (City of
 * Batavia A64601 FY2021) and `-1481.26` (Cortland A4389). An integer parse
 * throws or truncates on real rows.
 *
 * ⚠ A non-numeric amount THROWS. Coercing it to 0 would silently delete money.
 */
export function parseAmount(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (s === '') return 0;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`non-numeric amount: ${JSON.stringify(v)}`);
  return n;
}

/**
 * LEVEL_1_CATEGORY -> LEVEL_2_CATEGORY -> OBJECT_OF_EXPENDITURE.
 *
 * ⚠⚠ Items carry `a` (actual_amount) and NEVER `aa` (approved_amount). OSC
 * publishes closed-year actuals only; emitting `aa: 0` would assert an adopted
 * budget of zero, which is false. Absent means unknown. See
 * tests/budgetTreeItemContract.test.mjs for what the RPC does with each key.
 *
 * ⚠ Negative amounts are KEPT — they are genuine contra entries (refunds,
 * corrections). Only exact zeros are dropped.
 */
export function buildNyTree(rows) {
  const l1s = new Map();
  let total = 0;

  for (const r of rows) {
    const a = parseAmount(r.AMOUNT);
    if (a === 0) continue;

    const n1 = normLabel(r.LEVEL_1_CATEGORY) || 'Unclassified';
    const n2 = normLabel(r.LEVEL_2_CATEGORY) || 'Unclassified';
    const d = normLabel(r.OBJECT_OF_EXPENDITURE) || 'Total';

    if (!l1s.has(n1)) l1s.set(n1, new Map());
    const l2s = l1s.get(n1);
    if (!l2s.has(n2)) l2s.set(n2, []);
    l2s.get(n2).push({ d, a });
    total += a;
  }

  const tree = [...l1s.entries()].map(([n1, l2s]) => {
    const c = [...l2s.entries()].map(([n2, items]) => ({
      n: n2,
      a: items.reduce((s, i) => s + i.a, 0),
      i: items,
    }));
    return { n: n1, a: c.reduce((s, k) => s + k.a, 0), c };
  });

  return { tree, total };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 18 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): decimal amounts, 3-level tree, negatives kept, no aa"
```

---

### Task 5: Fiscal calendar, read per entity per year

**Files:**
- Modify: `scripts/lib/nyOsc.mjs`
- Modify: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–4
- Produces: `fiscalYearStartMonth(row: object) -> number` (1–12)

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { fiscalYearStartMonth } from '../scripts/lib/nyOsc.mjs';

describe('fiscalYearStartMonth', () => {
  it('reads PERIOD_START directly in the modern era', () => {
    expect(fiscalYearStartMonth({ PERIOD_START: '2024-01-01', PERIOD_END: '2024-12-31' })).toBe(1);
    expect(fiscalYearStartMonth({ PERIOD_START: '2023-07-01', PERIOD_END: '2024-06-30' })).toBe(7);
  });

  it('derives it from FISCAL_YEAR_END + 1 in the old era', () => {
    // Old files give MM/DD with no year at all.
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '12/31' })).toBe(1);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '06/30' })).toBe(7);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '03/31' })).toBe(4);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '07/31' })).toBe(8);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '05/31' })).toBe(6);
  });

  it('refuses a row that establishes no period', () => {
    expect(() => fiscalYearStartMonth({})).toThrow(/no fiscal period/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — `fiscalYearStartMonth is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/lib/nyOsc.mjs

/**
 * ⚠⚠ PER ENTITY, PER YEAR. NY cities do NOT share one calendar — FY2024 alone
 * shows five year-ends (Dec 31, Jun 30, Mar 31, Jul 31, May 31). Carrying one
 * month across the state is exactly the FYSM `NOT NULL DEFAULT 1` defect, and
 * a gate asserting every city shares a month would be asserting conformity to
 * a hardcode rather than measuring anything.
 */
export function fiscalYearStartMonth(row) {
  if (row.PERIOD_START) {
    const m = Number(String(row.PERIOD_START).slice(5, 7));
    if (m >= 1 && m <= 12) return m;
  }
  if (row.FISCAL_YEAR_END) {
    const endMonth = Number(String(row.FISCAL_YEAR_END).slice(0, 2));
    if (endMonth >= 1 && endMonth <= 12) return (endMonth % 12) + 1;
  }
  throw new Error(`no fiscal period on row: ${JSON.stringify(row).slice(0, 120)}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 21 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): fiscal start month read per entity per year, both eras"
```

---

### Task 6: Archive reader — CSV to classified rows

**Files:**
- Modify: `scripts/lib/nyOsc.mjs`
- Modify: `tests/nyOsc.test.mjs`
- Create: `scripts/fetchNyOsc.mjs`

**Interfaces:**
- Consumes: Tasks 1–5
- Produces: `ARCHIVE_PATH` (`'docs/NY/city_all_years.zip'`); `ARCHIVE_URL`; `readYear(zipPath: string, year: number) -> object[]` — rows with `REVENUE`/`EXPENDITURE` section only, each carrying `{ municipalCode, entityName, county, fiscalYear, fundPrefix, section, fiscalYearStartMonth, LEVEL_1_CATEGORY, LEVEL_2_CATEGORY, OBJECT_OF_EXPENDITURE, AMOUNT }`

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { existsSync } from 'node:fs';
import { ARCHIVE_PATH, readYear } from '../scripts/lib/nyOsc.mjs';

const haveArchive = existsSync(ARCHIVE_PATH);
const archiveIt = haveArchive ? it : it.skip;

describe('readYear (needs docs/NY/city_all_years.zip)', () => {
  archiveIt('reads a modern year and keeps only revenue and expenditure', () => {
    const rows = readYear(ARCHIVE_PATH, 2021);
    expect(rows.length).toBeGreaterThan(10000);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['REVENUE', 'EXPENDITURE']));
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(61);
    expect(rows.every((r) => r.fiscalYear === 2021)).toBe(true);
  });

  archiveIt('reads an old-era year with the same row shape', () => {
    const rows = readYear(ARCHIVE_PATH, 2010);
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(61);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['REVENUE', 'EXPENDITURE']));
    expect(rows.every((r) => r.fiscalYearStartMonth >= 1 && r.fiscalYearStartMonth <= 12)).toBe(true);
  });

  archiveIt('never returns a K or W schedule row', () => {
    for (const y of [2010, 2021]) {
      const bad = readYear(ARCHIVE_PATH, y).filter((r) => r.fundPrefix === 'K' || r.fundPrefix === 'W');
      expect(bad, `year ${y}`).toHaveLength(0);
    }
  });

  archiveIt('agrees with the measured era split on category casing', () => {
    // Review Focus #4, end to end: both eras normalise onto one label set.
    const l1 = (y) => new Set(readYear(ARCHIVE_PATH, y)
      .filter((r) => r.section === 'EXPENDITURE')
      .map((r) => normLabel(r.LEVEL_1_CATEGORY)));
    const old2012 = l1(2012);
    const new2013 = l1(2013);
    const shared = [...old2012].filter((x) => new2013.has(x));
    expect(shared.length).toBeGreaterThan(8);
    for (const s of shared) expect(s).toBe(normLabel(s));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — `readYear is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/lib/nyOsc.mjs
import { execFileSync } from 'node:child_process';

export const ARCHIVE_PATH = 'docs/NY/city_all_years.zip';
export const ARCHIVE_URL =
  'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/city_all_years.zip';

/** Minimal RFC4180 reader — the OSC files quote fields containing commas. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

/**
 * Pull one year's CSV out of the archive and return only the revenue and
 * expenditure rows, era-normalised.
 *
 * ⚠ `GL`/`FBNP` (modern) and `BALANCE SHEET`/`CHANGE IN EQUITY` (old) are
 * dropped here. In FY2024 they are 7,663 of 20,234 rows; sweeping them into a
 * revenue or expenditure tree double-counts badly. Dropping them here also
 * removes every K and W schedule row, which appear nowhere else.
 */
export function readYear(zipPath, year) {
  const member = `${year}_City.csv`;
  const text = execFileSync('python', ['-I', '-c',
    'import sys,zipfile;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode("utf-8-sig",errors="replace"))',
    zipPath, member,
  ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });

  const grid = parseCsv(text);
  const header = grid[0];
  eraForHeader(header); // throws on an unrecognised header
  const ix = Object.fromEntries(header.map((h, i) => [h, i]));
  const get = (r, k) => (ix[k] === undefined ? undefined : r[ix[k]]);

  const out = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    const raw = {
      ACCOUNT_CODE_SECTION: get(r, 'ACCOUNT_CODE_SECTION'),
      FINANCIAL_STATEMENT: get(r, 'FINANCIAL_STATEMENT'),
      PERIOD_START: get(r, 'PERIOD_START'),
      FISCAL_YEAR_END: get(r, 'FISCAL_YEAR_END'),
    };
    const section = sectionOf(raw);
    if (section === 'OTHER') continue;

    out.push({
      municipalCode: get(r, 'MUNICIPAL_CODE'),
      entityName: get(r, 'ENTITY_NAME'),
      county: get(r, 'COUNTY'),
      fiscalYear: Number(get(r, 'CALENDAR_YEAR')),
      fundPrefix: fundPrefixOf(get(r, 'ACCOUNT_CODE')),
      section,
      fiscalYearStartMonth: fiscalYearStartMonth(raw),
      LEVEL_1_CATEGORY: get(r, 'LEVEL_1_CATEGORY'),
      LEVEL_2_CATEGORY: get(r, 'LEVEL_2_CATEGORY'),
      OBJECT_OF_EXPENDITURE: get(r, 'OBJECT_OF_EXPENDITURE'),
      AMOUNT: get(r, 'AMOUNT'),
    });
  }
  return out;
}
```

```js
#!/usr/bin/env node
// scripts/fetchNyOsc.mjs
// This file is NOT imported by any test, so the shebang is safe here.
/**
 * Download the OSC city archive if it is not already on disk.
 *
 * ⚠ The whole 1995-2026 series is ONE 12.5 MB zip. There is no per-year
 * endpoint, so a present file is a complete file and re-downloading is pure
 * waste. The download form at financial-data-for-local-governments.cfm merely
 * 302s here; no POST, no session, no ViewState.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ARCHIVE_PATH, ARCHIVE_URL } from './lib/nyOsc.mjs';

if (existsSync(ARCHIVE_PATH)) {
  console.log(`present, skipping: ${ARCHIVE_PATH}`);
  process.exit(0);
}
mkdirSync(dirname(ARCHIVE_PATH), { recursive: true });
const res = await fetch(ARCHIVE_URL);
if (!res.ok) throw new Error(`OSC fetch failed: ${res.status} ${res.statusText}`);
const buf = Buffer.from(await res.arrayBuffer());
if (buf.subarray(0, 2).toString('latin1') !== 'PK') {
  throw new Error(`not a zip — first bytes ${buf.subarray(0, 8).toString('hex')}`);
}
writeFileSync(ARCHIVE_PATH, buf);
console.log(`wrote ${ARCHIVE_PATH} (${buf.length} bytes)`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 25 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs scripts/fetchNyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): archive reader keeps revenue and expenditure only"
```

---

### Task 7: Per-city-year scope aggregation

**Files:**
- Modify: `scripts/lib/nyOsc.mjs`
- Modify: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–6
- Produces: `aggregateCityYear(rows, { section, scope }) -> { tree, total, scope }` where `scope` in the return is `'general_fund'`, `'total_governmental'` or `'unknown'`

**Review Focus #3's consequence lives here.**

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { aggregateCityYear } from '../scripts/lib/nyOsc.mjs';

const R = (fundPrefix, l1, amt) => ({
  fundPrefix, section: 'EXPENDITURE',
  LEVEL_1_CATEGORY: l1, LEVEL_2_CATEGORY: 'Sub', OBJECT_OF_EXPENDITURE: 'Obj', AMOUNT: amt,
});

describe('aggregateCityYear', () => {
  it('general_fund takes the A fund alone', () => {
    const out = aggregateCityYear(
      [R('A', 'General Government', '100'), R('EW', 'Utilities', '900')],
      { section: 'EXPENDITURE', scope: 'general_fund' });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('total_governmental includes governmental funds and excludes proprietary', () => {
    const out = aggregateCityYear([
      R('A', 'General Government', '100'),
      R('H', 'Transportation', '50'),   // capital projects — governmental
      R('V', 'Debt Service', '25'),     // debt service    — governmental
      R('EW', 'Utilities', '900'),      // enterprise      — excluded
      R('MS', 'General Government', '7'), // self-insurance — excluded
      R('TA', 'General Government', '3'), // fiduciary      — excluded
    ], { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(175);
  });

  it('⚠ an unclassifiable prefix makes the scope unknown, NOT a short sum', () => {
    const out = aggregateCityYear([
      R('A', 'General Government', '100'),
      R('CS', 'General Government', '40'), // real, unresolved against the ARM
    ], { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['CS']);
  });

  it('an unclassifiable prefix does NOT disturb general_fund', () => {
    const out = aggregateCityYear([
      R('A', 'General Government', '100'),
      R('CS', 'General Government', '40'),
    ], { section: 'EXPENDITURE', scope: 'general_fund' });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('filters by section', () => {
    const rows = [R('A', 'General Government', '100'),
      { ...R('A', 'State Aid', '70'), section: 'REVENUE' }];
    expect(aggregateCityYear(rows, { section: 'REVENUE', scope: 'general_fund' }).total).toBe(70);
  });

  it('returns an empty result for a city-year with no matching rows', () => {
    const out = aggregateCityYear([], { section: 'REVENUE', scope: 'general_fund' });
    expect(out).toMatchObject({ total: 0, tree: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — `aggregateCityYear is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/lib/nyOsc.mjs
import { GOVERNMENTAL_TYPES } from '../data/nyOscFundPrefixes.mjs';

/**
 * Aggregate one city-year to one scope.
 *
 * ⚠⚠ UNKNOWN IS A CORRECT OUTCOME. If any revenue/expenditure row in the
 * city-year carries a prefix the ARM-backed registry cannot classify, the
 * `total_governmental` scope is reported as `unknown` rather than summed
 * without that fund. Omitting a governmental fund understates the total;
 * including a proprietary one overstates it. Both are wrong, and the
 * destructive direction is "declare two cities comparable".
 *
 * `general_fund` is unaffected: `A` is unambiguous.
 */
export function aggregateCityYear(rows, { section, scope }) {
  const inSection = rows.filter((r) => r.section === section);

  if (scope === 'general_fund') {
    const { tree, total } = buildNyTree(inSection.filter((r) => r.fundPrefix === 'A'));
    return { scope, tree, total, unknownPrefixes: [] };
  }

  const unknown = [...new Set(
    inSection.map((r) => r.fundPrefix).filter((p) => classifyPrefix(p) === null),
  )].sort();
  if (unknown.length) return { scope: 'unknown', tree: [], total: 0, unknownPrefixes: unknown };

  const govt = inSection.filter((r) => GOVERNMENTAL_TYPES.has(classifyPrefix(r.fundPrefix).type));
  const { tree, total } = buildNyTree(govt);
  return { scope: 'total_governmental', tree, total, unknownPrefixes: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 31 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): scope aggregation; an unknown prefix refuses the scope"
```

---

### Task 8: The 61-city roster and seeding

**Files:**
- Create: `scripts/data/nyOscCityEntities.mjs`
- Create: `scripts/seedNyCities.mjs`
- Modify: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–7
- Produces: `NY_CITY_ENTITIES` — array of `{ municipalCode, name, county }`, 61 long. `name` is the display name with `City of ` stripped (TT stores `Albany`, not `City of Albany`).

⚠ Generate the roster **once** from the archive and commit it as data, so the
loader's entity set is reviewable in a diff rather than recomputed per run.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { NY_CITY_ENTITIES } from '../scripts/data/nyOscCityEntities.mjs';

describe('the NY city roster', () => {
  it('has exactly 61 cities', () => {
    expect(NY_CITY_ENTITIES).toHaveLength(61);
  });

  it('does not contain New York City', () => {
    // NYC is loaded from its own ACFRs (PR #243) and is absent from this
    // source entirely — OSC files it as a separate `cityny` dataset.
    const names = NY_CITY_ENTITIES.map((e) => e.name.toLowerCase());
    expect(names).not.toContain('new york');
    expect(names.some((n) => n.includes('new york'))).toBe(false);
  });

  it('stores display names without the "City of " prefix', () => {
    expect(NY_CITY_ENTITIES.some((e) => e.name === 'Albany')).toBe(true);
    expect(NY_CITY_ENTITIES.every((e) => !e.name.startsWith('City of '))).toBe(true);
  });

  it('carries a unique OSC municipal code and a county for every city', () => {
    expect(new Set(NY_CITY_ENTITIES.map((e) => e.municipalCode)).size).toBe(61);
    expect(NY_CITY_ENTITIES.every((e) => /^\d{12}$/.test(e.municipalCode))).toBe(true);
    expect(NY_CITY_ENTITIES.every((e) => e.county && e.county.length > 1)).toBe(true);
  });

  archiveIt('matches the archive exactly for a mid-window year', () => {
    const fromArchive = new Set(readYear(ARCHIVE_PATH, 2010).map((r) => r.municipalCode));
    expect(fromArchive.size).toBe(61);
    for (const e of NY_CITY_ENTITIES) expect(fromArchive.has(e.municipalCode), e.name).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — cannot resolve `../scripts/data/nyOscCityEntities.mjs`

- [ ] **Step 3: Generate the roster, then write the seeder**

Generate the data file once:

```bash
node --input-type=module -e "
import { readYear, ARCHIVE_PATH } from './scripts/lib/nyOsc.mjs';
const seen = new Map();
for (const r of readYear(ARCHIVE_PATH, 2010)) {
  if (!seen.has(r.municipalCode)) {
    seen.set(r.municipalCode, {
      municipalCode: r.municipalCode,
      name: r.entityName.replace(/^City of /, ''),
      county: r.county,
    });
  }
}
const rows = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
const body = rows.map((e) =>
  \`  { municipalCode: '\${e.municipalCode}', name: '\${e.name.replace(/'/g, \"\\\\'\")}', county: '\${e.county.replace(/'/g, \"\\\\'\")}' },\`
).join('\n');
console.log(\`// scripts/data/nyOscCityEntities.mjs
// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * The 61 New York cities other than NYC, as OSC's FY2010 city file lists them.
 *
 * ⚠ NYC is ABSENT and must stay absent — it is loaded from its own ACFRs
 * (PR #243) and OSC files it as a separate \\\`cityny\\\` dataset.
 *
 * ⚠ \\\`municipalCode\\\` is OSC's own stable id and is the source_entity_key.
 * Match on it, never on the display name.
 */
export const NY_CITY_ENTITIES = Object.freeze([
\${body}
]);\`);
" > scripts/data/nyOscCityEntities.mjs
```

Then the seeder:

```js
#!/usr/bin/env node
// scripts/seedNyCities.mjs
import { createClient } from '@supabase/supabase-js';
import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

let created = 0;
for (const e of NY_CITY_ENTITIES) {
  const id = await ensureMunicipality(db, {
    name: e.name,
    state: 'NY',
    entityType: 'city',
    population: 0, // backfilled from Census PEP separately; never from this source
    source: 'NY_OSC',
    sourceEntityKey: e.municipalCode,
  });
  if (!id) throw new Error(`ensureMunicipality returned no id for ${e.name}`);
  created++;
}
console.log(`ensured ${created} NY cities`);
if (created !== 61) {
  console.error(`REFUSING: expected 61, ensured ${created}`);
  process.exit(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: PASS, 36 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/data/nyOscCityEntities.mjs scripts/seedNyCities.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): 61-city roster keyed on OSC municipal code, and seeder"
```

---

### Task 9: Registry entries for the axes

**Files:**
- Modify: `scripts/data/fundScopeRegistry.mjs`
- Modify: `scripts/data/basisRegistry.mjs`
- Modify: `scripts/data/auditGradeRegistry.mjs`
- Modify: `scripts/lib/nyOsc.mjs`
- Modify: `tests/nyOsc.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–8
- Produces: `SOURCE_PREFIX` = `'New York OSC Annual Financial Report'`; `sourceNameFor(datasetType: string, fiscalYear: number, scope: string) -> string`

⚠ Registry `match` patterns are **anchored per string**. A loose pattern claims
rows no reconciliation covers — that trap cost SCOPE-01 a whole task.

⚠ **No `accounting_basis` entry is created.** Per spec §6.1, the ARM directs
modified accrual but no audit establishes that any city achieved GAAP;
`unknown` is the honest value and is the default when no entry matches.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOsc.test.mjs
import { SOURCE_PREFIX, sourceNameFor } from '../scripts/lib/nyOsc.mjs';
import { classify } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';

describe('source naming and registry coverage', () => {
  it('names the source distinctly per scope', () => {
    const gf = sourceNameFor('operating', 2021, 'general_fund');
    const tg = sourceNameFor('operating', 2021, 'total_governmental');
    expect(gf).toContain(SOURCE_PREFIX);
    expect(gf).not.toBe(tg);
  });

  it('classifies both scopes from the registry', () => {
    expect(classify(sourceNameFor('operating', 2021, 'general_fund'), FUND_SCOPE_REGISTRY))
      .toBe('general_fund');
    expect(classify(sourceNameFor('revenue', 2005, 'total_governmental'), FUND_SCOPE_REGISTRY))
      .toBe('total_governmental');
  });

  it('does NOT claim an accounting basis', () => {
    // Spec §6.1: the ARM directs modified accrual, but no audit establishes
    // that any city achieved GAAP. Asserting it would convert an instruction
    // into an outcome across 61 cities at once.
    const hit = ACCOUNTING_BASIS_REGISTRY.filter((e) =>
      e.match.test(sourceNameFor('operating', 2021, 'general_fund')));
    expect(hit).toHaveLength(0);
  });

  it('does not claim any source outside NY OSC', () => {
    const foreign = ['CA State Controller - Expenditures',
      'Pennsylvania DCED Municipal Annual Audit and Financial Report — Revenues (FY2023 actual)'];
    for (const f of foreign) {
      for (const e of FUND_SCOPE_REGISTRY.filter((x) => x.id.startsWith('ny-osc'))) {
        expect(e.match.test(f), `${e.id} claims ${f}`).toBe(false);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOsc.test.mjs`
Expected: FAIL — `SOURCE_PREFIX is not exported`

- [ ] **Step 3: Write minimal implementation**

```js
// append to scripts/lib/nyOsc.mjs
export const SOURCE_PREFIX = 'New York OSC Annual Financial Report';
export const SOURCE_URL =
  'https://www.osc.ny.gov/local-government/data';

const SCOPE_FACE = {
  general_fund: 'General Fund',
  total_governmental: 'Total Governmental',
};

export function sourceNameFor(datasetType, fiscalYear, scope) {
  const face = datasetType === 'revenue' ? 'Revenues' : 'Expenditures';
  return `${SOURCE_PREFIX} — ${face}, ${SCOPE_FACE[scope]} (FY${fiscalYear} actual, self-reported)`;
}
```

```js
// add to the FUND_SCOPE_REGISTRY array in scripts/data/fundScopeRegistry.mjs
  {
    id: 'ny-osc-city-general-fund',
    match: /^New York OSC Annual Financial Report — (Revenues|Expenditures), General Fund \(FY\d{4} actual, self-reported\)$/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'OSC Accounting and Reporting Manual ch. 4 (docs/NY/osc-accounting-and-reporting-manual-2021.pdf); '
              + 'spec docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md §5.2',
      figures: 'The scope is the `A` account-code prefix alone. ARM ch. 4: "General Fund (A) — the '
             + 'principal operating fund of a local government. It includes all financial resources not '
             + 'accounted for and reported in another fund." All 61 cities carry an A fund with both '
             + 'revenue and expenditure in every loaded year (measured on FY2021). Corroborated against '
             + "an independent publisher: City of Albany FY2024 A1120 sales-tax distribution reads "
             + '$46,685,814 in OSC and $46,686 thousand in Albany\'s own Q4 2024 quarterly report.',
    },
  },
  {
    id: 'ny-osc-city-total-governmental',
    match: /^New York OSC Annual Financial Report — (Revenues|Expenditures), Total Governmental \(FY\d{4} actual, self-reported\)$/,
    scope: SCOPE.TOTAL_GOVERNMENTAL,
    evidence: {
      document: 'OSC Accounting and Reporting Manual ch. 4 (docs/NY/osc-accounting-and-reporting-manual-2021.pdf); '
              + 'spec §5.3; prefix table scripts/data/nyOscFundPrefixes.mjs',
      figures: 'Governmental = general (A) + special revenue (CB CD CL CM CP CR CT CU FX G L) + capital '
             + 'projects (H) + debt service (V) + permanent (PN). EXCLUDED on the ARM\'s own grouping: '
             + 'Enterprise E_ ("Enterprise Funds (E_) include Airports (EA), Electric Utilities (EE)…"), '
             + 'internal service M, Self-Insurance MS (its rows report Net Position, not fund balance), '
             + 'and fiduciary T_. K and W are not funds but the Schedules of Non-Current Governmental '
             + 'Assets/Liabilities and appear only in balance-sheet rows. Across FY1995-2021 this splits '
             + '392,234 revenue/expenditure lines into 368,870 governmental and 23,364 excluded. A '
             + 'city-year containing an unclassifiable prefix is written `unknown`, never summed short.',
    },
  },
```

```js
// add to the BASIS_REGISTRY array in scripts/data/basisRegistry.mjs
  {
    id: 'ny-osc-city',
    match: /^New York OSC Annual Financial Report — (Revenues|Expenditures), (General Fund|Total Governmental) \(FY\d{4} actual, self-reported\)$/,
    value: BASIS.ACTUAL,
    evidence: {
      document: 'OSC Local Government Financial Data, city archive (docs/NY/city_all_years.zip); '
              + 'spec docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md §6',
      figures: 'The AFR reports a closed fiscal period, not an appropriation: every row carries '
             + 'PERIOD_START/PERIOD_END (or FISCAL_YEAR_END pre-2013) bounding a completed year, and '
             + 'CALENDAR_YEAR always equals the year of PERIOD_END. The separate `N`-suffixed estimated '
             + 'codes (A2801N "Est Rev - Interfund Revenues") are the budgetary series and are NOT loaded.',
    },
  },
```

```js
// add to the AUDIT_GRADE_REGISTRY array in scripts/data/auditGradeRegistry.mjs
  {
    id: 'ny-osc-city',
    match: /^New York OSC Annual Financial Report — (Revenues|Expenditures), (General Fund|Total Governmental) \(FY\d{4} actual, self-reported\)$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: 'OSC Annual Financial Report filing requirements; spec §6',
      figures: 'The AFR is filed BY the local government under GML Article 3. The dataset carries no '
             + 'audit flag, no opinion and no auditor, and OSC\'s AFR page asserts no audit status. '
             + 'This is assurance, not measurement: accounting_basis stays `unknown` (spec §6.1), '
             + 'because the ARM directing modified accrual is an instruction, not an outcome.',
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOsc.test.mjs tests/budgetAxesRegistry.test.mjs tests/auditGradeRegistry.test.mjs`
Expected: PASS — the new tests plus the existing registry suites still green

- [ ] **Step 5: Commit**

```bash
git add scripts/data/fundScopeRegistry.mjs scripts/data/basisRegistry.mjs \
        scripts/data/auditGradeRegistry.mjs scripts/lib/nyOsc.mjs tests/nyOsc.test.mjs
git commit -m "feat(ny): axis registry entries, each carrying its ARM citation"
```

---

### Task 10: The loader

**Files:**
- Create: `scripts/loadNyOscCities.mjs`

**Interfaces:**
- Consumes: Tasks 1–9
- Produces: a CLI — `node scripts/loadNyOscCities.mjs [--from 1995] [--to 2021] [--dry-run]`

**Review Focus #5 lives here.**

- [ ] **Step 1: Write the loader**

```js
#!/usr/bin/env node
// scripts/loadNyOscCities.mjs
/**
 * Load the 61 non-NYC New York cities from OSC's archive.
 *
 * Spec: docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md
 *
 * ⚠⚠ `treasury_sync_city_budget` KEYS ON fund_scope + basis, NOT data_source.
 * This load writes TWO scopes per city-year-dataset, so omitting either
 * parameter makes a re-run DUPLICATE every row instead of updating it.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import {
  ARCHIVE_PATH, readYear, aggregateCityYear, sourceNameFor, SOURCE_URL,
} from './lib/nyOsc.mjs';
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

const BASIS_VALUE = 'actual';
const DERIVATION = 'derived';
const SCOPES = ['general_fund', 'total_governmental'];
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '1995' },
    to: { type: 'string', default: '2021' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const FROM = Number(values.from);
const TO = Number(values.to);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: munis, error: muniErr } = await db
  .from('municipalities').select('id,name,source_entity_key')
  .eq('state', 'NY').eq('entity_type', 'city');
if (muniErr) throw new Error(`municipality lookup failed: ${muniErr.message}`);
const idByCode = new Map(munis.filter((m) => m.source_entity_key).map((m) => [m.source_entity_key, m.id]));

let written = 0, skippedMissing = 0, unknownScope = 0;

for (let fy = FROM; fy <= TO; fy++) {
  const rows = readYear(ARCHIVE_PATH, fy);
  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
    byCode.get(r.municipalCode).push(r);
  }

  for (const entity of NY_CITY_ENTITIES) {
    const cityRows = byCode.get(entity.municipalCode);
    // ⚠ A city absent from this year's file is SKIPPED, never written short.
    // FY1995-2021 should never hit this; FY2022+ will, from filing lag.
    if (!cityRows || cityRows.length === 0) { skippedMissing++; continue; }

    const municipalityId = idByCode.get(entity.municipalCode);
    if (!municipalityId) throw new Error(`no municipality for ${entity.name} (${entity.municipalCode}) — run seedNyCities.mjs first`);

    // ⚠ PER ENTITY, PER YEAR. Five distinct calendars among NY cities.
    const fysm = cityRows[0].fiscalYearStartMonth;

    for (const { datasetType, section } of DATASETS) {
      for (const scope of SCOPES) {
        const agg = aggregateCityYear(cityRows, { section, scope });
        if (agg.scope === 'unknown') {
          unknownScope++;
          console.log(`  UNKNOWN ${entity.name} FY${fy} ${datasetType} ${scope} — unclassified prefixes: ${agg.unknownPrefixes.join(',')}`);
          continue;
        }
        if (agg.tree.length === 0) continue;
        if (values['dry-run']) { written++; continue; }

        const { data, error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: fy,
          p_dataset_type: datasetType,
          p_total: agg.total,
          p_tree: agg.tree,
          p_row_count: agg.tree.length,
          p_data_source_name: sourceNameFor(datasetType, fy, scope),
          p_source_url: SOURCE_URL,
          p_source_date: new Date().toISOString().slice(0, 10),
          p_fiscal_year_start_month: fysm,
          p_fund_scope: scope,          // ⚠ part of the RPC's key
          p_basis: BASIS_VALUE,         // ⚠ part of the RPC's key
          p_derivation: DERIVATION,
        });
        // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
        // error. Counting attempts is not counting writes.
        if (error) throw new Error(`RPC transport error (${entity.name} FY${fy} ${datasetType} ${scope}): ${error.message}`);
        if (data?.error) throw new Error(`RPC refused (${entity.name} FY${fy} ${datasetType} ${scope}): ${data.error}`);
        if (data?.status !== 'success' || !data?.budget_id) {
          throw new Error(`RPC returned no success (${entity.name} FY${fy} ${datasetType} ${scope}): ${JSON.stringify(data)}`);
        }
        written++;
      }
    }
  }
  console.log(`FY${fy}: ${written} rows so far`);
}

console.log(`\nWrote ${written} budget rows (${skippedMissing} city-years absent from the file, ${unknownScope} scopes left unknown).`);
if (written === 0) { console.error('REFUSING: no rows were actually written.'); process.exit(1); }
console.log('Now run:  node scripts/verifyNyOscCities.mjs');
console.log('     then npm run verify:frozen');
console.log('     then npm run check:forks');
```

- [ ] **Step 2: Dry-run it**

Run: `node scripts/loadNyOscCities.mjs --from 2021 --to 2021 --dry-run`
Expected: reports ~244 rows (61 cities × 2 datasets × 2 scopes), 0 skipped, and lists any unknown scopes

- [ ] **Step 3: Seed, then load one year for real**

```bash
node scripts/seedNyCities.mjs
node scripts/loadNyOscCities.mjs --from 2021 --to 2021
```
Expected: `Wrote 244 budget rows`

- [ ] **Step 4: Load the full window**

Run: `node scripts/loadNyOscCities.mjs --from 1995 --to 2021`
Expected: up to 6,588 rows, minus any left `unknown`

- [ ] **Step 5: Commit**

```bash
git add scripts/loadNyOscCities.mjs
git commit -m "feat(ny): load 61 cities, FY1995-2021, both fund scopes"
```

---

### Task 11: Post-load verification

**Files:**
- Create: `scripts/verifyNyOscCities.mjs`

**Interfaces:**
- Consumes: Tasks 1–10
- Produces: a CLI that exits non-zero on any failed check

⚠⚠ **The `$0` tie is NOT one of these checks and must never be added as one.**
OSC publishes no total row, so TT's total is `Σ items` by construction — the
tie is true automatically and proves nothing. That is the Austin/Travis finding.
Check 5 is the only thing here that tests the figures against the world.

- [ ] **Step 1: Write the verifier**

```js
#!/usr/bin/env node
// scripts/verifyNyOscCities.mjs
import { createClient } from '@supabase/supabase-js';
import { ARCHIVE_PATH, readYear, aggregateCityYear, SOURCE_PREFIX } from './lib/nyOsc.mjs';
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(url, key, { auth: { persistSession: false } });
let failures = 0;
const fail = (m) => { console.error(`FAIL ${m}`); failures++; };

// ⚠ Paged reads need a total order and a server-side filter — broken five
// times in this repo. Assert distinct ids equal the row count.
async function allBudgets() {
  const out = []; const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('budgets')
      .select('id,municipality_id,fiscal_year,dataset_type,total,fund_scope,basis,data_source,fiscal_year_start_month')
      .like('data_source', `${SOURCE_PREFIX}%`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  if (new Set(out.map((r) => r.id)).size !== out.length) {
    throw new Error('paged read returned duplicate ids — the page order is not total');
  }
  return out;
}

const rows = await allBudgets();
console.log(`CHECK 0: ${rows.length} NY OSC budget rows`);

// CHECK 1 — completeness
{
  const byKey = new Set(rows.map((r) => `${r.municipality_id}|${r.fiscal_year}|${r.dataset_type}|${r.fund_scope}`));
  const { data: munis } = await db.from('municipalities')
    .select('id,source_entity_key').eq('state', 'NY').eq('entity_type', 'city');
  const idByCode = new Map(munis.filter((m) => m.source_entity_key).map((m) => [m.source_entity_key, m.id]));
  let missing = 0;
  for (const e of NY_CITY_ENTITIES) for (let fy = 1995; fy <= 2021; fy++)
    for (const dt of ['operating', 'revenue']) for (const sc of ['general_fund', 'total_governmental']) {
      if (!byKey.has(`${idByCode.get(e.municipalCode)}|${fy}|${dt}|${sc}`)) missing++;
    }
  console.log(`CHECK 1: ${missing} of 6588 expected (city, year, dataset, scope) combinations missing`);
  if (missing > 0) fail(`CHECK 1 — ${missing} combinations absent`);
}

// CHECK 2 — axis stamping
{
  const bad = rows.filter((r) => r.basis !== 'actual'
    || !['general_fund', 'total_governmental'].includes(r.fund_scope));
  if (bad.length) fail(`CHECK 2 — ${bad.length} rows carry a wrong basis or fund_scope`);
  else console.log('CHECK 2: every row is basis=actual with a legal fund_scope');
}

// CHECK 3 — general_fund never exceeds total_governmental
{
  const byCell = new Map();
  for (const r of rows) {
    const k = `${r.municipality_id}|${r.fiscal_year}|${r.dataset_type}`;
    if (!byCell.has(k)) byCell.set(k, {});
    byCell.get(k)[r.fund_scope] = Number(r.total);
  }
  let bad = 0;
  for (const [k, v] of byCell) {
    if (v.general_fund !== undefined && v.total_governmental !== undefined
        && v.general_fund > v.total_governmental + 0.5) { bad++; console.error(`  ${k}: GF ${v.general_fund} > TG ${v.total_governmental}`); }
  }
  if (bad) fail(`CHECK 3 — ${bad} cells where General Fund exceeds Total Governmental`);
  else console.log('CHECK 3: general_fund <= total_governmental everywhere');
}

// CHECK 4 — fiscal calendars are per entity and internally consistent
// ⚠ NOT "all cities share a month". That would assert conformity to a
// hardcode, which is the FYSM defect, not a test for it.
{
  const months = new Map();
  for (const r of rows) {
    if (!months.has(r.municipality_id)) months.set(r.municipality_id, new Set());
    months.get(r.municipality_id).add(r.fiscal_year_start_month);
  }
  const inconsistent = [...months.entries()].filter(([, s]) => s.size > 1);
  const dist = {};
  for (const [, s] of months) for (const m of s) dist[m] = (dist[m] || 0) + 1;
  console.log(`CHECK 4: fiscal start month distribution across cities: ${JSON.stringify(dist)}`);
  if (inconsistent.length) fail(`CHECK 4 — ${inconsistent.length} cities change fiscal start month mid-series`);
}

// CHECK 5 — THE ONLY CHECK THAT TESTS THE FIGURES AGAINST THE WORLD.
// Re-derive each stored total from the archive with an independent pass.
{
  let bad = 0, checked = 0;
  for (const fy of [1998, 2005, 2012, 2013, 2021]) {
    const archive = readYear(ARCHIVE_PATH, fy);
    const byCode = new Map();
    for (const r of archive) {
      if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
      byCode.get(r.municipalCode).push(r);
    }
    const { data: munis } = await db.from('municipalities')
      .select('id,source_entity_key').eq('state', 'NY').eq('entity_type', 'city');
    const codeById = new Map(munis.map((m) => [m.id, m.source_entity_key]));
    for (const r of rows.filter((x) => x.fiscal_year === fy)) {
      const cityRows = byCode.get(codeById.get(r.municipality_id));
      if (!cityRows) continue;
      const section = r.dataset_type === 'revenue' ? 'REVENUE' : 'EXPENDITURE';
      const agg = aggregateCityYear(cityRows, { section, scope: r.fund_scope });
      checked++;
      if (Math.abs(agg.total - Number(r.total)) > 0.5) {
        bad++; console.error(`  FY${fy} ${r.dataset_type} ${r.fund_scope}: db ${r.total} vs archive ${agg.total}`);
      }
    }
  }
  console.log(`CHECK 5: re-derived ${checked} stored totals from the archive, ${bad} mismatched`);
  if (bad) fail(`CHECK 5 — ${bad} totals do not re-derive`);
}

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1); }
console.log('\nAll checks passed.');
console.log('⚠ These checks do NOT establish the figures are right — only that TT read OSC faithfully.');
console.log('⚠ The ACFR reconciliation (Task 12) is what tests OSC itself.');
```

- [ ] **Step 2: Run it**

Run: `node scripts/verifyNyOscCities.mjs`
Expected: CHECK 0–5 all pass; CHECK 4 prints a distribution with several distinct months, not one

- [ ] **Step 3: Commit**

```bash
git add scripts/verifyNyOscCities.mjs
git commit -m "test(ny): five post-load checks; the $0 tie is deliberately not one"
```

---

### Task 12: ACFR reconciliation — the only independent oracle

**Files:**
- Create: `docs/superpowers/plans/NY-CITIES-RECON.md`

⚠ Tasks 1–11 prove TT read OSC faithfully. **Nothing so far tests whether OSC
is right.** Spec §10 requires reconciliation against the cities' own audited
statements, on a sample spanning both eras and several fiscal calendars.

- [ ] **Step 1: Pick the sample**

Five cities, chosen to span the axes that could break:

| City | Why |
|---|---|
| Albany | Dec 31 calendar; the Q4-report corroboration already exists |
| Yonkers | Jun 30; one of the largest, so an error is most visible |
| Buffalo | Jun 30; largest non-NYC city |
| Watertown | Mar 31 — the rarest calendar in the archive |
| Batavia | carries the negative-amount rows that Review Focus #1 covers |

For each: **one old-era year (≤2012) and one modern-era year (≥2013).**

- [ ] **Step 2: For each city-year, record the comparison**

Find the city's ACFR for that year, read its General Fund statement of
revenues, expenditures and changes in fund balance, and record:

```markdown
### <City> FY<year> (<era>)

* ACFR: <url>, page <n>, "Total revenues" / "Total expenditures"
* ACFR General Fund revenues:      $X
* TT general_fund revenue total:   $Y
* Difference:                      $Z  (<pct>%)
* Explanation if nonzero:          <e.g. ACFR consolidates a fund OSC reports separately>
```

⚠ A difference is **not automatically a defect**. OSC's uniform chart of
accounts groups differently from a city's own presentation — Albany's own
categories already differ from OSC's while `A1120` matches to the dollar.
Record the explanation; do not silently adjust TT to match.

⚠⚠ **The Milledgeville rule applies.** If a figure is verified and looks
outlandish, LOAD it and FLAG it. Never hide or edit a verified figure for
looking wrong.

- [ ] **Step 3: Write the conclusion**

State plainly, for the reader: across N city-years, M reconciled within
tolerance and K did not, with the reason for each K. If any K is unexplained,
**say so and do not claim the load is verified.**

- [ ] **Step 4: Commit**

```bash
git add -f docs/superpowers/plans/NY-CITIES-RECON.md
git commit -m "docs(ny): ACFR reconciliation across both eras and five calendars"
```

---

### Task 13: Stamp the assurance axes and register the milestone

**Files:** none created — existing tooling

- [ ] **Step 1: Stamp**

```bash
node scripts/stampAuditGrade.mjs
node scripts/stampBudgetAxes.mjs
node scripts/verifyAxisStamps.mjs
```
Expected: every NY OSC row carries `audit_grade = self_reported_unaudited`,
`accounting_basis = unknown`, `reporting_entity = unknown`

- [ ] **Step 2: Frozen-figure invariant and fork check**

```bash
npm run verify:frozen
npm run check:forks
```
⚠ A publisher rename forking a city is exactly what `check:forks` catches, and
this load introduces 61 new names at once.

- [ ] **Step 3: Full suite and build**

```bash
npm test
npm run build
```
⚠⚠ `npx tsc --noEmit` CHECKS NOTHING here — the root tsconfig has `files: []`.
Use `npm run build`. It has gone red while `tsc --noEmit` was green three times.

- [ ] **Step 4: Register the rows**

```bash
npm run register:rows -- --milestone ny-cities-01 --match "New York OSC"
```

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "chore(ny): stamp axes and register the NY cities milestone"
gh pr create --title "feat(ny): onboard the 61 non-NYC New York cities" --body "<summary>"
```
⚠ Open a PR — never push directly to `main`.

---

## Self-Review

**Spec coverage.** §2 source → Task 6. §3 coverage → Tasks 8, 11 CHECK 1.
§4 eras → Tasks 1, 2, 6. §4.1 sections → Tasks 1, 6. §4.2 label casing →
Tasks 2, 6. §5 fund scope → Tasks 3, 7. §5.4 unknown prefixes → Tasks 3, 7.
§6 axes → Tasks 9, 13. §6.1 accounting_basis stays unknown → Task 9. §7
fiscal calendar → Tasks 5, 11 CHECK 4. §8 entities → Task 8. §9 writes →
Task 10. §10 verification → Tasks 11, 12. §11 risks → each has its task.

**Gaps found and closed.** Spec §12's open question 1 (`CS`) is resolved by
Task 3 making it `unknown` rather than left for the implementer to decide.
Spec §12 question 2 (`derivation`) is locked to `derived` in Global
Constraints. Spec §12 question 3 (which class next) is out of scope and
stays open.

**Type consistency.** `aggregateCityYear` returns `{ scope, tree, total,
unknownPrefixes }` in Task 7 and is destructured on exactly those names in
Tasks 10 and 11. `readYear` returns rows with `municipalCode`/`entityName`/
`fiscalYear`/`fundPrefix`/`section`/`fiscalYearStartMonth` in Task 6 and is
read on those names in Tasks 8, 10, 11. `sourceNameFor(datasetType,
fiscalYear, scope)` has the same arity in Tasks 9, 10.

**Review Focus coverage.** #1 negatives → Task 4 test "KEEPS negative
amounts". #2 zeros → Task 4 test "drops rows that are exactly zero". #3
unknown prefix → Task 3 `classifyPrefix` test and Task 7 "an unclassifiable
prefix makes the scope unknown". #4 era boundary → Task 2 casing tests and
Task 6 "agrees with the measured era split". #5 missing city-year → Task 10's
`skippedMissing` path and Task 11 CHECK 1.
