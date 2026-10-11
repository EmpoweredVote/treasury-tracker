import { describe, it, expect } from 'vitest';
import { aggregateCityYear, classifyPrefix } from '../scripts/lib/nyOsc.mjs';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from '../scripts/data/nyOscSchoolFundPrefixes.mjs';

const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };
const R = (fundPrefix, amt) => ({
  fundPrefix, section: 'EXPENDITURE',
  LEVEL_1_CATEGORY: 'Education', LEVEL_2_CATEGORY: 'Sub',
  OBJECT_OF_EXPENDITURE: `o${fundPrefix}`, AMOUNT: amt,
});

describe('classifyPrefix with an injected registry', () => {
  it('defaults to the CITY registry when none is given', () => {
    expect(classifyPrefix('EW')).toEqual({ type: 'enterprise', name: 'Water' });
    expect(classifyPrefix('F')).toBeNull();           // cities have no bare F
  });

  it('uses the district registry when given one', () => {
    expect(classifyPrefix('F', NY_SCHOOL_FUND_PREFIXES))
      .toEqual({ type: 'special_revenue', name: 'Special Aid' });
    expect(classifyPrefix('EW', NY_SCHOOL_FUND_PREFIXES)).toBeNull();
  });
});

describe('aggregateCityYear for school districts', () => {
  it('⚠ INCLUDES the C food-service fund in total_governmental', () => {
    const out = aggregateCityYear(
      [R('A', '100'), R('C', '40'), R('F', '25'), R('TC', '7'), R('TE', '3')],
      { section: 'EXPENDITURE', scope: 'total_governmental', ...SCHOOL });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(165);   // A + C + F; TC and TE are fiduciary
  });

  it('general_fund is the A fund alone', () => {
    const out = aggregateCityYear([R('A', '100'), R('F', '900')],
      { section: 'EXPENDITURE', scope: 'general_fund', ...SCHOOL });
    expect(out.total).toBe(100);
  });

  it('a retired prefix makes the scope unknown, not a short sum', () => {
    const out = aggregateCityYear([R('A', '100'), R('CS', '40')],
      { section: 'EXPENDITURE', scope: 'total_governmental', ...SCHOOL });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['CS']);
  });

  it('a retired prefix does NOT disturb general_fund', () => {
    const out = aggregateCityYear([R('A', '100'), R('TN', '40')],
      { section: 'EXPENDITURE', scope: 'general_fund', ...SCHOOL });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('⚠ the city path is unchanged — a district fund is unknown to it', () => {
    // Review Focus #5: the new parameter must not leak either direction.
    const out = aggregateCityYear([R('A', '100'), R('F', '40')],
      { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['F']);
  });

  it('⚠ and a CITY enterprise fund is excluded, not refused, for a city', () => {
    const out = aggregateCityYear([R('A', '100'), R('EW', '900')],
      { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(100);
  });
});
