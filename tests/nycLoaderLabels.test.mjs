import { describe, it, expect } from 'vitest';
import {
  FUND_SCOPES, BASIS_VALUE, DERIVATION, FISCAL_YEAR_START_MONTH,
  sourceNameFor, sourcePrefixFor, scopeFlag,
} from '../scripts/loadNYCAcfrs.mjs';

describe('NYC loader provenance labels', () => {
  it('loads exactly the two scopes', () => {
    expect(FUND_SCOPES).toEqual(['general_fund', 'total_governmental']);
  });

  it('stamps the audited-actual axes the RPC keys on', () => {
    expect(BASIS_VALUE).toBe('actual');
    expect(DERIVATION).toBe('published');
  });

  it('declares a July fiscal year start, never the column default', () => {
    // NYC's fiscal year ends June 30. The fiscal_year_start_month column
    // default has lied on ~18,700 rows before.
    expect(FISCAL_YEAR_START_MONTH).toBe(7);
  });

  // Review Focus 4 -- the label must state the scope it actually read.
  it('names the General Fund scope honestly', () => {
    expect(sourceNameFor('revenue', 2024, 'general_fund'))
      .toBe('New York City ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)');
  });

  it('names the Total Governmental scope honestly', () => {
    expect(sourceNameFor('operating', 2015, 'total_governmental'))
      .toBe('New York City ACFR — Total Governmental Funds Expenditure by Function (FY2015 actual, GAAP basis)');
  });

  it('gives each scope a DISTINCT prefix, so the never-overwrite guard cannot confuse them', () => {
    expect(sourcePrefixFor('general_fund')).not.toBe(sourcePrefixFor('total_governmental'));
    expect(sourceNameFor('revenue', 2024, 'general_fund'))
      .toMatch(new RegExp(`^${sourcePrefixFor('general_fund')}`));
    expect(sourceNameFor('revenue', 2024, 'total_governmental'))
      .toMatch(new RegExp(`^${sourcePrefixFor('total_governmental')}`));
  });

  it('maps each scope to the extractor CLI flag', () => {
    expect(scopeFlag('general_fund')).toBe('general');
    expect(scopeFlag('total_governmental')).toBe('total');
  });

  it('refuses an unknown scope rather than mislabelling', () => {
    expect(() => sourceNameFor('revenue', 2024, 'all_funds')).toThrow(/unknown fund scope/i);
    expect(() => scopeFlag('all_funds')).toThrow(/unknown fund scope/i);
    expect(() => sourcePrefixFor('')).toThrow(/unknown fund scope/i);
  });
});
