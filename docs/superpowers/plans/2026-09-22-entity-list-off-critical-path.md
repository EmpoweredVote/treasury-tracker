# Entity List Off The Critical Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop every Treasury Tracker page load from fetching 8,149 entities / 3.05 MB, so a city page fetches ~52 rows instead.

**Architecture:** Four additive query parameters on `GET /api/treasury/cities` in the `ev-accounts` repo (`entity_type`, `state`, `county_id` as WHERE clauses on the existing query; `fields=index` for a lean column set), then each Treasury Tracker consumer fetching only its own slice, with the entity switcher's index loaded on first open.

**Tech Stack:** Express + node-postgres (backend, TypeScript); React 19 + Vite + Vitest (frontend, TypeScript).

**Spec:** `docs/superpowers/specs/2026-09-22-entity-list-off-critical-path-design.md`

## Global Constraints

- **Two repos.** Part A is `C:\ev-accounts` (branch from `origin/master`, 210 commits ahead of the local checkout — **pull first**). Part B is `C:\treasury-tracker` (branch from `origin/main`).
- **`GET /api/treasury/cities` is a cross-app contract.** With no new parameters the response must stay **byte-for-byte** what it is today. Every addition is opt-in.
- **Filters are WHERE clauses and nothing else** — never touch the `LEFT JOIN`, `GROUP BY m.id`, the `HAVING COUNT(b.id) > 0 OR (county with children)` contract, or `ORDER BY m.name`.
- **An unmatched filter returns `[]`, never a substitute row** (TT #158).
- **An unknown `entity_type` value is a 422**, not `[]` — a typo must not read as "no such places".
- **The server never learns what "city-tier" means.** The client sends the type list. `CITY_TIER_TYPES` (`src/utils/cityTierTypes.ts`) is the one definition.
- **Every TT consumer keeps its client-side predicate** after fetching, so an API that ignores the new params still renders correctly. Deploy order must not matter.
- **TT runs NO component tests.** `vitest.config.ts` includes only `src/**/*.test.ts`, `tests/**/*.test.mjs`, `scripts/**/*.test.mjs` — a `.test.tsx` never executes. All new logic goes in pure modules under `src/data/` or `src/utils/` with `.test.ts` coverage.
- **`npm run build` is the real gate in TT**, not `tsc --noEmit`. Run it before pushing.
- Backend tests live under `backend/src/**` because CI runs `npm run test:unit` (`vitest run src scripts`) — a contract asserted in `tests/integration/` is asserted nowhere.

---

# PART A — `ev-accounts` (ships and deploys first)

### Task 1: `entity_type` / `state` / `county_id` filters in `getCities`

**Files:**
- Modify: `backend/src/lib/treasuryService.ts` (`getCities`, ~line 575)
- Test: `backend/src/lib/treasuryService.cities.test.ts` (exists — append)

**Interfaces:**
- Consumes: nothing.
- Produces: `export interface CityFilters { entityTypes?: string[]; state?: string; countyId?: string }` and a widened `getCities(mode: DatasetsMode, slug?: string, filters?: CityFilters): Promise<TreasuryCity[]>`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/lib/treasuryService.cities.test.ts`:

```ts
describe('getCities — entity_type / state / county_id filters', () => {
  it('binds every filter as a PARAMETER, never interpolated', async () => {
    await getCities('summary', undefined, {
      entityTypes: ['city', 'town'], state: 'CA',
      countyId: '391bf791-1c1f-424f-a7a5-1b698c79093f',
    });
    expect(params()).toEqual([
      ['city', 'town'], 'CA', '391bf791-1c1f-424f-a7a5-1b698c79093f',
    ]);
    expect(sql()).not.toContain('CA');
    expect(sql()).toMatch(WHERE_CLAUSE);
  });

  it('ANDs the filters together', async () => {
    await getCities('summary', undefined, { state: 'CA', entityTypes: ['county'] });
    expect(sql()).toMatch(/WHERE .* AND /);
  });

  it('uses = ANY for the type list, so one row cannot match twice', async () => {
    await getCities('summary', undefined, { entityTypes: ['city'] });
    expect(sql()).toMatch(/m\.entity_type = ANY\(\$1\)/);
  });

  // ⚠ THE LOAD-BEARING ASSERTION, same as the slug path's. Stripping the WHERE
  // clause must reproduce the unfiltered query EXACTLY — that is what stops a
  // narrowed query returning a row the full list would hide, or hiding one it
  // would show.
  it('is a WHERE clause only — it does not alter the row contract', async () => {
    await getCities('summary', undefined, { state: 'CA' });
    const filtered = sql();
    query.mockReset();
    query.mockResolvedValue(NO_ROWS);
    await getCities('summary');
    const unfiltered = sql();
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(norm(filtered.replace(WHERE_CLAUSE, ''))).toBe(norm(unfiltered));
  });

  it('keeps the HAVING contract on the filtered path', async () => {
    await getCities('summary', undefined, { state: 'CA' });
    expect(sql()).toMatch(/HAVING COUNT\(b\.id\) > 0/);
    expect(sql()).toContain("m.entity_type = 'county'");
  });

  it('combines with the slug filter, numbering parameters in order', async () => {
    await getCities('summary', 'los-angeles-ca', { state: 'CA' });
    expect(params()).toEqual(['los-angeles-ca', 'CA']);
    expect(sql()).toMatch(/= \$1/);
    expect(sql()).toMatch(/m\.state = \$2/);
  });

  it('treats empty and absent filters as no filter at all', async () => {
    await getCities('summary', undefined, {});
    expect(sql()).not.toMatch(WHERE_CLAUSE);
    expect(params()).toEqual([]);
    query.mockReset();
    query.mockResolvedValue(NO_ROWS);
    await getCities('summary', undefined, { entityTypes: [] });
    expect(sql()).not.toMatch(WHERE_CLAUSE);
    expect(params()).toEqual([]);
  });

  it('returns an empty array when nothing matches — never a substitute', async () => {
    query.mockResolvedValue(NO_ROWS);
    expect(await getCities('summary', undefined, { state: 'ZZ' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd /c/ev-accounts/backend && npx vitest run src/lib/treasuryService.cities.test.ts
```

Expected: FAIL — `getCities` takes two arguments, so the filters are ignored and no `WHERE` clause is emitted.

- [ ] **Step 3: Implement the filters**

In `backend/src/lib/treasuryService.ts`, above `getCities`:

```ts
/**
 * Optional narrowings for GET /api/treasury/cities.
 *
 * ⚠⚠ EVERY ONE OF THESE IS A WHERE CLAUSE AND NOTHING ELSE. The join, the
 * GROUP BY, the HAVING "has a budget or is a grouper county" contract, the
 * column list and the ORDER BY are untouched, so a row that comes back is
 * byte-for-byte the row the unfiltered list would have carried — or nothing.
 * Same property as `slug`, and for the same reason (TT #158).
 *
 * ⚠ `entityTypes` is supplied BY THE CALLER. This service deliberately does not
 * know what "city-tier" means: Treasury Tracker owns that definition in
 * `src/utils/cityTierTypes.ts`, with a test policing copies of it, because four
 * divergent copies once made PA's 949 boroughs invisible to their own county's
 * panel.
 */
export interface CityFilters {
  entityTypes?: string[];
  state?: string;
  countyId?: string;
}
```

Then replace the body of `getCities`:

```ts
export async function getCities(
  mode: DatasetsMode = 'full',
  slug?: string,
  filters: CityFilters = {}
): Promise<TreasuryCity[]> {
  const conds: string[] = [];
  const vals: unknown[] = [];

  if (slug) { vals.push(slug); conds.push(`${SLUG_SQL} = $${vals.length}`); }
  if (filters.entityTypes?.length) {
    vals.push(filters.entityTypes);
    conds.push(`m.entity_type = ANY($${vals.length})`);
  }
  if (filters.state) { vals.push(filters.state); conds.push(`m.state = $${vals.length}`); }
  if (filters.countyId) { vals.push(filters.countyId); conds.push(`m.county_id = $${vals.length}`); }

  const { rows } = await pool.query<CityRow>(
    `SELECT m.id, m.name, m.state, m.entity_type, m.population, m.population_year, m.county_id, m.hero_image_url,
            m.created_at, m.updated_at,
            ${mode === 'summary' ? DATASETS_SUMMARY : DATASETS_FULL}
     FROM treasury.municipalities m
     LEFT JOIN treasury.budgets b ON b.municipality_id = m.id
     ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
     GROUP BY m.id
     HAVING COUNT(b.id) > 0
        OR (m.entity_type = 'county' AND EXISTS (
              SELECT 1 FROM treasury.municipalities child WHERE child.county_id = m.id
            ))
     ORDER BY m.name`,
    vals
  );
  return rows.map((r) => mapCity(r, mode));
}
```

⚠ Keep `WHERE` on its own line in the template. `treasuryService.cities.test.ts` matches `/^[ \t]*WHERE .*\r?\n/m` because `FILTER (WHERE b.id IS NOT NULL)` appears mid-line in the summary projection; a `WHERE` that does not start its line breaks that helper.

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd /c/ev-accounts/backend && npx vitest run src/lib/treasuryService.cities.test.ts
```

Expected: PASS, including the pre-existing slug tests.

- [ ] **Step 5: Commit**

```bash
cd /c/ev-accounts && git add backend/src/lib/treasuryService.ts backend/src/lib/treasuryService.cities.test.ts
git commit -m "feat(treasury): entity_type/state/county_id filters on getCities"
```

---

### Task 2: Route wiring and 422 validation

**Files:**
- Modify: `backend/src/routes/treasury.ts:53-90` (the `GET /cities` handler)
- Test: `backend/src/lib/treasuryService.entityTypes.test.ts` (create)

**Interfaces:**
- Consumes: `CityFilters`, `getCities` from Task 1.
- Produces: `export const KNOWN_ENTITY_TYPES: ReadonlySet<string>` and `export function parseEntityTypes(raw: unknown): { values: string[] } | { invalid: string }` in `backend/src/lib/treasuryService.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/lib/treasuryService.entityTypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseEntityTypes, KNOWN_ENTITY_TYPES } from './treasuryService.js';

/**
 * ⚠⚠ AN UNKNOWN TYPE IS A CALLER BUG, NOT AN EMPTY RESULT. Answering `[]` for
 * `?entity_type=citty` would let a typo read as "there are no such places",
 * which is the same class of silent wrongness as an unmatched slug rendering
 * someone else's budget.
 */
describe('parseEntityTypes', () => {
  it('accepts a CSV of known types', () => {
    expect(parseEntityTypes('city,town')).toEqual({ values: ['city', 'town'] });
  });

  it('trims whitespace and ignores empty segments', () => {
    expect(parseEntityTypes(' city , , town ')).toEqual({ values: ['city', 'town'] });
  });

  it('rejects an unknown type by NAMING it', () => {
    expect(parseEntityTypes('city,citty')).toEqual({ invalid: 'citty' });
  });

  it('treats absent or empty input as no filter', () => {
    expect(parseEntityTypes(undefined)).toEqual({ values: [] });
    expect(parseEntityTypes('')).toEqual({ values: [] });
  });

  it('knows every type the table actually holds', () => {
    // Measured 2026-09-22 against production: these ten and nothing else.
    for (const t of ['city', 'town', 'township', 'village', 'borough',
                     'municipality', 'county', 'state', 'nonprofit', 'federal']) {
      expect(KNOWN_ENTITY_TYPES.has(t)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
cd /c/ev-accounts/backend && npx vitest run src/lib/treasuryService.entityTypes.test.ts
```

Expected: FAIL — `parseEntityTypes` is not exported.

- [ ] **Step 3: Implement the parser and wire the route**

In `backend/src/lib/treasuryService.ts`, beside `CityFilters`:

```ts
/**
 * Entity types the treasury schema actually stores. Measured 2026-09-22:
 * city 2,903 · township 2,787 · borough 949 · county 704 · town 486 ·
 * village 253 · state 50 · municipality 15 · nonprofit 1 · federal 1.
 *
 * ⚠ This is a VALIDATION whitelist, not a classification. It says which values
 * exist, never which of them count as a city — that judgement stays in the
 * caller (see CityFilters).
 */
export const KNOWN_ENTITY_TYPES: ReadonlySet<string> = new Set([
  'city', 'town', 'township', 'village', 'borough',
  'municipality', 'county', 'state', 'nonprofit', 'federal',
]);

export function parseEntityTypes(raw: unknown): { values: string[] } | { invalid: string } {
  if (typeof raw !== 'string' || raw.trim() === '') return { values: [] };
  const values = raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
  const invalid = values.find((v) => !KNOWN_ENTITY_TYPES.has(v));
  if (invalid !== undefined) return { invalid };
  return { values };
}
```

In `backend/src/routes/treasury.ts`, replace the body of the `/cities` handler:

```ts
router.get('/cities', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const slugParam = typeof req.query['slug'] === 'string' ? req.query['slug'].trim() : '';
    if (slugParam.length > 200) {
      res.status(422).json({ code: 'INVALID_SLUG', message: 'slug too long' });
      return;
    }

    const types = parseEntityTypes(req.query['entity_type']);
    if ('invalid' in types) {
      res.status(422).json({
        code: 'INVALID_ENTITY_TYPE',
        message: `unknown entity_type: ${types.invalid}`,
      });
      return;
    }

    const stateParam = typeof req.query['state'] === 'string' ? req.query['state'].trim() : '';
    const countyParam = typeof req.query['county_id'] === 'string' ? req.query['county_id'].trim() : '';
    if (countyParam && !UUID_REGEX.test(countyParam)) {
      res.status(422).json({ code: 'INVALID_COUNTY_ID', message: 'county_id must be a uuid' });
      return;
    }

    const cities = await getCities(
      req.query['datasets'] === 'summary' ? 'summary' : 'full',
      slugParam || undefined,
      {
        entityTypes: types.values,
        state: stateParam || undefined,
        countyId: countyParam || undefined,
      }
    );
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.status(200).json(cities);
  } catch (err) {
    console.error('[GET /treasury/cities] error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
});
```

Add `parseEntityTypes` to the existing `treasuryService.js` import at the top of the route file.

⚠ `?state=` is deliberately NOT validated against a list of states: an unknown one matches nothing and returns `[]`, which is honest. Only a malformed *shape* (a bad uuid, an unknown type) is a 422.

- [ ] **Step 4: Run the tests and the build**

```bash
cd /c/ev-accounts/backend && npx vitest run src/lib/ && npx tsc --noEmit
```

Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
cd /c/ev-accounts && git add backend/src/lib/treasuryService.ts backend/src/lib/treasuryService.entityTypes.test.ts backend/src/routes/treasury.ts
git commit -m "feat(treasury): wire cities filters, 422 on unknown entity_type"
```

---

### Task 3: `?fields=index` lean column set

**Files:**
- Modify: `backend/src/lib/treasuryService.ts` (`getCities`, `TreasuryCity`)
- Modify: `backend/src/routes/treasury.ts` (the `/cities` handler)
- Test: `backend/src/lib/treasuryService.cities.test.ts` (append)

**Interfaces:**
- Consumes: Task 1's `CityFilters`, Task 2's route.
- Produces: `export interface TreasuryCityIndex { id: string; name: string; state: string; entity_type: string | null; county_id: string | null; has_data: boolean }`, and `getCities` accepting `fields?: 'index'` inside `CityFilters`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/lib/treasuryService.cities.test.ts`:

```ts
describe('getCities — ?fields=index', () => {
  it('selects only the index columns and a has_data flag', async () => {
    await getCities('summary', undefined, { fields: 'index' });
    const s = sql();
    expect(s).toContain('m.id');
    expect(s).toContain('m.county_id');
    expect(s).toMatch(/COUNT\(b\.id\) > 0\) AS has_data/);
    // The heavy things must be gone.
    expect(s).not.toContain('m.hero_image_url');
    expect(s).not.toContain('m.population');
    expect(s).not.toContain('dataset_summary');
    expect(s).not.toContain('available_datasets');
  });

  it('keeps the HAVING contract, so index rows are the same population', async () => {
    await getCities('summary', undefined, { fields: 'index' });
    expect(sql()).toMatch(/HAVING COUNT\(b\.id\) > 0/);
  });

  it('maps rows to the lean shape with has_data as a real boolean', async () => {
    query.mockResolvedValue({ rows: [{
      id: 'c1', name: 'Testville', state: 'CA', entity_type: 'city',
      county_id: null, has_data: true,
    }] });
    const [row] = await getCities('summary', undefined, { fields: 'index' });
    expect(row).toEqual({
      id: 'c1', name: 'Testville', state: 'CA', entity_type: 'city',
      county_id: null, has_data: true,
    });
  });

  it('composes with the other filters', async () => {
    await getCities('summary', undefined, { fields: 'index', state: 'CA' });
    expect(params()).toEqual(['CA']);
    expect(sql()).toMatch(WHERE_CLAUSE);
  });
});
```

- [ ] **Step 2: Run them and verify they fail**

```bash
cd /c/ev-accounts/backend && npx vitest run src/lib/treasuryService.cities.test.ts
```

Expected: FAIL — `fields` is not a member of `CityFilters`.

- [ ] **Step 3: Implement index mode**

In `backend/src/lib/treasuryService.ts`, add to `CityFilters`:

```ts
  /**
   * ⚠ The ONLY filter that changes COLUMNS rather than rows. Opt-in for the
   * same reason as `datasets=summary`: this endpoint is a cross-app contract,
   * so the default response must stay byte-for-byte identical.
   *
   * Measured 2026-09-22: 3.05 MB -> 1,127 KB for all 8,149 rows, because
   * `dataset_summary` is most of the weight. It exists for Treasury Tracker's
   * entity switcher and landing search, which need names to match on and a
   * has-data flag — nothing else.
   */
  fields?: 'index';
```

Add the row type and projection:

```ts
export interface TreasuryCityIndex {
  id: string;
  name: string;
  state: string;
  entity_type: string | null;
  county_id: string | null;
  has_data: boolean;
}

const COLUMNS_INDEX = `m.id, m.name, m.state, m.entity_type, m.county_id,
            (COUNT(b.id) > 0) AS has_data`;
```

In `getCities`, replace the projection line and the mapper, widening the return type to `Promise<TreasuryCity[] | TreasuryCityIndex[]>`:

```ts
  const index = filters.fields === 'index';
  // ... inside the query template, replace the SELECT list with:
  //   ${index ? COLUMNS_INDEX : `m.id, m.name, ... ${mode === 'summary' ? DATASETS_SUMMARY : DATASETS_FULL}`}
  // and replace the final mapping with:
  return index
    ? rows.map((r: any) => ({
        id: r.id, name: r.name, state: r.state, entity_type: r.entity_type,
        county_id: r.county_id ?? null, has_data: Boolean(r.has_data),
      }))
    : rows.map((r) => mapCity(r, mode));
```

⚠ `Boolean(r.has_data)` is deliberate: node-postgres returns `boolean` for a `bool` expression, but the explicit cast keeps this honest if the expression is ever changed to a count.

⚠ The union return type is safe to widen: `getCities` has exactly ONE
non-test caller in the repo — `backend/src/routes/treasury.ts:77`, which passes
the result straight to `res.json()`. Verified against `origin/master` on
2026-09-22. If that stops being true, narrow with an overload rather than
casting at the call site.

In `backend/src/routes/treasury.ts`, pass it through:

```ts
        fields: req.query['fields'] === 'index' ? 'index' : undefined,
```

- [ ] **Step 4: Run the tests and the build**

```bash
cd /c/ev-accounts/backend && npx vitest run src/lib/ && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit and open the PR**

```bash
cd /c/ev-accounts && git add backend/src/lib/treasuryService.ts backend/src/lib/treasuryService.cities.test.ts backend/src/routes/treasury.ts
git commit -m "feat(treasury): ?fields=index lean entity index for TT's switcher"
git push -u origin <branch>
gh pr create --title "feat(treasury): additive cities filters + lean entity index"
```

- [ ] **Step 6: Verify against the deployed API once merged**

```bash
curl -s "https://ev-accounts-api.onrender.com/api/treasury/cities?datasets=summary&entity_type=state" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);console.log('rows',r.length,'types',[...new Set(r.map(x=>x.entity_type))])})"
curl -s -o /dev/null -w "%{http_code}\n" "https://ev-accounts-api.onrender.com/api/treasury/cities?entity_type=citty"
```

Expected: 50 rows, all `state`; then `422`.

---

# PART B — `treasury-tracker` (safe to ship before or after Part A)

### Task 4: `entityQueries.ts` — the fetch layer

**Files:**
- Create: `src/data/entityQueries.ts`
- Test: `src/data/entityQueries.test.ts`

**Interfaces:**
- Consumes: Part A's parameters (but must work without them).
- Produces:
  - `export function entityQueryUrl(base: string, f: { entityTypes?: string[]; state?: string; countyId?: string; fields?: 'index' }): string`
  - `export async function fetchEntities(f): Promise<Municipality[]>`
  - `export async function fetchEntityById(id: string): Promise<Municipality | null>`
  - `export function fetchEntityIndex(): Promise<EntityIndexRow[]>`
  - `export function clearEntityIndexCache(): void`
  - `export type EntityIndexRow = Pick<Municipality, 'id'|'name'|'state'|'entity_type'|'county_id'> & { has_data: boolean }`

- [ ] **Step 1: Write the failing test**

Create `src/data/entityQueries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { entityQueryUrl } from './entityQueries';

describe('entityQueryUrl', () => {
  it('always asks for summary mode, as the list endpoint expects', () => {
    expect(entityQueryUrl('/api/treasury/cities', {}))
      .toBe('/api/treasury/cities?datasets=summary');
  });

  it('serialises a type list as CSV', () => {
    expect(entityQueryUrl('/api/treasury/cities', { entityTypes: ['city', 'town'] }))
      .toBe('/api/treasury/cities?datasets=summary&entity_type=city%2Ctown');
  });

  it('carries state and county_id', () => {
    expect(entityQueryUrl('/api/treasury/cities', { state: 'CA', countyId: 'abc' }))
      .toBe('/api/treasury/cities?datasets=summary&state=CA&county_id=abc');
  });

  it('asks for the lean index when requested', () => {
    expect(entityQueryUrl('/api/treasury/cities', { fields: 'index' }))
      .toBe('/api/treasury/cities?datasets=summary&fields=index');
  });

  it('omits empty values rather than sending blank parameters', () => {
    expect(entityQueryUrl('/api/treasury/cities', { entityTypes: [], state: '' }))
      .toBe('/api/treasury/cities?datasets=summary');
  });
});

describe('fetchEntityIndex', () => {
  beforeEach(() => clearEntityIndexCache());
  afterEach(() => vi.unstubAllGlobals());

  it('requests the lean index and fetches it at most once', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => [] } as unknown as Response;
    }));

    await Promise.all([fetchEntityIndex(), fetchEntityIndex(), fetchEntityIndex()]);

    // ⚠ The PROMISE is memoized, not the value. Three simultaneous callers must
    // share one request — the defect fixed in #213, one layer up.
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('fields=index');
  });

  it('does not memoize a failure — a later call retries', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      n += 1;
      if (n === 1) return { ok: false, status: 500 } as unknown as Response;
      return { ok: true, status: 200, json: async () => [{ id: 'a' }] } as unknown as Response;
    }));

    await expect(fetchEntityIndex()).rejects.toThrow();
    await expect(fetchEntityIndex()).resolves.toEqual([{ id: 'a' }]);
  });
});
```

The imports at the top of that file:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { entityQueryUrl, fetchEntityIndex, clearEntityIndexCache } from './entityQueries';
```

