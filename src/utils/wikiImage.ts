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

/** Fallback credit for bucket banners with no per-image entry. All bucket banners
 *  are sourced from Wikimedia Commons under a free license (CC BY / CC BY-SA /
 *  CC0 / Public Domain); CC BY and CC BY-SA require naming the author, which this
 *  generic string does not do.
 *
 *  Every curated CITY banner now carries real attribution — see
 *  CURATED_CITY_CREDITS. This remains in use for the 50 state banners and the
 *  federal banner, whose credits have not been transcribed yet. */
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
export const CURATED_CITY_BANNERS = new Set<string>([
  'bloomington|IN',
  'beaverton|OR', 'hillsboro|OR', 'tigard|OR', 'tualatin|OR', 'forest-grove|OR', 'sherwood|OR', 'cornelius|OR',
  'long-beach|CA', 'glendale|CA', 'pasadena|CA', 'west-covina|CA', 'downey|CA', 'burbank|CA', 'norwalk|CA',
  // Added 2026-07-27 by essentials (`buildingImages.js`) — WI's first city banner.
  // Madison was falling through to the Wikipedia path while a curated asset sat unused.
  'madison|WI',
  // Bend's asset is versioned — see CURATED_CITY_FILES.
  'bend|OR',
]);

/**
 * Filename overrides for banners that are NOT at `cities/<slug>.jpg`, keyed
 * "slug|STATE". Essentials versions a filename when it re-crops an image, because
 * overwriting in place left a stale copy on the edge cache — the plain URL kept
 * serving the old file while a cache-busted request returned the new one.
 *
 * `cities/bend.jpg` happens to serve the current bytes again today (verified
 * 2026-07-28: plain and cache-busted requests both sha256 b2d7b7d3…, identical to
 * bend-v2.jpg). That is the CDN catching up, not a guarantee — and if essentials
 * re-crops to a v3, the slug URL would silently diverge from what they publish.
 * Point at the filename essentials designates as canonical instead.
 */
export const CURATED_CITY_FILES: Record<string, string> = {
  'bend|OR': 'bend-v2.jpg',
};

/**
 * Per-image attribution, keyed "slug|STATE". CC BY / CC BY-SA require naming the
 * author; the generic WIKIMEDIA_CREDIT does not, so an entry here is a licence
 * obligation, not a nicety. Every curated city banner is covered.
 *
 * Transcribed 2026-07-28 from the essentials banner registry (`src/lib/
 * buildingImages.js`), which is the operator-certified record of what was uploaded
 * to the shared bucket — one credit per asset, verbatim author and licence. These
 * were NOT re-verified against the Commons file pages; the registry is the source
 * of truth for what is actually in the bucket, and second-guessing it from memory
 * would be how a wrong author gets published.
 *
 * CC0 / public-domain entries are listed too. Attribution is not required for those,
 * but naming the author is accurate and free — and a blank entry would read as
 * "unknown" rather than "no obligation".
 *
 * Anything absent still falls back to WIKIMEDIA_CREDIT. State (50) and federal
 * banners remain on the generic string — a separate, larger registry.
 */
export const CURATED_CITY_CREDITS: Record<string, string> = {
  'bloomington|IN': 'Yahala, CC BY-SA 3.0, via Wikimedia Commons',

  'beaverton|OR': 'M.O. Stevens, CC BY 3.0, via Wikimedia Commons',
  'bend|OR': 'Spencer Dahl, CC BY-SA 3.0, via Wikimedia Commons',
  'cornelius|OR': 'M.O. Stevens, CC BY-SA 3.0, via Wikimedia Commons',
  'forest-grove|OR': 'Visitor7, CC BY-SA 3.0, via Wikimedia Commons',
  'hillsboro|OR': 'Steve Morgan, CC BY-SA 4.0, via Wikimedia Commons',
  'sherwood|OR': 'dreid1987, CC BY 3.0, via Wikimedia Commons',
  'tigard|OR': 'M.O. Stevens (Aboutmovies), public domain, via Wikimedia Commons',
  'tualatin|OR': 'M.O. Stevens (Aboutmovies), CC BY-SA 3.0, via Wikimedia Commons',

  'burbank|CA': 'Natecation, CC BY-SA 4.0, via Wikimedia Commons',
  'downey|CA': 'Northwalker, CC0, via Wikimedia Commons',
  'glendale|CA': 'KeeganProbably, CC BY 4.0, via Wikimedia Commons',
  'long-beach|CA': 'Christophe.Finot, CC BY-SA 2.5, via Wikimedia Commons',
  'norwalk|CA': 'Northwalker, CC0, via Wikimedia Commons',
  'pasadena|CA': 'RBerteig, CC BY 2.0, via Wikimedia Commons',
  'west-covina|CA': 'ASDFGH, CC BY-SA 4.0, via Wikimedia Commons',

  'madison|WI': 'John Benson, CC BY 2.5, via Wikimedia Commons',
};

/** Build a shared-bucket banner for entities we know are covered, else null.
 *  Returns the credit alongside the URL so per-image attribution can override the
 *  generic one — the two must be chosen together or a banner can be shown under the
 *  wrong author. */
function bucketBanner(entity: Municipality): HeroImage | null {
  switch (entity.entity_type) {
    case 'federal':
      return { url: `${BANNER_BASE}/national/us-capitol-banner-v2.jpg`, credit: WIKIMEDIA_CREDIT };
    case 'state': {
      const abbr = entity.state.toUpperCase();
      // All 50 states are covered at states/<ABBR>.jpg.
      return STATE_NAMES[abbr]
        ? { url: `${BANNER_BASE}/states/${abbr}.jpg`, credit: WIKIMEDIA_CREDIT }
        : null;
    }
    case 'nonprofit':
      return null;
    default: {
      const slug = toSlug(entity.name);
      const key = `${slug}|${entity.state.toUpperCase()}`;
      if (!CURATED_CITY_BANNERS.has(key)) return null;
      const file = CURATED_CITY_FILES[key] ?? `${slug}.jpg`;
      return {
        url: `${BANNER_BASE}/cities/${file}`,
        credit: CURATED_CITY_CREDITS[key] ?? WIKIMEDIA_CREDIT,
      };
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
  const bucketHero = bucketBanner(entity);
  if (bucketHero) {
    cache.set(cacheKey, bucketHero);
    return bucketHero;
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
