/**
 * Data Loader
 *
 * Handles loading budget data from the API.
 * API is the sole data source — no JSON file fallback, no hardcoded placeholder data (per D-06).
 */

import type { BudgetData, BudgetCategory, LinkedTransactionSummary, Municipality, SearchResult } from '../types/budget';

// In dev: use /api which Vite proxies to the backend (avoids CORS).
// In production: no proxy exists, so use the full API URL directly.
const API_BASE = import.meta.env.PROD && import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Cache structure to support multiple municipality/year/dataset combinations
const cache: Map<string, BudgetData> = new Map();

/**
 * Load budget data for a specific municipality and year.
 * Throws on API failure — callers must handle errors (no silent fallback).
 */
export async function loadBudgetData(
  year: number = 2025,
  municipalityName: string = 'Bloomington',
  municipalityState: string = 'IN',
  dataset: string = 'operating'
): Promise<BudgetData> {
  const cacheKey = `${municipalityName}-${municipalityState}-${year}-${dataset}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Step 1: Find the city by name from /treasury/cities
  const citiesResponse = await fetch(`${API_BASE}/treasury/cities`);
  if (!citiesResponse.ok) {
    throw new Error(`Cities API returned ${citiesResponse.status}`);
  }
  const cities = await citiesResponse.json();
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
  const budget = budgets.find((b: any) => b.dataset_type === dataset) ?? budgets[0];
  if (!budget?.id) {
    throw new Error(`No budget found for ${municipalityName} ${year} (${dataset})`);
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
      totalBudget: budget.total_budget || budget.totalBudget,
      generatedAt: budget.generated_at || budget.generatedAt || new Date().toISOString(),
      hierarchy: budget.hierarchy || [],
      dataSource: budget.data_source || budget.dataSource || 'API',
      dataSourceInfo: budget.data_source_info || budget.dataSourceInfo || null,
      datasetType: budget.dataset_type || budget.datasetType
    },
    categories: categories
  };
}

/**
 * Clear the cache (useful for testing or reloading data)
 */
export function clearCache() {
  cache.clear();
  txCache.clear();
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