- [ ] **Step 2: Run it and verify it fails**

```bash
cd /c/treasury-tracker && npx vitest run src/data/entityQueries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/data/entityQueries.ts`:

```ts
import type { Municipality } from '../types/budget';

const API_BASE = import.meta.env.PROD && import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export type EntityIndexRow =
  Pick<Municipality, 'id' | 'name' | 'state' | 'entity_type' | 'county_id'>
  & { has_data: boolean };

export interface EntityQuery {
  entityTypes?: string[];
  state?: string;
  countyId?: string;
  fields?: 'index';
}

/**
 * ⚠ `datasets=summary` is always sent. It is what keeps the per-budget-row
 * `available_datasets` array (97% of 23.5 MB) out of the response, and it
 * predates every filter here.
 */
export function entityQueryUrl(base: string, f: EntityQuery): string {
  const p = new URLSearchParams({ datasets: 'summary' });
  if (f.entityTypes?.length) p.set('entity_type', f.entityTypes.join(','));
  if (f.state) p.set('state', f.state);
  if (f.countyId) p.set('county_id', f.countyId);
  if (f.fields) p.set('fields', f.fields);
  return `${base}?${p.toString()}`;
}

/**
 * ⚠⚠ THE CALLER MUST STILL APPLY ITS OWN PREDICATE to what comes back. An API
 * that does not yet understand these parameters returns the FULL list, and
 * every consumer has to render correctly against that — which is what makes
 * the deploy order between the two repos irrelevant. It also means a future
 * drift between a filter and its predicate shows up as a visibly wrong list
 * rather than as silent substitution.
 */
export async function fetchEntities(f: EntityQuery): Promise<Municipality[]> {
  const res = await fetch(entityQueryUrl(`${API_BASE}/treasury/cities`, f));
  if (!res.ok) throw new Error(`Cities API returned ${res.status}`);
  return res.json();
}

/**
 * One entity by id. Used for the county in the jurisdiction chain, which is the
 * only parent not covered by the states+federal query.
 *
 * ⚠ Lives here rather than in App.tsx because `API_BASE` is private to this
 * layer — App.tsx has no business knowing the API's shape.
 */
export async function fetchEntityById(id: string): Promise<Municipality | null> {
  const res = await fetch(`${API_BASE}/treasury/cities/${id}`);
  if (!res.ok) return null;
  return res.json();
}

let indexPromise: Promise<EntityIndexRow[]> | null = null;

/** The lean index, fetched at most once per session. Memoize the PROMISE. */
export function fetchEntityIndex(): Promise<EntityIndexRow[]> {
  if (!indexPromise) {
    indexPromise = fetchEntities({ fields: 'index' }) as unknown as Promise<EntityIndexRow[]>;
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

/** Test seam — clears the memo. */
export function clearEntityIndexCache(): void { indexPromise = null; }
```

