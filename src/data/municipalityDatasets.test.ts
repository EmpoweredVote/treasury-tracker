import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { hasDatasets, datasetYears, datasetTypes } from './municipalityDatasets';
import { hydrateMunicipality, clearCache } from './dataLoader';
import type { Municipality } from '../types/budget';

/**
 * ⚠ A REAL Municipality, not a partial cast. `{...} as Municipality` compiles
 * under `vitest` but NOT under CI's `tsc -b`, which type-checks the test files —
 * and a local `npm run build` can miss it on a stale incremental cache. Supply
 * the required fields once, here.
 */
const muni = (over: Partial<Municipality> = {}): Municipality => ({
  id: 'abc', name: 'Detroit', state: 'MI', entity_type: 'city', population: 1,
  ...over,
});

/**
 * ⚠ Typed FROM the Municipality shape, not hand-widened. A literal object infers
 * `dataset_type: string`, which is not the union the type declares, and CI's
 * `tsc -b` rejects it even though vitest is happy.
 */
type DatasetEntry = NonNullable<Municipality['available_datasets']>[number];

const entry = (
  fiscal_year: number,
  dataset_type: DatasetEntry['dataset_type'],
  fund_scope: DatasetEntry['fund_scope'] = 'general_fund',
): DatasetEntry => ({
  fiscal_year, dataset_type, fund_scope, basis: 'actual',
  reporting_entity: 'primary_government', derivation: 'published', audit_grade: 'unknown',
});

describe('reading coverage from either shape', () => {
  // ⚠⚠ THE FAILURE THAT MATTERS is `hasDatasets` returning false for a real
  // government: it removes the place from search and from every browse grid,
  // silently and with no error anywhere.
  it('reports data from a SUMMARY entity', () => {
    const m = muni({ dataset_summary: { years: [2024, 2023], dataset_types: ['operating'] } });
    expect(hasDatasets(m)).toBe(true);
    expect(datasetYears(m)).toEqual([2024, 2023]);
    expect(datasetTypes(m)).toEqual(['operating']);
  });

  it('reports data from a FULL entity', () => {
    const m = muni({ available_datasets: [entry(2024, 'operating'), entry(2023, 'revenue')] });
    expect(hasDatasets(m)).toBe(true);
    expect(datasetYears(m)).toEqual([2024, 2023]);
    expect(datasetTypes(m)).toEqual(['operating', 'revenue']);
  });

  it('reports no data for either empty shape', () => {
    expect(hasDatasets(muni({ dataset_summary: { years: [], dataset_types: [] } }))).toBe(false);
    expect(hasDatasets(muni({ available_datasets: [] }))).toBe(false);
    expect(hasDatasets(muni())).toBe(false);
  });

  // ⚠ An entity with two fund scopes emits TWO entries per (year, dataset_type)
  // — Michigan carries sixteen years of exactly that. The raw array repeats
  // every year, so a year list built from it without de-duplicating would print
  // "2024, 2024, 2023, 2023" in the browse grid.
  it('de-duplicates years across fund scopes', () => {
    const m = muni({
      available_datasets: [
        entry(2024, 'operating', 'general_fund'), entry(2024, 'operating', 'total_governmental'),
        entry(2023, 'revenue', 'general_fund'), entry(2023, 'revenue', 'total_governmental'),
      ],
    });
    expect(datasetYears(m)).toEqual([2024, 2023]);
  });

  it('returns years newest first from both shapes', () => {
    const summary = muni({ dataset_summary: { years: [2020, 2024, 2022], dataset_types: [] } });
    expect(datasetYears(summary)).toEqual([2024, 2022, 2020]);
    const full = muni({ available_datasets: [entry(2020, 'operating'), entry(2024, 'operating')] });
    expect(datasetYears(full)).toEqual([2024, 2020]);
  });

  // ⚠ Both present should never happen — the API returns exactly one — but if it
  // ever did, the SUMMARY is what the list was built from, so preferring it
  // keeps the grid consistent with what the list said.
  it('prefers the summary when both are somehow present', () => {
    const m = muni({ dataset_summary: { years: [2024], dataset_types: ['operating'] }, available_datasets: [entry(1999, 'revenue')] });
    expect(datasetYears(m)).toEqual([2024]);
  });
});

describe('hydrateMunicipality', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearCache();
    fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/treasury/cities/')
        ? { id: 'abc', name: 'WRONG NAME', available_datasets: [entry(2024, 'operating')] }
        : null),
    }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => { vi.unstubAllGlobals(); clearCache(); });

  it('fetches the full datasets for a summarised entity', async () => {
    const m = muni({ dataset_summary: { years: [2024], dataset_types: ['operating'] } });
    const full = await hydrateMunicipality(m);
    expect(full.available_datasets).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ⚠ Only the datasets are taken from the detail response. If the two endpoints
  // ever disagreed, an entity's name, population or county could change under
  // the reader simply because they clicked it.
  it('keeps the LIST entity fields and takes only the datasets', async () => {
    const m = muni({ dataset_summary: { years: [2024], dataset_types: [] } });
    const full = await hydrateMunicipality(m);
    expect(full.name).toBe('Detroit');
  });

  // ⚠ An already-hydrated entity must cost nothing. The selection path calls
  // this unconditionally so callers do not have to branch.
  it('returns an already-hydrated entity without fetching', async () => {
    const m = muni({ available_datasets: [entry(2024, 'operating')] });
    const full = await hydrateMunicipality(m);
    expect(full).toBe(m);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ⚠ Memoize the PROMISE, not the value — the app opens an entity and fires
  // several effects that all want its datasets before any request resolves.
  it('shares ONE request across concurrent callers', async () => {
    const m = muni({ dataset_summary: { years: [2024], dataset_types: [] } });
    await Promise.all([hydrateMunicipality(m), hydrateMunicipality(m), hydrateMunicipality(m)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ⚠ NEVER memoize a rejection: one transient failure would make an entity
  // permanently unopenable for the rest of the session.
  it('does not memoize a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => null })));
    const m = muni({ dataset_summary: { years: [2024], dataset_types: [] } });
    await expect(hydrateMunicipality(m)).rejects.toThrow(/500/);

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, json: async () => ({ available_datasets: [entry(2024, 'operating')] }),
    })));
    const full = await hydrateMunicipality(m);
    expect(full.available_datasets).toHaveLength(1);
  });

  // ⚠ A detail response without the array is a CONTRACT breach, not an empty
  // entity. Returning `[]` would render a real government as having no data.
  it('throws rather than treat a malformed response as an empty entity', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'abc' }) })));
    const m = muni({ dataset_summary: { years: [2024], dataset_types: [] } });
    await expect(hydrateMunicipality(m)).rejects.toThrow(/without available_datasets/);
  });
});

describe('the city list is requested in summary mode', () => {
  afterEach(() => { vi.unstubAllGlobals(); clearCache(); });

  // ⚠⚠ THIS IS THE PAYLOAD FIX. Without the query the response is 23.5 MB, 97.1%
  // of it one available_datasets entry per budget row, on every page load. The
  // assertion is on the URL because that is the only place the saving lives.
  it('asks for ?datasets=summary', async () => {
    clearCache();
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { listMunicipalities } = await import('./dataLoader');
    await listMunicipalities();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('datasets=summary');
  });
});
