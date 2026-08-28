import { describe, it, expect } from 'vitest';
import {
  classifyAuditee, titleize, splitCsv, TARGETS, NOT_A_GOVERNMENT, NOT_A_GOVERNMENT_TAIL,
  stateSuffix, zipPrefix, zipPrefixStateMap, demoteZipMismatches, compactYears, expandYears,
} from '../scripts/buildFacFiscalYearCensus.mjs';

// Every case here is a record that ACTUALLY appeared in the FAC bulk downloads
// and would have corrupted the census. None of them is hypothetical.

describe('regex escaping, which fails silently in both directions', () => {
  // ⚠ In a JS string literal '\b' is the BACKSPACE character, not a word
  // boundary; in a template literal a lone `\s` collapses to a bare "s". Written
  // either way the pattern matches nothing and every impostor sails through.
  it('uses real word boundaries, not backspace characters', () => {
    expect(NOT_A_GOVERNMENT.test('SOMETHING DEPT')).toBe(true);
    expect(NOT_A_GOVERNMENT.test('DEPTFORD')).toBe(false);
    expect(NOT_A_GOVERNMENT.test('X FUND')).toBe(true);
    expect(NOT_A_GOVERNMENT.test('FUNDY')).toBe(false);
  });

  it('builds a working state-suffix pattern', () => {
    expect(stateSuffix('TX').test('CITY OF PLANO, TEXAS')).toBe(true);
    expect(stateSuffix('TX').test('CITY OF PLANO, TX')).toBe(true);
    expect(stateSuffix('TX').test('CITY OF PLANO')).toBe(false);
    expect(classifyAuditee('CITY OF PLANO, TEXAS', 'TX').entity).toBe('Plano');
  });
});

describe('a mailing ZIP is not a jurisdiction', () => {
  // ⚠ Hand-written ZIP ranges caught four real impostors across three states.
  // Nationally the same rule drops ~1,400 LEGITIMATE records — 41 Ohio
  // governments file from West Virginia addresses, 39 Pennsylvania ones from New
  // Jersey. So the ZIP DEMOTES rather than excludes.
  const votes = new Map([
    ['875', new Map([['NM', 40]])],          // Santa Fe, NM
    ['775', new Map([['TX', 60]])],          // Santa Fe, TX
    ['634', new Map([['MO', 2]])],           // too few votes to trust
  ]);
  const map = zipPrefixStateMap(votes);

  it('derives the prefix map by majority vote, ignoring thin evidence', () => {
    expect(map.get('875')).toBe('NM');
    expect(map.get('775')).toBe('TX');
    expect(map.has('634')).toBe(false);      // fewer than 3 votes proves nothing
  });

  it('reads a usable prefix, or nothing', () => {
    expect(zipPrefix('87504-1234')).toBe('875');
    for (const z of [undefined, null, '', 'ABCDE', '87']) expect(zipPrefix(z)).toBeNull();
  });

  // ⚠⚠ THE CASE THAT ACTUALLY CORRUPTS A CENSUS. Santa Fe NEW MEXICO filed under
  // TX, and merged with Santa Fe TEXAS it made the Texas city look like it had
  // changed its fiscal year.
  it('drops contamination of an entity that has in-state records', () => {
    const kept = demoteZipMismatches([
      { state: 'TX', entity: 'Santa Fe', zip: '77510' },   // the Texas city
      { state: 'TX', entity: 'Santa Fe', zip: '87504' },   // New Mexico, mis-filed
    ], map);
    expect(kept).toHaveLength(1);
    expect(kept[0].zip).toBe('77510');
  });

  // …but an entity whose WHOLE history is mailed from next door is real.
  it('keeps an entity whose every record disagrees with its ZIP', () => {
    const rows = [
      { state: 'OH', entity: 'Somewhere', zip: '25401' },
      { state: 'OH', entity: 'Somewhere', zip: '25401' },
    ];
    expect(demoteZipMismatches(rows, new Map([['254', 'WV']]))).toHaveLength(2);
  });
});

