// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import BudgetSunburst from './BudgetSunburst';
import { sortCategoriesByAmount } from '../data/sortCategories';
import { getCategoryColor } from '../utils/chartColors';
import {
  NYC_CURRENT_OPERATIONS,
  NYC_CURRENT_OPERATIONS_TOTAL,
  NYC_DEBT_SERVICE,
  nycCurrentOperationsNode,
} from '../data/__fixtures__/nycCurrentOperations';

/**
 * ⚠⚠ THE SUNBURST DRAWS ITSELF IMPERATIVELY, AND THAT IS WHY THIS EXISTS.
 *
 * `sunburstLevels.ts` holds the decisions and has its own tests, but d3 writes
 * the fills, opacities and labels onto the DOM from inside an effect. Nothing
 * connects the two except the component, and that seam has broken twice:
 *
 *   • #247 — the colour rule and the opacity rule were each applied in ONE
 *     place and the `mouseleave` RESTORE handler carried its own stale copy.
 *     Fixing only the initial fill would have put the dimmed-current-level
 *     defect straight back the moment a reader moved the pointer off an arc.
 *     Invisible in a screenshot; visible only on hover-out.
 *   • #248 — labels are drawn from a MEASURED container width, so a ref that
 *     came unstuck would silently draw none at all.
 *
 * `renderToStaticMarkup` cannot reach any of this: it runs no effects, so the
 * d3 code never executes. Only a mounted component does.
 *
 * ── ⚠ WHAT jsdom CANNOT DO ──────────────────────────────────────────────────
 *
 * No layout: `getBoundingClientRect` returns zeros and `ResizeObserver` does
 * not exist, so both are stubbed with known values. d3's geometry is pure
 * arithmetic and runs fine; what is asserted here is that the right VALUES
 * reach the right ATTRIBUTES, never that a browser paints them correctly.
 * Real geometry is checked by driving a real page.
 */

const FUNCTIONS = sortCategoriesByAmount(NYC_CURRENT_OPERATIONS);
const currentOps = nycCurrentOperationsNode(FUNCTIONS);
const TOTAL = NYC_CURRENT_OPERATIONS_TOTAL + NYC_DEBT_SERVICE.amount;

/** The chart width every `.sunburst-container` will claim to measure. */
const CHART_PX = 468;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  // ⚠⚠ jsdom DOES RUN d3's transitions (its rAF drives d3-timer), but it
  // implements no SVG `transform` property, so `d3-interpolate`'s `parseSvg`
  // throws on `svgNode.transform.baseVal` the moment the chart animates its
  // rotation. Returning a null consolidation makes the interpolator fall back
  // to identity: the rotation simply does not animate, which costs nothing
  // here because nothing below asserts on it — and the arcs' OPACITY
  // transitions, which everything below does assert on, run for real.
  if (!('transform' in SVGGElement.prototype)) {
    Object.defineProperty(SVGGElement.prototype, 'transform', {
      configurable: true,
      get: () => ({ baseVal: { consolidate: () => null } }),
    });
  }

  Element.prototype.getBoundingClientRect = function (this: Element) {
    const w = this.classList?.contains('sunburst-container') ? CHART_PX : 0;
    return { width: w, height: w, top: 0, left: 0, right: w, bottom: w, x: 0, y: 0,
      toJSON: () => ({}) } as DOMRect;
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function mount(navigationPath: unknown[]) {
  act(() => {
    root.render(createElement(BudgetSunburst, {
      categories: [currentOps, NYC_DEBT_SERVICE],
      navigationPath,
      totalBudget: TOTAL,
      onPathClick: () => {},
    } as never));
  });
}

const arcs = () => [...host.querySelectorAll('g.sunburst-rotatable path.arc')];
const fills = () => arcs().map((a) => a.getAttribute('fill'));
const opacities = () => arcs().map((a) => a.getAttribute('fill-opacity'));
const labels = () =>
  [...host.querySelectorAll('g.sunburst-labels text')].map((t) => t.textContent).filter(Boolean);

/**
 * Fire a real DOM event and let the chart's 100ms transition FINISH.
 *
 * ⚠⚠ THE AWAIT IS LOAD-BEARING. d3 applies hover and restore through
 * `.transition()`, so the attribute does not change on dispatch — it changes
 * an animation frame later. Asserting straight after the event reads the OLD
 * value, which made the restore assertion pass without the restore ever
 * having run: a test that could not fail.
 */
async function fire(el: Element, type: string) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
  });
}

