/**
 * Tethered feature-icon product registry (Phase 126) — the TT-side mirror of
 * Essentials' `src/lib/featureIcons.js`. Unlike Essentials (which matches the
 * current entity to its own catalog inside `resolve()`), TT's matching is
 * already done by Phase 125's `useEssentialsCoverage` hook — this module's
 * `essentials.resolve()` takes the already-resolved `CoverageRecord` and
 * builds the tier-correct deep-link.
 *
 * See:
 * - src/utils/essentialsCoverage.ts — `CoverageRecord`, `ESSENTIALS_URL`, the
 *   Phase 125 resolver seam this module consumes.
 * - C:/transparent motivations/essentials/src/lib/featureIcons.js — the
 *   reciprocal `PRODUCT_REGISTRY` shape, fixed order, reserved-slot pattern.
 *
 * T-126-01: `geoids`, `stateAbbrev`, `label`, and `target` on a `CoverageRecord`
 * come from a remote catalog TT does not control. Every href in this module is
 * built with the `URL` + `URLSearchParams` API only — never by concatenating a
 * catalog value into a string. The federal `target` is only accepted when it
 * resolves to the ESSENTIALS_URL origin; a hostile absolute target
 * (`https://evil.example/x`) OR protocol-relative target (`//evil.example/x`)
 * yields `null`. No `dangerouslySetInnerHTML` anywhere in this module.
 *
 * Kept PURE (no React, no fetch) so it is unit-testable in isolation.
 */

import type { CoverageRecord } from './essentialsCoverage';
import { ESSENTIALS_URL } from './essentialsCoverage';
import type { TriviaRecord } from './triviaCoverage';
import { TRIVIA_URL } from './triviaCoverage';

/** A single resolved, renderable feature-icon chip. */
export interface FeatureIcon {
  key: string;
  href: string;
  label: string;
  iconSrc: string;
}

/**
 * Build the tier-correct Essentials deep-link for the current entity's
 * resolved coverage record, or `null` when no real link exists (TETH-01,
 * D-126-06). Pure — never throws, never mutates.
 *
 * - city/county: requires `record.geoids?.[0]`; absent → `null`.
 * - state: `browse_state_officials=<abbrev>`.
 * - federal: requires `record.target` to be a same-origin path (starts with
 *   `/`); a hostile absolute URL (e.g. attempting to escape ESSENTIALS_URL)
 *   returns `null` (T-126-01).
 */
export function buildEssentialsHref(record: CoverageRecord): string | null {
  if (record.tier === 'city' || record.tier === 'county') {
    const geoid = record.geoids?.[0];
    if (!geoid) return null;
    const url = new URL('/results', ESSENTIALS_URL);
    url.searchParams.set('browse_government_list', geoid);
    if (record.stateAbbrev) url.searchParams.set('browse_state', record.stateAbbrev);
    url.searchParams.set('browse_label', record.label);
    return url.toString();
  }

  if (record.tier === 'state') {
    if (!record.stateAbbrev) return null;
    const url = new URL('/results', ESSENTIALS_URL);
    url.searchParams.set('browse_state_officials', record.stateAbbrev);
    url.searchParams.set('browse_label', record.label);
    return url.toString();
  }

  if (record.tier === 'federal') {
    // Same-origin guard (T-126-01): the target must be a root-relative path
    // (`/…`) that resolves to the ESSENTIALS_URL origin. Reject an absent
    // target, a protocol-relative target (`//host/…` — `startsWith('/')` is
    // true but `new URL` sends it to a different origin), an absolute URL, or
    // anything else that escapes the Essentials origin.
    if (!record.target || !record.target.startsWith('/') || record.target.startsWith('//')) {
      return null;
    }
    const resolved = new URL(record.target, ESSENTIALS_URL);
    if (resolved.origin !== new URL(ESSENTIALS_URL).origin) return null;
    return resolved.toString();
  }

  return null;
}

