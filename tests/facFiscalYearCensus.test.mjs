import { describe, it, expect } from 'vitest';
import {
  BASELINE, STATE_BASELINE, WINDOW, EVIDENCE_CSV, readEvidence, buildCensus, states,
  exceptions, changeoverYears, censusMonthFor, censusGuard, dominantMonthFor, stubPeriods,
} from '../scripts/lib/facFiscalYearCensus.mjs';
import { ESTABLISHED as TX_ESTABLISHED, CORRECT_MONTH as TX_MONTH }
  from '../scripts/lib/txLocalFiscalCalendars.mjs';
import { ENTITY as MD_ENTITY, CORRECT_MONTH as MD_MONTH } from '../scripts/lib/leonardtownFiscalCalendar.mjs';
import { fiscalExceptionFor, monthForEntry } from '../scripts/lib/caCityFiscalExceptions.mjs';

describe('the committed national evidence', () => {
  it('is the size it was when the census was built', () => {
    expect(readEvidence().length).toBe(BASELINE.rows);
    const entities = new Set(readEvidence().map((r) => `${r.state}|${r.entity}`));
    expect(entities.size).toBe(BASELINE.entities);
  });

  it('covers only audit years inside the window', () => {
    // ⚠ Not Math.min(...years) — the national evidence expands to ~200k years
    // and the spread overflows the call stack, which reads as a test failure
    // rather than as the size of the corpus.
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of readEvidence()) {
      for (const y of r.years) { if (y < lo) lo = y; if (y > hi) hi = y; }
    }
    expect(lo).toBeGreaterThanOrEqual(WINDOW.firstAuditYear);
    expect(hi).toBeLessThanOrEqual(WINDOW.lastAuditYear);
  });

  // ⚠ 1998, not 2016. The FAC ships 2016+ and 1998-2015 as separate downloads
  // with different schemas, and a census built from the modern file alone starts
  // at 2016 — while TT holds rows back to FY2003.
  it('reaches back before any TT row', () => {
    expect(WINDOW.firstAuditYear).toBe(1998);
    expect(EVIDENCE_CSV).toMatch(/fac-local-fiscal-year-ends\.csv$/);
  });

  it('covers the whole country, not a sample', () => {
    expect(states().length).toBeGreaterThanOrEqual(50);
    for (const st of ['CA', 'TX', 'MD', 'MN', 'MA', 'OH', 'UT', 'WA', 'VA', 'NC', 'OR', 'AZ', 'CO', 'IN', 'WI']) {
      expect(states(), st).toContain(st);
    }
  });

  it('carries no institution masquerading as a government', () => {
    // ⚠ Word boundaries here too. Without them this assertion rejects
    // SCHOOLCRAFT COUNTY, Michigan — a real county — which is the same
    // substring-versus-word mistake the builder's own filters had.
    const institution = /\b(authority|commission|district|department|housing|school|board|hospital|ywca|ymca|airport)\b/i;
    for (const r of readEvidence()) {
      expect(r.entity, `${r.state} ${r.entity}`).not.toMatch(institution);
    }
  });

  it('refuses a state it has no records for', () => {
    expect(() => readEvidence('ZZ')).toThrow(/no census records/);
  });
});

describe('a state is not one calendar — the modal month is MEASURED per kind', () => {
  // ⚠⚠ THE FINDING THAT JUSTIFIES MEASURING RATHER THAN DECLARING. Each of these
  // pairs sits inside ONE state, and a single per-state month would call
  // thousands of correct governments exceptional while hiding the real outliers.
  it('finds kinds inside a state disagreeing with each other', () => {
    expect(dominantMonthFor('UT', 'municipality')).toBe(7);
    expect(dominantMonthFor('UT', 'county')).toBe(1);
    expect(dominantMonthFor('IL', 'municipality')).toBe(5);      // May-April
    expect(dominantMonthFor('IL', 'county')).toBe(12);           // December-November
    expect(dominantMonthFor('MI', 'municipality')).toBe(7);
    expect(dominantMonthFor('MI', 'township')).toBe(4);
  });

  it('measures the modal month for every state TT holds data in', () => {
    for (const [st, expected] of Object.entries(STATE_BASELINE)) {
      for (const [kind, month] of Object.entries(expected.dominant)) {
        expect(dominantMonthFor(st, kind), `${st} ${kind}`).toBe(month);
      }
      expect(buildCensus(st).size, `${st} entities`).toBe(expected.entities);
      expect(exceptions(st).length, `${st} exceptions`).toBe(expected.exceptions);
    }
  });
});

