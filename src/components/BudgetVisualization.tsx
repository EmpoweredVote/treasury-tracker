import React, { useState } from 'react';
import BudgetIcicle from './BudgetIcicle';
import BudgetSunburst from './BudgetSunburst';
import type { BudgetCategory } from '../types/budget';
import './BudgetVisualization.css';

type ViewMode = 'icicle' | 'sunburst';

interface BudgetVisualizationProps {
  categories: BudgetCategory[];
  navigationPath: BudgetCategory[];
  totalBudget: number;
  onPathClick: (path: BudgetCategory[]) => void;
}

const BudgetVisualization: React.FC<BudgetVisualizationProps> = ({
  categories,
  navigationPath,
  totalBudget,
  onPathClick,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('icicle');

  return (
    <div className="budget-visualization">
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'icicle' ? 'active' : ''}`}
          onClick={() => setViewMode('icicle')}
          aria-pressed={viewMode === 'icicle'}
          title="Bar chart view"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="5" rx="1" />
            <rect x="2" y="11" width="14" height="5" rx="1" />
            <rect x="2" y="18" width="8" height="5" rx="1" />
          </svg>
          <span>Bars</span>
        </button>
        <button
          className={`toggle-btn ${viewMode === 'sunburst' ? 'active' : ''}`}
          onClick={() => setViewMode('sunburst')}
          aria-pressed={viewMode === 'sunburst'}
          title="Sunburst view"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

      <div className="visualization-content">
        {viewMode === 'icicle' ? (
          <BudgetIcicle
            categories={categories}
            navigationPath={navigationPath}
            totalBudget={totalBudget}
            onPathClick={onPathClick}
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
