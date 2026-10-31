import type { ReactNode } from 'react';
import ScopeLabel from './ScopeLabel';
import { spanLabel } from '../data/seriesSelection';
import { NO_PUBLISHER } from '../data/provenanceLine';
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
 * ⚠ The grade shown here is the SERIES grade, over-disclosed across its
 * datasets by weakestGrade(). A chart shows ONE dataset in one year and takes
 * its own citation from that dataset's metadata instead; using the series grade
 * on a chart would state the weaker of two datasets over a figure drawn from
 * only one of them.
 *
 * ⚠ Not rendered for nonprofits. For EV these are inapplicable questions, not
 * unanswered ones (#198), and the gate lives at the call site alongside the one
 * FundSeriesToggle already carries.
 */

interface SourceBarProps {
  scope: FundScope | null | undefined;
  basis?: Basis | null;
  accountingBasis?: AccountingBasis | null;
  auditGrade?: AuditGrade | null;
  /** `dataSourceInfo.displayName`, or null when the API returned none. */
  publisher: string | null;
  /** The series' own coverage span, or null when there is no series. */
  span?: { min: number; max: number } | null;
  /** The series switcher. */
  children?: ReactNode;
  className?: string;
}

export default function SourceBar({
  scope, basis, accountingBasis, auditGrade, publisher, span, children, className = '',
}: SourceBarProps) {
  // ⚠ Says it rather than dropping it. 16,997 statement rows carry no publisher
  // the API will return, and today both existing surfaces render NOTHING for
  // them — a figure with no attribution and nothing to say any is missing.
  // Silence is worse than a broken link for the reader this is written for.
  const named = publisher && publisher.trim() !== '' ? publisher.trim() : NO_PUBLISHER;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ScopeLabel
          scope={scope}
          basis={basis}
          accountingBasis={accountingBasis}
          auditGrade={auditGrade}
        />
        {/* PLAIN TEXT, not a pill. The grade chip inside ScopeLabel is a real
            button because it opens the explainer; these two inform and afford
            nothing, and a pill that looks clickable and does nothing is the
            false affordance Chris hit twice in AUSTIN-TRAVIS-01 UAT. */}
        <span className="text-[11px] text-ev-gray-600 dark:text-ev-gray-300">{named}</span>
        {span && (
          <span className="text-[11px] text-ev-gray-500 dark:text-ev-gray-400">
            {spanLabel(span)}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
