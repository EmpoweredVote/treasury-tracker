import React from 'react';
import type { BudgetData } from '../../types/budget';

interface PlainLanguageSummaryProps {
  entity: {
    name: string;
    state: string;
    population: number;
    entity_type: string;
  };
  operatingData: BudgetData | null;
  revenueData: BudgetData | null;
  fiscalYear: string;
  isPastYear?: boolean;
  onCategoryClick?: (categoryName: string, dataset: 'operating' | 'revenue') => void;
  onYearClick?: () => void;
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
  isPastYear = false,
  onCategoryClick,
  onYearClick,
}) => {
  if (!operatingData) return null;

  const budgetedTotal = operatingData.metadata.totalBudget;
  const actualTotal = (operatingData.categories || []).reduce(
    (sum, c) => sum + (c.actualAmount ?? 0), 0
  );
  // Only use "spent" language if we actually have actual spending data
  const hasActualData = actualTotal > 0;
  const showActual = isPastYear && hasActualData;
  const total = showActual ? actualTotal : budgetedTotal;
  const population = entity.population;
  const perResident = population > 0 ? total / population : 0;
  const isNonprofit = entity.entity_type === 'nonprofit';
  console.debug('[PlainLanguageSummary] entity_type:', entity.entity_type, '| isNonprofit:', isNonprofit);

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

  // Collect unique data sources across operating + revenue
  const sourceMap = new Map<string, { displayName: string; url: string }>();
  if (operatingData?.metadata.dataSourceInfo) {
    const s = operatingData.metadata.dataSourceInfo;
    sourceMap.set(s.displayName, s);
  }
  if (revenueData?.metadata.dataSourceInfo) {
    const s = revenueData.metadata.dataSourceInfo;
    sourceMap.set(s.displayName, s);
  }
  const dataSources = [...sourceMap.values()];

  // Convert ALL_CAPS names (Indiana Gateway) to Title Case for readable display
  const toDisplayName = (name: string) => {
    if (name === name.toUpperCase() && name.length > 2) {
      return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    return name;
  };

  const formatAmount = (n: number) => {
    if (isNonprofit) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
            {isNonprofit
              ? `How ${entity.name} ${showActual ? 'used its' : 'uses its'} funds`
              : `How ${entity.name} ${showActual ? 'spent' : 'plans to spend'} your money`}
          </h2>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ev-gray-600 ml-[18px]">
          <p>
            In <button
              type="button"
              className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
              onClick={() => onYearClick?.()}
            >
              {fiscalYear}
            </button>,{' '}
            {isNonprofit ? (
              <>
                {entity.name} {showActual ? 'spent' : 'budgeted'}{' '}
                <strong className="text-ev-gray-800">{formatAmount(total)}</strong> on operations.
              </>
            ) : (
              <>{entity.name}'s {isGeneralFundOnly ? 'General Fund ' : ''}
              {population > 0 ? (
                <>
                  {showActual
                    ? <>spent <strong className="text-ev-gray-800">{formatAmount(total)}</strong> serving its {population.toLocaleString()} residents</>
                    : isGeneralFundOnly
                      ? <>totaled <strong className="text-ev-gray-800">{formatAmount(total)}</strong> for core city operations serving {population.toLocaleString()} residents.</>
                      : <>budgeted <strong className="text-ev-gray-800">{formatAmount(total)}</strong> to serve its {population.toLocaleString()} residents — that's roughly{' '}
                          <strong className="text-ev-gray-800">{formatPerResident(perResident)} per person</strong>.</>
                  }
                  {showActual && <> — roughly{' '}
                    <strong className="text-ev-gray-800">{formatPerResident(perResident)} per person</strong>.</>
                  }
                </>
              ) : (
                <>
                  {showActual ? 'spent' : 'budgeted'} <strong className="text-ev-gray-800">{formatAmount(total)}</strong> across
                  all departments and services.
                </>
              )}</>
            )}
          </p>

          {topCategories.length > 0 && (
            <p>
              The {isNonprofit ? 'largest expense' : `biggest ${isGeneralFundOnly ? 'department' : 'share'}`} {showActual ? 'was' : 'is'}{' '}
              <button
                className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                onClick={() => onCategoryClick?.(topCategories[0]?.name, 'operating')}
              >{toDisplayName(topCategories[0]?.name)}</button>
              {topCategories[0]?.enrichment?.shortDescription && (
                <span className="text-ev-gray-400 text-[13px]">{' '}— {topCategories[0].enrichment.shortDescription.toLowerCase()}</span>
              )}
              {' '}({Math.round(topCategories[0]?.percentage)}% of the {isNonprofit ? 'total' : isGeneralFundOnly ? 'fund' : 'budget'})
              {topCategories[1] && (
                <>, followed by{' '}
                  <button
                    className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                    onClick={() => onCategoryClick?.(topCategories[1]?.name, 'operating')}
                  >{toDisplayName(topCategories[1]?.name)}</button>
                  {topCategories[1]?.enrichment?.shortDescription && (
                    <span className="text-ev-gray-400 text-[13px]">{' '}— {topCategories[1].enrichment.shortDescription.toLowerCase()}</span>
                  )}
                  {' '}({Math.round(topCategories[1]?.percentage)}%)
                </>
              )}
              {topCategories[2] && (
                <> and{' '}
                  <button
                    className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                    onClick={() => onCategoryClick?.(topCategories[2]?.name, 'operating')}
                  >{toDisplayName(topCategories[2]?.name)}</button>
                  {topCategories[2]?.enrichment?.shortDescription && (
                    <span className="text-ev-gray-400 text-[13px]">{' '}— {topCategories[2].enrichment.shortDescription.toLowerCase()}</span>
                  )}
                  {' '}({Math.round(topCategories[2]?.percentage)}%)
                </>
              )}.
            </p>
          )}

          {revenueData && (
            <p>
              {isNonprofit
                ? <>{entity.name} {showActual ? 'raised' : 'raises'}{' '}</>
                : <>The city {showActual ? 'funded' : 'funds'} this through{' '}</>
              }
              <strong className="text-ev-gray-800">{formatAmount(revenueData.metadata.totalBudget)}</strong>
              {' '}in {isNonprofit ? 'income' : `${showActual ? '' : 'expected '}revenue`}
              {revenueData.categories?.[0] && (
                <>, with the {isNonprofit ? 'primary source being' : 'largest source being'}{' '}
                  <button
                    className="font-bold text-ev-gray-800 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                    onClick={() => onCategoryClick?.(revenueData!.categories[0].name, 'revenue')}
                  >
                    {toDisplayName(revenueData.categories[0].name)}
                  </button>
                  {revenueData.categories[0]?.enrichment?.shortDescription && (
                    <span className="text-ev-gray-400 text-[13px]">{' '}— {revenueData.categories[0].enrichment.shortDescription.toLowerCase()}</span>
                  )}
                </>
              )}.
            </p>
          )}

          {dataSources.length > 0 && (
            <p className="text-[11px] text-ev-gray-400 pt-2 border-t border-ev-gray-100 mt-4">
              Data sourced from{' '}
              {dataSources.map((source, i) => (
                <span key={source.displayName}>
                  {i > 0 && i === dataSources.length - 1 && ' and '}
                  {i > 0 && i < dataSources.length - 1 && ', '}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-ev-gray-300 underline-offset-2 hover:text-ev-gray-600 transition-colors"
                  >
                    {source.displayName}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default PlainLanguageSummary;
