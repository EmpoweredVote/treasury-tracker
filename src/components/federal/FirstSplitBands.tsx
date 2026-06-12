import React, { useState } from 'react';
import type { FederalAnnualSummaryRow } from '../../types/budget';
import SourceChip from './SourceChip';

interface FirstSplitBandsProps {
  summary: FederalAnnualSummaryRow;
  sourceDisplayName: string;
}

const fmtB = (v: number) => `$${(v / 1e9).toLocaleString('en-US', { maximumFractionDigits: 1 })}B`;

/**
 * VIZ-01: the federal budget's defining fact — Mandatory / Discretionary /
 * Net Interest as one proportional bar. INFORMATIONAL, not a drill target:
 * BEA category is orthogonal to the function tree below (45-CONTEXT decision).
 * Definitions are structural (how the spending is decided), not editorial.
 */
const FirstSplitBands: React.FC<FirstSplitBandsProps> = ({ summary, sourceDisplayName }) => {
  const [openBand, setOpenBand] = useState<string | null>(null);

  const mandatory = summary.mandatory ?? 0;
  const discDef = summary.discretionary_defense ?? 0;
  const discNonDef = summary.discretionary_nondefense ?? 0;
  const discretionary = discDef + discNonDef;
  const netInterest = summary.net_interest ?? 0;
  const total = mandatory + discretionary + netInterest;
  if (total <= 0) return null;

  const bands = [
    {
      key: 'mandatory',
      label: 'Mandatory',
      value: mandatory,
      className: 'bg-ev-muted-blue/85',
      definition:
        'Spending set by ongoing laws — eligibility formulas like Social Security, Medicare, and Medicaid. It happens automatically each year unless Congress changes the underlying law; it is not part of the annual budget votes.',
      detail: null,
    },
    {
      key: 'discretionary',
      label: 'Discretionary',
      value: discretionary,
      className: 'bg-ev-gray-500 dark:bg-ev-gray-400',
      definition:
        'Spending Congress sets each year through appropriations bills — this is what most annual "budget fight" debates are about.',
      detail: `Defense: ${fmtB(discDef)} · Non-defense: ${fmtB(discNonDef)}`,
    },
    {
      key: 'net_interest',
      label: 'Net Interest',
      value: netInterest,
      className: 'bg-ev-yellow-400/90',
      definition:
        'Interest owed on the national debt. It must be paid regardless of any vote, and it grows when debt or interest rates grow.',
      detail: null,
    },
  ];

  return (
    <div className="bg-white dark:bg-ev-gray-800 border border-ev-gray-200 dark:border-ev-gray-700 rounded-xl p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-base font-bold text-ev-gray-900 dark:text-ev-gray-100">
          How FY{summary.fiscal_year} spending is decided
        </h3>
        <SourceChip sourceName={sourceDisplayName} sourceUrl={summary.source_url} fetchDate={summary.source_date} compact />
      </div>
      <p className="text-sm text-ev-gray-500 dark:text-ev-gray-400 mb-4">
        Tap a band for what it means. To explore where the money goes, use the breakdown below.
      </p>

      {/* Proportional bar — horizontal ≥640px, stacked below */}
      <div className="hidden sm:flex h-14 rounded-lg overflow-hidden" role="group" aria-label="Spending by budget-decision type">
        {bands.map((b) => {
          const pct = (b.value / total) * 100;
          return (
            <button
              key={b.key}
              onClick={() => setOpenBand(openBand === b.key ? null : b.key)}
              aria-expanded={openBand === b.key}
              className={`${b.className} h-full relative text-left px-3 py-1.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ev-muted-blue focus-visible:ring-inset`}
              style={{ width: `${pct}%` }}
              title={`${b.label}: ${fmtB(b.value)} (${pct.toFixed(0)}% of the total)`}
            >
              {pct >= 10 && (
                <span className="block text-xs font-bold text-white dark:text-ev-gray-900 truncate">
                  {b.label}
                  <span className="block font-normal opacity-90">{fmtB(b.value)} · {pct.toFixed(0)}%</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile: stacked rows */}
      <div className="sm:hidden space-y-2">
        {bands.map((b) => {
          const pct = (b.value / total) * 100;
          return (
            <button
              key={b.key}
              onClick={() => setOpenBand(openBand === b.key ? null : b.key)}
              aria-expanded={openBand === b.key}
              className="w-full text-left"
            >
              <div className="flex justify-between text-sm mb-0.5">
                <span className="font-medium text-ev-gray-700 dark:text-ev-gray-300">{b.label}</span>
                <span className="text-ev-gray-900 dark:text-ev-gray-100 font-semibold">{fmtB(b.value)} · {pct.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded bg-[#F7F7F8] dark:bg-ev-gray-900 overflow-hidden">
                <div className={`h-full rounded ${b.className}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Definition popover area */}
      {openBand && (
        <div className="mt-4 p-4 rounded-lg bg-[#F7F7F8] dark:bg-ev-gray-900 border border-[#E2EBEF] dark:border-ev-gray-700">
          {bands.filter(b => b.key === openBand).map(b => (
            <div key={b.key}>
              <p className="text-sm font-semibold text-ev-gray-900 dark:text-ev-gray-100 mb-1">
                {b.label} — {fmtB(b.value)} ({((b.value / total) * 100).toFixed(0)}% of FY{summary.fiscal_year} spending)
              </p>
              <p className="text-sm text-ev-gray-700 dark:text-ev-gray-300">{b.definition}</p>
              {b.detail && (
                <p className="text-sm text-ev-gray-500 dark:text-ev-gray-400 mt-1">{b.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FirstSplitBands;
