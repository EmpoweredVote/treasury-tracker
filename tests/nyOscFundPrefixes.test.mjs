import { describe, it, expect } from 'vitest';
import { NY_FUND_PREFIXES, GOVERNMENTAL_TYPES } from '../scripts/data/nyOscFundPrefixes.mjs';
import { fundPrefixOf, classifyPrefix } from '../scripts/lib/nyOsc.mjs';

describe('fundPrefixOf', () => {
  it('takes the leading letters of the account code', () => {
    expect(fundPrefixOf('A1001')).toBe('A');
    expect(fundPrefixOf('EW2140')).toBe('EW');
    expect(fundPrefixOf('H5031')).toBe('H');
    expect(fundPrefixOf('A99509')).toBe('A');
  });

  it('handles the N-suffixed budget codes', () => {
    expect(fundPrefixOf('A2801N')).toBe('A');
  });

  it('returns empty for a code with no leading letter', () => {
    expect(fundPrefixOf('1001')).toBe('');
    expect(fundPrefixOf('')).toBe('');
  });
});

describe('the registry', () => {
  it('classifies the General Fund as governmental', () => {
    expect(NY_FUND_PREFIXES.A.type).toBe('general');
    expect(GOVERNMENTAL_TYPES.has(NY_FUND_PREFIXES.A.type)).toBe(true);
  });

  it('excludes every enterprise fund', () => {
    for (const p of ['EA', 'EE', 'EF', 'EH', 'EI', 'EL', 'EM', 'EP', 'ER', 'ES', 'ET', 'EW']) {
      expect(NY_FUND_PREFIXES[p].type, p).toBe('enterprise');
      expect(GOVERNMENTAL_TYPES.has(NY_FUND_PREFIXES[p].type), p).toBe(false);
    }
  });

  it('excludes internal service and self-insurance', () => {
    expect(NY_FUND_PREFIXES.M.type).toBe('internal_service');
    // MS rows say `Net Position`, not fund balance -- proprietary.
    expect(NY_FUND_PREFIXES.MS.type).toBe('internal_service');
    expect(GOVERNMENTAL_TYPES.has('internal_service')).toBe(false);
  });

  it('excludes every fiduciary fund', () => {
    for (const p of ['TA', 'TC', 'TE', 'TN', 'TX']) {
      expect(NY_FUND_PREFIXES[p].type, p).toBe('fiduciary');
    }
    expect(GOVERNMENTAL_TYPES.has('fiduciary')).toBe(false);
  });

  it('marks K and W as schedules, not funds', () => {
    expect(NY_FUND_PREFIXES.K.type).toBe('schedule');
    expect(NY_FUND_PREFIXES.W.type).toBe('schedule');
    expect(GOVERNMENTAL_TYPES.has('schedule')).toBe(false);
  });

  it('carries an ARM citation on every entry', () => {
    for (const [p, e] of Object.entries(NY_FUND_PREFIXES)) {
      expect(e.citation, `${p} has no citation`).toBeTruthy();
      expect(e.citation.length, `${p} citation is a placeholder`).toBeGreaterThan(12);
    }
  });

  it('does NOT claim the town- and county-only prefixes', () => {
    // B, D/DA/DB/DM, CN and the S_ family never occur for a city. Accepting
    // them would mean the file changed and nobody noticed.
    for (const p of ['B', 'D', 'DA', 'DB', 'DM', 'CN', 'SD', 'SF', 'SL', 'SP']) {
      expect(NY_FUND_PREFIXES[p], `${p} should not be registered for cities`).toBeUndefined();
    }
  });
});

describe('classifyPrefix', () => {
  it('returns null for an unknown prefix rather than guessing', () => {
    // CS is real and unresolved. The honest answer is null, which drives the
    // city-year to `unknown` total_governmental -- NOT a silent short sum.
    expect(classifyPrefix('CS')).toBeNull();
    expect(classifyPrefix('ZZ')).toBeNull();
  });

  it('classifies a known prefix', () => {
    expect(classifyPrefix('A')).toEqual({ type: 'general', name: 'General Fund' });
  });
});