describe('institutions arrive shaped like governments', () => {
  it('rejects authorities, commissions, departments and districts', () => {
    for (const [name, st] of [
      ['HOUSING COMMISSION OF TALBOT COUNTY', 'MD'],
      ['MHMR OF TARRANT COUNTY', 'TX'],
      ['COMMUNITY SUPERVISION AND CORRECTIONS DEPT OF HARRIS COUNTY', 'TX'],
      ['CITY OF ORANGE HOUSING AUTHORITY', 'CA'],
      ['CITY OF LOS ANGELES, DEPARTMENT OF WATER & POWER - WATER SYSTEM', 'CA'],
      ['BOARD OF EDUCATION OF GARRETT COUNTY MARYLAND', 'MD'],
      ['TRAVIS COUNTY EMERGENCY SERVICES DISTRICT NO. 2', 'TX'],
      ['CITY OF HOPE AND AFFILIATES', 'CA'],
    ]) expect(classifyAuditee(name, st), name).toBeNull();
  });

  // ⚠ These four reached a census as COUNTIES, because an organisation named
  // after a county ends in one.
  it('rejects organisations named after a county', () => {
    for (const [name, st] of [
      ['YWCA CLARK COUNTY', 'WA'],
      ['WORKFORCE DEVELOPMENT COUNCIL SNOHOMISH COUNTY', 'WA'],
      ['FAMILY AND CHILDREN FIRST COUNCIL MAHONING COUNTY', 'OH'],
      ['HARDIN COUNTY EDUCATIONAL SERVICES HARDIN COUNTY', 'OH'],
    ]) expect(classifyAuditee(name, st), name).toBeNull();
  });

  // A county name is at most three words. Four or more is an organisation.
  it('caps a county name at three words', () => {
    expect(classifyAuditee("PRINCE GEORGE'S COUNTY", 'MD').entity).toBe("Prince George's County");
    expect(classifyAuditee('SAN PATRICIO COUNTY', 'TX').entity).toBe('San Patricio County');
    expect(classifyAuditee('SOME LONG MADE UP THING COUNTY', 'TX')).toBeNull();
  });

  // ⚠ Trailing "… VILLAGE" is the shape of retirement communities and, in Ohio,
  // of SCHOOL DISTRICTS ("… EXEMPTED VILLAGE"). Real villages file "VILLAGE OF X".
  it('does not treat a trailing "Village" as a municipality', () => {
    for (const [name, st] of [['CANTERBURY VILLAGE', 'CA'], ['FIRST COMMUNITY VILLAGE', 'OH'],
      ['UPPER SANDUSKY EXEMPTED VILLAGE', 'OH'], ["SONOMA COUNTY CHILDREN'S VILLAGE", 'CA']]) {
      expect(classifyAuditee(name, st), name).toBeNull();
    }
    expect(classifyAuditee('VILLAGE OF SKOKIE', 'IL')).toEqual({ kind: 'municipality', entity: 'Skokie' });
  });

  // ⚠ A filter that drops REAL governments is as wrong as one that admits fakes.
  // "BOROUGH OF STATE COLLEGE" was rejected for containing "COLLEGE".
  it('keeps governments whose place name contains an institution word', () => {
    expect(classifyAuditee('BOROUGH OF STATE COLLEGE', 'PA')).toEqual({ kind: 'municipality', entity: 'State College' });
    expect(NOT_A_GOVERNMENT_TAIL.test('State College')).toBe(false);
  });
});

describe('never invent a name', () => {
  // ⚠⚠ UTAH IS WHY. Its cities file as "<Name> City" — and "ALPINE CITY" is the
  // city of Alpine while "CEDAR CITY" is genuinely named Cedar City. Nothing in
  // the string tells them apart, so stripping the stem would invent names and
  // split entities. A trailing form keeps the WHOLE name.
  it('keeps the whole name for trailing forms', () => {
    expect(classifyAuditee('SALT LAKE CITY', 'UT').entity).toBe('Salt Lake City');
    expect(classifyAuditee('OKLAHOMA CITY', 'OK').entity).toBe('Oklahoma City');
    expect(classifyAuditee('ALPINE CITY', 'UT').entity).toBe('Alpine City');
    expect(classifyAuditee('ANTIMONY TOWN', 'UT').entity).toBe('Antimony Town');
  });

  // Utah cities are legally "<Name> City Corporation".
  it('strips the Utah corporate tail without admitting real corporations', () => {
    expect(classifyAuditee('BRIGHAM CITY CORPORATION', 'UT').entity).toBe('Brigham City');
    expect(classifyAuditee('LUCAS COUNTY LAND REUTILIZATION CORPORATION', 'OH')).toBeNull();
  });

  it('strips the prefix — and only the prefix — for leading forms', () => {
    expect(classifyAuditee('CITY OF GROVE CITY', 'OH').entity).toBe('Grove City');
    expect(classifyAuditee('TOWN OF LEXINGTON', 'MA').entity).toBe('Lexington');
    expect(classifyAuditee('THE COMMISSIONERS OF LEONARDTOWN', 'MD').entity).toBe('Leonardtown');
  });

  // ⚠ One entity became three: "Rockville", "…(mayor & Council)", "…(mayor And
  // Council)", each holding part of the history — and half a history can hide a
  // calendar change.
  it('folds governing-body parentheticals and rejects any other', () => {
    for (const f of ['CITY OF ROCKVILLE', 'CITY OF ROCKVILLE (MAYOR AND COUNCIL)',
      'CITY OF ROCKVILLE (MAYOR & COUNCIL)']) {
      expect(classifyAuditee(f, 'MD').entity, f).toBe('Rockville');
    }
    expect(classifyAuditee('CITY OF EASTON (THE EASTON UTILITIES COMMISION)', 'MD')).toBeNull();
  });

  it('title-cases without mangling apostrophes or initials', () => {
    expect(titleize("ST. MARY'S COUNTY")).toBe("St. Mary's County");
    expect(titleize('LA SALLE')).toBe('La Salle');
  });

  it('folds case and suffix variants onto one name', () => {
    for (const f of ['ANDERSON COUNTY', 'Anderson County', 'ANDERSON COUNTY, TEXAS', 'Anderson County, TX']) {
      expect(classifyAuditee(f, 'TX').entity, f).toBe('Anderson County');
    }
  });
});

