import { describe, it, expect } from 'vitest';
import {
  buildSunburstHierarchy, arcEmphasis, ARC_OPACITY, fitArcLabel, arcLabelTransform,
} from './sunburstLevels';
import { sortCategoriesByAmount } from './sortCategories';
import {
  NYC_CURRENT_OPERATIONS,
  nycCurrentOperationsNode,
} from './__fixtures__/nycCurrentOperations';
import { getCategoryColor } from '../utils/chartColors';
import { measureTextPx } from '../utils/manropeMetrics';
import type { BudgetCategory } from '../types/budget';

const cat = (name: string, amount: number, subcategories?: BudgetCategory[]): BudgetCategory =>
  ({ name, amount, subcategories } as BudgetCategory);

/** The real FY2002 tree: Current Operations (15 functions) beside Debt Service. */
const tree = () => [
  nycCurrentOperationsNode(sortCategoriesByAmount(NYC_CURRENT_OPERATIONS)),
  cat('Debt Service', 1_800_000_000),
];

describe('buildSunburstHierarchy', () => {
  it('colours a ring by SIBLING position, not by its root', () => {
    // ⚠⚠ THE DEFECT. Every descendant used to inherit the root's index, so all
    // fifteen functions drew in one teal under fifteen differently-coloured
    // cards. Checked on production 2026-10-10.
    const ring2 = buildSunburstHierarchy(tree())[0].children!;
    expect(ring2.map((n) => n.categoryIndex)).toEqual([...Array(15).keys()]);
  });

  it('gives the Nth wedge the Nth card colour', () => {
    // The invariant the icicle fix created, extended to the second view: one
    // list, one palette, whichever chart is showing.
    const ring2 = buildSunburstHierarchy(tree())[0].children!;
    const fills = ring2.map((n) => getCategoryColor(n.categoryIndex));
    expect(fills[0]).toBe(getCategoryColor(0));
    expect(fills[1]).toBe(getCategoryColor(1));
    expect(fills[2]).toBe(getCategoryColor(2));
    for (let i = 1; i < fills.length; i++) expect(fills[i]).not.toBe(fills[i - 1]);
  });

  it('keeps the root level as it was', () => {
    const roots = buildSunburstHierarchy(tree());
    expect(roots.map((n) => n.categoryIndex)).toEqual([0, 1]);
  });

  it('gives an internal node no value, so d3 cannot double-count it', () => {
    const [ops, debt] = buildSunburstHierarchy(tree());
    expect(ops.value).toBeUndefined();
    expect(ops.children).toHaveLength(15);
    expect(debt.value).toBe(1_800_000_000);
    expect(debt.children).toBeUndefined();
  });

  it('indexes every level independently, however deep', () => {
    const deep = [cat('A', 10, [cat('A1', 6, [cat('A1a', 6)]), cat('A2', 4)])];
    const out = buildSunburstHierarchy(deep);
    expect(out[0].categoryIndex).toBe(0);
    expect(out[0].children!.map((n) => n.categoryIndex)).toEqual([0, 1]);
    expect(out[0].children![0].children![0].categoryIndex).toBe(0);
  });

  it('survives an empty or absent level', () => {
    expect(buildSunburstHierarchy([])).toEqual([]);
    expect(buildSunburstHierarchy(undefined as unknown as BudgetCategory[])).toEqual([]);
  });
});

describe('arcEmphasis', () => {
  const PATH = ['Current Operations'];

  it('never leaves the CURRENT LEVEL fainter than its parent', () => {
    // ⚠⚠ THE SECOND DEFECT, stated as the thing a reader saw: drilled into
    // Current Operations, the parent drew at 1.0 and all fifteen functions —
    // the level being read, and the level the cards list — drew at 0.3.
    const parent = ARC_OPACITY[arcEmphasis(PATH, PATH)];
    const child = ARC_OPACITY[arcEmphasis([...PATH, 'Education'], PATH)];
    expect(child).toBeGreaterThanOrEqual(parent);
    expect(child).toBe(1);
  });

  it('separates a child of the selection from a true sibling of the path', () => {
    // The old predicate lumped these together: both have a parent on the path.
    // Only DEPTH tells them apart.
    expect(arcEmphasis(['Current Operations', 'Education'], PATH)).toBe('current');
    expect(arcEmphasis(['Debt Service'], PATH)).toBe('dim');
  });

  it('marks ancestors and the selection itself as path', () => {
    const deep = ['Current Operations', 'Education'];
    expect(arcEmphasis(['Current Operations'], deep)).toBe('path');
    expect(arcEmphasis(['Current Operations', 'Education'], deep)).toBe('path');
  });

  it('dims a grandchild two levels below the selection', () => {
    expect(arcEmphasis(['Current Operations', 'Education', 'Teachers'], PATH)).toBe('dim');
  });

  it('dims a node that merely shares a prefix name', () => {
    expect(arcEmphasis(['Debt Service', 'Interest'], PATH)).toBe('dim');
  });

  it('reads the whole top level as current when nothing is selected', () => {
    expect(arcEmphasis(['Current Operations'], [])).toBe('current');
    expect(arcEmphasis(['Debt Service'], [])).toBe('current');
    expect(arcEmphasis(['Current Operations', 'Education'], [])).toBe('dim');
  });
});