describe('BudgetSunburst draws what sunburstLevels decided', () => {
  beforeEach(() => mount([currentOps]));

  it('colours each wedge by its position among its SIBLINGS', () => {
    // ⚠⚠ #247. Every descendant used to inherit the ROOT's colour index, so all
    // fifteen functions drew in one teal under fifteen differently-coloured
    // cards. The ring is the card list; they must agree position for position.
    const ring = fills().slice(2);            // after the two root arcs
    expect(ring).toHaveLength(FUNCTIONS.length);
    ring.forEach((fill, i) => expect(fill).toBe(getCategoryColor(i)));
  });

  it('draws the root level in the root palette', () => {
    expect(fills().slice(0, 2)).toEqual([getCategoryColor(0), getCategoryColor(1)]);
  });

  it('never leaves the current level fainter than its own parent', () => {
    // ⚠⚠ #247's second defect: the path drew at 1.0 while the fifteen
    // functions a reader had just drilled into drew at 0.3.
    const [path, sibling, ...current] = opacities();
    expect(path).toBe('1');                   // Current Operations
    expect(sibling).toBe('0.3');              // Debt Service, off the path
    for (const o of current) expect(o).toBe('1');
  });

  it('RESTORES the same opacity after a hover ends', async () => {
    // ⚠⚠ THE BUG THAT WOULD HAVE SHIPPED. The rule lived in two places and the
    // `mouseleave` restore kept a stale copy, so the defect returned the moment
    // the pointer left an arc — a state no screenshot can catch.
    // ⚠⚠ BOTH A DIMMED ARC AND A FULL ONE, and that is not thoroughness for
    // its own sake. A first version of this test hovered only `Debt Service`,
    // whose correct resting opacity IS 0.3 — so a restore handler that simply
    // hardcoded 0.3 looked correct on the one arc being checked. Reinstating
    // the real #247 bug did not fail the test. A stale restore is only visible
    // on an arc whose resting value is NOT the stale constant.
    const before = opacities();
    for (const i of [1, 3]) {                 // Debt Service (0.3), a function (1)
      const wedge = arcs()[i];
      await fire(wedge, 'mouseenter');
      await fire(wedge, 'mouseleave');
      expect(wedge.getAttribute('fill-opacity')).toBe(before[i]);
    }
    expect(opacities()).toEqual(before);
  });

  it('brightens the arc under the pointer while it is there', async () => {
    // Guards the guard above: if hovering did nothing at all, the restore
    // assertion would pass without proving anything.
    const dim = arcs()[1];                    // Debt Service, drawn at 0.3
    expect(dim.getAttribute('fill-opacity')).toBe('0.3');
    await fire(dim, 'mouseenter');
    expect(dim.getAttribute('fill-opacity')).toBe('1');
  });

  it('labels the arcs, which needs the measured container to reach the chart', () => {
    // ⚠⚠ #248. The font size comes from a MEASURED width; if the ref came
    // unstuck the width stays null and NOT ONE label is drawn.
    expect(labels().length).toBeGreaterThan(5);
    expect(labels()).toContain('Education');
  });

  it('labels only the arcs that are not dimmed', () => {
    // White text on a 0.3 fill is near-white on white — a string a reader
    // cannot read is worse than no string.
    expect(labels().some((l) => l!.startsWith('Debt'))).toBe(false);
  });

  it('draws a square viewBox, so no wedge is cropped', () => {
    // ⚠ #248. It was `size * 0.7` tall around a full circle, cutting 134 units
    // off the top AND the bottom — data, not decoration.
    const vb = host.querySelector('svg.sunburst-svg')!.getAttribute('viewBox')!.split(/\s+/).map(Number);
    expect(vb[2]).toBe(vb[3]);
    expect(vb[0]).toBe(-vb[2] / 2);
  });

  it('keeps every arc inside the radius the viewBox allows', () => {
    // d3's arc geometry is pure arithmetic, so this is meaningful without
    // layout: no path may reach past half the viewBox.
    const vb = host.querySelector('svg.sunburst-svg')!.getAttribute('viewBox')!.split(/\s+/).map(Number);
    const limit = vb[2] / 2;
    for (const a of arcs()) {
      for (const n of (a.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g) ?? []) {
        expect(Math.abs(Number(n))).toBeLessThanOrEqual(limit + 0.5);
      }
    }
  });
});

describe('BudgetSunburst at the root', () => {
  it('reads the whole top level as current when nothing is selected', () => {
    mount([]);
    expect(opacities().every((o) => o === '1')).toBe(true);
  });
});
