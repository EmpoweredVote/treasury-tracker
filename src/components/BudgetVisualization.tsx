import React, { useState } from 'react';
import BudgetIcicle from './BudgetIcicle';
import BudgetSunburst from './BudgetSunburst';
import type { BudgetCategory } from '../types/budget';

type ViewMode = 'icicle' | 'sunburst';

interface BudgetVisualizationProps {
  categories: BudgetCategory[];
  navigationPath: BudgetCategory[];
  totalBudget: number;
  onPathClick: (path: BudgetCategory[]) => void;
  isNonprofit?: boolean;
}

const BudgetVisualization: React.FC<BudgetVisualizationProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
  isNonprofit = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('icicle');

  return (
    <div className="w-full">
      {/* View toggle */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-manrope transition-all duration-200 cursor-pointer border ${
            viewMode === 'icicle'
              ? 'bg-ev-muted-blue border-ev-muted-blue text-white'
              : 'bg-white border-[#E2EBEF] text-[#6B7280] hover:border-ev-muted-blue hover:text-ev-muted-blue'
          }`}
          onClick={() => setViewMode('icicle')}
          aria-pressed={viewMode === 'icicle'}
          title="Bar chart view"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <rect x="2" y="4" width="20" height="5" rx="1" />
            <rect x="2" y="11" width="14" height="5" rx="1" />
            <rect x="2" y="18" width="8" height="5" rx="1" />
          </svg>
          <span>Bars</span>
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-manrope transition-all duration-200 cursor-pointer border ${
            viewMode === 'sunburst'
              ? 'bg-ev-muted-blue border-ev-muted-blue text-white'
              : 'bg-white border-[#E2EBEF] text-[#6B7280] hover:border-ev-muted-blue hover:text-ev-muted-blue'
          }`}
          onClick={() => setViewMode('sunburst')}
          aria-pressed={viewMode === 'sunburst'}
          title="Sunburst view"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="4" />
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="11" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
          </svg>
          <span>Sunburst</span>
        </button>
      </div>

      {/* Visualization content */}
      <div className="w-full">
        {viewMode === 'icicle' ? (
          <BudgetIcicle
            categories={categories}
            navigationPath={navigationPath}
            totalBudget={totalBudget}
            onPathClick={onPathClick}
            isNonprofit={isNonprofit}
          />
        ) : (
          <BudgetSunburst
            categories={categories}
            navigationPath={navigationPath}
            totalBudget={totalBudget}
            onPathClick={onPathClick}
          />
        )}
      </div>
    </div>
  );
};

export default BudgetVisualization;
