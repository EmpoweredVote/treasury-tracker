/**
 * Tests for featureIcons.ts — the tethered feature-icon product registry +
 * resolver (ICON-01..04, TETH-01/02). Fixture-backed via the Phase 125
 * coverage fixture + matcher, proving per-tier href construction, the
 * geoid-less/null → [] render-time gate, the reserved-slot registry, and the
 * T-126-01 same-origin-path guard on the federal target.
 */

import { describe, it, expect } from 'vitest';
import { matchEntityToCoverage } from './essentialsCoverage';
import type { CoverageCatalog, CoverageRecord } from './essentialsCoverage';
import { buildEssentialsHref, resolveFeatureIcons, PRODUCT_REGISTRY } from './featureIcons';
import fixtureJson from './__fixtures__/coverage.sample.json';

const catalog = fixtureJson as CoverageCatalog;

describe('buildEssentialsHref + resolveFeatureIcons — per-tier deep-links (TETH-01)', () => {
  it('resolves Long Beach CA (city) to an essentials icon with the tier-correct href', () => {
    const record = matchEntityToCoverage(
      { name: 'Long Beach', state: 'CA', entity_type: 'city' },
      catalog
    );
    const icons = resolveFeatureIcons(record);
    expect(icons).toHaveLength(1);
    expect(icons[0].key).toBe('essentials');
    expect(icons[0].href).toContain('browse_government_list=0643000');
    expect(icons[0].href).toContain('browse_state=CA');
    expect(icons[0].href).toContain('browse_label=Long+Beach');
  });

  it('resolves a state record (California/CA) to a browse_state_officials href', () => {
    const record = matchEntityToCoverage(
      { name: 'California', state: 'CA', entity_type: 'state' },
      catalog
    );
    const href = record ? buildEssentialsHref(record) : null;
    expect(href).toContain('browse_state_officials=CA');
  });

  it('resolves the federal record against ESSENTIALS_URL', () => {
    const record = matchEntityToCoverage(
      { name: 'United States', state: 'US', entity_type: 'federal' },
      catalog
    );
    const href = record ? buildEssentialsHref(record) : null;
    expect(href).not.toBeNull();
    expect(href).toContain('browse_federal_officials=1');
  });

  it('returns null/[] for Bloomington IN (covered, geoid-less)', () => {
    const record = matchEntityToCoverage(
      { name: 'Bloomington', state: 'IN', entity_type: 'city' },
      catalog
    );
    expect(record).not.toBeNull();
    expect(record ? buildEssentialsHref(record) : 'unreached').toBeNull();
    expect(resolveFeatureIcons(record)).toEqual([]);
  });

  it('returns [] for a null coverage record', () => {
    expect(resolveFeatureIcons(null)).toEqual([]);
  });

  it('rejects a hostile absolute federal target (same-origin-path guard, T-126-01)', () => {
    const hostileRecord: CoverageRecord = {
      tier: 'federal',
      label: 'United States',
      target: 'https://evil.example/x',
    };
    expect(buildEssentialsHref(hostileRecord)).toBeNull();
  });
});

describe('PRODUCT_REGISTRY — fixed reserved order (TETH-02, ICON-03)', () => {
  it('has exactly 3 entries in order essentials, compass, readrank', () => {
    expect(PRODUCT_REGISTRY.map((p) => p.key)).toEqual(['essentials', 'compass', 'readrank']);
  });

  it('compass and readrank never render (no per-location contract yet)', () => {
    const sampleRecord: CoverageRecord = {
      tier: 'city',
      label: 'Long Beach',
      geoids: ['0643000'],
      stateAbbrev: 'CA',
    };
    const compass = PRODUCT_REGISTRY.find((p) => p.key === 'compass')!;
    const readrank = PRODUCT_REGISTRY.find((p) => p.key === 'readrank')!;
    expect(compass.resolve(sampleRecord)).toBeNull();
    expect(readrank.resolve(sampleRecord)).toBeNull();
    expect(compass.resolve(null)).toBeNull();
    expect(readrank.resolve(null)).toBeNull();
  });
});
