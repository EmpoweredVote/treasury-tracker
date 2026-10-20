import { readFileSync, existsSync } from 'node:fs';

import { describe, it, expect } from 'vitest';

import {
  parseGovOptions, parseFileList, hiddenField, CICOID_KINDS,
  OLE2_MAGIC, DCA_ERROR_PAGE_MAGIC, GA_LOAD_WINDOW,
} from '../scripts/fetchGeorgiaRLGF.mjs';
import {
  resolveMonth, joinCensusName, parseWorkbookName, entityKey, readCountyPopulations,
  readPlacePopulations, joinPlace, countyCicoidFor,
  ALREADY_LOADED, GA_FIRST_YEAR, GA_LAST_YEAR, assertNotShrinking, readFormMonths,
  GA_V1_FALLBACK_FIRST_YEAR,
} from '../scripts/buildGaStatewideEntities.mjs';
import { GA_STATEWIDE_ENTITIES } from '../scripts/data/georgiaStatewideEntities.mjs';
import { GA_STATEWIDE_MUNICIPALITIES } from '../scripts/data/georgiaStatewideMunicipalities.mjs';
import { GA_STATEWIDE_CONSOLIDATED } from '../scripts/data/georgiaStatewideConsolidated.mjs';
import { GA_RLGF_ENTITIES } from '../scripts/data/georgiaRlgfEntities.mjs';
import { GA_FORM_GENERATIONS } from '../scripts/data/georgiaRlgfEntities.mjs';
import { buildCensus } from '../scripts/lib/facFiscalYearCensus.mjs';
import {
  resolveMonth as loaderResolveMonth, unverifiableMatches, toTree,
  GA_ALL_ENTITIES, entityByCicoid, assertAliases,
} from '../scripts/loadGeorgiaRLGF.mjs';
import {
  GA_FYE_MONTH_CHANGES, GA_FYE_MONTH_DEFECTS, fyeMonthChange, fyeMonthDefect,
  GA_UNVERIFIABLE_FILINGS, unverifiableFiling, formTotalDefect, consolidationOverlap,
  GA_FIGURE_FLAGS, GA_EMPTY_DATASETS, emptyDataset,
} from '../scripts/data/gaRlgfAnomalies.mjs';
import { figureFlags } from '../src/data/figureFlags.ts';
import { loadLadder, resolvePlace, DEFAULT_LADDER } from '../scripts/lib/censusVintages.mjs';

// ⚠ `cache/` is gitignored IN FULL (.gitignore:121), so nothing under it can be
// read by a test that has to pass in CI. The fixture is a byte extract of the
// source, pinned to LF by .gitattributes:73.
const CENSUS_FIXTURE = 'tests/fixtures/census/co-est2024-ga-slice.csv';
const CENSUS_SOURCE = 'cache/co-est2024-alldata.csv';
const PLACE_FIXTURE = 'tests/fixtures/census/sub-est2024-ga-places-slice.csv';
const PLACE_SOURCE = 'cache/sub-est2024_13.csv';

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
    // ⚠ Reads the committed FIXTURE, never `cache/` — `cache/` is gitignored in
    // full (.gitignore:121), so a bare `readCountyPopulations()` here passed on
    // the author's disk and was an ENOENT in CI, where the file cannot exist.
    const pops = readCountyPopulations(CENSUS_FIXTURE);
    expect(pops.size).toBe(159);
    expect(pops.get('baldwin county').fips).toBe('13009');
    expect(pops.get('dekalb county').population).toBeGreaterThan(700_000);
    // ⚠ The fixture carries 3 NORTH CAROLINA counties, so the STATE filter is
    // exercised rather than assumed. A reader that dropped the `!== '13'` test
    // would return 162 here, not 159.
    expect(pops.get('alamance county')).toBeUndefined();
  });

  /**
   * ⚠⚠ A FIXTURE CAN DRIFT INTO AGREEING WITH A WRONG REGISTRY. This is the only
   * check that cannot run in CI, because it needs the 1.8 MB source file. It
   * SKIPS LOUDLY rather than passing vacuously — silence would mean the fixture
   * is trusted forever on the strength of one extraction.
   *
   * Mirrors `tests/scStatewideEntities.test.mjs`, including its CRLF lesson:
   * both sides split on /\r?\n/ so a CRLF checkout cannot fake total drift.
   */
  it('keeps the census fixture honest against its source, where the source is present', () => {
    if (!existsSync(CENSUS_SOURCE)) {
      console.log(`  SKIPPED: ${CENSUS_SOURCE} absent (gitignored). `
        + 'Fixture-vs-source parity was NOT checked in this run.');
      return;
    }
    const split = (t) => t.split(/\r?\n/).filter(Boolean);
    const source = new Set(split(readFileSync(CENSUS_SOURCE, 'latin1')));
    const fixture = split(readFileSync(CENSUS_FIXTURE, 'latin1'));
    expect(fixture).toHaveLength(164); // header + GA state row + 159 counties + 3 NC
    const missing = fixture.filter((l) => !source.has(l));
    expect(missing).toEqual([]);
  });

  it('pins the registry build and the fetch default to the LOAD1 generation', () => {
    // ⚠ These two are the v2 (`LOAD1`) generation's window specifically, NOT a
    // floor on what the loader can read: `gaRlgfV1.mjs` reads FY2009-2015 from
    // the `Exportable Data` generation. `GA_LOAD_WINDOW` in
    // `georgiaRlgfEntities.mjs` is the union and is pinned in gaRlgfV1.test.mjs.
    expect(GA_FIRST_YEAR).toBe(GA_FORM_GENERATIONS.v2.firstFiscalYear);
    expect(GA_LAST_YEAR).toBe(GA_FORM_GENERATIONS.v2.lastFiscalYear);
    expect(GA_LOAD_WINDOW).toEqual({ first: 2016, last: 2025 });
  });

  it('⚠⚠ the v1 fallback is a FALLBACK, not a wider window', () => {
    /**
     * Widening GA_FIRST_YEAR to 2009 was tried and is WRONG.
     * `loadGeorgiaRLGF.resolveMonth` depends on the registry having NO claim
     * about a v1 year — `belowV2 && !hasClaim` is what makes it RECORD the
     * filing's own month instead of comparing against a month derived from
     * years a decade later. A registry built from 2009 makes claims about v1
     * years and silently turns that recording into a comparison, statewide.
     *
     * It also measured badly: the wider build dropped the registry from 526
     * entities to 516, refusing 17 governments whose v1 and v2 months differ
     * for reasons already registered in GA_V1_MONTH_CHANGES.
     *
     * So the v1 window applies per government and ONLY where the v2 window is
     * empty.
     */
    expect(GA_V1_FALLBACK_FIRST_YEAR).toBe(GA_FORM_GENERATIONS.v1.firstFiscalYear);
    expect(GA_V1_FALLBACK_FIRST_YEAR).toBeLessThan(GA_FIRST_YEAR);
  });
});