describe('kinds, because a state is not one calendar', () => {
  // ⚠ Michigan townships are modally APRIL while its municipalities are JULY, so
  // folding townships into municipalities would invent a false mixture in exactly
  // the states where the calendar is least uniform.
  it('separates townships from municipalities', () => {
    expect(classifyAuditee('CHARTER TOWNSHIP OF CANTON', 'MI')).toEqual({ kind: 'township', entity: 'Canton Township' });
    expect(classifyAuditee('DEPTFORD TOWNSHIP', 'NJ')).toEqual({ kind: 'township', entity: 'Deptford Township' });
  });

  // ⚠ "CITY AND COUNTY OF SAN FRANCISCO" begins "CITY AND", and classing it as a
  // county dropped San Francisco out of the California census entirely, because
  // CA censuses only municipalities.
  it('treats a consolidated city-county as the municipality it is', () => {
    expect(classifyAuditee('CITY AND COUNTY OF SAN FRANCISCO', 'CA')).toEqual({ kind: 'municipality', entity: 'San Francisco' });
    expect(classifyAuditee('CITY AND COUNTY OF DENVER', 'CO')).toEqual({ kind: 'municipality', entity: 'Denver' });
    expect(classifyAuditee('CITY AND BOROUGH OF JUNEAU', 'AK')).toEqual({ kind: 'municipality', entity: 'Juneau' });
  });

  it('keeps Louisiana parishes as parishes', () => {
    expect(classifyAuditee('ORLEANS PARISH', 'LA').entity).toBe('Orleans Parish');
    expect(classifyAuditee('PARISH OF JEFFERSON', 'LA').entity).toBe('Jefferson Parish');
  });

  // Cal. Gov. Code § 29001(e) settles California counties by statute.
  it('excludes California counties on purpose', () => {
    expect(TARGETS.CA.kinds).toEqual(['municipality']);
    expect(classifyAuditee('ORANGE COUNTY', 'CA')).toBeNull();
    expect(classifyAuditee('ORANGE COUNTY', 'TX').kind).toBe('county');
  });

  it('covers every state plus DC and the territories', () => {
    expect(Object.keys(TARGETS).length).toBeGreaterThanOrEqual(55);
    for (const st of ['CA', 'TX', 'MD', 'MN', 'MA', 'OH', 'UT', 'WA', 'DC', 'PR']) {
      expect(TARGETS[st], st).toBeTruthy();
    }
  });

  it('refuses a state it has no configuration for', () => {
    expect(classifyAuditee('CITY OF NOWHERE', 'ZZ')).toBeNull();
  });
});

describe('year ranges keep a national census small', () => {
  it('round-trips', () => {
    expect(compactYears([1998, 1999, 2000, 2002, 2005, 2006])).toBe('1998-2000 2002 2005-2006');
    expect(expandYears('1998-2000 2002 2005-2006')).toEqual([1998, 1999, 2000, 2002, 2005, 2006]);
    expect(expandYears(compactYears([2016]))).toEqual([2016]);
    expect(expandYears('')).toEqual([]);
  });

  it('de-duplicates and sorts', () => {
    expect(compactYears([2001, 2000, 2001])).toBe('2000-2001');
  });
});

describe('the CSV splitter', () => {
  it('keeps quoted commas inside one field', () => {
    expect(splitCsv('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(splitCsv('"CITY OF GROTON, CONNECTICUT",2020')).toEqual(['CITY OF GROTON, CONNECTICUT', '2020']);
    expect(splitCsv('a,"say ""hi""",b')).toEqual(['a', 'say "hi"', 'b']);
    expect(splitCsv('a,,b')).toEqual(['a', '', 'b']);
  });
});
