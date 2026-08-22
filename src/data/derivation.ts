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
} as const;
