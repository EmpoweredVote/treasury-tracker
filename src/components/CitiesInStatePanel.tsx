import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Municipality } from '../types/budget';
import { hasDatasets } from '../data/municipalityDatasets';
import { listLabel } from '../data/entityListLabel';

interface CitiesInStatePanelProps {
  state: Municipality;
  municipalities: Municipality[];
  onCityClick: (city: Municipality) => void;
}

// Above this count, show a filter box + scroll container (Michigan has 1,700+).
const FILTER_THRESHOLD = 24;

/**
 * Entity tags shown at the bottom of a state page — the state's jump-off point
 * to its local governments, mirroring CitiesInCountyPanel and
 * StatesInFederalPanel. Includes every sub-state government entity in the state
 * (city, town, township, village, municipality, special district, …); counties
 * get their own breadcrumb level.
 */
const CitiesInStatePanel: React.FC<CitiesInStatePanelProps> = ({
  state,
  municipalities,
  onCityClick,
}) => {
  const [filter, setFilter] = useState('');

  const cities = useMemo(
    () =>
      municipalities.filter(
        m =>
          m.state === state.state &&
          !['state', 'federal', 'county', 'nonprofit'].includes(m.entity_type)
      ),
    [municipalities, state.state]
  );

  const withData = useMemo(
    () =>
      cities
        .filter(c => hasDatasets(c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cities]
  );

  const withoutData = useMemo(
    () =>
      cities
        .filter(c => !hasDatasets(c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cities]
  );

  const showFilter = withData.length > FILTER_THRESHOLD;
  const filtered = useMemo(() => {
    if (!filter) return withData;
    const q = filter.toLowerCase();
    return withData.filter(c => c.name.toLowerCase().includes(q));
  }, [withData, filter]);

  // ⚠ Derived from what the list actually holds — see listLabel. Used for every
  // reader-facing mention, so the heading, the filter and the empty state can
  // never drift apart.
  const label = useMemo(() => listLabel(cities), [cities]);
  const lowerLabel = label.toLowerCase();

  if (cities.length === 0) return null;

  return (
    <div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
      <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
        {label} in {state.name}
      </h2>

      {withData.length > 0 && (
        <div className={withoutData.length > 0 ? 'mb-6' : undefined}>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500">
              Available now ({withData.length.toLocaleString()})
            </h3>
            {showFilter && (
              <div className="relative w-full sm:w-56">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ev-gray-500" />
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder={`Filter ${withData.length.toLocaleString()} ${lowerLabel}…`}
                  aria-label={`Filter ${lowerLabel} in ${state.name}`}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#E2EBEF] dark:border-ev-gray-700 rounded-md bg-[#F7F7F8] dark:bg-ev-gray-900 text-[#1C1C1C] dark:text-ev-gray-200 placeholder:text-ev-gray-400 focus:outline-none focus:ring-2 focus:ring-ev-muted-blue focus:border-transparent"
                />
              </div>
            )}
          </div>
          <div className={`flex flex-wrap gap-2 ${showFilter ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
            {filtered.map(city => (
              <button
                key={city.id}
                onClick={() => onCityClick(city)}
                className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150"
              >
                {city.name}
              </button>
            ))}
            {showFilter && filter && filtered.length === 0 && (
              <p className="text-sm text-ev-gray-500 py-1">No {lowerLabel} match "{filter}".</p>
            )}
          </div>
        </div>
      )}

      {withoutData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-400 mb-2">
            Coming soon ({withoutData.length.toLocaleString()})
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

export default CitiesInStatePanel;
