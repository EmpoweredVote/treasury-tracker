/**
 * Essentials coverage contract — the TT-side mirror of Essentials' `treasury.js`
 * (the reciprocal matcher). Fetches Essentials' public coverage catalog once per
 * session, caches it in-memory, and resolves the current TT entity to a coverage
 * record (GEOID(s) or a deep-link target) via tier-aligned, loose, state-scoped
 * matching. Never throws — a slow/failed/absent catalog degrades to `null` so the
 * hero banner always paints.
 *
 * See:
 * - src/utils/wikiImage.ts — the graceful-fetch + in-memory-cache precedent.
 * - C:/transparent motivations/essentials/src/lib/treasury.js — the reciprocal matcher.
 * - C:/transparent motivations/essentials/src/lib/coverage.js — normalizePlace source of truth.
 *
 * T-125-01: the catalog is untrusted remote data. This module returns PLAIN DATA
 * only — no URL/DOM construction happens here. Phase 126 (the consumer that turns
 * a CoverageRecord into a clickable link) MUST build any href via `URLSearchParams`
 * (or treat `target` as an opaque, already-built path) — never string-concatenate
 * `label`/`geoids`/`target` into a URL or interpolate them as HTML.
 */

import { useState, useEffect } from 'react';
import type { Municipality } from '../types/budget';

// ── Types (contract shape agreed in 125-CONTEXT.md D-02c) ──────────────────

export interface CoverageCityRecord {
  label: string;
  geoids: string[];
  state: string;
  hasContext?: boolean;
}

export interface CoverageCountyRecord {
  label: string;
  geoids: string[];
  state: string;
  hasContext?: boolean;
}

export interface CoverageStateRecord {
  label: string;
  abbrev: string;
}

export interface CoverageFederalRecord {
  label: string;
  target: string;
}

/** The full Essentials coverage catalog, as served at `/coverage.json`. */
export interface CoverageCatalog {
  generatedAt?: string;
  cities?: CoverageCityRecord[];
  counties?: CoverageCountyRecord[];
  states?: CoverageStateRecord[];
  federal?: CoverageFederalRecord;
}

/**
 * A resolved match for the current TT entity. Untrusted-data note (T-125-01):
 * `geoids` and `target` are drawn verbatim from the remote catalog. The consumer
 * (Phase 126) MUST build any href via `URLSearchParams` — never by concatenating
 * these values directly into a URL string or into DOM/HTML.
 */
export interface CoverageRecord {
  tier: 'city' | 'county' | 'state' | 'federal';
  label: string;
  geoids?: string[];
  stateAbbrev?: string;
  target?: string;
  hasContext?: boolean;
}

// ── Fetch + cache (COV-02) ──────────────────────────────────────────────────

/** Origin serving Essentials' public coverage catalog. Mirrors Essentials'
 *  own `VITE_TREASURY_URL` convention. */
export const ESSENTIALS_URL =
  import.meta.env.VITE_ESSENTIALS_URL || 'https://essentials.empowered.vote';

/** Light shape check on the fetched body — must be an object, and any of the
 *  known array fields (if present) must actually be arrays. Guards against a
 *  malformed/hostile response before it flows into the matcher. */
function isValidCatalogShape(body: unknown): body is CoverageCatalog {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if ('cities' in b && b.cities !== undefined && !Array.isArray(b.cities)) return false;
  if ('counties' in b && b.counties !== undefined && !Array.isArray(b.counties)) return false;
  if ('states' in b && b.states !== undefined && !Array.isArray(b.states)) return false;
  return true;
}

/** Module-level cache: resolve the catalog fetch at most once per session,
 *  including a failed/null result (never retried mid-session). */
let coveragePromise: Promise<CoverageCatalog | null> | null = null;

/**
 * Fetch the Essentials coverage catalog. Never throws — returns `null` on
 * network error, a non-OK response, or a body that fails the shape check.
 * Cached at module scope so repeated calls within a session share one fetch.
 */
