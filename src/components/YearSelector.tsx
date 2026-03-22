import React, { useState, useRef, useEffect } from 'react';

interface YearSelectorProps {
  selectedYear: string;
  years: string[];
  onYearChange: (year: string) => void;
}

const YearSelector: React.FC<YearSelectorProps> = ({ selectedYear, years, onYearChange }) => {
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

  return (
    <div className="year-selector" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button 
        className="year-button" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select year"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>Year {selectedYear}</span>
        <svg 
          width="12" 
          height="8" 
          viewBox="0 0 12 8" 
          fill="currentColor"
          style={{ 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          <path d="M1.41 0.59L6 5.17L10.59 0.59L12 2L6 8L0 2L1.41 0.59Z" />
        </svg>
      </button>
      {isOpen && (
        <div 
          className="year-dropdown"
          role="listbox"
          aria-label="Year options"
        >
          {years.map((year) => (
            <button
              key={year}
              role="option"
              aria-selected={selectedYear === year}
              className={`year-option ${selectedYear === year ? 'selected' : ''}`}
              onClick={() => {
                onYearChange(year);
                setIsOpen(false);
              }}
            >
              {year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default YearSelector;
