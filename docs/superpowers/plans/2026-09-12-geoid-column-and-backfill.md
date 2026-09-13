# Geoid Column and Backfill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a verified Census FIPS `geoid` on every geographic entity in `treasury.municipalities`, deriving it offline from Census PEP bulk files, so a second application can key on TT entities.

**Architecture:** A pure, dependency-free matcher module (`scripts/lib/geoid.mjs`) that turns parsed Census PEP rows into indexes and resolves one TT entity name to one geoid or to an explicit null-with-reason. A driver script feeds it the PEP files and emits a single reviewable SQL data migration. No network at write time, no service key required to derive.

**Tech Stack:** Node ESM (`.mjs`), vitest, Postgres/Supabase, Census PEP bulk CSVs (free, no API key).

**Spec:** `docs/superpowers/specs/2026-09-12-civic-spaces-coverage-catalog-design.md`

**Scope note:** This plan covers the TT repo only — §4 of the spec, plus the parts of §6 that live here. The `/api/treasury/coverage` endpoint (§5, EV-Accounts repo) is a **separate plan**, deliberately written only after this backfill has run: its tests assert against real geoid values and the real national miss rate, neither of which is known until Task 7 completes.

## Global Constraints

- **Null is a correct answer; a wrong geoid is not.** Any ambiguity (more than one candidate) writes NULL and logs. Never pick.
- **The Census designator must be REQUIRED, never stripped, when matching MCDs.** In an MCD state an incorporated city is also a county subdivision. Stripping produced 105 false ambiguities in Michigan alone.
- **`geoid` is `text`.** Leading zeros are meaningful (`01073` = Jefferson County, AL).
- **No `NOT NULL DEFAULT` on `geoid`.** A default would assert a geoid TT never derived, on every row, and nothing would fail.
- **`geoid` and `geoid_basis` travel together** — both NULL or both set.
- **`$0`.** Census PEP bulk files only; no API, no key. Well under the $5 AI/API spend threshold.
- **No shebang** in any `scripts/lib/*.mjs` — a `#!` on a module a test imports breaks `npm test` on Windows.
- **Branch + PR.** Never push directly to `main`.
- Tests live at `tests/*.test.mjs` (vitest include: `src/**/*.test.ts`, `tests/**/*.test.mjs`, `scripts/**/*.test.mjs`).
- Run a single test file with `npx vitest run tests/<file>.test.mjs`.

### Geoid composition (the whole contract, in one table)

| `entity_type` | SUMLEV | source file | geoid | length |
|---|---|---|---|---|
| `state` | — | derived, verified vs county file | `STATE` | 2 |
| `county` | 050 | `co-est2024-alldata.csv` | `STATE+COUNTY` | 5 |
| `city` `town` `village` `borough` `municipality` | 162 | `sub-est2024_<ss>.csv` | `STATE+PLACE` | 7 |
| `township` | 061 | `sub-est2024_<ss>.csv` | `STATE+COUNTY+COUSUB` | 10 |
| `federal` `nonprofit` `special_district` `school_district` `conservancy` `library` | — | — | NULL | — |

### Basis values (the only legal strings)

```
static-state-fips
census-pep-050-exact
census-pep-162-exact
census-pep-061-county-scoped
```

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/geoid.mjs` (create) | Pure matcher: state FIPS table, index builders, resolvers. No I/O, no DB, no network. |
| `tests/geoidMatch.test.mjs` (create) | Unit tests for the matcher, including the Michigan `Adrian` regression. |
| `tests/fixtures/census/mi-adrian-slice.csv` (create) | Minimal PEP fixture carrying both `Adrian city` and `Adrian township` in Lenawee County. |
| `tests/fixtures/census/in-place-slice.csv` (create) | Minimal PEP fixture for place-tier matching incl. a designator-in-legal-name case. |
| `supabase/migrations/20260912000000_municipalities_geoid.sql` (create) | `geoid` + `geoid_basis` columns, tier-keyed CHECK, self-verifying `DO` block. |
| `scripts/backfillGeoids.mjs` (create) | Driver: fetch/cache PEP files, run the matcher, emit SQL + a per-state report. |
| `supabase/migrations/20260912000100_backfill_municipality_geoids.sql` (generated, Task 7) | The derived values as one reviewable `UPDATE … FROM (VALUES …)`. |

`geoid.mjs` is kept free of I/O so every rule above is testable from a fixture without a network or a database. `backfillGeoids.mjs` owns all I/O and owns no matching logic.

---

## Task 1: State FIPS table, verified against the Census file

A hardcoded 50-row map is fine **only if a test proves it against the Census data**. A guard that keeps its own unverified copy of a list cannot catch the list being wrong — the `CITY_TIER_TYPES`/`borough` lesson, where three verifier scripts each held a private copy that said everything was fine.

**Files:**
- Create: `scripts/lib/geoid.mjs`
- Test: `tests/geoidMatch.test.mjs`

**Interfaces:**
- Consumes: `readPepCsv`, `SUMLEV` from `scripts/lib/censusPep.mjs`
- Produces:
  - `export const STATE_FIPS: Record<string, string>` — 50 entries, abbrev → 2-digit FIPS
  - `export function resolveState(abbrev: string): { geoid: string|null, basis: string|null, reason: string|null }`

- [ ] **Step 1: Write the failing test**

```js
// tests/geoidMatch.test.mjs
import { describe, it, expect } from 'vitest';
import { readPepCsv, SUMLEV } from '../scripts/lib/censusPep.mjs';
import { STATE_FIPS, resolveState } from '../scripts/lib/geoid.mjs';

