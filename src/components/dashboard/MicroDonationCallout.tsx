import React from 'react';
import { Heart } from 'lucide-react';
import type { BudgetCategory } from '../../types/budget';

/**
 * Phase 81.5-02: "How we stay free" micro-donation callout for the EV nonprofit view.
 *
 * Reads anonymized recurring-supporter aggregates from the Donations budget category
 * (persisted by scripts/loadEVDonations.js in Phase 81.5-01):
 *   - category.items        = distinct active recurring-supporter count (item_count in DB)
 *   - category.description  = JSON string carrying { _evMicro: { recurring_supporters,
 *                             typical_monthly, as_of_fy } }
 *                             (size buckets are computed in the loader but intentionally
 *                              NOT persisted — quasi-identifying for a small donor pool)
 *
 * LOCKED HEADLINE (use verbatim — Chris's words, 81.5-CONTEXT.md):
 *   "These tools are free for everyone, and always will be. We are currently sustained
 *    by like-minded people who give a few dollars a month."
 *
 * GUARDRAILS:
 *   - Display ONLY numbers from the persisted aggregates; never fabricate or imply a
 *     larger count.
 *   - Never frame EV as refusing larger/bridge gifts; never spin volunteer status as
 *     "no money needed." Soft invite only.
 *   - No PII anywhere in the rendered output.
 *   - If aggregates are absent/unparseable or item_count is 0, render graceful fallback
 *     (static headline only, no fabricated numbers).
 */

interface EvMicro {
  recurring_supporters: number;
  typical_monthly: number;
  as_of_fy: number;
}

interface MicroDonationCalloutProps {
  /** The Donations revenue budget category (link_key 'donations'). May be undefined if absent. */
  donationsCategory: BudgetCategory | undefined;
  /** Opens the existing DonateModal. */
  onDonateClick: () => void;
}

/**
 * Parse _evMicro from a budget category's description field.
 * Returns null if the field is absent, unparseable, or doesn't contain _evMicro.
 */
function parseEvMicro(category: BudgetCategory | undefined): EvMicro | null {
  if (!category?.description) return null;
  try {
    const parsed = JSON.parse(category.description);
    const micro = parsed?._evMicro;
    if (
      !micro ||
      typeof micro.recurring_supporters !== 'number' ||
      typeof micro.typical_monthly !== 'number'
    ) {
      return null;
    }
    return micro as EvMicro;
  } catch {
    return null;
  }
}

const MicroDonationCallout: React.FC<MicroDonationCalloutProps> = ({
  donationsCategory,
  onDonateClick,
}) => {
  const micro = parseEvMicro(donationsCategory);
  const supporterCount = micro?.recurring_supporters ?? 0;

  // Graceful absent: if no parseable aggregates or zero supporters, render
  // just the static free-for-everyone headline with no fabricated numbers.
  const hasAggregates = micro !== null && supporterCount > 0;

  return (
    <div className="bg-white dark:bg-ev-gray-800 rounded-xl p-5 border border-ev-gray-200 dark:border-ev-gray-700">
      {/* Locked headline — use verbatim (Chris's words) */}
      <p className="text-[15px] font-semibold text-ev-gray-800 dark:text-ev-gray-100 leading-relaxed">
        These tools are free for everyone, and always will be. We are currently sustained by
        like-minded people who give a few dollars a month.
      </p>

      {hasAggregates && (
        <p className="mt-2 text-sm text-ev-gray-500 dark:text-ev-gray-400 leading-relaxed">
          {supporterCount} like-minded {supporterCount === 1 ? 'person' : 'people'} currently
          keep these tools free
          {micro!.typical_monthly != null && micro!.typical_monthly > 0
            ? <> — a typical monthly gift is about ${micro!.typical_monthly}</>
            : ''}
          .
          {micro!.as_of_fy ? (
            <span className="block mt-0.5 text-xs text-ev-gray-400 dark:text-ev-gray-500">
              Based on recurring giving in FY{micro!.as_of_fy}.
            </span>
          ) : null}
        </p>
      )}

      {/* Soft recurring-donate invite */}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <button
          onClick={onDonateClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#005366] hover:bg-ev-teal-700 text-white transition-colors duration-200"
        >
          <Heart size={13} fill="currentColor" />
          {hasAggregates ? 'Join them' : 'Support EV'}
        </button>
        <span className="text-xs text-ev-gray-400 dark:text-ev-gray-500">
          $2/month helps — only if you can.
        </span>
      </div>
    </div>
  );
};

export default MicroDonationCallout;
