/**
 * SPA URL sync + navigation detection.
 *
 * Treasury is a single-page app that moves between budgets with
 * `history.pushState` rather than a page load. PostHog's automatic pageview
 * capture (`capturePageview: true`) only fires on the INITIAL load, so until
 * this module existed every visitor was recorded against the bare host and
 * nothing else — 90 days of traffic with exactly two distinct `$current_url`
 * values, while Essentials and Read & Rank showed their real routes. That made
 * "how many people reached a budget at all?" unanswerable, and a briefing
 * published a Treasury engagement rate that had to be withdrawn because its
 * denominator could not be built.
 *
 * The fix is the one `@empoweredvote/analytics` documents for SPAs: call
 * `pageview()` on route change. This module owns the decision of what counts
 * as a route change, so it can be tested without a DOM.
 *
 * Why compare parsed params instead of raw strings: a shared or bookmarked link
 * can carry the same four values in a different order, or trailing UTM tags. A
 * raw string compare would call that a navigation, push a cosmetically
 * different URL, and capture a second pageview for a budget the visitor never
 * left — inflating exactly the number this exists to measure.
 */

/** The four values that identify which budget view the app is showing. */
export interface BudgetLocation {
  /** Entity slug, e.g. `seattle-wa`. */
  entity: string;
  /** Fiscal year or period label, e.g. `2025`. */
  year: string;
  /** Dataset key, e.g. `operating`. */
  dataset: string;
  /** Federal agency lens; only `'agency'` is ever serialized. */
  lens?: string;
  /**
   * SCOPE-03: the chosen series, `fund_scope` and `basis`. Both are omitted when
   * the selection is the app's default, so every URL that exists today keeps its
   * exact current meaning.
   */
  scope?: string;
  basis?: string;
}

/**
 * The params that identify a budget view. Anything else (UTMs, etc.) is noise.
 *
 * ⚠ `scope` and `basis` ARE identifying: switching series changes which figures
 * are on screen, so it is a real navigation and is counted as one.
 */
const IDENTIFYING_PARAMS = ['entity', 'year', 'dataset', 'lens', 'scope', 'basis'] as const;

/**
 * Build the canonical search string for a budget view. Key order is fixed here
 * so the URL a visitor sees is stable no matter which code path set it.
 */
export function buildBudgetSearch(loc: BudgetLocation): string {
  const params = new URLSearchParams({
    entity: loc.entity,
    year: loc.year,
    dataset: loc.dataset,
  });
  // The lens param appears only for the federal agency lens (Phase 45).
  if (loc.lens === 'agency') params.set('lens', 'agency');
  // SCOPE-03: only a DELIBERATE series choice is serialized. Both or neither —
  // half a series key cannot be resolved back to a series.
  if (loc.scope && loc.basis) {
    params.set('scope', loc.scope);
    params.set('basis', loc.basis);
  }
  return `?${params.toString()}`;
}

/**
 * True when two search strings point at the same budget view, ignoring key
 * order and any non-identifying params. `null` and `''` are treated as "no
 * budget", which is how the landing screen reads.
 */
export function isSameBudgetView(a: string, b: string): boolean {
  const pa = new URLSearchParams(a);
  const pb = new URLSearchParams(b);
  return IDENTIFYING_PARAMS.every(k => (pa.get(k) ?? '') === (pb.get(k) ?? ''));
}

/**
 * Decide whether moving to `next` is a real navigation from `currentSearch`.
 *
 * Returns the canonical search string to push and whether the view actually
 * changed. Callers push history and capture a pageview only when `changed` is
 * true — that guard is what keeps the initial deep-link load from being counted
 * twice, since PostHog has already captured a pageview for it by the time the
 * app resolves the same entity out of the URL.
 */
export function resolveUrlSync(
  next: BudgetLocation,
  currentSearch: string
): { search: string; changed: boolean } {
  const search = buildBudgetSearch(next);
  return { search, changed: !isSameBudgetView(search, currentSearch) };
}
