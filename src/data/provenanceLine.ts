/**
 * AUDIT-GRADE §5.2 — the citation a figure carries when it leaves the page.
 *
 * Chris's rule, verbatim: "we should only share the information with how we
 * sourced it and our confidence in that source." The reader is a journalist
 * deciding whether they can cite a number, and the case that decided the design
 * is a figure read off a bar in a chart and screenshotted on its own. A source
 * bar at the top of the page does not travel with that screenshot; this line,
 * printed under the chart the way a figure in a report carries its source,
 * does.
 *
 * ⚠ PURE. No React, no fetch — the same reason `spanLabel` lives in
 * seriesSelection.ts rather than inside FundSeriesToggle: logic inside a
 * component is logic this repo cannot test.
 *
 * ⚠ The copy is not authored here. Every word comes from the vocabulary modules
 * (auditGrade.ts, fundScopeVocabulary.ts) or from the app's own period helper,
 * so a reviewer reads the wording in one place and the citation cannot drift
 * away from the chip sitting above it.
 */

import { AUDIT_GRADE_COPY, normalizeAuditGrade, type AuditGrade } from './auditGrade';
import { FUND_SCOPE_COPY, normalizeScope, type FundScope } from './fundScopeVocabulary';
import { parsePeriod } from '../utils/period';

/**
 * What the line says where a publisher should be.
 *
 * ⚠⚠ THIS IS NOT A PLACEHOLDER, IT IS THE FINDING. 16,997 statement rows have no
 * publisher the API will return — 16,816 of them Massachusetts DLS across 351
 * towns (measured in production 2026-10-30). `treasuryService.mapBudget` builds
 * `data_source_info` only when a row carries data_source AND source_url AND
 * source_date, and `source_date` is null on every one of those rows, so both
 * existing surfaces — the SourceChip and the "Data sourced from …" line — render
 * nothing at all.
 *
 * Silence is worse than a broken link: a reader sees a figure with no
 * attribution and nothing tells them any is missing. Saying so is the honest
 * state and costs nothing; writing the provenance back onto those rows is a
 * separate piece of work with a recon in front of it.
 */
export const NO_PUBLISHER = 'source not recorded';

export interface ProvenanceParts {
  /**
   * ⚠ NULLABLE ON PURPOSE. BudgetData.metadata types these optional because an
   * older API build omits the columns, and both normalisers read absent as
   * `unknown` — never as a grade and never as a scope. Narrowing the type here
   * would push a non-null assertion out to every call site, which is where that
   * guarantee would quietly be lost.
   */
  grade: AuditGrade | null | undefined;
  scope: FundScope | null | undefined;
  /** `dataSourceInfo.displayName`, or null when the API returned none. */
  publisher: string | null;
  /** The period token already on screen, e.g. `2025` or `1976-TQ`. */
  period: string;
}

const SEPARATOR = ' · ';

/**
 * One line: what assurance, which funds, whose figures, which period.
 *
 * ⚠ Every segment is always present, so the line never renders a doubled or a
 * trailing separator — a citation ending in "· " tells a reader something was
 * dropped and leaves them guessing which part.
 */
/**
 * The publisher as a reader sees it, or the finding when there is none.
 *
 * ⚠ Exported so SourceBar and citationLine cannot drift: two copies of this
 * one-liner is two chances for a page to say "source not recorded" in one place
 * and nothing in the other, over the same row.
 */
/**
 * ⚠⚠ `data_source` IS A MACHINE KEY, NOT READER COPY, and this is the whole
 * reason the cut exists. Four registries regex-match that string and the
 * live-sync exclusion joins on it by name, so it can never be rewritten in the
 * database — but printing it verbatim put 76 characters in one citation
 * segment, said "General Fund" and the year twice each, and never named the
 * publisher:
 *
 *   Independently audited · General Fund ·
 *     Los Angeles ACFR — General Fund Revenue by Source (FY2025 actual, GAAP basis)
 *     · FY 2025
 *
 * ⭐ THE CONVENTION WAS MEASURED ACROSS EVERY LOADER REGISTRY, not assumed:
 * `<document> — <face/scope> <dataset> (<FY>, <basis>)`. What follows the em
 * dash is a per-row descriptor the line already carries in its own segments;
 * what precedes it is the document a journalist would cite.
 *
 * ⚠ AN ASCII HYPHEN MUST NOT CUT. `CA State Controller - Expenditures` is one
 * name, and hyphens sit inside real publisher names.
 */
const DESCRIPTOR = '—'; // EM DASH — never HYPHEN-MINUS

export function publisherLabel(publisher: string | null | undefined): string {
  if (typeof publisher !== 'string' || publisher.trim() === '') return NO_PUBLISHER;
  const full = publisher.trim();
  const cut = full.split(DESCRIPTOR)[0].trim();
  // ⚠ An empty cut renders a doubled separator, which tells a reader something
  // was dropped without telling them what. Keep the whole string instead.
  return cut === '' ? full : cut;
}

export function citationLine({ grade, scope, publisher, period }: ProvenanceParts): string {
  const named = publisherLabel(publisher);

  const resolvedGrade = normalizeAuditGrade(grade);

  // ⚠⚠ THE SCOPE SEGMENT IS DROPPED ON A NON-STATEMENT RECORD, and this is the
  // same category error as the grade, one axis over. Every `salaries` row is
  // fund_scope `unknown` — seriesSelection.ts records that and excludes them from
  // series selection for it — so the line would have read
  //
  //   Not a financial statement · SCOPE NOT ESTABLISHED · LA City Payroll · FY 2024
  //
  // which stops confessing on one axis and immediately re-confesses on the next.
  // "Which funds does this cover" is not an unanswered question about a payroll
  // roster; it is an inapplicable one (#198), and the honest rendering is
  // silence on that axis, not a claim about it.
  //
  // ⚠ The segment is REMOVED, never blanked — an empty string here would render
  // a doubled separator, which tells a reader something was dropped without
  // telling them what.
  const segments = [
    AUDIT_GRADE_COPY[resolvedGrade].label,
    ...(resolvedGrade === 'not_applicable' ? [] : [FUND_SCOPE_COPY[normalizeScope(scope)].label]),
    named,
    // ⚠ Rendered by the app's own helper, never formatted again here. The FY1976
    // Transition Quarter is a real period in this database, synthesised from a
    // `period_label` row, and a citation reading "FY 1976" over a three-month
    // figure would be wrong in the one place it matters.
    parsePeriod(period).shortLabel,
  ];

  return segments.join(SEPARATOR);
}
