import React, { useMemo } from 'react';
import type { Municipality } from '../types/budget';
import { hasDatasets } from '../data/municipalityDatasets';
import { listLabel, shortNameInCounty } from '../data/entityListLabel';

interface CitiesInCountyPanelProps {
  county: Municipality;
  municipalities: Municipality[];
  onCityClick: (city: Municipality) => void;
}

/** Entity types a COUNTY can be the parent of. Counties never nest. */
const CHILD_TYPES = ['city', 'town', 'township', 'village', 'municipality'];

const CitiesInCountyPanel: React.FC<CitiesInCountyPanelProps> = ({
  county,
  municipalities,
  onCityClick,
}) => {
  // ⚠⚠ TOWNSHIPS AND VILLAGES USED TO BE EXCLUDED HERE, and the comment said
  // "add 'township' if/when townships are linked to counties". They now are:
  // all 1,773 Michigan cities, villages and townships carry a `county_id`,
  // derived from the publisher's own municode. Leaving them out would show
  // Allegan County two dozen fewer governments than it has.
  const cities = useMemo(
    () => municipalities.filter(
      m => m.county_id === county.id && CHILD_TYPES.includes(m.entity_type)
    ),
    [municipalities, county.id]
  );

  // ⚠ Derived from what the list actually holds, exactly as the state panel
  // does — a county of only cities still reads "Cities in Allegan County".
  const label = useMemo(() => listLabel(cities), [cities]);

  // ⚠⚠ The county is in the heading, so it is trimmed from every entry:
  // "Hopkins Township, Allegan County" under "…in Allegan County" says it twice.
  // The STORED name keeps it — it is what tells 302 same-named townships apart.
  const nameOf = (m: Municipality) => shortNameInCounty(m.name, county.name);

  const withData = useMemo(
    () => cities.filter(hasDatasets).sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    [cities] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const withoutData = useMemo(
    () => cities.filter(c => !hasDatasets(c)).sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
    [cities] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (cities.length === 0) return null;

  return (
    <div className="mt-8 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-xl p-6">
      <h2 className="text-base font-bold text-[#1C1C1C] dark:text-ev-gray-100 mb-4">
        {label} in {county.name}
      </h2>

      {withData.length > 0 && (
        <div className={withoutData.length > 0 ? 'mb-6' : undefined}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 mb-2">
            Available now ({withData.length.toLocaleString()})
          </h3>
          <div className="flex flex-wrap gap-2">
            {withData.map(city => (
              <button
                key={city.id}
                onClick={() => onCityClick(city)}
                className="px-3 py-1.5 text-sm font-medium bg-[#F7F7F8] dark:bg-ev-gray-700 hover:bg-ev-muted-blue/10 text-ev-muted-blue border border-[#E2EBEF] dark:border-ev-gray-600 rounded-lg transition-colors duration-150"
              >
                {nameOf(city)}
              </button>
            ))}
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
                {nameOf(city)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CitiesInCountyPanel;