export function fetchCoverage(): Promise<CoverageCatalog | null> {
  if (coveragePromise) return coveragePromise;

  coveragePromise = (async () => {
    try {
      const res = await fetch(`${ESSENTIALS_URL}/coverage.json`);
      if (!res.ok) return null;
      const body: unknown = await res.json();
      if (!isValidCatalogShape(body)) return null;
      return body;
    } catch {
      return null;
    }
  })();

  return coveragePromise;
}

// ── Matching (COV-03, COV-04) ───────────────────────────────────────────────

/** Ported verbatim from Essentials' `coverage.js` normalizePlace: lowercase,
 *  drop punctuation, expand "st./saint", collapse whitespace, trim. */
export function normalizePlace(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Strip a trailing ", XX" state suffix and a trailing " County" from a label
 *  before normalizing, so "Los Angeles County", "Washington County, OR", and
 *  "Washington County" (bare) all reduce to a comparable base name. */
function stripLabel(s: string): string {
  return s
    .replace(/,\s*[A-Za-z]{2}$/, '')
    .replace(/\s+county$/i, '')
    .trim();
}

const CITY_TIER_TYPES = new Set<Municipality['entity_type']>([
  'city',
  'town',
  'township',
  'municipality',
]);

/**
 * Resolve a TT entity to its Essentials coverage record, tier-aligned:
 * federal → the federal record (location-independent); state → by abbrev;
 * county → county records; city/town/township/municipality → city records.
 * Any other tier (nonprofit, special_district, school_district, library,
 * conservancy) returns null. A name match with no same-state record returns
 * null — never a wrong-state link (D-03a).
 */
export function matchEntityToCoverage(
  entity: Pick<Municipality, 'name' | 'state' | 'entity_type'>,
  catalog: CoverageCatalog | null
): CoverageRecord | null {
  if (!catalog) return null;

  if (entity.entity_type === 'federal') {
    if (!catalog.federal) return null;
    return { tier: 'federal', label: catalog.federal.label, target: catalog.federal.target };
  }

  if (entity.entity_type === 'state') {
    const wantAbbrev = entity.state.toUpperCase();
    const match = (catalog.states ?? []).find((s) => s.abbrev.toUpperCase() === wantAbbrev);
    if (!match) return null;
    return { tier: 'state', label: match.label, stateAbbrev: match.abbrev };
  }

  let records: Array<CoverageCityRecord | CoverageCountyRecord> | undefined;
  let tier: 'city' | 'county';
  if (entity.entity_type === 'county') {
    records = catalog.counties;
    tier = 'county';
  } else if (CITY_TIER_TYPES.has(entity.entity_type)) {
    records = catalog.cities;
    tier = 'city';
  } else {
    return null;
  }

  if (!records) return null;

  const wantState = entity.state.toUpperCase();
  const wantName = normalizePlace(stripLabel(entity.name));
  const match = records.find(
    (r) => r.state.toUpperCase() === wantState && normalizePlace(stripLabel(r.label)) === wantName
  );
  if (!match) return null;

  return {
    tier,
    label: match.label,
    geoids: match.geoids,
    stateAbbrev: match.state,
    hasContext: match.hasContext,
  };
}

// ── React hook (the App.tsx consumption seam) ───────────────────────────────

/**
 * Resolve the current entity's Essentials coverage, async, never blocking the
 * render. Clears to `null` while resolving and whenever the entity is null.
 * This is the seam Phase 126 consumes to decide whether to render the tether icon.
 */
export function useEssentialsCoverage(entity: Municipality | null): CoverageRecord | null {
  const [record, setRecord] = useState<CoverageRecord | null>(null);

  useEffect(() => {
    if (!entity) {
      setRecord(null);
      return;
    }
    setRecord(null); // clear while resolving
    let cancelled = false;
    fetchCoverage().then((catalog) => {
      if (cancelled) return;
      setRecord(matchEntityToCoverage(entity, catalog));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity?.id]);

  return record;
}
