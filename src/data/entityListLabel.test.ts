import { describe, it, expect } from 'vitest';
import { listLabel, shortNameInCounty, TYPE_LABELS, MIXED_LABEL } from './entityListLabel';
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

describe('shortNameInCounty', () => {
  // ⚠⚠ The stored name MUST keep its county — 117 Michigan township names are
  // shared by 302 townships, and the municipality key is (name, state,
  // entity_type). This trims only for DISPLAY, where the county is already
  // on screen: the county page's own list, and a breadcrumb whose immediate
  // parent is that county.
  it('drops the county the caller has already shown', () => {
    expect(shortNameInCounty('Hopkins Township, Allegan County', 'Allegan County'))
      .toBe('Hopkins Township');
    expect(shortNameInCounty('Shelby Charter Township, Macomb County', 'Macomb County'))
      .toBe('Shelby Charter Township');
  });

  // ⚠⚠ It matches the ONE county passed in. A general /, .* County$/ rule would
  // strip Iosco's Grant Township down to "Grant Township" on a page showing a
  // DIFFERENT county, and every one of the eleven would read identically.
  it('leaves a name alone when the county on screen is a different one', () => {
    expect(shortNameInCounty('Grant Township, Iosco County', 'Allegan County'))
      .toBe('Grant Township, Iosco County');
    for (const c of ['Iosco County', 'Clare County', 'Kent County']) {
      const kept = shortNameInCounty('Grant Township, Newaygo County', c);
      expect(kept).toBe('Grant Township, Newaygo County');
    }
  });

  // The eleven Grant Townships stay distinguishable wherever no county is shown.
  it('is a no-op without a county', () => {
    for (const c of [undefined, null, '']) {
      expect(shortNameInCounty('Grant Township, Iosco County', c)).toBe('Grant Township, Iosco County');
    }
  });

  // Cities and villages carry no county suffix at all.
  it('leaves an unsuffixed name untouched', () => {
    expect(shortNameInCounty('Detroit', 'Wayne County')).toBe('Detroit');
    expect(shortNameInCounty('Mackinaw City', 'Cheboygan County')).toBe('Mackinaw City');
  });

  // ⚠ Never return an empty label, however odd the input.
  it('never empties a label', () => {
    expect(shortNameInCounty(', Allegan County', 'Allegan County')).toBe(', Allegan County');
    expect(shortNameInCounty('Allegan County', 'Allegan County')).toBe('Allegan County');
  });

  // ⚠ A partial suffix match must not fire — the separator is part of the match.
  it('requires the comma-space separator', () => {
    expect(shortNameInCounty('Grand Traverse County', 'Traverse County')).toBe('Grand Traverse County');
  });
});
