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

  it('falls back to the generic credit for state banners', async () => {
    const hero = await getHeroImage(entity('Wisconsin', 'WI', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/WI.jpg`);
    expect(hero?.credit).toBe('Wikimedia Commons');
  });

  it('returns null for a nonprofit rather than a place banner', async () => {
    expect(await getHeroImage(entity('Empowered Vote', 'CA', 'nonprofit'))).toBeNull();
  });
});