- [ ] **Step 4: Run the test**

```bash
cd /c/treasury-tracker && npx vitest run src/data/entityQueries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/entityQueries.ts src/data/entityQueries.test.ts
git commit -m "feat(perf): entity query layer that fetches one slice at a time"
```

---

### Task 5: `hasDatasets` understands an index row

**Files:**
- Modify: `src/data/municipalityDatasets.ts:30-34`
- Test: `src/data/municipalityDatasets.test.ts` (exists — append)

**Interfaces:**
- Consumes: `EntityIndexRow` from Task 4.
- Produces: `hasDatasets` accepting `{ has_data?: boolean }` in addition to today's shapes.

- [ ] **Step 1: Write the failing test**

Append to `src/data/municipalityDatasets.test.ts`:

```ts
describe('hasDatasets — index rows', () => {
  it('trusts an explicit has_data flag', () => {
    expect(hasDatasets({ has_data: true } as never)).toBe(true);
    expect(hasDatasets({ has_data: false } as never)).toBe(false);
  });

  it('still reads dataset_summary when there is no flag', () => {
    expect(hasDatasets({ dataset_summary: { years: [2024], dataset_types: ['operating'] } } as never)).toBe(true);
    expect(hasDatasets({ dataset_summary: { years: [], dataset_types: [] } } as never)).toBe(false);
  });

  it('prefers the flag over an absent summary, not the other way round', () => {
    // An index row has NO dataset_summary. Reading the summary first would
    // report every indexed entity as having no data.
    expect(hasDatasets({ has_data: true, dataset_summary: undefined } as never)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
cd /c/treasury-tracker && npx vitest run src/data/municipalityDatasets.test.ts
```

