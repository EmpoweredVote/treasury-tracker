import React from 'react';
import { Target } from 'lucide-react';
import type { OrgFinancialSummary } from '../../types/budget';

interface OrgTransparencyPanelProps {
  summary: OrgFinancialSummary;
  orgName: string;
}

/**
 * Fundraising-goal progress for a nonprofit org (EVVIEW-04).
 * Progress = income_net / goal_amount, capped at 100% with a celebratory state
 * when met (D-03). Renders nothing when no goal is set.
 * (Funds on Hand lives as a dated chip in the page header — it's a static bank
 * balance, not a live figure, so it stays out of the donor-feedback flow.)
 */
const OrgTransparencyPanel: React.FC<OrgTransparencyPanelProps> = ({ summary, orgName }) => {
  const hasGoal = summary.goal_amount != null && summary.goal_amount > 0;
  if (!hasGoal) return null;

  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const goalAmount = summary.goal_amount as number;
  const raised = summary.income_net;
  const reached = raised >= goalAmount;
  const pct = Math.min(100, Math.round((raised / goalAmount) * 100));

  return (
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
  );
};

export default OrgTransparencyPanel;
