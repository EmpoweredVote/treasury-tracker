/**
 * Tests for essentialsCoverage.ts — the TT-side coverage fetch/cache + matcher
 * (COV-02/03/04). Fixture-backed, mirroring the reciprocal Essentials suite
 * (treasury.test.js): state-scoped disambiguation, tier alignment, loose
 * punctuation/"County"/", ST"-suffix matching, and a never-throws fetch guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchEntityToCoverage, normalizePlace } from './essentialsCoverage';
import type { CoverageCatalog } from './essentialsCoverage';
import fixtureJson from './__fixtures__/coverage.sample.json';

const catalog = fixtureJson as CoverageCatalog;

describe('normalizePlace', () => {
  it('lowercases, drops punctuation, expands saint, collapses whitespace', () => {
    expect(normalizePlace("St. Mary's County")).toBe('st mary s county');
    expect(normalizePlace('Saint Louis')).toBe('st louis');
  });
});

describe('matchEntityToCoverage — tier alignment + loose matching (COV-03/04)', () => {
  it('resolves Long Beach CA (city) to its geoid', () => {
    const m = matchEntityToCoverage({ name: 'Long Beach', state: 'CA', entity_type: 'city' }, catalog);
    expect(m).toMatchObject({ tier: 'city', geoids: ['0643000'] });
  });

  it('resolves Bloomington IN (city, geoid-less) to a covered record with hasContext', () => {
    const m = matchEntityToCoverage({ name: 'Bloomington', state: 'IN', entity_type: 'city' }, catalog);
    expect(m).not.toBeNull();
    expect(m?.hasContext).toBe(true);
    expect(m?.geoids).toEqual([]);
  });

  it('resolves Los Angeles County CA (county) to its geoid', () => {
    const m = matchEntityToCoverage(
      { name: 'Los Angeles County', state: 'CA', entity_type: 'county' },
      catalog
    );
    expect(m).toMatchObject({ tier: 'county', geoids: ['06037'] });
  });

  it("matches St. Mary's County MD loosely (punctuation-tolerant)", () => {
    const m = matchEntityToCoverage(
      { name: "St. Mary's County", state: 'MD', entity_type: 'county' },
      catalog
    );
    expect(m).toMatchObject({ tier: 'county', geoids: ['24037'] });
  });

  it('resolves Washington County OR to the state-suffixed label (geoid 41067)', () => {
    const m = matchEntityToCoverage(
      { name: 'Washington County', state: 'OR', entity_type: 'county' },
      catalog
    );
    expect(m).toMatchObject({ tier: 'county', geoids: ['41067'] });
  });

  it('resolves Washington County UT to the bare label (geoid 49053), not the OR record', () => {
    const m = matchEntityToCoverage(
      { name: 'Washington County', state: 'UT', entity_type: 'county' },
      catalog
    );
    expect(m).toMatchObject({ tier: 'county', geoids: ['49053'] });
    expect(m?.geoids).not.toEqual(['41067']);
  });

  it('returns null for a Salem UT city not in the fixture (no wrong-state match)', () => {
    const m = matchEntityToCoverage({ name: 'Salem', state: 'UT', entity_type: 'city' }, catalog);
    expect(m).toBeNull();
  });

  it('resolves a state entity by abbrev', () => {
    const m = matchEntityToCoverage({ name: 'California', state: 'CA', entity_type: 'state' }, catalog);
    expect(m).toEqual({ tier: 'state', label: 'California', stateAbbrev: 'CA' });
  });

  it('resolves the federal entity to a non-null national browse target', () => {
    const m = matchEntityToCoverage(
      { name: 'United States', state: 'US', entity_type: 'federal' },
      catalog
    );
    expect(m).not.toBeNull();
    expect(m?.target).toBe('/results?browse_federal_officials=1&browse_label=United+States');
  });

  it('returns null for a nonprofit entity (not a matchable tier)', () => {
    const m = matchEntityToCoverage({ name: 'Some Org', state: 'CA', entity_type: 'nonprofit' }, catalog);
    expect(m).toBeNull();
  });

  it('returns null when the catalog itself is null', () => {
    const m = matchEntityToCoverage({ name: 'Long Beach', state: 'CA', entity_type: 'city' }, null);
    expect(m).toBeNull();
  });
});

describe('fetchCoverage — never throws (COV-02)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('resolves to null when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { fetchCoverage } = await import('./essentialsCoverage');
    await expect(fetchCoverage()).resolves.toBeNull();
  });

  it('resolves to null on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { fetchCoverage } = await import('./essentialsCoverage');
    await expect(fetchCoverage()).resolves.toBeNull();
  });
});

describe('village and township tiers (MI F-65 sweep)', () => {
  const catalog = {
    cities: [
      { label: 'Springport', geoids: ['2675420'], state: 'MI' },
      { label: 'Hopkins Township', geoids: ['2699999'], state: 'MI' },
      { label: 'Grant Township', geoids: ['2688888'], state: 'MI' },
    ],
    counties: [{ label: 'Allegan County', geoids: ['26005'], state: 'MI' }],
  };

  // ⚠ A village is city-tier: an incorporated place with its own government.
  it('resolves a village against the city records', () => {
    const r = matchEntityToCoverage(
      { name: 'Springport', state: 'MI', entity_type: 'village' }, catalog);
    expect(r?.tier).toBe('city');
    expect(r?.label).toBe('Springport');
  });

  // ⚠⚠ Michigan townships are NAMED "Hopkins Township, Allegan County" — 117
  // township names are shared by 302 townships, so the county is part of the
  // identity. Before the parent-county strip, `stripLabel` reduced that to
  // "Hopkins Township, Allegan" and all 1,240 silently matched NOTHING.
  it('resolves a township whose name carries its parent county', () => {
    const r = matchEntityToCoverage(
      { name: 'Hopkins Township, Allegan County', state: 'MI', entity_type: 'township' }, catalog);
    expect(r?.tier).toBe('city');
    expect(r?.label).toBe('Hopkins Township');
  });

  // ⚠ A county's OWN label still reduces past the bare " County" rule.
  it('still matches a county on its own label', () => {
    const r = matchEntityToCoverage(
      { name: 'Allegan County', state: 'MI', entity_type: 'county' }, catalog);
    expect(r?.tier).toBe('county');
    expect(r?.label).toBe('Allegan County');
  });

  // ⚠ Never a wrong-state link, whatever the tier.
  it('refuses a same-name village in another state', () => {
    expect(matchEntityToCoverage(
      { name: 'Springport', state: 'IN', entity_type: 'village' }, catalog)).toBeNull();
  });
});
