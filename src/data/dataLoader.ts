/**
 * Data Loader
 *
 * Handles loading budget data from the API, with fallback to static JSON or mock data
 */

import type { BudgetData, BudgetCategory } from '../types/budget';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.empowered.vote';

// Cache structure to support multiple city/year/dataset combinations
const cache: Map<string, BudgetData> = new Map();

/**
 * Load budget data for a specific city and year
 * Tries API first, then static JSON files, then mock data
 */
export async function loadBudgetData(
  year: number = 2025,
  cityName: string = 'Bloomington',
  dataset: string = 'operating'
): Promise<BudgetData> {
  const cacheKey = `${cityName}-${year}-${dataset}`;

  // Check cache first
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Try API first
  try {
    const apiUrl = `${API_BASE}/treasury/budgets?city=${encodeURIComponent(cityName)}&year=${year}&dataset=${dataset}`;
    const response = await fetch(apiUrl);

    if (response.ok) {
      const apiData = await response.json();

      // If we got an array, take the first budget
      const budget = Array.isArray(apiData) ? apiData[0] : apiData;

      if (budget && budget.id) {
        // Fetch categories separately
        const categoriesUrl = `${API_BASE}/treasury/budgets/${budget.id}/categories`;
        const catResponse = await fetch(categoriesUrl);

        if (catResponse.ok) {
          const categories = await catResponse.json();
          const data = transformAPIResponse(budget, categories);
          cache.set(cacheKey, data);
          console.log(`Loaded budget from API: ${cityName} ${year} (${dataset})`);
          return data;
        }
      }
    }
  } catch (error) {
    console.warn('API not available, falling back to static files:', error);
  }

  // Fall back to static JSON files
  try {
    const staticUrl = `./data/budget-${year}.json`;
    const response = await fetch(staticUrl);

    if (response.ok) {
      const data: BudgetData = await response.json();
      cache.set(cacheKey, data);
      console.log(`Loaded budget from static JSON: ${year}`);
      return data;
    }
  } catch (error) {
    console.warn('Static JSON not available:', error);
  }

  // Final fallback to mock data
  console.log('Falling back to mock data...');
  const { bloomingtonBudget2025, totalBudget2025 } = await import('./budgetData');

  const fallbackData: BudgetData = {
    metadata: {
      cityName: 'Bloomington',
      fiscalYear: 2025,
      population: 85000,
      totalBudget: totalBudget2025,
      generatedAt: new Date().toISOString(),
      hierarchy: ['mock', 'data'],
      dataSource: 'budgetData.ts (mock)'
    },
    categories: bloomingtonBudget2025
  };

  cache.set(cacheKey, fallbackData);
  return fallbackData;
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
 * Get a list of available cities from the API
 */
export async function listCities(): Promise<Array<{ id: string; name: string; state: string }>> {
  try {
    const response = await fetch(`${API_BASE}/treasury/cities`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to fetch cities from API:', error);
  }
  // Return default city if API unavailable
  return [{ id: 'mock', name: 'Bloomington', state: 'IN' }];
}
