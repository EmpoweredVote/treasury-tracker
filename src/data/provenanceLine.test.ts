import { describe, it, expect } from 'vitest';
import { citationLine, NO_PUBLISHER, publisherLabel } from './provenanceLine';

/**
 * AUDIT-GRADE §5.2 — the quiet citation under each chart.
 *
 * Chris: "we should only share the information with how we sourced it and our
 * confidence in that source." The reader this is for is a journalist deciding
 * whether they can cite a number — and the test case that decided the design is
 * a figure read off a bar, screenshotted on its own. A chart that travels
 * without its source is the gap this closes.
 */
describe('citationLine', () => {
  it('reads as a printed figure’s source line', () => {
    expect(citationLine({
      grade: 'self_reported_unaudited',
      scope: 'all_funds',
      publisher: 'CA State Controller',
      period: '2025',
    })).toBe('Government-reported · All Funds · CA State Controller · FY 2025');
  });

  /**
   * ⚠⚠ 16,997 statement rows carry NO publisher the API will return — 16,816 of
   * them Massachusetts DLS, across 351 towns (measured 2026-10-30, spec D5).
   * `treasuryService.mapBudget` returns `data_source_info: null` unless a row has
   * data_source AND source_url AND source_date, and source_date is null on every
   * one of them, so both existing surfaces render NOTHING at all.
   *
   * Silence is worse than a broken link: nothing signals that the provenance is
   * missing. The line says so in words instead, and the data repair is its own
   * piece of work.
   */
  it('says the source is not recorded rather than leaving a gap', () => {
    const line = citationLine({
      grade: 'unknown', scope: 'unknown', publisher: null, period: '2024',
    });
    expect(line).toContain(NO_PUBLISHER);
    expect(line).toBe('Audit status not established · Scope not established · source not recorded · FY 2024');
  });

  it('treats an empty publisher exactly as a missing one', () => {
    expect(citationLine({
      grade: 'audited_gaap', scope: 'general_fund', publisher: '   ', period: '2023',
    })).toContain(NO_PUBLISHER);
  });

  // ⚠ Never two separators in a row, and never one trailing. A line that ends
  // "· " tells a reader something was dropped.
  it('never renders an empty segment', () => {
    for (const publisher of [null, '', 'Real Publisher']) {
      const line = citationLine({
        grade: 'unknown', scope: 'unknown', publisher, period: '2020',
      });
      expect(line).not.toMatch(/·\s*·/);
      expect(line.trim()).not.toMatch(/·$/);
      expect(line.trim()).not.toMatch(/^·/);
    }
  });

  /**
   * ⚠ The period is rendered through parsePeriod, never formatted a second time
   * here. The FY1976 Transition Quarter is a real period in this database — it
   * is synthesised from a `period_label` row — and a citation reading "FY 1976"
   * over a three-month figure would be wrong in the one place it matters.
   */
  it('names the period the page is showing, in the app’s own words', () => {
    expect(citationLine({
      grade: 'audited_gaap', scope: 'general_fund', publisher: 'City ACFR', period: '1976-TQ',
    })).toBe('Independently audited · General Fund · City ACFR · Transition Q 1976');
  });

  /**
   * A payroll surface states what the record IS, and must not confess to a gap
   * on ANY axis.
   *
   * ⚠⚠ The first version of this line stopped confessing on the grade and
   * immediately re-confessed on the scope: every salaries row is fund_scope
   * `unknown`, so it read "Not a financial statement · Scope not established ·
   * …". "Which funds does this cover" is not an unanswered question about a
   * payroll roster, it is an inapplicable one (#198). The scope segment is
   * dropped, not blanked.
   */
  it('drops the scope segment on a record that is not a financial statement', () => {
    const line = citationLine({
      grade: 'not_applicable', scope: 'unknown', publisher: 'LA City Payroll', period: '2024',
    });
    expect(line).toBe('Not a financial statement · LA City Payroll · FY 2024');
    expect(line).not.toMatch(/not (yet )?establish/i);
    expect(line).not.toMatch(/·\s*·/);
  });

  // ⚠ An API build predating either column omits it. Absent reads `unknown` on
  // both axes — never a grade, never a scope — the same direction the
  // normalisers take, asserted here because the call sites pass optional fields.
  it('reads an absent grade or scope as unknown, never as a claim', () => {
    expect(citationLine({
      grade: null, scope: undefined, publisher: 'Somewhere', period: '2022',
    })).toBe('Audit status not established · Scope not established · Somewhere · FY 2022');
  });

  // ⚠ The scope is dropped ONLY for that value. A statement row with an
  // unestablished scope must still say so — that gap is real and is ours.
  it('still states an unestablished scope on a financial statement', () => {
    expect(citationLine({
      grade: 'unknown', scope: 'unknown', publisher: 'Somewhere', period: '2024',
    })).toContain('Scope not established');
  });
});

