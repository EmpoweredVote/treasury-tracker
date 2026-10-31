import type { ReactNode } from 'react';
import ScopeLabel from './ScopeLabel';
import { spanLabel } from '../data/seriesSelection';
import { publisherLabel } from '../data/provenanceLine';
import type { FundScope, Basis } from '../data/fundScopeVocabulary';
import type { AccountingBasis } from '../data/accountingBasisVocabulary';
import type { AuditGrade } from '../data/auditGrade';

/**
 * AUDIT-GRADE §5.2 — provenance stated once, loudly, under the entity name.
 *
 * Chris's rule: "we should only share the information with how we sourced it
 * and our confidence in that source." Before this, the audit-grade chip
 * rendered in exactly ONE place — inside PlainLanguageSummary's narrative block
 * — so a reader who scrolled past the summary and quoted a figure off a chart
 * got nothing at all.
 *
 * He was offered a chip beside every figure and rejected it: the same pill five
 * times down one page becomes furniture and stops being read, and it fails
 * silently when it does. The shape he chose instead is this bar plus a quiet
 * citation line under each chart — stated once where it is unmissable, repeated
 * small wherever a number could be lifted out on its own.
 *
 * ⚠⚠ THE SERIES SWITCHER IS A CHILD, NOT A SIBLING. FundSeriesToggle (SCOPE-03)
 * already renders the series an entity actually has, and already degrades to
 * plain text when there is only one. A second control beside it would be two
 * controls answering overlapping questions — exactly the confusion this bar
 * exists to remove.
 *
 * ⚠⚠ THE BAR DESCRIBES WHAT IS ON SCREEN, AND NOTHING ELSE. `provenance` is a
 * single nullable object rather than loose props precisely so it cannot be
 * assembled from two different sources. The first version took them loose and
 * did exactly that: on the Employees tab it carried the STATEMENT series' grade,
 * scope and 23-year span next to the PAYROLL publisher, reading
 * "Government-reported · All Funds · LA City Open Data · FY2003–25" above a
 * salary table whose own citation said "Not a financial statement" two inches
 * below. A false claim of assurance is the mirror image of the false confession
 * this milestone exists to remove. Found in whole-branch review.
 *
 * ⚠ The grade here is the SERIES grade, over-disclosed across its datasets by
 * weakestGrade(). A chart shows ONE dataset in one year and takes its own
 * citation from that dataset's metadata instead; using the series grade on a
 * chart would state the weaker of two datasets over a figure drawn from only
 * one of them.
 *
 * ⚠ Not rendered for nonprofits. For EV these are inapplicable questions, not
 * unanswered ones (#198), and the gate lives at the call site alongside the one
 * FundSeriesToggle already carries.
 */

export interface SourceBarProvenance {
  scope: FundScope | null | undefined;
  basis?: Basis | null;
  accountingBasis?: AccountingBasis | null;
  auditGrade?: AuditGrade | null;
  /** The coverage span, where the thing on screen has one. */
  span?: { min: number; max: number } | null;
}

interface SourceBarProps {
  /**
   * What is on screen, or null when there is nothing to describe yet.
   *
   * ⚠ NULL RENDERS NOTHING rather than a placeholder. "Scope not established"
   * over a tab whose data has not arrived is a claim about our coverage that
   * happens not to be true.
   */
  provenance: SourceBarProvenance | null;
  /**
   * `dataSourceInfo.displayName`.
   *
   * ⚠⚠ THREE STATES, AND THE DIFFERENCE IS LOAD-BEARING.
   *   a name  — print it.
   *   null    — the API returned no publisher for this row. 16,997 statement
   *             rows are in that state, and saying so is the D5 finding.
   *   undefined — we have not been told yet. Print NOTHING: `budgetData` is set
   *             to null on every dataset, year and entity change, so printing
   *             the finding here flashed it over governments whose publisher IS
   *             recorded, and stuck on an absent-series view. Found in review.
   */
  publisher: string | null | undefined;
  /** The series switcher. */
  children?: ReactNode;
  className?: string;
}

export default function SourceBar({
  provenance, publisher, children, className = '',
}: SourceBarProps) {
  const named = publisher === undefined ? null : publisherLabel(publisher);
  const showRow = provenance !== null || named !== null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {showRow && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {provenance && (
            <ScopeLabel
              scope={provenance.scope}
              basis={provenance.basis}
              accountingBasis={provenance.accountingBasis}
              auditGrade={provenance.auditGrade}
            />
          )}
          {/* PLAIN TEXT, not a pill. The grade chip inside ScopeLabel is a real
              button because it opens the explainer; these two inform and afford
              nothing, and a pill that looks clickable and does nothing is the
              false affordance Chris hit twice in AUSTIN-TRAVIS-01 UAT. */}
          {named !== null && (
            <span className="text-[11px] text-ev-gray-600 dark:text-ev-gray-300">{named}</span>
          )}
          {provenance?.span && (
            <span className="text-[11px] text-ev-gray-500 dark:text-ev-gray-400">
              {spanLabel(provenance.span)}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
