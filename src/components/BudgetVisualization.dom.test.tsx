// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import BudgetVisualization from './BudgetVisualization';
import type { BudgetCategory } from '../types/budget';

/**
 * AUDIT-GRADE §5.2 — the chart's own source line.
 *
 * ⚠ The nonprofit gate is the property the plan named and nothing pinned: for
 * Empowered Vote's own books these are INAPPLICABLE questions, not unanswered
 * ones (#198), so App.tsx passes no citation at all. "Absent renders nothing"
 * is what makes that gate work, and it is asserted here rather than left to a
 * reader of App.tsx to infer.
 *
 * ⚠ jsdom does NO LAYOUT — presence and element kind only.
 */
describe('BudgetVisualization citation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const categories: BudgetCategory[] = [
    { name: 'Public Safety', amount: 1000, percentage: 100 } as BudgetCategory,
  ];

  const mount = (citation?: string) => {
    act(() => {
      root.render(createElement(BudgetVisualization, {
        categories, navigationPath: [], totalBudget: 1000,
        onPathClick: () => {}, citation,
      }));
    });
  };

  const CITE = 'Government-reported · All Funds · CA State Controller · FY 2025';

  it('prints the citation it is given', () => {
    mount(CITE);
    expect(host.textContent ?? '').toContain(CITE);
  });

  // ⚠⚠ The nonprofit gate depends on this. A placeholder here would put the
  // audit vocabulary on a page where it does not apply.
  it('prints nothing at all when given no citation', () => {
    mount(undefined);
    const text = host.textContent ?? '';
    expect(text).not.toMatch(/·/);
    expect(text).not.toMatch(/Government-reported|not established|not recorded/);
  });

  // ⚠ Plain text, never a link and never a button: it states, it does not
  // afford. The explainer lives on the grade chip in the source bar above.
  it('renders the citation as inert text', () => {
    mount(CITE);
    const el = [...host.querySelectorAll('p')].find((p) => p.textContent?.includes(CITE));
    expect(el, 'citation is not a <p>').toBeTruthy();
    expect(el!.closest('a')).toBeNull();
    expect(el!.closest('button')).toBeNull();
  });
});
