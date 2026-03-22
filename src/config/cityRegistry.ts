import type { CityConfig } from './types';
import bloomingtonConfig from './cities/bloomington';

const losAngelesPlaceholder: CityConfig = {
  slug: 'los-angeles',
  name: 'Los Angeles',
  displayName: 'Los Angeles, CA',
  heroTitle: 'Los Angeles Finances',
  heroImageUrl: '',
  availableDatasets: ['operating'],
  availableYears: [],
  defaultYear: '',
  population: 3900000,
  hasTransactions: false,
  isComingSoon: true,
};

export const CITY_REGISTRY: CityConfig[] = [
  bloomingtonConfig,
  losAngelesPlaceholder,
];

export function getCityConfig(slug: string): CityConfig | undefined {
  return CITY_REGISTRY.find(c => c.slug === slug);
}