Expected: FAIL — the flag is ignored, so the first case returns `false`.

- [ ] **Step 3: Implement**

```ts
export function hasDatasets(
  m: Pick<Municipality, 'available_datasets' | 'dataset_summary'> & { has_data?: boolean }
): boolean {
  // ⚠ THE FLAG FIRST. An index row carries no dataset_summary at all, so
  // checking the summary first would report every indexed entity as empty and
  // the switcher would render "0 jurisdictions".
  if (typeof m.has_data === 'boolean') return m.has_data;
  if (m.dataset_summary) return m.dataset_summary.years.length > 0;
  return (m.available_datasets?.length ?? 0) > 0;
}
```

- [ ] **Step 4: Run the tests**

```bash
cd /c/treasury-tracker && npx vitest run src/data/municipalityDatasets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/municipalityDatasets.ts src/data/municipalityDatasets.test.ts
git commit -m "feat(perf): hasDatasets reads an index row's has_data flag"
```

---

### Task 6: Parents and panels fetch their own slice

**Files:**
- Modify: `src/App.tsx` — `jurisdictionParents` (~918-947), the four panel render sites (~1742-1775)
- Create: `src/data/panelQueries.ts`
- Test: `src/data/panelQueries.test.ts`

**Interfaces:**
- Consumes: `fetchEntities`, `fetchEntityById`, `EntityQuery` (Task 4); `CITY_TIER_TYPES` (`src/utils/cityTierTypes.ts`).
- Produces: `export function panelQueryFor(entity: Pick<Municipality,'entity_type'|'state'|'id'>): EntityQuery | null` and `export function parentsQuery(): EntityQuery`.

