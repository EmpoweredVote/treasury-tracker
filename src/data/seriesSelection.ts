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
 * The period tokens this series can actually RENDER for one dataset.
 *
 * Narrower than `seriesPeriodTokens` on purpose. That function keeps years held
 * only by a non-series dataset so the Employees tab stays reachable -- correct
 * for the year PICKER, and the reason the year clamp had a hole: a salaries-only
 * year looks available while the selected budget series has no row for it.
 */
export function seriesDatasetTokens(
  datasets: DatasetEntry[],
  series: SeriesKey,
  activeDataset: string,
): string[] {
  const kept = datasets.filter((dd) =>
    dd.dataset_type === activeDataset
    && normalizeScope(dd.fund_scope) === series.fundScope
    && normalizeBasis(dd.basis) === series.basis);
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

/**
 * Where the reader should land when they pick a series.
 *
 * ⚠ The year clamp in App.tsx cannot use the PICKER list. `seriesPeriodTokens`
 * keeps years held only by a non-series dataset so the Employees tab stays
 * reachable, so for Anaheim -- budget series FY2003-24 and FY2025-26, salaries
 * FY2009-24 -- FY2024 is in the picker while the adopted series has no operating
 * row for it. The clamp saw an available year, returned early, and left the
 * reader on a blank tile whose copy told them to choose the set they had just
 * chosen. Found by UAT 2026-08-21; no unit test had an entity with salaries AND
 * disjoint budget series.
 *
 * `moved` is returned rather than inferred by the caller comparing tokens, so the
 * reader can be TOLD they were relocated instead of silently moved.
 *
 * Stays put in three cases, each deliberate:
 *  - no series selected: nothing to move into;
 *  - the active dataset is not a series dataset (Employees): its own year wins;
 *  - the series has NO row for this dataset at all (Fresno revenue/adopted,
 *    Longview). There is nowhere to clamp TO, and the display rule wants the
 *    absent state shown with the toggle still usable -- not a relocation.
 */
export function resolveSeriesYear(
  datasets: DatasetEntry[],
  series: SeriesKey | null,
  activeDataset: string,
  currentToken: string,
): { token: string; moved: boolean } {
  const stay = { token: currentToken, moved: false };
  if (!series) return stay;
  // A budget dataset is judged on the rows the series has FOR IT. A non-series
  // dataset (Employees) is judged on the picker list instead, so a series choice
  // never drags a valid Employees year -- while a year outside the picker
  // altogether is still rescued rather than stranding the reader on a blank.
  const tokens = SERIES_DATASETS.includes(activeDataset)
    ? seriesDatasetTokens(datasets, series, activeDataset)
    : seriesPeriodTokens(datasets, series);
  if (tokens.length === 0 || tokens.includes(currentToken)) return stay;
  return { token: clampYearToSeries(currentToken, tokens), moved: true };
}

/**
 * Should picking up a new entity clear the reader's series choice?
 *
 * Yes on a real CHANGE — a series Modesto has, Natick will not, and carrying it
 * over drops the reader into an absent state on arrival (spec §5).
 *
 * ⚠ NO on first sight. Keyed on the entity VALUE, the reset also fired once on
 * mount, AFTER the URL-restore batch had decoded `?scope=&basis=` for that same
 * entity — wiping the restored selection, which made the URL sync drop both
 * params, so a shared link silently showed a DIFFERENT series than the one sent.
 * The year had already been resolved from the URL, so the page rendered FY2025
 * adopted figures under an "All Funds · actuals, FY 2024" label. UAT 2026-08-21.
 */
export function shouldResetSeries(
  previousEntityId: string | null,
  nextEntityId: string | null,
): boolean {
  return previousEntityId !== null && previousEntityId !== nextEntityId;
}

/**
 * The fiscal year to land on when arriving at an entity.
 *
 * ⚠ NOT the newest row the entity has. The old rule was `operatingYears[0]`, the
 * max across ALL operating rows; once an entity gained an adopted FY2025-26
 * series that became FY2026, which the DEFAULT series (all_funds/actual,
 * FY2003-24) has no row for. The first render then asked for a year the default
 * series cannot render, the page asserted the figure "is not published" while it
 * demonstrably is, and it only corrected once the clamp fired and every dataset
 * refetched. Measured on production 2026-08-21: Anaheim wrong for 11.8s, Long
 * Beach 10.2s, San Diego 10.1s, Fresno 8.5s, at ~10 budget requests instead of ~3.
 *
 * An explicit requested year still wins, so a deep link keeps working and the
 * clamp remains responsible for correcting it.
 *
 * `referenceDataset` is 'operating' because the dataset is resolved FROM the year
 * at the call sites; using the active dataset here would be circular. That
 * matches what the old `operatingYears` rule already assumed.
 */
export function initialYearForEntity(
  datasets: DatasetEntry[],
  requestedYear: string | null,
  referenceDataset: string = 'operating',
): string {
  const entityYears = [...new Set(datasets.map((dd) => dd.fiscal_year))].sort((a, b) => b - a);
  if (requestedYear && entityYears.includes(parsePeriod(requestedYear).fiscalYear)) {
    return requestedYear;
  }
  const seed = defaultSeries(datasets, referenceDataset);
  if (seed) {
    const tokens = seriesDatasetTokens(datasets, seed, referenceDataset);
    if (tokens.length > 0) return tokens[0];
  }
  const referenceYears = [...new Set(
    datasets.filter((dd) => dd.dataset_type === referenceDataset).map((dd) => dd.fiscal_year),
  )].sort((a, b) => b - a);
  if (referenceYears.length > 0) return String(referenceYears[0]);
  return entityYears.length > 0 ? String(entityYears[0]) : '2025';
}

/**
 * Reader-facing coverage span: "FY2003–24", or "FY2026" for a single year.
 *
 * ⚠ The two-digit abbreviation is DROPPED across a century boundary. "FY1998–03"
 * reads as a backwards range; "FY1998–2003" cannot be misread. Connecticut and
 * Wisconsin both carry pre-2000 series, so this is a live case, not a hypothetical.
 *
 * Lives here rather than in FundSeriesToggle because this repo collects no
 * `.test.tsx` and has no DOM environment, so logic inside a component cannot be
 * tested at all. See the plan's File Structure note.
 */
export function spanLabel(span: { min: number; max: number }): string {
  if (span.min === span.max) return `FY${span.min}`;
  const sameCentury = Math.floor(span.min / 100) === Math.floor(span.max / 100);
  return sameCentury
    ? `FY${span.min}–${String(span.max).slice(-2)}`
    : `FY${span.min}–${span.max}`;
}
