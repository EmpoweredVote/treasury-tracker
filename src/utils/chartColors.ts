/**
 * Data visualization color utility — derives chart fills from CSS custom properties
 * defined in index.css @theme block. Replaces stored category.color hex values.
 *
 * Per D-07, D-08, D-09: chart fills use --color-data-* namespace only,
 * never EV brand tokens (ev-coral, ev-muted-blue, ev-yellow).
 */

// Ordered so consecutive indices land on contrasting parts of the color wheel.
// The icicle/cards color top-level categories by position (0,1,2,…), so a
// family-grouped order (teal→skyblue→ocean) made the largest adjacent categories
// nearly indistinguishable. Interleaving cyan→red→yellow→purple→green keeps the
// first ~5 categories (which dominate most budgets) clearly distinct.
export const DATA_VIZ_HUES = [
  'teal', 'coral', 'yellow', 'dusk', 'sage',
  'skyblue', 'terracotta', 'honey', 'ocean', 'stone'
] as const;

export type DataVizShade = '100' | '300' | '400' | '500' | '700';

/**
 * Returns a CSS custom property reference for chart segment fills.
 * @param index — category position (cycles through 10 hues)
 * @param shade — shade variant (default 500 for primary fill)
 */
export function getCategoryColor(index: number, shade: DataVizShade = '500'): string {
  const hue = DATA_VIZ_HUES[index % DATA_VIZ_HUES.length];
  return `var(--color-data-${hue}-${shade})`;
}

/**
 * Returns the resolved hex value for contexts where var() is not supported
 * (e.g., D3 computed styles, canvas rendering).
 * Reads the computed value from the document root.
 */
export function getResolvedCategoryColor(index: number, shade: DataVizShade = '500'): string {
  const hue = DATA_VIZ_HUES[index % DATA_VIZ_HUES.length];
  const varName = `--color-data-${hue}-${shade}`;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/**
 * How many distinct lightness steps a drilled level cycles through.
 *
 * ⚠ NOT one step per child. A level can hold 36 children (Modesto's salaries
 * chart), and 36 monotonic steps would run the far end out of contrast entirely.
 * Five steps repeating means neighbours always differ while every fill stays
 * within a bounded distance of the branch colour.
 */
export const BRANCH_SHADE_CYCLE = 5;

/**
 * Lightness steps, as a percentage of the base colour retained and the direction
 * mixed toward. Step 0 is the base itself, so the first child of every level — and
 * every single-child level — renders exactly as it did before this existed.
 */
const BRANCH_SHADES: readonly { keep: number; toward: 'white' | 'black' }[] = [
  { keep: 100, toward: 'white' },
  { keep: 84, toward: 'white' },
  { keep: 86, toward: 'black' },
  { keep: 92, toward: 'white' },
  { keep: 93, toward: 'black' },
];

/**
 * Vary lightness within one branch colour, for the children of a drilled category.
 *
 * ⚠ Why this exists: a drilled level inherits its ROOT's colour index on purpose,
 * so a branch reads as one colour. On a level with 36 children that intent stopped
 * working — all 36 rendered in the identical fill and only 2 were wide enough to
 * carry a label, so the row read as one undifferentiated block ("the green looks
 * odd in that setup", UAT 2026-08-22, G3). Chris's call, 2026-08-23: keep the
 * branch colour, vary the lightness.
 *
 * Hue is never touched — mixing happens toward white or black only, so the segment
 * still says "this belongs to Parks, Recreation & Neighborhoods".
 *
 * ⚠ Contrast is deliberately still computed from the BASE colour by the caller.
 * `getContrastText` returns white for any non-hex input, which is what every
 * `var(--color-data-*)` fill already got and what these mixes get too — so the text
 * colour on screen is unchanged by construction, not by luck.
 */
export function shadeWithinBranch(base: string, indexInLevel: number): string {
  const step = BRANCH_SHADES[indexInLevel % BRANCH_SHADE_CYCLE];
  if (step.keep >= 100) return base;
  return `color-mix(in oklab, ${base} ${step.keep}%, ${step.toward})`;
}
