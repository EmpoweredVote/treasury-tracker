import React from 'react';

export type FederalLens = 'function' | 'agency';

interface LensToggleProps {
  lens: FederalLens;
  onChange: (lens: FederalLens) => void;
}

/**
 * VIZ-03: the citizen's-choice drill lens for federal Money Out.
 * "What it's for" = budget functions (default); "Who spends it" = agencies.
 * Rendered only for the federal entity on the operating dataset.
 */
const LensToggle: React.FC<LensToggleProps> = ({ lens, onChange }) => {
  const options: Array<{ value: FederalLens; label: string; hint: string }> = [
    { value: 'function', label: 'What it’s for', hint: 'Spending by purpose (budget function)' },
    { value: 'agency', label: 'Who spends it', hint: 'Spending by department and agency' },
  ];

  return (
    <div
      className="inline-flex rounded-lg border border-[#E2EBEF] dark:border-ev-gray-700 bg-white dark:bg-ev-gray-800 p-1"
      role="group"
      aria-label="Choose how to break down federal spending"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={lens === opt.value}
          title={opt.hint}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue ${
            lens === opt.value
              ? 'bg-ev-muted-blue text-white'
              : 'text-ev-gray-600 dark:text-ev-gray-300 hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default LensToggle;
