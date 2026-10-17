// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import FigureFlagBanner from './FigureFlagBanner';
import { figureFlagFor } from '../data/figureFlags';

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

  const mount = (entity: string, year: number) => {
    const flag = figureFlagFor(entity, 'GA', year, 'operating');
    expect(flag, `no flag fixture for ${entity} ${year}`).toBeTruthy();
    act(() => { root.render(createElement(FigureFlagBanner, { flag: flag!, label: `${entity} ${year}` })); });
  };

  it('⚠⚠ shows the warning and the “as filed” assurance before any interaction', () => {
    mount('Fulton County', 2021);
    const note = host.querySelector('[role="note"]');
    expect(note).toBeTruthy();
    const text = host.textContent ?? '';
    // The headline and the reassurance are both unconditional.
    expect(text).toMatch(/almost entirely missing/i);
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
    const themed = classes.filter((c) => /^(bg|text|border)-ev-yellow/.test(c));
    expect(themed.length).toBeGreaterThan(0);
    for (const c of themed) {
      // ev-yellow-50 would be silently dropped; the token is ev-yellow-050.
      expect(c, `${c} uses a non-existent numeric step`).not.toMatch(/-ev-yellow-\d{1,2}$/);
    }
    const darkPairs = classes.filter((c) => c.startsWith('dark:'));
    expect(darkPairs.length, 'no dark-mode colours declared').toBeGreaterThan(0);
  });
});