- [ ] **Step 1: Write the failing test**

Create `src/data/panelQueries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { panelQueryFor, parentsQuery } from './panelQueries';
import { CITY_TIER_TYPES } from '../utils/cityTierTypes';

describe('panelQueryFor', () => {
  it('asks for a county\'s city-tier children', () => {
    expect(panelQueryFor({ entity_type: 'county', state: 'MI', id: 'c-1' }))
      .toEqual({ countyId: 'c-1', entityTypes: [...CITY_TIER_TYPES] });
  });

  it('asks for a state\'s counties and places in one query', () => {
    // Both state panels are served by ONE fetch; each keeps its own predicate.
    expect(panelQueryFor({ entity_type: 'state', state: 'CA', id: 's-1' }))
      .toEqual({ state: 'CA' });
  });

  it('asks for the 50 states on the federal page', () => {
    expect(panelQueryFor({ entity_type: 'federal', state: 'US', id: 'f-1' }))
      .toEqual({ entityTypes: ['state'] });
  });

  it('asks for NOTHING on a city page — no panel renders there', () => {
    expect(panelQueryFor({ entity_type: 'city', state: 'CA', id: 'x' })).toBeNull();
    expect(panelQueryFor({ entity_type: 'nonprofit', state: 'CA', id: 'x' })).toBeNull();
  });
});

describe('parentsQuery', () => {
  it('fetches only the federal row and the 50 states', () => {
    expect(parentsQuery()).toEqual({ entityTypes: ['state', 'federal'] });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

```bash
cd /c/treasury-tracker && npx vitest run src/data/panelQueries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/data/panelQueries.ts`:

```ts
import type { Municipality } from '../types/budget';
import type { EntityQuery } from './entityQueries';
import { CITY_TIER_TYPES } from '../utils/cityTierTypes';

