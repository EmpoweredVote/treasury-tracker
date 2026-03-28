import React from 'react';
import type { BudgetData } from '../../types/budget';

interface PlainLanguageSummaryProps {
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
 * Generates a plain-English narrative summary of a city's finances.
 * Designed for citizens who want the "so what?" not the raw numbers.
 */
const PlainLanguageSummary: React.FC<PlainLanguageSummaryProps> = ({
  entity,
  operatingData,
  revenueData,
  fiscalYear,
}) => {
  if (!operatingData) return null;

  const total = operatingData.metadata.totalBudget;
  const population = entity.population;
  const perResident = population > 0 ? total / population : 0;

  // If only 1 top-level fund (e.g., General), use its children for "top categories"
  const rawTopLevel = operatingData.categories || [];
  const isGeneralFundOnly = rawTopLevel.length === 1;
  const drillLevel = isGeneralFundOnly
    ? (rawTopLevel[0]?.subcategories || [])
    : rawTopLevel;

  // Find the top 3 spending categories from the meaningful level
  const topCategories = [...drillLevel]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // Convert ALL_CAPS names (Indiana Gateway) to Title Case for readable display
  const toDisplayName = (name: string) => {
    if (name === name.toUpperCase() && name.length > 2) {
      return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    return name;
  };

  const formatAmount = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)} billion`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)} million`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const formatPerResident = (n: number) =>
    `$${Math.round(n).toLocaleString()}`;

  return (
    <div className="bg-white border border-ev-gray-200 rounded-xl overflow-hidden">
      {/* Subtle yellow top accent — inform pillar whisper */}
      <div className="h-[2px] bg-gradient-to-r from-ev-yellow-300 via-ev-yellow-400 to-ev-yellow-300 opacity-60" />

      <div className="p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-ev-yellow-400 mt-2.5 flex-shrink-0 opacity-70" />
          <h2 className="text-lg md:text-xl font-bold text-ev-gray-900 leading-snug">
            How {entity.name} spends your money
          </h2>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ev-gray-600 ml-[18px]">
          <p>
            In {fiscalYear}, {entity.name}'s {isGeneralFundOnly ? 'General Fund ' : ''}
            {population > 0 ? (
              <>
                {isGeneralFundOnly ? 'totaled' : 'budgeted'}{' '}
                <strong className="text-ev-gray-800">{formatAmount(total)}</strong>
                {isGeneralFundOnly
                  ? <> for core city operations serving {population.toLocaleString()} residents.</>
                  : <> to serve its {population.toLocaleString()} residents — that's roughly{' '}
                      <strong className="text-ev-gray-800">{formatPerResident(perResident)} per person</strong>.</>
                }
              </>
            ) : (
              <>
                budgeted <strong className="text-ev-gray-800">{formatAmount(total)}</strong> across
                all departments and services.
              </>
            )}
          </p>

          {topCategories.length > 0 && (
            <p>
              The biggest {isGeneralFundOnly ? 'department' : 'share'} is{' '}
              <strong className="text-ev-gray-800">{toDisplayName(topCategories[0]?.name)}</strong>
              {' '}({Math.round(topCategories[0]?.percentage)}% of the {isGeneralFundOnly ? 'fund' : 'budget'})
              {topCategories[1] && (
                <>, followed by{' '}
                  <strong className="text-ev-gray-800">{toDisplayName(topCategories[1]?.name)}</strong>
                  {' '}({Math.round(topCategories[1]?.percentage)}%)
                </>
              )}
              {topCategories[2] && (
                <> and{' '}
                  <strong className="text-ev-gray-800">{toDisplayName(topCategories[2]?.name)}</strong>
                  {' '}({Math.round(topCategories[2]?.percentage)}%)
                </>
              )}.
            </p>
          )}

          {revenueData && (
            <p>
              The city funds this through{' '}
              <strong className="text-ev-gray-800">{formatAmount(revenueData.metadata.totalBudget)}</strong>
              {' '}in expected revenue
              {revenueData.categories?.[0] && (
                <>, with the largest source being{' '}
                  <strong className="text-ev-gray-800">
                    {toDisplayName(revenueData.categories[0].name)}
                  </strong>
                </>
              )}.
            </p>
          )}
        </div>

        <div className="mt-6 ml-[18px]">
          <p className="text-xs text-ev-gray-400">
            Explore the categories below to see exactly where every dollar goes →
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlainLanguageSummary;
