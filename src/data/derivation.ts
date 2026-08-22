/**
 * SCOPE-04 -- is this figure something a government published, or TT's
 * arithmetic over published components?
 *
 * Separate from `fund_scope` on purpose: total_governmental already holds
 * 28,410 PUBLISHED rows from MN OSA and Ohio AOS, so the scope value alone
 * cannot tell a reader which kind of figure they are looking at.
 */
export type Derivation = 'published' | 'derived';

export const DERIVATION_VALUES: readonly Derivation[] = ['published', 'derived'] as const;

/**
 * ⚠ An absent or unrecognised value is PUBLISHED, never derived. Every row
 * predating SCOPE-04 is published, and an older API build omits the field
 * entirely -- defaulting the other way would label the whole database computed.
 */
export function normalizeDerivation(raw: unknown): Derivation {
  return raw === 'derived' ? 'derived' : 'published';
}

export function isDerived(d: Derivation): boolean {
  return d === 'derived';
}

/**
 * Reader-facing copy for a derived figure.
 *
 * ⚠ Per PR #38's rule this renders as an INERT LABEL -- plain text, not a chip,
 * because it is a statement about the figure and not a control. And it keeps its
 * words: the point is that a reader can tell computed from published without
 * knowing what `total_governmental` means.
 */
export const DERIVED_COPY = {
  marker: 'computed by Treasury Tracker',
  explainer:
    'Treasury Tracker computed this figure by adding up published components. '
    + 'The government published the parts, not this total.',

  /**
   * SCOPE-04 ruling (Chris, 2026-08-22): keep the name "Total Governmental",
   * and DISCLOSE what it leaves out.
   *
   * ⚠ This sentence is the ONLY thing standing between a reader and a real
   * mismatch. The figure is built from the State Controller's governmental
   * schedule; a city's own audited "Total Governmental Funds" ALSO includes its
   * redevelopment successor-agency funds. Both totals are individually correct,
   * which is exactly why no arithmetic gate can surface the difference —
   * a tie test compares two right answers to different questions.
   *
   * Proven at Napa FY2017 to the dollar:
   *   97,277,497 printed − 18,524 successor agency + 79,307 sale of capital
   *   assets = 97,338,280 derived.
   *
   * ⚠ Do NOT add "slightly" or "minor". Napa's gap was $23 on the spending side
   * and $18,524 on revenue — nothing at all — but that is ONE city, and the
   * milestone has no measurement of how large it gets elsewhere. A city with a
   * big successor agency could differ materially. Promising small is a claim
   * this has not earned, and `derivation.test.ts` fails if the words creep in.
   */
  scopeNote:
    'This covers the governmental funds the city reports to the State Controller. '
    + 'Redevelopment successor agency funds are not included, so it can differ from '
    + 'the "total governmental funds" figure printed in the city\'s own audited report.',
} as const;
