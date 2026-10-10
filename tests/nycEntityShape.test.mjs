import { describe, it, expect } from 'vitest';
import { NYC_ENTITY } from '../scripts/seedNewYorkCity.mjs';

describe('NYC entity shape', () => {
  it('is named New York City, never bare New York', () => {
    // A bare "New York" collides with the state node in every name-keyed
    // lookup and in ?entity= alias resolution.
    expect(NYC_ENTITY.name).toBe('New York City');
    expect(NYC_ENTITY.name).not.toBe('New York');
  });

  it('is a city with no county parent, so it renders beside the state', () => {
    // NYC is LARGER than the five counties inside it. TT orders large to
    // small, so the city occupies the tier a county normally would.
    expect(NYC_ENTITY.entityType).toBe('city');
    expect(NYC_ENTITY.countyId).toBeNull();
  });

  it('carries the FIPS place geoid', () => {
    expect(NYC_ENTITY.state).toBe('NY');
    expect(NYC_ENTITY.geoid).toBe('3651000');
  });

  it('carries a population, since the per-capita units guard needs one', () => {
    // A wrong `units` ties at $0; per-capita plausibility is the only check
    // that can catch it, and it cannot run without this.
    expect(NYC_ENTITY.population).toBeGreaterThan(8_000_000);
    expect(NYC_ENTITY.population).toBeLessThan(9_000_000);
  });
});
