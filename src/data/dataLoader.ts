/**
 * Data Loader
 *
 * Handles loading budget data from the API.
 * API is the sole data source — no JSON file fallback, no hardcoded placeholder data (per D-06).
 */

import type { BudgetData, BudgetCategory, Municipality } from '../types/budget';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
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

  // Step 2: Get budgets for this city, optionally filtered by fiscal year
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

  // Step 3: Get categories for the budget
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
 * Transform API response to BudgetData format
 */
function transformAPIResponse(budget: any, categories: BudgetCategory[], city?: any): BudgetData {
  return {
    metadata: {
      cityName: city?.name || budget.municipality?.name || 'Unknown',
      fiscalYear: budget.fiscal_year || budget.fiscalYear,
      population: city?.population || budget.municipality?.population || 0,
      totalBudget: budget.total_budget || budget.totalBudget,
      generatedAt: budget.generated_at || budget.generatedAt || new Date().toISOString(),
      hierarchy: budget.hierarchy || [],
      dataSource: budget.data_source || budget.dataSource || 'API',
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
