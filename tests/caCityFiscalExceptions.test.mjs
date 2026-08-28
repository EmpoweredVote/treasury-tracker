import { describe, it, expect } from 'vitest';
import {
  CA_FISCAL_EXCEPTIONS, fiscalExceptionFor, monthForCity, monthForEntry,
} from '../scripts/lib/caCityFiscalExceptions.mjs';

describe('CA city fiscal exceptions registry', () => {
  it('holds the five evidenced October cities, each with an authority', () => {
    expect(CA_FISCAL_EXCEPTIONS.map((e) => e.name).sort()).toEqual([
      'El Segundo', 'Huntington Beach', 'Inglewood', 'Long Beach', 'South Lake Tahoe',
    ]);
    for (const e of CA_FISCAL_EXCEPTIONS) {
      expect(e.state).toBe('CA');
      // Every entry is October in at least one era — that is what makes it an
      // exception at all.
      const months = e.schedule ? e.schedule.map((s) => s.month) : [e.month];
      expect(months).toContain(10);
      // Each authority quotes its source verbatim and is matched
      // case-insensitively — do not normalise the quote. A September-30 period
      // end appears either in prose
      // ("FOR THE YEAR ENDED SEPTEMBER 30, 2021") or as the audited period
      // the city itself filed ("2019-10-01 -> 2020-09-30").
      expect(e.authority).toMatch(/september 30|09-30/i);
    }
  });

  // ⚠⚠ The previous pass scoped this audit to CHARTER cities on the theory that
  // only a charter city may set its own fiscal year. Two general-law cities in
  // this registry disprove it. If this test ever fails because someone pruned
  // them, the scoping error has been reintroduced.
  it('includes GENERAL-LAW cities, because the charter-city premise was false', () => {
    for (const name of ['South Lake Tahoe', 'El Segundo']) {
      const e = fiscalExceptionFor(name, 'CA');
      expect(e).not.toBeNull();
      expect(e.authority).toMatch(/GENERAL-LAW/);
    }
  });

  it('describes a city that CHANGED its fiscal year as a schedule, not one month', () => {
    for (const name of ['Huntington Beach', 'El Segundo']) {
      const e = fiscalExceptionFor(name, 'CA');
      expect(e.month).toBeUndefined();          // a single month would be a lie
      expect(e.schedule.length).toBeGreaterThan(1);
      // The last step must be open-ended, or a future year resolves to nothing.
      expect(e.schedule.at(-1).throughFiscalYear).toBeUndefined();
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

describe('cities that CHANGED their fiscal year', () => {
  // Huntington Beach: October through FY2018, July from FY2019. FY2018 is the
  // nine-month stub (Oct 1 2017 - Jun 30 2018) and still BEGINS in October.
  it('resolves Huntington Beach on each side of its 2017 change', () => {
    expect(monthForCity('Huntington Beach', 'CA', undefined, 2003)).toEqual({ month: 10 });
    expect(monthForCity('Huntington Beach', 'CA', undefined, 2017)).toEqual({ month: 10 });
    expect(monthForCity('Huntington Beach', 'CA', undefined, 2018)).toEqual({ month: 10 });
    expect(monthForCity('Huntington Beach', 'CA', undefined, 2019)).toEqual({ month: 7 });
    expect(monthForCity('Huntington Beach', 'CA', undefined, 2024)).toEqual({ month: 7 });
  });

  it('resolves El Segundo on each side of its 2020 change', () => {
    expect(monthForCity('El Segundo', 'CA', undefined, 2021)).toEqual({ month: 10 });
    expect(monthForCity('El Segundo', 'CA', undefined, 2022)).toEqual({ month: 7 });
  });

  // THE POINT OF THE SCHEDULE. Answering "7" for an unspecified year would
  // silently mislabel sixteen years of Huntington Beach history, and because the
  // column moves no dollar, every tie test would still pass at $0.
  it('REFUSES to answer for a changed city without a fiscal year', () => {
    const r = monthForCity('Huntington Beach', 'CA', undefined, undefined);
    expect(r.month).toBeUndefined();
    expect(r.error).toMatch(/CHANGED its fiscal year/);
    expect(r.error).toMatch(/through FY2018: month 10/);
  });

  it('refuses a flag that contradicts the evidence FOR THAT YEAR, both ways', () => {
    // 7 is right for FY2019 and wrong for FY2018 — the same flag, two answers.
    expect(monthForCity('Huntington Beach', 'CA', 7, 2019)).toEqual({ month: 7 });
    const r = monthForCity('Huntington Beach', 'CA', 7, 2018);
    expect(r.month).toBeUndefined();
    expect(r.error).toMatch(/month 10 in FY2018/);
    expect(r.error).toMatch(/NINE-MONTH/);
  });

  it('refuses an unparseable fiscal year rather than defaulting', () => {
    expect(monthForEntry(fiscalExceptionFor('El Segundo', 'CA'), 'not-a-year').error)
      .toMatch(/unparseable fiscal year/);
  });

  // A constant-month city must keep working without a year — Long Beach never
  // changed, and its callers should not have to know that.
  it('still answers a constant-month city with no fiscal year', () => {
    expect(monthForCity('Long Beach', 'CA', undefined)).toEqual({ month: 10 });
    expect(monthForCity('South Lake Tahoe', 'CA', undefined, 2009)).toEqual({ month: 10 });
  });
});
