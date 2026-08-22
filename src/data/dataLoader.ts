/**
 * Data Loader
 *
 * Handles loading budget data from the API.
 * API is the sole data source — no JSON file fallback, no hardcoded placeholder data (per D-06).
 */

import { normalizeScope, normalizeReportingEntity } from './fundScopeVocabulary';
import { chooseDisplaySeries, normalizeBasis, type SeriesKey } from './budgetSeries';
import type { BudgetData, BudgetCategory, FederalContext, LinkedTransactionSummary, Municipality, OrgFinancialSummary, SearchResult } from '../types/budget';

/**
 * The chosen series genuinely has no row for this dataset and year.
 *
 * ⚠ A DISTINCT type, not a plain Error, and load-bearing. `pickBudgetForSeries`
 * already returns undefined rather than substituting another series' figure —
 * that is SCOPE-02's fix. But turning that into a plain throw makes it
 * indistinguishable from a network failure at the call site, so the UI shows an
 * error screen where the honest answer is "this series has no Money In figure
 * for FY2025". Substituting would be worse; failing loudly is merely wrong.
 */
export class SeriesAbsentError extends Error {
  // ⚠ Declared and assigned explicitly, NOT as constructor parameter properties.
  // tsconfig sets `erasableSyntaxOnly`, which rejects `constructor(readonly x: T)`
  // with TS1294. `npm test` passes either way — only `npm run build` catches it,
  // which is why that is the gate.
  readonly dataset: string;
  readonly year: number;
  readonly series: SeriesKey;

  constructor(dataset: string, year: number, series: SeriesKey) {
    super(`No ${dataset} row for FY${year} in series ${series.fundScope}/${series.basis}`);
    this.name = 'SeriesAbsentError';
    this.dataset = dataset;
    this.year = year;
    this.series = series;
  }
}

// In dev: use /api which Vite proxies to the backend (avoids CORS).
// In production: no proxy exists, so use the full API URL directly.
const API_BASE = import.meta.env.PROD && import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Cache structure to support multiple municipality/year/dataset combinations
const cache: Map<string, BudgetData> = new Map();

/**
 * The city list, fetched at most once per session.
 *
 * ⚠ Memoize the PROMISE, not the resolved value. `loadBudgetData` resolves the
 * city by NAME from the full list, and the app loads operating + revenue +
 * salaries in a single `Promise.all` — so a value cache still fires N requests,
 * because none of them has resolved when the others start. Storing the in-flight
 * promise is what actually dedupes them.
 *
 * Measured on production 2026-08-21: this list was fetched 3-5 times per page
 * load (alaska-ak 3x, anaheim-ca 5x, modesto-ca 4x), serially, and the first
 * figure appeared right after the LAST one landed — 6.3s, 5.0s, 4.9s. It is
 * 12.3 MB decompressed (204 KB brotli on the wire), 94.7% of which is
 * `available_datasets` for 2,463 entities, to look up ONE id.
 *
 * ⚠ A rejection must NOT be memoized, or one transient failure poisons the whole
 * session and every later load throws without ever retrying.
 */
let citiesPromise: Promise<Municipality[]> | null = null;

function fetchCityList(): Promise<Municipality[]> {
  if (!citiesPromise) {
    citiesPromise = (async () => {
      const res = await fetch(`${API_BASE}/treasury/cities`);
      if (!res.ok) throw new Error(`Cities API returned ${res.status}`);
      return res.json();
    })();
    citiesPromise.catch(() => { citiesPromise = null; });
  }
  return citiesPromise;
}

/**
 * Load budget data for a specific municipality and year.
 * Throws on API failure — callers must handle errors (no silent fallback).
 */
