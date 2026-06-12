import React, { useEffect, useState } from 'react';
import type { FederalContext } from '../../types/budget';
import { loadFederalContext } from '../../data/dataLoader';
import SourceChip from './SourceChip';

const fmtB = (v: number) => `$${(Math.abs(v) / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`;

/**
 * VIZ-06 + the Phase 44 owed disclosures: how to read these numbers.
 * Every figure is COMPUTED from the context payload (annual summary + the
 * "excluded_…" and "offsets_…" disclosure metrics) so it can never drift
 * from the data. Plain language; no editorializing; every section chipped.
 */
const MethodologyPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<FederalContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFederalContext()
      .then((ctx) => { if (!cancelled) setContext(ctx); })
      .catch(() => { /* panel simply stays minimal without context */ });
    return () => { cancelled = true; };
  }, []);

  if (!context) return null;

  const headline = context.annual_summary[context.annual_summary.length - 1];
  const fy = headline.fiscal_year;

  // Computed, never hardcoded: sum the disclosure metrics by family
  const metricEntries = Object.entries(context.metrics);
  const functionExcluded = metricEntries
    .filter(([k]) => (k.startsWith('excluded_function_') || k.startsWith('excluded_subfunction_')) && k.endsWith(`_fy${fy}`))
    .reduce((s, [, m]) => s + m.value, 0);
  const agencyOffsets = metricEntries
    .filter(([k]) => k.startsWith('agency_offsets_') && k.endsWith(`_fy${fy}`))
    .reduce((s, [, m]) => s + m.value, 0);
  const officialOutlays = headline.outlays;
  const functionVisualTotal = officialOutlays - functionExcluded; // excluded values are negative

  const sourceName = context.source_display_names[headline.source_name] ?? headline.source_name;

  return (
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F7F7F8] dark:hover:bg-ev-gray-700 transition-colors"
      >
        <span className="text-base font-bold text-ev-gray-900 dark:text-ev-gray-100">
          How to read these numbers
        </span>
        <span className="text-ev-gray-500" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 text-sm text-ev-gray-700 dark:text-ev-gray-300 leading-relaxed">
          <section>
            <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">What we count</h4>
            <p>
              Every figure here is an <strong>outlay</strong> — money the government actually spent — not
              "budget authority" (the amount Congress authorized, which can be spent over several years).
              We use outlays consistently, from official Treasury and OMB records.{' '}
              <SourceChip sourceName={sourceName} sourceUrl={headline.source_url} fetchDate={headline.source_date} compact />
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">
              Why the spending visual totals more than the official number
            </h4>
            <p>
              The official FY{fy} total is <strong>{fmtB(officialOutlays)}</strong> in <em>net</em> outlays.
              Some budget categories are negative — money coming <em>in</em> (like interest the government
              pays its own trust funds, or employer retirement contributions between agencies). Bars can't
              be negative, so the "what it's for" visual shows <strong>{fmtB(functionVisualTotal)}</strong>{' '}
              of positive spending and sets aside <strong>{fmtB(functionExcluded)}</strong> of net-negative
              categories. The agency view sets aside <strong>{fmtB(agencyOffsets)}</strong> of offsetting
              receipts the same way. The deficit figures above always use the official net totals.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">Negative money isn't hidden</h4>
            <p>
              Every set-aside item is kept in the data as a line item marked "(offsetting)" — you'll see
              them, as negative amounts, when you drill into the affected categories.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">Partial year</h4>
            <p>
              The "this year so far" strip is a running total through the latest Monthly Treasury
              Statement. Partial-year numbers can't be compared to full-year totals or proportions.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">How deep the data goes</h4>
            <p>
              The deepest level shown is the federal <em>account</em> — the deepest level where official
              outlay records exist. More detailed program-level data exists only as <em>obligations</em>{' '}
              (promises to spend), a different measure we don't mix into these views.
            </p>
          </section>

          {context.metrics.dod_consecutive_failed_audits && (
            <section>
              <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">Can these numbers be audited?</h4>
              <p>
                Mostly, yes — the totals here come from official Treasury and OMB records. But the
                Department of Defense, the largest discretionary spender, received disclaimers of
                opinion on its own financial statements for the most recent audits on record
                ({Number(context.metrics.dod_consecutive_failed_audits.value)} fiscal years per the
                cited report) — meaning independent auditors could not verify DoD's internal
                accounting. The government-wide totals are what Treasury reports was spent; the
                audit concerns whether DoD can fully account for it internally.{' '}
                <SourceChip
                  sourceName="GAO audit report, FY2025 Financial Report of the U.S. Government"
                  sourceUrl={context.metrics.dod_consecutive_failed_audits.source_url}
                  fetchDate={context.metrics.dod_consecutive_failed_audits.source_date}
                  compact
                />
              </p>
            </section>
          )}

          <section>
            <h4 className="font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">Scale modes</h4>
            <p>
              "Per person" divides by the US population (Census Vintage 2024). "Per taxpayer" divides by
              individual income tax returns filed (IRS Data Book). Both are plain division — no modeling.
              {context.metrics.tax_returns_filed && (
                <>
                  {' '}
                  <SourceChip
                    sourceName="IRS Data Book"
                    sourceUrl={context.metrics.tax_returns_filed.source_url}
                    fetchDate={context.metrics.tax_returns_filed.source_date}
                    compact
                  />
                </>
              )}
            </p>
          </section>
        </div>
      )}
    </div>
  );
};

export default MethodologyPanel;
