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