describe('the census reproduces every carve-out already established by hand', () => {
  // ⚠ A gate that cannot rediscover what you already hold is not a gate.
  it('finds the five California October cities and nothing else', () => {
    expect(exceptions('CA').map((e) => e.name).sort()).toEqual([
      'El Segundo', 'Huntington Beach', 'Inglewood', 'Long Beach', 'South Lake Tahoe',
    ]);
    for (const e of exceptions('CA')) {
      expect(fiscalExceptionFor(e.name, 'CA'), `${e.name} not declared`).toBeTruthy();
    }
  });

  // ORC § 9.34 lets an Ohio city set its own fiscal year, and Cincinnati is the
  // one that did — January through FY2012, July from FY2014. The census finds it
  // without being told, and it is Ohio's ONLY exception among 567 entities.
  it('finds Cincinnati as the sole Ohio exception', () => {
    const ex = exceptions('OH');
    expect(ex.map((e) => e.name)).toEqual(['Cincinnati']);
    expect(ex[0].changed).toBe(true);
    expect(censusMonthFor('OH', 'Cincinnati', 2010).month).toBe(1);
    expect(censusMonthFor('OH', 'Cincinnati', 2020).month).toBe(7);
  });

  it('reproduces every hand-evidenced Texas entity as October', () => {
    for (const e of TX_ESTABLISHED.filter((x) => x.name !== 'Texas')) {
      const seen = censusMonthFor('TX', e.name);
      if (seen.unknown) continue;                 // too small to file federally
      expect(seen.month, `${e.name}`).toBe(TX_MONTH);
    }
  });

  it('reproduces Leonardtown, whose charter § 703 was read by hand', () => {
    expect(MD_ENTITY.state).toBe('MD');
    expect(censusMonthFor('MD', 'Leonardtown').month).toBe(MD_MONTH);
  });

  // Utah splits by entity type — the carve-out the earlier arc found by hand.
  it('reproduces the Utah split with zero exceptions either side', () => {
    expect(exceptions('UT')).toEqual([]);
    expect(censusMonthFor('UT', 'Salt Lake County').month).toBe(1);
  });
});

describe('the states where the generalisation actually held', () => {
  // These carry TT's largest row counts, and the census confirms them rather
  // than correcting them. A measurement, not an assumption.
  it('confirms Minnesota, Massachusetts and Washington with no exceptions', () => {
    expect(exceptions('MN')).toEqual([]);
    expect(exceptions('MA')).toEqual([]);
    expect(exceptions('WA')).toEqual([]);
    expect(dominantMonthFor('MN', 'municipality')).toBe(1);   // calendar year
    expect(dominantMonthFor('MA', 'municipality')).toBe(7);   // MGL ch. 44 § 56A
    expect(dominantMonthFor('WA', 'municipality')).toBe(1);
  });

  it('confirms them entity by entity, not just in aggregate', () => {
    expect(censusMonthFor('MN', 'Minneapolis', 2020).month).toBe(1);
    expect(censusMonthFor('MN', 'Hennepin County', 2020).month).toBe(1);
    expect(censusMonthFor('MA', 'Boston', 2020).month).toBe(7);
    expect(censusMonthFor('MA', 'Cambridge', 2020).month).toBe(7);
  });
});