describe('STATE_FIPS', () => {
  it('has exactly 50 states', () => {
    expect(Object.keys(STATE_FIPS)).toHaveLength(50);
  });

  it('is 2-digit zero-padded text, never a number', () => {
    for (const [abbrev, fips] of Object.entries(STATE_FIPS)) {
      expect(typeof fips, abbrev).toBe('string');
      expect(fips, abbrev).toMatch(/^\d{2}$/);
    }
    expect(STATE_FIPS.AL).toBe('01'); // the leading zero survives
  });

  it('has no duplicate FIPS codes', () => {
    const seen = new Set(Object.values(STATE_FIPS));
    expect(seen.size).toBe(50);
  });

  // ⚠ The point of this test: the table is checked AGAINST Census, not merely
  // asserted. It reads the same national county file the backfill reads.
  it('every FIPS matches the Census national county file', () => {
    const rows = readPepCsv('cache/co-est2024-alldata.csv');
    const fipsByStateName = new Map();
    for (const r of rows) {
      if (r.SUMLEV !== SUMLEV.county) continue;
      fipsByStateName.set(r.STNAME, r.STATE);
    }
    const NAMES = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
      CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
      HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
      KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
      MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
      MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
      NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
      NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
      OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
      SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
      VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
      WY: 'Wyoming',
    };
    for (const [abbrev, fips] of Object.entries(STATE_FIPS)) {
      expect(fipsByStateName.get(NAMES[abbrev]), abbrev).toBe(fips);
    }
  });
});

