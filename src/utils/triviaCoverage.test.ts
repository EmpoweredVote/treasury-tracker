/**
 * Tests for triviaCoverage.ts — the CTC coverage matcher + slug builder,
 * mirroring the reciprocal Essentials suite (trivia.test.js): tier alignment,
 * state-suffixed city slugs, prefix stripping, state-name (localeName) match,
 * the singular federal collection, and clean null for unsupported tiers.
 */

import { describe, it, expect } from 'vitest';
import { matchEntityToTrivia, toCollectionSlug } from './triviaCoverage';
import type { TriviaCollection } from './triviaCoverage';

const collections: TriviaCollection[] = [
  { slug: 'los-angeles-ca', tier: 'city' },
  { slug: 'phoenix-az', tier: 'city' },
  { slug: 'california-state', tier: 'state', localeName: 'California' },
  { slug: 'federal', tier: 'federal', localeName: 'United States' },
];

describe('toCollectionSlug', () => {
  it('builds <kebab-name>-<state> and lowercases', () => {
    expect(toCollectionSlug('Los Angeles', 'CA')).toBe('los-angeles-ca');
  });
  it('omits the state suffix when no state is given', () => {
    expect(toCollectionSlug('Los Angeles')).toBe('los-angeles');
  });
});

describe('matchEntityToTrivia — tier alignment', () => {
  it('resolves a city to its state-suffixed collection slug', () => {
    expect(matchEntityToTrivia({ name: 'Los Angeles', state: 'CA', entity_type: 'city' }, collections))
      .toEqual({ tier: 'city', slug: 'los-angeles-ca' });
  });

  it('strips a "City of " prefix before slugifying', () => {
    expect(matchEntityToTrivia({ name: 'City of Los Angeles', state: 'CA', entity_type: 'city' }, collections))
      .toEqual({ tier: 'city', slug: 'los-angeles-ca' });
  });

  it('returns null for a same-name city in the wrong state (no cross-state link)', () => {
    expect(matchEntityToTrivia({ name: 'Los Angeles', state: 'TX', entity_type: 'city' }, collections))
      .toBeNull();
  });

  it('returns null for a city with no matching collection', () => {
    expect(matchEntityToTrivia({ name: 'Marana', state: 'AZ', entity_type: 'city' }, collections))
      .toBeNull();
  });

  it('returns null for a city missing a 2-letter state (ambiguous slug)', () => {
    expect(matchEntityToTrivia({ name: 'Los Angeles', state: '', entity_type: 'city' }, collections))
      .toBeNull();
  });

  it('resolves a state by its full name (localeName)', () => {
    expect(matchEntityToTrivia({ name: 'California', state: 'CA', entity_type: 'state' }, collections))
      .toEqual({ tier: 'state', slug: 'california-state' });
  });

  it('returns null for a state with no matching collection', () => {
    expect(matchEntityToTrivia({ name: 'Nevada', state: 'NV', entity_type: 'state' }, collections))
      .toBeNull();
  });

  it('resolves the federal entity to the federal collection', () => {
    expect(matchEntityToTrivia({ name: 'United States', state: 'US', entity_type: 'federal' }, collections))
      .toEqual({ tier: 'federal', slug: 'federal' });
  });

  it('returns null for unsupported tiers (county, nonprofit)', () => {
    expect(matchEntityToTrivia({ name: 'Pima County', state: 'AZ', entity_type: 'county' }, collections)).toBeNull();
    expect(matchEntityToTrivia({ name: 'Empowered Vote', state: 'AZ', entity_type: 'nonprofit' }, collections)).toBeNull();
  });

  it('returns null for an empty or null collections list', () => {
    expect(matchEntityToTrivia({ name: 'Los Angeles', state: 'CA', entity_type: 'city' }, [])).toBeNull();
    expect(matchEntityToTrivia({ name: 'Los Angeles', state: 'CA', entity_type: 'city' }, null)).toBeNull();
  });
});
