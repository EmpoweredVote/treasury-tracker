import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Municipality } from '../types/budget';

interface EntitySwitcherProps {
  municipalities: Municipality[];
  selectedEntity: Municipality | null;
  onEntityChange: (entity: Municipality) => void;
}

const EntitySwitcher: React.FC<EntitySwitcherProps> = ({
  municipalities,
  selectedEntity,
  onEntityChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Group municipalities by entity_type
  const grouped = municipalities.reduce<{
    city: Municipality[];
    county: Municipality[];
    township: Municipality[];
  }>(
    (acc, m) => {
      const key = m.entity_type;
      if (key === 'city' || key === 'county' || key === 'township') {
        acc[key].push(m);
      }
      return acc;
    },
    { city: [], county: [], township: [] }
  );

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
          className="absolute top-full mt-1 left-0 min-w-56 bg-white border border-[#E2EBEF] rounded-lg shadow-lg z-10 overflow-hidden"
          role="listbox"
          aria-label="Available jurisdictions"
        >
          {grouped.city.length > 0 && (
            <>
              <span className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Cities
              </span>
              {grouped.city.map((entity) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={entity.id === selectedEntity?.id}
                  className={`block w-full px-4 py-3 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] ${
                    entity.id === selectedEntity?.id
                      ? 'border-ev-muted-blue bg-[#F7F7F8]'
                      : 'border-transparent'
                  }`}
                  onClick={() => {
                    onEntityChange(entity);
                    setIsOpen(false);
                  }}
                >
                  {entity.name}, {entity.state}
                </button>
              ))}
            </>
          )}

          {grouped.county.length > 0 && (
            <>
              <span className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Counties
              </span>
              {grouped.county.map((entity) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={entity.id === selectedEntity?.id}
                  className={`block w-full px-4 py-3 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] ${
                    entity.id === selectedEntity?.id
                      ? 'border-ev-muted-blue bg-[#F7F7F8]'
                      : 'border-transparent'
                  }`}
                  onClick={() => {
                    onEntityChange(entity);
                    setIsOpen(false);
                  }}
                >
                  {entity.name}, {entity.state}
                </button>
              ))}
            </>
          )}

          {grouped.township.length > 0 && (
            <>
              <span className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                Townships
              </span>
              {grouped.township.map((entity) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={entity.id === selectedEntity?.id}
                  className={`block w-full px-4 py-3 text-sm text-left border-l-2 transition-colors duration-150 hover:bg-[#F7F7F8] ${
                    entity.id === selectedEntity?.id
                      ? 'border-ev-muted-blue bg-[#F7F7F8]'
                      : 'border-transparent'
                  }`}
                  onClick={() => {
                    onEntityChange(entity);
                    setIsOpen(false);
                  }}
                >
                  {entity.name}, {entity.state}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EntitySwitcher;