/**
 * The slice a page's panels need, or null when it has none.
 *
 * ⭐ A CITY PAGE RENDERS NO PANELS AT ALL — all four are gated on an
 * entity_type of federal, county or state (App.tsx). That is the whole reason
 * this change works: the common case needs ~52 rows, not 8,149.
 *
 * ⚠ A STATE page returns ONE query covering both of its panels. Splitting it
 * would double the requests to save nothing: CountiesInStatePanel and
 * CitiesInStatePanel both want `state = X` and differ only in their predicate,
 * which they still apply themselves.
 */
export function panelQueryFor(
  entity: Pick<Municipality, 'entity_type' | 'state' | 'id'>
): EntityQuery | null {
  switch (entity.entity_type) {
    case 'federal': return { entityTypes: ['state'] };
    case 'state':   return { state: entity.state };
    case 'county':  return { countyId: entity.id, entityTypes: [...CITY_TIER_TYPES] };
    default:        return null;
  }
}

/**
 * The jurisdiction chain above any entity: the federal row, all 50 states (a
 * city resolves its own by abbreviation), and — fetched separately by id — its
 * county. ~52 rows, against 8,149 before.
 */
export function parentsQuery(): EntityQuery {
  return { entityTypes: ['state', 'federal'] };
}
```

- [ ] **Step 4: Run the test**

```bash
cd /c/treasury-tracker && npx vitest run src/data/panelQueries.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire it into `App.tsx`**

