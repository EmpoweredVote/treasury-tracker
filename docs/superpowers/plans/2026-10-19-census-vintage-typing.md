# Census Vintage Typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Type a government the current census vintage cannot name by falling back to the newest census vintage that *can*, and use it to load Georgia's held-out filings.

**Architecture:** A new `scripts/lib/censusVintages.mjs` walks a ladder of census place files newest → oldest and stops at the first vintage naming the government, returning its census name, type, PLACE FIPS and the vintage that supplied them. `buildGaStatewideEntities.mjs` calls it where it currently refuses with `no-population`. Georgia's two consolidation cases are handled separately — Bibb as its own entity, Echols as a declared CICOID alias — because neither is a typing problem.

**Tech Stack:** Node ESM (`.mjs`), vitest, Census Bureau Population Estimates CSVs, Supabase RPC `treasury_sync_city_budget`.

**Spec:** `docs/superpowers/specs/2026-10-19-census-vintage-typing-design.md`

## Global Constraints

- **Type from the census, never from the publisher's word.** DCA's City/Town designator contradicts the census in **20 of 530** Georgia municipalities.
- **Every recovered entity records the vintage that typed it.** `vintage` is never optional on a resolution.
- **Read CSV columns by header name, never by position.** The 2013 layout has no `PRIMGEO_FLAG`; `NAME` is index 7 there and index 8 from 2014 on.
- **Tests read committed fixtures under `tests/fixtures/census/`, never `cache/`.** `cache/` is gitignored in full (`.gitignore:121`); a test reading it passes locally and fails collection in CI.
- **Population stays `null`** for an entity no current vintage names. The naming vintage's figure is recorded in `populationSource` prose only.
- **Ladder ships as `[2024, 2019, 2014, 2013]`**, newest first, as a parameter rather than a buried constant.
- **Assert dollar totals**, never `tree.length` and never presence-of-amount.
- ⚠⚠ **`loadGeorgiaRLGF.mjs` parses args with `strict: false` — an unknown flag is silently ignored.** Its whole surface is `--dir`, `--entity` (ONE key), `--fy`, `--commit`, `--dry-run`, `--slice`. `buildGaStatewideEntities.mjs` takes `--dir`, `--enumeration`, `--out`, `--kind`, `--dry-run` and is strict, so it throws on a typo. Do not invent flags for either.
- **`treasury.budgets` columns are `total_budget` and `hierarchy`** — `total` and `tree` return null rather than erroring.
- **Frozen invariant must end unchanged at `62587 / 60098de6`.**
- Branch is `feat/census-vintage-typing`; open a PR, never push to `main`.

## Review Focus

