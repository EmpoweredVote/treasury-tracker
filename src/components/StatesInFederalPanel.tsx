import React from 'react';
import type { Municipality } from '../types/budget';
import { hasDatasets } from '../data/municipalityDatasets';

interface StatesInFederalPanelProps {
  municipalities: Municipality[];
  onStateClick: (state: Municipality) => void;
}

/**
 * State tags shown at the bottom of the federal (United States) page. Every
 * state entity links to its own budget — the federal page's jump-off point to
 * all 50 states, mirroring CitiesInCountyPanel for counties.
 */
const StatesInFederalPanel: React.FC<StatesInFederalPanelProps> = ({
  municipalities,
  onStateClick,
}) => {
  const states = municipalities.filter(m => m.entity_type === 'state');

  if (states.length === 0) return null;

  const withData = states
    .filter(s => hasDatasets(s))
    .sort((a, b) => a.name.localeCompare(b.name));

  const withoutData = states
    .filter(s => !hasDatasets(s))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
      <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
        Explore the states
      </h2>

      {withData.length > 0 && (
        <div className={withoutData.length > 0 ? 'mb-6' : undefined}>
          {withoutData.length > 0 && (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-2">
              Available now ({withData.length})
            </h3>
          )}
          <div className="flex flex-wrap gap-2">
            {withData.map(state => (
              <button
                key={state.id}
                onClick={() => onStateClick(state)}
                className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150"
              >
                {state.name}
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
            {withoutData.map(state => (
              <span
                key={state.id}
                className="px-3 py-1.5 text-sm text-ev-gray-400 bg-[#F7F7F8] dark:bg-ev-gray-900 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg"
              >
                {state.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatesInFederalPanel;