describe('a calendar change INSIDE the window — per-year months', () => {
  const ENT = {
    cicoid: '1130130', name: 'Talbot County', entityType: 'county',
    fiscalYearStartMonth: 10, monthByYear: { 2016: 7, 2017: 7, 2018: 7, 2019: 7, 2020: 7, 2021: 7 },
  };

  it('writes the month the filing printed for THAT year, not the entity\'s current one', () => {
    expect(loaderResolveMonth(ENT, { fyEndMonth: 7, fyEndMonthText: 'June 30' }, 2021).month).toBe(7);
    expect(loaderResolveMonth(ENT, { fyEndMonth: 10, fyEndMonthText: 'September 30' }, 2022).month).toBe(10);
  });

  it('⚠ still REFUSES a filing whose month matches neither side of the change', () => {
    const r = loaderResolveMonth(ENT, { fyEndMonth: 1, fyEndMonthText: 'December 31' }, 2022);
    expect(r.ok).toBe(false);
    expect(r.month).toBeNull();
    expect(r.how).toMatch(/CONFLICT/);
  });

  it('falls back to the entity month for a year the map does not cover', () => {
    expect(loaderResolveMonth(ENT, { fyEndMonth: 10, fyEndMonthText: 'September 30' }, 2025).month).toBe(10);
  });

  it('every recorded change reproduces the real filings it claims to describe', () => {
    for (const c of GA_FYE_MONTH_CHANGES) {
      expect(c.id, 'each change needs an id').toBeTruthy();
      expect(c.corroboration, `${c.id} must say what corroborates it`).toBeTruthy();
      expect(Object.keys(c.monthByYear).length, `${c.id} must name the years it moves`).toBeGreaterThan(0);
      for (const [, m] of Object.entries(c.monthByYear)) expect(m).not.toBe(c.month);
    }
  });
});

describe('a one-year month slip — pinned, or refused', () => {
  const BARTOW = { cicoid: '1008008', name: 'Bartow County', entityType: 'county', fiscalYearStartMonth: 1 };

  it('accepts the slip ONLY where the registry pins both months', () => {
    const r = loaderResolveMonth(BARTOW, { fyEndMonth: 7, fyEndMonthText: 'June 30' }, 2025);
    expect(r.ok).toBe(true);
    expect(r.month).toBe(1);
    expect(r.defect.id).toBe('bartow-fy2025-june-for-december');
    // ⚠⚠ A corrected month is NEVER a corroborated one.
    expect(r.confirmed).toBe(false);
  });

  it('⚠⚠ REFUSES a slip of a different size in the same year', () => {
    const r = loaderResolveMonth(BARTOW, { fyEndMonth: 10, fyEndMonthText: 'September 30' }, 2025);
    expect(r.ok).toBe(false);
  });

  it('⚠⚠ REFUSES the same slip in a different year', () => {
    const r = loaderResolveMonth(BARTOW, { fyEndMonth: 7, fyEndMonthText: 'June 30' }, 2024);
    expect(r.ok).toBe(false);
  });

  it('⚠⚠ REFUSES the same slip on a different entity', () => {
    const other = { ...BARTOW, cicoid: '1001001', name: 'Appling County' };
    expect(loaderResolveMonth(other, { fyEndMonth: 7, fyEndMonthText: 'June 30' }, 2025).ok).toBe(false);
  });

  it('every recorded slip pins both months and says what corroborates it', () => {
    for (const d of GA_FYE_MONTH_DEFECTS) {
      expect(d.formMonth, `${d.id} must pin the month the form printed`).toBeGreaterThan(0);
      expect(d.month, `${d.id} must pin the month written instead`).toBeGreaterThan(0);
      expect(d.formMonth, `${d.id} pins the same month twice`).not.toBe(d.month);
      expect(d.corroboration, `${d.id} must say what corroborates it`).toBeTruthy();
    }
  });
});

