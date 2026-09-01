import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Municipality } from '../types/budget';
import { hasDatasets } from '../data/municipalityDatasets';

interface CountiesInStatePanelProps {
  state: Municipality;
  municipalities: Municipality[];
  onCountyClick: (county: Municipality) => void;
}

// Above this count, show a filter box + scroll container (VA has 95 counties).
const FILTER_THRESHOLD = 24;

/**
 * County tags shown at the bottom of a state page — the state's jump-off point to
 * its county governments, mirroring CitiesInStatePanel and CitiesInCountyPanel.
 * Includes every entity_type === 'county' in the state.
 */
const CountiesInStatePanel: React.FC<CountiesInStatePanelProps> = ({
  state,
  municipalities,
  onCountyClick,
}) => {
  const [filter, setFilter] = useState('');

  const counties = useMemo(
    () =>
      municipalities.filter(
        m => m.state === state.state && m.entity_type === 'county'
      ),
    [municipalities, state.state]
  );

  const withData = useMemo(
    () =>
      counties
        .filter(c => hasDatasets(c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [counties]
  );

  const withoutData = useMemo(
    () =>
      counties
        .filter(c => !hasDatasets(c))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [counties]
  );

  const showFilter = withData.length > FILTER_THRESHOLD;
  const filtered = useMemo(() => {
    if (!filter) return withData;
    const q = filter.toLowerCase();
    return withData.filter(c => c.name.toLowerCase().includes(q));
  }, [withData, filter]);

  if (counties.length === 0) return null;

  return (
    <div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
      <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
        Counties in {state.name}
      </h2>

      {withData.length > 0 && (
        <div className={withoutData.length > 0 ? 'mb-6' : undefined}>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500">
              Available now ({withData.length})
            </h3>
            {showFilter && (
              <div className="relative w-full sm:w-56">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ev-gray-500" />
                <input
                  type="text"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder={`Filter ${withData.length} counties…`}
                  aria-label={`Filter counties in ${state.name}`}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-[#E2EBEF] dark:border-ev-gray-700 rounded-md bg-[#F7F7F8] dark:bg-ev-gray-900 text-[#1C1C1C] dark:text-ev-gray-200 placeholder:text-ev-gray-400 focus:outline-none focus:ring-2 focus:ring-ev-muted-blue focus:border-transparent"
                />
              </div>
            )}
          </div>
          <div className={`flex flex-wrap gap-2 ${showFilter ? 'max-h-72 overflow-y-auto pr-1' : ''}`}>
            {filtered.map(county => (
              <button
                key={county.id}
                onClick={() => onCountyClick(county)}
                className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150"
              >
                {county.name}
              </button>
            ))}
            {showFilter && filter && filtered.length === 0 && (
              <p className="text-sm text-ev-gray-500 py-1">No counties match "{filter}".</p>
            )}
          </div>
        </div>
      )}

      {withoutData.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-400 mb-2">
            Coming soon ({withoutData.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {withoutData.map(county => (
              <span
                key={county.id}
                className="px-3 py-1.5 text-sm text-ev-gray-400 bg-[#F7F7F8] dark:bg-ev-gray-900 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg"
              >
                {county.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountiesInStatePanel;
