import React from 'react';
import BudgetIcicle from './BudgetIcicle';
import type { BudgetCategory } from '../types/budget';

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
  return (
    <div className="w-full">
      <BudgetIcicle
        categories={categories}
        navigationPath={navigationPath}
        totalBudget={totalBudget}
        onPathClick={onPathClick}
      />
    </div>
  );
};

export default BudgetVisualization;