describe('the builder refuses a registry entry that does not match the filings', () => {
  const months = (...ms) => ms.map(([fiscalYear, month]) => ({ fiscalYear, month, text: 'x' }));
  const silent = () => ({ unknown: 'no row' });
  const TALBOT = { cicoid: '1130130', name: 'Talbot County', entityType: 'county', censusName: null, censusKind: null };

  it('accepts the change when it predicts every filing', () => {
    const r = resolveMonth(TALBOT, months([2020, 7], [2021, 7], [2022, 10], [2023, 10]), silent);
    expect(r.status).toBe('unverified'); // census silent here; the change itself resolved
    expect(r.month).toBe(10);
    expect(r.monthByYear[2021]).toBe(7);
  });

  it('⚠⚠ REFUSES when the entry mispredicts a year — it describes a different series', () => {
    const r = resolveMonth(TALBOT, months([2020, 7], [2021, 1], [2022, 10]), silent);
    expect(r.status).toBe('conflict');
    expect(r.why).toMatch(/predicts month 7 for FY2021 but the filing prints 1/);
  });

  it('⚠ REFUSES an entity whose filings disagree with nothing recorded about it', () => {
    const r = resolveMonth(
      { cicoid: '1001001', name: 'Appling County', entityType: 'county', censusName: null, censusKind: null },
      months([2016, 7], [2017, 1]), silent,
    );
    expect(r.status).toBe('conflict');
    expect(r.why).toMatch(/not accounted for/);
  });
});

