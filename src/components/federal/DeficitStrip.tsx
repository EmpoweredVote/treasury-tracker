import React from 'react';
import type { FederalAnnualSummaryRow, FederalContextMetric } from '../../types/budget';
import SourceChip from './SourceChip';

interface DeficitStripProps {
  /** Headline year row (FY2025 actuals) from federal_annual_summary */
  summary: FederalAnnualSummaryRow;
  /** total_public_debt metric, if loaded */
  debtMetric?: FederalContextMetric | null;
  /** Registry display name for the summary's source_name key */
  sourceDisplayName: string;
}

const fmtB = (v: number) => `$${(v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`;
const fmtT = (v: number) => `$${(v / 1e12).toFixed(1)}T`;

/**
 * VIZ-02: receipts vs outlays on a shared scale, the gap labeled as deficit,
 * with total debt as permanent context. OFFICIAL figures only (annual summary),
 * never visual-tree totals.
 */
const DeficitStrip: React.FC<DeficitStripProps> = ({ summary, debtMetric, sourceDisplayName }) => {
  const receipts = summary.receipts;
  const outlays = summary.outlays;
  const deficit = summary.surplus_or_deficit; // negative = deficit (raw OMB sign)
  const isDeficit = deficit < 0;
  const maxVal = Math.max(receipts, outlays);
  const receiptsPct = (receipts / maxVal) * 100;
  const outlaysPct = (outlays / maxVal) * 100;
  // "About Xc of every dollar spent was borrowed" — |deficit| / outlays
  const borrowedCents = isDeficit ? Math.round((Math.abs(deficit) / outlays) * 100) : 0;

  return (
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-base font-bold text-ev-gray-900 dark:text-ev-gray-100">
          FY{summary.fiscal_year}: money in vs money out
        </h3>
        {debtMetric && (
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold text-ev-gray-700 dark:text-ev-gray-300"
              title={debtMetric.label}
            >
              Total debt: {fmtT(debtMetric.value)}
              <span className="font-normal text-ev-gray-500 dark:text-ev-gray-400"> (as of {debtMetric.as_of_date})</span>
            </span>
            <SourceChip sourceName="Debt to the Penny" sourceUrl={debtMetric.source_url} fetchDate={debtMetric.source_date} compact />
          </div>
        )}
      </div>

      {/* Money In bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-ev-gray-700 dark:text-ev-gray-300 font-medium">Money in (receipts)</span>
          <span className="font-semibold text-ev-gray-900 dark:text-ev-gray-100">{fmtB(receipts)}</span>
        </div>
        <div className="h-6 rounded bg-[#F7F7F8] dark:bg-ev-gray-900 overflow-hidden">
          <div className="h-full rounded bg-ev-muted-blue/80" style={{ width: `${receiptsPct}%` }} />
        </div>
      </div>

      {/* Money Out bar with deficit overhang */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-ev-gray-700 dark:text-ev-gray-300 font-medium">Money out (outlays)</span>
          <span className="font-semibold text-ev-gray-900 dark:text-ev-gray-100">{fmtB(outlays)}</span>
        </div>
        <div className="h-6 rounded bg-[#F7F7F8] dark:bg-ev-gray-900 overflow-hidden flex">
          {/* covered-by-receipts portion */}
          <div className="h-full bg-ev-gray-400 dark:bg-ev-gray-500" style={{ width: `${Math.min(receiptsPct, outlaysPct)}%` }} />
          {/* borrowed portion */}
          {isDeficit && (
            <div
              className="h-full bg-ev-yellow-400/90"
              style={{
                width: `${outlaysPct - receiptsPct}%`,
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(0,0,0,0.12) 0 4px, transparent 4px 8px)',
              }}
              title={`Deficit: ${fmtB(Math.abs(deficit))} = outlays − receipts`}
            />
          )}
        </div>
      </div>

      {isDeficit && (
        <p className="text-sm text-ev-gray-700 dark:text-ev-gray-300 mb-3">
          <span className="font-semibold">Deficit: {fmtB(Math.abs(deficit))}</span>
          <span
            className="text-ev-gray-500 dark:text-ev-gray-400"
            title={`${borrowedCents}% = deficit ÷ outlays (${fmtB(Math.abs(deficit))} ÷ ${fmtB(outlays)})`}
          >
            {' '}— about {borrowedCents}¢ of every dollar spent was borrowed
          </span>
        </p>
      )}

      <SourceChip sourceName={sourceDisplayName} sourceUrl={summary.source_url} fetchDate={summary.source_date} />
    </div>
  );
};

export default DeficitStrip;
