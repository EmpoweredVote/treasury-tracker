import React, { useEffect, useState } from 'react';
import type { FederalContext } from '../../types/budget';
import { loadFederalContext } from '../../data/dataLoader';
import DeficitStrip from './DeficitStrip';
import FirstSplitBands from './FirstSplitBands';
import ThisYearStrip from './ThisYearStrip';
import ComparabilityNote from './ComparabilityNote';
import { comparability } from '../../data/comparability';

/**
 * Federal landing block (Phase 45; year-aware in Phase 50): the two structural
 * facts citizens most lack — where the money goes at the highest level, and that
 * spending exceeds revenue — rendered proportionally from OFFICIAL sourced figures
 * (federal_annual_summary / federal_context_metrics), never tree totals.
 *
 * Phase 50: the block reflects the SELECTED period. annual_summary already carries
 * every year (FY1962+), so the bands/deficit strip switch year with no extra fetch.
 * The FY1976 Transition Quarter has no annual_summary row (it is year-keyed), so the
 * Mandatory/Discretionary/Net-Interest bands and the deficit strip are hidden for it
 * (the three lens trees below still render); Phase 51 adds the TQ explanation.
 * The live "this year so far" FYTD strip shows only on the current/default view.
 */
interface FederalLandingProps {
  fiscalYear: number;
  periodLabel: string | null;
  isCurrent: boolean;
}

const FederalLanding: React.FC<FederalLandingProps> = ({ fiscalYear, periodLabel, isCurrent }) => {
  const [context, setContext] = useState<FederalContext | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFederalContext()
      .then((ctx) => { if (!cancelled) setContext(ctx); })
      .catch((err) => {
        console.error('Federal context load failed:', err);
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl p-6 text-sm text-ev-gray-500 dark:text-ev-gray-400">
        Couldn't load the federal budget context. The breakdown below still works — try refreshing for the full picture.
      </div>
    );
  }

  if (!context) {
    return (
      <div
        className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl p-6 animate-pulse h-40"
        role="status"
        aria-label="Loading federal budget context"
      />
    );
  }

  // The Transition Quarter has no annual_summary row; any selected year resolves
  // by exact fiscal_year match. Falling back to no summary hides the bands/strip
  // rather than showing the wrong year's figures.
  const summary = periodLabel === null
    ? context.annual_summary.find((s) => s.fiscal_year === fiscalYear)
    : undefined;
  const displayName = (name: string) => context.source_display_names[name] ?? name;
  const fmtT = (v: number) => `$${(Math.abs(v) / 1e12).toFixed(1)} trillion`;

  // No annual-summary row (the TQ, or a year not in the summary): show a neutral,
  // unsourced-prose-free heading; the three lens trees render below.
  if (!summary) {
    return (
      <div className="space-y-2">
        <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
          <div className="h-[2px] bg-gradient-to-r from-ev-yellow-300 via-ev-yellow-400 to-ev-yellow-300 opacity-60" />
          <div className="p-6">
            <h2 className="text-lg font-semibold text-ev-gray-800 dark:text-ev-gray-100">
              {periodLabel ?? `FY${fiscalYear}`}
            </h2>
            <p className="text-sm text-ev-gray-600 dark:text-ev-gray-400 mt-1">
              Explore this period's spending by <em>what it's for</em> or by <em>who spends it</em>,
              and its receipts by source — in the government's own published numbers, every figure
              linked to its official source.
            </p>
          </div>
        </div>
        {/* The Transition Quarter view: the sourced TQ explanation replaces the
            neutral heading Phase 50 left here (CTX-02). Open by default — the
            note IS the context a citizen needs to read these single-quarter figures. */}
        {periodLabel !== null && (
          <ComparabilityNote
            title="About the Transition Quarter"
            entries={[comparability.transition_quarter]}
            defaultOpen
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="sr-only">The big picture — FY{summary.fiscal_year}</h2>

      {/* Context intro — every figure below comes from the sourced annual summary;
          no narrative beyond what the data states */}
      <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-ev-yellow-300 via-ev-yellow-400 to-ev-yellow-300 opacity-60" />
        <div className="p-6">
          <p className="text-base text-ev-gray-700 dark:text-ev-gray-300 leading-relaxed">
            In fiscal year {summary.fiscal_year}, the United States federal government collected{' '}
            <strong>{fmtT(summary.receipts)}</strong> and spent <strong>{fmtT(summary.outlays)}</strong> —
            spending {fmtT(Math.abs(summary.surplus_or_deficit))} more than it took in.
            {isCurrent && context.metrics.total_public_debt && (
              <> Borrowing like this, accumulated over decades, adds up to a total debt of{' '}
              <strong>{fmtT(context.metrics.total_public_debt.value)}</strong>.</>
            )}{' '}
            This page shows where that money came from and where it went, in the government's own
            published numbers — every figure links to its official source. Use the breakdown below to
            explore spending by <em>what it's for</em> or by <em>who spends it</em>, down to individual
            federal accounts.
          </p>
        </div>
      </div>
      <DeficitStrip
        summary={summary}
        debtMetric={isCurrent ? (context.metrics.total_public_debt ?? null) : null}
        sourceDisplayName={displayName(summary.source_name)}
      />
      <FirstSplitBands summary={summary} sourceDisplayName={displayName(summary.source_name)} />
      {isCurrent && (
        <ThisYearStrip
          fytdReceipts={context.metrics.fytd_receipts ?? null}
          fytdOutlays={context.metrics.fytd_outlays ?? null}
        />
      )}
    </div>
  );
};

export default FederalLanding;
