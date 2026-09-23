import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { entityQueryUrl, fetchEntityIndex, clearEntityIndexCache } from './entityQueries';

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
