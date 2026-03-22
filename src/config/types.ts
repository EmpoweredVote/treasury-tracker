export type DatasetId = 'revenue' | 'operating' | 'salaries';

export interface CityConfig {
  slug: string;
  name: string;
  displayName: string;
  heroTitle: string;
  heroImageUrl: string;
  availableDatasets: DatasetId[];
  availableYears: string[];
  defaultYear: string;
  population: number;
  hasTransactions: boolean;
  isComingSoon?: boolean;
}
