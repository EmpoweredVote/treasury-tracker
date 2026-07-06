/**
 * Resolve a hero banner image for a municipality.
 *
 * Priority:
 *   1. entity.hero_image_url — an explicit per-entity override from the DB.
 *   2. The org's shared, licensed banner bucket (Supabase Storage) — the
 *      authoritative, QA'd, Wikimedia-sourced image library shared across
 *      Empowered Vote apps. All 50 states, the federal band, and a curated
 *      (growing) set of cities are covered. See docs/shared-banner-assets.md
 *      in the `essentials` repo; catalog source of truth is that repo's
 *      src/lib/buildingImages.js. We gate on a known-covered list rather than
 *      probing (a CSS background-image can't onerror-fallback), so uncovered
 *      places never point at a 404.
 *   3. Fallback: a live Wikipedia REST lookup, for places not yet in the
 *      bucket. Slower/unlicensed — retained only so coverage never regresses.
 *   4. null — the caller renders a neutral gradient.
 *
 * Results are cached in-memory so each entity is resolved at most once per
 * session.
 */

import type { Municipality } from '../types/budget';

/** A resolved hero banner + the attribution credit to display, if any. */
export interface HeroImage {
  url: string;
  /** Human credit line to surface (e.g. "Wikimedia Commons"), or null when
   *  the source is a DB override of unknown provenance. */
  credit: string | null;
}

const cache = new Map<string, HeroImage | null>();

/** State abbreviation → full name for Wikipedia article titles */
export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming',
};

/**
 * Override Wikipedia article titles for cities where the standard article's
 * lead image is unrepresentative (e.g. Hollywood sign for all of Los Angeles).
 * Key format: "Name|STATE"
 */
const CITY_WIKI_OVERRIDES: Record<string, string> = {
  'Los Angeles|CA': 'Los Angeles skyline',
};

/**
 * Per-city CSS background-position overrides for when the default center crop
 * misses the subject (e.g. a skyline shot with foreground trees).
 * Key format: "Name|STATE"
 */
const CITY_BG_POSITION_OVERRIDES: Record<string, string> = {
  'Los Angeles|CA': 'center 30%',
};

/** Returns a CSS background-position value for the entity, or null to use the default. */
export function getHeroBgPosition(entity: Municipality): string | null {
  const key = `${entity.name}|${entity.state.toUpperCase()}`;
  return CITY_BG_POSITION_OVERRIDES[key] ?? null;
}

/**
 * Build candidate Wikipedia article titles for a municipality.
 * Wikipedia uses different naming conventions depending on entity type:
 *   City: "Bloomington, Indiana"
 *   County: "Monroe County, Indiana"
 *   Township: "Perry Township, Monroe County, Indiana"
 */
function buildSearchTitles(entity: Municipality): string[] {
  const stateFull = STATE_NAMES[entity.state.toUpperCase()] ?? entity.state;
  const titles: string[] = [];

  const cityOverride = CITY_WIKI_OVERRIDES[`${entity.name}|${entity.state.toUpperCase()}`];
  if (cityOverride) {
    titles.push(cityOverride);
    return titles;
  }

  switch (entity.entity_type) {
    case 'county':
      // "Monroe County, Indiana"
      titles.push(`${entity.name}, ${stateFull}`);
      // Some counties don't include "County" in the name field
      if (!entity.name.toLowerCase().includes('county')) {
        titles.push(`${entity.name} County, ${stateFull}`);
      }
      break;
    case 'township':
      // "Perry Township, Monroe County, Indiana" — but we don't have the county
      // so try with and without "Township"
      titles.push(`${entity.name}, ${stateFull}`);
      if (!entity.name.toLowerCase().includes('township')) {
        titles.push(`${entity.name} Township, ${stateFull}`);
      }
      break;
    case 'state':
      // State entities: use just the state name (e.g. "Indiana")
      titles.push(entity.name);
      titles.push(`${entity.name} (state)`);
      return titles; // return early � state fallback to stateFull would duplicate
    default:
      // city, town, school_district, library, etc.
      titles.push(`${entity.name}, ${stateFull}`);
      break;
  }

  // Fallback: just the state (for very small entities with no Wikipedia page)
  titles.push(stateFull);

  return titles;
}

/**
 * Try fetching an image URL from Wikipedia for a given article title.
 * Returns the image URL or null if not found.
 */
