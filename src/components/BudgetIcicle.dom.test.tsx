// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import BudgetIcicle from './BudgetIcicle';
import { sortCategoriesByAmount } from '../data/sortCategories';
import {
  NYC_CURRENT_OPERATIONS,
  NYC_CURRENT_OPERATIONS_TOTAL,
  NYC_DEBT_SERVICE,
  nycCurrentOperationsNode,
} from '../data/__fixtures__/nycCurrentOperations';

/**
 * ⚠⚠ THE FIRST MOUNTED-COMPONENT TEST IN THIS REPO. `jsdom` and the
 * `src/**‍/*.test.tsx` glob were added on 2026-10-10 so this could exist.
 *
 * ── WHY IT HAD TO ───────────────────────────────────────────────────────────
 *
 * The label floor is now a PIXEL floor: `useElementWidth` measures the chart
 * and `canFitLabel` compares a segment's measured width against it. The RULE is
 * a pure function with its own tests. The WIRING is not testable by any other
 * means available here:
 *
 *   • `renderToStaticMarkup` runs no effects and attaches no refs, so it always
 *     renders the unmeasured fallback and would pass whether the ref were
 *     attached to the chart, to the wrong element, or to nothing at all;
 *   • the browser probe that verified it on 2026-10-10 lives in a scratchpad
 *     and runs nowhere.
 *
 * So the one way the measurement could silently stop reaching the chart — a ref
 * coming unstuck in a refactor — had no gate. This is that gate, and `npm test`
 * runs it in CI.
 *
 * ── ⚠ WHAT jsdom CANNOT DO ──────────────────────────────────────────────────
 *
 * jsdom performs NO LAYOUT. `getBoundingClientRect` returns zeros for every
 * element, and `ResizeObserver` does not exist. Both are stubbed below with
 * known values, which is the honest shape of this test: it asserts that a
 * measurement REACHES the label decision and changes it, NOT that the browser
 * measures the chart correctly. The real geometry is checked by driving a real
 * page — see `local-ui-verify-workflow`.
 */

/** ⚠ ALL FIFTEEN functions — an abridged level moves every pixel width. */
const FUNCTIONS = sortCategoriesByAmount(NYC_CURRENT_OPERATIONS);
const TOTAL = NYC_CURRENT_OPERATIONS_TOTAL;
const currentOps = nycCurrentOperationsNode(FUNCTIONS);

/**
 * jsdom implements no `matchMedia`, so the component's `sm` query cannot be
 * asked and falls back to INTERACTIVE. `atWidth` installs a stub so the mobile
 * branch can be exercised.
 */
function stubMatchMedia(viewportPx: number) {
  (globalThis as Record<string, unknown>).matchMedia = (q: string) => {
    const m = /min-width:\s*(\d+)px/.exec(q);
    return {
      matches: m ? viewportPx >= Number(m[1]) : false,
      media: q,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, onchange: null,
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
}

/** Captured so a test can fire a resize the way the browser would. */
let observerCallbacks: (() => void)[] = [];

/** What every `.icicle-container` will claim to measure. */
let chartWidth = 0;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  observerCallbacks = [];
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

  // jsdom ships no ResizeObserver. This one records its callback so a test can
  // deliver a resize, and does nothing else.
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    constructor(cb: () => void) { observerCallbacks.push(cb); }
    observe() {}
    disconnect() {}
    unobserve() {}
  };

  // ⚠ Only the CHART reports a width. Everything else measures 0, exactly as
  // jsdom does by default — so a ref attached to the wrong element produces a
  // null measurement and this test fails, which is the whole point of it.
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const w = this.classList?.contains('icicle-container') ? chartWidth : 0;
    return { width: w, height: 0, top: 0, left: 0, right: w, bottom: 0, x: 0, y: 0,
      toJSON: () => ({}) } as DOMRect;
  };

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  // ⚠ The stub is a GLOBAL. Left in place it would decide the branch for
  // whichever test ran next, making results depend on file order.
  delete (globalThis as Record<string, unknown>).matchMedia;
});

function mountAt(width: number) {
  chartWidth = width;
  act(() => {
    root.render(createElement(BudgetIcicle, {
      categories: [currentOps, NYC_DEBT_SERVICE],
      navigationPath: [currentOps],
      totalBudget: TOTAL + NYC_DEBT_SERVICE.amount,
      onPathClick: () => {},
    } as never));
  });
}

/** Labels actually painted on the current level, in order. */
const labels = () =>
  [...host.querySelectorAll('.icicle-level.current .segment-name')]
    .map((n) => n.textContent ?? '');

/** Measured width of a named segment, from the inline style the chart set. */
function segmentPx(name: string): number {
  const seg = [...host.querySelectorAll('.icicle-level.current .icicle-segment')]
    .find((s) => (s.getAttribute('title') ?? '').startsWith(name));
  const pct = Number(/width:\s*([\d.]+)%/.exec(seg?.getAttribute('style') ?? '')?.[1] ?? 0);
  return (pct / 100) * chartWidth;
}

