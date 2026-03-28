import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { Municipality } from '../types/budget';

interface EntitySwitcherProps {
  municipalities: Municipality[];
  selectedEntity: Municipality | null;
  onEntityChange: (entity: Municipality) => void;
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  city: 'Cities',
  county: 'Counties',
  township: 'Townships',
  special_district: 'Special Districts',
  school_district: 'School Districts',
  library: 'Libraries',
  conservancy: 'Conservancy Districts',
};

const STATE_LABELS: Record<string, string> = {
  IN: 'Indiana',
  CA: 'California',
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
          (STATE_LABELS[m.state] || '').toLowerCase().includes(lowerFilter)
        )
      : municipalities;

    const byState = new Map<string, Map<string, Municipality[]>>();
    for (const m of filtered) {
      if (!byState.has(m.state)) byState.set(m.state, new Map());
      const stateMap = byState.get(m.state)!;
      const type = m.entity_type || 'city';
      if (!stateMap.has(type)) stateMap.set(type, []);
      stateMap.get(type)!.push(m);
    }

    // Sort entities within each group
    for (const stateMap of byState.values()) {
      for (const entities of stateMap.values()) {
        entities.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    return byState;
  }, [municipalities, filter]);

  const totalCount = municipalities.length;
  const displayName = selectedEntity
    ? `${selectedEntity.name}, ${selectedEntity.state}`
    : 'Select jurisdiction';

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        className="flex items-center gap-2 min-h-[44px] px-4 py-2 bg-white border border-[#E2EBEF] rounded-lg font-manrope text-base font-medium text-[#1C1C1C] cursor-pointer transition-colors duration-200 hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select jurisdiction"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{displayName}</span>
        <ChevronDown
          size={16}
          className={`text-[#6B7280] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-1 left-0 w-72 bg-white border border-[#E2EBEF] rounded-lg shadow-lg z-10 overflow-hidden"
          role="listbox"
          aria-label="Available jurisdictions"
        >
          {/* Search input */}
          <div className="p-2 border-b border-[#E2EBEF]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                ref={searchRef}
                type="text"
                placeholder={`Search ${totalCount} jurisdictions...`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2EBEF] rounded-md bg-[#F7F7F8] focus:outline-none focus:ring-2 focus:ring-ev-muted-blue focus:border-transparent"
              />
            </div>
          </div>

          {/* Grouped list */}
          <div className="max-h-80 overflow-y-auto">
            {grouped.size === 0 && (
              <div className="px-4 py-6 text-sm text-[#6B7280] text-center">
                No jurisdictions match "{filter}"
              </div>
            )}

            {[...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([state, typeMap]) => (
              <div key={state}>
                {/* State header */}
                <div className="sticky top-0 bg-[#F7F7F8] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#6B7280] border-b border-[#E2EBEF]">
                  {STATE_LABELS[state] || state}
                </div>

                {[...typeMap.entries()].map(([type, entities]) => (
                  <div key={`${state}-${type}`}>
                    {/* Entity type subheader */}
                    <div className="px-4 py-1 text-xs text-[#9CA3AF] font-medium">
                      {ENTITY_TYPE_LABELS[type] || type} ({entities.length})
                    </div>

                    {entities.map((entity) => (
                      <button
                        key={entity.id}
                        role="option"
                        aria-selected={entity.id === selectedEntity?.id}
                        className={`block w-full px-4 py-2 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] ${
                          entity.id === selectedEntity?.id
                            ? 'border-ev-muted-blue bg-[#F7F7F8] font-medium'
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
          </div>
        </div>
      )}
    </div>
  );
};

export default EntitySwitcher;
