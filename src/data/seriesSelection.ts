/**
 * SCOPE-03 — which series is the reader looking at.
 *
 * SCOPE-02 established that a series is (entity, dataset_type, fund_scope, basis)
 * and had `chooseDisplaySeries` pick exactly one and hold it. That removed the
 * Long Beach cliff, and its unavoidable side effect was that every series it did
 * not pick became unreachable — 91 rows across 17 entities, present in the
 * database and absent from the UI.
 *
 * This module enumerates what is available so the reader can choose. It is PURE:
 * no fetch, no DOM, no React. Spec: docs/superpowers/specs/2026-08-18-scope-03-design.md
 *
 * The dependency runs one way — seriesSelection -> budgetSeries -> fundScopeVocabulary
 * — and never back. SCOPE-02 Ruling 1 records why: Vite/Vitest resolution of mixed
 * type+value import cycles is fragile, and one nearly shipped.
 */

import {
  seriesLabel, isEvidenced, SCOPE_RANK, BASIS_RANK,
  type SeriesKey, type DatasetEntry,
} from './budgetSeries';
import { normalizeScope, normalizeBasis } from './fundScopeVocabulary';

/**
 * The dataset types that participate in series selection.
 *
 * ⚠ `salaries` is deliberately absent. All 7,886 salary rows are
 * fund_scope='unknown', and dataset_type='salaries' is a TWO-level tree with no
 * `i` array — a different shape from the budget tree entirely. It keeps its own
 * tab and its current behaviour. `all_funds_requirements` and `federal_agency`
 * are likewise out: neither is a Money In / Money Out tile.
 */
export const SERIES_DATASETS: readonly string[] = ['operating', 'revenue'] as const;

export interface SeriesCoverage {
  /** Ascending, de-duplicated. */
  years: number[];
  min: number;
  max: number;
}

export interface AvailableSeries {
  key: SeriesKey;
  /** Stable identity, `${fundScope}|${basis}`. Used for React keys and URL matching. */
  id: string;
  /** Reader-facing name, e.g. "All Funds · actuals". */
  label: string;
  /** Per-dataset coverage. A dataset ABSENT from this map has no row in this series. */
  coverage: Record<string, SeriesCoverage>;
  /** Union of coverage across datasets. */
  span: { min: number; max: number };
  /** Distinct fiscal years across all datasets — the ordering weight. */
  totalYears: number;
}

export function seriesId(k: SeriesKey): string {
  return `${k.fundScope}|${k.basis}`;
}

/**
 * Every series available for this entity, widest and best-evidenced first.
 *
 * ⚠ UNION across datasets, never intersection. A series present on only one side
 * must stay reachable, with the other side rendering absent — that is the whole
 * of the display rule (spec §3). An intersection would make Fresno's FY2020–26
 * adopted operating figures permanently invisible.
 */
export function listSeries(datasets: DatasetEntry[]): AvailableSeries[] {
  const acc = new Map<string, { key: SeriesKey; years: Map<string, Set<number>> }>();

  for (const d of datasets) {
    if (!SERIES_DATASETS.includes(d.dataset_type)) continue;
    const key: SeriesKey = {
      fundScope: normalizeScope(d.fund_scope),
      basis: normalizeBasis(d.basis),
    };
    const id = seriesId(key);
    if (!acc.has(id)) acc.set(id, { key, years: new Map() });
    const entry = acc.get(id)!;
    if (!entry.years.has(d.dataset_type)) entry.years.set(d.dataset_type, new Set());
    entry.years.get(d.dataset_type)!.add(d.fiscal_year);
  }

  const out: AvailableSeries[] = [];
  for (const [id, { key, years }] of acc) {
    const coverage: Record<string, SeriesCoverage> = {};
    const all = new Set<number>();
    for (const [dataset, set] of years) {
      const sorted = [...set].sort((a, b) => a - b);
      coverage[dataset] = { years: sorted, min: sorted[0], max: sorted[sorted.length - 1] };
      for (const y of sorted) all.add(y);
    }
    const allSorted = [...all].sort((a, b) => a - b);
    out.push({
      key, id, label: seriesLabel(key), coverage,
      span: { min: allSorted[0], max: allSorted[allSorted.length - 1] },
      totalYears: allSorted.length,
    });
  }

  // Same comparator shape as chooseDisplaySeries, sharing its exported ranks, so
  // the first pill is always the series the app defaults to.
  out.sort((a, b) =>
    Number(isEvidenced(b.key)) - Number(isEvidenced(a.key))
    || b.totalYears - a.totalYears
    || BASIS_RANK[b.key.basis] - BASIS_RANK[a.key.basis]
    || SCOPE_RANK[b.key.fundScope] - SCOPE_RANK[a.key.fundScope]);

  return out;
}