export async function loadBudgetData(
  year: number = 2025,
  municipalityName: string = 'Bloomington',
  municipalityState: string = 'IN',
  dataset: string = 'operating',
  periodLabel: string | null = null,
  series: SeriesKey | null = null
): Promise<BudgetData> {
  // ⚠ THE SERIES IS PART OF THE KEY. Before SCOPE-03 the series was chosen
  // deterministically inside this function and never varied for a given key, so
  // omitting it was harmless. The moment the CALLER can choose, omitting it
  // returns the previously cached other-series figure — a city would report its
  // all-funds total under a General Fund pill. Pinned by dataLoader.series.test.ts,
  // and that test is mutation-verified: it fails 900 === 100 without this.
  const seriesPart = series ? `${series.fundScope}|${series.basis}` : '';
  const cacheKey =
    `${municipalityName}-${municipalityState}-${year}-${dataset}-${periodLabel ?? ''}-${seriesPart}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Step 1: Find the city by name — from the memoized list, see fetchCityList.
  const cities = await fetchCityList();
  const city = cities.find((c: any) =>
    c.name?.toLowerCase() === municipalityName.toLowerCase() &&
    (!municipalityState || c.state?.toLowerCase() === municipalityState.toLowerCase())
  );
  if (!city?.id) {
    throw new Error(`City not found: ${municipalityName}, ${municipalityState}`);
  }

  // Step 2: Get budgets for this city, filtered by fiscal year
  const budgetsUrl = `${API_BASE}/treasury/cities/${city.id}/budgets?fiscal_year=${year}`;
  const response = await fetch(budgetsUrl);
  if (!response.ok) {
    throw new Error(`Budget API returned ${response.status}`);
  }

  const apiData = await response.json();
  const budgets = Array.isArray(apiData) ? apiData : [apiData];
  // SCOPE-02: choose the one series to display for this city/dataset, then pick
  // the row belonging to it. Disambiguates by period_label along the way: a
  // normal year wants the null-label row; the Transition Quarter wants its
  // labeled row.
  // An explicit series from the caller wins; otherwise fall back to SCOPE-02's
  // automatic choice, which is what every pre-SCOPE-03 caller relies on.
  const effectiveSeries = series ?? chooseDisplaySeries(city.available_datasets ?? [], dataset);
  const budget = pickBudgetForSeries(budgets, dataset, periodLabel ?? null, effectiveSeries);
  if (!budget?.id) {
    const datasetHasRows = budgets.some((b: any) => b.dataset_type === dataset);
    if (effectiveSeries && datasetHasRows) {
      // The dataset exists for this city-year but not in the chosen series. The
      // caller renders an absent tile; it must not render an error screen.
      throw new SeriesAbsentError(dataset, year, effectiveSeries);
    }
    throw new Error(
      `No budget found for ${municipalityName} ${year} (${dataset})`
      + (effectiveSeries ? ` in the displayed series ${effectiveSeries.fundScope}/${effectiveSeries.basis}` : ''),
    );
  }

  // Step 3: Get categories for the budget (returns nested tree with lineItems)
  const catResponse = await fetch(`${API_BASE}/treasury/budgets/${budget.id}/categories`);
  if (!catResponse.ok) {
    throw new Error(`Categories API returned ${catResponse.status}`);
  }
  const categories = await catResponse.json();

  const data = transformAPIResponse(budget, categories, city);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Fetch linked transactions for a specific category by link_key.
 * Uses prefix matching on the server so "fire" returns all transactions
 * under fire|main|general|..., enabling transaction display at every drill-down level.
 *
 * Results are cached per budget+linkKey to avoid redundant fetches.
 */
const txCache: Map<string, LinkedTransactionSummary | null> = new Map();

export async function loadLinkedTransactions(
  budgetId: string,
  linkKey: string,
  limit: number = 20
): Promise<LinkedTransactionSummary | null> {
  const cacheKey = `${budgetId}:${linkKey}:${limit}`;
  if (txCache.has(cacheKey)) {
    return txCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `${API_BASE}/treasury/budgets/${budgetId}/transactions?link_key=${encodeURIComponent(linkKey)}&limit=${limit}`
    );
    if (!response.ok) return null;

    const summary: LinkedTransactionSummary | null = await response.json();
    txCache.set(cacheKey, summary);
    return summary;
  } catch (err) {
    console.warn('Failed to load linked transactions:', err);
    return null;
  }
}

/**
 * Pick the budget row belonging to the chosen series.
 *
 * ⚠ Replaces `budgets.find(b => b.dataset_type === dataset)`. Once a city-year
 * can hold two rows differing only by fund_scope/basis, that returned whichever
 * row Postgres happened to order first — Long Beach FY2024 would have displayed
 * $2.4B or $2.3B non-deterministically.
 *
 * Returning `undefined` when the chosen series has no row for this year is
 * correct and load-bearing: the caller renders a GAP. Substituting another
 * series' figure is exactly the defect this milestone removes.
 */
export function pickBudgetForSeries(
  budgets: any[],
  dataset: string,
  periodLabel: string | null,
  series: SeriesKey | null,
): any | undefined {
  const sameSlot = budgets.filter(
    (b: any) => b.dataset_type === dataset && (b.period_label ?? null) === (periodLabel ?? null),
  );

  if (!series) {
    // No series chosen (e.g. the API has not deployed the new columns yet):
    // preserve the previous behaviour rather than failing closed.
    return sameSlot[0] ?? budgets.find((b: any) => b.dataset_type === dataset);
  }

  return sameSlot.find(
    (b: any) => normalizeScope(b.fund_scope) === series.fundScope
             && normalizeBasis(b.basis) === series.basis,
  );
}

/**
 * Transform API response to BudgetData format.
 * City object is passed separately since ev-accounts budgets don't embed municipality.
 */
function transformAPIResponse(budget: any, categories: BudgetCategory[], city?: any): BudgetData {
  return {
    budgetId: budget.id,
    metadata: {
      cityName: city?.name || budget.municipality?.name || 'Unknown',
      fiscalYear: budget.fiscal_year || budget.fiscalYear,
      population: city?.population || budget.municipality?.population || 0,
      totalBudget: budget.total_budget ?? budget.totalBudget ?? 0,
      generatedAt: budget.generated_at || budget.generatedAt || new Date().toISOString(),
      hierarchy: budget.hierarchy || [],
      dataSource: budget.data_source || budget.dataSource || 'API',
      dataSourceInfo: budget.data_source_info || budget.dataSourceInfo || null,
      datasetType: budget.dataset_type || budget.datasetType,
      // SCOPE-01: normalise here so every consumer sees a legal value. An absent
      // field becomes 'unknown' rather than undefined, which is the honest reading
      // of "the API has not told us" and survives the pre-deploy window.
      fundScope: normalizeScope(budget.fund_scope),
      basis: normalizeBasis(budget.basis),
      reportingEntity: normalizeReportingEntity(budget.reporting_entity)
    },
    categories: categories
  };
}

/**
 * Clear the cache (useful for testing or reloading data)
 */
export function clearCache() {
  cache.clear();
  citiesPromise = null;
  txCache.clear();
  orgSummaryCache.clear();
}

/**
 * Search budget categories by keyword across enriched names, descriptions, and tags.
 * Optionally scoped to a specific city ID and/or fiscal year.
 */
export async function searchBudget(
  query: string,
  cityId?: string,
  year?: number,
  limit: number = 20
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) });
  if (cityId) params.set('city_id', cityId);
  if (year) params.set('year', String(year));

  try {
    const response = await fetch(`${API_BASE}/treasury/search?${params}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (err) {
    console.warn('Search failed:', err);
    return [];
  }
}