/**
 * ⭐⭐ The audited series shipped 2026-10-31 made this unreadable. The citation
 * under an LA General Fund chart read, at 76 characters in one segment:
 *
 *   Independently audited · General Fund ·
 *     Los Angeles ACFR — General Fund Revenue by Source (FY2025 actual, GAAP basis)
 *     · FY 2025
 *
 * "General Fund" twice, the year twice, and the publisher — the City of Los
 * Angeles — never actually named, because `data_source` is not reader copy. It
 * is a MACHINE KEY: four registries regex-match it and the live-sync exclusion
 * joins on it by name, so the string itself must never be rewritten.
 *
 * ⭐ THE CONVENTION IS REAL AND WAS MEASURED, not guessed. Across every loader
 * registry the shape is `<document> — <face/scope> <dataset> (<FY>, <basis>)`.
 * Everything after the em dash is a per-row descriptor the citation already
 * states in its own segments. Everything before it is the document a reader
 * would cite.
 *
 * ⚠ AN ASCII HYPHEN IS NOT AN EM DASH and must not cut: `CA State Controller -
 * Expenditures` is one name, and hyphens appear inside real publisher names.
 */
describe('publisherLabel', () => {
  it('cites the document, not the row descriptor after the em dash', () => {
    expect(publisherLabel('Los Angeles ACFR — General Fund Revenue by Source (FY2025 actual, GAAP basis)'))
      .toBe('Los Angeles ACFR');
  });

  it('leaves a name containing an ASCII hyphen alone', () => {
    expect(publisherLabel('CA State Controller - Expenditures'))
      .toBe('CA State Controller - Expenditures');
  });

  it('leaves a name with no descriptor alone', () => {
    expect(publisherLabel('Minnesota Office of the State Auditor'))
      .toBe('Minnesota Office of the State Auditor');
  });

  it('cuts at the FIRST em dash when a descriptor carries another', () => {
    expect(publisherLabel('New York OSC Town Annual Financial Report — Revenues, General Fund (FY2019 actual, self-reported)'))
      .toBe('New York OSC Town Annual Financial Report');
  });

  // ⚠ Never return an empty segment: an empty publisher renders a doubled
  // separator, which tells a reader something was dropped and not what.
  it('keeps the whole string when cutting would leave nothing', () => {
    expect(publisherLabel('— General Fund Revenue by Source')).toBe('— General Fund Revenue by Source');
  });

  it('still reports the finding when there is no publisher at all', () => {
    expect(publisherLabel(null)).toBe(NO_PUBLISHER);
    expect(publisherLabel('   ')).toBe(NO_PUBLISHER);
  });
});

describe('citationLine with a long document name', () => {
  it('says General Fund once and the year once', () => {
    const line = citationLine({
      grade: 'audited_gaap',
      scope: 'general_fund',
      publisher: 'Los Angeles ACFR — General Fund Revenue by Source (FY2025 actual, GAAP basis)',
      period: '2025',
    });
    expect(line).toBe('Independently audited · General Fund · Los Angeles ACFR · FY 2025');
    expect(line.match(/General Fund/g)).toHaveLength(1);
    expect(line.match(/2025/g)).toHaveLength(1);
  });
});
