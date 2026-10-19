import { readFileSync, existsSync } from 'node:fs';

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
import {
  resolveMonth as loaderResolveMonth, unverifiableMatches, toTree,
} from '../scripts/loadGeorgiaRLGF.mjs';
import {
  GA_FYE_MONTH_CHANGES, GA_FYE_MONTH_DEFECTS, fyeMonthChange, fyeMonthDefect,
  GA_UNVERIFIABLE_FILINGS, unverifiableFiling, formTotalDefect,
  GA_FIGURE_FLAGS, GA_EMPTY_DATASETS, emptyDataset,
} from '../scripts/data/gaRlgfAnomalies.mjs';
import { figureFlags } from '../src/data/figureFlags.ts';

// ⚠ `cache/` is gitignored IN FULL (.gitignore:121), so nothing under it can be
// read by a test that has to pass in CI. The fixture is a byte extract of the
// source, pinned to LF by .gitattributes:73.
const CENSUS_FIXTURE = 'tests/fixtures/census/co-est2024-ga-slice.csv';
const CENSUS_SOURCE = 'cache/co-est2024-alldata.csv';

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

  it('pins the load window to the LOAD1 form generation', () => {
    expect(GA_FIRST_YEAR).toBe(2016);
    expect(GA_LAST_YEAR).toBe(2025);
    expect(GA_LOAD_WINDOW).toEqual({ first: 2016, last: 2025 });
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
    expect(GA_EMPTY_DATASETS).toHaveLength(3);
    for (const e of GA_EMPTY_DATASETS) {
      expect(e.dataset).toBe('operating');
      expect(e.what).toBeTruthy();
      expect(emptyDataset(e.cicoid, e.fiscalYear, 'operating')).toBe(e);
      // the REVENUE side of the same filing is not withheld
      expect(emptyDataset(e.cicoid, e.fiscalYear, 'revenue')).toBeNull();
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