describe('BudgetIcicle labels from a MEASURED width', () => {
  it('labels the NYC sliver on a desktop-width chart', () => {
    // ⚠⚠ THE REPORTED DEFECT, against a mounted component. General Government
    // is 5.2% — under the old 8% rule at every size — but ~70px here, which is
    // over the 64px floor. If the ref never reaches `.icicle-container`, the
    // width stays null, the fallback applies and this label is absent.
    mountAt(1350);
    expect(segmentPx('General Government')).toBeGreaterThan(64);
    expect(labels()).toContain('General Government');
  });

  it('withholds that same label on a phone-width chart', () => {
    // The identical share of a smaller chart is a different amount of room.
    mountAt(342);
    expect(segmentPx('General Government')).toBeLessThan(64);
    expect(labels()).not.toContain('General Government');
  });

  it('withholds a label the OLD percentage rule would have shown and clipped', () => {
    // Public safety is 15.9%, comfortably over the retired 8% floor, but 54px
    // on a phone — less than `$7.3B` alone needs.
    mountAt(342);
    expect(segmentPx('Public safety and judicial')).toBeLessThan(64);
    expect(labels()).not.toContain('Public safety and judicial');
  });

  it('keeps the biggest function labelled at every width', () => {
    mountAt(1350);
    expect(labels()[0]).toBe('Education');
    mountAt(342);
    expect(labels()[0]).toBe('Education');
  });

  it('re-labels when the chart is RESIZED, not only when it mounts', () => {
    // ⚠ The ResizeObserver edge. A chart that measures once and never again
    // would pass every test above and still be wrong the moment a reader turns
    // their phone or opens a sidebar.
    mountAt(342);
    expect(labels()).not.toContain('General Government');

    chartWidth = 1350;
    act(() => { observerCallbacks.forEach((cb) => cb()); });
    expect(labels()).toContain('General Government');
  });

  it('observes the chart element itself, so a detached ref cannot pass', () => {
    mountAt(1350);
    expect(observerCallbacks.length).toBeGreaterThan(0);
    expect(host.querySelector('.icicle-container')).not.toBeNull();
  });

  it('still renders every segment, labelled or not', () => {
    // A withheld label must never mean a withheld bar — the segment stays
    // clickable and carries its figure in `title` and `aria-label`.
    mountAt(342);
    const segments = host.querySelectorAll('.icicle-level.current .icicle-segment');
    expect(segments).toHaveLength(FUNCTIONS.length);
    const gg = [...segments].find((s) => (s.getAttribute('title') ?? '').startsWith('General Government'));
    expect(gg?.getAttribute('aria-label')).toContain('$2.4B');
  });
});

/**
 * ⚠⚠ BELOW `sm` THE CHART IS A PICTURE, NOT A CONTROL.
 *
 * Measured on production: drilled into NYC's fifteen functions at 390px, TWELVE
 * segments are under the 24px WCAG 2.5.8 minimum target size and the narrowest
 * is 2px. A 2px tap target is a promise to nobody, so the strip keeps its one
 * real job — proportion at a glance — and the cards become the control.
 */
describe('BudgetIcicle on a phone', () => {
  it('offers no tap target it cannot honour', () => {
    stubMatchMedia(390);
    mountAt(342);
    const segments = [...host.querySelectorAll('.icicle-segment')];
    expect(segments.length).toBeGreaterThan(5);
    for (const s of segments) {
      expect(s.getAttribute('tabindex')).toBe('-1');
      expect(s.className).not.toContain('clickable');
    }
    expect(host.querySelector('.icicle-wrapper')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('still draws the proportions', () => {
    // ⚠ The picture is the point of keeping it. Widths must survive.
    stubMatchMedia(390);
    mountAt(342);
    const widths = [...host.querySelectorAll('.icicle-level.current .icicle-segment')]
      .map((s) => Number(/width:\s*([\d.]+)%/.exec(s.getAttribute('style') ?? '')?.[1] ?? 0));
    expect(widths.length).toBe(FUNCTIONS.length);
    expect(Math.max(...widths)).toBeGreaterThan(20);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
  });

  it('is fully interactive again at sm and above', () => {
    stubMatchMedia(640);
    mountAt(1350);
    const segments = [...host.querySelectorAll('.icicle-segment')];
    expect(segments.every((s) => s.getAttribute('tabindex') === '0')).toBe(true);
    expect(host.querySelector('.icicle-wrapper')!.getAttribute('aria-hidden')).toBeNull();
  });

  it('stays interactive where matchMedia cannot be asked', () => {
    // ⚠⚠ The fallback matters: an environment that cannot answer the question
    // must render the FULLER behaviour, not silently strip it. This is the
    // path `renderToStaticMarkup` takes on every render.
    delete (globalThis as Record<string, unknown>).matchMedia;
    mountAt(1350);
    const segments = [...host.querySelectorAll('.icicle-segment')];
    expect(segments.every((s) => s.getAttribute('tabindex') === '0')).toBe(true);
  });
});
