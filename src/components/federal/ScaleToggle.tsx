import React from 'react';

export type FederalScale = 'dollars' | 'perPerson' | 'perTaxpayer';

interface ScaleToggleProps {
  scale: FederalScale;
  onChange: (scale: FederalScale) => void;
  population: number;
  populationYear?: number | null;
  /** Individual returns filed (IRS Data Book) — omit to hide the per-taxpayer mode */
  taxReturns?: number | null;
  taxReturnsLabel?: string | null;
}

/**
 * VIZ-05: comparative-scale modes for federal amounts. Arithmetic on sourced
 * denominators only, formula disclosed at point of use. ("% of total" is the
 * visualization's native display — every segment already shows its share.)
 */
const ScaleToggle: React.FC<ScaleToggleProps> = ({
  scale, onChange, population, populationYear, taxReturns, taxReturnsLabel,
}) => {
  const options: Array<{ value: FederalScale; label: string; hint: string } | null> = [
    { value: 'dollars', label: '$', hint: 'Actual dollar amounts' },
    {
      value: 'perPerson',
      label: 'Per person',
      hint: `Amount ÷ ${population.toLocaleString()} (US population, Census Vintage ${populationYear ?? '—'})`,
    },
    taxReturns
      ? {
          value: 'perTaxpayer',
          label: 'Per taxpayer',
          hint: `Amount ÷ ${taxReturns.toLocaleString()} (${taxReturnsLabel ?? 'individual income tax returns filed, IRS Data Book'})`,
        }
      : null,
  ];

  return (
    <div
      className="inline-flex rounded-lg border border-[#E2EBEF] dark:border-ev-gray-700 bg-white dark:bg-ev-gray-800 p-1"
      role="group"
      aria-label="Choose the scale for federal amounts"
    >
      {options.filter((o): o is NonNullable<typeof o> => o !== null).map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={scale === opt.value}
          title={opt.hint}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue ${
            scale === opt.value
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

export default ScaleToggle;
