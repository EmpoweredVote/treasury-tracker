import React from 'react';
import { Target } from 'lucide-react';
import type { OrgFinancialSummary } from '../../types/budget';
import { transparencyFigures } from './orgTransparencyFigures';

interface OrgTransparencyPanelProps {
  summary: OrgFinancialSummary;
  orgName: string;
}

/**
 * Fundraising-goal progress for a nonprofit org (EVVIEW-04).
 * Progress = (income_net + pending_gross) / goal_amount, capped at 100% with a
 * celebratory state when met (D-03). Renders nothing when no goal is set.
 * (Funds on Hand lives as a dated chip in the page header — it's a static bank
 * balance, not a live figure, so it stays out of the donor-feedback flow.)
 *
 * ── pending_gross (2026-09-22) ──────────────────────────────────────────────
 * `income_net` only moves when reconcileEV.js is hand-run against fresh exports.
 * So a real $2 donation on 2026-09-22 moved the revenue tree and left this panel
 * unchanged — a miss on impact as much as on transparency. If the page says a
 * number and someone gives $2, the number should move, so they can think
 * "I did that".
 *
 * `pending_gross` is what has arrived since the last reconcile. It is shown as
 * its OWN line rather than folded into the reconciled figure: the fee is not
 * known until payout, so folding it in would silently overstate net, and
 * estimating a fee would put an unsourced number on the page. Showing it
 * separately is both the honest option and the one that names the donor's own
 * contribution.
 *
 * ⚠⚠ This is RAISED, never ON HAND — consistent with the Funds-on-Hand decision
 * above. The money sits with the platform until payout, so `balance`,
 * `runway_months` and `recon_variance` deliberately do not move.
 */
const OrgTransparencyPanel: React.FC<OrgTransparencyPanelProps> = ({ summary, orgName }) => {
  const hasGoal = summary.goal_amount != null && summary.goal_amount > 0;
  if (!hasGoal) return null;

  const fmt = (n: number) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const goalAmount = summary.goal_amount as number;
  const { raised, pending, pct, reached } = transparencyFigures(summary);

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
          {pending > 0 && (
            <p className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums mt-1">
              +{fmt(pending)} just received
            </p>
          )}
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
