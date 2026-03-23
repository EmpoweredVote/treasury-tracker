import React from 'react';
import type { BudgetCategory } from '../types/budget';
import { DATA_VIZ_HUES } from '../utils/chartColors';

interface BudgetBarProps {
  categories: BudgetCategory[];
}

const BudgetBar: React.FC<BudgetBarProps> = ({ categories }) => {
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return (Math.round(percentage * 10) / 10).toFixed(1);
  };

  return (
    <div className="w-full">
      {/* Segmented bar */}
      <div
        className="w-full h-3 bg-[#EBEDEF] rounded-full overflow-hidden flex"
        role="img"
        aria-label="Budget allocation visualization"
      >
        {categories.map((category, index) => {
          const hue = DATA_VIZ_HUES[index % DATA_VIZ_HUES.length];
          return (
            <div
              key={`${category.name}-${index}`}
              className="h-full transition-all duration-200"
              style={{
                width: `${category.percentage}%`,
                backgroundColor: `var(--color-data-${hue}-500)`,
              }}
              title={`${category.name}: ${formatCurrency(category.amount)} (${formatPercentage(category.percentage)}%)`}
            />
          );
        })}
      </div>

      {/* Labels for categories >= 5% */}
      {categories.some(c => c.percentage >= 5) && (
        <div className="flex mt-2 gap-x-1 flex-wrap">
          {categories.map((category, index) => {
            if (category.percentage < 5) return null;
            const hue = DATA_VIZ_HUES[index % DATA_VIZ_HUES.length];
            return (
              <div key={index} className="flex items-center gap-1 mr-3 mb-1">
                <div
                  className="w-2 h-2 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: `var(--color-data-${hue}-500)` }}
                />
                <span className="text-xs text-[#6B7280] tabular-nums">
                  {category.name} {formatPercentage(category.percentage)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BudgetBar;