1. **A ladder vintage file absent from `cache/`** — the resolver must report *"vintage 2014 not present"* distinctly from *"no vintage names it"*, or an unfetched file silently becomes a refusal. Pinned in Task 3.
2. **A place typed differently by two vintages** (`town` in 2013, `city` in 2019) — newest-naming-vintage must win, and the loser must not leak into the type. Pinned in Task 3.
3. **SUMLEV 157 `(pt.)` rows leaking into the place map** — the 2019 GA file carries `McRae-Helena city (pt.)` twice; a missing SUMLEV filter would create a place named `McRae-Helena city (pt.)`. Pinned in Task 2.
4. **Space-squash collisions inside an older vintage** — measured unambiguous only across Vintage 2024's 537 places; an older roster has different membership and must be asserted on its own. Pinned in Task 2.
5. **A recovered entity colliding with a loaded one** on `key` or on `(name, state, entity_type)` — `treasury_ensure_municipality` keys on the type, so a collision creates a duplicate government rather than failing. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/censusVintages.mjs` | **Create.** Vintage ladder: read a vintage file by header, resolve a publisher name to the newest vintage that names it. |
| `scripts/fetchCensusVintages.mjs` | **Create.** Download ladder vintages for a state into `cache/`. |
| `tests/fixtures/census/sub-est{2019,2014,2013}-ga-places-slice.csv` | **Create.** Committed GA slices backing the tests. |
| `tests/censusVintages.test.mjs` | **Create.** Reader and ladder tests. |
| `scripts/buildGaStatewideEntities.mjs` | **Modify.** `GA_FIRST_YEAR` → 2009; ladder call replacing the `no-population` refusal; new entity fields. |
| `scripts/data/georgiaStatewideMunicipalities.mjs` | **Regenerate.** |
| `scripts/data/gaBibbPredecessor.mjs` | **Create.** The `Bibb County` predecessor entity and its boundary assertions. |
| `scripts/loadGeorgiaRLGF.mjs` | **Modify.** `GA_CICOID_ALIASES`, alias-aware `entityByCicoid`, strengthened duplicate assertion. |
| `scripts/data/gaRlgfAnomalies.mjs` | **Modify.** Replace the two held-out register entries with the resolution; add the Ranger/Sunny Side flag. |
| `scripts/auditCensusVintageGaps.mjs` | **Create.** Read-only cross-state audit. |
| `tests/gaStatewide.test.mjs` | **Modify.** The pinned Ranger/Sunny Side refusal test inverts. |

---

### Task 1: Fetch the older vintages and commit GA fixtures

**Files:**
- Create: `scripts/fetchCensusVintages.mjs`
- Create: `tests/fixtures/census/sub-est2019-ga-places-slice.csv`
- Create: `tests/fixtures/census/sub-est2014-ga-places-slice.csv`
- Create: `tests/fixtures/census/sub-est2013-ga-places-slice.csv`

**Interfaces:**
- Consumes: nothing.
- Produces: `VINTAGE_URLS: Record<number, (stateFips: string) => string>`, `cache/sub-est{2019,2014,2013}_13.csv`, and three committed fixtures.

⚠ Each vintage lives under a *different* dataset directory — the year in the path is the series end, not the vintage. Do not try to derive one pattern.

- [ ] **Step 1: Write the fetch script**

```javascript
// scripts/fetchCensusVintages.mjs
/**
 * Download Census Bureau subcounty population files for a state.
 *
 * ⚠ The directory segment is the SERIES, not the vintage: vintage 2013 lives
 * under 2010-2013, vintage 2019 under 2010-2019. There is no single pattern to
 * derive — each is declared.
 *
 * Free, keyless, public. Writes to cache/, which is gitignored; the committed
 * fixtures under tests/fixtures/census/ are what tests read.
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://www2.census.gov/programs-surveys/popest/datasets';

export const VINTAGE_URLS = Object.freeze({
  2024: (fips) => `${BASE}/2020-2024/cities/totals/sub-est2024_${fips}.csv`,
  2019: (fips) => `${BASE}/2010-2019/cities/totals/sub-est2019_${fips}.csv`,
  2014: (fips) => `${BASE}/2010-2014/cities/totals/sub-est2014_${fips}.csv`,
  2013: (fips) => `${BASE}/2010-2013/cities/totals/sub-est2013_${fips}.csv`,
});

export async function fetchVintages(stateFips, vintages = [2024, 2019, 2014, 2013], log = console.log) {
  const out = [];
  mkdirSync(join(ROOT, 'cache'), { recursive: true });
  for (const v of vintages) {
    const dest = join(ROOT, `cache/sub-est${v}_${stateFips}.csv`);
    if (existsSync(dest)) { log(`  vintage ${v}: already cached`); out.push({ vintage: v, dest, cached: true }); continue; }
    const url = VINTAGE_URLS[v](stateFips);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`vintage ${v} for state ${stateFips}: HTTP ${res.status} from ${url}`);
    const body = Buffer.from(await res.arrayBuffer());
    writeFileSync(dest, body);
    log(`  vintage ${v}: ${body.length} bytes -> ${dest}`);
    out.push({ vintage: v, dest, cached: false });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  const fips = process.argv[2] ?? '13';
  await fetchVintages(fips);
}
```

- [ ] **Step 2: Run it for Georgia**

Run: `node scripts/fetchCensusVintages.mjs 13`
Expected: vintage 2024 already cached; 2019, 2014, 2013 downloaded (~170KB, ~134KB, ~124KB).

- [ ] **Step 3: Cut the three fixtures**

⚠ The fixture must be a **byte extract** of the source — header plus the matching rows, unmodified — so the "fixture honest against source" test can compare lines verbatim. Keep every SUMLEV 162 GA row plus the 157 rows for the seven governments, so the `(pt.)` filter in Task 2 has something to filter.

Run:
```bash
for V in 2019 2014 2013; do
  head -1 "cache/sub-est${V}_13.csv" > "tests/fixtures/census/sub-est${V}-ga-places-slice.csv"
  awk -F, '$1=="162"||$1=="157"' "cache/sub-est${V}_13.csv" >> "tests/fixtures/census/sub-est${V}-ga-places-slice.csv"
  echo "${V}: $(wc -l < tests/fixtures/census/sub-est${V}-ga-places-slice.csv) lines"
done
```
Expected: three files, each with a header and several hundred rows.

- [ ] **Step 4: Confirm the seven are present in the fixtures**

Run:
```bash
for V in 2019 2014 2013; do
  echo -n "$V: "
  awk -F, '$1=="162"' "tests/fixtures/census/sub-est${V}-ga-places-slice.csv" \
    | grep -ciE ',(Ranger town|Sunny Side city|Helena city|McRae city|Payne city|Riverside town|Macon city),'
done
```
Expected: `2019: 2`, `2014: 6`, `2013: 4`. Anything else means the fixture is wrong — stop and re-cut.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetchCensusVintages.mjs tests/fixtures/census/
git commit -m "feat(census): fetch older subcounty vintages and commit GA fixtures"
```

---

### Task 2: Read a vintage file by header name

**Files:**
- Create: `scripts/lib/censusVintages.mjs`
- Test: `tests/censusVintages.test.mjs`

**Interfaces:**
- Consumes: the fixtures from Task 1.
- Produces: `readPlaceVintage(file, { vintage, stateFips }) → Map<squashedName, { censusName, base, censusType, placeFips, population, vintage }>`, and `squash(s) → string`.

- [ ] **Step 1: Write the failing tests**

```javascript
// tests/censusVintages.test.mjs
import { describe, it, expect } from 'vitest';
import { readPlaceVintage, squash } from '../scripts/lib/censusVintages.mjs';

const FIX = (v) => `tests/fixtures/census/sub-est${v}-ga-places-slice.csv`;

describe('readPlaceVintage reads by header name, not by column position', () => {
  /**
   * ⚠⚠ THE 2013 LAYOUT HAS NO `PRIMGEO_FLAG`. `NAME` sits at index 7 in 2013
   * and index 8 from 2014 on. A positional read returns the STNAME column —
   * i.e. it types four Georgia governments as "Georgia". This happened during
   * the scoping probe; it failed visibly in a shell and would have failed
   * silently in a loader.
   */
  it('reads the 2013 layout, which is one column narrower', () => {
    const places = readPlaceVintage(FIX(2013), { vintage: 2013, stateFips: '13' });
    const macon = places.get(squash('Macon city'));
    expect(macon).toBeDefined();
    expect(macon.censusName).toBe('Macon city');
    expect(macon.base).toBe('Macon');
    expect(macon.censusType).toBe('city');
    expect(macon.placeFips).toBe('49000');
    expect(macon.vintage).toBe(2013);
  });

  it('reads the 2019 layout and takes POPESTIMATE<vintage> as the population', () => {
    const places = readPlaceVintage(FIX(2019), { vintage: 2019, stateFips: '13' });
    const ranger = places.get(squash('Ranger town'));
    expect(ranger.censusType).toBe('town');
    expect(ranger.placeFips).toBe('63560');
    expect(Number.isInteger(ranger.population)).toBe(true);
  });

  it('⚠ EXCLUDES SUMLEV 157 `(pt.)` rows, which would become places of their own', () => {
    const places = readPlaceVintage(FIX(2019), { vintage: 2019, stateFips: '13' });
    for (const v of places.values()) expect(v.censusName).not.toMatch(/\(pt\.\)/);
    expect(places.get(squash('McRae-Helena city'))).toBeDefined();
  });

  it('⚠ asserts the space-squash is unambiguous IN THIS vintage, not in 2024', () => {
    // Measured safe across Vintage 2024's 537 places. An older roster has
    // different membership, so it gets its own assertion rather than inheriting one.
    for (const v of [2019, 2014, 2013]) {
      const places = readPlaceVintage(FIX(v), { vintage: v, stateFips: '13' });
      const seen = new Map();
      for (const p of places.values()) {
        const k = squash(p.censusName);
        expect(seen.has(k), `vintage ${v} squash collision: ${p.censusName} vs ${seen.get(k)}`).toBe(false);
        seen.set(k, p.censusName);
      }
      expect(places.size).toBeGreaterThan(500);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/censusVintages.test.mjs`
Expected: FAIL — `Failed to resolve import "../scripts/lib/censusVintages.mjs"`.

- [ ] **Step 3: Write the reader**

```javascript
// scripts/lib/censusVintages.mjs
/**
 * Census place files across VINTAGES, so a government the current vintage
 * cannot name can still be typed by the newest vintage that can.
 *
 * ⚠⚠ TT types an entity from the census and never from the word a publisher
 * prints — DCA's designator contradicts the census in 20 of 530 Georgia
 * municipalities. A 2024 vintage cannot name a government that ended before
 * 2024, so that discipline silently refuses every dead government. This module
 * is how the discipline is kept without losing them.
 */
import { readFileSync, existsSync } from 'node:fs';

export const squash = (s) => s.toLowerCase().replace(/\s+/g, '');

/**
 * Read one vintage's SUMLEV=162 incorporated places for a state.
 *
 * ⚠⚠ COLUMNS ARE READ BY HEADER NAME. The 2013 layout has no `PRIMGEO_FLAG`,
 * so every index after `CONCIT` shifts by one. A positional read returns the
 * state name as the place name.
 *
 * ⚠ SUMLEV 157 rows are place-within-county PARTS (`McRae-Helena city (pt.)`)
 * and are excluded; admitting them invents places.
 */
export function readPlaceVintage(file, { vintage, stateFips }) {
  const text = readFileSync(file, 'latin1');
  const [head, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(',');
  const ix = (n) => {
    const i = cols.indexOf(n);
    if (i < 0) throw new Error(`${file}: no ${n} column — header is ${head}`);
    return i;
  };
  const iSum = ix('SUMLEV'); const iState = ix('STATE'); const iPlace = ix('PLACE');
  const iName = ix('NAME'); const iPop = ix(`POPESTIMATE${vintage}`);

  const out = new Map();
  for (const line of lines) {
    const f = line.split(',');
    if (f[iSum] !== '162' || f[iState] !== stateFips) continue;
    const name = f[iName].trim();
    const m = name.match(/^(.*) (city|town|village|borough)$/);
    out.set(squash(name), {
      censusName: name,
      base: m ? m[1] : name,
      censusType: m ? m[2] : null,
      placeFips: f[iPlace],
      population: Number(f[iPop]),
      vintage,
    });
  }
  return out;
}

/** Whether a vintage's file is present for a state. */
export function vintageFile(root, vintage, stateFips) {
  const p = `${root}/cache/sub-est${vintage}_${stateFips}.csv`;
  return existsSync(p) ? p : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/censusVintages.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/censusVintages.mjs tests/censusVintages.test.mjs
git commit -m "feat(census): read a place vintage by header name, excluding (pt.) rows"
```

---

### Task 3: The ladder — resolve to the newest vintage that names a government

**Files:**
- Modify: `scripts/lib/censusVintages.mjs`
- Test: `tests/censusVintages.test.mjs`

**Interfaces:**
- Consumes: `readPlaceVintage`, `squash`, `vintageFile` from Task 2.
- Produces:
  `DEFAULT_LADDER = [2024, 2019, 2014, 2013]`
  `resolvePlace(publisherName, { ladders }) → { censusName, base, entityType, placeFips, vintage, population, how } | { why, tried, missing }`
  `loadLadder(root, stateFips, vintages) → Array<{ vintage, places }>` (newest first; absent vintages reported, not silently dropped).

⚠ `resolvePlace` reuses the existing suffix → legal → retyped cascade, **in that order**, per vintage. `legal` before `retyped` is what stops `Mountain City` becoming `Mountain` + town.

- [ ] **Step 1: Write the failing tests**

```javascript
// append to tests/censusVintages.test.mjs
import { resolvePlace, loadLadder, DEFAULT_LADDER } from '../scripts/lib/censusVintages.mjs';

const ladders = [2024, 2019, 2014, 2013].map((v) => ({
  vintage: v,
  places: readPlaceVintage(
    v === 2024 ? 'tests/fixtures/census/sub-est2024-ga-places-slice.csv' : FIX(v),
    { vintage: v, stateFips: '13' },
  ),
}));

describe('the ladder stops at the newest vintage that names the government', () => {
  it('resolves all seven held-out Georgia municipalities to exact triples', () => {
    const expected = {
      'Ranger Town':      { entityType: 'town', placeFips: '63560', vintage: 2019 },
      'Sunny Side City':  { entityType: 'city', placeFips: '74572', vintage: 2019 },
      'Helena':           { entityType: 'city', placeFips: '37816', vintage: 2014 },
      'McRae':            { entityType: 'city', placeFips: '49084', vintage: 2014 },
      'Payne City':       { entityType: 'city', placeFips: '59584', vintage: 2014 },
      'Riverside Town':   { entityType: 'town', placeFips: '65604', vintage: 2014 },
      'Macon City':       { entityType: 'city', placeFips: '49000', vintage: 2013 },
    };
    for (const [dcaName, want] of Object.entries(expected)) {
      const r = resolvePlace(dcaName, { ladders });
      expect(r.why, dcaName).toBeUndefined();
      expect({ entityType: r.entityType, placeFips: r.placeFips, vintage: r.vintage }, dcaName).toEqual(want);
    }
  });

  it('⚠ a live government still resolves at 2024 — the ladder changes nothing for it', () => {
    const r = resolvePlace('Atlanta City', { ladders });
    expect(r.vintage).toBe(2024);
    expect(r.entityType).toBe('city');
  });

  it('⚠⚠ NEWEST WINS when two vintages type the same place differently', () => {
    // A synthetic ladder: the older vintage calls it a town, the newer a city.
    const fake = [
      { vintage: 2024, places: new Map([['dualplacecity', { censusName: 'Dualplace city', base: 'Dualplace', censusType: 'city', placeFips: '11111', population: 10, vintage: 2024 }]]) },
      { vintage: 2013, places: new Map([['dualplacetown', { censusName: 'Dualplace town', base: 'Dualplace', censusType: 'town', placeFips: '11111', population: 9, vintage: 2013 }]]) },
    ];
    const r = resolvePlace('Dualplace City', { ladders: fake });
    expect(r.entityType).toBe('city');
    expect(r.vintage).toBe(2024);
  });

  it('⚠ LEGAL still beats RETYPED on an older vintage', () => {
    const r = resolvePlace('Mountain City', { ladders });
    expect(r.how).toBe('legal');
    expect(r.base).toBe('Mountain City');
  });

  it('refuses a government no vintage names, and says which it tried', () => {
    const r = resolvePlace('Nowhereville City', { ladders });
    expect(r.entityType).toBeUndefined();
    expect(r.why).toMatch(/named by no vintage/);
    expect(r.tried).toEqual([2024, 2019, 2014, 2013]);
  });

  it('⚠⚠ AN ABSENT VINTAGE FILE IS REPORTED, NOT TREATED AS "NOT NAMED"', () => {
    // Otherwise forgetting the fetch silently becomes a refusal that reads as
    // "this government never existed".
    const r = resolvePlace('Macon City', { ladders: ladders.filter((l) => l.vintage !== 2013), missing: [2013] });
    expect(r.why).toMatch(/not present/);
    expect(r.missing).toEqual([2013]);
  });

  it('loadLadder reports an absent vintage instead of dropping it', () => {
    const { ladders: got, missing } = loadLadder('/nonexistent-root', '13', DEFAULT_LADDER);
    expect(got).toHaveLength(0);
    expect(missing).toEqual([2024, 2019, 2014, 2013]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/censusVintages.test.mjs`
Expected: FAIL — `resolvePlace is not a function`.

- [ ] **Step 3: Implement the ladder**

```javascript
// append to scripts/lib/censusVintages.mjs

export const DEFAULT_LADDER = Object.freeze([2024, 2019, 2014, 2013]);

/**
 * Load each vintage's places for a state, newest first.
 *
 * ⚠⚠ A vintage whose file is absent is RETURNED IN `missing`, never silently
 * skipped. Forgetting the fetch must not read as "this government never
 * existed" — that is the exact failure this module exists to prevent.
 */
export function loadLadder(root, stateFips, vintages = DEFAULT_LADDER) {
  const ladders = []; const missing = [];
  for (const v of vintages) {
    const file = vintageFile(root, v, stateFips);
    if (!file) { missing.push(v); continue; }
    ladders.push({ vintage: v, places: readPlaceVintage(file, { vintage: v, stateFips }) });
  }
  return { ladders, missing };
}

/**
 * Match one publisher name inside ONE vintage, by the measured cascade.
 *
 * ⚠ `legal` is tried BEFORE `retyped` so a place legally named "... City"
 * (Peachtree City, Garden City, Mountain City) can never be re-typed into
 * something else. Eleven Georgia places need this.
 */
function matchIn(places, publisherName) {
  const m = publisherName.match(/^(.*) (City|Town)$/);
  const base = m ? m[1] : publisherName;
  const typ = m ? m[2].toLowerCase() : null;

  if (typ) {
    const hit = places.get(squash(`${base} ${typ}`));
    if (hit) return { ...hit, how: 'suffix' };
  }
  for (const t of ['city', 'town']) {
    const hit = places.get(squash(`${publisherName} ${t}`));
    if (hit) return { ...hit, how: 'legal' };
  }
  if (typ) {
    const other = typ === 'city' ? 'town' : 'city';
    const hit = places.get(squash(`${base} ${other}`));
    if (hit) return { ...hit, how: 'retyped' };
  }
  return null;
}

/**
 * Resolve a publisher's name to the NEWEST vintage that names the government.
 *
 * Newest-first is the point: the most recent vintage naming a government is
 * the most current statement of its legal type.
 */
export function resolvePlace(publisherName, { ladders, missing = [] }) {
  const tried = [];
  for (const { vintage, places } of ladders) {
    tried.push(vintage);
    const hit = matchIn(places, publisherName);
    if (hit) {
      return {
        censusName: hit.censusName,
        base: hit.base,
        entityType: hit.censusType ?? 'city',
        placeFips: hit.placeFips,
        population: hit.population,
        vintage,
        how: hit.how,
      };
    }
  }
  if (missing.length) {
    return {
      why: `${JSON.stringify(publisherName)} is named by no vintage of ${tried.join(', ') || '(none)'}, `
        + `and vintage ${missing.join(', ')} is not present — run fetchCensusVintages.mjs before concluding it cannot be named`,
      tried, missing,
    };
  }
  return { why: `${JSON.stringify(publisherName)} is named by no vintage of ${tried.join(', ')}`, tried, missing };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/censusVintages.test.mjs`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/censusVintages.mjs tests/censusVintages.test.mjs
git commit -m "feat(census): resolve a government to the newest vintage that names it"
```

---

### Task 4: Wire the Georgia builder to the ladder

**Files:**
- Modify: `scripts/buildGaStatewideEntities.mjs:117` (`GA_FIRST_YEAR`), the `no-population` refusal (~line 533), the entity push (~line 576)
- Modify: `tests/gaStatewide.test.mjs:677` (the pinned refusal inverts)

**Interfaces:**
- Consumes: `loadLadder`, `resolvePlace` from Task 3.
- Produces: entity rows carrying `censusVintage: number`, `placeFips: string`, and `population: number | null`.

- [ ] **Step 1: Invert the pinned refusal test**

Replace the test at `tests/gaStatewide.test.mjs:677`:

```javascript
  it('⚠⚠ NO LONGER REFUSES Ranger and Sunny Side — the ladder types them', () => {
    // Was: "says WHY the census has no such place, rather than guessing".
    // Vintage 2024 drops exactly these two Georgia places (measured: 538 -> 537,
    // Mableton added), and DCA still shows both filing. The ladder types them
    // from Vintage 2019; it does NOT decide which source is right about whether
    // they still exist — see the flag in gaRlgfAnomalies.mjs.
    const { ladders, missing } = loadLadder(ROOT, '13', DEFAULT_LADDER);
    expect(missing, 'run scripts/fetchCensusVintages.mjs 13').toEqual([]);
    const want = { 'Ranger Town': 'town', 'Sunny Side City': 'city' };
    for (const [n, type] of Object.entries(want)) {
      const r = resolvePlace(n, { ladders, missing });
      expect(r.why, n).toBeUndefined();
      expect(r.entityType, n).toBe(type);
      expect(r.vintage, n).toBe(2019);
    }
  });

  it('still says WHY, naming every vintage tried, when nothing names it', () => {
    const { ladders, missing } = loadLadder(ROOT, '13', DEFAULT_LADDER);
    const r = resolvePlace('Nowhereville City', { ladders, missing });
    expect(r.why).toMatch(/named by no vintage of 2024, 2019, 2014, 2013/);
  });
```

Add to that file's imports:
```javascript
import { loadLadder, resolvePlace, DEFAULT_LADDER } from '../scripts/lib/censusVintages.mjs';
```
and define `ROOT` next to the existing fixture constants if it is not already present:
```javascript
const ROOT = '.';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gaStatewide.test.mjs`
Expected: FAIL — the new tests cannot import, or `missing` is non-empty if Task 1's fetch has not been run.

- [ ] **Step 3: Widen the year floor**

In `scripts/buildGaStatewideEntities.mjs`:
```javascript
// ⚠ 2009, not 2016: the v1 form generation (FY2009-2015) is loaded as of #273,
// so the registry window must cover it or its governments have no entity.
export const GA_FIRST_YEAR = 2009;
```

- [ ] **Step 4: Replace the refusal with a ladder call**

Replace the `else pop = joinPlace(g.name, pops);` branch and the refusal block beneath it:

```javascript
    } else {
      pop = joinPlace(g.name, pops);
      // ⚠⚠ Vintage 2024 cannot name a government that ended before 2024. Fall
      // back down the ladder rather than refusing — and record WHICH vintage
      // typed it, because an entity typed by an unrecorded source is the
      // unsourced estimate this project already had to undo once.
      if (!pop || pop.why) {
        const r = resolvePlace(g.name, { ladders, missing });
        if (!r.why) {
          pop = {
            censusName: r.censusName, base: r.base, censusType: r.entityType,
            placeFips: r.placeFips, how: r.how, vintage: r.vintage,
            // ⚠ NULL, not the old vintage's figure: there is no current
            // estimate for a government no current vintage names. Consistent
            // with FL's two dissolved municipalities and the 17 already in TT.
            population: null,
            vintagePopulation: r.population,
          };
        } else pop = { why: r.why };
      }
    }
    if (!pop || pop.why) {
      refusals.push({ cicoid: g.cicoid, name: g.name, status: 'no-population',
        why: pop?.why ?? `no census vintage names a GA ${kind} called ${JSON.stringify(g.name)}` });
      continue;
    }
```

Load the ladder once, next to `const census = buildCensus(GA_STATE);`:
```javascript
  // ⚠ Loaded ONCE. Four vintages re-read per government would be ~2,100 file reads.
  const { ladders, missing } = isCounty || isConsolidated
    ? { ladders: [], missing: [] }
    : loadLadder(ROOT, '13', DEFAULT_LADDER);
  if (!isCounty && !isConsolidated && missing.length) {
    log(`⚠ census vintages not cached: ${missing.join(', ')} — run: node scripts/fetchCensusVintages.mjs 13`);
  }
```

Add the import at the top:
```javascript
import { loadLadder, resolvePlace, DEFAULT_LADDER } from './lib/censusVintages.mjs';
```

- [ ] **Step 5: Carry the vintage onto the entity**

In the `entities.push({...})` call, replace the municipality `populationSource` arm and add two fields:

```javascript
      population: pop.population,
      censusVintage: pop.vintage ?? 2024,
      placeFips: pop.placeFips ?? null,
      populationSource: isCounty
        ? `co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=${pop.fips.slice(2)}`
        : (isConsolidated
          ? `co-est2024-alldata.csv SUMLEV=050 STATE=13 COUNTY=${pop.fips.slice(2)} (${pop.countyName}, `
            + 'the county this government IS — not its census place row, which may be a `(balance)`)'
          : (pop.vintage && pop.vintage !== 2024
            // ⚠ No current population exists for this government. The vintage
            // that could still NAME it is recorded so the type is sourced.
            ? `no current estimate — typed from sub-est${pop.vintage}_13.csv SUMLEV=162 PLACE=${pop.placeFips} `
              + `(${pop.censusName}, joined by ${pop.how}; vintage ${pop.vintage} population ${pop.vintagePopulation})`
            : `sub-est2024_13.csv SUMLEV=162 PLACE=${pop.placeFips} (${pop.censusName}, joined by ${pop.how})`)),
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/gaStatewide.test.mjs tests/censusVintages.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/buildGaStatewideEntities.mjs tests/gaStatewide.test.mjs
git commit -m "feat(ga): type a municipality from the newest vintage that names it"
```

---

### Task 5: Regenerate the municipal registry and prove no collisions

**Files:**
- Modify: `scripts/data/georgiaStatewideMunicipalities.mjs` (generated)
- Test: `tests/gaStatewide.test.mjs`

**Interfaces:**
- Consumes: Task 4's builder.
- Produces: a registry containing the seven recovered municipalities.

⚠⚠ `treasury_ensure_municipality` keys on `(name, state, entity_type)`. A recovered entity whose triple matches a loaded one does **not** fail — it silently joins or duplicates a government. This task's assertion is the only thing standing between the ladder and a duplicate.

- [ ] **Step 1: Write the failing collision test**

```javascript
  it('⚠⚠ no recovered entity collides with a loaded one on key or on (name, type)', () => {
    const all = [...GA_RLGF_ENTITIES, ...GA_STATEWIDE_ENTITIES,
      ...GA_STATEWIDE_MUNICIPALITIES, ...GA_STATEWIDE_CONSOLIDATED];
    const byKey = new Map(); const byIdentity = new Map();
    for (const e of all) {
      expect(byKey.has(e.key), `two entities claim key ${e.key}`).toBe(false);
      byKey.set(e.key, e);
      // treasury_ensure_municipality keys on this triple.
      const id = `${e.name.toLowerCase()}|GA|${e.entityType}`;
      expect(byIdentity.has(id), `two entities share (name, state, entity_type): ${id}`).toBe(false);
      byIdentity.set(id, e);
    }
  });

  it('carries the seven recovered municipalities, each with its typing vintage', () => {
    const want = {
      'Ranger':      { entityType: 'town', censusVintage: 2019 },
      'Sunny Side':  { entityType: 'city', censusVintage: 2019 },
      'Helena':      { entityType: 'city', censusVintage: 2014 },
      'McRae':       { entityType: 'city', censusVintage: 2014 },
      'Payne':       { entityType: 'city', censusVintage: 2014 },
      'Riverside':   { entityType: 'town', censusVintage: 2014 },
      'Macon':       { entityType: 'city', censusVintage: 2013 },
    };
    for (const [name, w] of Object.entries(want)) {
      const e = GA_STATEWIDE_MUNICIPALITIES.find((x) => x.name === name);
      expect(e, `${name} missing from the registry`).toBeDefined();
      expect(e.entityType, name).toBe(w.entityType);
      expect(e.censusVintage, name).toBe(w.censusVintage);
      // ⚠ NULL population is the honest value, not a defect.
      expect(e.population, name).toBeNull();
      expect(e.populationSource, name).toMatch(/no current estimate/);
    }
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gaStatewide.test.mjs -t 'recovered'`
Expected: FAIL — `Ranger missing from the registry`.

- [ ] **Step 3: Regenerate**

Run: `node scripts/buildGaStatewideEntities.mjs --dir _acfr-work/ga/sweep/xlsx --kind municipality`
Expected: the refusal count drops by 7; the log reports 7 governments typed by a non-2024 vintage.

- [ ] **Step 4: Confirm the generated registry has `censusVintage` rendered**

⚠ `renderModule()` writes an explicit field list — a field added to the entity object but not to the renderer is dropped silently. Add to the template in `renderModule`, after `censusConfirms`:

```javascript
    censusVintage: ${e.censusVintage},
    placeFips: ${JSON.stringify(e.placeFips)},
```

Then regenerate again and run:
```bash
grep -c "censusVintage: 201" scripts/data/georgiaStatewideMunicipalities.mjs
```
Expected: `7`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/gaStatewide.test.mjs`
Expected: PASS.

- [ ] **Step 6: Count the recovered filings on both sides of FY2015**

⚠ The spec's 43 is the FY2009–2015 count only. Ranger and Sunny Side also have FY2016+ filings the municipal sweep refused.

Run:
```bash
node --input-type=module -e "
const { GA_STATEWIDE_MUNICIPALITIES: M } = await import('./scripts/data/georgiaStatewideMunicipalities.mjs');
const names = ['Ranger','Sunny Side','Helena','McRae','Payne','Riverside','Macon'];
let pre = 0, post = 0;
for (const n of names) {
  const e = M.find((x) => x.name === n);
  for (const y of e.fiscalYears) (y <= 2015 ? pre++ : post++);
  console.log(n.padEnd(12), e.fiscalYears.join(' '));
}
console.log('FY<=2015:', pre, ' FY2016+:', post, ' total:', pre + post);
"
```
Record both numbers in the commit message. `FY<=2015` must be **37**.

- [ ] **Step 7: Commit**

```bash
git add scripts/data/georgiaStatewideMunicipalities.mjs scripts/buildGaStatewideEntities.mjs tests/gaStatewide.test.mjs
git commit -m "feat(ga): recover 7 municipalities the 2024 vintage cannot name"
```

---

### Task 6: Bibb County as its own entity

**Files:**
- Create: `scripts/data/gaBibbPredecessor.mjs`
- Modify: `scripts/loadGeorgiaRLGF.mjs` (include it in `GA_ALL_ENTITIES`)
- Test: `tests/gaStatewide.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GA_BIBB_PREDECESSOR: ReadonlyArray<Entity>` with `cicoid: '1011011'`, `key: 'bibb-county'`, `entityType: 'county'`, `fiscalYears: [2009..2013]`.

⚠ Chris's decision, 2026-10-19: a **separate entity**, no series continuity to Macon-Bibb. Bibb alone reports $92.0M–$115.7M operating; Macon-Bibb reports $195.3M in FY2016. Appending one to the other shows a ~1.7x step that is a change of scope, not growth.

- [ ] **Step 1: Write the failing boundary tests**

```javascript
describe('Bibb County is a predecessor government, not early Macon-Bibb', () => {
  it('exists as its own county entity with its own CICOID', () => {
    const b = GA_ALL_ENTITIES.find((e) => e.cicoid === '1011011');
    expect(b).toBeDefined();
    expect(b.name).toBe('Bibb County');
    expect(b.entityType).toBe('county');
    expect(b.key).toBe('bibb-county');
  });

  it('⚠⚠ STOPS AT FY2013 and Macon-Bibb STARTS AT FY2014 — nothing splices', () => {
    const bibb = GA_ALL_ENTITIES.find((e) => e.cicoid === '1011011');
    const mb = GA_ALL_ENTITIES.find((e) => e.cicoid === '3011011');
    expect(Math.max(...bibb.fiscalYears)).toBe(2013);
    expect(Math.min(...mb.fiscalYears)).toBe(2014);
    // No year is claimed by both — the handover is clean, measured.
    const overlap = bibb.fiscalYears.filter((y) => mb.fiscalYears.includes(y));
    expect(overlap).toEqual([]);
  });

  it('⚠ the census agrees: Macon got a NEW place code rather than continuing', () => {
    // PLACE 49000 (Macon city) ends after vintage 2013; 49008 (Macon-Bibb
    // County) begins at vintage 2014. The Bureau treats the consolidation as a
    // new government — independent corroboration for not splicing.
    const macon = GA_STATEWIDE_MUNICIPALITIES.find((e) => e.name === 'Macon');
    expect(macon.placeFips).toBe('49000');
    expect(macon.censusVintage).toBe(2013);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gaStatewide.test.mjs -t 'Bibb County is a predecessor'`
Expected: FAIL — `expected undefined to be defined`.

- [ ] **Step 3: Write the registry module**

```javascript
// scripts/data/gaBibbPredecessor.mjs
/**
 * ⚠⚠ BIBB COUNTY IS A DIFFERENT GOVERNMENT FROM MACON-BIBB COUNTY.
 *
 * Bibb County filed as `1011011` through FY2013 and reports $92.0M-$115.7M of
 * operating expenditure. In 2014 it consolidated with the CITY of Macon to form
 * Macon-Bibb County (`3011011`), which reports $195.3M in FY2016.
 *
 * Appending one series to the other would show a ~1.7x step that reads as
 * growth and is a change of scope — the Fulton FY2017/FY2018 reader-distortion
 * shape, where 92% of an apparent jump was not growth at all. Chris's call,
 * 2026-10-19: load it as its own entity, which is what it was.
 *
 * ⭐ The Census Bureau reached the same conclusion independently: it retired
 * PLACE 49000 (`Macon city`) after vintage 2013 and issued PLACE 49008
 * (`Macon-Bibb County`) rather than continuing the old code.
 *
 * ⚠ Population is NULL. There is no 2024 estimate for a county government that
 * ceased to exist in 2014, and Bibb County's territory is now reported under
 * Macon-Bibb. Borrowing Macon-Bibb's figure would describe a different
 * government.
 */
export const GA_BIBB_PREDECESSOR = Object.freeze([
  Object.freeze({
    key: 'bibb-county',
    cicoid: '1011011',
    name: 'Bibb County',
    state: 'GA',
    entityType: 'county',
    population: null,
    populationSource: 'no current estimate — the county government consolidated into '
      + 'Macon-Bibb County in 2014. Census Vintage 2013 names `Macon city` (PLACE 49000); '
      + 'vintage 2014 replaces it with `Macon-Bibb County` (PLACE 49008).',
    fiscalYearStartMonth: 6,
    fiscalYearEndText: null,
    censusName: 'Bibb County',
    censusKind: 'county',
    censusConfirms: false,
    censusVintage: 2013,
    placeFips: null,
    monthStatus: 'unverified',
    monthWhy: 'the government ceased in 2014; the FAC census covers no year it filed',
    parentCountyKey: null,
    fiscalYears: [2009, 2010, 2011, 2012, 2013],
    // ⚠ Asserted in tests: this must never gain an FY2014+ year, and
    // Macon-Bibb must never gain a year below FY2014.
    successorCicoid: '3011011',
    lastFiscalYear: 2013,
  }),
]);
```

⚠⚠ `fiscalYearStartMonth: 6` is a **placeholder that must be replaced before commit** — read Bibb's own `FYEmonth` from its FY2009–2013 filings. `readFormMonths` is not currently exported; export it (`scripts/buildGaStatewideEntities.mjs:428`, add `export` to the declaration), then:

```bash
node --input-type=module -e "
const { readFormMonths } = await import('./scripts/buildGaStatewideEntities.mjs');
const { months, notes } = await readFormMonths('_acfr-work/ga/sweep/xlsx', '1011011', 2009, 2013);
for (const m of months) console.log('FY' + m.fiscalYear, 'month', m.month, JSON.stringify(m.text));
if (notes.length) console.log('notes:', notes.join('; '));
"
```

Set the field to what the filings declare. If they disagree across years, record `monthByYear` the way `GA_V1_MONTH_CHANGES` does — **do not pick one**. The month moves no dollar, which is exactly why it needs this discipline: every tie test passes at $0 whatever is written (`project_fysm_column_default_one_defect` is 18,700 rows of that lesson).

- [ ] **Step 4: Include it in `GA_ALL_ENTITIES`**

In `scripts/loadGeorgiaRLGF.mjs`:
```javascript
import { GA_BIBB_PREDECESSOR } from './data/gaBibbPredecessor.mjs';

export const GA_ALL_ENTITIES = Object.freeze([
  ...GA_RLGF_ENTITIES, ...GA_STATEWIDE_ENTITIES, ...GA_STATEWIDE_MUNICIPALITIES,
  ...GA_STATEWIDE_CONSOLIDATED, ...GA_BIBB_PREDECESSOR,
]);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/gaStatewide.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/data/gaBibbPredecessor.mjs scripts/loadGeorgiaRLGF.mjs tests/gaStatewide.test.mjs
git commit -m "feat(ga): Bibb County loads as the predecessor government it was"
```

---

### Task 7: Echols — a declared CICOID alias

**Files:**
- Modify: `scripts/loadGeorgiaRLGF.mjs:91-108`
- Test: `tests/gaStatewide.test.mjs`

**Interfaces:**
- Consumes: `GA_ALL_ENTITIES`.
- Produces: `GA_CICOID_ALIASES: Readonly<Record<string, string>>`; `entityByCicoid` resolves through it.

⚠⚠ The existing duplicate assertion is **load-bearing**: a second entity for one government would *duplicate* rows via `treasury_sync_city_budget` rather than collide visibly (`project_sync_city_budget_not_source_safe`). The alias must therefore keep exactly **one** entity and resolve the second CICOID onto it — never add a row.

- [ ] **Step 1: Write the failing tests**

```javascript
describe('Echols is one government under two CICOIDs', () => {
  it('resolves the county-prefix CICOID onto the consolidated entity', () => {
    const viaCg = entityByCicoid('3050050');
    const viaCounty = entityByCicoid('1050050');
    expect(viaCg).toBeDefined();
    expect(viaCounty).toBe(viaCg); // the SAME object, not an equal one
  });

  it('⚠⚠ adds NO second entity — the alias target is the only row', () => {
    expect(GA_ALL_ENTITIES.filter((e) => e.cicoid === '1050050')).toHaveLength(0);
    expect(GA_ALL_ENTITIES.filter((e) => e.cicoid === '3050050')).toHaveLength(1);
  });

  it('⚠ an alias whose target does not exist fails loudly at import', async () => {
    const { assertAliases } = await import('../scripts/loadGeorgiaRLGF.mjs');
    expect(() => assertAliases({ '9999999': '8888888' }, GA_ALL_ENTITIES))
      .toThrow(/alias target 8888888 is in no registry/);
  });

  it('⚠ an alias SOURCE that is also a registry entry fails loudly', () => {
    expect(() => assertAliases({ '3050050': '3050050' }, GA_ALL_ENTITIES))
      .toThrow(/alias source 3050050 is itself a registry entry/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/gaStatewide.test.mjs -t 'Echols is one government'`
Expected: FAIL — `entityByCicoid('1050050')` returns `null`.

- [ ] **Step 3: Implement the alias**

In `scripts/loadGeorgiaRLGF.mjs`, after the duplicate assertion:

```javascript
/**
 * ⚠⚠ TWO CICOIDs, ONE GOVERNMENT.
 *
 * Echols County filed under `1050050` (county prefix) and `3050050`
 * (consolidated prefix). Its FY2010 county-prefix filing reports operating
 * $2,679,270 — IDENTICAL to the FY2010 CG filing already loaded under
 * `3050050`. Echols has no municipalities, so the unified government covers the
 * same territory and the same money: FY2009 is a genuine continuation of the
 * series TT already shows, not a second government.
 *
 * ⚠⚠ THE ALIAS ADDS NO ENTITY. A second entity would DUPLICATE rows through
 * `treasury_sync_city_budget`, which keys on fund_scope + basis rather than on
 * data_source, instead of colliding visibly
 * (`project_sync_city_budget_not_source_safe`). The duplicate-CICOID assertion
 * above is unchanged and still absolute; this map is the one declared way a
 * CICOID may resolve to an entity it does not itself own.
 *
 * ⚠ FY2010 remains REFUSED as a double-count — it is the single measured
 * overlap in the whole state (`GA_CONSOLIDATION_OVERLAP`). Only FY2009 loads.
 */
export const GA_CICOID_ALIASES = Object.freeze({
  '1050050': '3050050',
});

export function assertAliases(aliases, entities) {
  const own = new Set(entities.map((e) => e.cicoid));
  for (const [from, to] of Object.entries(aliases)) {
    if (own.has(from)) throw new Error(`alias source ${from} is itself a registry entry — an alias must add no entity`);
    if (!own.has(to)) throw new Error(`alias target ${to} is in no registry`);
  }
}
assertAliases(GA_CICOID_ALIASES, GA_ALL_ENTITIES);

/** Look one up by CICOID — the only safe key, across both registries. */
export function entityByCicoid(cicoid) {
  const id = GA_CICOID_ALIASES[String(cicoid)] ?? String(cicoid);
  return GA_ALL_ENTITIES.find((e) => e.cicoid === id) || null;
}
```

⚠ Replace the existing `entityByCicoid` rather than adding a second one.

- [ ] **Step 4: Confirm FY2010 stays refused**

Run: `npx vitest run tests/gaStatewide.test.mjs -t 'overlap'`
Expected: PASS — the existing `GA_CONSOLIDATION_OVERLAP` test still refuses Echols FY2010.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add scripts/loadGeorgiaRLGF.mjs tests/gaStatewide.test.mjs
git commit -m "feat(ga): Echols FY2009 loads through a declared CICOID alias"
```

---

### Task 8: Measure and flag the Ranger / Sunny Side contradiction

**Files:**
- Modify: `scripts/data/gaRlgfAnomalies.mjs` (`GA_OUT_OF_SCOPE_FINDINGS` ~2152, `GA_FIGURE_FLAGS`)
- Test: `tests/gaStatewide.test.mjs`

**Interfaces:**
- Consumes: the registry from Task 5.
- Produces: a figure flag keyed `ranger-sunny-side-absent-from-vintage-2024`.

⚠⚠ Two sources contradict each other. The Milledgeville rule says **load it and flag it** — do not pick a side in code. The measurement below decides what the flag *says*, not whether the data loads.

- [ ] **Step 1: Measure whether the post-2019 filings carry money**

⚠ `MosRptd` lies about stubs (Talbot, Georgetown-Quitman) — **only the money finds them**.

Run:
```bash
node scripts/loadGeorgiaRLGF.mjs --entity ranger-town --dry-run --verbose
node scripts/loadGeorgiaRLGF.mjs --entity sunny-side-city --dry-run --verbose
```
Record, per fiscal year, the Part I–III revenue total and the Part V expenditure total. Write the numbers into the flag prose in Step 3 — do not paraphrase them.

- [ ] **Step 2: Write the failing flag test**

```javascript
  it('flags that Vintage 2024 drops exactly these two while DCA shows them filing', () => {
    const f = figureFlags.find((x) => x.key === 'ranger-sunny-side-absent-from-vintage-2024');
    expect(f).toBeDefined();
    expect(f.entityKeys.sort()).toEqual(['ranger-town', 'sunny-side-city']);
    // ⚠ The flag must state the measurement, not a conclusion about which
    // source is right.
    expect(f.what).toMatch(/538/);
    expect(f.what).toMatch(/537/);
  });
```

- [ ] **Step 3: Write the flag and replace the two held-out register entries**

Add to `GA_FIGURE_FLAGS`:

```javascript
  {
    key: 'ranger-sunny-side-absent-from-vintage-2024',
    entityKeys: ['ranger-town', 'sunny-side-city'],
    what: '⚠⚠ THE CENSUS AND DCA DISAGREE ABOUT WHETHER THESE TWO GOVERNMENTS EXIST. '
      + 'Census Vintage 2019 lists 538 Georgia places and Vintage 2024 lists 537. The diff '
      + 'is exactly three rows: Ranger town and Sunny Side city REMOVED, Mableton city '
      + '(incorporated 2022) added. So the Census Bureau dropped precisely the two '
      + 'governments DCA still shows filing — Sunny Side from FY2016, Ranger from FY2017.',
    why: 'Both are LOADED, typed from Vintage 2019, which is the newest vintage that names '
      + 'them. ⚠ TT does not decide which source is right: the census may be recording a '
      + 'dissolution Georgia has not reflected in DCA\'s roster, or DCA may be carrying '
      + 'stub filings for governments that no longer operate — `MosRptd` is already known '
      + 'to lie about stubs (Talbot, Georgetown-Quitman), and only the money finds them. '
      + 'The figures shown are the filings\' own, oracled like every other.',
  },
```

Then in `GA_OUT_OF_SCOPE_FINDINGS`, replace the two entries describing the held-out filings (the "SEVEN MUNICIPALITIES WITH FY2009-2015 FILINGS HAVE NO REGISTRY ENTRY" entry and the Bibb/Echols entry) with a single resolution entry:

```javascript
  {
    what: '✅ RESOLVED 2026-10-19 — the 43 held-out FY2009-2015 filings now load. The seven '
      + 'municipalities are typed by the newest census vintage that names them (Ranger and '
      + 'Sunny Side from 2019; Helena, McRae, Payne and Riverside from 2014; Macon from '
      + '2013), Bibb County loads as its own predecessor entity, and Echols FY2009 loads '
      + 'through a declared CICOID alias. Ranger and Sunny Side also recovered their FY2016+ '
      + 'filings, refused by the municipal sweep for the same reason.',
    why: '⭐ The follow-up was "how to type a government the current census vintage cannot '
      + 'name", and the answer turned out not to need a new authority: the NEWEST VINTAGE '
      + 'THAT CAN name it, recorded alongside the type. ⚠ Kept rather than deleted because '
      + 'the question was mis-filed for a while — Bibb and Echols were never typing problems '
      + 'at all (the census names both counties fine); they were identity-across-'
      + 'consolidation problems sitting under a typing heading, and they needed opposite '
      + 'answers. See `scripts/lib/censusVintages.mjs` and '
      + 'docs/superpowers/specs/2026-10-19-census-vintage-typing-design.md.',
  },
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/gaStatewide.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/gaRlgfAnomalies.mjs tests/gaStatewide.test.mjs src/data/figureFlags.ts
git commit -m "feat(ga): flag the census/DCA disagreement over Ranger and Sunny Side"
```

---

### Task 9: Load the recovered filings

**Files:**
- Modify: none (data only)
- Create: `scripts/data/gaVintageRecoveredCreatedIds.json`

**Interfaces:**
- Consumes: every earlier task.
- Produces: loaded rows and a created-ids file.

⚠⚠ **THE LOADER'S `parseArgs` IS `strict: false`** (`scripts/loadGeorgiaRLGF.mjs:605`) — **an unknown flag is silently ignored**, so a mistyped or invented option does not error, it just does nothing while the run looks fine. The real surface is exactly: `--dir`, `--entity`, `--fy`, `--commit`, `--dry-run`, `--slice`. There is no `--limit` and no `--resume`; `--slice m/n` is the only way to cut a long run.

⚠⚠ **`--entity` TAKES ONE KEY, NOT A LIST.** It matches `e.key === argv.entity` exactly and exits 2 on a miss, so a comma-separated list loads nothing. Loop over the keys.

⚠ The blank-part sweep needs no flag: `unrecordedBlankParts()` already runs on **every** invocation, `--dry-run` included, and reports all blanks at once (`scripts/loadGeorgiaRLGF.mjs:706`). A dry run *is* the sweep.

- [ ] **Step 1: Dry-run every recovered government — this is the blank-part sweep**

```bash
for E in ranger-town sunny-side-city helena-city mcrae-city payne-city \
         riverside-town macon-city bibb-county echols-county; do
  echo "=== $E ==="
  node scripts/loadGeorgiaRLGF.mjs --dir _acfr-work/ga/sweep/xlsx --entity "$E" --dry-run
done 2>&1 | tee /tmp/ga-recovered-dryrun.txt
```

⚠ Confirm the entity keys first — they come from Task 5's generated registry, where `entityKey()` appends the type (`ranger-town`, `sunny-side-city`). An `Unknown --entity` exit 2 means the key is wrong, not that the government is missing.

Expected: **0 oracle failures**. Record the filing count and the check count.

Then read the blank-part report out of that output:
```bash
grep -A 4 "carry NO MONEY" /tmp/ga-recovered-dryrun.txt
```
Register each reported blank Part in `GA_EMPTY_DATASETS` before loading, the way `upson-fy2010-part-five-blank` is registered. The `--commit` run refuses one at a time and died mid-write on Upson FY2010; this is the pass that finds them all at once.

⚠ Echols must show **FY2009 only**. If FY2010 appears, the `GA_CONSOLIDATION_OVERLAP` refusal has regressed — stop and fix Task 7.

- [ ] **Step 2: Capture the pre-load position**

⚠ There is no `reportTreasuryTotals.mjs`. The instrument that exists is `registerCreatedRows.mjs`, which prints the unregistered-row breakdown by entity and source before writing anything.

```bash
node scripts/registerCreatedRows.mjs > /tmp/ga-before.txt
```
Expected: a clean report with **no unregistered rows** — anything outstanding here belongs to an earlier load and must be resolved first, or this load's rows get filed under someone else's name.

- [ ] **Step 3: Commit the load**

Re-run the Step 1 loop with `--commit` in place of `--dry-run`, in the **foreground**. If a government is reaped, re-run that one with `--slice m/n`; re-running is safe because the RPC is keyed, so written rows UPDATE rather than duplicate.

- [ ] **Step 4: Assert the TOTAL moved, not the row count**

⚠⚠ Test the TOTAL, not `tree.length` and not presence-of-amount — a `length === 0` guard put three $0 rows into production.

```bash
node scripts/registerCreatedRows.mjs > /tmp/ga-after.txt
diff /tmp/ga-before.txt /tmp/ga-after.txt
```

Then assert the money directly, per entity-year, against the database:

```bash
node --env-file=.env --input-type=module -e "
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const keys = ['Ranger','Sunny Side','Helena','McRae','Payne','Riverside','Macon','Bibb County','Echols County'];
for (const name of keys) {
  const { data } = await db.from('budgets')
    .select('fiscal_year,total_budget,municipalities!inner(name,state)')
    .eq('municipalities.name', name).eq('municipalities.state','GA')
    .order('fiscal_year');
  for (const r of data ?? []) console.log(name.padEnd(14), r.fiscal_year, r.total_budget);
  if (!data?.length) console.log(name.padEnd(14), '*** NO ROWS ***');
}
"
```

⚠ `total_budget`, not `total` — the wrong column name returns null rather than erroring (`reference_treasury_budgets_probe_columns`).

Expected: every recovered government shows a **non-zero** `total_budget` for each loaded year, except any filing registered blank in Step 1. A `0` that is not a registered blank is a defect, not a figure.

- [ ] **Step 5: Run the full ceremony**

```bash
node scripts/registerCreatedRows.mjs --milestone ga-vintage-recovered \
  --match "Georgia DCA Report of Local Government Finances"
npm run check:forks
npm run verify:frozen
npm test
```
Expected: the registered ids equal the deficit **exactly**; forks clean; **`verify:frozen` reports `62587 / 60098de6` UNCHANGED**; suite green.

⚠ `--match` is repeatable and the union must equal the deficit exactly. If it does not, do not widen the match to make it fit — find out which rows are unaccounted for.

- [ ] **Step 6: Commit**

```bash
git add scripts/data/gaVintageRecoveredCreatedIds.json scripts/data/gaRlgfAnomalies.mjs
git commit -m "feat(ga): load the recovered filings — 7 municipalities, Bibb, Echols FY2009"
```

---

### Task 10: The cross-state audit

**Files:**
- Create: `scripts/auditCensusVintageGaps.mjs`
- Test: `tests/censusVintages.test.mjs`

**Interfaces:**
- Consumes: `loadLadder`, `resolvePlace`.
- Produces: `auditState(stateFips, names) → { named, unnamed, byVintage }`. **Read-only — loads nothing.**

- [ ] **Step 1: Write the failing test**

```javascript
describe('the cross-state audit reports, and loads nothing', () => {
  it('buckets names by the vintage that would type them', () => {
    const r = auditState('13', ['Atlanta City', 'Macon City', 'Nowhereville City'], { ladders });
    expect(r.byVintage[2024]).toContain('Atlanta City');
    expect(r.byVintage[2013]).toContain('Macon City');
    expect(r.unnamed).toEqual(['Nowhereville City']);
  });

  it('⚠ reports a state whose older vintages are not cached instead of calling it clean', () => {
    const r = auditState('06', ['Anything City'], { ladders: [], missing: [2019, 2014, 2013] });
    expect(r.incomplete).toBe(true);
    expect(r.missing).toEqual([2019, 2014, 2013]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/censusVintages.test.mjs -t 'cross-state audit'`
Expected: FAIL — `auditState is not a function`.

- [ ] **Step 3: Write the audit**

```javascript
// scripts/auditCensusVintageGaps.mjs
/**
 * Which governments would an older census vintage name, state by state?
 *
 * ⚠ READ-ONLY. It loads nothing and changes nothing. `cache/` holds Vintage
 * 2024 for 26 states and nothing older, so every loaded state has the same
 * blind spot Georgia had: a government that ended before 2024 cannot be typed,
 * so it has no entity, so it has no rows. This prices that gap instead of
 * leaving "not Georgia-specific" as a belief.
 */
import { loadLadder, resolvePlace, DEFAULT_LADDER } from './lib/censusVintages.mjs';

export function auditState(stateFips, names, { ladders, missing = [] }) {
  const byVintage = {}; const unnamed = []; let named = 0;
  for (const n of names) {
    const r = resolvePlace(n, { ladders, missing });
    if (r.why) { unnamed.push(n); continue; }
    named++;
    (byVintage[r.vintage] ??= []).push(n);
  }
  return { stateFips, named, unnamed, byVintage, missing, incomplete: missing.length > 0 };
}
```

⚠ The per-state list of refused names comes from each builder's own `refusals` array with `status: 'no-population'`. Wire the CLI to read those; do **not** re-derive a roster.

- [ ] **Step 4: Run it and record the result**

Run: `node scripts/auditCensusVintageGaps.mjs`
Expected: a per-state table. Paste it into the PR description — it is the deliverable.

- [ ] **Step 5: Commit and open the PR**

```bash
git add scripts/auditCensusVintageGaps.mjs tests/censusVintages.test.mjs
git commit -m "feat(census): audit which governments older vintages would name, per state"
git push -u origin feat/census-vintage-typing
gh pr create --base main --title "feat(census): type a government the current vintage cannot name" --body "..."
```

⚠ The PR must target `main` directly. A stacked PR targeting a feature branch gets **zero checks** and still reads `CLEAN` — that is what made #268 and #269 unmergeable as found.

---

## Self-Review

**Spec coverage.** Ladder → Tasks 2–3. Georgia wiring → Tasks 4–5. Bibb → Task 6. Echols → Task 7. Ranger/Sunny Side flag → Task 8. Cross-state audit → Task 10. Verification → Task 9. The spec's "recovered government loads its whole filing history" → Task 5 Step 6 counts both sides of FY2015. No gaps found.

**Placeholders.** One deliberate and marked: `fiscalYearStartMonth: 6` in Task 6 Step 3, which the same step requires to be read from Bibb's own filings before commit rather than accepted. Flagged in the task rather than left silent.

**Invented interfaces, caught and corrected.** The first draft of this plan named four things that do not exist, every one of which would have failed *quietly*: a `reportTreasuryTotals.mjs` script (replaced with `registerCreatedRows.mjs` plus a direct `budgets` query); a `--check-blank-parts` flag (the sweep already runs on every invocation); `--limit` / `--resume` on the GA loader (only `--slice` exists); and `--only` on the builder (replaced by exporting `readFormMonths`). A comma-separated `--entity` list was also wrong — it matches one key exactly and would have loaded nothing. ⚠ Three of those five would have been swallowed by `strict: false` rather than erroring, which is why the flag surfaces are now pinned in Global Constraints.

**Type consistency.** `resolvePlace` returns `entityType` (not `censusType`) throughout; the builder maps it onto `pop.censusType` at the one call site in Task 4 Step 4, which is where the existing `joinPlace` shape is consumed. `loadLadder` returns `{ ladders, missing }` in Tasks 3, 4 and 10 alike.

**Review Focus coverage.** (1) absent vintage → Task 3 Step 1, last two tests; (2) conflicting types across vintages → Task 3 Step 1, "NEWEST WINS"; (3) `(pt.)` rows → Task 2 Step 1; (4) per-vintage squash collisions → Task 2 Step 1; (5) entity collisions → Task 5 Step 1.
