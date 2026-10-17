import { describe, it, expect } from 'vitest';

import {
  parseGovOptions, parseFileList, hiddenField, CICOID_KINDS,
  OLE2_MAGIC, DCA_ERROR_PAGE_MAGIC, GA_LOAD_WINDOW,
} from '../scripts/fetchGeorgiaRLGF.mjs';
import {
  resolveMonth, joinCensusName, parseWorkbookName, entityKey, readCountyPopulations,
  ALREADY_LOADED, GA_FIRST_YEAR, GA_LAST_YEAR,
} from '../scripts/buildGaStatewideEntities.mjs';
import { buildCensus } from '../scripts/lib/facFiscalYearCensus.mjs';

const OPTIONS = `<select name="ctl00$bodyContent$ddlGovs" id="ctl00_bodyContent_ddlGovs">
  <option selected="selected" value="">-- Select a Local Government --</option>
  <option value="1005005">Baldwin County</option>
  <option value="2068002">Baldwin City</option>
  <option value="3011011">Macon-Bibb County</option>
</select>`;

describe('the DCA dropdown is the only safe selector', () => {
  it('drops the prompt option, so 721 options are 720 governments', () => {
    const got = parseGovOptions(OPTIONS);
    expect(got).toHaveLength(3);
    expect(got.every((g) => g.cicoid)).toBe(true);
  });

  it('reads the government type out of the CICOID, not the name', () => {
    const by = Object.fromEntries(parseGovOptions(OPTIONS).map((g) => [g.cicoid, g.kind]));
    expect(by['1005005']).toBe('county');
    expect(by['2068002']).toBe('municipality');
    expect(by['3011011']).toBe('consolidated');
    expect(CICOID_KINDS['1']).toBe('county');
  });

  it('⚠⚠ keeps the name-collision pairs DISTINCT — Baldwin City is not Baldwin County', () => {
    const got = parseGovOptions(OPTIONS);
    const city = got.find((g) => g.name === 'Baldwin City');
    const county = got.find((g) => g.name === 'Baldwin County');
    expect(city.cicoid).toBe('2068002');
    expect(county.cicoid).toBe('1005005');
    // The middle three digits are DCA's county number, and they DISAGREE: the
    // city is not in the county that shares its name.
    expect(city.cicoid.slice(1, 4)).not.toBe(county.cicoid.slice(1, 4));
  });

  it('refuses a CICOID that is not seven digits rather than guessing its type', () => {
    expect(() => parseGovOptions('<select id="ddlGovs"><option value="99">X</option></select>'))
      .toThrow(/unexpected CICOID/);
  });

  it('throws when the dropdown is gone, instead of reporting zero governments', () => {
    expect(() => parseGovOptions('<html>DCA redesigned the page</html>')).toThrow(/dropdown not found/);
  });
});

describe('the file list — a status code is not evidence a filing exists', () => {
  const list = (inner) => `<span id="ctl00_bodyContent_lblFileList">${inner}</span>`;

  it('parses a government\'s true file list into years', () => {
    const { filings } = parseFileList(list(
      '<a href="/development/Research/programs/documents/RLGF/1005005_2016_RLGF_Baldwin.xls">2016</a>'
      + '<a href="/development/Research/programs/documents/RLGF/1005005_2017_RLGF_Baldwin.xls">2017</a>',
    ));
    expect(filings.map((f) => f.fiscalYear)).toEqual([2016, 2017]);
    expect(filings[0].cicoid).toBe('1005005');
  });

  it('⚠ REFUSES the literal YEAR placeholder rather than coercing it to NaN', () => {
    const { filings, refused } = parseFileList(list(
      '<a href="/x/1007007_YEAR_RLGF_Barrow.xls">?</a>'
      + '<a href="/x/1007007_2016_RLGF_Barrow.xls">2016</a>',
    ));
    expect(filings).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0].why).toMatch(/non-numeric/);
  });

  it('reports a MISSING span distinctly from an empty one', () => {
    expect(parseFileList('<html/>').spanFound).toBe(false);
    expect(parseFileList(list('')).spanFound).toBe(true);
  });

  it('⚠⚠ probes BYTES, because DCA\'s 404 page is served as 206 on a ranged GET', () => {
    expect(OLE2_MAGIC).toBe('d0cf11e0');
    expect(DCA_ERROR_PAGE_MAGIC).toBe('3c21444f');
    expect(Buffer.from('<!DOCTYPE html>').subarray(0, 4).toString('hex')).toBe(DCA_ERROR_PAGE_MAGIC);
  });

  it('pulls ASP.NET hidden fields and unescapes them', () => {
    expect(hiddenField('<input id="__VIEWSTATE" value="a&amp;b" />', '__VIEWSTATE')).toBe('a&b');
    expect(hiddenField('<html/>', '__VIEWSTATE')).toBe('');
  });
});