/**
 * ⚠ The sunburst drew NO arc labels at all before 2026-10-10 — tooltip-only, so
 * unreadable without a pointer and unreadable full stop on a touch screen.
 *
 * Geometry below is the real chart: viewBox 900, radius 450, centre circle
 * 126, so a two-ring tree gives each ring (450 − 130) / 2 = 160 units. The
 * container is capped at 500px, so the scale is about 0.52 and an 11px label
 * is ~21 viewBox units.
 */
describe('fitArcLabel', () => {
  const RING = { innerRadius: 130, outerRadius: 289 };   // ring 1 of a 2-ring tree
  const FONT = 21;                                        // 11px at the 500px cap
  const fit = (label: string, sweep: number, ring = RING, fontSize = FONT) =>
    fitArcLabel({ label, ...ring, startAngle: 0, endAngle: sweep, fontSize });

  it('labels a wide arc with its full name', () => {
    // Education is 29.3% of the level — 0.29 of a turn.
    expect(fit('Education', 2 * Math.PI * 0.293)).toBe('Education');
  });

  it('ELLIPSISES rather than hiding, when only a fragment fits', () => {
    // ⚠⚠ SVG `<text>` has no `text-overflow`, so without this the chart would
    // label its two widest arcs and stay unreadable. 160 units of ring at a
    // 21-unit font is ~12 characters.
    const out = fit('Environmental protection', 2 * Math.PI * 0.061);
    expect(out).toMatch(/…$/);
    expect(out!.length).toBeLessThanOrEqual(13);
    expect('Environmental protection').toContain(out!.slice(0, -1));
  });

  it('refuses a wedge too THIN to carry a line of text', () => {
    // Libraries is 0.3% of the level. The ring is fat; the wedge is a hair.
    expect(fit('Libraries', 2 * Math.PI * 0.003)).toBeNull();
  });

  it('refuses a ring too NARROW for five characters, however wide the wedge', () => {
    // The other dimension, which a single fraction test cannot see: half the
    // circle, but a ring 20 units deep.
    expect(fit('Education', Math.PI, { innerRadius: 400, outerRadius: 420 })).toBeNull();
  });

  it('admits fewer labels as the chart gets smaller', () => {
    // The font grows in viewBox units as the container shrinks, which is what
    // keeps the RENDERED size constant — so a narrow screen naturally labels
    // less. Same behaviour as the icicle's pixel floor.
    const sweep = 2 * Math.PI * 0.061;
    expect(fit('Housing', sweep, RING, 21)).not.toBeNull();   // 500px container
    expect(fit('Housing', sweep, RING, 60)).toBeNull();        // ~180px container
  });

  it('truncates by WIDTH, not by character count', () => {
    // ⚠⚠ WOULD FAIL UNDER THE OLD RULE, which divided the ring by a flat
    // 0.55em and therefore gave both of these the same number of characters.
    // In Manrope 'l' is 0.265em and 'W' is 0.963em.
    const narrow = fit('lililililililili', 2);
    const wide = fit('WAWAWAWAWAWAWAWA', 2);
    expect(narrow).not.toBeNull();
    expect(narrow!.length).toBeGreaterThan((wide ?? '').length);
  });

  it('returns a label that MEASURES inside the ring it was given', () => {
    // The property a count-based rule could not hold. Checked against the real
    // font for every function on the reported NYC level.
    const names = ['Education', 'Social services', 'Public safety and judicial',
      'Environmental protection', 'Parks, recreation and cultural activities',
      'Health (including payments to HHC)', 'Libraries', 'Housing'];
    const usable = (RING.outerRadius - RING.innerRadius) - FONT * 0.6;
    for (const n of names) {
      const out = fit(n, 2);
      if (out === null) continue;
      expect(measureTextPx(out, FONT, 600)).toBeLessThanOrEqual(usable);
    }
  });

  it('never returns an empty or whitespace label', () => {
    expect(fit('', 1)).toBeNull();
    const out = fit('A very long label indeed', 2);
    expect(out).not.toBeNull();
    expect(out!.trim()).toBe(out);
  });

  it('refuses nonsense geometry instead of drawing at it', () => {
    expect(fit('X', 0)).toBeNull();
    expect(fit('X', 1, { innerRadius: 300, outerRadius: 300 })).toBeNull();
    expect(fit('X', 1, RING, 0)).toBeNull();
    expect(fit('X', 1, RING, NaN)).toBeNull();
  });
});

describe('arcLabelTransform', () => {
  it('reads outward on the right half', () => {
    // Three o'clock: rotate 0°, push out, no flip.
    expect(arcLabelTransform(Math.PI / 2, Math.PI / 2, 200))
      .toBe('rotate(0) translate(200,0) rotate(0)');
  });

  it('FLIPS on the left half, so a label is never upside down', () => {
    // ⚠ d3 angles run clockwise from twelve o'clock, so anything past π points
    // leftward and would read backwards.
    expect(arcLabelTransform(1.5 * Math.PI, 1.5 * Math.PI, 200))
      .toBe('rotate(180) translate(200,0) rotate(180)');
  });

  it('places the label at the middle of its ring', () => {
    expect(arcLabelTransform(0, Math.PI, 123)).toContain('translate(123,0)');
  });
});
