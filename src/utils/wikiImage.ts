/**
 * Fetch a representative image for a municipality from Wikipedia.
 *
 * Uses the Wikipedia REST API /page/summary endpoint which returns
 * an "originalimage" or "thumbnail" for most municipality articles.
 *
 * Results are cached in-memory so each entity is fetched at most once
 * per session.
 */

import type { Municipality } from '../types/budget';

const cache = new Map<string, string | null>();

/** State abbreviation → full name for Wikipedia article titles */
const STATE_NAMES: Record<string, string> = {
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
 * Build candidate Wikipedia article titles for a municipality.
 * Wikipedia uses different naming conventions depending on entity type:
 *   City: "Bloomington, Indiana"
 *   County: "Monroe County, Indiana"
 *   Township: "Perry Township, Monroe County, Indiana"
 */
function buildSearchTitles(entity: Municipality): string[] {
  const stateFull = STATE_NAMES[entity.state.toUpperCase()] ?? entity.state;
  const titles: string[] = [];

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

/**
 * Get a hero image URL for a municipality. Tries multiple Wikipedia
 * article title variants and caches the result.
 */
export async function getHeroImage(entity: Municipality): Promise<string | null> {
  // Return from DB if set
  if (entity.hero_image_url) return entity.hero_image_url;

  const cacheKey = `${entity.name}|${entity.state}|${entity.entity_type}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const titles = buildSearchTitles(entity);

  for (const title of titles) {
    const url = await fetchWikiImage(title);
    if (url) {
      cache.set(cacheKey, url);
      return url;
    }
  }

  // No image found — cache null to avoid retrying
  cache.set(cacheKey, null);
  return null;
}
