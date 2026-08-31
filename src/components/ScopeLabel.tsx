import { useState } from 'react';
import { Info } from 'lucide-react';
import {
  FUND_SCOPE_COPY, FUND_SCOPE_EXPLAINER, normalizeScope, isComparableScope,
  BASIS_COPY, normalizeBasis,
  type FundScope, type Basis,
} from '../data/fundScopeVocabulary';
import {
  AUDIT_GRADE_COPY, AUDIT_GRADE_EXPLAINER, normalizeAuditGrade, isAudited,
  type AuditGrade,
} from '../data/auditGrade';

/**
 * Provenance labels + explainers for a figure: which funds it covers (SCOPE-01),
 * whether it is actual or adopted (SCOPE-02), and how much independent checking
 * stands behind it (AUDIT-GRADE).
 *
 * Sits beside the source attribution and says which funds the figure on screen
 * covers. All reader-facing wording lives in src/data/fundScopeVocabulary.ts —
 * nothing is authored inline here, so the copy can be reviewed in one place.
 *
 * `unknown` renders too, deliberately, as "scope not established". Hiding the
 * label when we do not know would leave the reader with the same silent ambiguity
 * this milestone exists to remove; saying "we have not verified this" is the
 * honest state and is styled as information, not as a warning.
 *
 * The audit-grade chip follows the same rule and needs it more: `unknown` is 68%
 * of the database, so hiding it would leave two thirds of the site silently
 * unlabelled, and colouring it as a warning would accuse 2,122 governments of
 * something that is our gap and not theirs. All reader-facing wording lives in
 * src/data/auditGrade.ts.
 *
 * ⚠⚠ The five audit grades are NOT a ranking and must never be rendered as one —
 * see AUDIT_TONE below.
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

/**
 * AUDIT-GRADE tone.
 *
 * ⚠⚠ EVERY GRADED VALUE SHARES ONE COLOUR ON PURPOSE. Colour is a ranking
 * whether or not you intend it to be, and these five values are not a ranking:
 * `audited_ocboa` carries the same assurance as `audited_gaap` on a different
 * measurement basis, so any palette that separates them tells the reader
 * something false. The WORDS carry the distinction — exactly as the three known
 * fund scopes already share VERIFIED_TONE and are told apart by their labels.
 *
 * `unknown` keeps the neutral grey for the same reason it does above: it is a
 * gap in our checking, not a defect in the figure, and it is 68% of the
 * database. Amber here would put a warning beside two thirds of the site.
 */
export const AUDIT_TONE: Record<AuditGrade, string> = {
  audited_gaap: VERIFIED_TONE,
  audited_ocboa: VERIFIED_TONE,
  compiled_from_audited: VERIFIED_TONE,
  self_reported_unaudited: VERIFIED_TONE,
  unknown:
    'bg-ev-gray-050 text-ev-gray-600 border-ev-gray-200 '
    + 'dark:bg-ev-gray-800 dark:text-ev-gray-300 dark:border-ev-gray-700',
};

interface ScopeLabelProps {
  scope: FundScope | null | undefined;
  /** SCOPE-02: shown as a second chip. Absent renders nothing rather than guessing. */
  basis?: Basis | null;
  /**
   * AUDIT-GRADE: how much independent checking stands behind the figure.
   * Absent renders nothing rather than guessing, like `basis`.
   */
  auditGrade?: AuditGrade | null;
  /** Optional dataset name, so a page showing two figures says which is which. */
  datasetLabel?: string;
  /** Render the shared explainer inline when expanded. Default true. */
  withExplainer?: boolean;
  className?: string;
}

