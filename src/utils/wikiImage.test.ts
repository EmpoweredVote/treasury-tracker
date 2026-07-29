/**
 * Tests for the shared-bucket banner resolution in wikiImage.ts.
 *
 * The point of these is the pairing. A banner URL and its credit are chosen from
 * the same lookup on purpose: CC BY / CC BY-SA require naming the author, so a
 * banner that resolves without its credit is a licence problem, and a credit that
 * drifts onto the wrong slug publishes the wrong author. Both failure modes are
 * silent in the UI, so they are asserted here instead.
 *
 * Only bucket hits are exercised — those return before any network call, so these
 * tests never touch Wikipedia.
 */

import { describe, it, expect } from 'vitest';
import type { Municipality } from '../types/budget';
import {
  getHeroImage,
  CURATED_CITY_BANNERS,
  CURATED_CITY_CREDITS,
  CURATED_CITY_FILES,
  STATE_BANNER_CREDITS,
  STATE_NAMES,
  FEDERAL_CREDIT,
} from './wikiImage';

const BUCKET = 'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos';

const entity = (name: string, state: string, entity_type = 'city'): Municipality =>
  ({ name, state, entity_type }) as Municipality;

describe('curated banner registry — every banner is attributed', () => {
  it('has a credit for every curated banner', () => {
    const missing = [...CURATED_CITY_BANNERS].filter((k) => !CURATED_CITY_CREDITS[k]);
    expect(missing).toEqual([]);
  });

  it('has no credit for a banner that does not exist', () => {
    const orphans = Object.keys(CURATED_CITY_CREDITS).filter((k) => !CURATED_CITY_BANNERS.has(k));
    expect(orphans).toEqual([]);
  });

  it('has no filename override for a banner that does not exist', () => {
    const orphans = Object.keys(CURATED_CITY_FILES).filter((k) => !CURATED_CITY_BANNERS.has(k));
    expect(orphans).toEqual([]);
  });

  it('names an author in every credit — the generic string does not satisfy CC BY', () => {
    for (const [key, credit] of Object.entries(CURATED_CITY_CREDITS)) {
      expect(credit, key).toMatch(/via Wikimedia Commons$/);
      expect(credit, key).not.toBe('Wikimedia Commons');
      // "<author>, <licence>, via Wikimedia Commons" — three parts, author non-empty.
      expect(credit.split(', ').length, key).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('state + federal banner attribution', () => {
  /** Empty since RI was resolved against Commons on 2026-07-28. Kept as the
   *  mechanism for a future banner whose author genuinely cannot be established —
   *  a subset check, so adding one does not mean rewriting the assertions. */
  const KNOWN_UNCREDITED = new Set<string>([]);

  it('credits every state banner', () => {
    const missing = Object.keys(STATE_NAMES).filter((a) => !STATE_BANNER_CREDITS[a]);
    expect(missing.filter((a) => !KNOWN_UNCREDITED.has(a))).toEqual([]);
  });

  it('covers all 50 states between credited and knowingly-uncredited', () => {
    expect(Object.keys(STATE_NAMES)).toHaveLength(50);
    expect(Object.keys(STATE_BANNER_CREDITS).length + KNOWN_UNCREDITED.size).toBe(50);
  });

  it('has no credit for a state that does not exist', () => {
    expect(Object.keys(STATE_BANNER_CREDITS).filter((a) => !STATE_NAMES[a])).toEqual([]);
  });

  it('never prints a Commons filename as an author', () => {
    for (const [abbr, credit] of Object.entries(STATE_BANNER_CREDITS)) {
      // The RI failure mode: the whole author field is a parenthesised filename.
      // Not an underscore check — `w_lemay` (MN) is a real Commons username.
      expect(credit, abbr).not.toMatch(/^\(/);
      expect(credit, abbr).toMatch(/via Wikimedia Commons$/);
    }
  });

  it('serves Wisconsin credited to its author', async () => {
    const hero = await getHeroImage(entity('Wisconsin', 'WI', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/WI.jpg`);
    expect(hero?.credit).toBe('Dori, CC BY-SA 3.0 US, via Wikimedia Commons');
  });

  it('discloses the brightness lift where the registry records one', async () => {
    const hero = await getHeroImage(entity('Washington', 'WA', 'state'));
    expect(hero?.credit).toBe('Daniel Schwen, CC BY-SA 4.0, brightened, via Wikimedia Commons');
  });

  it('credits Rhode Island to boliyou, not the same-but-for-a-comma Soloviev file', async () => {
    // "Providence, RI skyline.jpg" (boliyou, CC BY-SA 2.0) is the bucket image;
    // "Providence RI skyline.jpg" (Quintin Soloviev, CC BY 4.0) is a different photo.
    // Verified by image comparison, not by name similarity — see STATE_BANNER_CREDITS.
    const hero = await getHeroImage(entity('Rhode Island', 'RI', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/RI.jpg`);
    expect(hero?.credit).toBe('boliyou, CC BY-SA 2.0, via Wikimedia Commons');
    expect(hero?.credit).not.toContain('Soloviev');
  });

  it('leaves no banner on the generic credit', async () => {
    for (const abbr of Object.keys(STATE_NAMES)) {
      const hero = await getHeroImage(entity(STATE_NAMES[abbr], abbr, 'state'));
      expect(hero?.credit, abbr).not.toBe('Wikimedia Commons');
    }
  });

  it('credits the federal banner and discloses the edit', async () => {
    const hero = await getHeroImage(entity('United States', 'US', 'federal'));
    expect(hero?.url).toBe(`${BUCKET}/national/us-capitol-banner-v2.jpg`);
    expect(hero?.credit).toBe(FEDERAL_CREDIT);
    expect(hero?.credit).toContain('DiscoA340');
    expect(hero?.credit).toContain('leveled and cropped');
  });
});

describe('getHeroImage — bucket resolution', () => {
  it('serves Madison WI from the bucket, credited to its author', async () => {
    const hero = await getHeroImage(entity('Madison', 'WI'));
    expect(hero?.url).toBe(`${BUCKET}/cities/madison.jpg`);
    expect(hero?.credit).toBe('John Benson, CC BY 2.5, via Wikimedia Commons');
  });

  it('honours the versioned filename for Bend OR rather than the slug', async () => {
    const hero = await getHeroImage(entity('Bend', 'OR'));
    expect(hero?.url).toBe(`${BUCKET}/cities/bend-v2.jpg`);
    expect(hero?.url).not.toContain('/bend.jpg');
    expect(hero?.credit).toBe('Spencer Dahl, CC BY-SA 3.0, via Wikimedia Commons');
  });

  it('slugifies multi-word names', async () => {
    const hero = await getHeroImage(entity('Long Beach', 'CA'));
    expect(hero?.url).toBe(`${BUCKET}/cities/long-beach.jpg`);
    expect(hero?.credit).toContain('Christophe.Finot');
  });

  it('is state-scoped, so a shared slug cannot serve the wrong city', () => {
    // Glendale CA is curated; Glendale AZ is not. The key carries the state.
    expect(CURATED_CITY_BANNERS.has('glendale|CA')).toBe(true);
    expect(CURATED_CITY_BANNERS.has('glendale|AZ')).toBe(false);
  });

  // State + federal credits are asserted in their own block above.

  it('returns null for a nonprofit rather than a place banner', async () => {
    expect(await getHeroImage(entity('Empowered Vote', 'CA', 'nonprofit'))).toBeNull();
  });
});
