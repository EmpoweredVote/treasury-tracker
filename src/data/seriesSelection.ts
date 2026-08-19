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
  chooseDisplaySeries, seriesLabel, isEvidenced, SCOPE_RANK, BASIS_RANK,
  type SeriesKey, type DatasetEntry,
} from './budgetSeries';
import {
  normalizeScope, normalizeBasis, FUND_SCOPE_VALUES, BASIS_VALUES,
} from './fundScopeVocabulary';
import { buildPeriodTokens, parsePeriod } from '../utils/period';

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

/**
 * The series the app selects when the reader has not chosen one.
 *
 * ⚠ Delegates to `chooseDisplaySeries` rather than reimplementing its rule. That
 * is the load-bearing invariant of this milestone: on first paint every entity
 * shows exactly the figure it shows today (spec §2, and §3.1 for the one
 * measured exception).
 *
 * When the active dataset has no rows — the Employees tab, or Longview's
 * operating side viewed from revenue — fall back to the widest entity-level
 * series rather than returning null, so the control still has a selection.
 */
export function defaultSeries(datasets: DatasetEntry[], activeDataset: string): SeriesKey | null {
  const forActive = chooseDisplaySeries(datasets, activeDataset);
  if (forActive) return forActive;
  return listSeries(datasets)[0]?.key ?? null;
}

export function encodeSeries(k: SeriesKey): { scope: string; basis: string } {
  return { scope: k.fundScope, basis: k.basis };
}

/**
 * Resolve URL params to a series this entity actually has, or null to default.
 *
 * ⚠ VALIDATE BEFORE NORMALISING. `normalizeScope('garbage')` returns `'unknown'`
 * by design — absent means unknown, never a guess. Normalising here first would
 * turn a garbage URL into a silent selection of the entity's unknown series
 * instead of a fallback to the default. Check the raw strings against the legal
 * value lists, then match.
 */
export function decodeSeries(
  scope: string | null,
  basis: string | null,
  available: AvailableSeries[],
): SeriesKey | null {
  if (!scope || !basis) return null;
  if (!(FUND_SCOPE_VALUES as readonly string[]).includes(scope)) return null;
  if (!(BASIS_VALUES as readonly string[]).includes(basis)) return null;
  return available.find((s) => s.id === `${scope}|${basis}`)?.key ?? null;
}

/**
 * The selectable period tokens for the chosen series.
 *
 * ⚠ The filter is applied to buildPeriodTokens' INPUT, never to its output. The
 * FY1976 Transition Quarter token is SYNTHESISED from a `period_label` row, so
 * filtering the token list would drop it or leave it orphaned after a year that
 * is no longer present.
 *
 * Years belonging only to a NON-series dataset (salaries, all_funds_requirements,
 * federal_agency) are kept: the Employees tab must stay reachable in a year the
 * chosen budget series does not cover.
 */
export function seriesPeriodTokens(
  datasets: DatasetEntry[],
  series: SeriesKey | null,
): string[] {
  if (!series) return buildPeriodTokens(datasets);
  const kept = datasets.filter((dd) => {
    if (!SERIES_DATASETS.includes(dd.dataset_type)) return true;
    return normalizeScope(dd.fund_scope) === series.fundScope
        && normalizeBasis(dd.basis) === series.basis;
  });
  return buildPeriodTokens(kept);
}

/**
 * Move a selected period to the nearest one the series offers.
 *
 * Ties resolve to the LATER year: `tokens` descends and the scan only replaces
 * on a strict improvement, so the first (most recent) candidate wins.
 */
export function clampYearToSeries(token: string, tokens: string[]): string {
  if (tokens.length === 0 || tokens.includes(token)) return token;
  const want = parsePeriod(token).fiscalYear;
  let best = tokens[0];
  let bestDistance = Infinity;
  for (const t of tokens) {
    const distance = Math.abs(parsePeriod(t).fiscalYear - want);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = t;
    }
  }
  return best;
}