export default function ScopeLabel({
  scope, basis, auditGrade, datasetLabel, withExplainer = true, className = '',
}: ScopeLabelProps) {
  const [open, setOpen] = useState(false);
  const [gradeOpen, setGradeOpen] = useState(false);
  const resolved = normalizeScope(scope);
  const copy = FUND_SCOPE_COPY[resolved];
  const grade = auditGrade != null ? normalizeAuditGrade(auditGrade) : null;
  const gradeCopy = grade ? AUDIT_GRADE_COPY[grade] : null;

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
        {/* PLAIN TEXT, not a chip. This used to carry the same
            `rounded-full border px-2 py-0.5` treatment AND a TONE colour as the
            scope button immediately to its left — but the scope chip is a real
            <button> that opens the explainer below, while this has only a
            tooltip. Two identical-looking pills, one live and one inert, sitting
            side by side. Chris, in AUSTIN-TRAVIS-01 UAT: "Why are we showing the
            actuals as a button when you get nothing for clicking on it? Why does
            actuals even need to be there in a pill if I can't click on it?"

            The WORD stays — actual-vs-adopted is the distinction that produced the
            Long Beach -75% cliff, so a reader needs it — and so does the tooltip.
            Only the false affordance goes.

            The old TONE call was also odd on its own terms: it mapped ANY known
            basis onto the `general_fund` colour, so an `adopted` figure borrowed
            General Fund green. Dropping the chip drops that too. */}
        {basis != null && (
          <span
            title={BASIS_COPY[normalizeBasis(basis)].short}
            className="text-[11px] font-medium text-ev-gray-600 dark:text-ev-gray-300"
          >
            {BASIS_COPY[normalizeBasis(basis)].label}
          </span>
        )}
        {/* AUDIT-GRADE. A real <button>, unlike the basis text beside it, and for
            the reason the basis text is NOT one: this chip actually does
            something — the whole point of the axis is the plain-language
            explanation behind it, and "audited" is a word a reader is entitled
            to have unpacked. The affordance matches the behaviour.

            ⚠ Its own disclosure state, not the scope one. A reader asking "what
            does audited mean" has not asked "which funds is this", and pairing
            them would make each answer arrive with an unrequested essay. */}
        {gradeCopy && grade && (
          <button
            type="button"
            onClick={() => setGradeOpen((v) => !v)}
            aria-expanded={gradeOpen}
            title={gradeCopy.short}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]
                        font-medium transition-colors hover:brightness-95 ${AUDIT_TONE[grade]}`}
          >
            {gradeCopy.label}
            <Info className="h-3 w-3 opacity-60" aria-hidden="true" />
          </button>
        )}
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

      {gradeOpen && gradeCopy && grade && (
        <span className="block max-w-prose rounded-md border border-ev-gray-200 bg-white p-3 text-[12px]
                         leading-relaxed text-ev-gray-600 dark:border-ev-gray-700 dark:bg-ev-gray-900
                         dark:text-ev-gray-300">
          <span className="block font-medium text-ev-gray-800 dark:text-ev-gray-100">
            {gradeCopy.label}
          </span>
          <span className="mt-1 block">{gradeCopy.long}</span>

          {/* ⚠ Shown only for an OCBOA figure, because it is the only value where
              assurance and comparability come apart. Saying it everywhere would
              turn the one place it matters into boilerplate a reader skips. */}
          {isAudited(grade) && grade === 'audited_ocboa' && (
            <span className="mt-2 block italic">
              not comparable line-for-line with places reporting the usual way
            </span>
          )}

          {withExplainer && (
            <>
              <span className="mt-3 block font-medium text-ev-gray-800 dark:text-ev-gray-100">
                {AUDIT_GRADE_EXPLAINER.heading}
              </span>
              <span className="mt-1 block">{AUDIT_GRADE_EXPLAINER.intro}</span>
              <span className="mt-2 block">{AUDIT_GRADE_EXPLAINER.whatAuditMeans}</span>
              <span className="mt-2 block">{AUDIT_GRADE_EXPLAINER.whyUnknownIsNotBad}</span>
              <span className="mt-2 block">{AUDIT_GRADE_EXPLAINER.whatWeDo}</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
