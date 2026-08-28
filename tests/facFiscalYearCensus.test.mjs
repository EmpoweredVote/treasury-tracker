import { describe, it, expect } from 'vitest';
import {
  STATES, WINDOW, readEvidence, buildCensus, exceptions, changeoverYears, censusMonthFor, censusGuard,
} from '../scripts/lib/facFiscalYearCensus.mjs';
import { ESTABLISHED as TX_ESTABLISHED, PROTECTED_ENTITIES as TX_PROTECTED, CORRECT_MONTH as TX_MONTH }
  from '../scripts/lib/txLocalFiscalCalendars.mjs';
import { ENTITY as MD_ENTITY, CORRECT_MONTH as MD_MONTH } from '../scripts/lib/leonardtownFiscalCalendar.mjs';

const CENSUS = Object.fromEntries(Object.keys(STATES).map((s) => [s, buildCensus(s)]));

describe.each(Object.keys(STATES))('%s census', (state) => {
  const cfg = STATES[state];
  const census = CENSUS[state];

  it('is the size it was when the census was built', () => {
    expect(readEvidence(state).length).toBe(cfg.baseline.records);
    expect(census.size).toBe(cfg.baseline.entities);
    expect(exceptions(state, census).length).toBe(cfg.baseline.exceptions);
  });

  it('covers only audit years inside the window', () => {
    const years = readEvidence(state).map((r) => r.auditYear);
    expect(Math.min(...years)).toBeGreaterThanOrEqual(WINDOW.firstAuditYear);
    expect(Math.max(...years)).toBeLessThanOrEqual(WINDOW.lastAuditYear);
  });

  it('holds only the entity kinds that state censuses', () => {
    for (const e of census.values()) expect(cfg.kinds).toContain(e.kind);
  });

  it('carries no institution masquerading as a government', () => {
    for (const name of census.keys()) {
      expect(name, `${name} looks like an institution, not a general-purpose government`)
        .not.toMatch(/authority|commission|district|department|housing|school|hospital/i);
    }
  });
});

describe('Texas: the October generalisation is mostly true and therefore dangerous', () => {
  const census = CENSUS.TX;
  const ex = exceptions('TX', census);

  // ⚠ A gate that cannot rediscover what you already hold is not a gate. Every
  // Texas entity in ESTABLISHED was evidenced by hand from its own budget or
  // ACFR during onboarding (PR #71). The census must reproduce all of them.
  it('reproduces every hand-evidenced TX entity as October', () => {
    const local = TX_ESTABLISHED.filter((e) => e.name !== 'Texas');
    expect(local.length).toBeGreaterThanOrEqual(14);
    for (const e of local) {
      const seen = censusMonthFor('TX', e.name);
      // Some are too small to file federally; absence is allowed, disagreement is not.
      if (seen.unknown) continue;
      expect(seen.month, `${e.name}: hand-read evidence says ${TX_MONTH}, census says ${seen.month}`)
        .toBe(TX_MONTH);
    }
  });

  it('reproduces Austin and Travis County, which are protected from re-stamping', () => {
    for (const name of ['Austin', 'Travis County']) {
      expect(censusMonthFor('TX', name).month).toBe(10);
    }
    expect(TX_PROTECTED.find((p) => p.name === 'Travis County').month).toBe(10);
  });

  // ⚠⚠ THE POINT OF CENSUSING TEXAS. 581 of 647 entities are October, so the
  // default is right often enough to feel safe — and it is wrong for the state's
  // 2nd and 6th largest cities. Onboarding either one on the state default would
  // put its period out by 3-9 months, and no tie test would notice, because this
  // column moves no dollar.
  it('finds the big TX cities that are NOT October', () => {
    expect(censusMonthFor('TX', 'Houston').month).toBe(7);     // July-June
    expect(censusMonthFor('TX', 'El Paso').month).toBe(9);     // September-August
    expect(censusMonthFor('TX', 'El Paso County').month).toBe(10);  // the COUNTY is October
  });

  it('finds the January counties, which are a whole class and not a stray', () => {
    const january = ex.filter((e) => e.months.every((m) => m.month === 1));
    expect(january.length).toBeGreaterThan(30);
    for (const name of ['Aransas County', 'Matagorda County', 'Washington County']) {
      expect(censusMonthFor('TX', name).month, name).toBe(1);
    }
  });

  // Harris County — the largest county in Texas — ran a MARCH fiscal year
  // through FY2022 and moved to October in FY2023.
  it('finds Harris County changing from March to October', () => {
    const harris = census.get('Harris County');
    expect(harris).toBeTruthy();
    expect(changeoverYears(harris)).toEqual([2023]);
    expect(censusMonthFor('TX', 'Harris County', 2020).month).toBe(3);
    expect(censusMonthFor('TX', 'Harris County', 2024).month).toBe(10);
  });

  it('refuses to answer in a changeover year rather than guessing', () => {
    const r = censusMonthFor('TX', 'Harris County', 2023);
    expect(r.month).toBeUndefined();
    expect(r.unknown).toMatch(/CHANGEOVER/);
  });
});