/**
 * One product-registry entry. `resolve(record)` returns the renderable icon
 * for the current entity's coverage record, or `null` when there is nothing
 * to link to (no per-location contract, or the record doesn't resolve to a
 * real href).
 */
interface FeatureProduct {
  key: string;
  resolve(record: CoverageRecord | null): FeatureIcon | null;
}

/**
 * Fixed-order product registry (D-126-04): [essentials, compass, readrank].
 * Only `essentials` has a live resolver today. `compass` and `readrank` are
 * documented, non-rendering reserved slots — no per-location contract exists
 * yet for either product, so their `resolve` always returns `null` (ICON-03,
 * TETH-02). This reserves their position in the row with zero future layout
 * change once each product gains a contract.
 */
export const PRODUCT_REGISTRY: FeatureProduct[] = [
  {
    key: 'essentials',
    resolve(record) {
      if (!record) return null;
      const href = buildEssentialsHref(record);
      if (!href) return null;
      return {
        key: 'essentials',
        href,
        label: 'Essentials',
        iconSrc: '/essentials-symbol-light.svg',
      };
    },
  },
  {
    // Reserved slot — no per-location contract yet (ICON-03/TETH-02). Not
    // rendered until Compass gains its own coverage/resolver story. Icon
    // asset staged at /compass-symbol-light.svg for when it does.
    key: 'compass',
    resolve() {
      return null;
    },
  },
  {
    // Reserved slot — no per-location contract yet (ICON-03/TETH-02). Not
    // rendered until Read & Rank gains its own coverage/resolver story. Icon
    // asset staged at /readrank-symbol-light.svg for when it does.
    key: 'readrank',
    resolve() {
      return null;
    },
  },
];

/**
 * Resolve the tethered feature-icon row for the current entity's coverage
 * record, in fixed `PRODUCT_REGISTRY` order. A `null` record (uncovered
 * entity, or coverage still resolving) or a record with no linkable target
 * yields `[]` — the row renders nothing (ICON-03).
 */
export function resolveFeatureIcons(record: CoverageRecord | null): FeatureIcon[] {
  const icons: FeatureIcon[] = [];
  for (const product of PRODUCT_REGISTRY) {
    const icon = product.resolve(record);
    if (icon) icons.push(icon);
  }
  return icons;
}

/**
 * Build the CTC (Civic Trivia Championship) deep-link for a resolved trivia
 * coverage record, or `null` when the record has no slug. T-126-01: `slug` is
 * untrusted remote data — the href is built with `URL`/`URLSearchParams` only,
 * never by string-concatenating the slug.
 */
export function buildTriviaHref(record: TriviaRecord): string | null {
  if (!record.slug) return null;
  const url = new URL('/', TRIVIA_URL);
  url.searchParams.set('collection', record.slug);
  return url.toString();
}

/**
 * Resolve the CTC feature-icon chip for the current entity's trivia coverage
 * record, or `null` when there is no matching collection. Composed AFTER
 * `resolveFeatureIcons()`'s Essentials chip in App.tsx (fixed display order:
 * essentials, then trivia) — kept separate because CTC coverage comes from a
 * different source (`triviaCoverage`) than the Essentials `CoverageRecord`.
 *
 * Uses the `-dark` symbol — the bright, dark-background brand variant — so the
 * trophy stays legible on the navy chip. This is the inverse suffix from the
 * other products (which render `-light`), because the CTC brand kit's `-dark`
 * file is the light-artwork-for-dark-background one. See
 * public/trivia-symbol-{light,dark}.svg.
 */
export function resolveTriviaIcon(record: TriviaRecord | null): FeatureIcon | null {
  if (!record) return null;
  const href = buildTriviaHref(record);
  if (!href) return null;
  return {
    key: 'trivia',
    href,
    label: 'Civic Trivia Championship',
    iconSrc: '/trivia-symbol-dark.svg',
  };
}
