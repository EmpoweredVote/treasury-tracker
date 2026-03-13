import React from 'react';
import type { BudgetCategory } from '../types/budget';

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
    <div className="budget-bar-wrapper">
      <div 
        className="budget-bar budget-bar-static" 
        role="img"
        aria-label="Budget allocation visualization"
      >
        {categories.map((category, index) => (
          <div
            key={`${category.name}-${index}`}
            className="budget-segment budget-segment-static"
            style={{
              width: `${category.percentage}%`,
              backgroundColor: category.color,
            }}
            title={`${category.name}: ${formatCurrency(category.amount)} (${formatPercentage(category.percentage)}%)`}
          >
            {/* Show labels for categories that are at least 5% of the budget */}
            {category.percentage >= 5 && (
              <div className="segment-label">
                <div className="segment-name">{category.name}</div>
                <div className="segment-amount">{formatCurrency(category.amount)}</div>
                <div className="segment-percentage">({formatPercentage(category.percentage)}%)</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BudgetBar;
