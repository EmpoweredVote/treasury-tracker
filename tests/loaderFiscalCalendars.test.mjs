import { describe, it, expect } from 'vitest';
import {
  SOURCE_CALENDARS, UNWIRED, monthForSource,
  OHIO_SOURCE, ohioMonthFor, UTAH_SOURCE, utahMonthFor,
} from '../scripts/lib/loaderFiscalCalendars.mjs';

describe('loader fiscal calendars', () => {
  it('cites an authority for every wired source — no month without evidence', () => {
    const sources = Object.keys(SOURCE_CALENDARS);
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) {
      const e = SOURCE_CALENDARS[s];
      expect(e.authority, `${s} has no authority`).toBeTruthy();
      expect(e.authority.length).toBeGreaterThan(20);
      expect(e.month).toBeGreaterThanOrEqual(1);
      expect(e.month).toBeLessThanOrEqual(12);
    }
  });

  it('gives a reason for every unwired source', () => {
    for (const s of Object.keys(UNWIRED)) {
      expect(UNWIRED[s].length).toBeGreaterThan(40);
    }
  });

  it('puts publicpay on the calendar year and CA counties on July', () => {
    expect(monthForSource(
      'CA State Controller — Government Compensation in California (publicpay.ca.gov)')).toBe(1);
    expect(monthForSource(
      'Minnesota Office of the State Auditor City/County Finances Report')).toBe(1);
    expect(monthForSource('CA State Controller - County Expenditures')).toBe(7);
    expect(monthForSource('CA State Controller - County Revenues')).toBe(7);
  });

  // ⚠ A default here would recreate the exact defect this arc removed, so an
  // unknown source must THROW rather than resolve to anything.
  it('THROWS on an unknown source instead of defaulting', () => {
    expect(() => monthForSource('Some New Source')).toThrow(/no established fiscal calendar/i);
  });

  it('throws a source-specific reason for a deliberately unwired source', () => {
    expect(() => monthForSource('LA County Open Data - Employee Salaries'))
      .toThrow(/deliberately unwired/i);
  });

  // ⚠ Virginia is wired at 7, but NOT because "most localities are July–June".
  // § 15.2-2500's applicability clause does not reach a town under 3,500 that is
  // not its own school division, and we hold two towns below that line. Both were
  // checked individually: West Point via the school-division clause, Wise via its
  // own charter § 4.2. The authority string must keep both, so a later reader can
  // see the small towns were settled rather than rounded off.
  it('wires Virginia at 7 and cites BOTH authorities, not just the statute', () => {
    expect(monthForSource('Virginia APA Comparative Report')).toBe(7);
    const a = SOURCE_CALENDARS['Virginia APA Comparative Report'].authority;
    expect(a).toMatch(/15\.2-2500/);
    expect(a).toMatch(/3,500/);
    expect(a).toMatch(/school division/i);
    expect(a).toMatch(/Wise/);
    expect(a).toMatch(/charter/i);
  });

  it('never wires a source it also lists as unwired', () => {
    for (const s of Object.keys(UNWIRED)) {
      expect(SOURCE_CALENDARS[s]).toBeUndefined();
    }
  });
});

// The two sources a constant cannot express, because the jurisdiction itself
// carves an exception out of its own rule.
describe('per-entity calendars', () => {
  it('Ohio: calendar year, except Cincinnati', () => {
    expect(ohioMonthFor({ name: 'Columbus', state: 'OH' })).toBe(1);
    expect(ohioMonthFor({ name: 'Cleveland', state: 'OH' })).toBe(1);
    expect(ohioMonthFor({ name: 'Cincinnati', state: 'OH' })).toBe(7);
    // Keyed on state too — a same-named city elsewhere is not what § 9.34 names.
    expect(ohioMonthFor({ name: 'Cincinnati', state: 'IA' })).toBe(1);
    expect(OHIO_SOURCE).toMatch(/Ohio Auditor of State/);
  });

  it('Utah: counties calendar year, municipalities July', () => {
    expect(utahMonthFor({ entity_type: 'county' })).toBe(1);
    expect(utahMonthFor({ entity_type: 'city' })).toBe(7);
    expect(UTAH_SOURCE).toBe('Transparent Utah');
  });

  it('Utah THROWS on a type with no established calendar', () => {
    // The State Auditor says only that SOME special service districts use the
    // calendar year, which establishes nothing for any particular district.
    expect(() => utahMonthFor({ entity_type: 'district' })).toThrow(/no established Utah/i);
    expect(() => utahMonthFor({})).toThrow(/no established Utah/i);
  });
});
