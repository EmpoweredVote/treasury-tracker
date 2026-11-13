import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  maDlsAmountType, maDlsUrl, isMaDlsUrl, parseMaDlsUrl, maDlsCorpusUrl,
  readMaDlsRoster, readMaDlsRows, judgeMaDlsTie, maDlsTieIsClean,
  MA_DLS_HOST, MA_DLS_CHUNK,
} from '../scripts/lib/maDlsCitation.mjs';
import { MA_DLS_ROSTER } from '../scripts/data/maDlsRoster.mjs';
import { maKey } from '../scripts/lib/maNames.mjs';
import { gccCityExportUrl } from '../scripts/loadCASalaries.js';

/**
 * ⚠⚠⚠ 16,826 MASSACHUSETTS BUDGETS CITED NOTHING AT ALL.
 *
 * Three families — General Fund Expenditures, General Fund Revenues and
 * "DLS General Fund Revenue by Source" — covering all 351 municipalities,
 * FY2002-FY2025. Their `data_sources.base_url` was
 * `https://www.mass.gov/orgs/division-of-local-services`, a department's front
 * door, and no budget carried a `source_url` at all.
 *
 * ⭐ The publisher addresses a single municipality-year by GET, so this is a
 * PER-ROW citation and not a landing page: #381's rule is that a landing page
 * is not a weaker citation, it is a wrong one.
 *
 * ⛔⛔ AND IT CANNOT BE LIVENESS-CHECKED. Measured 2026-11-13 against the live
 * host: a real row, a municipality code that does not exist, a fiscal year
 * that does not exist, a nonsense code and A REPORT NAME THAT DOES NOT EXIST
 * all answer HTTP 200. So the family is verified by TIE instead — the same
 * trade the SCO per-entity family makes, for the same reason.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

describe('maDlsAmountType', () => {
  it('maps a dataset type onto the report\'s own toggle', () => {
    expect(maDlsAmountType('revenue')).toBe('Revenues');
    expect(maDlsAmountType('operating')).toBe('Expenditures');
  });

  it('⛔ refuses a dataset type the report has no column for', () => {
    // ⚠ NOT a default. `scoBranch` can default because both of its branches
    // exist for every entity; here a wrong guess would cite a municipality's
    // REVENUES as the source of its EXPENDITURES, at HTTP 200, and the tie
    // would be the only thing that noticed.
    expect(() => maDlsAmountType('salaries')).toThrow(/salaries/);
    expect(() => maDlsAmountType(undefined)).toThrow(/dataset type/);
  });
});

describe('maDlsUrl', () => {
  it('⭐ addresses ONE municipality-year — Boston FY2024 expenditures', () => {
    // Verified live 2026-11-13: this URL returns the single row
    // `035 Boston 2024 … 4,410,854,496`, which is what TT stores.
    expect(maDlsUrl({ dorCode: '035', fiscalYear: 2024, datasetType: 'operating' })).toBe(
      'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx'
      + '?rdReport=ScheduleA.GeneralFund&iclMuni=035&islYear=2024&islAmountType=Expenditures',
    );
  });

  it('⚠ keeps the DOR code zero-padded — the form\'s own values are 3 digits', () => {
    // `iclMuni=35` selects nothing and the page still answers 200.
    expect(maDlsUrl({ dorCode: '001', fiscalYear: 2002, datasetType: 'revenue' }))
      .toContain('iclMuni=001');
    expect(() => maDlsUrl({ dorCode: '35', fiscalYear: 2024, datasetType: 'operating' }))
      .toThrow(/three digits/);
    expect(() => maDlsUrl({ dorCode: 35, fiscalYear: 2024, datasetType: 'operating' }))
      .toThrow(/three digits/);
  });

  it('⛔ refuses a fiscal year that is not four digits', () => {
    expect(() => maDlsUrl({ dorCode: '035', fiscalYear: 24, datasetType: 'operating' }))
      .toThrow(/four digits/);
  });
});

describe('isMaDlsUrl / parseMaDlsUrl', () => {
  it('recognises the shape the migration writes, and reads it back', () => {
    const u = maDlsUrl({ dorCode: '348', fiscalYear: 2021, datasetType: 'revenue' });
    expect(isMaDlsUrl(u)).toBe(true);
    expect(parseMaDlsUrl(u)).toEqual({ dorCode: '348', fiscalYear: 2021, amountType: 'Revenues' });
  });

  it('⛔ a URL on the right host in the wrong shape is NOT one of ours', () => {
    // The gate skips this family's liveness probe. Anything that slips past
    // the shape check would be skipped AND unverifiable, so the shape check is
    // the only thing standing between a typo and no checking at all.
    for (const bad of [
      'https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=035&islYear=2024&islAmountType=Expenditures',
      'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=ScheduleA.GeneralFund&iclMuni=035&islYear=2024',
      'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx?rdReport=RevenueBySource.RBS.RevbySource2&iclMuni2=Boston&iclYear2=2024',
      'https://dls-gw.dor.state.ma.us/reports/rdPage.aspx',
      'https://www.mass.gov/orgs/division-of-local-services',
      null,
    ]) {
      expect(isMaDlsUrl(bad), String(bad)).toBe(false);
      expect(parseMaDlsUrl(bad), String(bad)).toBeNull();
    }
  });
});

describe('maDlsCorpusUrl', () => {
  it('asks for a whole chunk of municipalities in one request', () => {
    const u = maDlsCorpusUrl(2024, 'Expenditures', ['001', '035', '348']);
    expect(u).toBe('https://dls-gw.dor.state.ma.us/reports/rdPage.aspx'
      + '?rdReport=ScheduleA.GeneralFund&islYear=2024&islAmountType=Expenditures'
      + '&iclMuni=001&iclMuni=035&iclMuni=348');
  });

  it('⚠⚠ refuses a chunk larger than the report\'s own page', () => {
    // Measured: the table renders 40 rows per page and server-side paging
    // needs an rdDataCache token a plain GET has no way to hold. Asking for 50
    // municipalities returns 40 and SILENTLY DROPS TEN — which, in a tie
    // census, reads as "the publisher does not list them".
    expect(MA_DLS_CHUNK).toBe(40);
    expect(() => maDlsCorpusUrl(2024, 'Revenues', Array(41).fill('001')))
      .toThrow(/40/);
    expect(() => maDlsCorpusUrl(2024, 'Revenues', [])).toThrow(/no municipalities/);
  });
});

describe('reading the publisher\'s own HTML', () => {
  const roster = readFileSync(`${ROOT}tests/fixtures/maDlsRoster.html`, 'utf8');
  const rows = readFileSync(`${ROOT}tests/fixtures/maDlsRows.html`, 'utf8');

  it('reads the (DOR code, spelling) roster out of the report\'s form', () => {
    const r = readMaDlsRoster(roster);
    expect(r).toHaveLength(351);
    expect(r[0]).toEqual({ dorCode: '001', name: 'Abington' });
    expect(r.at(-1)).toEqual({ dorCode: '351', name: 'Yarmouth' });
    // ⚠ The publisher prints `Manchester By The Sea`; the census writes
    // `Manchester-by-the-Sea` and TT stores `Amherst Town` for `Amherst`.
    expect(r.find((x) => x.dorCode === '166').name).toBe('Manchester By The Sea');
  });

  it('⭐ takes the LAST money cell of a row — the printed total', () => {
    const r = readMaDlsRows(rows);
    expect(r).toHaveLength(4);
    expect(r.find((x) => x.dorCode === '035')).toEqual({
      dorCode: '035', name: 'Boston', fiscalYear: 2024, total: 4410854496,
    });
    // Abington's first column is 2,719,438 and its total is 65,233,098 — a
    // "first number on the row" rule would publish the wrong one at 200.
    expect(r.find((x) => x.dorCode === '001').total).toBe(65233098);
  });
});

describe('judgeMaDlsTie', () => {
  const published = new Map([
    ['035|2024|Expenditures', 4410854496],
    ['348|2021|Revenues', 714578061],
    ['001|2024|Expenditures', 65233098],
  ]);

  it('✅ a stored figure equal to the publisher\'s is a tie', () => {
    const t = judgeMaDlsTie([
      { id: 'a', dorCode: '035', fiscalYear: 2024, amountType: 'Expenditures', total: 4410854496 },
      { id: 'b', dorCode: '348', fiscalYear: 2021, amountType: 'Revenues', total: 714578061 },
    ], published);
    expect(t).toMatchObject({ checked: 2, tie: 2 });
    expect(t.mismatch).toEqual([]);
    expect(maDlsTieIsClean(t)).toBe(true);
  });

  it('⛔ a figure the publisher contradicts is a MISMATCH, and it is not clean', () => {
    const t = judgeMaDlsTie([
      { id: 'a', dorCode: '001', fiscalYear: 2024, amountType: 'Expenditures', total: 65233099 },
    ], published);
    expect(t.tie).toBe(0);
    expect(t.mismatch).toHaveLength(1);
    expect(t.mismatch[0]).toMatchObject({ id: 'a', publisher: 65233098, diff: -1 });
    expect(maDlsTieIsClean(t)).toBe(false);
  });

  it('⚠ a municipality-year the publisher does not list is ABSENT, never a mismatch', () => {
    // DLS prints a row of zeroes for a municipality that has not filed yet and
    // no row at all for some older years. Calling either a disagreement would
    // invent a failure — #373's distinction, one level down.
    const t = judgeMaDlsTie([
      { id: 'z', dorCode: '002', fiscalYear: 1999, amountType: 'Revenues', total: 5 },
    ], published);
    expect(t.mismatch).toEqual([]);
    expect(t.absent).toHaveLength(1);
    expect(maDlsTieIsClean(t)).toBe(true);
  });
});

describe('MA_DLS_ROSTER', () => {
  it('carries all 351 municipalities, each code and each stored name once', () => {
    expect(MA_DLS_ROSTER).toHaveLength(351);
    expect(new Set(MA_DLS_ROSTER.map((r) => r.dorCode)).size).toBe(351);
    // ⚠ The migration joins budgets to the roster ON THE STORED NAME. Two rows
    // sharing one would multiply that join and let Postgres pick a DOR code
    // arbitrarily — a wrong citation, at HTTP 200.
    expect(new Set(MA_DLS_ROSTER.map((r) => r.tt)).size).toBe(351);
  });

  it('⚠ keeps BOTH spellings, and they differ on thirteen rows', () => {
    const renamed = MA_DLS_ROSTER.filter((r) => r.publisher !== r.tt);
    expect(renamed).toHaveLength(13);
    expect(renamed.every((r) => r.tt === `${r.publisher} Town`)).toBe(true);
    // Both resolve to one key, which is the only reason those thirteen
    // governments are findable from either side.
    for (const r of MA_DLS_ROSTER) expect(maKey(r.publisher)).toBe(maKey(r.tt));
  });

  it('⛔ is NOT alphabetical, so a DOR code may never be derived from the order', () => {
    // Aquinnah sits at 104 because it kept Gay Head's code when it was renamed.
    expect(MA_DLS_ROSTER.find((r) => r.dorCode === '104').publisher).toBe('Aquinnah');
    const alphabetical = [...MA_DLS_ROSTER].sort((a, b) => a.publisher.localeCompare(b.publisher));
    expect(alphabetical.map((r) => r.dorCode)).not.toEqual(MA_DLS_ROSTER.map((r) => r.dorCode));
  });

  it('⚠⚠ agrees with the migration, row for row — SQL and JS are one rule', () => {
    // 20261113140000 embeds the roster as a VALUES list because the DOR code
    // lives nowhere in the database. If the two ever disagree, the citations
    // in production stop matching the ones this module would build.
    const sql = readFileSync(
      `${ROOT}supabase/migrations/20261113140000_ma_and_ca_citations.sql`, 'utf8',
    );
    const inSql = [...sql.matchAll(/^ {4}\('(\d{3})', '((?:[^']|'')+)'\)[,;]$/gm)]
      .map((m) => ({ dorCode: m[1], tt: m[2].replace(/''/g, "'") }));
    expect(inSql).toHaveLength(351);
    expect(inSql).toEqual(MA_DLS_ROSTER.map((r) => ({ dorCode: r.dorCode, tt: r.tt })));
  });
});

describe('the California half — gccCityExportUrl', () => {
  it('⭐ is the file the loader reads, and the citation the migration wrote', () => {
    expect(gccCityExportUrl(2024)).toBe('https://gcc.sco.ca.gov/RawExport/2024_City.zip');
    // The SQL half: 20261113140000 builds the same string and then refuses to
    // finish unless every publicpay row matches this shape.
    const sql = readFileSync(
      `${ROOT}supabase/migrations/20261113140000_ma_and_ca_citations.sql`, 'utf8',
    );
    expect(sql).toContain("'https://gcc.sco.ca.gov/RawExport/' || b.fiscal_year::text || '_City.zip'");
    for (const year of [2009, 2024]) {
      expect(gccCityExportUrl(year)).toMatch(/^https:\/\/gcc\.sco\.ca\.gov\/RawExport\/\d{4}_City\.zip$/);
    }
  });

  it('⚠ is passed by every writer of the family, or the debt comes straight back', () => {
    // Three scripts write `salaries` rows for this data_source. A loader that
    // forgets `p_source_url` re-creates exactly what the migration just paid
    // off — the ratchet would catch it as a family that GREW, but only after
    // the rows had shipped.
    for (const script of [
      'scripts/loadCASalaries.js',
      'scripts/sweepCASalaries.js',
      'scripts/sweepOCSalaries.js',
    ]) {
      const src = readFileSync(`${ROOT}${script}`, 'utf8');
      expect(src, script).toContain('p_source_url:       gccCityExportUrl(year)');
    }
  });
});

describe('the host', () => {
  it('is named once, and the URL builder uses it', () => {
    expect(MA_DLS_HOST).toBe('dls-gw.dor.state.ma.us');
    expect(maDlsUrl({ dorCode: '001', fiscalYear: 2010, datasetType: 'revenue' }))
      .toContain(`https://${MA_DLS_HOST}/`);
  });
});
