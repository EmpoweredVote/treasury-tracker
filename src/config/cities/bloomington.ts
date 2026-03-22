import type { CityConfig } from '../types';

const bloomingtonConfig: CityConfig = {
  slug: 'bloomington',
  name: 'Bloomington',
  displayName: 'Bloomington, IN',
  heroTitle: 'Bloomington, Indiana Finances',
  heroImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Monroe_County_Courthouse_in_Bloomington_from_west-southwest.jpg',
  availableDatasets: ['revenue', 'operating', 'salaries'],
  availableYears: ['2025', '2024', '2023', '2022', '2021'],
  defaultYear: '2025',
  population: 79168,
  hasTransactions: true,
};

export default bloomingtonConfig;
