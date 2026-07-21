/**
 * Civic Trivia Championship (CTC) coverage contract — the TT-side mirror of
 * Essentials' `trivia.js` (the reciprocal matcher). Fetches CTC's collections
 * list once per session, caches it in-memory, and resolves the current TT
 * entity to a coverage record (a collection slug + tier) via tier-aligned,
 * loose, state-scoped matching. Never throws — a slow/failed/absent catalog
 * degrades to `null` so the hero banner always paints.
 *
 * See:
 * - src/utils/essentialsCoverage.ts — the sibling fetch/cache/match seam.
 * - C:/transparent motivations/essentials/src/lib/trivia.js — the reciprocal
 *   matcher (toCollectionSlug, findMatchingCityCollection, findStateCollection,
 *   findFederalCollection).
 *
 * T-125-01 (untrusted remote data): the collections list comes from a remote
 * catalog TT does not control. This module returns PLAIN DATA only — no URL/DOM
 * construction happens here. The consumer that turns a `TriviaRecord` into a
 * clickable link (featureIcons.ts `buildTriviaHref`) MUST build the href via
 * `URLSearchParams` — never string-concatenate `slug` into a URL.
 *
 * Kept dependency-light so the matcher is unit-testable in isolation.
 */

import { useState, useEffect } from 'react';
import type { Municipality } from '../types/budget';

// ── Types ────────────────────────────────────────────────────────────────────

/** One CTC collection entry, as served by the collections list. Extra fields
 *  are ignored. `slug` is the deep-link key; `tier`/`localeName` gate matching. */
export interface TriviaCollection {
  slug: string;
  tier?: 'city' | 'state' | 'federal';
  localeName?: string;
}

/** A resolved match for the current TT entity. `slug` is drawn verbatim from
 *  the remote catalog — the consumer MUST build any href via `URLSearchParams`
 *  (T-125-01), never by concatenating it into a URL string. */
export interface TriviaRecord {
  tier: 'city' | 'state' | 'federal';
  slug: string;
}

// ── Fetch + cache ──────────────────────────────────────────────────────────

/** CTC base URL — deep-links append `?collection=<slug>`. Mirrors Essentials'
 *  `VITE_TRIVIA_URL` convention. */
export const TRIVIA_URL =
  import.meta.env.VITE_TRIVIA_URL || 'https://ctc.empowered.vote';

/** Shared ev-accounts-api base, re-derived locally (mirrors auth.ts) so this
 *  module stays self-contained. Essentials fetches the CTC collections list
 *  through this proxy rather than calling CTC cross-origin. */
const AUTH_BASE =
  import.meta.env.PROD && import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api';

/** A collection is usable only when it carries a non-empty slug (deep-link key). */
function hasSlug(c: unknown): c is TriviaCollection {
  return !!c && typeof c === 'object' && typeof (c as TriviaCollection).slug === 'string'
    && (c as TriviaCollection).slug.length > 0;
}

/** Module-level cache: resolve the collections fetch at most once per session,
 *  including an empty/failed result (never retried mid-session). */
let collectionsPromise: Promise<TriviaCollection[]> | null = null;

/**
 * Fetch the CTC collections list from the ev-accounts-api proxy. Never throws —
 * returns `[]` on network error, a non-OK response, or a body that isn't a
 * list. Accepts either a bare array or a `{ collections: [...] }` envelope.
 * Cached at module scope so repeated calls within a session share one fetch.
 */
export function fetchTriviaCollections(): Promise<TriviaCollection[]> {
  if (collectionsPromise) return collectionsPromise;

  collectionsPromise = (async () => {
    try {
      const res = await fetch(`${AUTH_BASE}/trivia/collections`, { credentials: 'include' });
      if (!res.ok) return [];
      const body: unknown = await res.json();
      const list = Array.isArray(body)
        ? body
        : (body as { collections?: unknown })?.collections;
      return Array.isArray(list) ? (list as TriviaCollection[]) : [];
    } catch {
      return [];
    }
  })();

  return collectionsPromise;
}

// ── Matching (mirrors trivia.js) ─────────────────────────────────────────────

/** Normalize for loose matching: lowercase, collapse whitespace, trim. */
function normalize(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Convert a city `{name, state}` to the slug CTC uses for city collections:
 * `<kebab-name>-<state>` (e.g. "los-angeles-ca"). Identical rules to Essentials'
 * `toCollectionSlug`/`toTreasurySlug` so the products key off the same value.
 */
export function toCollectionSlug(name: string, state?: string): string {
  const n = (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[/?#]/g, '');
  const s = (state || '').toLowerCase().replace(/[/?#]/g, '');
  return s ? `${n}-${s}` : n;
}

const CITY_TIER_TYPES = new Set<Municipality['entity_type']>([
  'city',
  'town',
  'township',
  'municipality',
]);

/**
 * Resolve a TT entity to its CTC collection, tier-aligned (parity with
 * Essentials' trivia matchers):
 *   - federal → the first federal-tier collection (location-independent).
 *   - state → a state-tier collection whose `localeName` matches the full state
 *     name (`entity.name` for a state entity, e.g. "California").
 *   - city/town/township/municipality → a city-tier collection whose slug equals
 *     `<stripped-name>-<state>`; requires a 2-letter state (city slugs are always
 *     state-suffixed, so without one a match is ambiguous → null).
 *   - any other tier (county, nonprofit, special_district, …) → null.
 */
export function matchEntityToTrivia(
  entity: Pick<Municipality, 'name' | 'state' | 'entity_type'>,
  collections: TriviaCollection[] | null
): TriviaRecord | null {
  if (!Array.isArray(collections) || collections.length === 0) return null;

  if (entity.entity_type === 'federal') {
    const match = collections.find((c) => hasSlug(c) && c.tier === 'federal');
    return match ? { tier: 'federal', slug: match.slug } : null;
  }

  if (entity.entity_type === 'state') {
    const want = normalize(entity.name);
    const match = collections.find(
      (c) => hasSlug(c) && c.tier === 'state' && normalize(c.localeName ?? '') === want
    );
    return match ? { tier: 'state', slug: match.slug } : null;
  }

  if (!CITY_TIER_TYPES.has(entity.entity_type)) return null;

  const state = entity.state;
  if (!/^[A-Za-z]{2}$/.test(state ?? '')) return null;

  // Strip a leading "City of "/"Town of "/… prefix before slugifying (parity
  // with Essentials' findMatchingCityCollection).
  const strippedName = normalize(entity.name).replace(
    /^(city|town|village|county|township|borough) of /,
    ''
  );
  const expected = toCollectionSlug(strippedName, state);
  const match = collections.find(
    (c) => hasSlug(c) && (c.tier === 'city' || !c.tier) && c.slug.toLowerCase() === expected
  );
  return match ? { tier: 'city', slug: match.slug } : null;
}

// ── React hook (the App.tsx consumption seam) ───────────────────────────────

/**
 * Resolve the current entity's CTC coverage, async, never blocking the render.
 * Clears to `null` while resolving and whenever the entity is null. Mirrors
 * `useEssentialsCoverage`.
 */
export function useTriviaCoverage(entity: Municipality | null): TriviaRecord | null {
  const [record, setRecord] = useState<TriviaRecord | null>(null);

  useEffect(() => {
    if (!entity) {
      setRecord(null);
      return;
    }
    setRecord(null); // clear while resolving
    let cancelled = false;
    fetchTriviaCollections().then((collections) => {
      if (cancelled) return;
      setRecord(matchEntityToTrivia(entity, collections));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.id]);

  return record;
}
