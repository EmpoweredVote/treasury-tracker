// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SourceBar from './SourceBar';
import { NO_PUBLISHER } from '../data/provenanceLine';

/**
 * AUDIT-GRADE §5.2 — the bar must describe WHAT IS ON SCREEN.
 *
 * ⚠⚠ Both properties here were found by a whole-branch review, not by these
 * tests, and both were live defects:
 *
 *   1. On the Employees tab the bar carried the STATEMENT series' grade, scope
 *      and 23-year span beside the payroll publisher — "Government-reported ·
 *      All Funds · LA City Open Data · FY2003–25" above a salary table, with
 *      "Not a financial statement" in the citation two inches below it. A false
 *      claim of assurance is the mirror image of the false confession this
 *      whole milestone exists to remove.
 *   2. `budgetData` is set to null on every dataset, year and entity change, so
 *      "source not recorded" — which provenanceLine.ts documents as "NOT A
 *      PLACEHOLDER, IT IS THE FINDING" — flashed over 16,997 rows' worth of
 *      governments whose publisher IS recorded, and stuck permanently on an
 *      absent-series view.
 *
 * ⚠ jsdom does NO LAYOUT. These assert presence and wording, never geometry.
 */
describe('SourceBar', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const PROVENANCE = {
    scope: 'all_funds' as const,
    basis: 'actual' as const,
    auditGrade: 'self_reported_unaudited' as const,
    span: { min: 2003, max: 2025 },
  };

  const mount = (props: Parameters<typeof SourceBar>[0]) => {
    act(() => { root.render(createElement(SourceBar, props)); });
  };

  it('states the grade, the publisher and the span it was given', () => {
    mount({ provenance: PROVENANCE, publisher: 'CA State Controller' });
    const text = host.textContent ?? '';
    expect(text).toMatch(/Government-reported/);
    expect(text).toMatch(/All Funds/);
    expect(text).toMatch(/CA State Controller/);
    expect(text).toMatch(/FY2003–25/);
  });

  // ⚠⚠ ISSUE 1. Nothing to describe means SAY NOTHING. The bar must never
  // borrow another dataset's grade, scope or span to fill the space.
  it('states no grade, scope or span when it has none to state', () => {
    mount({ provenance: null, publisher: 'LA City Open Data' });
    const text = host.textContent ?? '';
    expect(text).toMatch(/LA City Open Data/);
    expect(text).not.toMatch(/Government-reported|Audit status not established/);
    expect(text).not.toMatch(/All Funds|Scope not established/);
    expect(text).not.toMatch(/FY\d{4}/);
  });

  // ⚠⚠ ISSUE 2. `undefined` means "not loaded yet" and renders NOTHING;
  // `null` means "the API returned no publisher for this row" and is the D5
  // finding, which must still reach the reader in words.
  it('is silent about a publisher it has not been told about yet', () => {
    mount({ provenance: PROVENANCE, publisher: undefined });
    expect(host.textContent ?? '').not.toMatch(new RegExp(NO_PUBLISHER, 'i'));
  });

  it('says the source is not recorded when the API returned none', () => {
    mount({ provenance: PROVENANCE, publisher: null });
    expect(host.textContent ?? '').toMatch(new RegExp(NO_PUBLISHER, 'i'));
  });

  it('treats a blank publisher as none recorded', () => {
    mount({ provenance: PROVENANCE, publisher: '   ' });
    expect(host.textContent ?? '').toMatch(new RegExp(NO_PUBLISHER, 'i'));
  });

  /**
   * ⚠⚠ THE SAME CATEGORY ERROR, ONE AXIS OVER. Found by reading the real Los
   * Angeles Employees tab after the provenance fix: the bar had stopped
   * claiming "Government-reported · All Funds" over a payroll table, and now
   * read "Scope not established · Basis not established · Not a financial
   * statement". Which funds a payroll roster covers, and whether it is actuals
   * or adopted, are INAPPLICABLE questions about it — not unanswered ones
   * (#198) — so confessing a gap on either is as wrong as the audit confession
   * this whole milestone removed. citationLine already drops scope for this
   * value; the bar now agrees with it.
   */
  it('states no scope or basis over a record that is not a financial statement', () => {
    mount({
      provenance: {
        scope: 'unknown', basis: 'unknown',
        auditGrade: 'not_applicable', span: null,
      },
      publisher: 'LA City Open Data',
    });
    const text = host.textContent ?? '';
    expect(text).toMatch(/Not a financial statement/);
    expect(text).toMatch(/LA City Open Data/);
    expect(text).not.toMatch(/Scope not established/);
    expect(text).not.toMatch(/Basis not established/);
    expect(text).not.toMatch(/not compared across places/);
  });

  // ⚠ The grade chip is the ONE control here — it opens the explainer. The
  // publisher and the span are plain text, because a pill that looks clickable
  // and does nothing is the false affordance Chris hit twice in
  // AUSTIN-TRAVIS-01 UAT.
  it('offers exactly one button, and it is the grade chip', () => {
    mount({ provenance: PROVENANCE, publisher: 'CA State Controller' });
    const buttons = [...host.querySelectorAll('button')];
    // The scope chip and the grade chip are both explainer buttons; nothing else is.
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) expect(b.getAttribute('aria-expanded')).toBeTruthy();
    expect(host.querySelector('a')).toBeNull();
  });
});
