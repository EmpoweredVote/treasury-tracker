import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown } from 'lucide-react';

interface YearSelectorProps {
  selectedYear: string;
  years: string[];
  onYearChange: (year: string) => void;
}

export interface YearSelectorHandle {
  open: () => void;
}

const YearSelector = forwardRef<YearSelectorHandle, YearSelectorProps>(({ selectedYear, years, onYearChange }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpen(true);
      dropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (years.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center gap-2 h-[42px] px-4 py-2 text-sm font-medium bg-white border border-[#E2EBEF] rounded-lg cursor-pointer transition-colors duration-200 hover:bg-[#F7F7F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select fiscal year"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>FY {selectedYear}</span>
        <ChevronDown
          size={14}
          className={`text-[#6B7280] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-1 right-0 min-w-24 bg-white border border-[#E2EBEF] rounded-lg shadow-lg z-10 overflow-hidden max-h-64 overflow-y-auto"
          role="listbox"
          aria-label="Available fiscal years"
        >
          {years.map((year) => (
            <button
              key={year}
              role="option"
              aria-selected={year === selectedYear}
              className={`block w-full px-4 py-2 text-sm text-left transition-colors duration-150 hover:bg-[#F7F7F8] ${
                year === selectedYear
                  ? 'font-bold text-ev-muted-blue bg-[#F7F7F8]'
                  : 'text-[#1C1C1C]'
              }`}
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
});

YearSelector.displayName = 'YearSelector';

export default YearSelector;
