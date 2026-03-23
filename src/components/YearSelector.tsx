import React from 'react';

interface YearSelectorProps {
  selectedYear: string;
  years: string[];
  onYearChange: (year: string) => void;
}

const YearSelector: React.FC<YearSelectorProps> = ({ selectedYear, years, onYearChange }) => {
  if (years.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select fiscal year">
      {years.map((year) => {
        const isActive = selectedYear === year;
        return (
          <button
            key={year}
            role="radio"
            aria-checked={isActive}
            onClick={() => onYearChange(year)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-offset-2 ${
              isActive
                ? 'font-bold text-white bg-ev-muted-blue border border-ev-muted-blue'
                : 'text-[#6B7280] bg-white border border-[#E2EBEF] hover:bg-[#F7F7F8]'
            }`}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
};

export default YearSelector;
