import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search city departments or categories..."
}) => {
  return (
    <div className="relative flex items-center" role="search">
      <label htmlFor="budget-search" className="sr-only">
        Search budget categories
      </label>
      <Search
        size={16}
        className="absolute left-3 text-ev-muted-blue pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="budget-search"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search budget departments and categories"
        className="w-full h-[42px] pl-10 pr-10 bg-white dark:bg-ev-gray-800 border border-[#E2EBEF] dark:border-ev-gray-700 rounded-lg text-sm font-manrope focus:outline-none focus:ring-2 focus:ring-ev-muted-blue focus:ring-offset-2 dark:focus:ring-offset-ev-gray-900 placeholder:text-[#6B7280] dark:placeholder:text-ev-gray-500 text-[#1C1C1C] dark:text-ev-gray-100"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-3 text-ev-coral hover:text-ev-coral/80 cursor-pointer transition-colors duration-200"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