/**
 * Get a list of available municipalities from the API
 */
export async function listMunicipalities(): Promise<Municipality[]> {
  const response = await fetch(`${API_BASE}/treasury/cities`);
  if (!response.ok) {
    throw new Error(`Cities API returned ${response.status}`);
  }
  return await response.json();
}

// ── Federal context (Phase 45) ────────────────────────────────────────────────
// Always-sourced landing data for the United States entity. Cached for the
// session; throws on failure — no fallback figures, ever (D-06 + v2.0 rule 3).

let federalContextCache: FederalContext | null = null;

export async function loadFederalContext(): Promise<FederalContext> {
  if (federalContextCache) return federalContextCache;

  const response = await fetch(`${API_BASE}/treasury/federal/context`);
  if (!response.ok) {
    throw new Error(`Federal context API returned ${response.status}`);
  }
  const context: FederalContext = await response.json();
  if (!context.annual_summary?.length) {
    throw new Error('Federal context API returned no annual summary rows');
  }
  federalContextCache = context;
  return context;
}

// ── Org financial summary (Phase 76) ──────────────────────────────────────────
// Reconciled per-org financial summary for a nonprofit (EV). Always-sourced;
// throws on failure — no fallback figures (D-06 + v2.0 rule 3). Cached per
// (orgId, fiscalYear) for the session.

const orgSummaryCache: Map<string, OrgFinancialSummary> = new Map();

export async function loadOrgFinancialSummary(
  orgId: string,
  fiscalYear: number
): Promise<OrgFinancialSummary> {
  const cacheKey = `${orgId}:${fiscalYear}`;
  if (orgSummaryCache.has(cacheKey)) return orgSummaryCache.get(cacheKey)!;

  const response = await fetch(
    `${API_BASE}/treasury/orgs/${orgId}/financial-summary?fiscal_year=${fiscalYear}`
  );
  if (!response.ok) {
    throw new Error(`Org financial summary API returned ${response.status}`);
  }
  const summary: OrgFinancialSummary = await response.json();
  orgSummaryCache.set(cacheKey, summary);
  return summary;
}
