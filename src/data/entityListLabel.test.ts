import { describe, it, expect } from 'vitest';
import { listLabel, TYPE_LABELS, MIXED_LABEL } from './entityListLabel';
import type { Municipality } from '../types/budget';

const of = (...types: Municipality['entity_type'][]) => types.map(t => ({ entity_type: t }));

describe('listLabel', () => {
  // A state that holds only cities keeps the precise, familiar heading.
  it('names a single type exactly', () => {
    expect(listLabel(of('city', 'city', 'city'))).toBe('Cities');
    expect(listLabel(of('township'))).toBe('Townships');
    expect(listLabel(of('village', 'village'))).toBe('Villages');
    expect(listLabel(of('town'))).toBe('Towns');
  });

  // ⚠⚠ THE DEFECT THIS EXISTS FOR. `CitiesInStatePanel` selects by EXCLUSION —
  // anything that is not a state, county, nonprofit or federal entity — while
  // its heading was the hardcoded string "Cities in {state}". Michigan now holds
  // 280 cities, 253 villages and 1,240 townships, so that heading asserted
  // something false about 1,774 entries and no test moved.
  it('refuses to call a mixed list Cities', () => {
    const michigan = of('city', 'village', 'township');
    expect(listLabel(michigan)).toBe(MIXED_LABEL);
    expect(listLabel(michigan)).not.toBe('Cities');
    expect(listLabel(of('city', 'township'))).toBe(MIXED_LABEL);
    expect(listLabel(of('city', 'village'))).toBe(MIXED_LABEL);
  });

  // ⚠ An unknown type must not reach a reader as its raw database value. That is
  // exactly how `village` surfaced in the entity switcher, whose map fell back
  // to `|| type` and printed the lowercase schema string.
  it('falls back to the mixed label, never to a raw schema value', () => {
    const exotic = [{ entity_type: 'conservation_district' as Municipality['entity_type'] }];
    expect(listLabel(exotic)).toBe(MIXED_LABEL);
    expect(listLabel(exotic)).not.toBe('conservation_district');
  });

  it('handles an empty list without inventing a name', () => {
    expect(listLabel([])).toBe(MIXED_LABEL);
  });

  // ⚠ Every sub-state type the panel can list must have a label, or a future
  // state page silently gets the generic heading when a precise one exists.
  it('labels every sub-state type the panel lists', () => {
    for (const t of ['city', 'town', 'township', 'village', 'municipality',
      'special_district', 'school_district', 'library', 'conservancy']) {
      expect(TYPE_LABELS[t], t).toBeTruthy();
    }
    // ⚠ These four are excluded by the panel and must NOT be labelled here;
    // a label would imply they belong in the list.
    for (const t of ['state', 'federal', 'county', 'nonprofit']) {
      expect(TYPE_LABELS[t], t).toBeUndefined();
    }
  });
});
