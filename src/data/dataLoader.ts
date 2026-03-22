/**
 * Data Loader
 *
 * Handles loading budget data from the API.
 * API is the sole data source — no JSON file fallback, no hardcoded placeholder data (per D-06).
 */

import type { BudgetData, BudgetCategory } from '../types/budget';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.empowered.vote';

// Cache structure to support multiple municipality/year/dataset combinations
const cache: Map<string, BudgetData> = new Map();

/**
 * Load budget data for a specific municipality and year.
 * Throws on API failure — callers must handle errors (no silent fallback).
 */
export async function loadBudgetData(
  year: number = 2025,
  municipalityName: string = 'Bloomington',
  dataset: string = 'operating'
): Promise<BudgetData> {
  const cacheKey = `${municipalityName}-${year}-${dataset}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // API is the sole data source — no fallback (per D-06)
  const budgetsUrl = `${API_BASE}/treasury/budgets?city=${encodeURIComponent(municipalityName)}&year=${year}&dataset=${dataset}`;
  const response = await fetch(budgetsUrl);
  if (!response.ok) {
    throw new Error(`Budget API returned ${response.status}`);
  }

  const apiData = await response.json();
  const budget = Array.isArray(apiData) ? apiData[0] : apiData;
  if (!budget?.id) {
    throw new Error(`No budget found for ${municipalityName} ${year} (${dataset})`);
  }

  const catResponse = await fetch(`${API_BASE}/treasury/budgets/${budget.id}/categories`);
  if (!catResponse.ok) {
    throw new Error(`Categories API returned ${catResponse.status}`);
  }
  const categories = await catResponse.json();

  const data = transformAPIResponse(budget, categories);
  cache.set(cacheKey, data);
  return data;
}

/**
 * Transform API response to BudgetData format
 */
function transformAPIResponse(budget: any, categories: BudgetCategory[]): BudgetData {
  return {
    metadata: {
      cityName: budget.city?.name || 'Unknown',
      fiscalYear: budget.fiscal_year,
      population: budget.city?.population || 0,
      totalBudget: budget.total_budget,
      generatedAt: budget.generated_at || new Date().toISOString(),
      hierarchy: budget.hierarchy || [],
      dataSource: budget.data_source || 'API',
      datasetType: budget.dataset_type
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
export async function listMunicipalities(): Promise<Array<{ id: string; name: string; state: string; entity_type: string }>> {
  const response = await fetch(`${API_BASE}/treasury/municipalities`);
  if (!response.ok) {
    throw new Error(`Municipalities API returned ${response.status}`);
  }
  return await response.json();
}
