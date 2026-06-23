import React from 'react';

/**
 * Phase 81.5-02: "How we stay free" mission tile for the EV nonprofit financials view.
 *
 * A short static statement placed directly above the "how Empowered Vote uses its funds"
 * (spending) section. Reworded + simplified per Chris (2026-06-23): the recurring-supporter
 * stat and donate invite were removed — this is now a pure mission line. The recurring
 * aggregates are still computed/persisted by scripts/loadEVDonations.js but are no longer
 * surfaced here.
 *
 * LOCKED COPY (Chris's words — use verbatim):
 *   "These tools are free for everyone and always will be. We are currently sustained by
 *    like-minded people — most of whom give a few dollars a month."
 *
 * GUARDRAIL: never frame EV as refusing larger/bridge gifts; keep "currently".
 */
const MicroDonationCallout: React.FC = () => (
  <div className="bg-white dark:bg-ev-gray-800 rounded-xl p-5 border border-ev-gray-200 dark:border-ev-gray-700 mb-6">
    <p className="text-lg font-semibold text-ev-gray-800 dark:text-ev-gray-100 leading-relaxed">
      These tools are free for everyone and always will be. We are currently sustained by
      like-minded people — most of whom give a few dollars a month.
    </p>
  </div>
);

export default MicroDonationCallout;