Replace the single full-list load with two purpose-built pieces of state. Keep the `municipalities` prop on every panel — their predicates are unchanged, so the components themselves need no edit.

```tsx
  // Parent jurisdictions + whatever the current page's panels need. Both are
  // narrow queries; neither is the 8,149-row list.
  const [parentPool, setParentPool] = useState<Municipality[]>([]);
  const [panelPool, setPanelPool] = useState<Municipality[]>([]);

  useEffect(() => {
    fetchEntities(parentsQuery()).then(setParentPool).catch(() => setParentPool([]));
  }, []);

  useEffect(() => {
    if (!selectedEntity) { setPanelPool([]); return; }
    const q = panelQueryFor(selectedEntity);
    if (!q) { setPanelPool([]); return; }
    let live = true;
    fetchEntities(q).then(rows => { if (live) setPanelPool(rows); }).catch(() => { if (live) setPanelPool([]); });
    return () => { live = false; };
  }, [selectedEntity]);
```

`jurisdictionParents` reads `parentPool` instead of `municipalities`, with the county fetched by id:

```tsx
  const [countyParent, setCountyParent] = useState<Municipality | null>(null);
  useEffect(() => {
    const id = selectedEntity?.county_id;
    if (!id) { setCountyParent(null); return; }
    let live = true;
    fetchEntityById(id)
      .then(row => { if (live) setCountyParent(row); })
      .catch(() => { if (live) setCountyParent(null); });
    return () => { live = false; };
  }, [selectedEntity?.county_id]);
```

Then in `jurisdictionParents`, replace the three lookups:

```tsx
    const federal = parentPool.find(m => m.entity_type === 'federal') ?? null;
    const state = parentPool.find(
      m => m.entity_type === 'state' && m.state === selectedEntity.state
    ) ?? null;
    const county = countyParent;
```

and change the dependency array to `[selectedEntity, parentPool, countyParent]`.

Pass `panelPool` to the four panels in place of `municipalities`.

- [ ] **Step 6: Build and run the whole suite**

```bash
cd /c/treasury-tracker && npm run build && npm test
```

Expected: build clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/data/panelQueries.ts src/data/panelQueries.test.ts src/App.tsx
git commit -m "perf(tt): parents and panels fetch their own slice, not the full list"
```

---

### Task 7: The switcher and landing load the lean index, lazily

**Files:**
- Modify: `src/components/EntitySwitcher.tsx` (props + open handler + placeholder)
- Modify: `src/App.tsx` (stop holding the full list; pass the index)
- Test: `src/data/entityQueries.test.ts` (append)

**Interfaces:**
- Consumes: `fetchEntityIndex`, `EntityIndexRow` (Task 4); `hasDatasets` (Task 5).
- Produces: `EntitySwitcher` gains `onFirstOpen?: () => void` and tolerates an empty `municipalities` array while the index loads.

⚠ **THIS TASK HAS NO UNIT TEST, AND THAT IS NOT AN OVERSIGHT.** Its whole
deliverable is component wiring, and `vitest.config.ts` never executes a
`.test.tsx` — a test file here would not run. `fetchEntityIndex` is already
pinned by Task 4. The gate for this task is Step 4's browser check, which is
the only thing that can observe it.

- [ ] **Step 1: Load the index on first open**

In `src/App.tsx`:

```tsx
  const [entityIndex, setEntityIndex] = useState<Municipality[]>([]);
  const loadIndex = useCallback(() => {
    fetchEntityIndex()
      .then(rows => setEntityIndex(rows as unknown as Municipality[]))
      .catch(() => setEntityIndex([]));
  }, []);
```

Pass `municipalities={entityIndex}` and `onFirstOpen={loadIndex}` to `EntitySwitcher`, and call `loadIndex()` when the landing view renders (`AlphaLanding` keeps `municipalities={entityIndex}`).

In `src/components/EntitySwitcher.tsx`, add the prop and fire it once:

```tsx
  const openedOnce = useRef(false);
  const handleOpen = () => {
    if (!openedOnce.current) { openedOnce.current = true; onFirstOpen?.(); }
    setOpen(o => !o);
  };
