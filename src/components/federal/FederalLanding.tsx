import React, { useEffect, useState } from 'react';
import type { FederalContext } from '../../types/budget';
import { loadFederalContext } from '../../data/dataLoader';
import DeficitStrip from './DeficitStrip';
import FirstSplitBands from './FirstSplitBands';
import ThisYearStrip from './ThisYearStrip';

/**
 * Federal landing block (Phase 45): the two structural facts citizens most
 * lack — where the money goes at the highest level, and that spending exceeds
 * revenue — rendered proportionally from OFFICIAL sourced figures
 * (federal_annual_summary / federal_context_metrics), never tree totals.
 * Replaces PlainLanguageSummary for the United States entity only.
 */
const FederalLanding: React.FC = () => {
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

  // Headline year = latest ACTUAL year in the summary (FY2025 as of v2.0)
  const headline = context.annual_summary[context.annual_summary.length - 1];
  const displayName = (name: string) => context.source_display_names[name] ?? name;
  const fmtT = (v: number) => `$${(Math.abs(v) / 1e12).toFixed(1)} trillion`;

  return (
    <div className="space-y-4">
      <h2 className="sr-only">The big picture — FY{headline.fiscal_year}</h2>

      {/* Context intro (UAT request) — every figure below comes from the sourced
          context payload; no narrative beyond what the data states */}
      <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-ev-yellow-300 via-ev-yellow-400 to-ev-yellow-300 opacity-60" />
        <div className="p-6">
          <p className="text-base text-ev-gray-700 dark:text-ev-gray-300 leading-relaxed">
            In fiscal year {headline.fiscal_year}, the United States federal government collected{' '}
            <strong>{fmtT(headline.receipts)}</strong> and spent <strong>{fmtT(headline.outlays)}</strong> —
            spending {fmtT(Math.abs(headline.surplus_or_deficit))} more than it took in.
            {context.metrics.total_public_debt && (
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
        summary={headline}
        debtMetric={context.metrics.total_public_debt ?? null}
        sourceDisplayName={displayName(headline.source_name)}
      />
      <FirstSplitBands summary={headline} sourceDisplayName={displayName(headline.source_name)} />
      <ThisYearStrip
        fytdReceipts={context.metrics.fytd_receipts ?? null}
        fytdOutlays={context.metrics.fytd_outlays ?? null}
      />
    </div>
  );
};

export default FederalLanding;
