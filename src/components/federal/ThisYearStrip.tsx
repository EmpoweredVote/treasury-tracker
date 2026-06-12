import React from 'react';
import type { FederalContextMetric } from '../../types/budget';
import SourceChip from './SourceChip';

interface ThisYearStripProps {
  fytdReceipts?: FederalContextMetric | null;
  fytdOutlays?: FederalContextMetric | null;
}

const fmtB = (v: number) => `$${(v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`;

/** Federal FY = calendar year + 1 when the month is October or later */
const fyOf = (isoDate: string) => {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return month >= 10 ? year + 1 : year;
};

/**
 * VIZ-03b: the live "this year so far" strip — FYTD receipts and outlays from
 * the latest Monthly Treasury Statement, with the partial-year caveat.
 */
const ThisYearStrip: React.FC<ThisYearStripProps> = ({ fytdReceipts, fytdOutlays }) => {
  if (!fytdReceipts || !fytdOutlays) return null;
  const asOf = fytdOutlays.as_of_date;
  const fy = fyOf(asOf);

  return (
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl px-6 py-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-ev-gray-700 dark:text-ev-gray-300">
          <span className="font-bold text-ev-gray-900 dark:text-ev-gray-100">FY{fy} so far</span>
          <span className="text-ev-gray-500 dark:text-ev-gray-400"> (through {asOf})</span>
          {': '}
          in <span className="font-semibold">{fmtB(fytdReceipts.value)}</span>
          {' · '}
          out <span className="font-semibold">{fmtB(fytdOutlays.value)}</span>
        </p>
        <SourceChip sourceName="Treasury Fiscal Data" sourceUrl={fytdOutlays.source_url} fetchDate={fytdOutlays.source_date} compact />
      </div>
      <p className="text-xs text-ev-gray-500 dark:text-ev-gray-400 mt-1">
        Partial year — totals and proportions aren't comparable to a full fiscal year.
      </p>
    </div>
  );
};

export default ThisYearStrip;
