/**
 * Tests for spaUrl.ts — the SPA route-change detector behind Treasury's manual
 * pageview capture.
 *
 * The behaviour under test is not "does it build a query string" but "does it
 * fire exactly once per real navigation". Both failure directions cost us a
 * measurable number: missing a navigation leaves the denominator unbuildable
 * (the bug this fixes), and firing on a non-navigation inflates it.
 */

import { describe, it, expect } from 'vitest';
import { buildBudgetSearch, isSameBudgetView, resolveUrlSync } from './spaUrl';

const seattle = { entity: 'seattle-wa', year: '2025', dataset: 'operating' };

describe('buildBudgetSearch — canonical shape', () => {
  it('serializes the three always-present params in a fixed order', () => {
    expect(buildBudgetSearch(seattle)).toBe('?entity=seattle-wa&year=2025&dataset=operating');
  });

  it('appends the lens param only for the federal agency lens', () => {
    expect(buildBudgetSearch({ ...seattle, lens: 'agency' })).toContain('&lens=agency');
    expect(buildBudgetSearch({ ...seattle, lens: 'function' })).not.toContain('lens');
    expect(buildBudgetSearch({ ...seattle, lens: undefined })).not.toContain('lens');
  });

  it('encodes values rather than concatenating them raw', () => {
    const search = buildBudgetSearch({ ...seattle, year: 'TQ 1976' });
    expect(search).toContain('year=TQ+1976');
  });
});

describe('resolveUrlSync — fires on a real navigation', () => {
  it('counts landing-screen → first budget as a navigation', () => {
    expect(resolveUrlSync(seattle, '').changed).toBe(true);
  });

  it('counts a year change as a navigation', () => {
    const current = buildBudgetSearch(seattle);
    expect(resolveUrlSync({ ...seattle, year: '2024' }, current).changed).toBe(true);
  });

  it('counts a dataset change as a navigation', () => {
    const current = buildBudgetSearch(seattle);
    expect(resolveUrlSync({ ...seattle, dataset: 'revenue' }, current).changed).toBe(true);
  });

  it('counts an entity change as a navigation', () => {
    const current = buildBudgetSearch(seattle);
    expect(resolveUrlSync({ ...seattle, entity: 'tacoma-wa' }, current).changed).toBe(true);
  });

  it('counts the federal lens going on AND off as navigations', () => {
    const fn = buildBudgetSearch({ ...seattle, entity: 'federal-us' });
    const agency = buildBudgetSearch({ ...seattle, entity: 'federal-us', lens: 'agency' });
    expect(resolveUrlSync({ ...seattle, entity: 'federal-us', lens: 'agency' }, fn).changed).toBe(true);
    expect(resolveUrlSync({ ...seattle, entity: 'federal-us' }, agency).changed).toBe(true);
  });
});

describe('resolveUrlSync — does NOT fire when the view did not change', () => {
  it('is a no-op when every identifying param is identical', () => {
    const current = buildBudgetSearch(seattle);
    expect(resolveUrlSync(seattle, current).changed).toBe(false);
  });

  it('is a no-op when a deep link carries the same params in a different order', () => {
    // A shared/bookmarked link. PostHog already captured a pageview for this URL
    // on load; re-pushing a reordered copy would double-count one arrival.
    const shared = '?year=2025&dataset=operating&entity=seattle-wa';
    expect(resolveUrlSync(seattle, shared).changed).toBe(false);
  });

  it('is a no-op when the current URL carries extra campaign params', () => {
    const tagged = '?utm_source=newsletter&entity=seattle-wa&year=2025&dataset=operating';
    expect(resolveUrlSync(seattle, tagged).changed).toBe(false);
  });

  it('treats a missing lens and an explicit non-agency lens as the same view', () => {
    const current = buildBudgetSearch(seattle);
    expect(resolveUrlSync({ ...seattle, lens: 'function' }, current).changed).toBe(false);
  });

  it('still returns the canonical search string even when unchanged', () => {
    const shared = '?year=2025&dataset=operating&entity=seattle-wa';
    expect(resolveUrlSync(seattle, shared).search).toBe(buildBudgetSearch(seattle));
  });
});

describe('isSameBudgetView — direct', () => {
  it('treats two empty searches as the same (both "no budget")', () => {
    expect(isSameBudgetView('', '')).toBe(true);
  });

  it('distinguishes the landing screen from a budget', () => {
    expect(isSameBudgetView('', buildBudgetSearch(seattle))).toBe(false);
  });

  it('ignores a leading question mark difference', () => {
    expect(isSameBudgetView('entity=seattle-wa', '?entity=seattle-wa')).toBe(true);
  });
});