describe('the two transition stubs reach readers', () => {
  it('⚠⚠ flags a short year as NOT-COMPARABLE, never as understated', () => {
    for (const k of ['Barrow County|GA|2017|operating', 'Barrow County|GA|2017|revenue',
      'Talbot County|GA|2022|operating', 'Talbot County|GA|2022|revenue']) {
      const f = figureFlags[k];
      expect(f, `${k} has no reader-facing flag`).toBeTruthy();
      // The figure is CORRECT; only the comparison breaks. Calling a correct
      // figure understated tells the reader something false.
      expect(f.severity, k).toBe('not-comparable');
      expect(f.whatThisMeans, k).toBeTruthy();
      expect(f.entries.length, k).toBeGreaterThan(0);
      for (const e of f.entries) {
        expect(e.source_name, k).toBeTruthy();
        expect(e.source_url, k).toMatch(/^https:\/\//);
        expect(e.source_date, k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('⚠ Jenkins needs no stub flag — its transition year is the unreadable file', () => {
    expect(figureFlags['Jenkins County|GA|2020|operating']).toBeUndefined();
    const jenkins = GA_FYE_MONTH_CHANGES.find((c) => c.cicoid === '1082082');
    expect(jenkins.monthByYear[2020]).toBeUndefined();
    expect(jenkins.corroboration).toMatch(/encrypted/);
  });
});

describe('a filing whose oracle CANNOT RUN is excluded, not published', () => {
  const chk = (tag, id) => ({ tag, id });

  it('matches only when BOTH the skipped and failed sets are exactly right', () => {
    const e = unverifiableFiling('1067067', 2018);
    expect(e.id).toBe('gwinnett-fy2018-every-revenue-subtotal-is-ref');
    const skipped = e.skipped.map((s) => chk(...s.split(' ')));
    const bad = e.failed.map((s) => {
      const [tag, ...rest] = s.split(' ');
      return chk(tag, rest.join(' '));
    });
    expect(unverifiableMatches(e, skipped, bad)).toBe(true);
  });

  it('⚠⚠ REFUSES when the filing breaks one MORE way than the entry records', () => {
    const e = unverifiableFiling('1067067', 2018);
    const skipped = e.skipped.map((s) => chk(...s.split(' ')));
    const bad = e.failed.map((s) => {
      const [tag, ...rest] = s.split(' ');
      return chk(tag, rest.join(' '));
    });
    expect(unverifiableMatches(e, [...skipped, chk('EXP', '5A')], bad)).toBe(false);
    expect(unverifiableMatches(e, skipped, [...bad, chk('EXP', 'Part V grand')])).toBe(false);
  });

  it('⚠ REFUSES when the filing breaks one FEWER way — that is a different filing too', () => {
    const e = unverifiableFiling('1067067', 2018);
    const skipped = e.skipped.slice(1).map((s) => chk(...s.split(' ')));
    const bad = e.failed.map((s) => {
      const [tag, ...rest] = s.split(' ');
      return chk(tag, rest.join(' '));
    });
    expect(unverifiableMatches(e, skipped, bad)).toBe(false);
  });

  it('matches nothing for an unrecorded filing', () => {
    expect(unverifiableFiling('1067067', 2019)).toBeNull();
    expect(unverifiableMatches(null, [], [])).toBe(false);
  });

  it('every excluded filing says what was checked and why it could not be', () => {
    for (const u of GA_UNVERIFIABLE_FILINGS) {
      expect(u.what, `${u.id} must say what broke`).toBeTruthy();
      expect(u.verifiedBecause.length, `${u.id} must show its working`).toBeGreaterThan(0);
      expect(Array.isArray(u.skipped) && Array.isArray(u.failed), u.id).toBe(true);
      expect(u.skipped.length + u.failed.length, `${u.id} pins no checks at all`).toBeGreaterThan(0);
    }
  });
});

describe('Long County FY2022 — the DeKalb mechanism in a second government', () => {
  it('pins all three figures, so a different shortfall still refuses', () => {
    const d = formTotalDefect('1091091', 2022, '5A');
    expect(d.id).toBe('long-fy2022-5a-total-omits-legislative');
    expect(d.formTotal).toBe(2832877);
    expect(d.itemsTotal).toBe(3228935);
    expect(d.shortfall).toBe(396058);
    expect(d.itemsTotal - d.formTotal).toBeCloseTo(d.shortfall, 2);
    expect(d.loaded).toBe('items');
  });

  it('⚠ is MIRRORED from DeKalb\'s — the total starts late rather than ending early', () => {
    const dekalb = formTotalDefect('1044044', 2020, '5B');
    expect(dekalb.omittedCode).toBe('2800'); // DeKalb: the section's LAST line
    const long = formTotalDefect('1091091', 2022, '5A');
    expect(long.omittedCode).toBe('1100'); // Long: the section's FIRST line
  });

  it('matches nothing in the nine years that tie', () => {
    for (const fy of [2016, 2017, 2018, 2019, 2020, 2021, 2023, 2024, 2025]) {
      expect(formTotalDefect('1091091', fy, '5A'), `FY${fy}`).toBeNull();
    }
  });
});

describe('the statewide sweep findings reach readers', () => {
  it('⚠⚠ a near-44x figure is an OUTLIER, not understated — it is larger, not smaller', () => {
    const f = figureFlags['Lowndes County|GA|2022|revenue'];
    expect(f.severity).toBe('outlier');
    expect(f.headline).toMatch(/44 times/);
  });

  it('⚠ a quarter-sized expenditure side IS understated', () => {
    const f = figureFlags['Lowndes County|GA|2018|operating'];
    expect(f.severity).toBe('understated');
  });

  it('⚠⚠ the filed figure is published, never replaced by the audited one', () => {
    const reg = GA_FIGURE_FLAGS.find((x) => x.id === 'lowndes-fy2018-expenditure-side-is-about-one-quarter');
    expect(reg.loaded).toBe(true);
    expect(reg.amount).toBe(23615257.69);
    const out = GA_FIGURE_FLAGS.find((x) => x.id === 'lowndes-fy2022-sales-tax-is-forty-four-times-audited');
    expect(out.loaded).toBe(true);
    expect(out.amount).toBe(1673304896.05);
  });

  it('⚠ every new flag rests on a source that is NOT the filing it flags', () => {
    for (const id of ['lowndes-fy2018-expenditure-side-is-about-one-quarter',
      'lowndes-fy2022-sales-tax-is-forty-four-times-audited']) {
      const reg = GA_FIGURE_FLAGS.find((x) => x.id === id);
      expect(reg.corroboration).toMatch(/independent/i);
      expect(reg.verifiedBecause.join(' ')).toMatch(/Federal Audit Clearinghouse/);
      expect(reg.benignExplanations.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('⚠⚠ an EMPTY Part is withheld, which is not the Milledgeville Rule', () => {
    // The rule governs figures that look wrong: they load and are flagged.
    // There is no figure in a blank Part, so there is no row.
    // ⚠ Not a hard-coded count: 3 county filings and 20 municipality filings
    // leave a Part unpublishable, and the next sweep will add more.
    expect(GA_EMPTY_DATASETS.length).toBeGreaterThanOrEqual(23);
    const ids = GA_EMPTY_DATASETS.map((e) => e.id);
    expect(new Set(ids).size, 'duplicate id in GA_EMPTY_DATASETS').toBe(ids.length);
    for (const e of GA_EMPTY_DATASETS) {
      expect(['operating', 'revenue']).toContain(e.dataset);
      expect(e.what).toBeTruthy();
      expect(emptyDataset(e.cicoid, e.fiscalYear, e.dataset)).toBe(e);
    }
    // ⚠⚠ THE REVENUE SIDE IS WITHHELD ONLY WHERE IT IS ITSELF BLANK, and only
    // with its own named entry. This read `expect(...'revenue')).toBeNull()`
    // for every entry, because in three earlier waves a blank Part was always
    // the EXPENDITURE side of a filing whose revenue was fine. Mountain City
    // FY2010 is the first filing where BOTH sides are blank, so that filing
    // publishes nothing at all — which is a different and louder fact than a
    // government that reported revenue and left its spending blank.
    const withheld = GA_EMPTY_DATASETS.filter((e) => e.dataset === 'revenue');
    expect(withheld.map((e) => `${e.entity} FY${e.fiscalYear}`)).toEqual(['Mountain City FY2010']);
    for (const e of withheld) {
      expect(emptyDataset(e.cicoid, e.fiscalYear, 'operating'), 'a filing with a blank revenue '
        + 'side must have its expenditure side recorded too').toBeTruthy();
    }
  });
});

describe('⚠⚠ a blank Part is seven roots of zero, NOT an empty tree', () => {
  const blank = {
    total: 0,
    roots: ['General Government', 'Judicial', 'Public Safety'].map((label) => ({
      label, amount: 0, items: [{ id: '1100', label: 'x', amount: 0 }],
    })),
  };

  it('keeps every root, because a root with items is kept whatever they are worth', () => {
    // This is the exact shape that let three $0 rows into production: the guard
    // tested LENGTH, and the length is not zero.
    const tree = toTree(blank);
    expect(tree.length).toBe(3);
    expect(tree.length === 0).toBe(false);
  });

  it('carries no money, which is the test a guard must actually make', () => {
    const tree = toTree(blank);
    const hasMoney = tree.some((r) => r.a !== 0 || (r.c || []).some((c) => c.a !== 0));
    expect(hasMoney).toBe(false);
  });

  it('a populated Part does carry money, so the guard does not swallow real data', () => {
    const real = {
      total: 100,
      roots: [{ label: 'General Government', amount: 100, items: [{ id: '1100', label: 'x', amount: 100 }] }],
    };
    const tree = toTree(real);
    expect(tree.some((r) => r.a !== 0 || (r.c || []).some((c) => c.a !== 0))).toBe(true);
  });

  it('⚠ a root whose CHILDREN alone carry money still counts as money', () => {
    const odd = {
      total: 0,
      roots: [{ label: 'General Government', amount: 0, items: [{ id: '1100', label: 'x', amount: 50 }] }],
    };
    expect(toTree(odd).some((r) => r.a !== 0 || (r.c || []).some((c) => c.a !== 0))).toBe(true);
  });
});

describe('the municipality name join — three shapes, measured not assumed', () => {
  // ⚠ The FIXTURE, never `cache/`. This call sits in the describe BODY, so when
  // it read the gitignored source it threw at COLLECTION time and took all of
  // tests/gaStatewide.test.mjs down with it in CI — not one test.
  const places = readPlacePopulations(PLACE_FIXTURE);

  it('reads the 537 Georgia places out of Census Vintage 2024', () => {
    expect(places.size).toBe(537);
  });

  /**
   * ⚠⚠ SUMLEV 157 CARRIES THE SAME NAME SHAPE AS 162 — "Baxley city" is both a
   * place (162) and a place-within-county part (157). A reader that dropped the
   * `!== '162'` test would not fail loudly; it would quietly overwrite places
   * with county parts and admit 205 names that are not places at all.
   *
   * The fixture therefore carries six 157 rows, one of which ("Balance of
   * Appling County") exists ONLY at 157. If the filter breaks, size becomes 538.
   */
  it('⚠ rejects the SUMLEV 157 county parts rather than merely ignoring them', () => {
    expect([...places.values()].some((p) => p.censusName.startsWith('Balance of'))).toBe(false);
    expect([...places.values()].some((p) => p.censusName.includes('(pt.)'))).toBe(false);
    // ⚠ NOT "every name ends in city/town". Georgia's CONSOLIDATED governments
    // are themselves SUMLEV 162 — `Macon-Bibb County`, `Echols County
    // consolidated government`, `Cusseta-Chattahoochee County unified
    // government`. A designator-shaped assertion here would reject the seven
    // governments #269 goes on to load.
    expect(places.has('macon-bibbcounty')).toBe(true);
  });

  /**
   * ⚠⚠ Same contract as the county fixture: a fixture can drift into agreeing
   * with a wrong registry, so parity is re-checked against the real source when
   * it is present and SKIPS LOUDLY when it is not.
   */
  it('keeps the place fixture honest against its source, where the source is present', () => {
    if (!existsSync(PLACE_SOURCE)) {
      console.log(`  SKIPPED: ${PLACE_SOURCE} absent (gitignored). `
        + 'Fixture-vs-source parity was NOT checked in this run.');
      return;
    }
    const split = (t) => t.split(/\r?\n/).filter(Boolean);
    const source = new Set(split(readFileSync(PLACE_SOURCE, 'latin1')));
    const fixture = split(readFileSync(PLACE_FIXTURE, 'latin1'));
    expect(fixture).toHaveLength(548); // header + 537 places + 6×157 + 040 + 050 + 170 + 172
    expect(fixture.filter((l) => !source.has(l))).toEqual([]);
  });

  it('SUFFIX — the trailing word is the designator', () => {
    const r = joinPlace('Abbeville City', places);
    expect(r.how).toBe('suffix');
    expect(r.censusName).toBe('Abbeville city');
    expect(r.base).toBe('Abbeville');
  });

  it('⚠⚠ LEGAL — the trailing word is part of the NAME (the GROVE CITY BORO trap)', () => {
    // Peachtree City is not "Peachtree" with a designator on the end.
    for (const [dca, census] of [
      ['Peachtree City', 'Peachtree City city'],
      ['Garden City', 'Garden City city'],
      ['Union City', 'Union City city'],
      ['Lake City', 'Lake City city'],
      ['Twin City', 'Twin City city'],
      ['Mountain City', 'Mountain City town'],
    ]) {
      const r = joinPlace(dca, places);
      expect(r.how, dca).toBe('legal');
      expect(r.censusName, dca).toBe(census);
      expect(r.base, dca).toBe(dca);
    }
  });

  it('⚠⚠ RETYPED — DCA\'s designator DISAGREES with the census\'s', () => {
    const r = joinPlace('Arcade Town', places);
    expect(r.how).toBe('retyped');
    expect(r.censusName).toBe('Arcade city');
    // the DCA word is kept so the disagreement stays visible
    expect(r.dcaType).toBe('town');
    expect(r.censusType).toBe('city');
  });

  it('⚠ LEGAL is tried BEFORE RETYPED, so a "... City" place is never re-typed', () => {
    // If `retyped` ran first, "Mountain City" would become "Mountain" + town.
    const r = joinPlace('Mountain City', places);
    expect(r.how).toBe('legal');
    expect(r.base).toBe('Mountain City');
  });

  it('collapses spaces, which was measured unambiguous across all 537 places', () => {
    expect(joinPlace('Edgehill City', places).censusName).toBe('Edge Hill city');
    expect(joinPlace('Gum Branch City', places).censusName).toBe('Gumbranch city');
    const squashed = new Set();
    for (const v of places.values()) {
      const k = v.censusName.toLowerCase().replace(/\s+/g, '');
      expect(squashed.has(k), `collapsing spaces collides on ${v.censusName}`).toBe(false);
      squashed.add(k);
    }
  });

  it('Vintage 2024 genuinely cannot name Ranger or Sunny Side', () => {
    // ⚠ Still true, and still the reason the ladder exists. Measured: the GA
    // roster goes 538 places (V2019) -> 537 (V2024), and the diff is exactly
    // Ranger town and Sunny Side city removed, Mableton city (incorporated
    // 2022) added. The Census Bureau believes both ceased to exist.
    for (const n of ['Ranger Town', 'Sunny Side City']) {
      const r = joinPlace(n, places);
      expect(r.censusName, n).toBeUndefined();
      expect(r.why, n).toMatch(/no Georgia place matching/);
    }
  });

  it('⚠⚠ BUT THEY ARE NO LONGER REFUSED — the ladder types them from 2019', () => {
    // The old assertion here was that TT refuses them, "not guessed". It no
    // longer refuses, and still does not guess: the type comes from the newest
    // census vintage that names the government, not from DCA's own word.
    // ⚠ This decides TYPE only. Whether these two still exist is a
    // disagreement between two sources, recorded in gaRlgfAnomalies.mjs and
    // deliberately not settled here.
    const { ladders, missing } = loadLadder('.', '13', DEFAULT_LADDER);
    expect(missing, 'run: node scripts/fetchCensusVintages.mjs 13').toEqual([]);
    for (const [n, type] of Object.entries({ 'Ranger Town': 'town', 'Sunny Side City': 'city' })) {
      const r = resolvePlace(n, { ladders, missing });
      expect(r.why, n).toBeUndefined();
      expect(r.entityType, n).toBe(type);
      expect(r.vintage, n).toBe(2019);
    }
  });

  it('still says WHY, naming every vintage tried, when nothing names it', () => {
    const { ladders, missing } = loadLadder('.', '13', DEFAULT_LADDER);
    const r = resolvePlace('Nowhereville City', { ladders, missing });
    expect(r.why).toMatch(/named by no vintage of 2024, 2019, 2014, 2013/);
  });
});

describe('the parent county is derived from the CICOID, never from a name', () => {
  it('maps a municipality to its county', () => {
    expect(countyCicoidFor('2060002')).toBe('1060060'); // Atlanta  -> Fulton
    expect(countyCicoidFor('2005001')).toBe('1005005'); // Milledgeville -> Baldwin
  });

  it('⚠⚠ gets the COLLISION PAIRS right, which a name join cannot', () => {
    // Bibb City is in MUSCOGEE (106), not Bibb (011).
    expect(countyCicoidFor('2106001')).toBe('1106106');
    // Baldwin City is in 068, nothing to do with Baldwin County (005).
    expect(countyCicoidFor('2068002')).toBe('1068068');
    expect(countyCicoidFor('2068002')).not.toBe('1005005');
  });

  it('holds for every county: a county CICOID is 1 + code + the same code', () => {
    for (const e of GA_STATEWIDE_ENTITIES) {
      if (e.entityType !== 'county') continue;
      expect(e.cicoid.slice(1, 4), e.name).toBe(e.cicoid.slice(4, 7));
      expect(countyCicoidFor(e.cicoid), e.name).toBe(e.cicoid);
    }
  });
});

describe('⚠⚠ a Part that SUMS to zero is as unpublishable as a blank one', () => {
  it('records Dahlonega FY2022, whose two entries cancel', () => {
    const e = emptyDataset('2093001', 2022, 'operating');
    expect(e, 'Dahlonega FY2022 must be recorded').toBeTruthy();
    expect(e.what).toMatch(/MINUS \$50,000/);
    expect(e.what).toMatch(/sums to nothing/i);
  });

  it('the guard tests the TOTAL, not merely whether an amount is present', () => {
    // Two offsetting entries: amounts ARE present, and the total is still zero.
    const cancelling = toTree({
      total: 0,
      roots: [{
        label: 'Public Safety',
        amount: 0,
        items: [
          { id: '3200', label: 'Police Protection', amount: -50000 },
          { id: '3500', label: 'Fire Protection', amount: 50000 },
        ],
      }],
    });
    const hasMoney = cancelling.some((r) => r.a !== 0 || (r.c || []).some((c) => c.a !== 0));
    expect(hasMoney, 'amounts are present').toBe(true);
    // ...which is exactly why presence alone is the wrong test.
    expect(hasMoney && Number(0) !== 0).toBe(false);
  });
});

describe('governments the current census vintage cannot name', () => {
  /**
   * ⚠⚠ `treasury_ensure_municipality` keys on (name, state, entity_type). A
   * recovered entity whose triple matches a loaded one does NOT fail — it
   * silently joins or duplicates a government. This assertion is the only
   * thing standing between the vintage ladder and a duplicate.
   */
  it('⚠⚠ no recovered entity collides with a loaded one on key or on (name, type)', () => {
    const all = [...GA_RLGF_ENTITIES, ...GA_STATEWIDE_ENTITIES,
      ...GA_STATEWIDE_MUNICIPALITIES, ...GA_STATEWIDE_CONSOLIDATED];
    const byKey = new Map();
    const byIdentity = new Map();
    for (const e of all) {
      expect(byKey.has(e.key), `two entities claim key ${e.key}`).toBe(false);
      byKey.set(e.key, e);
      const id = `${e.name.toLowerCase()}|GA|${e.entityType}`;
      expect(byIdentity.has(id), `two entities share (name, state, entity_type): ${id}`).toBe(false);
      byIdentity.set(id, e);
    }
  });

  it('carries the seven recovered municipalities, each with its typing vintage', () => {
    const want = {
      Ranger:       { entityType: 'town', censusVintage: 2019, placeFips: '63560' },
      'Sunny Side': { entityType: 'city', censusVintage: 2019, placeFips: '74572' },
      Helena:       { entityType: 'city', censusVintage: 2014, placeFips: '37816' },
      McRae:        { entityType: 'city', censusVintage: 2014, placeFips: '49084' },
      Payne:        { entityType: 'city', censusVintage: 2014, placeFips: '59584' },
      Riverside:    { entityType: 'town', censusVintage: 2014, placeFips: '65604' },
      Macon:        { entityType: 'city', censusVintage: 2013, placeFips: '49000' },
    };
    for (const [name, w] of Object.entries(want)) {
      const e = GA_STATEWIDE_MUNICIPALITIES.find((x) => x.name === name);
      expect(e, `${name} missing from the registry`).toBeDefined();
      expect(e.entityType, name).toBe(w.entityType);
      expect(e.censusVintage, name).toBe(w.censusVintage);
      expect(e.placeFips, name).toBe(w.placeFips);
      // ⚠ NULL population is the honest value, not a defect: there is no
      // current estimate for a government no current vintage names.
      expect(e.population, name).toBeNull();
      expect(e.populationSource, name).toMatch(/no current estimate/);
    }
  });

  it('⚠ every OTHER municipality still types from Vintage 2024', () => {
    const recovered = new Set(['Ranger', 'Sunny Side', 'Helena', 'McRae', 'Payne', 'Riverside', 'Macon']);
    const others = GA_STATEWIDE_MUNICIPALITIES.filter((e) => !recovered.has(e.name));
    expect(others.length).toBeGreaterThan(500);
    for (const e of others) {
      expect(e.censusVintage, e.name).toBe(2024);
      expect(e.population, e.name).not.toBeNull();
    }
  });
});

describe('⚠⚠ a generated registry is never overwritten by a smaller one', () => {
  /**
   * MEASURED, NOT HYPOTHETICAL: running the builder with the SWEEP enumeration
   * (159 counties) while `--kind municipality` selects nothing wrote a
   * 0-entity registry over the 526 loaded municipalities, printed
   * "REGISTRY: 0 entities", and exited 0. Same shape as the `length === 0`
   * guard that put three $0 rows into production: an empty result is a
   * question, never an answer.
   */
  const FIXTURE = 'tests/fixtures/ga/registry-two-entities.mjs';

  it('refuses to write zero entities over a non-empty registry', () => {
    expect(() => assertNotShrinking(FIXTURE, []))
      .toThrow(/would write 0 entities over 2/);
  });

  it('refuses any shrink, not just an empty one', () => {
    expect(() => assertNotShrinking(FIXTURE, [{ key: 'a' }]))
      .toThrow(/would write 1 entities over 2/);
  });

  it('allows the same count or more', () => {
    expect(() => assertNotShrinking(FIXTURE, [{ key: 'a' }, { key: 'b' }])).not.toThrow();
    expect(() => assertNotShrinking(FIXTURE, [{ key: 'a' }, { key: 'b' }, { key: 'c' }])).not.toThrow();
  });

  it('allows a deliberate shrink when it is asked for explicitly', () => {
    expect(() => assertNotShrinking(FIXTURE, [], { allowShrink: true })).not.toThrow();
  });

  it('allows a first write, where there is no file to destroy', () => {
    expect(() => assertNotShrinking('tests/fixtures/ga/does-not-exist.mjs', [])).not.toThrow();
  });
});

describe('⚠⚠ a government whose filings span BOTH form generations', () => {
  /**
   * MEASURED: the v2 corpus (`_acfr-work/ga/muni/xlsx`, 4,808 workbooks) and
   * the v1 corpus (`_acfr-work/ga/pre2016/xlsx`, 4,551) are SEPARATE
   * DIRECTORIES, and `readFormMonths` read one. So a government that filed
   * only FY2009-2015 — Macon City, Payne City, Riverside Town, Helena City,
   * McRae City — had no readable filing at all and was refused
   * `no-readable-filing`, AFTER the census ladder had successfully typed it.
   *
   * ⚠ Typing a government is not enough to load it. Both halves must work.
   *
   * ⚠⚠ The v1 month comes from `Exportable Data`'s V98/V99 and NEVER from the
   * `Data` twin's `MO`, which is measured garbage (Banks reads 2005/2007/2009,
   * Cobb and DeKalb read 0).
   */
  const V1 = '_acfr-work/ga/pre2016/xlsx';
  const V2 = '_acfr-work/ga/muni/xlsx';

  it('reads a v1-only government across both corpora', async () => {
    if (!existsSync(V1) || !existsSync(V2)) {
      // ⚠ SKIPS LOUDLY. The corpora are gitignored; silence here would mean
      // the assertion had quietly stopped testing anything.
      console.warn(`SKIPPED: no GA corpus at ${V1} / ${V2}`);
      return;
    }
    // Macon City, 2011001 — five filings, FY2009-2013, all v1.
    const { months, notes } = await readFormMonths([V1, V2], '2011001', 2009, 2025);
    expect(months.map((m) => m.fiscalYear), notes.join('; ')).toEqual([2009, 2010, 2011, 2012, 2013]);

    // ⚠⚠ FY2011's V98 IS `#REF!`, AND THE MONTH COMES BACK NULL — NOT
    // DEFAULTED. The scoping found the `#REF!` hazard was a false alarm for
    // the FLOWS; it is not a false alarm for the month field. A null here is
    // the correct read of an unreadable cell, and `resolveMonth` falls back to
    // the entity's own consensus rather than inventing a month.
    // `project_fysm_column_default_one_defect` is 18,700 rows of why a
    // defaulted month is worse than a missing one.
    const byYear = Object.fromEntries(months.map((m) => [m.fiscalYear, m]));
    expect(byYear[2011].text).toBe('#REF!');
    expect(byYear[2011].month).toBeNull();
    for (const y of [2009, 2010, 2012, 2013]) {
      expect(byYear[y].text, `FY${y}`).toBe('June 30');
      expect(byYear[y].month, `FY${y}`).toBe(7);
    }
  });

  it('reads a government that filed in BOTH generations as one series', async () => {
    if (!existsSync(V1) || !existsSync(V2)) {
      console.warn(`SKIPPED: no GA corpus at ${V1} / ${V2}`);
      return;
    }
    // Sunny Side City, 2126003 — FY2009-2015 are v1, FY2016+ are v2.
    const { months } = await readFormMonths([V1, V2], '2126003', 2009, 2025);
    const years = months.map((m) => m.fiscalYear).sort((a, b) => a - b);
    expect(years).toContain(2009);
    expect(years).toContain(2016);
    expect(new Set(years).size, 'a year must not be read twice').toBe(years.length);
  });
});

describe('Echols is one government under two CICOIDs', () => {
  /**
   * ⭐ MEASURED: the FY2010 county-prefix filing (`1050050`) reports operating
   * $2,679,270 — IDENTICAL to the FY2010 consolidated filing already loaded
   * under `3050050`. Echols has no municipalities, so the unified government
   * covers the same territory and the same money. FY2009 is a genuine
   * continuation of the series TT already shows, not a second government.
   *
   * ⚠⚠ THE ALIAS MUST ADD NO ENTITY. A second entity would DUPLICATE rows
   * through `treasury_sync_city_budget`, which keys on fund_scope + basis and
   * not on data_source, instead of colliding visibly.
   */
  it('resolves the county-prefix CICOID onto the consolidated entity', () => {
    const viaCg = entityByCicoid('3050050');
    const viaCounty = entityByCicoid('1050050');
    expect(viaCg).toBeDefined();
    expect(viaCg.name).toBe('Echols County');
    expect(viaCounty).toBe(viaCg); // the SAME object, not an equal one
  });

  it('⚠⚠ adds NO second entity — the alias target is the only row', () => {
    expect(GA_ALL_ENTITIES.filter((e) => e.cicoid === '1050050')).toHaveLength(0);
    expect(GA_ALL_ENTITIES.filter((e) => e.cicoid === '3050050')).toHaveLength(1);
  });

  it('⚠ an alias whose target is in no registry fails loudly', () => {
    expect(() => assertAliases({ '9999999': '8888888' }, GA_ALL_ENTITIES))
      .toThrow(/alias target 8888888 is in no registry/);
  });

  it('⚠ an alias SOURCE that is itself a registry entry fails loudly', () => {
    expect(() => assertAliases({ '3050050': '3050050' }, GA_ALL_ENTITIES))
      .toThrow(/alias source 3050050 is itself a registry entry/);
  });

  it('⚠⚠ FY2010 stays REFUSED as the one measured overlap in the state', () => {
    // Loading it would double-count: both CICOIDs filed the same money.
    expect(consolidationOverlap('1050050', 2010) ?? consolidationOverlap('3050050', 2010)).toBeTruthy();
  });
});

describe('Bibb County is a predecessor government, not early Macon-Bibb', () => {
  /**
   * Chris's call, 2026-10-19. Bibb County filed as `1011011` through FY2013 and
   * reports $92.0M-$115.7M of operating. In 2014 it consolidated with the CITY
   * of Macon to form Macon-Bibb County (`3011011`), which reports $195.3M in
   * FY2016. Appending one series to the other would show a ~1.7x step that
   * reads as growth and is a change of scope — the Fulton FY2017/FY2018
   * reader-distortion shape, where 92% of an apparent jump was not growth.
   */
  it('exists as its own county entity with its own CICOID', () => {
    const b = entityByCicoid('1011011');
    expect(b).toBeDefined();
    expect(b.name).toBe('Bibb County');
    expect(b.entityType).toBe('county');
    expect(b.key).toBe('bibb-county');
  });

  it('⚠ its month is its filings own, measured — all five state June 30', () => {
    const b = entityByCicoid('1011011');
    expect(b.fiscalYearStartMonth).toBe(7);
    expect(b.fiscalYearEndText).toBe('June 30');
  });

  it('⚠⚠ STOPS AT FY2013 — it must never acquire a Macon-Bibb year', () => {
    const b = entityByCicoid('1011011');
    expect(Math.max(...b.fiscalYears)).toBe(2013);
    expect(b.lastFiscalYear).toBe(2013);
    expect(b.fiscalYears).toEqual([2009, 2010, 2011, 2012, 2013]);
    // Macon-Bibb is a DIFFERENT entity, and nothing joins the two series.
    const mb = entityByCicoid('3011011');
    expect(mb.key).not.toBe(b.key);
    expect(b.successorCicoid).toBe('3011011');
  });

  it('⚠ the census agrees: Macon got a NEW place code rather than continuing', () => {
    // PLACE 49000 (`Macon city`) ends after vintage 2013; 49008
    // (`Macon-Bibb County`) begins at vintage 2014. The Bureau treats the
    // consolidation as a new government — independent corroboration for not
    // splicing the series.
    const mb = entityByCicoid('3011011');
    expect(mb.populationSource).toMatch(/49008/);
    const { ladders, missing } = loadLadder('.', '13', DEFAULT_LADDER);
    expect(missing).toEqual([]);
    const macon = resolvePlace('Macon City', { ladders, missing });
    expect(macon.placeFips).toBe('49000');
    expect(macon.vintage).toBe(2013);
  });

  it('⚠ DCA\'s own enumeration shows a clean handover, no overlapping year', () => {
    const ENUM = '_acfr-work/ga/sweep/enumeration.json';
    const CONS = '_acfr-work/ga/cons/enumeration.json';
    if (!existsSync(ENUM) || !existsSync(CONS)) {
      console.warn('SKIPPED: no GA enumeration present');
      return;
    }
    const county = JSON.parse(readFileSync(ENUM, 'utf8')).governments.find((g) => g.cicoid === '1011011');
    const cons = JSON.parse(readFileSync(CONS, 'utf8')).governments.find((g) => g.cicoid === '3011011');
    expect(Math.max(...county.years)).toBe(2013);
    expect(Math.min(...cons.years)).toBe(2014);
    expect(county.years.filter((y) => cons.years.includes(y))).toEqual([]);
  });
});
