import React from 'react';
import { DollarSign, Users, Building2, Receipt } from 'lucide-react';
import InsightCard from './InsightCard';
import type { BudgetData } from '../../types/budget';

interface QuickFactsRowProps {
  entity: {
    name: string;
    state: string;
    population: number;
  };
  operatingData: BudgetData | null;
  revenueData: BudgetData | null;
  fiscalYear: string;
}

/**
 * A row of 3-4 key metric cards that give citizens instant context.
 * Uses plain language labels, not accounting jargon.
 */
const QuickFactsRow: React.FC<QuickFactsRowProps> = ({
  entity,
  operatingData,
  revenueData,
  fiscalYear,
}) => {
  const formatCompact = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const totalBudget = operatingData?.metadata.totalBudget ?? 0;
  const totalRevenue = revenueData?.metadata.totalBudget ?? 0;
  const population = entity.population;
  const perResident = population > 0 ? totalBudget / population : 0;

  // Count spending areas: if only 1 top-level fund, count its children (departments).
  // Otherwise count the top-level funds themselves.
  const topCategories = operatingData?.categories ?? [];
  const isGeneralFundOnly = topCategories.length === 1;
  const spendingAreaCount = isGeneralFundOnly
    ? (topCategories[0]?.subcategories?.length ?? 0)
    : topCategories.length;

  // Label the budget card accurately based on scope
  const budgetLabel = isGeneralFundOnly
    ? `${fiscalYear} General Fund`
    : `${fiscalYear} Total Budget`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <InsightCard
        label={budgetLabel}
        value={totalBudget > 0 ? formatCompact(totalBudget) : '—'}
        subtext={isGeneralFundOnly ? 'Core city operations' : 'What the city plans to spend'}
        variant="primary"
        icon={<DollarSign size={18} className="text-ev-gray-500" />}
      />

      {population > 0 && (
        <InsightCard
          label="Cost Per Resident"
          value={perResident > 0 ? `$${Math.round(perResident).toLocaleString()}` : '—'}
          subtext={`Based on ${population.toLocaleString()} residents`}
          icon={<Users size={18} className="text-ev-gray-500" />}
        />
      )}

      <InsightCard
        label="Expected Revenue"
        value={totalRevenue > 0 ? formatCompact(totalRevenue) : '—'}
        subtext="Money coming in"
        icon={<Receipt size={18} className="text-ev-gray-500" />}
      />

      <InsightCard
        label="Spending Areas"
        value={spendingAreaCount > 0 ? `${spendingAreaCount}` : '—'}
        subtext="Departments & categories"
        icon={<Building2 size={18} className="text-ev-gray-500" />}
      />
    </div>
  );
};

export default QuickFactsRow;