```

⚠ Replace the count in the placeholder while the index is empty:

```tsx
  placeholder={totalCount > 0
    ? `Search ${totalCount.toLocaleString()} jurisdictions...`
    : 'Search jurisdictions...'}
```

**Rendering `Search 0 jurisdictions...` would be a false statement about coverage**, which is worse than saying nothing — the same reasoning as the `unknown`-vs-inapplicable rule in PR #198.

- [ ] **Step 2: Build and run the suite**

```bash
cd /c/treasury-tracker && npm run build && npm test
```

Expected: build clean, all tests pass.

- [ ] **Step 3: Verify the index is NOT fetched on page load**

Start the dev server against the prod API, then:

```bash
node api-calls.mjs "http://127.0.0.1:5173/?entity=los-angeles-ca&year=2024&dataset=operating"
```

Expected: no request containing `fields=index`.

- [ ] **Step 4: Verify it IS fetched when the switcher opens, and that search works**

Drive the browser: click the entity switcher, type `los ang`, confirm Los Angeles
appears, and confirm exactly one `fields=index` request was made. Confirm the
placeholder reads `Search jurisdictions...` before the index lands and
`Search N jurisdictions...` after — never `Search 0 jurisdictions...`.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/EntitySwitcher.tsx
git commit -m "perf(tt): the switcher's index loads on first open, not on page load"
```

---

### Task 8: Widen the `?slug=` fast path to every host, and delete the full-list fetch

**Files:**
- Modify: `src/App.tsx:425-470` (the resolution block)
- Test: `src/data/entityQueries.test.ts` or `src/utils/entityRouting.test.ts` (whichever holds the resolver's tests)

**Interfaces:**
- Consumes: everything above.
- Produces: no new exports; `fetchCityList()` must no longer be reachable from a normal page load.

- [ ] **Step 1: Remove the host gate**

In `src/App.tsx`, the fast path is currently `if (isFinancialsHost) { ... }`. Drop the condition so every host tries the slug lookup first:

```tsx
      (async () => {
        let resolution: Awaited<ReturnType<typeof viaFullList>> | null = null;
        // ⚠ No longer gated on the financials host. That gate existed only
        // because TT's parents and panels needed the full list; they now fetch
        // their own slices (see panelQueries.ts).
        try {
          const fast = await viaSlugLookup();
          if (fast.kind !== 'not_found') resolution = fast;
        } catch {
          // fall through to the full list
        }
        if (!resolution) resolution = await viaFullList();
```

⚠ Keep `viaFullList()` as the fallback. It is what makes an unresolvable slug land on the searchable not-found page, and it is the safety net if the API has not deployed Part A.

- [ ] **Step 2: Prove the list is gone from a normal load**

```bash
cd /c/treasury-tracker && VITE_API_URL="https://ev-accounts-api.onrender.com" npm run dev -- --host 127.0.0.1
```

Then, in another shell, using the harness from the 2026-09-22 session
(`scratchpad/api-calls.mjs`):

```bash
node api-calls.mjs "http://127.0.0.1:5173/?entity=los-angeles-ca&year=2024&dataset=operating"
```

Expected: `full list fetched: 0 time(s)`, and no `/treasury/cities?datasets=summary` without a filter.

- [ ] **Step 3: Build, test, commit**

```bash
cd /c/treasury-tracker && npm run build && npm test
git add src/App.tsx
git commit -m "perf(tt): resolve every host by slug, not by downloading 8,149 rows"
```

---

### Task 9: Measure it, repeatedly, and only then claim it

**Files:**
- No source changes. Uses `scratchpad/prod-waterfall.mjs` and `scratchpad/api-calls.mjs`.

- [ ] **Step 1: Measure four page types against the deployed build**

```bash
for u in \
  "https://treasurytracker.empowered.vote/?entity=los-angeles-ca&year=2024&dataset=operating" \
  "https://treasurytracker.empowered.vote/?entity=los-angeles-county-ca&year=2024" \
  "https://treasurytracker.empowered.vote/?entity=california-ca&year=2024" \
  "https://financials.empowered.vote/?entity=empowered-vote-ca&year=2026" ; do
  node prod-waterfall.mjs "$u"
done
```

- [ ] **Step 2: Run the city page FIVE times and record the spread**

⚠⚠ **A SINGLE FAST RUN PROVES NOTHING HERE.** The defect's signature is
variance: on 2026-09-22 the same URL measured 12,148 ms and 3,168 ms minutes
apart with nothing changed. Record min/median/max, not one number.

- [ ] **Step 3: Record the result in memory**

Update `project_financials_page_load_perf.md` with the measured before/after
per page type, and the spread from Step 2. If TT's city page is still slow,
say so plainly rather than reporting the best run.

---

## Notes for the executor

- **Part A must be merged and DEPLOYED before Part B's numbers improve**, but Part B is safe to merge first: every consumer still filters client-side, so an API that ignores the new parameters renders correctly and merely slowly. Verify the deploy went `live` — a merged PR is not a deploy, and Render silently cancels builds when the workspace runs out of build-pipeline minutes.
- **Do not add a `special_district` to `KNOWN_ENTITY_TYPES`** without also deciding the `CitiesInCountyPanel` / `CitiesInStatePanel` discrepancy in the spec's penultimate section — today they agree only because no such row exists.
