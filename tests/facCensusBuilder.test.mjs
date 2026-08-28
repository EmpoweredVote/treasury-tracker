import { describe, it, expect } from 'vitest';
import {
  classifyAuditee, titleize, inStateZip, splitCsv, TARGETS, NOT_A_GOVERNMENT,
} from '../scripts/buildFacFiscalYearCensus.mjs';

// Every case in this file is a record that ACTUALLY appeared in the FAC bulk
// download and would have corrupted a census. None of them is hypothetical.

describe('the state field is self-reported and sometimes wrong', () => {
  // ⚠⚠ THE DANGEROUS ONE. There is a Santa Fe, TEXAS and a Santa Fe, NEW MEXICO,
  // and the FAC listed the New Mexico city under TX. Merged, the Texas city
  // looked like it had CHANGED its fiscal year (July in one year, October in the
  // rest). The ZIP prefix is what separates them.
  it('rejects out-of-state ZIPs that share a city name', () => {
    expect(inStateZip('87504', 'TX')).toBe(false);   // Santa Fe, NM
    expect(inStateZip('77510', 'TX')).toBe(true);    // Santa Fe, TX
  });

  it('rejects the other impostors the federal record carried', () => {
    expect(inStateZip('06340', 'CA')).toBe(false);   // "CITY OF GROTON, CONNECTICUT"
    expect(inStateZip('88310', 'TX')).toBe(false);   // Alamogordo, NM
    expect(inStateZip('74103', 'TX')).toBe(false);   // "CITY OF TULSA, OKLAHOMA"
    expect(inStateZip('19711', 'MD')).toBe(false);   // Newark, DE
  });

  it('accepts each state\'s own ranges, including the Texas 885xx exclave', () => {
    expect(inStateZip('90210', 'CA')).toBe(true);
    expect(inStateZip('75001', 'TX')).toBe(true);
    expect(inStateZip('88530', 'TX')).toBe(true);    // El Paso area
    expect(inStateZip('21201', 'MD')).toBe(true);
  });

  it('refuses a missing or malformed ZIP rather than guessing', () => {
    for (const z of [undefined, null, '', 'ABCDE', '1']) expect(inStateZip(z, 'CA')).toBe(false);
  });
});

describe('institutions arrive shaped like governments', () => {
  // Each of these ends in "… County" or begins "City of …" and would otherwise
  // enter the census as a general-purpose local government.
  it('rejects authorities, commissions, departments and districts', () => {
    for (const name of [
      'HOUSING COMMISSION OF TALBOT COUNTY',
      'HOUSING OPPORTUNITIES COMMISSION OF MONTGOMERY COUNTY',
      'MHMR OF TARRANT COUNTY',
      'COMMUNITY SUPERVISION AND CORRECTIONS DEPT OF HARRIS COUNTY',
      'BEHAVIORAL HEALTH CENTER OF NUECES COUNTY',
      'CITY OF ORANGE HOUSING AUTHORITY',
      'CITY OF LOS ANGELES, DEPARTMENT OF WATER & POWER - WATER SYSTEM',
      'CITY OF SAN BERNARDINO MUNICIPAL WATER DEPARTMENT',
      'BOARD OF EDUCATION OF GARRETT COUNTY MARYLAND',
      'TRAVIS COUNTY EMERGENCY SERVICES DISTRICT NO. 2',
    ]) {
      expect(classifyAuditee(name, name.includes('MARYLAND') ? 'MD' : 'TX'), name).toBeNull();
    }
  });

  it('keeps the real governments those impostors sit beside', () => {
    expect(classifyAuditee('TRAVIS COUNTY TEXAS', 'TX')).toEqual({ kind: 'county', entity: 'Travis County' });
    expect(classifyAuditee('HARRIS COUNTY', 'TX')).toEqual({ kind: 'county', entity: 'Harris County' });
    expect(classifyAuditee('CITY OF LOS ANGELES', 'CA')).toEqual({ kind: 'municipality', entity: 'Los Angeles' });
  });
});

describe('one entity must not become two', () => {
  // The same government files as UPPER CASE in older years and Mixed Case in
  // newer ones, with and without a state suffix. Un-normalised, "ANDERSON
  // COUNTY" and "Anderson County" are two entities each holding half a history —
  // and half a history can hide a calendar change.
  it('folds case and state-suffix variants onto one name', () => {
    const forms = ['ANDERSON COUNTY', 'Anderson County', 'ANDERSON COUNTY, TEXAS', 'Anderson County, TX'];
    for (const f of forms) expect(classifyAuditee(f, 'TX').entity).toBe('Anderson County');
    for (const f of ['CITY OF PLANO', 'City of Plano, Texas', 'CITY OF PLANO, TX', 'City of Plano.']) {
      expect(classifyAuditee(f, 'TX').entity).toBe('Plano');
    }
  });

  // ⚠ Reading the bulk file with a replacement-character fallback instead of
  // strict UTF-8 turned "St. Mary's County" into "St. Mary?s County" and split
  // that county in two. Title-casing must survive apostrophes and periods.
  it('title-cases without mangling apostrophes or initials', () => {
    expect(titleize("ST. MARY'S COUNTY")).toBe("St. Mary's County");
    expect(titleize("PRINCE GEORGE'S")).toBe("Prince George's");
    expect(titleize('LA SALLE')).toBe('La Salle');
    expect(titleize('west university place')).toBe('West University Place');
  });

  it('reads every municipal name form the record uses', () => {
    expect(classifyAuditee('CITY AND COUNTY OF SAN FRANCISCO', 'CA').entity).toBe('San Francisco');
    expect(classifyAuditee('TOWN OF TRUCKEE', 'CA').entity).toBe('Truckee');
    expect(classifyAuditee('THE COMMISSIONERS OF LEONARDTOWN', 'MD'))
      .toEqual({ kind: 'municipality', entity: 'Leonardtown' });
    expect(classifyAuditee('THE COUNTY COMMISSIONERS OF KENT COUNTY', 'MD'))
      .toEqual({ kind: 'county', entity: 'Kent County' });
    expect(classifyAuditee('COUNTY OF ESSEX', 'MD')).toEqual({ kind: 'county', entity: 'Essex County' });
  });
});

describe('scope per state', () => {
  // ⚠ CA counties are settled by Cal. Gov. Code § 29001(e) and are deliberately
  // NOT censused; TX and MD have no such statute, so theirs are.
  it('excludes California counties and includes Texas and Maryland ones', () => {
    expect(TARGETS.CA.kinds).toEqual(['municipality']);
    expect(classifyAuditee('ORANGE COUNTY', 'CA')).toBeNull();
    expect(classifyAuditee('ORANGE COUNTY', 'TX')).toEqual({ kind: 'county', entity: 'Orange County' });
  });

  it('never emits a name that would break the CSV', () => {
    expect(NOT_A_GOVERNMENT.test('CITY OF ANYTOWN HOUSING AUTHORITY')).toBe(true);
    for (const n of ['CITY OF PLANO, TEXAS', 'THE COUNTY COMMISSIONERS OF KENT COUNTY']) {
      const c = classifyAuditee(n, n.includes('TEXAS') ? 'TX' : 'MD');
      expect(c.entity).not.toMatch(/[",]/);
    }
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
