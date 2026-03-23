import { useState } from 'react';
import type { BudgetCategory } from '../types/budget';
import { DATA_VIZ_HUES } from '../utils/chartColors';

interface PerDollarBreakdownProps {
  categories: BudgetCategory[];
  totalBudget: number;
  denominationOptions?: number[];
}

export default function PerDollarBreakdown({
  categories,
  totalBudget,
  denominationOptions = [1, 10, 100]
}: PerDollarBreakdownProps) {
  const [selectedDenomination, setSelectedDenomination] = useState(10);

  // Calculate breakdown for selected denomination
  const calculateBreakdown = () => {
    return categories.map((category, index) => {
      const percentage = category.amount / totalBudget;
      const dollarAmount = percentage * selectedDenomination;
      const cents = Math.round(dollarAmount * 100);

      return {
        name: category.name,
        index,
        amount: dollarAmount,
        cents: cents,
        percentage: percentage * 100,
        formattedAmount: cents >= 100
          ? `$${(cents / 100).toFixed(2)}`
          : `${cents}¢`
      };
    }).sort((a, b) => b.cents - a.cents);
  };

  const breakdown = calculateBreakdown();

  return (
    <div className="bg-white border border-[#E2EBEF] rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-bold font-manrope text-[#1C1C1C] mb-1">
            Tax Dollar Breakdown
          </h3>
          <p className="text-sm text-[#6B7280]">
            For every{' '}
            <span className="font-bold text-ev-muted-blue tabular-nums">${selectedDenomination}</span>{' '}
            you pay in city taxes, here's where it goes:
          </p>
        </div>

        {/* Denomination Selector */}
        <div className="flex gap-2">
          {denominationOptions.map(amount => (
            <button
              key={amount}
              onClick={() => setSelectedDenomination(amount)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer font-manrope ${
                selectedDenomination === amount
                  ? 'bg-ev-muted-blue text-white'
                  : 'bg-white text-[#6B7280] border border-[#E2EBEF] hover:border-ev-muted-blue hover:text-ev-muted-blue'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Segmented bar */}
      <div className="mb-6">
        <div className="flex h-8 rounded-lg overflow-hidden shadow-sm bg-[#EBEDEF]">
          {breakdown.map((item) => {
            const hue = DATA_VIZ_HUES[item.index % DATA_VIZ_HUES.length];
            return (
              <div
                key={item.index}
                className="relative group h-full transition-opacity hover:opacity-90"
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: `var(--color-data-${hue}-500)`,
                  minWidth: item.percentage > 3 ? undefined : '2%'
                }}
                title={`${item.name}: ${item.formattedAmount}`}
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-[#1C1C1C] text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {item.name}: {item.formattedAmount}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1C1C1C]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Breakdown List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {breakdown.map((item) => {
          const hue = DATA_VIZ_HUES[item.index % DATA_VIZ_HUES.length];
          return (
            <div
              key={item.index}
              className="flex items-center justify-between py-2 border-b border-[#E2EBEF] last:border-0"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `var(--color-data-${hue}-500)` }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#1C1C1C] truncate">{item.name}</div>
                  <div className="text-xs text-[#6B7280] tabular-nums">{item.percentage.toFixed(1)}% of budget</div>
                </div>
              </div>
              <div className="text-sm font-bold tabular-nums text-[#1C1C1C] flex-shrink-0">
                {item.formattedAmount}
              </div>
            </div>
          );
        })}
      </div>

      {/* Educational Note */}
      <div className="mt-6 p-4 bg-[#F7F7F8] rounded-lg border border-[#E2EBEF]">
        <div className="flex gap-3">
          <div className="text-ev-muted-blue flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-sm text-[#6B7280]">
            <strong className="text-[#1C1C1C]">About this breakdown:</strong>{' '}
            This shows the approximate allocation based on the total city budget. Your actual tax contribution depends on your income, property value, and other factors. This visualization helps understand spending priorities at a glance.
          </div>
        </div>
      </div>
    </div>
  );
}
