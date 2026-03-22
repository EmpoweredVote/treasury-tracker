import { useState } from 'react';
import type { BudgetCategory } from '../types/budget';

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
    return categories.map(category => {
      const percentage = category.amount / totalBudget;
      const dollarAmount = percentage * selectedDenomination;
      const cents = Math.round(dollarAmount * 100);
      
      return {
        name: category.name,
        color: category.color,
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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Tax Dollar Breakdown
          </h3>
          <p className="text-sm text-gray-600">
            For every <span className="font-semibold text-blue-600">${selectedDenomination}</span> you pay in city taxes, here's where it goes:
          </p>
        </div>
        
        {/* Denomination Selector */}
        <div className="flex gap-2">
          {denominationOptions.map(amount => (
            <button
              key={amount}
              onClick={() => setSelectedDenomination(amount)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                selectedDenomination === amount
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Dollar Bill Representation */}
      <div className="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-full max-w-xl">
            {/* Dollar bill visual */}
            <div className="h-32 bg-gradient-to-r from-green-100 via-green-50 to-green-100 rounded-lg border-2 border-green-300 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <pattern id="dollar-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                    <text x="10" y="25" fontSize="20" fill="currentColor" className="text-green-600">$</text>
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#dollar-pattern)" />
                </svg>
              </div>
              <div className="relative z-10 text-center">
                <div className="text-4xl font-bold text-green-700 mb-1">
                  ${selectedDenomination}
                </div>
                <div className="text-sm text-green-600 font-medium">
                  IN CITY TAXES
                </div>
              </div>
            </div>

            {/* Breakdown segments below */}
            <div className="mt-4 flex h-8 rounded-md overflow-hidden shadow-sm">
              {breakdown.map((item, index) => {
                const widthPercentage = item.percentage;
                
                return (
                  <div
                    key={index}
                    className="relative group transition-all hover:opacity-90"
                    style={{
                      width: `${widthPercentage}%`,
                      backgroundColor: item.color,
                      minWidth: widthPercentage > 3 ? 'auto' : '2%'
                    }}
                    title={`${item.name}: ${item.formattedAmount}`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                        {item.name}: {item.formattedAmount}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {breakdown.map((item, index) => (
          <div 
            key={index}
            className="bg-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div 
                  className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {item.percentage.toFixed(1)}% of budget
                  </div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold text-lg text-gray-900">
                  {item.formattedAmount}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Educational Note */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div className="flex gap-2">
          <div className="text-blue-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-sm text-gray-700">
            <strong className="text-gray-900">About this breakdown:</strong> This shows the approximate allocation based on the total city budget. Your actual tax contribution depends on your income, property value, and other factors. This visualization helps understand spending priorities at a glance.
          </div>
        </div>
      </div>
    </div>
  );
}
