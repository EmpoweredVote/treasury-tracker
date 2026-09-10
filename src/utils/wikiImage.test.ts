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
  STATE_BANNER_CREDITS,
  STATE_BANNER_FILES,
  STATE_NAMES,
  FEDERAL_CREDIT,
} from './wikiImage';

const BUCKET = 'https://kxsdzaojfaibhuzmclfq.storage.supabase.co/storage/v1/object/public/politician_photos';

const entity = (name: string, state: string, entity_type = 'city'): Municipality =>
  ({ name, state, entity_type }) as Municipality;

describe('curated banner registry — every banner is attributed', () => {
  // The old "credit with no banner" and "filename override with no banner" orphan
  // checks are gone because they can no longer fail: one table means a banner cannot
  // exist without its credit, and a credit cannot outlive its banner.

  it('names an author in every credit — the generic string does not satisfy CC BY', () => {
    for (const [key, { credit }] of Object.entries(CURATED_CITY_BANNERS)) {
      expect(credit, key).toMatch(/via Wikimedia Commons$/);
      expect(credit, key).not.toBe('Wikimedia Commons');
      // "<author>, <licence>[, <modification>], via Wikimedia Commons".
      expect(credit.split(', ').length, key).toBeGreaterThanOrEqual(3);
      // The author slot must not hold a licence. This is not hypothetical: the
      // registry's columbus|GA line reads "<title> | CC BY-SA 4.0 | Wikimedia Commons",
      // and macon|GA reverses the same two fields. Transcribing either positionally
      // would publish "CC BY-SA 4.0" as the photographer.
      expect(credit.split(', ')[0], key).not.toMatch(/^(CC BY|CC0|public domain)/i);
    }
  });

  it('keys every banner as slug|STATE, so a shared slug cannot cross states', () => {
    for (const key of Object.keys(CURATED_CITY_BANNERS)) {
      expect(key, key).toMatch(/^[a-z0-9.\-]+\|[A-Z]{2}$/);
    }
  });

  it('gives no two places the same asset', () => {
    // Two keys resolving to one file is how a city ends up showing another city's
    // photograph under its own name — the tier-collision failure that moved the
    // Seattle, Portland, Austin and Miami frames down a level in the first place.
    const files = Object.entries(CURATED_CITY_BANNERS).map(
      ([key, b]) => b.file ?? `${key.split('|')[0]}.jpg`
    );
    expect(new Set(files).size).toBe(files.length);
  });

  it('overrides a filename only where the asset is not at cities/<slug>.jpg', () => {
    // A redundant override is dead weight that will outlive the reason for it.
    for (const [key, b] of Object.entries(CURATED_CITY_BANNERS)) {
      if (b.file) expect(b.file, key).not.toBe(`${key.split('|')[0]}.jpg`);
    }
  });

  it('holds the whole transcribed catalog, not a subset of it', () => {
    // 157 of the registry's 181 state-scoped variants. The 24 absent are listed in the
    // CURATED_CITY_BANNERS doc comment and every one is a missing AUTHOR or an
    // inexpressible legacy path — never a missing asset. If this number drops, someone
    // deleted coverage; if it rises without the doc comment moving, someone guessed.
    expect(Object.keys(CURATED_CITY_BANNERS)).toHaveLength(157);
  });

  it('excludes the banners the registry cannot attribute', () => {
    // 19 Utah "Wave 2" cities record no author at all ("Attribution in review notes"),
    // and columbus|GA puts its licence where the author belongs. Adding any of them
    // would render a CC BY image with nobody named.
    for (const slug of [
      'alpine', 'bluffdale', 'cedar-hills', 'cottonwood-heights', 'eagle-mountain',
      'herriman', 'lindon', 'mapleton', 'midvale', 'millcreek', 'payson',
      'pleasant-grove', 'salem', 'santaquin', 'saratoga-springs', 'south-jordan',
      'south-salt-lake', 'taylorsville', 'vineyard',
    ]) {
      expect(CURATED_CITY_BANNERS[`${slug}|UT`], slug).toBeUndefined();
    }
    expect(CURATED_CITY_BANNERS['columbus|GA']).toBeUndefined();
    expect(CURATED_CITY_BANNERS['macon|GA']?.credit).toBe(
      'Bubba73, CC BY-SA 3.0, via Wikimedia Commons'
    );
  });

  it('excludes the four CA cities still on the legacy la_county path', () => {
    // los angeles, pomona, torrance and carson live at
    // la_county/building_photos/<geoid>.jpg, which this builder cannot express, and the
    // registry carries no credit line for any of them. They stay on the Wikipedia path
    // until essentials migrates them to cities/ with attribution.
    for (const slug of ['los-angeles', 'pomona', 'torrance', 'carson']) {
      expect(CURATED_CITY_BANNERS[`${slug}|CA`], slug).toBeUndefined();
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
    const hero = await getHeroImage(entity('Virginia', 'VA', 'state'));
    expect(hero?.credit).toBe('Don.s.okeefe, CC BY-SA 3.0, brightened, via Wikimedia Commons');
  });

  it('credits Washington to the Hurricane Ridge photographer, not the Kerry Park one', async () => {
    // The state banner was RE-SHOT on 2026-08-14: states/WA.jpg was Daniel Schwen's
    // Kerry Park Seattle skyline, and that exact frame moved DOWN to cities/seattle.jpg
    // so the state and its largest city would not share one subject. Crediting WA to
    // Schwen now names the photographer of a different photo — one that is still in
    // the bucket, one tier below, which is why the stale credit looks plausible.
    const hero = await getHeroImage(entity('Washington', 'WA', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/WA.jpg`);
    expect(hero?.credit).toBe('Iamsridhar, CC BY-SA 3.0, via Wikimedia Commons');
    expect(hero?.credit).not.toContain('Daniel Schwen');
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

  it('has no filename override for a state that does not exist', () => {
    expect(Object.keys(STATE_BANNER_FILES).filter((a) => !STATE_NAMES[a])).toEqual([]);
  });

  it('keeps every versioned state filename under that state', () => {
    // A transposed entry (FL: 'TX-v2.jpg') would serve the wrong state's photograph
    // under the right state's credit — the misattribution this whole map exists to end,
    // and invisible to every other assertion here.
    for (const [abbr, file] of Object.entries(STATE_BANNER_FILES)) {
      expect(file, abbr).toMatch(new RegExp(`^${abbr}-v\\d+\\.jpg$`));
    }
  });

  it('serves Texas the Chisos frame credited to Tlshands, not the Austin photographer', async () => {
    // Essentials swapped the banner on 2026-08-18 and TT kept publishing Sk5893, whose
    // Austin skyline is now cities/austin.jpg. Same shape as the WA case above: the URL
    // never changed, so nothing failed — the credit just quietly became wrong about a
    // picture of mountains. Caught by Civic Spaces on 2026-09-10, confirmed against the
    // Commons File: page rather than the note.
    const hero = await getHeroImage(entity('Texas', 'TX', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/TX-v2.jpg`);
    expect(hero?.credit).toBe('Tlshands, CC BY-SA 3.0, via Wikimedia Commons');
    expect(hero?.credit).not.toContain('Sk5893');
  });

  it('serves Florida the Rookery Bay frame, so the state and Miami are not one photo', async () => {
    // states/FL.jpg still serves Euthman's Miami skyline — Euthman was never the wrong
    // credit for it. The defect was that Florida's banner and Miami's banner were the
    // same photograph, which is why essentials versioned rather than overwrote. The file
    // and the author move together or one of them is wrong.
    const hero = await getHeroImage(entity('Florida', 'FL', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/FL-v2.jpg`);
    expect(hero?.url).not.toMatch(/\/FL\.jpg$/);
    expect(hero?.credit).toBe('RW at RookeryBay, CC BY-SA 4.0, via Wikimedia Commons');
    expect(hero?.credit).not.toContain('Euthman');
  });

  it('serves California the re-cropped frame under the unchanged credit', async () => {
    // Same photograph, so Brocken Inaglory stays. Only the crop moved — the shipped one
    // put the Golden Gate above the visible 6:1 band.
    const hero = await getHeroImage(entity('California', 'CA', 'state'));
    expect(hero?.url).toBe(`${BUCKET}/states/CA-v2.jpg`);
    expect(hero?.credit).toBe('Brocken Inaglory, CC BY-SA 4.0, via Wikimedia Commons');
  });

  it('leaves the other 47 states on the unversioned path', () => {
    const versioned = new Set(Object.keys(STATE_BANNER_FILES));
    expect([...versioned].sort()).toEqual(['CA', 'FL', 'TX']);
    expect(Object.keys(STATE_NAMES).filter((a) => !versioned.has(a))).toHaveLength(47);
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

  it('serves Seattle WA from the bucket, credited to its author', async () => {
    const hero = await getHeroImage(entity('Seattle', 'WA'));
    expect(hero?.url).toBe(`${BUCKET}/cities/seattle.jpg`);
    expect(hero?.credit).toBe('Daniel Schwen, CC BY-SA 4.0, brightened, via Wikimedia Commons');
  });

  it('serves King County WA its own banner, not Seattle’s', async () => {
    // Snoqualmie Falls on purpose: the county must not read as the city sitting
    // inside it. Same failure shape as Dane County vs Madison.
    const hero = await getHeroImage(entity('King County', 'WA', 'county'));
    expect(hero?.url).toBe(`${BUCKET}/cities/king-county.jpg`);
    expect(hero?.url).not.toContain('seattle');
    expect(hero?.credit).toBe('Kpsudeep, CC BY-SA 4.0, brightened, via Wikimedia Commons');
  });

  it('serves Bainbridge Island and Kitsap County, whose assets arrived after the probe', async () => {
    // BANNER-01 probed on 2026-08-16 and recorded all twelve remaining WA entities as
    // NoSuchKey. Essentials uploaded these two the NEXT DAY, so the finding was stale
    // within 24 hours and TT sent both to the unlicensed Wikipedia path until
    // 2026-09-10. Re-probed then: both return 206.
    const bainbridge = await getHeroImage(entity('Bainbridge Island', 'WA'));
    expect(bainbridge?.url).toBe(`${BUCKET}/cities/bainbridge-island.jpg`);
    expect(bainbridge?.credit).toBe('Ecoscapes, CC BY-SA 4.0, via Wikimedia Commons');

    const kitsap = await getHeroImage(entity('Kitsap County', 'WA', 'county'));
    expect(kitsap?.url).toBe(`${BUCKET}/cities/kitsap-county.jpg`);
    expect(kitsap?.url).not.toContain('bremerton');
    expect(kitsap?.credit).toBe('Joe Mabel, CC BY-SA 4.0, via Wikimedia Commons');
  });

  it('leaves the ten still-uncovered WA entities on the fallback path, not a 404 URL', () => {
    // Re-probed 2026-09-10: these ten still return 400. Inventing a slug for them
    // would point a CSS background-image at that 400, and a background-image cannot
    // onerror-fallback.
    for (const slug of [
      'tacoma', 'spokane', 'vancouver', 'bellevue', 'kent', 'everett',
      'pierce-county', 'spokane-county', 'clark-county', 'snohomish-county',
    ]) {
      expect(CURATED_CITY_BANNERS[`${slug}|WA`], slug).toBeUndefined();
    }
  });

  it('resolves a county, not just cities — county banners live under cities/ too', async () => {
    const hero = await getHeroImage(entity('Dane County', 'WI', 'county'));
    expect(hero?.url).toBe(`${BUCKET}/cities/dane-county.jpg`);
    expect(hero?.credit).toBe('Corey Coyle, CC BY 3.0, via Wikimedia Commons');
  });

  it('slugifies multi-word names', async () => {
    const hero = await getHeroImage(entity('Long Beach', 'CA'));
    expect(hero?.url).toBe(`${BUCKET}/cities/long-beach.jpg`);
    expect(hero?.credit).toContain('Christophe.Finot');
  });

  it('is state-scoped, so a shared slug cannot serve the wrong city', () => {
    // Glendale CA is curated; Glendale AZ is not. The key carries the state.
    expect(CURATED_CITY_BANNERS['glendale|CA']).toBeDefined();
    expect(CURATED_CITY_BANNERS['glendale|AZ']).toBeUndefined();
  });

  // State + federal credits are asserted in their own block above.

  it('returns null for a nonprofit rather than a place banner', async () => {
    expect(await getHeroImage(entity('Empowered Vote', 'CA', 'nonprofit'))).toBeNull();
  });
});
