import React, { useState } from 'react';
import type { BudgetCategory } from '../../types/budget';
import { DATA_VIZ_HUES } from '../../utils/chartColors';

interface SpendingBreakdownBarProps {
  categories: BudgetCategory[];
  onCategoryClick?: (category: BudgetCategory) => void;
  maxCategories?: number;
}

/**
 * A compact horizontal stacked bar showing spending proportions.
 * Citizens can see at a glance where money goes without needing
 * to understand a complex chart. Hovering reveals details.
 */
const SpendingBreakdownBar: React.FC<SpendingBreakdownBarProps> = ({
  categories,
  onCategoryClick,
  maxCategories = 8,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  const visible = sorted.slice(0, maxCategories);
  const otherAmount = sorted.slice(maxCategories).reduce((sum, c) => sum + c.amount, 0);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  // Normalize ALL_CAPS names (Indiana Gateway) to Title Case for display
  const toDisplayName = (name: string) => {
    if (name === name.toUpperCase() && name.length > 2) {
      return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    return name;
  };

  return (
    <div className="space-y-3">
      {/* The bar */}
      <div className="flex h-10 rounded-lg overflow-hidden bg-ev-gray-100" role="img" aria-label="Spending breakdown bar">
        {visible.map((cat, i) => {
          const pct = total > 0 ? (cat.amount / total) * 100 : 0;
          if (pct < 0.5) return null; // too small to render
          const hue = DATA_VIZ_HUES[i % DATA_VIZ_HUES.length];
          const isHovered = hoveredIndex === i;

          return (
            <button
              key={cat.name}
              className="relative transition-all duration-200 cursor-pointer border-none outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-inset"
              style={{
                width: `${pct}%`,
                backgroundColor: `var(--color-data-${hue}-${isHovered ? '400' : '500'})`,
                transform: isHovered ? 'scaleY(1.08)' : 'scaleY(1)',
                transformOrigin: 'bottom',
              }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(i)}
              onBlur={() => setHoveredIndex(null)}
              onClick={() => onCategoryClick?.(cat)}
              aria-label={`${cat.name}: ${formatCurrency(cat.amount)} (${pct.toFixed(1)}%)`}
            >
              {pct > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white truncate px-2">
                  {pct > 15 ? toDisplayName(cat.name) : `${Math.round(pct)}%`}
                </span>
              )}
            </button>
          );
        })}
        {otherAmount > 0 && (
          <div
            className="flex items-center justify-center"
            style={{
              width: `${(otherAmount / total) * 100}%`,
              backgroundColor: 'var(--color-data-stone-300)',
            }}
          >
            <span className="text-[10px] font-medium text-ev-gray-700">Other</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {visible.map((cat, i) => {
          const pct = total > 0 ? (cat.amount / total) * 100 : 0;
          const hue = DATA_VIZ_HUES[i % DATA_VIZ_HUES.length];
          const isHovered = hoveredIndex === i;

          return (
            <button
              key={cat.name}
              className={`
                flex items-center gap-1.5 text-xs cursor-pointer bg-transparent border-none p-0
                transition-colors duration-150
                ${isHovered ? 'text-ev-gray-900' : 'text-ev-gray-600'}
              `}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => onCategoryClick?.(cat)}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: `var(--color-data-${hue}-500)` }}
              />
              <span className={`${isHovered ? 'font-semibold' : 'font-medium'} truncate max-w-[140px]`}>
                {toDisplayName(cat.name)}
              </span>
              <span className="text-ev-gray-400 tabular-nums">{Math.round(pct)}%</span>
            </button>
          );
        })}
      </div>

      {/* Hover detail tooltip */}
      {hoveredIndex !== null && visible[hoveredIndex] && (
        <div className="bg-ev-gray-900 text-white text-xs rounded-lg px-3 py-2 inline-flex items-center gap-3">
          <span className="font-semibold">{toDisplayName(visible[hoveredIndex].name)}</span>
          <span className="text-ev-gray-300">·</span>
          <span className="tabular-nums">{formatCurrency(visible[hoveredIndex].amount)}</span>
          <span className="text-ev-gray-300">·</span>
          <span className="tabular-nums">
            {((visible[hoveredIndex].amount / total) * 100).toFixed(1)}% of total
          </span>
        </div>
      )}
    </div>
  );
};

export default SpendingBreakdownBar;
