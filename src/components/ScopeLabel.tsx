import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  FUND_SCOPE_COPY, FUND_SCOPE_EXPLAINER, normalizeScope, isComparableScope,
  type FundScope,
} from '../data/fundScopeVocabulary';

/**
 * Fund-scope label + explainer (SCOPE-01 Task 10).
 *
 * Sits beside the source attribution and says which funds the figure on screen
 * covers. All reader-facing wording lives in src/data/fundScopeVocabulary.ts —
 * nothing is authored inline here, so the copy can be reviewed in one place.
 *
 * `unknown` renders too, deliberately, as "scope not established". Hiding the
 * label when we do not know would leave the reader with the same silent ambiguity
 * this milestone exists to remove; saying "we have not verified this" is the
 * honest state and is styled as information, not as a warning.
 */

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
  total_governmental: VERIFIED_TONE,
  all_funds: VERIFIED_TONE,
  // Neutral grey, NOT red/amber: an unverified scope is a gap in our checking,
  // not a defect in the figure or a fault of the publisher.
  unknown:
    'bg-ev-gray-050 text-ev-gray-600 border-ev-gray-200 '
    + 'dark:bg-ev-gray-800 dark:text-ev-gray-300 dark:border-ev-gray-700',
};

interface ScopeLabelProps {
  scope: FundScope | null | undefined;
  /** Optional dataset name, so a page showing two figures says which is which. */
  datasetLabel?: string;
  /** Render the shared explainer inline when expanded. Default true. */
  withExplainer?: boolean;
  className?: string;
}

export default function ScopeLabel({
  scope, datasetLabel, withExplainer = true, className = '',
}: ScopeLabelProps) {
  const [open, setOpen] = useState(false);
  const resolved = normalizeScope(scope);
  const copy = FUND_SCOPE_COPY[resolved];

  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        {datasetLabel && (
          <span className="text-[11px] text-ev-gray-400 dark:text-ev-gray-500">{datasetLabel}:</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={copy.short}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]
                      font-medium transition-colors hover:brightness-95 ${TONE[resolved]}`}
        >
          {copy.label}
          <Info className="h-3 w-3 opacity-60" aria-hidden="true" />
        </button>
        {!isComparableScope(resolved) && (
          <span className="text-[11px] italic text-ev-gray-400 dark:text-ev-gray-500">
            not compared across places
          </span>
        )}
      </span>

      {open && (
        <span className="block max-w-prose rounded-md border border-ev-gray-200 bg-white p-3 text-[12px]
                         leading-relaxed text-ev-gray-600 dark:border-ev-gray-700 dark:bg-ev-gray-900
                         dark:text-ev-gray-300">
          <span className="block font-medium text-ev-gray-800 dark:text-ev-gray-100">{copy.label}</span>
          <span className="mt-1 block">{copy.long}</span>

          {withExplainer && (
            <>
              <span className="mt-3 block font-medium text-ev-gray-800 dark:text-ev-gray-100">
                {FUND_SCOPE_EXPLAINER.heading}
              </span>
              <span className="mt-1 block">{FUND_SCOPE_EXPLAINER.intro}</span>
              <span className="mt-2 block">{FUND_SCOPE_EXPLAINER.whyMoreThanOneTotal}</span>
              <span className="mt-2 block">{FUND_SCOPE_EXPLAINER.whyFiguresDiffer}</span>
              <span className="mt-2 block">{FUND_SCOPE_EXPLAINER.whatWeDo}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
