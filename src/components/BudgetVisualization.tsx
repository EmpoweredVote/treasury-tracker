import React, { useState } from 'react';
import { track } from '@empoweredvote/analytics';
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
  /**
   * AUDIT-GRADE §5.2 — the chart's own source line, built by
   * `citationLine()` in src/data/provenanceLine.ts.
   *
   * ⚠⚠ IT LIVES IN HERE, NOT AT THE CALL SITES, and that is the point. App.tsx
   * renders this component from THREE separate branches — the line-items view,
   * the drill-down view and the leaf view — so a citation added beside one of
   * them would vanish the moment a reader clicked into a category, which is
   * exactly when they are most likely to screenshot a bar.
   *
   * ⚠ Absent renders nothing rather than a placeholder. Nonprofit pages pass
   * nothing: for EV these are inapplicable questions, not unanswered ones
   * (#198).
   */
  citation?: string;
}

const BudgetVisualization: React.FC<BudgetVisualizationProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
  isNonprofit = false,
  citation,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('icicle');

  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
    track('treasury_visualization_changed', { view });
  };

  return (
    <div className="w-full">
      {/* View toggle */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-manrope transition-all duration-200 cursor-pointer border ${
            viewMode === 'icicle'
              ? 'bg-ev-muted-blue border-ev-muted-blue text-white'
              : 'bg-white dark:bg-ev-gray-800 border-[#E2EBEF] dark:border-ev-gray-700 text-ev-gray-500 hover:border-ev-muted-blue hover:text-ev-muted-blue'
          }`}
          onClick={() => handleViewChange('icicle')}
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
              : 'bg-white dark:bg-ev-gray-800 border-[#E2EBEF] dark:border-ev-gray-700 text-ev-gray-500 hover:border-ev-muted-blue hover:text-ev-muted-blue'
          }`}
          onClick={() => handleViewChange('sunburst')}
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
      {/* ⚠ PLAIN TEXT, never a link and never a button. It is the way a figure
          in a printed report carries its source, and it affords nothing — the
          grade chip in the source bar above is the control that opens the
          explainer. A second pill here that looked clickable and did nothing is
          the false affordance Chris hit twice in AUSTIN-TRAVIS-01 UAT. */}
      {citation && (
        <p className="mt-2 border-t border-ev-gray-100 pt-2 text-[11px] leading-relaxed
                      text-ev-gray-500 dark:border-ev-gray-700 dark:text-ev-gray-400">
          {citation}
        </p>
      )}
    </div>
  );
};

export default BudgetVisualization;
