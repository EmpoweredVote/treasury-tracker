import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { BudgetData, OrgFinancialSummary } from '../../types/budget';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';

interface PlainLanguageSummaryProps {
  entity: {
    name: string;
    state: string;
    population: number;
    population_year?: number | null;
    entity_type: string;
  };
  operatingData: BudgetData | null;
  revenueData: BudgetData | null;
  salariesTotal?: number | null;
  fiscalYear: string;
  isPastYear?: boolean;
  onCategoryClick?: (categoryName: string, dataset: 'operating' | 'revenue') => void;
  onYearClick?: () => void;
  allFundsRequirementsData?: BudgetData | null;
  /** Reconciled nonprofit summary (Phase 76) — drives the gross→net fee story
   *  and burn-pace line. Null for non-nonprofit entities. */
  orgSummary?: OrgFinancialSummary | null;
}

/**
 * Generates a plain-English narrative summary of a city's finances.
 * Designed for citizens who want the "so what?" not the raw numbers.
 */
const PlainLanguageSummary: React.FC<PlainLanguageSummaryProps> = ({
  entity,
  operatingData,
  revenueData,
  salariesTotal = null,
  fiscalYear,
  isPastYear = false,
  onCategoryClick,
  onYearClick,
  allFundsRequirementsData = null,
  orgSummary = null,
}) => {
  // ── Derive values needed by hooks (safe even when operatingData is null) ──
  const budgetedTotal = allFundsRequirementsData?.metadata.totalBudget
    ?? operatingData?.metadata.totalBudget
    ?? 0;
  const actualTotal = (operatingData?.categories ?? []).reduce(
    (sum, c) => sum + (c.actualAmount ?? 0), 0
  );
  // Only use "spent" language if we actually have actual spending data
  const hasActualData = actualTotal > 0;
  const showActual = isPastYear && hasActualData;
  // Current year with actual spend data — year isn't done, so use "has spent" + "As of {month}"
  const isCurrentYearWithActuals = !isPastYear && hasActualData;
  // Revenue count-up animation + green-glow settle
  const revenueTarget = revenueData?.metadata.totalBudget ?? 0;

  // ── All hooks must be called unconditionally, before any return ───────
  const [revenueGlowing, setRevenueGlowing] = useState(false);
  const glowTimerRef = useRef<number | null>(null);
  // Skip the glow on the initial null→value load; only glow on genuine increases.
  const isFirstRevenueAnimRef = useRef(true);

  // CRITICAL: onComplete MUST be wrapped in useCallback with stable deps,
  // or the useAnimatedCounter effect resets on every render.
  const handleRevenueSettled = useCallback(() => {
    if (isFirstRevenueAnimRef.current) {
      isFirstRevenueAnimRef.current = false;
      return;
    }
    setRevenueGlowing(true);
    if (glowTimerRef.current != null) window.clearTimeout(glowTimerRef.current);
    glowTimerRef.current = window.setTimeout(() => setRevenueGlowing(false), 2000);
  }, []);

  const animatedRevenue = useAnimatedCounter(revenueTarget, 600, handleRevenueSettled);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (glowTimerRef.current != null) window.clearTimeout(glowTimerRef.current);
    };
  }, []);

  // ── Guard: nothing to render without operating data ───────────────────
  if (!operatingData) return null;

  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });
  const total = showActual ? actualTotal : budgetedTotal;
  const population = entity.population;
  const populationYear = entity.population_year;
  const yearSuffix = populationYear ? ` (${populationYear} est.)` : '';
  const perResident = population > 0 ? total / population : 0;
  const isNonprofit = entity.entity_type === 'nonprofit';

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
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
      {/* Subtle yellow top accent — inform pillar whisper */}
      <div className="h-[2px] bg-gradient-to-r from-ev-yellow-300 via-ev-yellow-400 to-ev-yellow-300 opacity-60" />

      <div className="p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-ev-yellow-400 mt-2.5 flex-shrink-0 opacity-70" />
          <h2 className="text-lg md:text-xl font-bold text-ev-gray-900 dark:text-ev-gray-100 leading-snug">
            {isNonprofit
              ? `How ${entity.name} ${showActual ? 'used its' : 'uses its'} funds`
              : `How ${entity.name} ${showActual ? 'spent' : 'plans to spend'} your money`}
          </h2>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ev-gray-600 dark:text-ev-gray-400 ml-[18px]">
          <p>
            {isNonprofit && isCurrentYearWithActuals
              ? <>As of {currentMonthName}, {fiscalYear},{' '}</>
              : <>In <button
                  type="button"
                  className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                  onClick={() => onYearClick?.()}
                >
                  {fiscalYear}
                </button>,{' '}</>
            }
            {isNonprofit ? (
              <>
                {entity.name}{' '}
                {showActual ? 'spent' : isCurrentYearWithActuals ? 'has spent' : isPastYear ? 'budgeted' : 'is spending'}{' '}
                <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(isCurrentYearWithActuals ? actualTotal : total)}</strong> on operations.
              </>
            ) : (
              <>{entity.name}'s {isGeneralFundOnly ? 'General Fund ' : ''}
              {population > 0 ? (
                <>
                  {showActual
                    ? <>spent <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> serving its {population.toLocaleString()} residents{yearSuffix}</>
                    : isGeneralFundOnly
                      ? <>totaled <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> for core city operations serving {population.toLocaleString()} residents{yearSuffix} — that's roughly{' '}
                          <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(perResident)} per person</strong>.</>
                      : <>budgeted <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> to serve its {population.toLocaleString()} residents{yearSuffix} — that's roughly{' '}
                          <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(perResident)} per person</strong>.</>
                  }
                  {showActual && <> — roughly{' '}
                    <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(perResident)} per person</strong>.</>
                  }
                </>
              ) : (
                <>
                  {showActual ? 'spent' : 'budgeted'} <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> across
                  all departments and services.
                </>
              )}</>
            )}
          </p>


          {allFundsRequirementsData && operatingData &&
            allFundsRequirementsData.metadata.totalBudget > operatingData.metadata.totalBudget && (
            <p className="text-[13px] text-ev-gray-400 dark:text-ev-gray-500 mt-1 italic">
              This {formatAmount(allFundsRequirementsData.metadata.totalBudget)} total covers all city funds.
              The department breakdown below accounts for{' '}
              <strong className="text-ev-gray-600 dark:text-ev-gray-300">
                {formatAmount(operatingData.metadata.totalBudget)}
              </strong>{' '}
              in departmental operations; the remaining{' '}
              <strong className="text-ev-gray-600 dark:text-ev-gray-300">
                {formatAmount(
                  allFundsRequirementsData.metadata.totalBudget - operatingData.metadata.totalBudget
                )}
              </strong>{' '}
              covers debt service, capital projects, and other city-wide requirements.
            </p>
          )}


          {isNonprofit && (
            <p>
              {salariesTotal != null && salariesTotal > 0
                ? <>{entity.name} {showActual ? 'paid' : 'budgets'}{' '}
                    <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(salariesTotal)}</strong> in staff compensation.
                  </>
                : <>{isPastYear ? <>In {fiscalYear}, {entity.name} paid</> : <>So far in {fiscalYear}, {entity.name} has paid</>} <strong className="text-ev-gray-800 dark:text-ev-gray-100">$0</strong> in staff compensation.</>
              }
            </p>
          )}

          {topCategories.length > 0 && (
            <p>
              The {isNonprofit ? 'largest expense' : `biggest ${isGeneralFundOnly ? 'department' : 'share'}`} {showActual ? 'was' : 'is'}{' '}
              <button
                className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                onClick={() => onCategoryClick?.(topCategories[0]?.name, 'operating')}
              >{toDisplayName(topCategories[0]?.name)}</button>
              {topCategories[0]?.enrichment?.shortDescription && (
                <span className="text-ev-gray-400 text-[13px]">{' '}— {topCategories[0].enrichment.shortDescription.toLowerCase()}</span>
              )}
              {' '}({Math.round(topCategories[0]?.percentage)}% of the {isNonprofit ? 'total' : isGeneralFundOnly ? 'fund' : 'budget'})
              {topCategories[1] && (
                <>, followed by{' '}
                  <button
                    className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
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
                    className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
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


          {topCategories[0]?.enrichment?.description &&
            topCategories[0].enrichment.description !== topCategories[0].enrichment.shortDescription && (
            <p className="text-[14px] text-ev-gray-500 dark:text-ev-gray-500 leading-relaxed italic">
              {topCategories[0].enrichment.description}
            </p>
          )}


          {/* Burn pace (Phase 76, D-05) — honest spend rate, NOT a runway countdown (D-06) */}
          {isNonprofit && orgSummary && orgSummary.monthly_burn > 0 && topCategories[0] && (
            <p>
              {entity.name} currently spends about{' '}
              <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(orgSummary.monthly_burn)}</strong>
              {' '}per month, mostly on{' '}
              <button
                className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                onClick={() => onCategoryClick?.(topCategories[0].name, 'operating')}
              >{toDisplayName(topCategories[0].name)}</button>.
            </p>
          )}

          {/* Income gross→net fee story (Phase 76, D-07/D-08). Fees are a reduction
              of income, never an expense (D-09/D-12). Replaces the generic income
              sentence for EV; the per-source breakdown follows directly beneath. */}
          {isNonprofit && orgSummary && (
            <div>
              <p>
                Donors gave{' '}
                <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(orgSummary.income_gross)}</strong>;
                {' '}after{' '}
                <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(orgSummary.income_fees)}</strong>
                {' '}in platform fees,{' '}
                <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(orgSummary.income_net)}</strong>
                {' '}reached {entity.name}.
              </p>
              <ul className="mt-2 space-y-1 text-[14px] text-ev-gray-500 dark:text-ev-gray-400">
                {orgSummary.income_by_source.filter(s => s.gross > 0).map(s => (
                  <li key={s.source}>
                    <span className="font-semibold text-ev-gray-700 dark:text-ev-gray-300">{s.source}</span>:{' '}
                    {formatAmount(s.gross)} → {formatAmount(s.fee)} fee → {formatAmount(s.net)} net
                  </li>
                ))}
              </ul>
            </div>
          )}

          {revenueData && !(isNonprofit && orgSummary) && (
            <p>
              {isNonprofit
                ? <>{entity.name} {showActual ? 'raised' : 'raises'}{' '}</>
                : <>The city {showActual ? 'funded' : 'funds'} this through{' '}</>
              }
              <strong
                className="text-ev-gray-800 dark:text-ev-gray-100 inline-block rounded-sm px-0.5"
                style={{
                  transition: 'box-shadow 700ms ease-out',
                  boxShadow: revenueGlowing
                    ? '0 0 0 2px #22c55e, 0 0 16px 4px rgba(34, 197, 94, 0.4)'
                    : 'none',
                }}
              >{formatAmount(animatedRevenue)}</strong>
              {' '}in {isNonprofit ? 'income' : `${showActual ? '' : 'expected '}revenue`}
              {revenueData.categories?.[0] && (
                <>, with the {isNonprofit ? 'primary source being' : 'largest source being'}{' '}
                  <button
                    className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                    onClick={() => onCategoryClick?.(revenueData!.categories[0].name, 'revenue')}
                  >
                    {toDisplayName(revenueData.categories[0].name)}
                  </button>
                  {revenueData.categories[0]?.enrichment?.shortDescription && (
                    <span className="text-ev-gray-400 text-[13px]">{' '}— {revenueData.categories[0].enrichment.shortDescription.toLowerCase()}</span>
                  )}
                </>
              )}
              {!isNonprofit && population > 0 && revenueTarget > 0 && (
                <>{' '}— that's{' '}
                  <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(revenueTarget / population)} per resident</strong>
                  {populationYear ? ` (${populationYear} est.)` : ''}</>
              )}.
            </p>
          )}

          {dataSources.length > 0 && (
            <p className="text-[11px] text-ev-gray-400 dark:text-ev-gray-500 pt-2 border-t border-ev-gray-100 dark:border-ev-gray-700 mt-4">
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