describe('resolveMonth — the filing is the source, the census is the guard', () => {
  const ENTITY = { name: 'Appling County', entityType: 'county', censusName: 'Appling County', censusKind: 'county' };
  const filings = (...ms) => ms.map(([fiscalYear, month]) => ({ fiscalYear, month, text: month ? 'June 30' : 'MONTH' }));
  const says = (month) => () => ({ month, auditYears: [2016] });
  const silent = () => ({ unknown: 'no row' });

  it('CONFIRMS when the form and the census agree', () => {
    const r = resolveMonth(ENTITY, filings([2016, 7], [2017, 7]), says(7));
    expect(r.status).toBe('confirmed');
    expect(r.month).toBe(7);
    expect(r.confirmedYears).toBe(2);
  });

  it('⚠⚠ reports UNVERIFIED — never confirmed — when the census is silent', () => {
    const r = resolveMonth(ENTITY, filings([2016, 1], [2017, 1]), silent);
    expect(r.status).toBe('unverified');
    expect(r.month).toBe(1);
    // The whole point: silence must not read as corroboration.
    expect(r.status).not.toBe('confirmed');
  });

  it('CONFLICTS when the census contradicts the form, and declares no month as correct', () => {
    const r = resolveMonth(ENTITY, filings([2016, 7]), says(1));
    expect(r.status).toBe('conflict');
    expect(r.why).toMatch(/reports month 1/);
  });

  it('⚠ CONFLICTS when the entity\'s OWN filings disagree, before the census is consulted', () => {
    let consulted = 0;
    const r = resolveMonth(ENTITY, filings([2016, 7], [2017, 1]), () => { consulted++; return says(7)(); });
    expect(r.status).toBe('conflict');
    expect(r.why).toMatch(/its own filings disagree/);
    expect(consulted).toBe(0);
  });

  it('falls to the census when EVERY form is a blank placeholder — the Baldwin FY2020 shape', () => {
    const r = resolveMonth(ENTITY, filings([2020, null]), says(1));
    expect(r.status).toBe('census-only');
    expect(r.month).toBe(1);
  });

  it('⚠⚠ REFUSES rather than defaulting when neither source speaks', () => {
    const r = resolveMonth(
      { ...ENTITY, censusName: null, censusKind: null }, filings([2020, null]), silent,
    );
    expect(r.status).toBe('refused');
    expect(r.month).toBeNull();
  });

  it('tolerates a blank year alongside stated ones without losing the month', () => {
    const r = resolveMonth(ENTITY, filings([2016, 7], [2020, null], [2021, 7]), says(7));
    expect(r.status).toBe('confirmed');
    expect(r.month).toBe(7);
    expect(r.blankYears).toBe(1);
    expect(r.statedYears).toBe(2);
  });

  it('is UNVERIFIED when the census has a row but covers no loaded year', () => {
    const r = resolveMonth(ENTITY, filings([2016, 7]), () => ({ unknown: 'outside the audited years' }));
    expect(r.status).toBe('unverified');
    expect(r.month).toBe(7);
  });
});

describe('the FAC name join — a silent miss is indistinguishable from a pass', () => {
  const census = buildCensus('GA');

  it('⚠⚠ returns FAC\'s OWN spelling, because censusMonthFor does an exact Map.get', () => {
    // The Census Bureau writes "DeKalb County"; FAC writes "Dekalb County".
    const r = joinCensusName('DeKalb County', 'county', census);
    expect(r.censusName).toBe('Dekalb County');
    expect(r.why).toBeUndefined();
  });

  it('says WHY it found nothing rather than returning a name that will not resolve', () => {
    const r = joinCensusName('Muscogee County', 'county', census);
    expect(r.censusName).toBeUndefined();
    expect(r.why).toMatch(/no row/);
  });

  it('refuses a match of the wrong kind', () => {
    const r = joinCensusName('Atlanta', 'county', census);
    expect(r.why).toMatch(/municipality, not a county/);
  });

  it('⚠ no GA census name carries two kinds, so the name-keyed map cannot merge two governments', () => {
    const seen = new Map();
    for (const [name, entry] of census) {
      const k = name.trim().toLowerCase();
      expect(seen.has(k), `case collision on ${name}`).toBe(false);
      seen.set(k, entry.kind);
    }
  });
});

describe('registry mechanics', () => {
  it('refuses a non-numeric year in a workbook name', () => {
    expect(parseWorkbookName('1005005_2016_RLGF_Baldwin.xlsx').fiscalYear).toBe(2016);
    expect(parseWorkbookName('2005001_YEAR_RLGF_Milledgeville.xlsx')).toBeNull();
  });

  it('builds a stable key', () => {
    expect(entityKey('Ben Hill County')).toBe('ben-hill-county');
    expect(entityKey('DeKalb County')).toBe('dekalb-county');
  });

  it('⚠ excludes the 7 hand-written entities so two registries cannot claim one CICOID', () => {
    expect(ALREADY_LOADED).toContain('1005005'); // Baldwin County
    expect(ALREADY_LOADED).toContain('1044044'); // DeKalb County
    expect(ALREADY_LOADED).toContain('1060060'); // Fulton County
    expect(new Set(ALREADY_LOADED).size).toBe(ALREADY_LOADED.length);
  });

  it('reads exactly 159 Georgia counties out of Census Vintage 2024', () => {
    const pops = readCountyPopulations();
    expect(pops.size).toBe(159);
    expect(pops.get('baldwin county').fips).toBe('13009');
    expect(pops.get('dekalb county').population).toBeGreaterThan(700_000);
  });

  it('pins the load window to the LOAD1 form generation', () => {
    expect(GA_FIRST_YEAR).toBe(2016);
    expect(GA_LAST_YEAR).toBe(2025);
    expect(GA_LOAD_WINDOW).toEqual({ first: 2016, last: 2025 });
  });
});