describe('Maryland: the generalisation held, and that is a measurement', () => {
  it('finds every observed MD local government on a July calendar', () => {
    expect(exceptions('MD', CENSUS.MD)).toEqual([]);
    expect(CENSUS.MD.size).toBe(STATES.MD.baseline.entities);
  });

  // Leonardtown's charter § 703 was read by hand in PR #81. The census agrees.
  it('reproduces Leonardtown, whose charter was read by hand', () => {
    expect(MD_ENTITY).toEqual({ name: 'Leonardtown', state: 'MD' });
    const seen = censusMonthFor('MD', 'Leonardtown');
    expect(seen.month, 'census disagrees with Leonardtown charter § 703').toBe(MD_MONTH);
  });

  it('covers Maryland counties, which carry the state\'s local spending', () => {
    const counties = [...CENSUS.MD.values()].filter((e) => e.kind === 'county');
    expect(counties.length).toBeGreaterThanOrEqual(20);
    for (const name of ['Montgomery County', 'Baltimore County', "Prince George's County"]) {
      expect(censusMonthFor('MD', name).month, name).toBe(7);
    }
  });
});

describe('censusMonthFor refuses rather than defaults', () => {
  // ⚠ THE WHOLE POINT. "Unknown" must never collapse into the state default —
  // that is the assumption this arc exists to stop.
  it('reports absence as unknown, naming why, not as the dominant month', () => {
    const r = censusMonthFor('TX', 'Nonexistent Ville');
    expect(r.month).toBeUndefined();
    expect(r.unknown).toMatch(/filed no Single Audit/);
    expect(r.unknown).toMatch(/Absence is not evidence/);
  });

  it('does not extrapolate outside the audited years', () => {
    const r = censusMonthFor('TX', 'Houston', 2004);
    expect(r.month).toBeUndefined();
    expect(r.unknown).toMatch(/outside the audited years/);
    expect(r.unknown).toMatch(/does not extrapolate/);
  });

  it('refuses an unparseable fiscal year', () => {
    expect(censusMonthFor('MD', 'Leonardtown', 'soon').unknown).toMatch(/unparseable/);
  });

  it('throws for a state with no census rather than returning nothing', () => {
    expect(() => readEvidence('ZZ')).toThrow(/no census configured/);
  });
});

describe('censusGuard — the second opinion a loader gets', () => {
  // ⚠⚠ THE FAILURE IT EXISTS TO STOP. A loader takes ONE month for a whole
  // multi-entity run. `10` is right for 581 of 647 Texas entities and wrong for
  // Houston — and nothing would fail, because the column moves no dollar.
  it('refuses a month that contradicts the entity\'s own audit filings', () => {
    const r = censusGuard('Houston', 'TX', 10, 2020);
    expect(r.ok).toBeUndefined();
    expect(r.error).toMatch(/contradicts the federal audit record for Houston, TX in FY2020/);
    expect(r.error).toMatch(/month 7/);
    expect(r.error).toMatch(/fac-tx-local-fiscal-year-ends\.csv/);
  });

  it('accepts a month that agrees', () => {
    expect(censusGuard('Houston', 'TX', 7, 2020)).toMatchObject({ ok: true, month: 7 });
    expect(censusGuard('Travis County', 'TX', 10, 2020)).toMatchObject({ ok: true, month: 10 });
    expect(censusGuard('Leonardtown', 'MD', 7)).toMatchObject({ ok: true, month: 7 });
  });

  // Silence is not disagreement. The census must never block a load merely
  // because it has nothing to say — that would make new entities unloadable.
  it('stays silent where it has no evidence', () => {
    expect(censusGuard('Nowhere Ville', 'TX', 10, 2020).ok).toBe(true);
    expect(censusGuard('Houston', 'TX', 10, 2004).ok).toBe(true);   // before the window
    expect(censusGuard('Anytown', 'WA', 7, 2020).ok).toBe(true);    // no census for WA
    expect(censusGuard('Houston', 'TX', undefined, 2020).ok).toBe(true);
  });

  // The CA cities PR #101 corrected must now be defended from the other side:
  // an operator passing the state default would be refused.
  it('would have refused the July that was wrong for the CA October cities', () => {
    expect(censusGuard('South Lake Tahoe', 'CA', 7, 2020).error).toMatch(/month 10/);
    expect(censusGuard('El Segundo', 'CA', 7, 2020).error).toMatch(/month 10/);
    expect(censusGuard('South Lake Tahoe', 'CA', 10, 2020).ok).toBe(true);
  });
});
