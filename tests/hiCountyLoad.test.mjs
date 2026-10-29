import { describe, it, expect } from 'vitest';
import { runConfigFor } from '../scripts/processHiCounties.js';
import { HI_COUNTIES, documentUrlFor } from '../scripts/lib/hiCountySources.mjs';

describe('the Hawaii county load configs', () => {
  it('sets the June-30 calendar on all four', () => {
    for (const c of HI_COUNTIES) {
      expect(runConfigFor(c.key)).toMatchObject({
        fyEndMonthDay: '06-30', fiscalYearStartMonth: 7,
      });
    }
  });

  // ⚠⚠⚠ A `units` error scales every figure on the page together, so the tie
  // gate cannot see it — computed and printed are both multiplied. The
  // per-capita ceiling is the only guard that can, and Honolulu's statement is
  // printed IN THOUSANDS while the other three are whole dollars.
  it('leaves the shared per-capita ceiling in place', () => {
    for (const c of HI_COUNTIES) {
      expect(runConfigFor(c.key).perCapitaMax).toBeUndefined();
    }
  });

  // ⚠⚠ Honolulu is read by the COORDINATE extractor and the other three by the
  // `-table` one. The choice is per ENTITY, for a diagnosed reason recorded in
  // `scripts/extractHonoluluCoords.py` — never per year, which would be
  // curve-fitting.
  it('drives Honolulu from the coordinate reader and the rest from -table', () => {
    expect(runConfigFor('honolulu')).toMatchObject({
      extractScript: 'scripts/extractHonoluluCoords.py', extractArgs: [],
    });
    for (const k of ['hawaii', 'maui', 'kauai']) {
      expect(runConfigFor(k)).toMatchObject({
        extractScript: 'scripts/extractHiCounty.py', extractArgs: ['--entity', k],
      });
    }
  });

  it('points each county at its own gitignored PDF directory', () => {
    expect(runConfigFor('maui')).toMatchObject({
      pdfDir: 'docs/HiCounties/maui', datasetIdPrefix: 'maui-acfr-gf',
    });
  });

  // The citable permalink, never the presigned S3 object FAC redirects to.
  it('cites only app.fac.gov, never a presigned link', () => {
    for (const c of HI_COUNTIES) {
      const cfg = runConfigFor(c.key);
      expect(cfg.baseUrl).toMatch(/^https:\/\/app\.fac\.gov\//);
      expect(cfg.baseUrl).not.toMatch(/X-Amz-|amazonaws/i);
    }
  });

  // Hawaii County and Kaua'i have not filed FY2025, so their year lists must
  // stop at FY2024 rather than asking the loader for a file that cannot exist.
  it('asks only for the fiscal years the county actually filed', () => {
    expect(runConfigFor('hawaii').fys.at(-1)).toBe(2024);
    expect(runConfigFor('kauai').fys.at(-1)).toBe(2024);
    expect(runConfigFor('honolulu').fys.at(-1)).toBe(2025);
    expect(documentUrlFor('hawaii', 2025)).toBeNull();
  });

  // ⚠⚠ Honolulu is the ONLY one printing three tiers: `Current:` >
  // `Miscellaneous:` > {Retirement and health benefits, Other}. The RPC shape
  // holds two, and `toBudgetTree` REFUSES a third rather than dropping it
  // silently. Opting in keeps both spending lines and loses only the
  // `Miscellaneous` heading, which carries no figure of its own; the loader
  // then proves the projection arithmetically.
  //
  // Left unset everywhere else so a third level appearing by accident in
  // another county still fails loudly.
  it('flattens the third level for Honolulu only', () => {
    expect(runConfigFor('honolulu').flattenThirdLevel).toBe(true);
    for (const k of ['hawaii', 'maui', 'kauai']) {
      expect(runConfigFor(k).flattenThirdLevel).toBeFalsy();
    }
  });

  // ⚠⚠⚠ THE GAPS TABLE IS THE ENTIRE BASIS FOR 67 ROWS RATHER THAN 72, AND IT
  // WAS PINNED BY NOTHING. Every other assertion here calls `runConfigFor(key)`
  // with NO options, so `mode` is undefined, `GAPS.hawaii[undefined]` is
  // undefined, and `cfg.fys` comes back entirely UNFILTERED — the test above
  // asserting `fys.at(-1) === 2024` was checking a list no gap had touched.
  //
  // A typo (`revenues:` for `revenue:`, or a dropped year) would silently
  // re-admit Hawaii County FY2017 and FY2020, whose DIGITS are misread
  // (`4. 1] 7.] 53`). The only thing standing between that and publication is
  // a tie gate that already came within 331 dollars of passing on a $300M
  // statement.
  it('drops exactly the Hawaii County gap years, per mode', () => {
    expect(runConfigFor('hawaii', { mode: 'revenue' }).fys).toEqual([2016, 2021, 2022, 2024]);
    expect(runConfigFor('hawaii', { mode: 'operating' }).fys).toEqual([2016, 2019, 2021, 2022, 2024]);
  });

  // FY2019 is the asymmetric one: its revenue side prints `Other` as
  // `2,506 ,7 91` in three fragments, while the expenditure side of the SAME
  // page is clean and loads.
  it('keeps FY2019 operating while dropping FY2019 revenue', () => {
    expect(runConfigFor('hawaii', { mode: 'operating' }).fys).toContain(2019);
    expect(runConfigFor('hawaii', { mode: 'revenue' }).fys).not.toContain(2019);
  });

  it('leaves the other three counties ungapped', () => {
    for (const mode of ['revenue', 'operating']) {
      expect(runConfigFor('honolulu', { mode }).fys).toHaveLength(10);
      expect(runConfigFor('maui', { mode }).fys).toHaveLength(10);
      expect(runConfigFor('kauai', { mode }).fys).toHaveLength(9);
    }
  });

  // The row count the whole load is reconciled against.
  it('sums to the 67 rows the registry expects', () => {
    const total = HI_COUNTIES.reduce((n, c) => n
      + runConfigFor(c.key, { mode: 'revenue' }).fys.length
      + runConfigFor(c.key, { mode: 'operating' }).fys.length, 0);
    expect(total).toBe(67);
  });

  it('refuses a key that is not one of the four governments', () => {
    expect(() => runConfigFor('kalawao')).toThrow();
  });
});