describe('a stub period is a fiscal-year change announcing itself', () => {
  // ⚠ The 1998-2015 half STATES a stub's length; the 2016+ half labels every
  // stub "annual", so there a changeover must be inferred from the period end.
  it('carries the explicit stub lengths from the historic half', () => {
    const tx = stubPeriods('TX');
    const fortBend = tx.find((r) => r.entity === 'Fort Bend County' && r.years.includes(2002));
    expect(fortBend.period).toBe('other');
    expect(fortBend.months).toBe(9);          // Jan-Dec -> Oct-Sep
    const corpus = tx.find((r) => r.entity === 'Corpus Christi' && r.years.includes(2014));
    expect(corpus.months).toBe(14);           // Aug-Jul -> Oct-Sep
    // A stub never enters month inference: its end is on the new calendar but
    // its start is on the old one.
    expect(buildCensus('TX').get('Fort Bend County').byMonth.get(10)).not.toContain(2002);
  });

  it('refuses to answer in a changeover year rather than guessing', () => {
    expect(changeoverYears(buildCensus('OH').get('Cincinnati'))).toEqual([2014]);
    expect(censusMonthFor('OH', 'Cincinnati', 2014).unknown).toMatch(/CHANGEOVER/);
  });

  // Huntington Beach FY2018 is the nine-month stub that still BEGINS in October,
  // so the registry holds 10 where the census would infer 7.
  it('leaves the changeover year to the document, and the registry holds it', () => {
    expect(changeoverYears(buildCensus('CA').get('Huntington Beach'))).toEqual([2018]);
    expect(monthForEntry(fiscalExceptionFor('Huntington Beach', 'CA'), 2018).month).toBe(10);
  });
});

describe('censusMonthFor refuses rather than defaults', () => {
  // ⚠ "Unknown" must never collapse into the state's usual month — that is the
  // assumption this whole arc exists to stop. Nationally, most small towns never
  // file at all.
  it('reports absence as unknown, naming why', () => {
    const r = censusMonthFor('TX', 'Nonexistent Ville');
    expect(r.month).toBeUndefined();
    expect(r.unknown).toMatch(/filed no Single Audit/);
    expect(r.unknown).toMatch(/Absence is not evidence/);
  });

  it('does not extrapolate outside the audited years', () => {
    const r = censusMonthFor('TX', 'Houston', 1990);
    expect(r.unknown).toMatch(/outside the audited years/);
    expect(r.unknown).toMatch(/does not extrapolate/);
  });

  it('refuses an unparseable fiscal year, and an unknown state', () => {
    expect(censusMonthFor('MD', 'Leonardtown', 'soon').unknown).toMatch(/unparseable/);
    expect(censusMonthFor('ZZ', 'Anywhere').unknown).toMatch(/no census for ZZ/);
  });

  // One filing is not a calendar — this is where the residual noise sits: a
  // government whose entire history is mailed from the next state, and one-off
  // transcription errors like Delano's lone 2008-12-31.
  it('will not call a single-year entity exceptional', () => {
    for (const st of states()) {
      for (const e of exceptions(st)) {
        const total = e.months.reduce((n, m) => n + m.years.length, 0);
        expect(total, `${st} ${e.name}`).toBeGreaterThan(1);
      }
    }
  });
});

describe('censusGuard — the second opinion a loader gets', () => {
  it('refuses a month that contradicts the entity\'s own filings', () => {
    const r = censusGuard('Houston', 'TX', 10, 2020);
    expect(r.error).toMatch(/contradicts the federal audit record for Houston, TX in FY2020/);
    expect(r.error).toMatch(/month 7/);
    expect(r.error).toMatch(/fac-local-fiscal-year-ends\.csv/);
  });

  it('accepts a month that agrees', () => {
    expect(censusGuard('Houston', 'TX', 7, 2020)).toMatchObject({ ok: true, month: 7 });
    expect(censusGuard('Minneapolis', 'MN', 1, 2020)).toMatchObject({ ok: true, month: 1 });
    expect(censusGuard('Boston', 'MA', 7, 2020)).toMatchObject({ ok: true, month: 7 });
  });

  // Silence is not disagreement — the census must never block a load merely
  // because it has nothing to say, or new entities become unloadable.
  it('stays silent where it has no evidence', () => {
    expect(censusGuard('Nowhere Ville', 'TX', 10, 2020).ok).toBe(true);
    expect(censusGuard('Houston', 'TX', 10, 1990).ok).toBe(true);
    expect(censusGuard('Anywhere', 'ZZ', 7, 2020).ok).toBe(true);
    expect(censusGuard('Houston', 'TX', undefined, 2020).ok).toBe(true);
  });

  it('would have refused the July that was wrong for the CA October cities', () => {
    expect(censusGuard('South Lake Tahoe', 'CA', 7, 2020).error).toMatch(/month 10/);
    expect(censusGuard('El Segundo', 'CA', 7, 2010).error).toMatch(/month 10/);
    expect(censusGuard('South Lake Tahoe', 'CA', 10, 2020).ok).toBe(true);
  });
});
