# New York School Districts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load General Fund and Total Governmental revenue and expenditure series for all 719 New York school districts, FY1995–FY2025, from OSC's school-district archive.

**Architecture:** The library built for the cities (`scripts/lib/nyOsc.mjs`) already handles both schema eras, label normalisation, decimal amounts, the 3-level tree and the fiscal calendar, and needs no behavioural change. The work is to stop two of its functions assuming the *city* fund registry — they take it as a parameter instead — then add a second ARM-cited registry, a roster, a batched loader and a verifier. The source-chip wiring lands before any row is written.

**Tech Stack:** Node ESM (`.mjs`), vitest, `@supabase/supabase-js`, `treasury_sync_city_budget` / `treasury_ensure_municipality` RPCs, TypeScript for the one `src/` change.

**Spec:** `docs/superpowers/specs/2026-10-11-ny-school-districts-design.md`

## Global Constraints

- **Archive is on disk** at `docs/NY/school_all_years.zip`, 111,027,648 B, sha256 `8dcf85329ee016e7…`, 32 members. Fetch must **skip if present**.
- **Evidence of record** is `docs/NY/osc-arm-school-districts.pdf`. Every fund classification cites it. Delete it and §4 of the spec loses its basis.
- **NO SHEBANG** on any module a test imports.
- **Load window is FY1995–FY2025 inclusive** (31 years). FY2026 is partial (690 districts, ~70% of FY2025's rows) and is excluded.
- **Sections loaded are `REVENUE` and `EXPENDITURE` only.**
- **Axis values, verbatim:** `basis='actual'`, `audit_grade='self_reported_unaudited'`, `accounting_basis='unknown'`, `reporting_entity='unknown'`, `derivation='derived'`, `fund_scope ∈ {'general_fund','total_governmental'}`.
- **`treasury_sync_city_budget` keys on `fund_scope` + `basis`** — both mandatory on every call or a re-run duplicates.
- **`entity_type = 'school_district'`.** Do **not** add it to `CITY_TIER_TYPES`: TT sends that set as one CSV and a type the API rejects 422s the whole query.
- **Match on `MUNICIPAL_CODE`, never the name.** 719 names against 717 codes.
- **Money parses as decimal.** `fiscal_year = CALENDAR_YEAR`.
- **`scripts/data/nyOscFundPrefixes.mjs` is NOT edited.** Two publishers, two manuals, two registries.
- Run `npm test`. Commit after every task.

## Review Focus

Five input classes the spec implies that a happy-path test would miss. Each gets a pinned test in the task that owns it.

1. **`C` (School Food Service) must count as GOVERNMENTAL.** For a city the same letter family is enterprise and excluded. 278,779 rows ride on this. A registry copied from the cities inverts it and understates every district with a lunch program. → Task 2.
2. **A uniform fiscal calendar must PASS, and a non-July district must FAIL.** Every district ends June 30, so the city's "fail if uniform" check would reject a correct load — but deleting the check instead of inverting it would stop measuring the month at all. → Task 8.
3. **An unclassifiable prefix (`CS`/`TN`/`B`) must make that district-year `unknown`, never a short sum** — 3,762 cells, all FY1995–2012. And `general_fund` must be unaffected. → Task 3.
4. **Two districts share one code under two spellings** (Gates Chili / Gates-Chili, Hopevale). Keying on the name forks them; the roster must carry 719 names on 717 codes without collapsing or duplicating either. → Task 5.
5. **The city path must not regress.** `aggregateCityYear` gains a parameter; every existing city test must still pass unchanged, and a district registry must not leak into a city call. → Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/nyOsc.mjs` | *modified* — `classifyPrefix` and `aggregateCityYear` take the registry by parameter, defaulting to the city one |
| `scripts/data/nyOscSchoolFundPrefixes.mjs` | **new** — the ten district funds, each citing the district manual |
| `scripts/data/nyOscSchoolEntities.mjs` | **new** — 719 districts, generated once, keyed on `MUNICIPAL_CODE` |
| `scripts/fetchNyOsc.mjs` | *modified* — takes which archive to fetch |
| `scripts/seedNySchools.mjs` | **new** |
| `scripts/loadNyOscSchools.mjs` | **new** — batched never-overwrite lookup |
| `scripts/verifyNyOscSchools.mjs` | **new** — five checks, CHECK 4 inverted |
| `src/data/sourceChipTypes.ts` | *modified* — add `school_district` |
| `tests/nyOscSchoolFundPrefixes.test.mjs`, `tests/nyOscSchools.test.mjs` | **new** |

---

### Task 1: The source chip — before any row is written

**Files:**
- Modify: `src/data/sourceChipTypes.ts:58-60`
- Modify: `src/data/sourceChipTypes.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `showsSourceChip('school_district') === true`

⚠ This is Task 1 deliberately. 719 districts rendering figures with no source name, no as-of date and no link is the defect that hit 949 PA boroughs and 253 MI villages. It must be impossible for the load to land before this does.

- [ ] **Step 1: Write the failing test**

Replace the two assertions that currently pin `school_district` as chip-less. In `src/data/sourceChipTypes.test.ts`, delete this line from the "is safe on a missing or unknown entity type" test:

```ts
    expect(showsSourceChip('school_district')).toBe(false);
```

and add a new test plus update the enumeration:

```ts
  it('shows the chip for school districts', () => {
    // ⚠ 719 NY districts arrive with data in the school-district load. Until
    // then NO district had any, which is why this type sat with `null` and ''
    // in the "unknown type" test rather than in a deliberate exclusion like
    // `federal`/`nonprofit`. A figure with no provenance is the borough defect.
    expect(showsSourceChip('school_district')).toBe(true);
  });

  it('enumerates exactly the types that get a chip', () => {
    expect([...SOURCE_CHIP_ENTITY_TYPES].sort()).toEqual(
      ['borough', 'city', 'county', 'municipality', 'school_district', 'state',
        'town', 'township', 'village'],
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/sourceChipTypes.test.ts`
Expected: FAIL — `expected false to be true`, and the enumeration mismatch.

- [ ] **Step 3: Write minimal implementation**

```ts
export const SOURCE_CHIP_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'city', 'municipality', 'town', 'township', 'village', 'borough', 'county', 'state',
  // ⚠⚠ `school_district` added 2026-10-11, ahead of the 719-district NY load.
  // It was absent not by decision but because no district had ever carried
  // data — the test pinned it beside `null` and `''`. 949 PA boroughs and 253
  // MI villages each shipped figures with no provenance for exactly this
  // reason. Added BEFORE the load, so no district-year is ever chip-less.
  'school_district',
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/sourceChipTypes.test.ts && npx vitest run tests/cityTierTypes.test.mjs`
Expected: both PASS. The second confirms the entity-type declarations still agree.

- [ ] **Step 5: Commit**

```bash
git add src/data/sourceChipTypes.ts src/data/sourceChipTypes.test.ts
git commit -m "fix(ui): school districts must show a provenance chip"
```

---

### Task 2: The district fund registry

**Files:**
- Create: `scripts/data/nyOscSchoolFundPrefixes.mjs`
- Create: `tests/nyOscSchoolFundPrefixes.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `NY_SCHOOL_FUND_PREFIXES` (object: prefix → `{ type, name, citation }`), `SCHOOL_GOVERNMENTAL_TYPES` (Set)

**Review Focus #1 lives here.**

- [ ] **Step 1: Write the failing test**

```js
// tests/nyOscSchoolFundPrefixes.test.mjs
import { describe, it, expect } from 'vitest';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from '../scripts/data/nyOscSchoolFundPrefixes.mjs';
import { NY_FUND_PREFIXES } from '../scripts/data/nyOscFundPrefixes.mjs';

describe('the district fund registry', () => {
  it('⚠ treats C (School Food Service) as GOVERNMENTAL', () => {
    // THE TRAP. For a CITY, food service sits in an E_ enterprise fund and is
    // EXCLUDED from total_governmental. The district manual puts "School Food
    // Service Programs  C" under Special Revenue, which is governmental and
    // INCLUDED. 278,779 rows ride on this one letter.
    expect(NY_SCHOOL_FUND_PREFIXES.C.type).toBe('special_revenue');
    expect(SCHOOL_GOVERNMENTAL_TYPES.has(NY_SCHOOL_FUND_PREFIXES.C.type)).toBe(true);
  });

  it('classifies every fund the manual names', () => {
    const expected = {
      A: 'general', C: 'special_revenue', CM: 'special_revenue',
      F: 'special_revenue', L: 'special_revenue',
      H: 'capital_projects', PN: 'permanent', V: 'debt_service',
      TC: 'fiduciary', TE: 'fiduciary',
    };
    for (const [p, type] of Object.entries(expected)) {
      expect(NY_SCHOOL_FUND_PREFIXES[p]?.type, p).toBe(type);
    }
    expect(Object.keys(NY_SCHOOL_FUND_PREFIXES).sort())
      .toEqual(Object.keys(expected).sort());
  });

  it('excludes exactly the two fiduciary funds', () => {
    for (const p of ['TC', 'TE']) {
      expect(SCHOOL_GOVERNMENTAL_TYPES.has(NY_SCHOOL_FUND_PREFIXES[p].type), p).toBe(false);
    }
    const govt = Object.entries(NY_SCHOOL_FUND_PREFIXES)
      .filter(([, e]) => SCHOOL_GOVERNMENTAL_TYPES.has(e.type)).map(([p]) => p).sort();
    expect(govt).toEqual(['A', 'C', 'CM', 'F', 'H', 'L', 'PN', 'V']);
  });

  it('has NO enterprise or internal service funds at all', () => {
    // The city registry's largest exclusion class does not exist for districts.
    const types = new Set(Object.values(NY_SCHOOL_FUND_PREFIXES).map((e) => e.type));
    expect(types.has('enterprise')).toBe(false);
    expect(types.has('internal_service')).toBe(false);
  });

  it('does NOT register the retired codes', () => {
    // CS, TN and B occur in FY1995-2012 and are absent from the manual's table.
    for (const p of ['CS', 'TN', 'B']) {
      expect(NY_SCHOOL_FUND_PREFIXES[p], p).toBeUndefined();
    }
  });

  it('carries a manual citation on every entry', () => {
    for (const [p, e] of Object.entries(NY_SCHOOL_FUND_PREFIXES)) {
      expect(e.citation, `${p} has no citation`).toBeTruthy();
      expect(e.citation.length, `${p} citation is a placeholder`).toBeGreaterThan(12);
      expect(e.citation, `${p} cites the wrong manual`).toMatch(/School Districts/i);
    }
  });

  it('is a SEPARATE table from the city registry, and disagrees with it', () => {
    // Same letter, different answer. Merging the two tables would have to pick
    // one, and either choice is wrong for half the state.
    expect(NY_FUND_PREFIXES.C).toBeUndefined();            // cities have no bare C
    expect(NY_FUND_PREFIXES.EL.type).toBe('enterprise');   // a city's refuse fund
    expect(NY_SCHOOL_FUND_PREFIXES.C.type).toBe('special_revenue');
    expect(NY_SCHOOL_FUND_PREFIXES.EL).toBeUndefined();    // districts have no E_
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOscSchoolFundPrefixes.test.mjs`
Expected: FAIL — cannot resolve `../scripts/data/nyOscSchoolFundPrefixes.mjs`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/data/nyOscSchoolFundPrefixes.mjs
// NO SHEBANG — see scripts/lib/nyOsc.mjs.
/**
 * NY SCHOOL DISTRICT fund letter -> fund type.
 *
 * ⚠⚠ THIS IS A DIFFERENT PUBLICATION FROM THE CITY REGISTRY, NOT A COPY OF IT.
 * `nyOscFundPrefixes.mjs` cites the Accounting and Reporting Manual for
 * Counties, Cities, Towns, Villages, Libraries and Soil and Water Conservation
 * Districts. School districts have their OWN manual, and the two disagree about
 * the same letters. Evidence of record:
 * `docs/NY/osc-arm-school-districts.pdf`.
 *
 * ⚠⚠ `C` IS THE TRAP. For a CITY, food service and similar fee-based
 * operations sit in an `E_` ENTERPRISE fund and are EXCLUDED from
 * total_governmental. For a DISTRICT the manual lists "School Food Service
 * Programs  C" under SPECIAL REVENUE, which is governmental and INCLUDED.
 * 278,779 rows ride on it. Carrying the city instinct across understates every
 * district with a lunch program.
 *
 * ⚠ Districts have NO enterprise and NO internal service funds at all.
 *
 * ⚠ `CS`, `TN` and `B` occur in FY1995-FY2012 and are NOT in the manual's
 * table, so they are deliberately absent: 3,762 of 43,168 total_governmental
 * cells (8.71%) publish `unknown`, every one of them before FY2013. `CS` is
 * retired in the CITY data over the same era and the obvious CS->MS rename was
 * tested there and DISPROVED — do not re-litigate it from this side without
 * new evidence. See scripts/data/nyOscFundPrefixes.mjs.
 */

const ARM = 'OSC Accounting and Reporting Manual for School Districts, '
  + '"The following funds are provided for school districts in New York State"';

export const NY_SCHOOL_FUND_PREFIXES = Object.freeze({
  // ── Governmental ────────────────────────────────────────────────────────
  A: { type: 'general', name: 'General',
    citation: `${ARM}: Governmental Funds — "General  A".` },
  C: { type: 'special_revenue', name: 'School Food Service Programs',
    citation: `${ARM}: Governmental Funds, Special Revenue — "School Food Service Programs  C". ⚠ GOVERNMENTAL for a district; the equivalent city activity is an E_ enterprise fund.` },
  CM: { type: 'special_revenue', name: 'Miscellaneous Revenue',
    citation: `${ARM}: Governmental Funds, Special Revenue — "Miscellaneous Revenue  CM".` },
  F: { type: 'special_revenue', name: 'Special Aid',
    citation: `${ARM}: Governmental Funds, Special Revenue — "Special Aid  F".` },
  L: { type: 'special_revenue', name: 'Public Library',
    citation: `${ARM}: Governmental Funds, Special Revenue — "Public Library  L".` },
  H: { type: 'capital_projects', name: 'Capital Projects',
    citation: `${ARM}: Governmental Funds — "Capital Projects  H".` },
  PN: { type: 'permanent', name: 'Permanent',
    citation: `${ARM}: Governmental Funds — "Permanent  PN".` },
  V: { type: 'debt_service', name: 'Debt Service',
    citation: `${ARM}: Governmental Funds — "Debt Service  V".` },

  // ── Fiduciary — EXCLUDED ─────────────────────────────────────────────────
  TC: { type: 'fiduciary', name: 'Custodial',
    citation: `${ARM}: Fiduciary Funds — "Custodial  TC"; "Custodial Funds (TC) - used to account for any remaining fiduciary activities".` },
  TE: { type: 'fiduciary', name: 'Private-Purpose Trust',
    citation: `${ARM}: Fiduciary Funds — "Private-Purpose Trust  TE".` },
});

/** The fund types that make up `total_governmental` for a school district. */
export const SCHOOL_GOVERNMENTAL_TYPES = Object.freeze(new Set([
  'general', 'special_revenue', 'capital_projects', 'permanent', 'debt_service',
]));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOscSchoolFundPrefixes.test.mjs`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add scripts/data/nyOscSchoolFundPrefixes.mjs tests/nyOscSchoolFundPrefixes.test.mjs
git commit -m "feat(ny): district fund registry — C is governmental here, not enterprise"
```

---

### Task 3: Make the library registry-agnostic

**Files:**
- Modify: `scripts/lib/nyOsc.mjs:117` (`classifyPrefix`), `:398` (`aggregateCityYear`)
- Create: `tests/nyOscSchools.test.mjs`

**Interfaces:**
- Consumes: Task 2's `NY_SCHOOL_FUND_PREFIXES`, `SCHOOL_GOVERNMENTAL_TYPES`
- Produces: `classifyPrefix(prefix, registry = NY_FUND_PREFIXES)`; `aggregateCityYear(rows, { section, scope, registry = NY_FUND_PREFIXES, governmentalTypes = GOVERNMENTAL_TYPES })` — return shape unchanged: `{ scope, tree, total, unknownPrefixes }`

**Review Focus #3 and #5 live here.**

- [ ] **Step 1: Write the failing test**

```js
// tests/nyOscSchools.test.mjs
import { describe, it, expect } from 'vitest';
import { aggregateCityYear, classifyPrefix } from '../scripts/lib/nyOsc.mjs';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from '../scripts/data/nyOscSchoolFundPrefixes.mjs';

const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };
const R = (fundPrefix, amt) => ({
  fundPrefix, section: 'EXPENDITURE',
  LEVEL_1_CATEGORY: 'Education', LEVEL_2_CATEGORY: 'Sub',
  OBJECT_OF_EXPENDITURE: `o${fundPrefix}`, AMOUNT: amt,
});

describe('classifyPrefix with an injected registry', () => {
  it('defaults to the CITY registry when none is given', () => {
    expect(classifyPrefix('EW')).toEqual({ type: 'enterprise', name: 'Water' });
    expect(classifyPrefix('F')).toBeNull();           // cities have no bare F
  });

  it('uses the district registry when given one', () => {
    expect(classifyPrefix('F', NY_SCHOOL_FUND_PREFIXES))
      .toEqual({ type: 'special_revenue', name: 'Special Aid' });
    expect(classifyPrefix('EW', NY_SCHOOL_FUND_PREFIXES)).toBeNull();
  });
});

describe('aggregateCityYear for school districts', () => {
  it('⚠ INCLUDES the C food-service fund in total_governmental', () => {
    const out = aggregateCityYear(
      [R('A', '100'), R('C', '40'), R('F', '25'), R('TC', '7'), R('TE', '3')],
      { section: 'EXPENDITURE', scope: 'total_governmental', ...SCHOOL });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(165);   // A + C + F; TC and TE are fiduciary
  });

  it('general_fund is the A fund alone', () => {
    const out = aggregateCityYear([R('A', '100'), R('F', '900')],
      { section: 'EXPENDITURE', scope: 'general_fund', ...SCHOOL });
    expect(out.total).toBe(100);
  });

  it('a retired prefix makes the scope unknown, not a short sum', () => {
    const out = aggregateCityYear([R('A', '100'), R('CS', '40')],
      { section: 'EXPENDITURE', scope: 'total_governmental', ...SCHOOL });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['CS']);
  });

  it('a retired prefix does NOT disturb general_fund', () => {
    const out = aggregateCityYear([R('A', '100'), R('TN', '40')],
      { section: 'EXPENDITURE', scope: 'general_fund', ...SCHOOL });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('⚠ the city path is unchanged — a district fund is unknown to it', () => {
    // Review Focus #5: the new parameter must not leak either direction.
    const out = aggregateCityYear([R('A', '100'), R('F', '40')],
      { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['F']);
  });

  it('⚠ and a CITY enterprise fund is excluded, not refused, for a city', () => {
    const out = aggregateCityYear([R('A', '100'), R('EW', '900')],
      { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOscSchools.test.mjs`
Expected: FAIL — `classifyPrefix('F', NY_SCHOOL_FUND_PREFIXES)` returns `null` because the second argument is ignored.

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/nyOsc.mjs`, replace `classifyPrefix`:

```js
/**
 * ⚠ Returns null for anything the given registry does not cover. Null is a
 * CORRECT outcome, not a shortfall: the caller must drive that entity-year's
 * total_governmental to `unknown`, never sum without the fund.
 *
 * ⚠⚠ THE REGISTRY IS A PARAMETER because NY has TWO publications. The same
 * letter means different things: `C` is a city's absent code and a district's
 * GOVERNMENTAL food-service fund. Defaulting to the city table keeps every
 * existing caller unchanged.
 */
export function classifyPrefix(prefix, registry = NY_FUND_PREFIXES) {
  if (!Object.hasOwn(registry, prefix)) return null;
  const e = registry[prefix];
  return { type: e.type, name: e.name };
}
```

and change `aggregateCityYear`'s signature and its three `classifyPrefix` calls:

```js
export function aggregateCityYear(
  rows,
  { section, scope, registry = NY_FUND_PREFIXES, governmentalTypes = GOVERNMENTAL_TYPES },
) {
  if (!LEGAL_SECTIONS.has(section)) {
    throw new Error(`unknown section ${JSON.stringify(section)} — expected REVENUE or EXPENDITURE`);
  }
  if (!LEGAL_SCOPES.has(scope)) {
    throw new Error(
      `unknown fund scope ${JSON.stringify(scope)} — expected general_fund or total_governmental`);
  }

  const inSection = rows.filter((r) => r.section === section);

  if (scope === 'general_fund') {
    const { tree, total } = buildNyTree(inSection.filter((r) => r.fundPrefix === 'A'));
    return { scope, tree, total, unknownPrefixes: [] };
  }

  const unknown = [...new Set(
    inSection.map((r) => r.fundPrefix).filter((p) => classifyPrefix(p, registry) === null),
  )].sort();
  if (unknown.length) return { scope: 'unknown', tree: [], total: 0, unknownPrefixes: unknown };

  const govt = inSection.filter(
    (r) => governmentalTypes.has(classifyPrefix(r.fundPrefix, registry).type));
  const { tree, total } = buildNyTree(govt);
  return { scope: 'total_governmental', tree, total, unknownPrefixes: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOscSchools.test.mjs tests/nyOsc.test.mjs tests/nyOscFundPrefixes.test.mjs tests/nyOscReviewFixes.test.mjs`
Expected: PASS. The three city suites must be **green and unmodified** — that is Review Focus #5.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/nyOsc.mjs tests/nyOscSchools.test.mjs
git commit -m "refactor(ny): take the fund registry by parameter, defaulting to cities"
```

---

### Task 4: Fetch either archive

**Files:**
- Modify: `scripts/fetchNyOsc.mjs`
- Modify: `scripts/lib/nyOsc.mjs` (add the school archive constants)
- Modify: `tests/nyOscSchools.test.mjs`

**Interfaces:**
- Consumes: Task 3
- Produces: `SCHOOL_ARCHIVE_PATH = 'docs/NY/school_all_years.zip'`; `SCHOOL_ARCHIVE_URL`; `SCHOOL_FIRST_YEAR = 1995`; `SCHOOL_LAST_YEAR = 2026`; `schoolMemberFor(year) -> string`

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOscSchools.test.mjs
import { existsSync } from 'node:fs';
import {
  SCHOOL_ARCHIVE_PATH, SCHOOL_ARCHIVE_URL, readYear,
} from '../scripts/lib/nyOsc.mjs';

const archiveIt = existsSync(SCHOOL_ARCHIVE_PATH) ? it : it.skip;

describe('the school archive', () => {
  it('exports a well-formed path and url', () => {
    expect(SCHOOL_ARCHIVE_PATH).toMatch(/school_all_years\.zip$/);
    expect(SCHOOL_ARCHIVE_URL).toMatch(/^https:\/\/wwe1\.osc\.state\.ny\.us\/.*schooldistrict_all_years\.zip$/);
  });

  archiveIt('reads a modern district year', () => {
    const rows = readYear(SCHOOL_ARCHIVE_PATH, 2021, 'SchoolDistrict');
    expect(rows.length).toBeGreaterThan(100000);
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(692);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['REVENUE', 'EXPENDITURE']));
  });

  archiveIt('reads an old-era district year with the same row shape', () => {
    const rows = readYear(SCHOOL_ARCHIVE_PATH, 2010, 'SchoolDistrict');
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(696);
    expect(rows.every((r) => r.fiscalYearStartMonth === 7)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOscSchools.test.mjs`
Expected: FAIL — `SCHOOL_ARCHIVE_PATH` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `scripts/lib/nyOsc.mjs`, beside the city archive constants:

```js
export const SCHOOL_ARCHIVE_PATH = 'docs/NY/school_all_years.zip';
export const SCHOOL_ARCHIVE_URL =
  'https://wwe1.osc.state.ny.us/localgov/findata/level3zip/schooldistrict_all_years.zip';
/** The districts file FY1995-FY2026; FY2026 is partial and not loaded. */
export const SCHOOL_FIRST_YEAR = 1995;
export const SCHOOL_LAST_YEAR = 2026;
```

Change `readYear` to take the member class, defaulting to the city one. Its year-range check must use the right bounds:

```js
export function readYear(zipPath, year, memberClass = 'City') {
  const first = memberClass === 'City' ? ARCHIVE_FIRST_YEAR : SCHOOL_FIRST_YEAR;
  const last = memberClass === 'City' ? ARCHIVE_LAST_YEAR : SCHOOL_LAST_YEAR;
  if (!Number.isInteger(year) || year < first || year > last) {
    throw new Error(`no such year ${year} — the archive covers FY${first}-FY${last}`);
  }
  const member = `${year}_${memberClass}.csv`;
  // …the rest of the function is unchanged, and already era-agnostic…
```

In `scripts/fetchNyOsc.mjs`, take the archive by argument:

```js
const WHICH = process.argv.includes('--schools')
  ? { path: SCHOOL_ARCHIVE_PATH, url: SCHOOL_ARCHIVE_URL, label: 'school districts' }
  : { path: ARCHIVE_PATH, url: ARCHIVE_URL, label: 'cities' };

if (existsSync(WHICH.path)) {
  console.log(`present, skipping: ${WHICH.path} (${WHICH.label})`);
  process.exit(0);
}
```

…and replace the three later uses of `ARCHIVE_PATH`/`ARCHIVE_URL` with `WHICH.path`/`WHICH.url`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOscSchools.test.mjs tests/nyOsc.test.mjs`
Expected: PASS. The city archive tests still pass because `memberClass` defaults to `'City'`.

- [ ] **Step 5: Verify the fetch script both ways**

```bash
node scripts/fetchNyOsc.mjs
node scripts/fetchNyOsc.mjs --schools
```
Expected: both print `present, skipping: …`

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/nyOsc.mjs scripts/fetchNyOsc.mjs tests/nyOscSchools.test.mjs
git commit -m "feat(ny): read and fetch either OSC archive"
```

---

### Task 5: The 719-district roster

**Files:**
- Create: `scripts/data/nyOscSchoolEntities.mjs`
- Modify: `tests/nyOscSchools.test.mjs`

**Interfaces:**
- Consumes: Task 4's `readYear(path, year, 'SchoolDistrict')`
- Produces: `NY_SCHOOL_ENTITIES` — array of `{ municipalCode, name, county }`, **719** long

**Review Focus #4 lives here.**

- [ ] **Step 1: Write the failing test**

```js
// append to tests/nyOscSchools.test.mjs
import { NY_SCHOOL_ENTITIES } from '../scripts/data/nyOscSchoolEntities.mjs';

describe('the district roster', () => {
  it('has 719 districts on 717 municipal codes', () => {
    // ⚠ The counts DIFFER ON PURPOSE. Two codes carry two spellings each:
    //   260631600100  Gates Chili / Gates-Chili Central School District
    //   140936100300  Hopevale / Hopevale School District
    // Keying on the NAME would fork both. The roster keeps one row per NAME so
    // every spelling resolves, and treasury_ensure_municipality collapses them
    // onto one entity by code, recording the other spelling as an alias.
    expect(NY_SCHOOL_ENTITIES).toHaveLength(719);
    expect(new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode)).size).toBe(717);
  });

  it('names the two double-spelled codes explicitly', () => {
    const dupes = new Map();
    for (const e of NY_SCHOOL_ENTITIES) {
      if (!dupes.has(e.municipalCode)) dupes.set(e.municipalCode, []);
      dupes.get(e.municipalCode).push(e.name);
    }
    const multi = [...dupes.entries()].filter(([, n]) => n.length > 1).map(([c]) => c).sort();
    expect(multi).toEqual(['140936100300', '260631600100']);
  });

  it('carries a well-formed code and a county for every district', () => {
    expect(NY_SCHOOL_ENTITIES.every((e) => /^\d{12}$/.test(e.municipalCode))).toBe(true);
    expect(NY_SCHOOL_ENTITIES.every((e) => e.county && e.county.length > 1)).toBe(true);
    expect(NY_SCHOOL_ENTITIES.every((e) => e.name && e.name.length > 1)).toBe(true);
  });

  archiveIt('covers every district in every sampled year', () => {
    const known = new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode));
    for (const fy of [1995, 2003, 2012, 2013, 2021, 2025]) {
      for (const c of new Set(readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')
        .map((r) => r.municipalCode))) {
        expect(known.has(c), `FY${fy} has unknown district ${c}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nyOscSchools.test.mjs`
Expected: FAIL — cannot resolve `../scripts/data/nyOscSchoolEntities.mjs`

- [ ] **Step 3: Generate the roster**

```bash
node --input-type=module -e "
import { readYear, SCHOOL_ARCHIVE_PATH } from './scripts/lib/nyOsc.mjs';
import { writeFileSync } from 'node:fs';
const seen = new Map();
for (let fy = 1995; fy <= 2025; fy++) {
  for (const r of readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')) {
    const k = r.municipalCode + '|' + r.entityName;
    if (!seen.has(k)) seen.set(k, { municipalCode: r.municipalCode, name: r.entityName, county: r.county });
  }
}
const rows = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.municipalCode.localeCompare(b.municipalCode));
if (rows.length !== 719) throw new Error('expected 719 name rows, got ' + rows.length);
const esc = (s) => s.replace(/'/g, \"\\\\'\");
const body = rows.map((e) => \`  { municipalCode: '\${e.municipalCode}', name: '\${esc(e.name)}', county: '\${esc(e.county)}' },\`).join('\n');
writeFileSync('scripts/data/nyOscSchoolEntities.mjs', [
  '// NO SHEBANG — see scripts/lib/nyOsc.mjs.',
  '/**',
  ' * The 719 New York school district NAME ROWS, on 717 municipal codes,',
  ' * generated once from docs/NY/school_all_years.zip over FY1995-FY2025.',
  ' *',
  ' * ⚠⚠ 719 NAMES, 717 CODES, AND THAT IS CORRECT. Two codes are published',
  ' * under two spellings:',
  ' *     260631600100  Gates Chili / Gates-Chili Central School District',
  ' *     140936100300  Hopevale / Hopevale School District',
  ' * Both spellings are kept so either resolves. treasury_ensure_municipality',
  ' * keys on (source, source_entity_key) and collapses them onto ONE entity,',
  ' * recording the second spelling as an alias. Keying on the NAME would fork',
  ' * both districts into two governments.',
  ' *',
  ' * ⚠ The key lives in treasury.municipality_source_keys, NOT as a column on',
  ' * municipalities.',
  ' */',
  'export const NY_SCHOOL_ENTITIES = Object.freeze([',
  body,
  ']);',
].join('\n') + '\n');
console.log('wrote', rows.length, 'rows on', new Set(rows.map(r=>r.municipalCode)).size, 'codes');
"
```
Expected: `wrote 719 rows on 717 codes`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nyOscSchools.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/data/nyOscSchoolEntities.mjs tests/nyOscSchools.test.mjs
git commit -m "feat(ny): 719-district roster on 717 codes, keyed on the code"
```

---

### Task 6: Seed the districts

**Files:**
- Create: `scripts/seedNySchools.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 5's `NY_SCHOOL_ENTITIES`
- Produces: `treasury.municipality_source_keys` rows under `source = 'NY_OSC_SCHOOL'`

⚠ A distinct `source` value from the cities' `NY_OSC`. Sharing it would let a district code collide with a city code in the same namespace.

- [ ] **Step 1: Write the seeder**

```js
#!/usr/bin/env node
// scripts/seedNySchools.mjs
/**
 * Seed the 719 New York school districts.
 *
 * ⚠ Population is NOT in this source and is seeded 0. `treasury_ensure_
 * municipality` only applies p_population on INSERT, so a re-run cannot
 * clobber a population backfilled later.
 *
 * ⚠ 719 name rows resolve onto 717 entities — two codes are published under
 * two spellings and the RPC records the second as an alias. Expect
 * 717 distinct municipalities, not 719.
 */
import { createClient } from '@supabase/supabase-js';

import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
import { NY_SCHOOL_ENTITIES } from './data/nyOscSchoolEntities.mjs';

const SOURCE_KEY = 'NY_OSC_SCHOOL';
const EXPECTED_NAMES = 719;
const EXPECTED_ENTITIES = 717;

// ⚠ PRE-FLIGHT, BEFORE ANY WRITE.
if (NY_SCHOOL_ENTITIES.length !== EXPECTED_NAMES) {
  throw new Error(`REFUSING: roster has ${NY_SCHOOL_ENTITIES.length} rows, expected ${EXPECTED_NAMES}`);
}
const codes = new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode));
if (codes.size !== EXPECTED_ENTITIES) {
  throw new Error(`REFUSING: roster has ${codes.size} codes, expected ${EXPECTED_ENTITIES}`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

if (process.argv.includes('--dry-run')) {
  console.log(`[dry-run] roster is clean; would ensure ${codes.size} districts from ${NY_SCHOOL_ENTITIES.length} name rows`);
  process.exit(0);
}

for (const e of NY_SCHOOL_ENTITIES) {
  await ensureMunicipality(db, {
    name: e.name,
    state: 'NY',
    entityType: 'school_district',
    population: 0,
    source: SOURCE_KEY,
    sourceEntityKey: e.municipalCode,
  });
}

const { count, error } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id', { count: 'exact', head: true })
  .eq('source', SOURCE_KEY);
if (error) throw new Error(`verification query failed: ${error.message}`);
if (count === null) throw new Error('verification query returned no count');

console.log(`database now holds ${count} source keys for ${SOURCE_KEY}`);
if (count !== EXPECTED_ENTITIES) {
  console.error(`REFUSING: expected ${EXPECTED_ENTITIES}, found ${count}`);
  process.exit(1);
}
```

Add to `package.json` scripts, beside the existing `ny:` entries:

```json
    "ny:fetch-schools": "node scripts/fetchNyOsc.mjs --schools",
    "ny:seed-schools": "node --env-file=.env scripts/seedNySchools.mjs",
    "ny:load-schools": "node --env-file=.env scripts/loadNyOscSchools.mjs",
    "ny:verify-schools": "node --env-file=.env scripts/verifyNyOscSchools.mjs",
```

- [ ] **Step 2: Dry-run it**

Run: `npm run ny:seed-schools -- --dry-run`
Expected: `[dry-run] roster is clean; would ensure 717 districts from 719 name rows`

- [ ] **Step 3: Seed for real**

Run: `npm run ny:seed-schools`
Expected: `database now holds 717 source keys for NY_OSC_SCHOOL`

- [ ] **Step 4: Confirm the aliases landed**

```sql
select count(*) from treasury.municipalities where state='NY' and entity_type='school_district';
select alias_name, source_entity_key from treasury.municipality_aliases where source='NY_OSC_SCHOOL';
```
Expected: 717 municipalities (719 was never the entity count), and 2 alias rows for the double-spelled codes.

- [ ] **Step 5: Commit**

```bash
git add scripts/seedNySchools.mjs package.json
git commit -m "feat(ny): seed 717 school districts from 719 published spellings"
```

---

### Task 7: The batched loader

**Files:**
- Create: `scripts/loadNyOscSchools.mjs`

**Interfaces:**
- Consumes: Tasks 2–6
- Produces: a CLI — `node --env-file=.env scripts/loadNyOscSchools.mjs [--from 1995] [--to 2025] [--dry-run]`

⚠ The never-overwrite guard **stays**; only its lookup is batched. ~85,400 writes with a per-row SELECT is ~170,000 round trips.

- [ ] **Step 1: Write the loader**

```js
#!/usr/bin/env node
// scripts/loadNyOscSchools.mjs
/**
 * Load the 719 NY school districts from OSC's archive.
 *
 * Spec: docs/superpowers/specs/2026-10-11-ny-school-districts-design.md
 *
 * ⚠⚠ `treasury_sync_city_budget` KEYS ON fund_scope + basis, NOT data_source.
 * Two scopes per district-year-dataset, so omitting either DUPLICATES on a
 * re-run.
 *
 * ⚠ The never-overwrite guard is BATCHED, not dropped: one read per fiscal
 * year instead of one per row. ~85,400 writes with a per-row SELECT would be
 * ~170,000 round trips and a multi-hour run. A guard that only appears when it
 * is needed is not a guard, and this is the largest load TT has run.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import {
  SCHOOL_ARCHIVE_PATH, readYear, aggregateCityYear, sourceNameFor, SOURCE_URL, SOURCE_PREFIX,
} from './lib/nyOsc.mjs';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from './data/nyOscSchoolFundPrefixes.mjs';
import { NY_SCHOOL_ENTITIES } from './data/nyOscSchoolEntities.mjs';

const SOURCE_KEY = 'NY_OSC_SCHOOL';
const BASIS_VALUE = 'actual';
const DERIVATION = 'derived';
const SCOPES = ['general_fund', 'total_governmental'];
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];
const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '1995' },
    to: { type: 'string', default: '2025' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const FROM = Number(values.from);
const TO = Number(values.to);
const DRY = values['dry-run'];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', SOURCE_KEY);
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);
const idByCode = new Map(keyRows.map((k) => [k.source_entity_key, k.municipality_id]));

const unseeded = [...new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode))]
  .filter((c) => !idByCode.has(c));
if (unseeded.length) {
  console.error(`REFUSING: ${unseeded.length} districts are not seeded. `
    + 'Run `npm run ny:seed-schools` first.');
  process.exit(1);
}

/**
 * ⚠ A paged read needs a TOTAL ORDER and a SERVER-SIDE filter, and PostgREST
 * caps a response at 1,000 rows regardless of `.limit()`. The guard is that
 * DISTINCT ids equal the row count.
 */
async function existingForYear(fy) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .schema('treasury')
      .from('budgets')
      .select('id,municipality_id,dataset_type,fund_scope,data_source')
      .eq('fiscal_year', fy)
      .eq('basis', BASIS_VALUE)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`existing-row read failed (FY${fy}): ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  if (new Set(out.map((r) => r.id)).size !== out.length) {
    throw new Error(`FY${fy}: paged read returned duplicate ids — page order is not total`);
  }
  return new Map(out.map((r) =>
    [`${r.municipality_id}|${r.dataset_type}|${r.fund_scope}`, r.data_source]));
}

let written = 0;
let categories = 0;
let skippedMissing = 0;
let unknownScope = 0;
let conflicts = 0;
const unknownDetail = new Map();

for (let fy = FROM; fy <= TO; fy++) {
  const rows = readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict');
  const existing = DRY ? new Map() : await existingForYear(fy);

  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
    byCode.get(r.municipalCode).push(r);
  }

  let wroteThisYear = 0;

  for (const [code, districtRows] of byCode) {
    const municipalityId = idByCode.get(code);
    if (!municipalityId) { skippedMissing++; continue; }

    // ⚠ Read per entity per year. Districts are uniformly month 7, but the
    // value is MEASURED — a district that is not 7 is a finding, not a default.
    const fysm = districtRows[0].fiscalYearStartMonth;

    for (const { datasetType, section } of DATASETS) {
      for (const scope of SCOPES) {
        const agg = aggregateCityYear(districtRows, { section, scope, ...SCHOOL });

        if (agg.scope === 'unknown') {
          unknownScope++;
          const k = agg.unknownPrefixes.join(',');
          unknownDetail.set(k, (unknownDetail.get(k) ?? 0) + 1);
          continue;
        }
        if (agg.tree.length === 0) continue;

        const prior = existing.get(`${municipalityId}|${datasetType}|${scope}`);
        if (prior && !String(prior).startsWith(SOURCE_PREFIX)) {
          conflicts++;
          console.log(`  SKIP ${code} FY${fy} ${datasetType} ${scope} — "${prior}" preserved`);
          continue;
        }

        if (DRY) { written++; wroteThisYear++; continue; }

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
          p_fund_scope: scope,   // ⚠ part of the RPC's key
          p_basis: BASIS_VALUE,  // ⚠ part of the RPC's key
          p_derivation: DERIVATION,
        });

        const where = `${code} FY${fy} ${datasetType} ${scope}`;
        if (error) throw new Error(`RPC transport error (${where}): ${error.message}`);
        if (data?.error) throw new Error(`RPC refused (${where}): ${data.error}`);
        if (data?.status !== 'success' || !data?.budget_id) {
          throw new Error(`RPC returned no success (${where}): ${JSON.stringify(data)}`);
        }

        written++;
        wroteThisYear++;
        categories += agg.tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
      }
    }
  }
  console.log(`FY${fy}: ${wroteThisYear} rows${DRY ? ' (dry-run)' : ''}, ${written} so far`);
}

console.log(`\n${DRY ? '[dry-run] would write' : 'Wrote'} ${written} budget rows`
  + ` over ${categories.toLocaleString()} categories.`);
console.log(`  ${skippedMissing} district-years with no seeded entity`);
console.log(`  ${unknownScope} scopes left unknown (unclassifiable fund prefix)`);
for (const [k, n] of unknownDetail) console.log(`      [${k}] ${n} cells`);
console.log(`  ${conflicts} skipped by the never-overwrite guard`);

if (written === 0) { console.error('REFUSING: no rows were actually written.'); process.exit(1); }

if (!DRY) {
  console.log('\nNow run:  npm run ny:verify-schools');
  console.log('     then npm run verify:frozen   (expect it RED until rows are registered)');
  console.log('     then npm run check:forks');
  console.log('⚠ RE-MEASURE EXPECTED_ROWS and EXPECTED_BASIS_ROWS — do NOT paste a prediction.');
}
```

- [ ] **Step 2: Dry-run one year**

Run: `npm run ny:load-schools -- --from 2021 --to 2021 --dry-run`
Expected: `FY2021: 2768 rows (dry-run)` — 692 districts × 2 datasets × 2 scopes, 0 unknown (FY2013+ has no retired prefixes).

- [ ] **Step 3: Dry-run an old-era year**

Run: `npm run ny:load-schools -- --from 1995 --to 1995 --dry-run`
Expected: fewer than 2,844 rows, and the unknown-scope line reports `[CS]`, `[TN]` and/or `[B]` totalling 928 cells.

- [ ] **Step 4: Load one year for real and spot-check**

```bash
npm run ny:load-schools -- --from 2021 --to 2021
```
Then verify Buffalo City School District against the archive:

```bash
node --input-type=module -e "
import { readYear, SCHOOL_ARCHIVE_PATH, aggregateCityYear } from './scripts/lib/nyOsc.mjs';
import { NY_SCHOOL_FUND_PREFIXES as R, SCHOOL_GOVERNMENTAL_TYPES as G } from './scripts/data/nyOscSchoolFundPrefixes.mjs';
const rows = readYear(SCHOOL_ARCHIVE_PATH, 2021, 'SchoolDistrict').filter(r => r.entityName === 'Buffalo City School District');
for (const [sec, label] of [['REVENUE','revenue'],['EXPENDITURE','operating']])
  for (const scope of ['general_fund','total_governmental'])
    console.log(label, scope, aggregateCityYear(rows, { section: sec, scope, registry: R, governmentalTypes: G }).total.toFixed(2));
"
```
Expected: `revenue general_fund 916884897.00` — the figure the city reconciliation measured. Compare it against `treasury.budgets` for the same district-year.

- [ ] **Step 5: Load the full window**

Run: `npm run ny:load-schools -- --from 1995 --to 2025`
Expected: ~85,400 rows, ~3,762 scopes left unknown, 0 conflicts.

- [ ] **Step 6: Commit**

```bash
git add scripts/loadNyOscSchools.mjs
git commit -m "feat(ny): load 719 districts FY1995-2025, batched guard"
```

---

### Task 8: Verification

**Files:**
- Create: `scripts/verifyNyOscSchools.mjs`

**Interfaces:**
- Consumes: Tasks 2–7
- Produces: a CLI that exits non-zero on any failed check

**Review Focus #2 lives here.**

⚠⚠ The `$0` tie is **not** a check and must never be added as one: OSC publishes no total row, so it is true by construction.

- [ ] **Step 1: Write the verifier**

Copy `scripts/verifyNyOscCities.mjs` and change exactly these things — everything else is identical:

1. Import the school archive, roster and registry; use `SOURCE_KEY = 'NY_OSC_SCHOOL'`; `ORACLE_YEARS = [1998, 2005, 2012, 2013, 2021, 2025]`; `FROM = 1995`, `TO = 2025`.
2. Pass `{ ...SCHOOL }` into every `aggregateCityYear` call.
3. CHECK 1's general-fund completeness expectation becomes per-year, because the district count varies (711 in FY1995, 692 in FY2021) — count the distinct codes in each year's file rather than assuming a constant.
4. **CHECK 4 is INVERTED.** Replace the city version wholesale:

```js
// ── CHECK 4 — fiscal calendars ──────────────────────────────────────────────
// ⚠⚠ THIS IS THE OPPOSITE OF THE CITY CHECK AND THAT IS DELIBERATE.
// Cities span five year-ends, so a UNIFORM result there proves the month was
// carried rather than read. Every school district in the state ends June 30,
// so uniformity is the CORRECT answer here and the city check would fail a
// correct load.
//
// ⚠ The check is INVERTED, NOT DELETED. The lesson of the FYSM defect is that
// a month must be MEASURED — not that the measurement must come out varied.
// A district reporting anything but month 7 is a finding.
console.log('\nCHECK 4 — every district reports month 7, read not assumed');
{
  const months = new Map();
  for (const r of rows) {
    if (!months.has(r.municipality_id)) months.set(r.municipality_id, new Set());
    months.get(r.municipality_id).add(r.fiscal_year_start_month);
  }
  const dist = {};
  for (const [, s] of months) for (const m of s) dist[m] = (dist[m] ?? 0) + 1;
  console.log(`      distribution across districts: ${JSON.stringify(dist)}`);

  const wrongMonth = rows.filter((r) => r.fiscal_year_start_month !== 7);
  if (wrongMonth.length) {
    fail(`${wrongMonth.length} rows report a start month other than 7 — `
      + 'every NY district files to a June 30 year end');
  } else {
    ok('every row reports month 7');
  }

  const inconsistent = [...months.entries()].filter(([, s]) => s.size > 1);
  if (inconsistent.length) fail(`${inconsistent.length} districts change month mid-series`);
  else ok('no district changes its fiscal start month mid-series');

  // ⚠ Non-vacuity: the archive must actually be the thing that said 7.
  const fromArchive = new Set(readYear(SCHOOL_ARCHIVE_PATH, 2021, 'SchoolDistrict')
    .map((r) => r.fiscalYearStartMonth));
  if (!(fromArchive.size === 1 && fromArchive.has(7))) {
    fail(`the archive itself does not report a single month 7: ${[...fromArchive]}`);
  } else {
    ok('the archive independently reports month 7 and nothing else');
  }
}
```

- [ ] **Step 2: Run it**

Run: `npm run ny:verify-schools`
Expected: CHECK 0–5 all pass; CHECK 4 prints `{"7": 717}`.

- [ ] **Step 3: ⚠ Mutation-test all five checks**

A check that cannot fail is worse than no check, and this branch's predecessor shipped exactly that. Run each mutation, confirm a non-zero exit, then delete the mutant:

```bash
run() { sed "$1" scripts/verifyNyOscSchools.mjs > scripts/_m.mjs; echo "--- $2 ---"; node --env-file=.env scripts/_m.mjs 2>&1 | grep -E "✗" | head -2; rm -f scripts/_m.mjs; }
run 's/expected.add(k);/expected.add(k + "_X");/'                                  "CHECK 1 corrupt expected keys"
run 's/r.basis !== .actual./r.basis !== "nope"/'                                   "CHECK 2 impossible basis"
run 's/v.general_fund > v.total_governmental + 0.5/v.total_governmental > v.general_fund + 0.5/' "CHECK 3 flip inequality"
run 's/r.fiscal_year_start_month !== 7/r.fiscal_year_start_month === 7/'           "CHECK 4 invert the month test"
run 's/scope: r.fund_scope,/scope: r.fund_scope === "general_fund" ? "total_governmental" : "general_fund",/' "CHECK 5 wrong scope"
```
Expected: all five print a `✗` line.

- [ ] **Step 4: Commit**

```bash
git add scripts/verifyNyOscSchools.mjs
git commit -m "test(ny): five district checks; CHECK 4 inverted for a uniform calendar"
```

---

### Task 9: Register the rows and measure both expectation tables

**Files:**
- Modify: `scripts/data/fundScopeExpectations.mjs`
- Modify: `scripts/stampBudgetAxes.mjs` (`EXPECTED_BASIS_ROWS`)
- Modify: `scripts/data/fundScopeRegistry.mjs`, `basisRegistry.mjs`, `auditGradeRegistry.mjs`
- Modify: `tests/fundScope.test.mjs` (the `total_governmental` id list)
- Modify: `tests/syncCityBudgetAxisKey.test.mjs` (REQUIRED callers)
- Create: `scripts/data/nySchools01CreatedIds.json` (generated)

⚠ Registry patterns are **anchored at both ends**. The district source names must not be claimable by the city entries, nor vice versa — §8 of the spec.

- [ ] **Step 1: Add the registry entries**

The district source strings must be distinguishable from the city ones. In `scripts/lib/nyOsc.mjs`, `sourceNameFor` currently emits `New York OSC Annual Financial Report — …`. Add a district variant rather than overloading it:

```js
export const SCHOOL_SOURCE_PREFIX = 'New York OSC School District Annual Financial Report';

export function schoolSourceNameFor(datasetType, fiscalYear, scope) {
  const face = DATASET_FACE[datasetType];
  if (!face) {
    throw new Error(`unknown dataset type ${JSON.stringify(datasetType)} — expected operating or revenue`);
  }
  const scopeFace = SCOPE_FACE[scope];
  if (!scopeFace) throw new Error(`unknown fund scope for source name: ${JSON.stringify(scope)}`);
  if (!Number.isInteger(fiscalYear)
      || fiscalYear < SCHOOL_FIRST_YEAR || fiscalYear > SCHOOL_LAST_YEAR) {
    throw new Error(`fiscal year ${fiscalYear} is not an integer in `
      + `FY${SCHOOL_FIRST_YEAR}-FY${SCHOOL_LAST_YEAR}`);
  }
  return `${SCHOOL_SOURCE_PREFIX} — ${face}, ${scopeFace} (FY${fiscalYear} actual, self-reported)`;
}
```

⚠ Change Task 7's loader to import and call `schoolSourceNameFor`, and its guard to compare against `SCHOOL_SOURCE_PREFIX`.

Add to `FUND_SCOPE_REGISTRY`, at the head:

```js
  {
    id: 'ny-osc-school-general-fund',
    match: /^New York OSC School District Annual Financial Report — (Revenues|Expenditures), General Fund \(FY\d{4} actual, self-reported\)$/,
    scope: SCOPE.GENERAL_FUND,
    evidence: {
      document: 'OSC Accounting and Reporting Manual for School Districts '
              + '(docs/NY/osc-arm-school-districts.pdf); spec '
              + 'docs/superpowers/specs/2026-10-11-ny-school-districts-design.md §4',
      figures: 'The scope is the `A` prefix alone. The manual\'s fund table reads '
             + '"Governmental Funds … General  A". Corroborated against the city reconciliation: '
             + 'Buffalo City School District FY2021 General Fund revenue reads 916,884,897, more '
             + 'than twice the City of Buffalo\'s entire General Fund, which is why the city AFR '
             + 'could not have contained it.',
    },
  },
  {
    id: 'ny-osc-school-total-governmental',
    match: /^New York OSC School District Annual Financial Report — (Revenues|Expenditures), Total Governmental \(FY\d{4} actual, self-reported\)$/,
    scope: SCOPE.TOTAL_GOVERNMENTAL,
    evidence: {
      document: 'OSC Accounting and Reporting Manual for School Districts '
              + '(docs/NY/osc-arm-school-districts.pdf), the explicit fund table; prefix table '
              + 'scripts/data/nyOscSchoolFundPrefixes.mjs',
      figures: 'Governmental = A + C + CM + F + L + H + PN + V. EXCLUDED: TC and TE, the only two '
             + 'fiduciary funds; districts have NO enterprise and NO internal service funds at all. '
             + '⚠ `C` (School Food Service Programs) is SPECIAL REVENUE and therefore INCLUDED here, '
             + 'while the equivalent city activity sits in an E_ enterprise fund and is excluded — '
             + '278,779 rows turn on that difference. A district-year carrying a retired prefix '
             + '(CS/TN/B) is written `unknown`: 3,762 of 43,168 cells (8.71%), all FY1995-FY2012. '
             + 'REPORTING ENTITY: UNKNOWN — nothing read establishes whether a district consolidates '
             + 'component units.',
    },
  },
```

Add matching `ny-osc-school` entries to `BASIS_REGISTRY` (`BASIS.ACTUAL`) and `AUDIT_GRADE_REGISTRY` (`AUDIT_GRADE.SELF_REPORTED_UNAUDITED`), each with the same anchored pattern covering both scopes, and evidence naming the district manual. Do **not** add an `ACCOUNTING_BASIS_REGISTRY` entry.

Add `'ny-osc-school-total-governmental'` to the hardcoded id list in `tests/fundScope.test.mjs`'s "every total_governmental entry states its reporting entity" test, and `'loadNyOscSchools.mjs'` to `REQUIRED` in `tests/syncCityBudgetAxisKey.test.mjs` with its measured pair.

- [ ] **Step 2: Measure both tables against the live database**

```sql
select fund_scope, count(*) as rows, count(distinct id) as distinct_ids,
       count(distinct data_source) as strings, count(distinct municipality_id) as entities
from treasury.budgets
where data_source like 'New York OSC School District%'
group by fund_scope order by fund_scope;
```

⚠ **Record what this returns. Do NOT paste the plan's ~85,400 estimate.** `rows` must equal `distinct_ids`. Add the measured numbers to `EXPECTED_ROWS` (two entries) and `EXPECTED_BASIS_ROWS` (one entry, their sum), each with a comment carrying the house-style quadruple and the date.

- [ ] **Step 3: Register the created rows**

```bash
node --env-file=.env scripts/registerCreatedRows.mjs
node --env-file=.env scripts/registerCreatedRows.mjs --milestone ny-schools-01 --match "New York OSC School District"
```
⚠ The union must equal the deficit **exactly** or the tool refuses. If it does not, something other than this load also wrote rows — investigate before forcing anything.

- [ ] **Step 4: Stamp and re-baseline**

```bash
node --env-file=.env scripts/stampAuditGrade.mjs --dry-run
node --env-file=.env scripts/stampAuditGrade.mjs
node --env-file=.env scripts/stampBudgetAxes.mjs --dry-run
node --env-file=.env scripts/stampBudgetAxes.mjs
node --env-file=.env scripts/verifyAxisStamps.mjs
npm test
node --env-file=.env scripts/syncFrozenInvariantState.mjs --set-baseline
npm run verify:frozen
```
Expected: `verifyAxisStamps` green on all five axes; the frozen digest **unchanged** from before the load, proving no existing figure moved.

- [ ] **Step 5: Run every gate**

```bash
npm run ny:verify-schools && npm run ny:verify && npm run check:forks && npm test && npm run build
node --env-file=.env scripts/classifyFundScope.mjs
```
⚠ `npm run ny:verify` (the **cities**) must still pass — the Task 3 refactor touched shared code.

- [ ] **Step 6: Commit**

```bash
git add scripts/data/ scripts/stampBudgetAxes.mjs scripts/lib/nyOsc.mjs tests/
git commit -m "chore(ny): register the district load and record measured expectations"
```

---

## Self-Review

**Spec coverage.** §1 motivation → Task 7 Step 4's Buffalo check. §2 source → Task 4. §2.1 on-disk → Global Constraints. §3 coverage/window → Tasks 5, 7, 8. §4 fund table → Task 2. §4.1 retired codes → Tasks 2, 7, 8. §5 unknown → Task 3. §6 axes → Task 9. §7 uniform calendar → Task 8 CHECK 4. §8 code changes → Tasks 3, 4. §8.1 code-keying → Tasks 5, 6. §9 source chip → **Task 1, first**. §10 scale/batching → Task 7. §11 verification → Task 8. §11.1 oracle → *not a task* (see below). §12 risks → each has its task.

**Gap found and accepted.** Spec §11.1 (FAC reconciliation of district ACFRs) has **no task**. It is the analogue of the cities' Task 12, it depends on nothing in this plan, and it is the one step whose cost is unpredictable — the city version needed five PDFs, three failed access routes and a switch to pdfplumber. It belongs in its own follow-up, and the plan says so rather than pretending a checkbox covers it. **This plan therefore does NOT establish that the district figures are right — only that TT reads OSC faithfully**, exactly as Tasks 1–11 did for the cities.

**Placeholder scan.** No TBD/TODO. Task 8 says "copy and change exactly these things" with the one substantive block written out in full; the other four changes are named precisely enough to apply without invention.

**Type consistency.** `aggregateCityYear(rows, { section, scope, registry, governmentalTypes })` is defined in Task 3 and called with `{ ...SCHOOL }` in Tasks 7 and 8. `classifyPrefix(prefix, registry)` same. `NY_SCHOOL_FUND_PREFIXES` / `SCHOOL_GOVERNMENTAL_TYPES` named identically in Tasks 2, 3, 7, 8, 9. `readYear(path, year, memberClass)` defined in Task 4, called with `'SchoolDistrict'` in Tasks 5, 7, 8. `schoolSourceNameFor` is introduced in Task 9 and Task 7's loader is explicitly told to switch to it.

**Review Focus coverage.** #1 `C` governmental → Task 2 and Task 3's first aggregate test. #2 uniform calendar → Task 8 CHECK 4 plus its mutation. #3 retired prefix → Task 3's two unknown tests. #4 719/717 → Task 5's first two tests. #5 city non-regression → Task 3's last two tests and Task 9 Step 5.
