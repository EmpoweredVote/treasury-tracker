import type { FundScope } from '../data/fundScopeVocabulary';
import type { AuditGrade } from '../data/auditGrade';

// Chip colours for ScopeLabel and FundSeriesToggle. Kept apart from
// ScopeLabel.tsx so that file exports only a component (React Fast Refresh
// needs component-only modules to hot-reload them).

// ⚠ Only tokens defined in src/index.css exist here: ev-teal, ev-skyblue,
// ev-yellow, ev-gray — there is NO ev-blue scale, and the gray steps are
// three-digit (ev-gray-050, not ev-gray-50). Tailwind drops an unknown color
// class silently, so a typo here does not fail the build or any test; it just
// renders an uncoloured chip and the border falls back to currentColor, which
// makes the UNVERIFIED chip the softest one on the page — the exact inversion
// of what this component is for. Verified against the running app by reading
// getComputedStyle off the rendered chip, which is the only check that catches it.
const VERIFIED_TONE =
  'bg-ev-skyblue-050 text-ev-skyblue-800 border-ev-skyblue-200 '
  + 'dark:bg-ev-skyblue-900/30 dark:text-ev-skyblue-200 dark:border-ev-skyblue-800';

export const TONE: Record<FundScope, string> = {
  general_fund: VERIFIED_TONE,
  governmental_operating: VERIFIED_TONE,
  total_governmental: VERIFIED_TONE,
  all_funds: VERIFIED_TONE,
  // Neutral grey, NOT red/amber: an unverified scope is a gap in our checking,
  // not a defect in the figure or a fault of the publisher.
  unknown:
    'bg-ev-gray-050 text-ev-gray-600 border-ev-gray-200 '
    + 'dark:bg-ev-gray-800 dark:text-ev-gray-300 dark:border-ev-gray-700',
};

/**
 * AUDIT-GRADE tone.
 *
 * ⚠⚠ EVERY GRADED VALUE SHARES ONE COLOUR ON PURPOSE. Colour is a ranking
 * whether or not you intend it to be, and these values are not a ranking:
 * `audited_ocboa` carries the same assurance as `audited_gaap` on a different
 * measurement basis, so any palette that separates them tells the reader
 * something false. The WORDS carry the distinction — exactly as the three known
 * fund scopes already share VERIFIED_TONE and are told apart by their labels.
 *
 * `unknown` keeps the neutral grey for the same reason it does above: it is a
 * gap in our checking, not a defect in the figure. Amber here would put a
 * warning beside every row nobody has got to yet. `not_applicable` shares that
 * grey — a payroll roster is a different KIND of record, not a worse figure.
 */
export const AUDIT_TONE: Record<AuditGrade, string> = {
  audited_gaap: VERIFIED_TONE,
  audited_ocboa: VERIFIED_TONE,
  compiled_from_audited: VERIFIED_TONE,
  self_reported_unaudited: VERIFIED_TONE,
  unknown:
    'bg-ev-gray-050 text-ev-gray-600 border-ev-gray-200 '
    + 'dark:bg-ev-gray-800 dark:text-ev-gray-300 dark:border-ev-gray-700',
  // ⚠ THE SAME NEUTRAL GREY AS `unknown`, and not a sixth colour. A payroll
  // roster is not a worse figure than an audited statement — it is a different
  // kind of record, and the WORDS carry that. A colour of its own would put a
  // sixth rung on a list that has no rungs.
  not_applicable:
    'bg-ev-gray-050 text-ev-gray-600 border-ev-gray-200 '
    + 'dark:bg-ev-gray-800 dark:text-ev-gray-300 dark:border-ev-gray-700',
};
