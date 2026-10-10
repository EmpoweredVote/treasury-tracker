import { describe, it, expect } from 'vitest';
import { canFitLabel, requiredLabelPx, LABEL_FLOOR_PX, LEGACY_PCT_FLOOR } from './segmentLabelFit';
import { measureTextPx } from './manropeMetrics';

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

  it('leaves room for the widest money string the ladder can print', () => {
    // ⚠⚠ WOULD FAIL AT THE OLD 64. The floor is set by `.segment-amount`, and
    // the old value was reasoned from 0.60em per digit when Manrope's are
    // 0.642em with '$' at 0.615em — so it sat ~5px low, the direction that
    // CLIPS a figure rather than hiding it.
    const PADDING_PX = 16;
    const widest = measureTextPx('-$999.9M', 11.2, 500);
    expect(LABEL_FLOOR_PX.current).toBeGreaterThanOrEqual(Math.ceil(PADDING_PX + widest));
    expect(LABEL_FLOOR_PX.current).toBeGreaterThan(64);
  });

  it('keeps the ancestor row more permissive than the current one', () => {
    // An ancestor is a breadcrumb: recognition, not reading.
    expect(LABEL_FLOOR_PX.ancestor).toBeLessThan(LABEL_FLOOR_PX.current);
  });

  it('labels a segment whose OWN text fits, where the worst-case floor hid it', () => {
    // ⚠⚠ THE DEFECT. New York City FY2002 `Health (including payments to HHC)`
    // is 66px on a 1350px chart. The global floor is sized for `-$999.9M`, the
    // widest figure the ladder can print, so it hid a segment whose real text
    // -- `$2.2B` over a six-letter fragment -- needs about 46px.
    const HEALTH = { name: 'Health (including payments to HHC)', amount: '$2.2B' };
    const widthPct = (66 / DESKTOP_CHART) * 100;

    expect(66).toBeLessThan(LABEL_FLOOR_PX.current);          // the floor hid it
    expect(requiredLabelPx(HEALTH, false)).toBeLessThan(66);  // its own text fits
    expect(canFitLabel(widthPct, DESKTOP_CHART, false, HEALTH)).toBe(true);
    expect(canFitLabel(widthPct, DESKTOP_CHART, false)).toBe(false);
  });

  it('asks MORE of a wide figure than of a narrow one at the same name', () => {
    // The point of measuring: `$1,234,567` and `$2.2B` are not the same width,
    // so they must not be held to the same bar.
    const wide = requiredLabelPx({ name: 'Housing', amount: '$1,234,567' }, false);
    const narrow = requiredLabelPx({ name: 'Housing', amount: '$2.2B' }, false);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('reserves no width for an amount an ancestor never prints', () => {
    // ⚠ An ancestor row renders the name only. Charging it for a figure would
    // strip labels off breadcrumbs for text that is not there.
    const t = { name: 'Current Operations', amount: '$45.9B' };
    expect(requiredLabelPx(t, true)).toBeLessThan(requiredLabelPx(t, false));
  });

  it('demands the WHOLE amount, because a clipped figure is a wrong figure', () => {
    // `.segment-amount` has no `text-overflow` and sits in an `overflow:hidden`
    // box, so a figure that does not fit is cut mid-glyph -- `$13.5B` reads as
    // `$13.5` or `$1`. A long name is fine; it ellipsises.
    // Two names of very different length that share a six-letter opening cost
    // exactly the same, because that is all either will ever show.
    const a = requiredLabelPx({ name: 'Environmental protection', amount: '$2.8B' }, false);
    const b = requiredLabelPx({ name: 'Environmentally sustainable transport', amount: '$2.8B' }, false);
    expect(a).toBe(b);

    const longAmount = requiredLabelPx({ name: 'Housing', amount: '$123,456,789' }, false);
    const shortAmount = requiredLabelPx({ name: 'Housing', amount: '$1K' }, false);
    expect(longAmount).toBeGreaterThan(shortAmount);   // the amount is NOT capped
  });

  it('needs only the whole name when the name is short', () => {
    // "Parks" is shorter than the fragment, so nothing is ellipsised and the
    // requirement is the word itself.
    const short = requiredLabelPx({ name: 'Parks', amount: null }, false);
    const long = requiredLabelPx({ name: 'Parksssssssss', amount: null }, false);
    expect(short).toBeLessThan(long);
  });

  it('still falls back to the worst-case floor when no text is given', () => {
    // ⚠ The old call shape must keep working -- `renderToStaticMarkup` and any
    // caller that genuinely has no strings.
    const atFloor = (LABEL_FLOOR_PX.current / DESKTOP_CHART) * 100;
    expect(canFitLabel(atFloor, DESKTOP_CHART, false)).toBe(true);
    expect(canFitLabel(atFloor * 0.99, DESKTOP_CHART, false)).toBe(false);
  });

  it('never labels a zero-width segment', () => {
    expect(canFitLabel(0, DESKTOP_CHART, false)).toBe(false);
    expect(canFitLabel(0, null, false)).toBe(false);
  });
});
