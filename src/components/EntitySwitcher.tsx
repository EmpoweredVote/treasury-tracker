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
    : 'Select entity';

  return (
    <div className="entity-switcher" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        className="entity-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select jurisdiction"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        style={isOpen ? { backgroundColor: 'var(--light-gray)' } : undefined}
      >
        <span>{displayName}</span>
        <ChevronDown
          size={16}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'var(--text-gray)',
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          className="entity-switcher-dropdown"
          role="listbox"
          aria-label="Available jurisdictions"
        >
          {grouped.city.length > 0 && (
            <>
              <div className="entity-group-label">Cities</div>
              {grouped.city.map((entity) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={entity.id === selectedEntity?.id}
                  className={`entity-option${entity.id === selectedEntity?.id ? ' selected' : ''}`}
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
              <div className="entity-group-label">Counties</div>
              {grouped.county.map((entity) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={entity.id === selectedEntity?.id}
                  className={`entity-option${entity.id === selectedEntity?.id ? ' selected' : ''}`}
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
              <div className="entity-group-label">Townships</div>
              {grouped.township.map((entity) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={entity.id === selectedEntity?.id}
                  className={`entity-option${entity.id === selectedEntity?.id ? ' selected' : ''}`}
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
