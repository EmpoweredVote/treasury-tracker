import { describe, it, expect } from 'vitest';
import { showsSourceChip, SOURCE_CHIP_ENTITY_TYPES } from './sourceChipTypes';

/**
 * ⚠ This set is the thing that failed AUSTIN-TRAVIS-01 UAT test 5. `city` was
 * missing from it for months, so NO city in the app showed provenance or its
 * as-of date — reported as "I don't see sept 30 anywhere on austin". The data was
 * correct the whole time; only the membership of this set was wrong, and nothing
 * guarded it. An enumerated test is the guard that was absent.
 */
describe('showsSourceChip', () => {
  it('shows the chip for every municipal entity type', () => {
    for (const t of ['city', 'municipality', 'town', 'township', 'county']) {
      expect(showsSourceChip(t)).toBe(true);
    }
  });

  // ⚠ The change of 2026-08-23. `state` was excluded with a documented reason —
  // "nobody has checked the quality of state data_source_info yet; it is a
  // candidate, not a decision" — which left New York's April fiscal year
  // invisible and AUSTIN-TRAVIS-01 UAT test 7 permanently unmeetable.
  //
  // The check was then done, on ten state nodes covering all four distinct fiscal
  // calendars in the table: NY 2024-03-31, TX 2024-08-31, AL and MI 09-30, and
  // CA/FL/OH/MN/WA/AZ at 06-30. 10 of 10 carry a displayName, a real source URL,
  // and an as-of date matching that state's own fiscal year end.
  it('shows the chip for a state node', () => {
    expect(showsSourceChip('state')).toBe(true);
  });

  it('does NOT show the chip for federal or nonprofit', () => {
    // Both render their own source treatments above the chip's position, so
    // including them would double up. This is a deliberate exclusion, not a gap.
    expect(showsSourceChip('federal')).toBe(false);
    expect(showsSourceChip('nonprofit')).toBe(false);
  });

  it('is safe on a missing or unknown entity type', () => {
    expect(showsSourceChip(null)).toBe(false);
    expect(showsSourceChip(undefined)).toBe(false);
    expect(showsSourceChip('')).toBe(false);
    expect(showsSourceChip('school_district')).toBe(false);
  });

  it('enumerates exactly the types that get a chip', () => {
    // Spelled out so ADDING or REMOVING a type has to be a deliberate edit to a
    // test, not a silent one-word change in a component.
    // ⚠⚠ `village` and `borough` added 2026-09-07: 253 MI villages and 949 PA
    // boroughs all carry data and all rendered NO chip, i.e. a figure with no
    // provenance. See the header in sourceChipTypes.ts.
    expect([...SOURCE_CHIP_ENTITY_TYPES].sort()).toEqual(
      ['borough', 'city', 'county', 'municipality', 'state', 'town', 'township', 'village'],
    );
  });

  it('gives a chip to every incorporated-place type TT actually stores', () => {
    // ⚠ The point of the fix: an entity type that holds budget rows must not be
    // able to render a figure with no source. These are the six sub-city classes
    // TT holds today (city, town, township, village, borough, municipality).
    for (const t of ['city', 'town', 'township', 'village', 'borough', 'municipality']) {
      expect(showsSourceChip(t), t).toBe(true);
    }
  });
});
