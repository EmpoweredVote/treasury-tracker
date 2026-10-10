import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BudgetIcicle from './BudgetIcicle';
import CategoryList from './CategoryList';
import { sortCategoriesByAmount } from '../data/sortCategories';
import {
  NYC_CURRENT_OPERATIONS,
  NYC_CURRENT_OPERATIONS_TOTAL,
  NYC_DEBT_SERVICE,
  nycCurrentOperationsNode,
} from '../data/__fixtures__/nycCurrentOperations';
import type { BudgetCategory } from '../types/budget';

/**
 * ⚠⚠ THE BAR AND THE CARD UNDER IT ARE ONE LIST. THIS IS WHERE THEY ARE MADE TO
 * AGREE, AGAINST THE MARKUP A READER ACTUALLY GETS.
 *
 * Reported on New York City FY2002, 2026-10-10, three symptoms and three
 * separate causes:
 *
 *   1. every bar under `Current Operations` was the same blue — the icicle
 *      coloured a drilled level by its ROOT's hue with only lightness varying,
 *      while the cards coloured by position across ten hues;
 *   2. the order was the ACFR's printed function order (General Government,
 *      Public safety $7.3B, Education $13.5B, City University $0.4B …) because
 *      nothing in the UI ever sorted;
 *   3. the bar said `$13.5B` where the card said `$13480.9M`, because only two
 *      of fourteen hand-rolled money formatters had a billions tier.
 *
 * Unit tests cover each cause. This file covers the thing a reader sees, which
 * is the three of them TOGETHER — and it is the only gate that would catch the
 * icicle and the card grid drifting apart again, since they share no code path
 * beyond the palette and the formatter.
 *
 * ⚠ `renderToStaticMarkup` needs no DOM, so this runs in the repo's `node`
 * environment as a `.test.ts`. See `LineItemsTable.render.test.ts`.
 */

/**
 * ⚠ The real level, all fifteen functions — see the fixture for why an
 * abridged copy changes every segment's width.
 */
const FUNCTIONS = NYC_CURRENT_OPERATIONS;
const CURRENT_OPS_TOTAL = NYC_CURRENT_OPERATIONS_TOTAL;

/** What `dataLoader` hands every view: one tree, sorted once. */
const sorted = () => sortCategoriesByAmount(FUNCTIONS);

function renderIcicle(functions: BudgetCategory[]): string {
  const currentOps = nycCurrentOperationsNode(functions);
  return renderToStaticMarkup(createElement(BudgetIcicle, {
    categories: [currentOps, NYC_DEBT_SERVICE],
    navigationPath: [currentOps],
    totalBudget: CURRENT_OPS_TOTAL + NYC_DEBT_SERVICE.amount,
    onPathClick: () => {},
  } as never));
}

const renderCards = (functions: BudgetCategory[]) =>
  renderToStaticMarkup(createElement(CategoryList, {
    categories: functions, onCategoryClick: () => {},
  } as never));

/** Fills of the CURRENT (deepest) icicle level, left to right. */
function barFills(html: string): string[] {
  const current = html.slice(html.lastIndexOf('icicle-level current'));
  return [...current.matchAll(/background-color:\s*([^;"]+)/g)].map((m) => m[1].trim());
}

/** Widths of the current level, left to right. */
function barWidths(html: string): number[] {
  const current = html.slice(html.lastIndexOf('icicle-level current'));
  return [...current.matchAll(/width:\s*([\d.]+)%/g)].map((m) => Number(m[1]));
}

/**
 * The card tile fills, left to right. Each card paints TWO elements with the
 * hue — the faint percentage bar and the icon tile — so they come in pairs and
 * the first of each pair is taken.
 */
function cardFills(html: string): string[] {
  const all = [...html.matchAll(/background-color:\s*([^;"]+)/g)].map((m) => m[1].trim());
  return all.filter((_, i) => i % 2 === 0);
}

describe('the icicle and the cards render one list', () => {
  it('gives the Nth bar and the Nth card the same colour', () => {
    // ⚠⚠ SYMPTOM 1, as markup. Before the fix this was ten identical teals
    // against ten different card hues.
    const fns = sorted();
    const bars = barFills(renderIcicle(fns));
    const cards = cardFills(renderCards(fns));
    expect(bars).toHaveLength(FUNCTIONS.length);
    expect(cards).toHaveLength(FUNCTIONS.length);
    expect(bars).toEqual(cards);
  });

  it('draws no two adjacent bars in the same colour', () => {
    const bars = barFills(renderIcicle(sorted()));
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i]).not.toBe(bars[i - 1]);
    }
  });

  it('never widens a bar as it moves right', () => {
    // ⚠ SYMPTOM 2. The ACFR order put $7.3B left of $13.5B and a 5.2% block at
    // the far left with no room for its label.
    const widths = barWidths(renderIcicle(sorted()));
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeLessThanOrEqual(widths[i - 1]);
    }
  });

  it('opens the level with the biggest function, not the first one printed', () => {
    const html = renderIcicle(sorted());
    const current = html.slice(html.lastIndexOf('icicle-level current'));
    expect(current.indexOf('Education')).toBeLessThan(current.indexOf('General Government'));
    expect(current.indexOf('Social services')).toBeLessThan(current.indexOf('Public safety'));
  });

  it('prints the same money string in the bar and in the card', () => {
    // ⚠⚠ SYMPTOM 3, stated as the two literals that disagreed on screen.
    const fns = sorted();
    const bar = renderIcicle(fns);
    const cards = renderCards(fns);
    expect(bar).toContain('$13.5B');
    expect(cards).toContain('$13.5B');
    expect(cards).not.toContain('13480.9M');
    expect(bar).not.toContain('13480.9M');
  });

  it('keeps a sub-billion function in millions in both', () => {
    const fns = sorted();
    expect(renderIcicle(fns)).toContain('$428.5M');
    expect(renderCards(fns)).toContain('$428.5M');
  });
});
