/**
 * McKinney department labels.
 *
 * ⚠⚠ THESE TESTS RUN OVER THE REAL EXTRACTED MAP, not hand-built fixtures.
 * The San Jose repair taught this the hard way: 22 green tests built their
 * inputs by hand, never exercised the collection step, and stayed green when
 * the entire fix was reverted. A fixture proves the function; the committed
 * artefact proves the fix.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { titleCaseName, labelFor, labelYear, idOrNull, ACRONYMS } from '../scripts/lib/mckinneyLabels.mjs';
import { departmentCode, rowsToMap } from '../scripts/extractMcKinneyDepartments.mjs';

const MAP = JSON.parse(readFileSync(new URL('../scripts/data/mckinneyDepartments.json', import.meta.url), 'utf8'));
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/mckinneyWorksheetRows.json', import.meta.url), 'utf8'));

describe('titleCaseName', () => {
  it('title-cases a publisher ALL CAPS string', () => {
    expect(titleCaseName('PARKS MAINTENANCE')).toBe('Parks Maintenance');
  });

  it('keeps acronyms whole', () => {
    expect(titleCaseName('CDBG ADMINISTRATION')).toBe('CDBG Administration');
    expect(titleCaseName('APEX FITNESS')).toBe('APEX Fitness');
    expect(titleCaseName('MPAC')).toBe('MPAC');
  });

  it('keeps ampersands and slashes', () => {
    expect(titleCaseName('PARK & REC ADMINISTRATION')).toBe('Park & Rec Administration');
    expect(titleCaseName('WATER/WASTEWATER FUND')).toBe('Water/Wastewater Fund');
  });

  it('lowercases minor words except in first position', () => {
    expect(titleCaseName('OFFICE OF THE CITY MANAGER')).toBe('Office of the City Manager');
    expect(titleCaseName('THE COLONY')).toBe('The Colony');
  });

  it('leaves an already mixed-case string alone', () => {
    expect(titleCaseName('Parks Maintenance')).toBe('Parks Maintenance');
  });

  it('returns null for blank and nullish input', () => {
    expect(titleCaseName(null)).toBeNull();
    expect(titleCaseName('   ')).toBeNull();
  });
});

describe('labelFor', () => {
  it('joins department and division', () => {
    expect(labelFor('4306', { dept: 'PARKS & RECREATION', div: 'PARKS MAINTENANCE' }))
      .toBe('Parks & Recreation - Parks Maintenance');
  });

  it('does not repeat a department that equals its division', () => {
    expect(labelFor('3100', { dept: 'POLICE', div: 'POLICE' })).toBe('Police');
  });

  it('uses department alone when the publisher gives no division', () => {
    expect(labelFor('9999', { dept: 'NON-DEPARTMENTAL', div: null })).toBe('Non-Departmental');
  });

  // ⛔ The rule the whole file exists to enforce.
  it('falls back to the publisher identifier, never a guess', () => {
    expect(labelFor('7777', undefined)).toBe('Department 7777');
    expect(labelFor('0', null)).toBe('Department 0');
  });

  it('prefixes the fund only when asked to qualify', () => {
    const e = { dept: 'ADMINISTRATION', div: 'PROJECTS', fund: 'MCDC' };
    expect(labelFor('1247', e)).toBe('Administration - Projects');
    expect(labelFor('1247', e, { qualify: true })).toBe('MCDC - Administration - Projects');
  });
});

describe('labelYear', () => {
  it('qualifies only the codes that actually collide', () => {
    const map = {
      1247: { dept: 'ADMINISTRATION', div: 'PROJECTS', fund: 'MCDC' },
      1257: { dept: 'ADMINISTRATION', div: 'PROJECTS', fund: 'MEDC OPERATING FUND' },
      3100: { dept: 'POLICE', div: 'POLICE', fund: 'GENERAL FUND' },
    };
    const out = labelYear(['1247', '1257', '3100'], map);
    expect(out.get('1247')).toBe('MCDC - Administration - Projects');
    expect(out.get('1257')).toBe('MEDC Operating Fund - Administration - Projects');
    expect(out.get('3100')).toBe('Police');          // untouched — it never collided
  });

  it('refuses to emit a duplicate label it cannot separate', () => {
    const map = {
      1: { dept: 'ADMIN', div: 'PROJECTS', fund: 'GENERAL FUND' },
      2: { dept: 'ADMIN', div: 'PROJECTS', fund: 'GENERAL FUND' },
    };
    expect(() => labelYear(['1', '2'], map)).toThrow(/collision survives fund qualification/);
  });

  it('does not append a code to paper over a collision', () => {
    const map = {
      1: { dept: 'ADMIN', div: 'PROJECTS', fund: 'GENERAL FUND' },
      2: { dept: 'ADMIN', div: 'PROJECTS', fund: 'GENERAL FUND' },
    };
    let msg = '';
    try { labelYear(['1', '2'], map); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/Do NOT append the code/);
  });
});

describe('idOrNull — the falsy-zero bug', () => {
  // ⚠⚠⚠ $79,113,310 of FY2024 McKinney spending was labelled `Unknown
  // Department` because `0 || null` is null. Zero is an identifier.
  it('keeps the integer zero', () => {
    expect(idOrNull(0)).toBe('0');
  });
  it('keeps the string zero', () => {
    expect(idOrNull('0')).toBe('0');
  });
  it('still rejects genuine absence', () => {
    expect(idOrNull(null)).toBeNull();
    expect(idOrNull(undefined)).toBeNull();
    expect(idOrNull('   ')).toBeNull();
  });
  it('is not what plain truthiness does', () => {
    expect(0 || null).toBeNull();                // the bug, pinned
    expect(idOrNull(0)).not.toBeNull();          // the fix
  });
});

describe('departmentCode', () => {
  it('reads the middle segment of an account number', () => {
    expect(departmentCode('001-4306-453.81-01')).toEqual({ fund: '001', code: '4306' });
  });
  it('strips leading zeros so 0000 is code 0', () => {
    expect(departmentCode('019-0000-202.01-52')).toEqual({ fund: '019', code: '0' });
  });
  it('ignores anything that is not an account number', () => {
    expect(departmentCode('SUBTOTAL: 1-AD VALOREM TAXES')).toBeNull();
    expect(departmentCode(null)).toBeNull();
  });
});

// ── The collection step, over verbatim published rows ─────────────────────
//
// ⚠⚠ This is the block that would have caught the San Jose near-miss. It runs
// the real `rowsToMap` over rows copied out of the published worksheet, so
// reverting any part of the reader fails here — not just in a fixture of our
// own construction.
describe('rowsToMap over verbatim worksheet rows', () => {
  const FY22 = rowsToMap(FIXTURE.byYear['2022']);
  const FY24 = rowsToMap(FIXTURE.byYear['2024']);

  it('reads the department and division off a real account line', () => {
    expect(FY24['2119']).toEqual({ dept: 'INTERNAL SERVICES', div: 'INFORMATION TECHNOLOGY', fund: 'GENERAL FUND' });
    expect(FY24['4306']).toEqual({ dept: 'PARKS & RECREATION', div: 'PARKS MAINTENANCE', fund: 'GENERAL FUND' });
  });

  it('keeps a code whose division the publisher writes as "-"', () => {
    // ⚠ NON-DEPARTMENTAL. Dropping this loses one of the largest roots.
    expect(FY22['9999']).toEqual({ dept: 'NON-DEPARTMENTAL', div: null, fund: 'GENERAL FUND' });
  });

  it('ignores section headers and subtotal lines', () => {
    expect(FY22['1']).toBeUndefined();
    expect(FY22['80']).toBeUndefined();
  });

  it('does not treat the same code in two funds as a contradiction', () => {
    // 9999 appears under GENERAL FUND and FLEET MAINTENANCE FUND with the same
    // department name; only a differing NAME is a contradiction.
    expect(Object.keys(FY22)).toContain('9999');
  });

  it('refuses a code the publisher names two different ways', () => {
    const rows = [
      ['001-4306-451.80-03', 'GENERAL FUND', 'PARKS & RECREATION', 'PARKS MAINTENANCE'],
      ['001-4306-451.80-04', 'GENERAL FUND', 'PUBLIC WORKS', 'STREETS'],
    ];
    expect(() => rowsToMap(rows)).toThrow(/MORE THAN ONE name/);
  });

  it('labels the MEDC/MCDC pair apart using the publisher’s fund', () => {
    const out = labelYear(Object.keys(FY24), FY24);
    expect(out.get('1257')).toBe('MEDC Operating Fund - Administration - Projects');
    expect(out.get('1247')).toBe('MCDC - Administration - Projects');
  });
});

// ── The committed artefact ────────────────────────────────────────────────
describe('the extracted publisher map', () => {
  const YEARS = ['2022', '2023', '2024', '2025'];

  it('covers all four check-register years', () => {
    expect(Object.keys(MAP.byYear).sort()).toEqual(YEARS);
  });

  it('names the codes TT previously got wrong, as the publisher names them', () => {
    const m = MAP.byYear['2024'];
    expect(m['2119']).toMatchObject({ dept: 'INTERNAL SERVICES', div: 'INFORMATION TECHNOLOGY' });
    expect(m['4306']).toMatchObject({ dept: 'PARKS & RECREATION', div: 'PARKS MAINTENANCE' });
    expect(m['1241']).toMatchObject({ dept: 'ADMINISTRATION', div: 'PLANNING' });
  });

  it('keeps NON-DEPARTMENTAL, whose division the publisher leaves blank', () => {
    // ⚠ Requiring a non-empty Division dropped this code on the first pass.
    expect(MAP.byYear['2022']['9999']).toMatchObject({ dept: 'NON-DEPARTMENTAL', div: null });
  });

  it('produces no duplicate label in any year', () => {
    for (const fy of YEARS) {
      const codes = Object.keys(MAP.byYear[fy]);
      const labels = [...labelYear(codes, MAP.byYear[fy]).values()];
      expect(new Set(labels).size, `FY${fy}`).toBe(labels.length);
    }
  });

  it('never emits a label that was one of the invented ones', () => {
    const INVENTED = ['Risk Management', 'Fleet & Vehicles', 'Development Reimbursements',
                      'Parks Horticulture', 'Performing Arts', 'Economic Development Obligations',
                      'Unknown Department'];
    for (const fy of YEARS) {
      const labels = [...labelYear(Object.keys(MAP.byYear[fy]), MAP.byYear[fy]).values()];
      for (const bad of INVENTED) expect(labels, `FY${fy}`).not.toContain(bad);
    }
  });

  it('records where it came from', () => {
    expect(MAP._source).toMatch(/Adopted Budget Worksheets/);
    expect(Object.values(MAP._urls)).toHaveLength(4);
    for (const u of Object.values(MAP._urls)) expect(u).toMatch(/^https:\/\/www\.mckinneytexas\.org\//);
  });

  // ⚠ Whole tokens, not substring: `blob.includes('IT')` matches FACILITIES and
  // would wave through an acronym the publisher never writes.
  it('holds only publisher strings — ACRONYMS never invents a word', () => {
    const tokens = new Set();
    for (const year of Object.values(MAP.byYear)) {
      for (const v of Object.values(year)) {
        for (const s of [v.dept, v.div, v.fund]) {
          if (s) for (const t of s.split(/[^A-Za-z0-9]+/)) if (t) tokens.add(t.toUpperCase());
        }
      }
    }
    for (const a of ACRONYMS) {
      expect(tokens.has(a), `${a} is in ACRONYMS but not a token in the publisher map`).toBe(true);
    }
  });

  it('preserves the publisher’s punctuation inside an acronym', () => {
    expect(titleCaseName('G.O. DEBT SERVICE FUND')).toBe('G.O. Debt Service Fund');
    expect(titleCaseName('MCK HOUSING FINANCE CORP')).toBe('MCK Housing Finance Corp');
  });
});