async function fetchWikiImage(title: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'));
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!resp.ok) return null;

    const data = await resp.json();
    // Prefer originalimage for higher resolution hero banners
    const url = data.originalimage?.source ?? data.thumbnail?.source ?? null;
    return url;
  } catch {
    return null;
  }
}

// ── Shared banner bucket (Empowered Vote org assets) ──

/** Public, unauthenticated Supabase Storage base for the shared banner library.
 *  Lives in the same Supabase project this app already uses. */
const BANNER_BASE =
  'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos';

/** All bucket banners are sourced from Wikimedia Commons under a free license
 *  (CC BY / CC BY-SA / CC0 / Public Domain). CC BY / CC BY-SA require visible
 *  attribution. Per-image title/author/license is available as a JSON export
 *  from the essentials registry — wire that in to upgrade this generic credit
 *  to per-image attribution. */
const WIKIMEDIA_CREDIT = 'Wikimedia Commons';

const toSlug = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '-');

/**
 * Cities with a curated banner at `cities/<slug>.jpg`, keyed "slug|STATE".
 * State-scoped so a shared slug (e.g. Glendale CA vs Glendale AZ) can't collide
 * onto the wrong city's image. Snapshot of the essentials CURATED_LOCAL catalog
 * as of 2026-07-05; the catalog only grows and never repurposes a slug, so a
 * stale snapshot under-covers (falls back to Wikipedia) but never mis-serves.
 * Legacy la_county/<geoid> entries (LA, Pomona, Torrance, Carson) are omitted
 * pending their migration to cities/ — they fall through to the Wikipedia path.
 */
const CURATED_CITY_BANNERS = new Set<string>([
  'bloomington|IN',
  'beaverton|OR', 'hillsboro|OR', 'tigard|OR', 'tualatin|OR', 'forest-grove|OR', 'sherwood|OR', 'cornelius|OR',
  'long-beach|CA', 'glendale|CA', 'pasadena|CA', 'west-covina|CA', 'downey|CA', 'burbank|CA', 'norwalk|CA',
]);

/** Build a shared-bucket banner URL for entities we know are covered, else null. */
function bucketBannerUrl(entity: Municipality): string | null {
  switch (entity.entity_type) {
    case 'federal':
      return `${BANNER_BASE}/national/us-capitol-banner-v2.jpg`;
    case 'state': {
      const abbr = entity.state.toUpperCase();
      // All 50 states are covered at states/<ABBR>.jpg.
      return STATE_NAMES[abbr] ? `${BANNER_BASE}/states/${abbr}.jpg` : null;
    }
    case 'nonprofit':
      return null;
    default: {
      const slug = toSlug(entity.name);
      return CURATED_CITY_BANNERS.has(`${slug}|${entity.state.toUpperCase()}`)
        ? `${BANNER_BASE}/cities/${slug}.jpg`
        : null;
    }
  }
}

/**
 * Resolve a hero banner for a municipality: DB override → shared bucket →
 * Wikipedia fallback → null. Caches the result per session.
 */
export async function getHeroImage(entity: Municipality): Promise<HeroImage | null> {
  // 1. Explicit per-entity override from the DB always wins.
  if (entity.hero_image_url) return { url: entity.hero_image_url, credit: null };

  // 2. Non-geographic entities have no place banner — gradient fallback.
  if (entity.entity_type === 'nonprofit') return null;

  const cacheKey = `${entity.name}|${entity.state}|${entity.entity_type}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  // 3. Prefer the org's curated, licensed shared-bucket banner.
  const bucketUrl = bucketBannerUrl(entity);
  if (bucketUrl) {
    const hero: HeroImage = { url: bucketUrl, credit: WIKIMEDIA_CREDIT };
    cache.set(cacheKey, hero);
    return hero;
  }

  // 4. Fallback: live Wikipedia lookup for places not yet in the bucket.
  const titles = buildSearchTitles(entity);
  for (const title of titles) {
    const url = await fetchWikiImage(title);
    if (url) {
      const hero: HeroImage = { url, credit: WIKIMEDIA_CREDIT };
      cache.set(cacheKey, hero);
      return hero;
    }
  }

  // No image found — cache null to avoid retrying.
  cache.set(cacheKey, null);
  return null;
}
