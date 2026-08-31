/**
 * AUDIT-GRADE — what independent assurance stands behind a figure, in words a
 * reader who has never heard of an "unmodified opinion" can use.
 *
 * Treasury Tracker graded 88,820 budget rows across eight loading sessions. The
 * column existed, was constrained, was populated — and until this module, a
 * reader could see none of it. Everything built to grade honestly reached nobody.
 *
 * ⚠⚠ THESE FIVE VALUES ARE NOT A LADDER, AND NOTHING HERE MAY RENDER THEM AS
 * ONE. `audited_ocboa` carries the SAME assurance as `audited_gaap` — an
 * independent opinion under Government Auditing Standards — on a measurement
 * basis that is not GAAP. Assurance and comparability are two different
 * questions, and a single 1–5 scale can only answer one of them wrongly. That is
 * why the UI distinguishes these by WORDS and not by colour or star count.
 *
 * ⚠⚠ TWO VALUES CAN LIBEL A GOVERNMENT AT SCALE if the copy drifts, and between
 * them they are 99.4% of the database (counts as of 2026-08-31):
 *
 *   unknown                  60,368 rows / 2,122 entities — 68.0%
 *   self_reported_unaudited  27,912 rows /   835 entities — 31.4%
 *   audited_gaap                342 rows /    15 entities —  0.4%
 *   compiled_from_audited       190 rows /     7 entities —  0.2%
 *   audited_ocboa                 8 rows /     1 entity   —  0.01%
 *
 * `unknown` means NOBODY HAS LOOKED. Most of those 2,122 governments are audited
 * every year. `self_reported_unaudited` is a statutory filing a finance officer
 * signs, often drawn straight from audited books. Rendering the first as a
 * warning, or the second as "unverified", would smear thousands of governments
 * for a gap that is ours. auditGrade.test.ts pins the wording against exactly
 * that drift — those tests are the point, not decoration.
 *
 * ⚠ KNOWN GAP, FILED NOT FIXED: a QUALIFIED opinion currently grades identically
 * to a clean one. Every loaded Harrison County MS year (10 rows) carries an
 * "except for" opinion — a scope limitation over the aging of Circuit Court
 * fines receivable — and reads here as plain `audited_gaap`. Resolving it needs
 * a decision between an orthogonal opinion field and a sixth value; deferred
 * deliberately, so the copy below must not claim a precision we do not have.
 * See .planning/followups/audit-grade-explained-to-readers.md.
 *
 * The loading-side vocabulary and its rules live in scripts/lib/budgetAxes.mjs.
 */

export type AuditGrade =
  | 'audited_gaap'
  | 'audited_ocboa'
  | 'compiled_from_audited'
  | 'self_reported_unaudited'
  | 'unknown';

/**
 * ⚠ Must match the CHECK constraint on treasury.budgets exactly. If the database
 * gains a value and this list does not, normalizeAuditGrade() silently downgrades
 * real grades to `unknown` and the reader is told less than we know.
 */
export const AUDIT_GRADE_VALUES: readonly AuditGrade[] = [
  'audited_gaap',
  'audited_ocboa',
  'compiled_from_audited',
  'self_reported_unaudited',
  'unknown',
] as const;

/**
 * ⚠⚠ An absent or unrecognised value is UNKNOWN — the OPPOSITE direction from
 * normalizeDerivation(), and deliberately so.
 *
 * `derivation` defaults to 'published' because every pre-SCOPE-04 row genuinely
 * is published: the default states a fact. There is no equivalent fact here. A
 * row whose grade we were not told is a row nobody has looked at, and defaulting
 * to any graded value would have Treasury Tracker assert an audit it never read
 * — a false public claim about a government's books. The destructive direction
 * is "assert a grade", never "admit ignorance".
 *
 * This also covers the pre-deploy window: an API build that has not yet shipped
 * the column omits it, and reading that as `unknown` is honest.
 */
export function normalizeAuditGrade(raw: unknown): AuditGrade {
  return (AUDIT_GRADE_VALUES as readonly unknown[]).includes(raw)
    ? (raw as AuditGrade)
    : 'unknown';
}

/**
 * Did an independent auditor publish an opinion on this figure?
 *
 * ⚠ TRUE FOR BOTH audited values. An OCBOA report carries an independent opinion
 * under Government Auditing Standards exactly as a GAAP one does — excluding it
 * would rebuild the ladder this module exists to reject.
 */
export function isAudited(grade: AuditGrade): boolean {
  return grade === 'audited_gaap' || grade === 'audited_ocboa';
}

export interface AuditGradeCopy {
  /** Short chip label shown beside the figure. */
  label: string;
  /** One line, shown on hover and above the long text when expanded. */
  short: string;
  /** The full explainer paragraph for this value. */
  long: string;
}

