import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Municipality } from '../types/budget';
import { STATE_NAMES } from '../utils/wikiImage';
import { hasDatasets } from '../data/municipalityDatasets';
import { TYPE_LABELS } from '../data/entityListLabel';

interface EntitySwitcherProps {
  municipalities: Municipality[];
  selectedEntity: Municipality | null;
  onEntityChange: (entity: Municipality) => void;
}

// Max locality buttons rendered in the dropdown at once. Keeps the dropdown DOM
// small enough to stay responsive while typing; the filter narrows past it.
const MAX_LOCALITY_RESULTS = 60;

// ⚠ The sub-state types come from the SHARED map, so this dropdown and the
// state page's panel cannot drift apart — `village` reached the UI labelled
// with its raw database value because they were two independent lists.
const ENTITY_TYPE_LABELS: Record<string, string> = {
  ...TYPE_LABELS,
  federal: 'Federal Government',
  state: 'State Governments',
  county: 'Counties',
};

const EntitySwitcher: React.FC<EntitySwitcherProps> = ({
  municipalities,
  selectedEntity,
  onEntityChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFilter('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when opening
      setTimeout(() => searchRef.current?.focus(), 0);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setFilter('');
    }
  };

  // Group by state → entity_type, with filtering
  const grouped = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    const filtered = filter
      ? municipalities.filter(m =>
          m.name.toLowerCase().includes(lowerFilter) ||
          m.state.toLowerCase().includes(lowerFilter) ||
          (STATE_NAMES[m.state] || '').toLowerCase().includes(lowerFilter)
        )
      : municipalities;

    // Defensive guard: exclude municipalities with no budget data loaded.
    // State/federal navigation hubs are always shown — they are hub nodes, not data leaves.
    // Ordinary localities (city, county, town, etc.) still require at least one dataset.
    const withData = filtered.filter(
      m =>
        hasDatasets(m) ||
        m.entity_type === 'state' ||
        m.entity_type === 'federal'
    );

    // Pre-filter federal/state entities before building byState to prevent circular nesting
    const federalEntities = withData.filter(m => m.entity_type === 'federal');
    const stateEntities = withData.filter(m => m.entity_type === 'state');
    const allCityEntities = withData
      .filter(m => m.entity_type !== 'state' && m.entity_type !== 'federal')
      // Stable order before capping so the cap is deterministic (by state, then name).
      .sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

    // Cap the number of locality buttons rendered. The cohort now spans many
    // states (hundreds of localities), and rendering every match on each
    // keystroke makes the dropdown DOM huge — slow to diff and slow for any
    // page instrumentation to process. Federal/state hubs are few and always
    // shown; only the long locality tail is capped. Users narrow via the filter.
    const hiddenCount = Math.max(0, allCityEntities.length - MAX_LOCALITY_RESULTS);
    const cityEntities = allCityEntities.slice(0, MAX_LOCALITY_RESULTS);

    // Sort federal/state entities alphabetically
    federalEntities.sort((a, b) => a.name.localeCompare(b.name));
    stateEntities.sort((a, b) => a.name.localeCompare(b.name));

    const byState = new Map<string, Map<string, Municipality[]>>();
    for (const m of cityEntities) {
      if (!byState.has(m.state)) byState.set(m.state, new Map());
      const stateMap = byState.get(m.state)!;
      const type = m.entity_type;
      if (!stateMap.has(type)) stateMap.set(type, []);
      stateMap.get(type)!.push(m);
    }

    // Sort entities within each group
    for (const stateMap of byState.values()) {
      for (const entities of stateMap.values()) {
        entities.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    return { byState, stateEntities, federalEntities, hiddenCount };
  }, [municipalities, filter]);

  const totalCount = useMemo(
    () => municipalities.filter(hasDatasets).length,
    [municipalities]
  );
  const displayName = selectedEntity
    ? selectedEntity.entity_type === 'state' || selectedEntity.entity_type === 'federal'
      ? selectedEntity.name
      : `${selectedEntity.name}, ${selectedEntity.state}`
    : 'Select jurisdiction';

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        className="flex items-center gap-2 h-[42px] px-4 py-2 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg font-manrope text-sm font-medium text-[#1C1C1C] dark:text-ev-gray-200 cursor-pointer transition-colors duration-200 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select jurisdiction"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{displayName}</span>
        <ChevronDown
          size={16}
          className={`text-ev-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-1 left-0 w-72 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg shadow-lg dark:shadow-black/40 z-10 overflow-hidden"
          role="listbox"
          aria-label="Available jurisdictions"
        >
          {/* Search input */}
          <div className="p-2 border-b border-[#E2EBEF]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ev-gray-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder={`Search ${totalCount.toLocaleString()} jurisdictions...`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2EBEF] dark:border-ev-gray-700 rounded-md bg-[#F7F7F8] dark:bg-ev-gray-900 text-[#1C1C1C] dark:text-ev-gray-200 placeholder:text-ev-gray-400 focus:outline-none focus:ring-2 focus:ring-ev-muted-blue focus:border-transparent"
              />
            </div>
          </div>

          {/* Grouped list */}
          <div className="max-h-80 overflow-y-auto">
            {grouped.byState.size === 0 && grouped.stateEntities.length === 0 && grouped.federalEntities.length === 0 && (
              <div className="px-4 py-6 text-sm text-ev-gray-500 text-center">
                No jurisdictions match "{filter}"
              </div>
            )}

            {/* FEDERAL GOVERNMENT section — rendered above everything */}
            {grouped.federalEntities.length > 0 && (
              <div>
                <div className="sticky top-0 bg-[#F7F7F8] dark:bg-ev-gray-900 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ev-gray-500 border-b border-[#E2EBEF] dark:border-ev-gray-700">
                  FEDERAL GOVERNMENT
                </div>
                {grouped.federalEntities.map((entity) => (
                  <button
                    key={entity.id}
                    role="option"
                    aria-selected={entity.id === selectedEntity?.id}
                    className={`block w-full px-4 py-2 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 dark:text-ev-gray-200 ${
                      entity.id === selectedEntity?.id
                        ? 'border-ev-muted-blue bg-[#F7F7F8] dark:bg-ev-gray-700 font-medium'
                        : 'border-transparent'
                    }`}
                    onClick={() => {
                      onEntityChange(entity);
                      setIsOpen(false);
                      setFilter('');
                    }}
                  >
                    {entity.name}
                  </button>
                ))}
              </div>
            )}

            {/* STATE GOVERNMENTS section — rendered above all state/city groups */}
            {grouped.stateEntities.length > 0 && (
              <div>
                <div className="sticky top-0 bg-[#F7F7F8] dark:bg-ev-gray-900 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ev-gray-500 border-b border-[#E2EBEF] dark:border-ev-gray-700">
                  STATE GOVERNMENTS
                </div>
                {grouped.stateEntities.map((entity) => (
                  <button
                    key={entity.id}
                    role="option"
                    aria-selected={entity.id === selectedEntity?.id}
                    className={`block w-full px-4 py-2 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 dark:text-ev-gray-200 ${
                      entity.id === selectedEntity?.id
                        ? 'border-ev-muted-blue bg-[#F7F7F8] dark:bg-ev-gray-700 font-medium'
                        : 'border-transparent'
                    }`}
                    onClick={() => {
                      onEntityChange(entity);
                      setIsOpen(false);
                      setFilter('');
                    }}
                  >
                    {entity.name}
                  </button>
                ))}
              </div>
            )}

            {[...grouped.byState.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([state, typeMap]) => (
              <div key={state}>
                {/* State header */}
                <div className="sticky top-0 bg-[#F7F7F8] dark:bg-ev-gray-900 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ev-gray-500 border-b border-[#E2EBEF] dark:border-ev-gray-700">
                  {STATE_NAMES[state] || state}
                </div>

                {[...typeMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([type, entities]) => (
                  <div key={`${state}-${type}`}>
                    {/* Entity type subheader */}
                    <div className="px-4 py-1 text-xs text-ev-gray-400 dark:text-ev-gray-500 font-medium">
                      {ENTITY_TYPE_LABELS[type] || type} ({entities.length})
                    </div>

                    {entities.map((entity) => (
                      <button
                        key={entity.id}
                        role="option"
                        aria-selected={entity.id === selectedEntity?.id}
                        className={`block w-full px-4 py-2 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 dark:text-ev-gray-200 ${
                          entity.id === selectedEntity?.id
                            ? 'border-ev-muted-blue bg-[#F7F7F8] dark:bg-ev-gray-700 font-medium'
                            : 'border-transparent'
                        }`}
                        onClick={() => {
                          onEntityChange(entity);
                          setIsOpen(false);
                          setFilter('');
                        }}
                      >
                        {entity.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {grouped.hiddenCount > 0 && (
              <div className="px-4 py-2.5 text-xs text-ev-gray-500 text-center border-t border-[#E2EBEF] dark:border-ev-gray-700">
                {grouped.hiddenCount} more {grouped.hiddenCount === 1 ? 'jurisdiction' : 'jurisdictions'} — keep typing to narrow results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntitySwitcher;