describe('resolveState', () => {
  it('resolves a known abbreviation', () => {
    expect(resolveState('IN')).toEqual({
      geoid: '18', basis: 'static-state-fips', reason: null,
    });
  });

  it('returns a null with a reason for an unknown abbreviation', () => {
    const r = resolveState('ZZ');
    expect(r.geoid).toBeNull();
    expect(r.basis).toBeNull();
    expect(r.reason).toBe('no state FIPS for abbrev ZZ');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: FAIL — `Failed to resolve import "../scripts/lib/geoid.mjs"`

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/lib/geoid.mjs`. **No shebang.**

```js
/**
 * Census FIPS geoid derivation for TT entities.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * PURE: no I/O, no network, no database. Callers parse the Census PEP files
 * (scripts/lib/censusPep.mjs) and hand the rows in. That is what makes every
 * rule here testable from a small fixture.
 *
 * Every resolver returns the SAME shape:
 *   { geoid: string|null, basis: string|null, reason: string|null }
 * so the driver can tally outcomes without special-casing a tier. A null geoid
 * always carries a reason; a non-null geoid always carries a basis.
 */

/** abbrev -> 2-digit state FIPS. TEXT, because '01' is not 1.
 *  ⚠ Verified against co-est2024-alldata.csv by tests/geoidMatch.test.mjs —
 *  this table is not trusted on its own. */
export const STATE_FIPS = Object.freeze({
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
  MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32',
  NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47',
  TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55',
  WY: '56',
});

/** The only legal `geoid_basis` strings. */
export const BASIS = Object.freeze({
  state: 'static-state-fips',
  county: 'census-pep-050-exact',
  place: 'census-pep-162-exact',
  township: 'census-pep-061-county-scoped',
});

const hit = (geoid, basis) => ({ geoid, basis, reason: null });
const miss = (reason) => ({ geoid: null, basis: null, reason });

export function resolveState(abbrev) {
  const fips = STATE_FIPS[abbrev];
  return fips ? hit(fips, BASIS.state) : miss(`no state FIPS for abbrev ${abbrev}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/geoid.mjs tests/geoidMatch.test.mjs
git commit -m "feat(geoid): state FIPS table, verified against the Census county file"
```

---

## Task 2: County geoid (SUMLEV 050)

**Files:**
- Modify: `scripts/lib/geoid.mjs`
- Test: `tests/geoidMatch.test.mjs`

**Interfaces:**
- Consumes: `BASIS`, `miss`/`hit` helpers from Task 1
- Produces:
  - `export function buildCountyIndex(rows: object[], stateFips: string): Map<string, string>` — normalised county name → 3-digit `COUNTY` FIPS
  - `export function resolveCounty(index: Map<string,string>, stateFips: string, storedName: string): {geoid, basis, reason}`

TT stores counties as `"Monroe County"`; Census `CTYNAME` is also `"Monroe County"`. Both sides drop the trailing `County`/`Parish`/`Borough` word before comparison so Louisiana and Alaska behave.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/geoidMatch.test.mjs
import { buildCountyIndex, resolveCounty } from '../scripts/lib/geoid.mjs';

describe('resolveCounty', () => {
  const rows = [
    { SUMLEV: '050', STATE: '18', COUNTY: '105', STNAME: 'Indiana', CTYNAME: 'Monroe County' },
    { SUMLEV: '050', STATE: '18', COUNTY: '097', STNAME: 'Indiana', CTYNAME: 'Marion County' },
    { SUMLEV: '050', STATE: '18', COUNTY: '141', STNAME: 'Indiana', CTYNAME: 'St. Joseph County' },
    { SUMLEV: '040', STATE: '18', COUNTY: '000', STNAME: 'Indiana', CTYNAME: 'Indiana' },
    { SUMLEV: '050', STATE: '26', COUNTY: '091', STNAME: 'Michigan', CTYNAME: 'Lenawee County' },
  ];
  const idx = buildCountyIndex(rows, '18');

  it('ignores rows from other states and non-county SUMLEVs', () => {
    expect(idx.size).toBe(3);
  });

  it('composes STATE+COUNTY, preserving the leading zero', () => {
    expect(resolveCounty(idx, '18', 'Marion County')).toEqual({
      geoid: '18097', basis: 'census-pep-050-exact', reason: null,
    });
  });

  it('matches a county whose name carries punctuation', () => {
    expect(resolveCounty(idx, '18', 'St. Joseph County').geoid).toBe('18141');
  });

  it('returns a null with a reason when the county is absent', () => {
    const r = resolveCounty(idx, '18', 'Nowhere County');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no county match for "Nowhere County"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: FAIL — `buildCountyIndex is not a function`

- [ ] **Step 3: Write the minimal implementation**

Append to `scripts/lib/geoid.mjs`:

```js
/** Normalise for matching only — never for display. Drops the trailing
 *  jurisdiction word so Parish (LA) and Borough (AK) behave like County. */
function countyKey(name) {
  return String(name)
    .replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough)$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function buildCountyIndex(rows, stateFips) {
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '050' || r.STATE !== stateFips) continue;
    idx.set(countyKey(r.CTYNAME), r.COUNTY);
  }
  return idx;
}

export function resolveCounty(index, stateFips, storedName) {
  const county = index.get(countyKey(storedName));
  return county
    ? hit(stateFips + county, BASIS.county)
    : miss(`no county match for "${storedName}"`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/geoid.mjs tests/geoidMatch.test.mjs
git commit -m "feat(geoid): county geoid from SUMLEV 050"
```

---

## Task 3: Place geoid (SUMLEV 162)

**Files:**
- Modify: `scripts/lib/geoid.mjs`
- Create: `tests/fixtures/census/in-place-slice.csv`
- Test: `tests/geoidMatch.test.mjs`

**Interfaces:**
- Produces:
  - `export function buildPlaceIndex(rows: object[]): Map<string, Set<string>>` — key → set of 7-digit place geoids
  - `export function resolvePlace(index: Map<string,Set<string>>, storedName: string): {geoid, basis, reason}`

TT stores `"Bloomington"`; Census stores `"Bloomington city"`. The designator is **appended to the TT name** to form candidate keys rather than stripped from the Census name — because Census lowercases the designator even when it is part of the legal name (`Everglades city` is the City of Everglades City), so stripping invents a place that does not exist.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/geoidMatch.test.mjs
import { buildPlaceIndex, resolvePlace } from '../scripts/lib/geoid.mjs';

describe('resolvePlace', () => {
  const rows = [
    { SUMLEV: '162', STATE: '18', PLACE: '05860', NAME: 'Bloomington city' },
    { SUMLEV: '162', STATE: '18', PLACE: '82700', NAME: 'Westfield city' },
    { SUMLEV: '162', STATE: '18', PLACE: '21000', NAME: 'Ellettsville town' },
    { SUMLEV: '162', STATE: '12', PLACE: '21525', NAME: 'Everglades city' },
    { SUMLEV: '157', STATE: '18', PLACE: '05860', COUNTY: '105', NAME: 'Bloomington city' },
  ];
  const idx = buildPlaceIndex(rows);

  it('indexes only whole-place rows, never place PARTS', () => {
    // a 157 row shares PLACE with its 162 row; counting it twice would look
    // like an ambiguity and null out a perfectly good match
    expect(resolvePlace(idx, 'Bloomington').geoid).toBe('1805860');
  });

  it('composes STATE+PLACE', () => {
    expect(resolvePlace(idx, 'Westfield')).toEqual({
      geoid: '1882700', basis: 'census-pep-162-exact', reason: null,
    });
  });

  it('matches a town as readily as a city', () => {
    expect(resolvePlace(idx, 'Ellettsville').geoid).toBe('1821000');
  });

  // ⚠ Everglades City is the CITY OF EVERGLADES CITY. Census renders it
  // "Everglades city", identical to how it renders the city of Everglades —
  // which does not exist. Appending designators to the TT name finds it;
  // stripping the Census tail yields "Everglades", which names nothing.
  it('matches a place whose legal name ends in a designator word', () => {
    expect(resolvePlace(idx, 'Everglades City').geoid).toBe('1221525');
  });

  it('returns a null with a reason when absent', () => {
    const r = resolvePlace(idx, 'Nowheresville');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no place match for "Nowheresville"');
  });

  it('returns a null with a reason when ambiguous — never picks', () => {
    const dupes = buildPlaceIndex([
      { SUMLEV: '162', STATE: '27', PLACE: '40514', NAME: 'Marine on Saint Croix city' },
      { SUMLEV: '162', STATE: '27', PLACE: '40518', NAME: 'Marine on Saint Croix city' },
    ]);
    const r = resolvePlace(dupes, 'Marine on Saint Croix');
    expect(r.geoid).toBeNull();
    expect(r.reason).toMatch(/^ambiguous place match for "Marine on Saint Croix": /);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: FAIL — `buildPlaceIndex is not a function`

- [ ] **Step 3: Write the minimal implementation**

Append to `scripts/lib/geoid.mjs`:

```js
/** Census appends a lowercase designator to every place NAME. */
const PLACE_DESIGNATORS = [
  'city', 'town', 'village', 'borough', 'municipality',
  'urban county', 'metro government', 'consolidated government',
];

function placeKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildPlaceIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    // ⚠ 162 ONLY. A 157 row is a place PART and repeats its parent's PLACE
    // code; counting it would manufacture an ambiguity out of one real place.
    if (r.SUMLEV !== '162') continue;
    const k = placeKey(r.NAME);
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(r.STATE + r.PLACE);
  }
  return idx;
}

export function resolvePlace(index, storedName) {
  // Append designators to the TT name rather than stripping them off the
  // Census name — see the Everglades City case in the tests.
  const candidates = [
    placeKey(storedName),
    ...PLACE_DESIGNATORS.map((d) => placeKey(storedName + ' ' + d)),
  ];
  for (const k of candidates) {
    const set = index.get(k);
    if (!set) continue;
    if (set.size > 1) {
      return miss(`ambiguous place match for "${storedName}": ${[...set].join(', ')}`);
    }
    return hit([...set][0], BASIS.place);
  }
  return miss(`no place match for "${storedName}"`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/geoid.mjs tests/geoidMatch.test.mjs
git commit -m "feat(geoid): place geoid from SUMLEV 162, designator appended not stripped"
```

---

## Task 4: Township geoid (SUMLEV 061) — the Adrian regression

This is the task the whole design turns on. **Measured:** with the designator stripped, Michigan produced 105 ambiguous townships; with it required, 1,240 of 1,240 resolve and 0 are ambiguous.

**Files:**
- Modify: `scripts/lib/geoid.mjs`
- Create: `tests/fixtures/census/mi-adrian-slice.csv`
- Test: `tests/geoidMatch.test.mjs`

**Interfaces:**
- Produces:
  - `export function buildMcdIndex(rows: object[]): Map<string, Set<string>>` — key `` `${COUNTY}|${normalisedTownshipName}` `` → set of 10-digit MCD geoids
  - `export function resolveTownship(mcdIndex, countyIndex, stateFips: string, storedName: string): {geoid, basis, reason}`

TT stores Michigan townships as `"Acme Township, Grand Traverse County"` — township and county in one string. The county half scopes the lookup, which is what makes 117 township names naming 302 townships unambiguous.

- [ ] **Step 1: Create the fixture**

Create `tests/fixtures/census/mi-adrian-slice.csv` — a real slice showing why the designator matters. Both rows are SUMLEV 061 in Lenawee County (`091`):

```csv
SUMLEV,STATE,COUNTY,PLACE,COUSUB,CONCIT,PRIMGEO_FLAG,FUNCSTAT,NAME,STNAME,ESTIMATESBASE2020,POPESTIMATE2020,POPESTIMATE2021,POPESTIMATE2022,POPESTIMATE2023,POPESTIMATE2024
050,26,091,00000,00000,00000,0,A,Lenawee County,Michigan,99423,99400,99310,99250,99180,99120
061,26,091,00000,00420,00000,1,A,Adrian city,Michigan,20645,20640,20600,20560,20520,20490
061,26,091,00000,00440,00000,1,A,Adrian township,Michigan,5920,5918,5910,5902,5895,5890
061,26,091,00000,52080,00000,1,A,Madison charter township,Michigan,8410,8405,8398,8390,8383,8377
162,26,091,00440,00000,00000,0,A,Adrian city,Michigan,20645,20640,20600,20560,20520,20490
```

- [ ] **Step 2: Write the failing test**

```js
// append to tests/geoidMatch.test.mjs
import { buildMcdIndex, resolveTownship } from '../scripts/lib/geoid.mjs';

describe('resolveTownship', () => {
  const rows = readPepCsv('tests/fixtures/census/mi-adrian-slice.csv');
  const mcd = buildMcdIndex(rows);
  const counties = buildCountyIndex(rows, '26');

  // ⚠⚠ THE REGRESSION. In an MCD state an incorporated CITY is also a county
  // subdivision, so "Adrian city" and "Adrian township" are BOTH SUMLEV-061
  // rows in Lenawee County. Stripping the designator collapses them to the
  // same key. That produced 105 false ambiguities in Michigan alone, each one
  // a chance to attach a city's geoid to a township.
  it('does not confuse "Adrian city" with "Adrian township"', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township, Lenawee County');
    expect(r.geoid).toBe('2609100440');   // the TOWNSHIP's COUSUB, not the city's
    expect(r.basis).toBe('census-pep-061-county-scoped');
    expect(r.reason).toBeNull();
  });

  it('composes STATE+COUNTY+COUSUB — ten digits', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township, Lenawee County');
    expect(r.geoid).toHaveLength(10);
  });

  it('matches a charter township', () => {
    const r = resolveTownship(mcd, counties, '26', 'Madison Charter Township, Lenawee County');
    expect(r.geoid).toBe('2609152080');
  });

  it('never returns a city geoid for any township query', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township, Lenawee County');
    expect(r.geoid).not.toBe('2609100420'); // "Adrian city" as an MCD
  });

  it('returns a null with a reason when the stored name has no county half', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('township name carries no county: "Adrian Township"');
  });

  it('returns a null with a reason when the county half does not resolve', () => {
    const r = resolveTownship(mcd, counties, '26', 'Acme Township, Nowhere County');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no county match for "Nowhere County"');
  });

  it('returns a null with a reason when the township is absent in that county', () => {
    const r = resolveTownship(mcd, counties, '26', 'Nosuch Township, Lenawee County');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no township match for "Nosuch" in county 091');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: FAIL — `buildMcdIndex is not a function`

- [ ] **Step 4: Write the minimal implementation**

Append to `scripts/lib/geoid.mjs`:

```js
/** Matches a Census MCD name that is genuinely a township. */
const CENSUS_TOWNSHIP_RE = /\s+(charter\s+)?township$/i;
/** Matches the township designator on a TT-stored name. */
const STORED_TOWNSHIP_RE = /\s+(Charter\s+)?Township$/i;

function townshipKey(bareName) {
  return String(bareName).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function buildMcdIndex(rows) {
  const idx = new Map();
  for (const r of rows) {
    if (r.SUMLEV !== '061') continue;
    // ⚠⚠ REQUIRED, NOT STRIPPED. In an MCD state an incorporated city is also
    // a county subdivision — "Adrian city" and "Adrian township" are both 061
    // rows in Lenawee County. Admitting anything that is not literally a
    // township is what collapsed them. 105 false ambiguities in MI alone.
    if (!CENSUS_TOWNSHIP_RE.test(r.NAME)) continue;
    const k = r.COUNTY + '|' + townshipKey(r.NAME.replace(CENSUS_TOWNSHIP_RE, ''));
    if (!idx.has(k)) idx.set(k, new Set());
    idx.get(k).add(r.STATE + r.COUNTY + r.COUSUB);
  }
  return idx;
}

export function resolveTownship(mcdIndex, countyIndex, stateFips, storedName) {
  // TT stores "Acme Township, Grand Traverse County" — both halves in one
  // string. The county half is what disambiguates 117 names naming 302
  // townships.
  const comma = storedName.lastIndexOf(',');
  if (comma === -1) {
    return miss(`township name carries no county: "${storedName}"`);
  }
  const twpHalf = storedName.slice(0, comma).replace(STORED_TOWNSHIP_RE, '').trim();
  const countyHalf = storedName.slice(comma + 1).trim();

  const county = countyIndex.get(countyKey(countyHalf));
  if (!county) return miss(`no county match for "${countyHalf}"`);

  const set = mcdIndex.get(county + '|' + townshipKey(twpHalf));
  if (!set) return miss(`no township match for "${twpHalf}" in county ${county}`);
  if (set.size > 1) {
    return miss(`ambiguous township match for "${storedName}": ${[...set].join(', ')}`);
  }
  return hit([...set][0], BASIS.township);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/geoidMatch.test.mjs`
Expected: PASS (22 tests)

- [ ] **Step 6: Run the whole suite — nothing else may break**

Run: `npm test`
Expected: PASS, no new failures.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/geoid.mjs tests/geoidMatch.test.mjs tests/fixtures/census/mi-adrian-slice.csv
git commit -m "feat(geoid): township geoid from SUMLEV 061, county-scoped

⚠⚠ The Census designator is REQUIRED, never stripped. In an MCD state an
incorporated city is ALSO a county subdivision, so 'Adrian city' and 'Adrian
township' are both 061 rows in Lenawee County. Stripping collapsed them and
produced 105 false ambiguities in Michigan alone — each one a chance to
attach a city's geoid to a township. Fixture locks the case."
```

---

## Task 5: The migration — columns and a tier-keyed CHECK

**Files:**
- Create: `supabase/migrations/20260912000000_municipalities_geoid.sql`

Applied with `mcp__supabase-local__apply_migration` (name: `municipalities_geoid`), then committed. House style: a self-verifying `DO` block that `RAISE EXCEPTION`s on failure.

- [ ] **Step 1: Write the migration**

```sql
-- Civic Spaces Asks 1+2: a Census FIPS geoid on every geographic TT entity.
--
-- ⚠ `text`, not a number: '01073' is Jefferson County, AL, and an integer
--    column eats the leading zero silently.
-- ⚠ NULLABLE with NO DEFAULT. A NOT NULL DEFAULT on a column meaning "we know
--    this" is the fiscal_year_start_month defect — it would assert a geoid TT
--    never derived, on every row, and nothing would fail.
-- ⚠ geoid and geoid_basis travel together. A value with no provenance cannot
--    be told apart from a guess later.

ALTER TABLE treasury.municipalities ADD COLUMN IF NOT EXISTS geoid text;
ALTER TABLE treasury.municipalities ADD COLUMN IF NOT EXISTS geoid_basis text;

COMMENT ON COLUMN treasury.municipalities.geoid IS
  'Census FIPS geoid. Length is tier-determined: state 2, county 5, place-tier 7, township 10 (county-subdivision). NULL means TT could not derive one with confidence — never a guess.';
COMMENT ON COLUMN treasury.municipalities.geoid_basis IS
  'How the geoid was derived: static-state-fips | census-pep-050-exact | census-pep-162-exact | census-pep-061-county-scoped.';

-- Length is a function of the tier, so a wrong-length value cannot be stored.
-- ELSE -1 means any geoid on a non-geographic entity_type (federal, nonprofit,
-- special_district, school_district, conservancy, library) is rejected.
ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_geoid_shape;
ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_geoid_shape CHECK (
    geoid IS NULL OR (
      geoid ~ '^[0-9]+$'
      AND length(geoid) = CASE entity_type
        WHEN 'state'        THEN 2
        WHEN 'county'       THEN 5
        WHEN 'township'     THEN 10
        WHEN 'city'         THEN 7
        WHEN 'town'         THEN 7
        WHEN 'village'      THEN 7
        WHEN 'borough'      THEN 7
        WHEN 'municipality' THEN 7
        ELSE -1
      END
    )
  );

ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_geoid_basis_paired;
ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_geoid_basis_paired CHECK (
    (geoid IS NULL) = (geoid_basis IS NULL)
  );

CREATE INDEX IF NOT EXISTS municipalities_geoid_idx
  ON treasury.municipalities (geoid) WHERE geoid IS NOT NULL;

-- Self-verification: prove the constraints actually reject what they must.
DO $$
DECLARE bad int := 0; tid uuid;
BEGIN
  SELECT id INTO tid FROM treasury.municipalities WHERE entity_type = 'county' LIMIT 1;

  BEGIN -- a 7-digit place geoid on a county must be rejected
    UPDATE treasury.municipalities SET geoid = '1805860', geoid_basis = 'census-pep-162-exact' WHERE id = tid;
    bad := bad + 1; RAISE WARNING 'CHECK did not reject a 7-digit geoid on a county';
    UPDATE treasury.municipalities SET geoid = NULL, geoid_basis = NULL WHERE id = tid;
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN -- geoid without a basis must be rejected
    UPDATE treasury.municipalities SET geoid = '18105', geoid_basis = NULL WHERE id = tid;
    bad := bad + 1; RAISE WARNING 'CHECK did not reject a geoid with no basis';
    UPDATE treasury.municipalities SET geoid = NULL WHERE id = tid;
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN -- a geoid on a non-geographic type must be rejected
    UPDATE treasury.municipalities SET geoid = '1805860', geoid_basis = 'census-pep-162-exact'
      WHERE entity_type = 'federal';
    bad := bad + 1; RAISE WARNING 'CHECK did not reject a geoid on entity_type federal';
    UPDATE treasury.municipalities SET geoid = NULL, geoid_basis = NULL WHERE entity_type = 'federal';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  IF bad > 0 THEN
    RAISE EXCEPTION 'municipalities geoid migration: % checks failed (see warnings)', bad;
  END IF;
  RAISE NOTICE 'OK — geoid/geoid_basis added; tier-keyed length CHECK and pairing CHECK both reject bad values';
END $$;
```

- [ ] **Step 2: Apply it**

Use `mcp__supabase-local__apply_migration` with name `municipalities_geoid` and the SQL above.
Expected: success, with the `OK — geoid/geoid_basis added…` notice. If any `RAISE WARNING` fires, the migration aborts — fix the constraint, do not weaken the check.

- [ ] **Step 3: Verify the columns exist and are empty**

Run via `mcp__supabase-local__execute_sql`:

```sql
select count(*) as total,
       count(geoid) as with_geoid,
       count(geoid_basis) as with_basis
from treasury.municipalities;
```

Expected: `total` 8184, `with_geoid` 0, `with_basis` 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260912000000_municipalities_geoid.sql
git commit -m "feat(geoid): add geoid + geoid_basis to municipalities with a tier-keyed CHECK"
```

---

## Task 6: The backfill driver

**Files:**
- Create: `scripts/backfillGeoids.mjs`

**Interfaces:**
- Consumes: everything exported from `scripts/lib/geoid.mjs`; `readPepCsv` from `scripts/lib/censusPep.mjs`
- Produces: a SQL file at the path given by `--out`, plus a per-state report on stdout

The script owns all I/O and **no matching logic**. It emits SQL rather than writing directly, so the derivation is reviewable, idempotent, re-runnable, and needs no service-role key — the repo's Supabase credentials have been unreliable, and the derivation should not depend on them.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
/**
 * Backfill treasury.municipalities.geoid from Census PEP bulk files.
 *
 * $0 — free bulk CSVs, no API, no key.
 *
 *   node scripts/backfillGeoids.mjs --out supabase/migrations/20260912000100_backfill_municipality_geoids.sql
 *   node scripts/backfillGeoids.mjs --state MI --dry-run
 *
 * Emits ONE `UPDATE ... FROM (VALUES ...)` statement, so the result is a
 * reviewable artifact rather than an opaque script run, and re-applying it is
 * a no-op. Ambiguities and misses are NEVER written — they are reported.
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { readPepCsv } from './lib/censusPep.mjs';
import {
  STATE_FIPS, buildCountyIndex, buildPlaceIndex, buildMcdIndex,
  resolveState, resolveCounty, resolvePlace, resolveTownship,
} from './lib/geoid.mjs';

const CITY_TIER = new Set(['city', 'town', 'village', 'borough', 'municipality']);
const API = process.env.TT_API || 'https://ev-accounts-api.onrender.com/api/treasury/cities?datasets=summary';
const CACHE = 'cache';
const CO_EST = `${CACHE}/co-est2024-alldata.csv`;
const SUB_EST = (fips) => `${CACHE}/sub-est2024_${Number(fips)}.csv`;
const SUB_URL = (fips) =>
  `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_${Number(fips)}.csv`;
const CO_URL =
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv';

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const onlyState = argOf('--state');
const outPath = argOf('--out');
const dryRun = args.includes('--dry-run');

async function ensure(path, url) {
  if (existsSync(path)) return path;
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

// ── Entities ──────────────────────────────────────────────────────────────
const res = await fetch(API);
if (!res.ok) throw new Error(`entity list: ${res.status}`);
const entities = await res.json();

await ensure(CO_EST, CO_URL);
const coRows = readPepCsv(CO_EST);

const byState = new Map();
for (const m of entities) {
  if (onlyState && m.state !== onlyState) continue;
  if (!byState.has(m.state)) byState.set(m.state, []);
  byState.get(m.state).push(m);
}

const updates = [];
const problems = [];
const totals = { resolved: 0, skipped: 0, missed: 0, ambiguous: 0 };

for (const [abbrev, rows] of [...byState].sort()) {
  const stateFips = STATE_FIPS[abbrev];
  if (!stateFips) {
    problems.push([abbrev, '(state)', `unknown state abbrev ${abbrev}`]);
    continue;
  }

  const countyIdx = buildCountyIndex(coRows, stateFips);
  let placeIdx = new Map(), mcdIdx = new Map();
  const needsSub = rows.some((m) => CITY_TIER.has(m.entity_type) || m.entity_type === 'township');
  if (needsSub) {
    const p = await ensure(SUB_EST(stateFips), SUB_URL(stateFips));
    const subRows = readPepCsv(p);
    placeIdx = buildPlaceIndex(subRows);
    mcdIdx = buildMcdIndex(subRows);
  }

  const tally = { resolved: 0, missed: 0, ambiguous: 0, skipped: 0 };
  for (const m of rows) {
    let r;
    if (m.entity_type === 'state') r = resolveState(m.state);
    else if (m.entity_type === 'county') r = resolveCounty(countyIdx, stateFips, m.name);
    else if (m.entity_type === 'township') r = resolveTownship(mcdIdx, countyIdx, stateFips, m.name);
    else if (CITY_TIER.has(m.entity_type)) r = resolvePlace(placeIdx, m.name);
    else { tally.skipped++; totals.skipped++; continue; }

    if (r.geoid) {
      updates.push([m.id, r.geoid, r.basis]);
      tally.resolved++; totals.resolved++;
    } else {
      problems.push([abbrev, m.name, r.reason]);
      if (r.reason.startsWith('ambiguous')) { tally.ambiguous++; totals.ambiguous++; }
      else { tally.missed++; totals.missed++; }
    }
  }
  const pct = tally.resolved + tally.missed + tally.ambiguous > 0
    ? ((tally.resolved / (tally.resolved + tally.missed + tally.ambiguous)) * 100).toFixed(1)
    : 'n/a';
  console.log(
    `${abbrev.padEnd(3)} resolved ${String(tally.resolved).padStart(5)}  ` +
    `missed ${String(tally.missed).padStart(4)}  ambiguous ${String(tally.ambiguous).padStart(4)}  ` +
    `skipped ${String(tally.skipped).padStart(3)}  (${pct}%)`
  );
}

console.log(`\nTOTAL resolved ${totals.resolved}  missed ${totals.missed}  ` +
            `ambiguous ${totals.ambiguous}  skipped ${totals.skipped}`);

if (problems.length) {
  console.log(`\nunresolved (${problems.length}):`);
  for (const [st, name, why] of problems) console.log(`   ${st}  ${name}  — ${why}`);
}

// ⚠ An ambiguity is a DEFECT, not a rounding error: it means two real places
// competed and the matcher declined. Fail loudly so nobody ships a silent gap.
if (totals.ambiguous > 0) {
  console.error(`\n⚠ ${totals.ambiguous} ambiguous — review before applying.`);
}

if (dryRun || !outPath) {
  console.log('\n(dry run — no SQL written)');
  process.exit(0);
}

const values = updates
  .map(([id, geoid, basis]) => `  ('${id}'::uuid, '${geoid}', '${basis}')`)
  .join(',\n');

writeFileSync(outPath, `-- Generated by scripts/backfillGeoids.mjs — do not hand-edit.
-- ${updates.length} entities resolved; ${totals.missed} missed, ${totals.ambiguous} ambiguous,
-- ${totals.skipped} skipped as non-geographic. Unresolved rows are left NULL on purpose:
-- null is a correct answer, a wrong geoid is not.
-- Idempotent: re-applying sets the same values.

UPDATE treasury.municipalities AS m
SET geoid = v.geoid, geoid_basis = v.basis
FROM (VALUES
${values}
) AS v(id, geoid, basis)
WHERE m.id = v.id;
`, 'utf8');

console.log(`\nwrote ${updates.length} updates to ${outPath}`);
```

- [ ] **Step 2: Dry-run against Michigan — the hardest state**

Run: `node scripts/backfillGeoids.mjs --state MI --dry-run`
Expected: `MI  resolved  1856  missed    0  ambiguous    0  skipped   0  (100.0%)`

If `ambiguous` is not 0, **stop**. Task 4's designator rule has regressed; do not proceed and do not weaken the rule.

- [ ] **Step 3: Dry-run against Indiana**

Run: `node scripts/backfillGeoids.mjs --state IN --dry-run`
Expected: `resolved 652, missed 7, ambiguous 0` (651 non-state entities + the Indiana state row). The 7 misses are abbreviation variants — `Mt. Ayr`, `Mt. Carmel`, `Parker`, `Pines`, `Windfall`, `Hardinsburg`, `Victoria Woods`. They stay NULL.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfillGeoids.mjs
git commit -m "feat(geoid): backfill driver — Census PEP in, one reviewable SQL migration out"
```

---

## Task 7: Run it nationally, apply, verify

**Files:**
- Create: `supabase/migrations/20260912000100_backfill_municipality_geoids.sql` (generated)
- Create: `scripts/verifyGeoidBackfill.mjs`

- [ ] **Step 1: Generate the national migration**

Run:
```bash
node scripts/backfillGeoids.mjs --out supabase/migrations/20260912000100_backfill_municipality_geoids.sql
```

Expected: a per-state table for ~20 states, then a TOTAL line. Record the real national numbers — they are the input to the *next* plan (the endpoint), and to the reply note to Civic Spaces.

**Stop and report if `ambiguous` > 0 nationally.** Every ambiguity is a place where two real jurisdictions competed; they need eyes before anything is applied.

- [ ] **Step 2: Apply the generated migration**

Use `mcp__supabase-local__apply_migration`, name `backfill_municipality_geoids`, with the generated file's contents.

If the tier-keyed CHECK from Task 5 rejects any row, that is the constraint doing its job: a geoid of the wrong length reached a tier it does not belong to. Fix the matcher, regenerate, do not relax the CHECK.

- [ ] **Step 3: Write the verifier**

Create `scripts/verifyGeoidBackfill.mjs`. It derives its expectations **from the database**, never from a list of its own — a guard that keeps its own copy of the list cannot catch the list being wrong.

```js
#!/usr/bin/env node
/**
 * Verify the geoid backfill. Derives every expectation from the DATABASE —
 * never from a hardcoded roster, which is the failure shape that let 949 PA
 * boroughs go missing while three verifier scripts reported success.
 *
 *   node scripts/verifyGeoidBackfill.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('no SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const db = createClient(url, key);

const EXPECTED_LENGTH = {
  state: 2, county: 5, township: 10,
  city: 7, town: 7, village: 7, borough: 7, municipality: 7,
};
const LEGAL_BASIS = new Set([
  'static-state-fips', 'census-pep-050-exact',
  'census-pep-162-exact', 'census-pep-061-county-scoped',
]);

// ⚠ Page with a total order and assert DISTINCT ids == row count. A paged read
// without one silently repeats and drops rows; this has broken four times.
const rows = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .schema('treasury').from('municipalities')
    .select('id,name,state,entity_type,geoid,geoid_basis')
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw error;
  rows.push(...data);
  if (data.length < PAGE) break;
}
const distinct = new Set(rows.map((r) => r.id));
if (distinct.size !== rows.length) {
  console.error(`FAIL paged read: ${rows.length} rows but ${distinct.size} distinct ids`);
  process.exit(1);
}

let bad = 0;
const fail = (m) => { console.error('FAIL ' + m); bad++; };

for (const r of rows) {
  const expected = EXPECTED_LENGTH[r.entity_type];
  if (r.geoid === null) {
    if (r.geoid_basis !== null) fail(`${r.name} (${r.state}): basis with no geoid`);
    continue;
  }
  if (expected === undefined) {
    fail(`${r.name} (${r.state}): entity_type ${r.entity_type} must not carry a geoid`);
    continue;
  }
  if (r.geoid.length !== expected) {
    fail(`${r.name} (${r.state}): ${r.entity_type} geoid "${r.geoid}" is ${r.geoid.length} digits, expected ${expected}`);
  }
  if (!/^\d+$/.test(r.geoid)) fail(`${r.name} (${r.state}): geoid "${r.geoid}" is not all digits`);
  if (!LEGAL_BASIS.has(r.geoid_basis)) fail(`${r.name} (${r.state}): illegal basis "${r.geoid_basis}"`);
}

// A geoid must identify ONE entity. A duplicate means two TT rows claim the
// same government — the failure a consumer cannot detect from the outside.
const byGeoid = new Map();
for (const r of rows) {
  if (!r.geoid) continue;
  if (!byGeoid.has(r.geoid)) byGeoid.set(r.geoid, []);
  byGeoid.get(r.geoid).push(`${r.name} (${r.state}, ${r.entity_type})`);
}
for (const [geoid, names] of byGeoid) {
  if (names.length > 1) fail(`geoid ${geoid} claimed by ${names.length}: ${names.join(' | ')}`);
}

const withGeoid = rows.filter((r) => r.geoid).length;
const geographic = rows.filter((r) => EXPECTED_LENGTH[r.entity_type] !== undefined).length;
console.log(`${rows.length} rows; ${geographic} geographic; ${withGeoid} carry a geoid ` +
            `(${((withGeoid / geographic) * 100).toFixed(1)}% of geographic)`);
console.log(`${byGeoid.size} distinct geoids`);

if (bad > 0) { console.error(`\n${bad} failures`); process.exit(1); }
console.log('OK — every geoid matches its tier length, is all digits, carries a legal basis, and is unique');
```

- [ ] **Step 4: Run the verifier**

Run: `node scripts/verifyGeoidBackfill.mjs`
Expected: `OK — every geoid matches its tier length, is all digits, carries a legal basis, and is unique`

If `SUPABASE_SERVICE_KEY` is unavailable, run the same four assertions through `mcp__supabase-local__execute_sql` instead — the checks are what matter, not the transport.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260912000100_backfill_municipality_geoids.sql scripts/verifyGeoidBackfill.mjs
git commit -m "feat(geoid): national backfill + verifier

Verifier derives expectations from the database, never a hardcoded roster."
```

- [ ] **Step 6: Open the PR**

```bash
git push -u origin feat/geoid-column-and-backfill
gh pr create --title "feat(geoid): a Census FIPS geoid on every geographic TT entity" --body "..."
```

The PR body must carry the **real national numbers** from Step 1 — resolved / missed / ambiguous per state — not the Indiana and Michigan probe figures. Those two states were measured in advance; the other eighteen were not.

---

## Self-Review

**Spec coverage.** §4.1 schema → Task 5. §4.2 the three backfill rules → Tasks 3, 4, 6 (rule 1 in Task 4's fixture, rule 2 in Task 4's resolver, rule 3 in every resolver's ambiguity branch and Task 6's non-zero exit warning). §3 feasibility numbers → Task 6 Steps 2–3 as expected outputs. §6 matcher unit tests → Tasks 1–4; `scripts/verifyCoverageCatalog.mjs` → **deferred to the endpoint plan by design**, since it fetches the live endpoint that does not exist yet; its DB-derived sibling `verifyGeoidBackfill.mjs` is Task 7. §5, §8 → the endpoint plan. §9 out-of-scope items → no tasks, correctly.

**Placeholder scan.** One deliberate `--body "..."` in Task 7 Step 6, because the body must contain measured numbers that do not exist until Step 1 runs; the step says exactly what must go in it.

**Type consistency.** All resolvers return `{geoid, basis, reason}`. `buildCountyIndex` returns `Map<string,string>`; `buildPlaceIndex` and `buildMcdIndex` return `Map<string,Set<string>>` — and Task 6 treats them accordingly. `countyKey` is defined in Task 2 and reused by `resolveTownship` in Task 4, which is why Task 4 must land after Task 2. Basis strings are identical in `BASIS` (Task 1), the migration comment (Task 5), and `LEGAL_BASIS` (Task 7).

---

## What this plan does NOT do

- **The `/api/treasury/coverage` endpoint** — the EV-Accounts repo, spec §5. Separate plan, written after Task 7's numbers are known.
- **The reply note to Civic Spaces** — spec §8. Belongs with the endpoint, since it quotes the live URL.
- **A curated alias table** for `Mt.` vs `Mount` misses. Deferred until the national miss rate is visible.
- **The `buildFlStatewideEntities.mjs` `exactMatchKey` collision.** This plan does not depend on that function; it does not repair it either.
