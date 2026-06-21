import React from 'react';
import { Wallet, Target } from 'lucide-react';
import InsightCard from './InsightCard';
import type { OrgFinancialSummary } from '../../types/budget';

interface OrgTransparencyPanelProps {
  summary: OrgFinancialSummary;
  orgName: string;
}

/**
 * Donor-facing transparency header for a nonprofit org (EV).
 * Shows current funds on hand (EVVIEW-03) and progress toward the active
 * fundraising goal (EVVIEW-04). Runway is intentionally NOT shown (D-06).
 * The goal indicator is hidden entirely when no goal is set.
 */
const OrgTransparencyPanel: React.FC<OrgTransparencyPanelProps> = ({ summary, orgName }) => {
  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const asOf = (() => {
    // balance_as_of may be a plain date (YYYY-MM-DD) or a full ISO timestamp
    // (YYYY-MM-DDT00:00:00.000Z) depending on the API. Take the date part only and
    // build a local Date so there's no timezone drift. Fall back to the raw string.
    const datePart = (summary.balance_as_of ?? '').slice(0, 10);
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return summary.balance_as_of ?? '';
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  })();

  const hasGoal = summary.goal_amount != null && summary.goal_amount > 0;
  const goalAmount = summary.goal_amount ?? 0;
  const raised = summary.income_net;
  const reached = hasGoal && raised >= goalAmount;
  const pct = hasGoal ? Math.min(100, Math.round((raised / goalAmount) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <InsightCard
        label="Funds on Hand"
        value={fmt(summary.balance)}
        subtext={asOf ? `As of ${asOf}` : undefined}
        variant="primary"
        icon={<Wallet size={18} className="text-ev-gray-500" />}
      />

      {hasGoal && (
        <div className="relative bg-white dark:bg-ev-gray-800 rounded-xl p-5 border border-ev-gray-200 dark:border-ev-gray-700">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ev-gray-500 dark:text-ev-gray-400 mb-1.5">
                {summary.goal_label || 'Fundraising Goal'}
              </p>
              <p className="text-2xl font-bold text-ev-gray-900 dark:text-ev-gray-100 tabular-nums leading-tight">
                {fmt(raised)}
                <span className="text-sm font-medium text-ev-gray-500 dark:text-ev-gray-400">
                  {' '}of {fmt(goalAmount)}
                </span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-ev-gray-050 dark:bg-ev-gray-700 flex items-center justify-center flex-shrink-0">
              <Target size={18} className="text-ev-gray-500" />
            </div>
          </div>

          <div
            className="h-2.5 w-full rounded-full bg-ev-gray-100 dark:bg-ev-gray-700 overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${orgName} fundraising progress`}
          >
            <div
              className="h-full rounded-full bg-green-500 transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-sm mt-2 leading-snug">
            {reached ? (
              <span className="font-semibold text-green-600 dark:text-green-400">
                Goal reached — thank you! 🎉
              </span>
            ) : (
              <span className="text-ev-gray-500 dark:text-ev-gray-400">
                {pct}% of the way there
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default OrgTransparencyPanel;
