import { describe, it, expect } from 'vitest';
import {
  CA_FISCAL_EXCEPTIONS, fiscalExceptionFor, monthForCity,
} from '../scripts/lib/caCityFiscalExceptions.mjs';

describe('CA city fiscal exceptions registry', () => {
  it('holds the two checked October cities, both with an authority', () => {
    expect(CA_FISCAL_EXCEPTIONS.map((e) => e.name).sort()).toEqual(['Inglewood', 'Long Beach']);
    for (const e of CA_FISCAL_EXCEPTIONS) {
      expect(e.month).toBe(10);
      expect(e.state).toBe('CA');
      // Case-insensitive: each authority quotes its source document verbatim, and
      // Inglewood's ACFR cover page is set in caps ("FOR THE YEAR ENDED
      // SEPTEMBER 30, 2021"). The quote is the evidence — do not normalise it.
      expect(e.authority).toMatch(/september 30/i);
    }
  });

  // ⚠ Name alone would be reckless: Long Beach also exists in NY, WA and MS.
  it('requires BOTH name and state to match', () => {
    expect(fiscalExceptionFor('Long Beach', 'CA').month).toBe(10);
    expect(fiscalExceptionFor('Long Beach', 'NY')).toBeNull();
    expect(fiscalExceptionFor('Long Beach', 'WA')).toBeNull();
    expect(fiscalExceptionFor('Inglewood', 'CA').month).toBe(10);
  });

  it('returns null for an unchecked city — absence is not evidence of July', () => {
    expect(fiscalExceptionFor('Pasadena', 'CA')).toBeNull();
    expect(fiscalExceptionFor('Los Angeles', 'CA')).toBeNull();
  });
});

describe('monthForCity — what the loader should pass', () => {
  it('supplies the evidenced month for an exception when the operator passes nothing', () => {
    expect(monthForCity('Long Beach', 'CA', undefined)).toEqual({ month: 10 });
    expect(monthForCity('Inglewood', 'CA', null)).toEqual({ month: 10 });
  });

  it('passes the operator value straight through for an ordinary city', () => {
    expect(monthForCity('Pasadena', 'CA', 7)).toEqual({ month: 7 });
    // undefined means "let the RPC inherit per (municipality, data_source)".
    expect(monthForCity('Pasadena', 'CA', undefined)).toEqual({ month: undefined });
  });

  // THE POINT OF THE FILE. A CA county load with `--fiscal-year-start-month 7`
  // would otherwise silently flatten Long Beach and Inglewood back to July, and
  // no tie test would notice because the column moves no dollar.
  it('REFUSES a flag that contradicts evidence, naming the authority', () => {
    const r = monthForCity('Long Beach', 'CA', 7);
    expect(r.month).toBeUndefined();
    expect(r.error).toMatch(/contradicts evidence for Long Beach, CA/);
    expect(r.error).toMatch(/month 10/);
    expect(r.error).toMatch(/September 30, 2025/);
  });

  it('accepts a flag that AGREES with the evidence', () => {
    expect(monthForCity('Long Beach', 'CA', 10)).toEqual({ month: 10 });
    expect(monthForCity('Long Beach', 'CA', '10')).toEqual({ month: 10 });
  });

  it('does not refuse a same-named city in another state', () => {
    expect(monthForCity('Long Beach', 'NY', 1)).toEqual({ month: 1 });
  });
});
