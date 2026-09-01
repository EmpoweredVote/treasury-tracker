import React from 'react';
import type { Municipality } from '../types/budget';
import { hasDatasets } from '../data/municipalityDatasets';

interface CitiesInCountyPanelProps {
  county: Municipality;
  municipalities: Municipality[];
  onCityClick: (city: Municipality) => void;
}

const CitiesInCountyPanel: React.FC<CitiesInCountyPanelProps> = ({
  county,
  municipalities,
  onCityClick,
}) => {
  // Includes cities and towns; excludes townships (add 'township' if/when townships are linked to counties)
  const cities = municipalities.filter(
    m => m.county_id === county.id && (m.entity_type === 'city' || m.entity_type === 'town')
  );

  if (cities.length === 0) return null;

  const withData = cities
    .filter(c => hasDatasets(c))
    .sort((a, b) => a.name.localeCompare(b.name));

  const withoutData = cities
    .filter(c => !hasDatasets(c))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
      <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
        Cities in {county.name}
      </h2>

      {withData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-2">
            Available now ({withData.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {withData.map(city => (
              <button
                key={city.id}
                onClick={() => onCityClick(city)}
                className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150"
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {withoutData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-400 mb-2">
            Coming soon ({withoutData.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {withoutData.map(city => (
              <span
                key={city.id}
                className="px-3 py-1.5 text-sm text-ev-gray-400 bg-[#F7F7F8] dark:bg-ev-gray-900 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg"
              >
                {city.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CitiesInCountyPanel;
