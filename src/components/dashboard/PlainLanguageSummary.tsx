import React, { useCallback, useEffect, useRef, useState } from 'react';
import ScopeLabel from '../ScopeLabel';
import type { BudgetData, OrgFinancialSummary } from '../../types/budget';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';
import { chooseSpendVerb, usesSpentLanguage } from '../../utils/spendVerb';
import { revenueOpening } from '../../data/narrativeCopy';

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
  /**
   * Which dataset the reader is currently exploring. Only the nonprofit
   * gross→fee→net block reads it: platform fees are the answer to "how much of
   * my $2 reached you", which is a Money In question, so it renders beside the
   * Money In breakdown rather than on arrival.
   *
   * ⚠ Mirrors `DatasetType` in App.tsx, which is declared there and not
   * exported. Widen both together.
   */
  activeDataset?: 'revenue' | 'operating' | 'salaries';
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
  activeDataset,
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
  // ⚠ AMOUNT ONLY. Tense/verb choice must not use this — see spendVerb below.
  const showActualAmount = isPastYear && hasActualData;
  // Verb choice comes from the `basis` axis when the row states it, because
  // `hasActualData` only sees per-category actualAmount values — which sources
  // publishing one audited total per year (CA State Controller, every ACFR load)
  // never carry. Without this, an audited actual reads as "budgeted" directly
  // beneath an "Actuals" chip. See src/utils/spendVerb.ts.
  // ⚠ VERB ONLY — `total` below must keep using hasActualData, since actualTotal
  // is 0 in exactly the case this fixes.
  const spendVerb = chooseSpendVerb({
    basis: operatingData?.metadata.basis ?? null, isPastYear, hasActualData,
  });
  const spentLanguage = usesSpentLanguage(spendVerb);
  const revenueSpentLanguage = usesSpentLanguage(chooseSpendVerb({
    basis: revenueData?.metadata.basis ?? null, isPastYear, hasActualData,
  }));
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

  const total = showActualAmount ? actualTotal : budgetedTotal;
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

  // "Sep 20" from an ISO date, parsed as local parts so a UTC timestamp cannot
  // render as the previous day.
  const formatAsOf = (iso: string | null | undefined) => {
    const [y, m, d] = (iso || '').slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── The nonprofit stat row ────────────────────────────────────────────
  // Each entry is a figure that appears NOWHERE ELSE on the page. Anything a
  // tile or the chart below already states is deliberately absent — see the
  // render site.
  const nonprofitStats: { label: string; value: string; note: string }[] = [];
  if (isNonprofit) {
    if (orgSummary) {
      // ⚠⚠ NOT raised minus spent, and never `balance + pending_gross`. This is
      // the reconciled bank balance and nothing else, which is why it carries
      // its own as-of date rather than the fiscal year: bank payouts lag
      // platform donations, and EV also holds an untransferred Givebutter
      // wallet balance. See OrgFinancialSummary in types/budget.ts.
      const asOf = formatAsOf(orgSummary.balance_as_of);
      nonprofitStats.push({
        label: 'Money on hand',
        value: formatAmount(orgSummary.balance),
        note: asOf ? `as of ${asOf}` : 'last reconciled balance',
      });
      if (orgSummary.monthly_burn > 0) {
        nonprofitStats.push({
          label: 'Costs to run',
          value: formatAmount(orgSummary.monthly_burn),
          note: 'a month',
        });
      }
    }
    nonprofitStats.push(
      salariesTotal != null && salariesTotal > 0
        ? { label: 'Paid to staff', value: formatAmount(salariesTotal), note: `in ${fiscalYear}` }
        // ⚠ "so far in {year}", NOT an "all-volunteer" badge. $0 is a fact about
        // one year, not a permanent identity — the goal is eventually to pay
        // people, and a badge would be a claim about the future. Same reasoning
        // as the sentence this replaced.
        : {
            label: 'Paid to staff',
            value: '$0',
            note: isPastYear ? `in ${fiscalYear}` : `so far in ${fiscalYear}`,
          }
    );
  }

  return (
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
      {/* Subtle yellow top accent — inform pillar whisper */}
      <div className="h-[2px] bg-gradient-to-r from-ev-yellow-300 via-ev-yellow-400 to-ev-yellow-300 opacity-60" />

      <div className="p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-ev-yellow-400 mt-2.5 flex-shrink-0 opacity-70" />
          <h2 className="text-lg md:text-xl font-bold text-ev-gray-900 dark:text-ev-gray-100 leading-snug">
            {isNonprofit
              ? `How ${entity.name} ${spentLanguage ? 'used its' : 'uses its'} funds`
              : `How ${entity.name} ${spentLanguage ? 'spent' : 'plans to spend'} your money`}
          </h2>
        </div>

        <div className="space-y-4 text-[15px] leading-relaxed text-ev-gray-600 dark:text-ev-gray-400 ml-[18px]">
          {/* ── Nonprofit: three stats, not five sentences ───────────────────
              ⚠ The sentences removed here were removed because the page ALREADY
              states them, louder, within a screen:
                · "In {year}, EV is spending $X on operations."  → Money Out tile
                · "EV raises $X in income, primary source …"     → Money In tile
                · "The largest expense is … (42%) …"             → the chart below
              Restoring any of them puts the same figure on screen twice and asks
              a reader to do arithmetic before reaching the interactive part.
              What stayed is what appears NOWHERE else on the page.

              ⚠ No figure here is a year button. The year is chosen from the FY
              selector on the control row above; the old opening sentence was the
              only other way in, which is why it had one. */}
          {isNonprofit && nonprofitStats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {nonprofitStats.map(stat => (
                <div
                  key={stat.label}
                  // ⚠ `ev-gray-050`, with the leading zero — the token is
                  // `--color-ev-gray-050` (src/index.css). `bg-ev-gray-50`
                  // silently renders NOTHING, which is how these first shipped
                  // looking like three columns of floating text.
                  className="rounded-lg border border-ev-gray-100 bg-ev-gray-050 px-4 py-3 dark:border-ev-gray-700 dark:bg-ev-gray-900/40"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ev-gray-400 dark:text-ev-gray-500">
                    {stat.label}
                  </div>
                  <div className="mt-0.5 text-2xl font-bold tabular-nums leading-tight text-ev-gray-900 dark:text-ev-gray-100">
                    {stat.value}
                  </div>
                  <div className="text-[13px] text-ev-gray-500 dark:text-ev-gray-400">
                    {stat.note}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ⚠⚠ GOVERNMENT COPY FROM HERE DOWN — every block below is gated on
              `!isNonprofit`. The `isNonprofit ?` branches still inside them are
              unreachable under that gate and are left as they were on purpose:
              this copy carries documented past bugs (see narrativeCopy.ts), no
              test in this repo renders it, and churning it to delete dead
              branches would risk thousands of government pages for tidiness. */}
          {!isNonprofit && (
            <p>
              In <button
                type="button"
                className="font-bold text-ev-gray-800 dark:text-ev-gray-100 underline decoration-ev-yellow-400 decoration-2 underline-offset-2 hover:text-ev-muted-blue cursor-pointer transition-colors bg-transparent border-none p-0 m-0 text-[inherit] leading-[inherit] font-[inherit]"
                onClick={() => onYearClick?.()}
              >
                {fiscalYear}
              </button>,{' '}
              <>{entity.name}{isGeneralFundOnly ? "'s General Fund" : ''}{' '}
              {population > 0 ? (
                <>
                  {spentLanguage
                    ? <>spent <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> serving its {population.toLocaleString()} residents{yearSuffix}</>
                    : isGeneralFundOnly
                      ? <>totaled <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> for core city operations serving {population.toLocaleString()} residents{yearSuffix} — that's roughly{' '}
                          <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(perResident)} per person</strong>.</>
                      : <>budgeted <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> to serve its {population.toLocaleString()} residents{yearSuffix} — that's roughly{' '}
                          <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(perResident)} per person</strong>.</>
                  }
                  {spentLanguage && <> — roughly{' '}
                    <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatPerResident(perResident)} per person</strong>.</>
                  }
                </>
              ) : (
                <>
                  {spendVerb} <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(total)}</strong> across
                  all departments and services.
                </>
              )}</>
            </p>
          )}


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


          {/* Staff compensation moved into the stat row above — it was the 4th
              line of a prose block and is the page's strongest single fact. */}

          {!isNonprofit && topCategories.length > 0 && (
            <p>
              The {isNonprofit ? 'largest expense' : `biggest ${isGeneralFundOnly ? 'department' : 'share'}`} {spentLanguage ? 'was' : 'is'}{' '}
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


          {/* ⚠ Gated with the sentence above it, not independently: this italic
              paragraph describes topCategories[0] without naming it, so without
              that sentence it reads as a description of nothing. */}
          {!isNonprofit && topCategories[0]?.enrichment?.description &&
            topCategories[0].enrichment.description !== topCategories[0].enrichment.shortDescription && (
            <p className="text-[14px] text-ev-gray-500 dark:text-ev-gray-500 leading-relaxed italic">
              {topCategories[0].enrichment.description}
            </p>
          )}


          {/* Burn pace (Phase 76, D-05) is now the "Costs to run" stat above —
              still an honest spend rate, NOT a runway countdown (D-06). */}

          {!isNonprofit && revenueData && (
            <p>
              {/* ⚠ This clause used to hardcode "The city", so the New York state page
                  read "The city funded this through $93.9 billion" — and every county
                  and the federal page read the same way. The paragraph above it already
                  named the entity correctly, which is how it survived. See
                  data/narrativeCopy.ts. */}
              {revenueOpening(entity.name, isNonprofit, revenueSpentLanguage)}{' '}
              <strong
                className="text-ev-gray-800 dark:text-ev-gray-100 inline-block rounded-sm px-0.5"
                style={{
                  transition: 'box-shadow 700ms ease-out',
                  boxShadow: revenueGlowing
                    ? '0 0 0 2px #22c55e, 0 0 16px 4px rgba(34, 197, 94, 0.4)'
                    : 'none',
                }}
              >{formatAmount(animatedRevenue)}</strong>
              {' '}in {isNonprofit ? 'income' : `${revenueSpentLanguage ? '' : 'expected '}revenue`}
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

          {/* Cost-of-fundraising detail (Phase 76, D-07/D-08) — flows from the live
              "raised" figure above. Fees are a reduction of income, never an expense
              (D-09/D-12). Reconciled gross→fee→net per source, as of last refresh. */}
          {/* ⚠⚠ MOVED, NOT DELETED. This is the only place the page answers
              "how much of my $2 actually reached you", and a transparency page
              that drops its own processing costs is worse, not cleaner. But it
              asks a reader to weigh our platform fees before they have seen
              anything, so it now waits behind Money In — the tab where that
              question is actually being asked. */}
          {isNonprofit && activeDataset === 'revenue' && orgSummary && orgSummary.income_fees > 0 && (
            <div>
              <p>
                After{' '}
                <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(orgSummary.income_fees)}</strong>
                {' '}in platform fees,{' '}
                <strong className="text-ev-gray-800 dark:text-ev-gray-100">{formatAmount(orgSummary.income_net)}</strong>
                {' '}reached {entity.name}:
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

          {/* SCOPE-01 Task 10: which funds each figure covers, beside the source that
              published it. Rendered for `unknown` too -- omitting the label when we have
              not verified the scope would leave exactly the silent ambiguity this exists
              to remove. Copy lives in src/data/fundScopeVocabulary.ts.

              ⚠⚠ NOT FOR NONPROFITS, AND THIS IS NOT THE "HIDE UNKNOWN" MISTAKE.
              ScopeLabel's own contract says `unknown` must still render, and for a
              GOVERNMENT that is right: "which funds does this cover", "actual or
              adopted", "who audited it" are real questions with real answers that we
              may simply not have established yet, so saying so is the honest state.

              For EV they are not unanswered questions, they are INAPPLICABLE ones.
              There are no funds — there is one bank account, plus Givebutter, Patreon
              and Benevity. There is no GASB basis and no ACFR. So "Scope not
              established" tells a reader we failed to check something that does not
              exist, which is less honest than saying nothing, not more. All six EV
              budget rows carry unknown/unknown/unknown, so every chip on that page was
              this category error.

              ⚠ Gated on `isNonprofit`, deliberately NOT on `scope === 'unknown'` —
              government rows keep rendering their unknowns exactly as before. If EV's
              audit status is ever worth stating, the honest line is "unaudited,
              self-reported from bank records", which is a different claim from "not
              established" and belongs in copy written for it. */}
          {!isNonprofit && (operatingData || revenueData) && (
            <span className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
              {operatingData && (
                <ScopeLabel
                  scope={operatingData.metadata.fundScope}
                  basis={operatingData.metadata.basis}
                  auditGrade={operatingData.metadata.auditGrade}
                  datasetLabel={revenueData ? 'Money out' : undefined}
                />
              )}
              {revenueData && (
                <ScopeLabel
                  scope={revenueData.metadata.fundScope}
                  basis={revenueData.metadata.basis}
                  auditGrade={revenueData.metadata.auditGrade}
                  datasetLabel={operatingData ? 'Money in' : undefined}
                  withExplainer={!operatingData}
                />
              )}
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

export default PlainLanguageSummary;
