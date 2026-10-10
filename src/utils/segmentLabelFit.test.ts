import { describe, it, expect } from 'vitest';
import { canFitLabel, LABEL_FLOOR_PX, LEGACY_PCT_FLOOR } from './segmentLabelFit';

/**
 * ⚠ The two opposite mistakes one percentage threshold was making at once. Both
 * are stated with the real numbers that produced them.
 */
describe('canFitLabel', () => {
  // New York City FY2002 `General Government`: 5.2% of `Current Operations`.
  const NYC_GENERAL_GOVERNMENT = 5.2;
  const DESKTOP_CHART = 1350;   // measured on the reported screenshot
  const PHONE_CHART = 358;      // a 390px viewport less the page gutters

  it('labels the NYC sliver on a desktop chart, where it has ~70px', () => {
    // ⚠⚠ THE REPORTED DEFECT. 5.2% of 1350 is 70px — room for `General Gov…`
    // and `$2.4B` — and the old rule blanked it for being under 8%.
    expect(NYC_GENERAL_GOVERNMENT * DESKTOP_CHART / 100).toBeGreaterThan(LABEL_FLOOR_PX.current);
    expect(canFitLabel(NYC_GENERAL_GOVERNMENT, DESKTOP_CHART, false)).toBe(true);
  });

  it('still hides that same segment on a phone, where it has 19px', () => {
    // The same share of a smaller chart is a different amount of room. A
    // percentage rule cannot tell these two cases apart; that is the bug.
    expect(canFitLabel(NYC_GENERAL_GOVERNMENT, PHONE_CHART, false)).toBe(false);
  });

  it('hides a label the old rule showed and clipped', () => {
    // ⚠ The other half of the defect. 10% cleared the old 8% floor at every
    // size, but 10% of a phone chart is 36px — under what `$13.5B` alone needs.
    expect(10 >= LEGACY_PCT_FLOOR.current).toBe(true);
    expect(canFitLabel(10, PHONE_CHART, false)).toBe(false);
  });

  it('asks less of an ancestor row than of the current one', () => {
    // An ancestor is a breadcrumb: name only, smaller type, no amount.
    const widthPct = (56 / DESKTOP_CHART) * 100;
    expect(canFitLabel(widthPct, DESKTOP_CHART, true)).toBe(true);
    expect(canFitLabel(widthPct, DESKTOP_CHART, false)).toBe(false);
  });

  it('steps exactly at the floor', () => {
    const atFloor = (LABEL_FLOOR_PX.current / DESKTOP_CHART) * 100;
    expect(canFitLabel(atFloor, DESKTOP_CHART, false)).toBe(true);
    expect(canFitLabel(atFloor * 0.99, DESKTOP_CHART, false)).toBe(false);
  });

  it('falls back to the old percentage rule until the chart is measured', () => {
    // ⚠⚠ What `renderToStaticMarkup` and the first paint get. Reproduces the
    // pre-2026-10-10 behaviour exactly, rather than blanking every label.
    expect(canFitLabel(8, null, false)).toBe(true);
    expect(canFitLabel(7.9, null, false)).toBe(false);
    expect(canFitLabel(6, null, true)).toBe(true);
    expect(canFitLabel(5.9, null, true)).toBe(false);
  });

  it('treats a nonsense measurement as no measurement', () => {
    // A detached or display:none container measures 0, and ResizeObserver can
    // deliver that before layout settles. Guessing from it would blank the
    // whole chart for a frame.
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(canFitLabel(29.3, bad, false)).toBe(true);   // falls back, 29.3 >= 8
      expect(canFitLabel(5.2, bad, false)).toBe(false);
    }
  });

  it('never labels a zero-width segment', () => {
    expect(canFitLabel(0, DESKTOP_CHART, false)).toBe(false);
    expect(canFitLabel(0, null, false)).toBe(false);
  });
});
