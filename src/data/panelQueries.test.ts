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
