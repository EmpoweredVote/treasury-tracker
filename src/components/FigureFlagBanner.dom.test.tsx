// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import FigureFlagBanner from './FigureFlagBanner';
import { figureFlagFor } from '../data/figureFlags';
import {
  ABSENT_MONTH_YEARS,
  FISCAL_PERIOD_DISTORTION_YEARS,
  PERIOD_MEASURED_ON,
} from '../data/figureFlagRules';
import { formatMoneyProse } from '../utils/formatMoney';

/**
 * ⚠⚠ THE WARNING MUST BE VISIBLE WITHOUT A CLICK.
 *
 * That is the entire point of this component, and it is the one property a
 * data test cannot check. A flag the reader has to open is a flag the reader
 * does not read, which is indistinguishable from not flagging at all — the
 * failure this whole surfacing exists to end.
 *
 * ⚠ jsdom does NO LAYOUT, so this asserts presence and disclosure state, never
 * geometry.
 */
describe('FigureFlagBanner', () => {
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

  const mount = (entity: string, year: number, dataset = 'operating', state = 'GA') => {
    const flag = figureFlagFor(entity, state, year, dataset);
    expect(flag, `no flag fixture for ${entity} ${year}`).toBeTruthy();
    act(() => { root.render(createElement(FigureFlagBanner, { flag: flag!, label: `${entity} ${year}` })); });
  };

  /**
   * ⚠⚠ A PERIOD FLAG ON THE PAYMENTS VIEW, which is a path nothing else here
   * covers: every other flag is a Georgia filed-form figure on `operating` or
   * `revenue`. McKinney's is the first keyed to `transactions`, so this proves
   * the dataset reaches the component at all — and that the absent month and
   * the "as published" assurance are both on screen without a click.
   *
   * ⚠ THE COPY IS GENERATED NOW, so this asserts against the REGISTER rather
   * than against remembered wording. The old version matched /eleven months/i,
   * which was the hand-written phrasing; the rule says "11 of 12 months", and a
   * test pinned to a number that is supposed to change is a test that fails the
   * day the rule does its job.
   */
  it('⚠⚠ renders the absent-month period flag on the payments view', () => {
    const row = ABSENT_MONTH_YEARS.find((r) => r.entity === 'McKinney' && r.fiscalYear === 2026);
    expect(row, 'McKinney FY2026 is no longer measured as incomplete').toBeTruthy();
    mount('McKinney', 2026, 'transactions', 'TX');
    const note = host.querySelector('[role="note"]');
    expect(note).toBeTruthy();
    const text = host.textContent ?? '';
    expect(text).toMatch(new RegExp(`${row!.monthsCovered} of ${row!.monthsInPeriod} months`));
    for (const month of row!.absentMonths) expect(text).toContain(month);
    // The reader must be able to tell TT did not alter the number.
    expect(text).toMatch(/as published/i);
  });

  /**
   * ⚠⚠⚠ THE AS-OF DATE MUST BE VISIBLE WITHOUT A CLICK.
   *
   * West Hollywood FY2026 is the one flag whose subject still grows — the file
   * is synced weekly and the city is still posting into it. A date buried in
   * the evidence panel protects nobody: the reader who misreads a stale figure
   * is precisely the one who never opens it.
   *
   * ⚠⚠ THE DATE IS READ FROM THE REGISTER, NOT TYPED. It moves every time the
   * rule is re-measured, and the previous version of this test hard-coded
   * "8 November 2026" — the same defect the banner itself was built to avoid,
   * one layer out.
   */
  it('⚠⚠ shows the as-of date for a still-growing figure before any interaction', () => {
    const row = FISCAL_PERIOD_DISTORTION_YEARS
      .find((r) => r.entity === 'West Hollywood' && r.fiscalYear === 2026);
    expect(row?.stillGrowing, 'WeHo FY2026 is no longer measured as still growing').toBe(true);
    mount('West Hollywood', 2026, 'transactions', 'CA');
    const note = host.querySelector('[role="note"]');
    expect(note).toBeTruthy();
    // ⚠ Read from the always-visible note, not from the whole host, so copy
    // hidden behind the disclosure cannot satisfy this.
    const visible = note?.textContent ?? '';
    const [y, m, d] = PERIOD_MEASURED_ON.split('-').map(Number);
    const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'][m - 1];
    expect(visible).toContain(`as of ${d} ${month} ${y}`);
    expect(visible).toMatch(/still adding|still posting|rise|grow/i);
  });

  /**
   * ⚠⚠ THE RECEIVING SIDE OF A SEAM. FY2025 is clean in itself and still
   * carries a banner, because the money paid during it sits in the files
   * either side. If this ever stops rendering, a reader sees $132M beside
   * $249M and concludes spending halved.
   *
   * ⭐ THE FIGURE WENT UP WHEN THE RULE REPLACED THE ENTRY, and that is the
   * rule being better rather than different. The hand-written banner said
   * $68.5M, counting only what sits in FY2024. The rule asks where ALL the
   * money paid during FY2025 ended up and finds $77.4M, across FY2024 AND
   * FY2026 — the second neighbour nobody had added up by hand.
   */
  it('⚠⚠ renders on the clean side of a two-year seam', () => {
    const row = FISCAL_PERIOD_DISTORTION_YEARS
      .find((r) => r.entity === 'West Hollywood' && r.fiscalYear === 2025);
    expect(row?.axis, 'WeHo FY2025 is flagged for its own rows, not as a receiver').toBe('displaced');
    expect(row!.elsewhereYears.length, 'the second neighbour is no longer counted')
      .toBeGreaterThan(1);
    mount('West Hollywood', 2025, 'transactions', 'CA');
    const text = host.textContent ?? '';
    for (const fy of row!.elsewhereYears) expect(text).toContain(`FY${fy}`);
    expect(text).toContain(formatMoneyProse(row!.elsewhereAmount));
    expect(text).toMatch(/as published/i);
  });

  it('⚠⚠ shows the warning and the “as filed” assurance before any interaction', () => {
    mount('Fulton County', 2021);
    const note = host.querySelector('[role="note"]');
    expect(note).toBeTruthy();
    const text = host.textContent ?? '';
    // The headline and the reassurance are both unconditional.
    expect(text).toMatch(/covers almost none of/i);
    expect(text).toMatch(/Shown exactly as filed/i);
    // ⚠ role=note, never role=alert — standing context, not an interruption.
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the evidence collapsed until asked, then reveals it', () => {
    mount('Fulton County', 2021);
    const button = host.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    // The detailed control total is NOT in the DOM while collapsed.
    expect(host.textContent).not.toMatch(/budget-to-actual schedule/i);

    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(host.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toMatch(/budget-to-actual schedule/i);
    // Every revealed entry carries its source.
    expect(host.textContent).toMatch(/Fulton County, Georgia — 2021 Annual Comprehensive Financial Report/);
  });

  it('⚠ the disclosure button controls the panel it names, for screen readers', () => {
    mount('DeKalb County', 2018);
    const button = host.querySelector('button')!;
    const controls = button.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    // ⚠ Attribute selector, not CSS.escape — jsdom here does not expose it.
    expect(host.querySelector(`[id="${controls}"]`)).toBeNull(); // collapsed
    act(() => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(host.querySelector(`[id="${controls}"]`)).toBeTruthy();
  });

  it('⚠⚠ never renders a bare Tailwind token that does not exist', () => {
    // A bad colour class is DROPPED SILENTLY and the element renders unstyled.
    // ev-yellow has NO dark-mode override, so every colour must be a light/dark
    // PAIR — a `dark:` sibling for each themed colour utility.
    mount('Fulton County', 2021);
    const classes = [...host.querySelectorAll('*')]
      .flatMap((el) => [...el.classList]);
    const themed = classes.filter((c) => /^(bg|text|border)-ev-skyblue/.test(c));
    expect(themed.length).toBeGreaterThan(0);
    for (const c of themed) {
      // ev-skyblue-50 would be silently dropped; the token is ev-skyblue-050.
      expect(c, `${c} uses a non-existent numeric step`).not.toMatch(/-ev-skyblue-\d{1,2}$/);
    }
    const darkPairs = classes.filter((c) => c.startsWith('dark:'));
    expect(darkPairs.length, 'no dark-mode colours declared').toBeGreaterThan(0);
  });

  it('⚠⚠ NO severity renders a warning triangle or alarm styling', () => {
    // CONTEXT, NOT A VERDICT. One calm treatment for every severity. TT is not
    // the auditor, and Fulton FY2017 showed a figure can look broken and be a
    // court-ordered delay.
    for (const [entity, year, dataset] of [
      ['DeKalb County', 2018, 'operating'],
      ['Fulton County', 2021, 'operating'],
      ['Fulton County', 2017, 'revenue'],
    ] as const) {
      act(() => { root.render(createElement(FigureFlagBanner, {
        flag: figureFlagFor(entity, 'GA', year, dataset)!,
      })); });
      const text = host.textContent ?? '';
      expect(text, `${entity} ${year}`).toMatch(/ⓘ/);        // informational glyph
      expect(text, `${entity} ${year}`).not.toMatch(/⚠/);    // never the warning triangle
      expect(host.querySelector('[role="note"]')?.getAttribute('aria-label'))
        .toMatch(/About this figure/);
      // ⚠ Calm is not quiet: the actionable line is always rendered.
      expect(text).toMatch(/Shown exactly as filed|the figures are right/);
    }
  });

  it('⚠ renders the actionable line, not just the problem', () => {
    mount('DeKalb County', 2018);
    expect(host.textContent).toMatch(/use the county.s own annual financial report/i);
    mount('Fulton County', 2017, 'revenue');
    expect(host.textContent).toMatch(/Take 2017 and 2018 together/i);
  });

  it('⚠ both sides of the seam render, each pointing at the other year', () => {
    mount('Fulton County', 2017, 'revenue');
    expect(host.textContent).toMatch(/into 2018/);
    act(() => { root.render(createElement(FigureFlagBanner, {
      flag: figureFlagFor('Fulton County', 'GA', 2018, 'revenue')!,
    })); });
    expect(host.textContent).toMatch(/late 2017 tax/);
  });
});