export const AUDIT_GRADE_COPY: Record<AuditGrade, AuditGradeCopy> = {
  audited_gaap: {
    label: 'Independently audited',
    short: 'An outside auditor examined these figures and published an opinion on them.',
    long:
      'This figure comes from a report an independent accounting firm or state audit office '
      + 'examined and signed. The auditor tested the government’s records and published a '
      + 'written opinion on whether the statements present its finances fairly, using the '
      + 'accounting rules US governments are generally expected to follow. It is the same '
      + 'document a bond investor or a council member would rely on, and Treasury Tracker read '
      + 'it directly rather than taking anyone’s summary of it.',
  },

  // ⚠⚠ The value that breaks a linear scale. Brown County SD is TT's first and,
  // so far, only one. Its statements are titled "... — MODIFIED CASH BASIS" and
  // its auditor says outright they are on a basis other than GAAP.
  //
  // Both halves of this copy are load-bearing and are pinned by tests: the audit
  // is JUST AS INDEPENDENT, and the figures are NOT COMPARABLE line-for-line.
  // Drop the first half and a reader downgrades a perfectly good audit; drop the
  // second and they compare two different things without knowing it.
  audited_ocboa: {
    label: 'Audited — other basis',
    short: 'Independently audited to the same standard, but measured a different way.',
    long:
      'An outside auditor examined these figures and published an opinion on them, exactly as '
      + 'with any audited report — the assurance is the same. What differs is the yardstick. '
      + 'Rather than the accounting rules most US governments use, this government keeps its '
      + 'books on another recognised basis, usually one closer to when cash actually moves than '
      + 'to when a bill is incurred. That is lawful and common for smaller governments, and the '
      + 'auditor states it plainly in the report. It does mean the figures are not comparable '
      + 'line-for-line with a government reporting the usual way, so take care putting them '
      + 'side by side with another place.',
  },

  compiled_from_audited: {
    label: 'From audited reports',
    short: 'A state agency assembled this from governments’ audited statements.',
    long:
      'A state agency took this figure from the government’s audited financial statements and '
      + 're-published it in a standard statewide format. The underlying numbers were audited; '
      + 'the arrangement into categories is the agency’s. That makes it well suited to '
      + 'comparing places on a like-for-like basis, and one step further from the source than '
      + 'reading the audited report itself — a re-cut can group things differently from the '
      + 'original.',
  },

  // ⚠⚠ 27,912 rows across 835 entities. The words "unverified" and "unreliable"
  // are forbidden here and the test enforces it. This is an official filing a
  // named officer signs under a statutory duty, not a guess — but it genuinely
  // has not been audited, and the copy has to carry both facts at once.
  self_reported_unaudited: {
    label: 'Government-reported',
    short: 'The government filed these figures itself; they have not been independently audited.',
    long:
      'A government submitted these figures to a state agency as a required annual filing, '
      + 'signed by its finance officer. They are frequently drawn straight from the same books '
      + 'an auditor examines later — but the filing itself has not been independently audited, '
      + 'and no auditor has published an opinion on it. It is an official record rather than an '
      + 'estimate. Where Treasury Tracker also holds an audited report for the same place and '
      + 'year, that is the figure to prefer.',
  },

  // ⚠⚠ 60,368 rows across 2,122 entities — the note a reader meets most often on
  // this site. It describes OUR coverage, never the government. The test forbids
  // every alarm word; keep it that way.
  unknown: {
    label: 'Audit status not established',
    short: 'We have not yet checked what assurance stands behind this figure.',
    long:
      'Treasury Tracker has not yet established whether this figure comes from an audited '
      + 'report. That is a gap in our checking, not a finding about the government — most US '
      + 'local governments are audited every year, and this one may well be. Establishing it '
      + 'means finding the particular report behind this particular figure and reading the '
      + 'auditor’s page, which we do source by source. Until that is done we say so instead of '
      + 'guessing, because claiming an audit we have not read would be far worse than admitting '
      + 'we do not know.',
  },
};

/**
 * The shared explainer, shown once per page rather than once per figure.
 *
 * Written for someone who has never read an auditor's report and does not want a
 * lecture. The four-part shape mirrors FUND_SCOPE_EXPLAINER: what the thing is,
 * what it is not, why the commonest note is not an accusation, and what we do.
 */
export const AUDIT_GRADE_EXPLAINER = {
  heading: 'What "audited" means here',

  intro:
    'Every figure on this page carries a note saying how much independent checking stands '
    + 'behind it. Two governments can both publish honest numbers while one has been through an '
    + 'audit and the other has not, and that difference is invisible unless somebody says so.',

  whatAuditMeans:
    'An audit is not a fraud investigation, and not a judgement about whether money was spent '
    + 'well. An independent accountant tests a government’s records and publishes an opinion on '
    + 'whether its financial statements present its finances fairly. Most US local governments '
    + 'are audited every year, many of them because the law requires it.',

  whyUnknownIsNotBad:
    'The commonest note on this site says the audit status is not established. That means we '
    + 'have not looked yet — it is a statement about our coverage, not about the government, '
    + 'and it is roughly two figures in every three. In the same way, a figure a government '
    + 'filed itself is an official record signed by its finance officer, not a rumour.',

  whatWeDo:
    'We record an audit only when we have actually read one, source by source, and we say so '
    + 'plainly when we have not. These notes are not a ranking and not a score: an audit on a '
    + 'different accounting basis is every bit as independent as one on the usual basis, it '
    + 'simply measures things another way. How much checking a figure has had, and whether it '
    + 'can be compared with another place, are two separate questions.',
} as const;
