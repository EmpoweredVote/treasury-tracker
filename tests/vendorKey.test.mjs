/**
 * vendorLinkKey — the rule that was recovered by measurement.
 *
 * ⚠⚠ These are not style preferences. Each case below is a REAL Frisco vendor
 * whose stored key would change if the rule drifted, and a changed key makes a
 * rebuild rewrite rows that were already right — which destroys the property
 * that a no-change rebuild is a no-op.
 */
import { describe, it, expect } from 'vitest';
import { vendorLinkKey } from '../scripts/lib/vendorKey.mjs';

describe('vendorLinkKey', () => {
  it('lowercases and joins words with dashes', () => {
    expect(vendorLinkKey('NORTH TEXAS MUNICIPAL WATER DISTRICT'))
      .toBe('north-texas-municipal-water-district');
  });

  it('collapses a run of punctuation and spaces into ONE dash', () => {
    // " - " is three characters and one separator.
    expect(vendorLinkKey('CITY OF FRISCO - BIWEEKLY PAYROLL'))
      .toBe('city-of-frisco-biweekly-payroll');
  });

  /**
   * ⚠⚠ KEEPS THE TRAILING DASH. Trimming it looks tidier and would re-key 50
   * vendors in FY2020 alone.
   */
  it('keeps a trailing dash left by terminal punctuation', () => {
    expect(vendorLinkKey('A&M MAINTENANCE SERVICES, INC.')).toBe('a-m-maintenance-services-inc-');
    expect(vendorLinkKey('PRIME CONTROLS L.P.')).toBe('prime-controls-l-p-');
  });

  /**
   * ⚠⚠ TRIMS THE NAME FIRST. The register pads names to a fixed width, so
   * without this every padded vendor gains a trailing dash that the stored
   * keys do not have.
   */
  it('trims surrounding whitespace BEFORE keying', () => {
    expect(vendorLinkKey('A TO T LAMPS INC    ')).toBe('a-to-t-lamps-inc');
    expect(vendorLinkKey(' CORD B SMITH')).toBe('cord-b-smith');
    expect(vendorLinkKey('AARDVARK            ')).toBe('aardvark');
  });

  it('distinguishes a padded name from one ending in punctuation', () => {
    // The whole point of the two rules above acting in that order.
    expect(vendorLinkKey('BELLE FIRMA INC     ')).toBe('belle-firma-inc');
    expect(vendorLinkKey('BROADCAST MUSIC INC.')).toBe('broadcast-music-inc-');
  });

  it('keeps digits', () => {
    expect(vendorLinkKey('PAYROLL TAXES 941')).toBe('payroll-taxes-941');
  });

  it('is null for an absent or blank name, never an empty key', () => {
    expect(vendorLinkKey(null)).toBeNull();
    expect(vendorLinkKey(undefined)).toBeNull();
    expect(vendorLinkKey('')).toBeNull();
    expect(vendorLinkKey('    ')).toBeNull();
  });

  it('is stable — keying a key again does not change it', () => {
    const k = vendorLinkKey('NORTH TEXAS MUNICIPAL WATER DISTRICT');
    expect(vendorLinkKey(k)).toBe(k);
  });
});
