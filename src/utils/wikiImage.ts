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

/** Last-resort credit for a bucket banner with no per-image entry. CC BY and
 *  CC BY-SA require naming the author, which this generic string does not do, so
 *  reaching it is a gap rather than a normal outcome.
 *
 *  Nothing reaches it today: every city banner, all 50 state banners and the
 *  federal banner carry a named author. It stays as the safe default for a banner
 *  added without one — a vague credit beats a wrong one. */
const WIKIMEDIA_CREDIT = 'Wikimedia Commons';

/** Attribution for the federal banner.
 *  Registry: "Panorama at the Capitol Reflecting Pool (September 2023) 02". The
 *  operator levelled it 0.6° and cropped to 1700x540, so the modification is
 *  disclosed — CC BY-SA asks that adaptations be indicated. */
export const FEDERAL_CREDIT = 'DiscoA340, CC BY-SA 4.0, leveled and cropped, via Wikimedia Commons';

/**
 * Per-state attribution for the state banner — `states/<ABBR>.jpg` unless
 * STATE_BANNER_FILES versions it. Transcribed 2026-07-28 from the essentials banner
 * registry (`src/lib/buildingImages.js`), same provenance rule as CURATED_CITY_BANNERS:
 * verbatim author and licence, never reconstructed.
 *
 * ⚠ THIS TABLE IS A SNAPSHOT AND SNAPSHOTS DRIFT. It has now gone stale twice — WA on
 * 2026-08-16, TX on 2026-09-10 — and both times it published the wrong photographer,
 * because a swap is silent by construction: the URL does not change, so no test,
 * typecheck or 404 can see it. Both were caught by someone re-reading the registry for
 * an unrelated reason. Civic Spaces found the TX one while regenerating its own table
 * and warned us off porting theirs for the same reason. There is no substitute for
 * re-reading a state's registry line before trusting the credit here, and any state
 * whose banner has moved needs its STATE_BANNER_FILES entry checked in the same pass.
 *
 * Five entries the registry marks as brightness-lifted (CT, IL, KY, VA, WA) say so
 * — CC BY / CC BY-SA ask that modifications be indicated. Every banner is also
 * cropped to the panoramic frame; that is inherent to the format and not called out
 * per-image.
 *
 * RHODE ISLAND was resolved against Commons on 2026-07-28 rather than transcribed:
 * its registry line had the Commons *filename* where the author belongs. Two files
 * differ by one comma —
 *   "Providence RI skyline.jpg"   Quintin Soloviev, CC BY 4.0     (aerial, winter)
 *   "Providence, RI skyline.jpg"  boliyou,          CC BY-SA 2.0  (river level, summer)
 * — so a plausible guess had even odds of crediting the wrong photographer. The
 * bucket image was matched to the file: mean abs difference per channel 6.63 against
 * boliyou (crop + recompression) versus 45.38 against Soloviev. The registry's title
 * and licence pointed at boliyou too; only the author field was wrong.
 */
export const STATE_BANNER_CREDITS: Record<string, string> = {
  AK: 'Paxson Woelber, CC BY 2.0, via Wikimedia Commons',
  AL: 'WeaponizingArchitecture, CC BY-SA 4.0, via Wikimedia Commons',
  AR: 'Daniel Schwen, CC BY-SA 4.0, via Wikimedia Commons',
  AZ: 'DPPed, CC BY-SA 3.0, via Wikimedia Commons',
  // UNCHANGED on 2026-09-10, deliberately. California was re-cropped on 2026-09-09 to
  // states/CA-v2.jpg, but from the SAME photograph, so this line stays exactly as it
  // was — see STATE_BANNER_FILES.CA for why the file moved. Re-confirmed anyway rather
  // than assumed: "File:Pano of Golden Gate Bridge and San Francisco from Twin Peaks 1
  // 1.jpg" — Brocken Inaglory, CC BY-SA 4.0, 10000x3245, the source size the registry
  // records, matched to CA-v2 at mean abs difference 6.79 per channel using the exact
  // frame the registry documents (x 0-5900, y 0-1874).
  CA: 'Brocken Inaglory, CC BY-SA 4.0, via Wikimedia Commons',
  CO: 'Quintin Soloviev, CC BY 4.0, via Wikimedia Commons',
  CT: 'KyleConstable, CC BY-SA 4.0, brightened, via Wikimedia Commons',
  DE: 'Tim Kiser, CC BY-SA 2.5, via Wikimedia Commons',
  // Re-transcribed 2026-09-10 TOGETHER WITH the STATE_BANNER_FILES entry — this credit
  // was NOT wrong before, and changing it alone would have made it wrong. Essentials
  // versioned Florida on 2026-08-30 *without* overwriting, so states/FL.jpg still
  // serves Euthman's Miami skyline and 'Euthman, CC BY 4.0' was honest for it. What
  // TT had was the older arrangement: that skyline is also Miami's own city banner, so
  // Florida's state page and Miami's city page were the same photograph. Essentials
  // moved the skyline down to cities/miami.jpg and gave the state a frame that stands
  // for the whole state. Pointing at FL-v2.jpg changes the image, so the author changes
  // with it, in the same commit.
  //
  // Verified 2026-09-10: states/FL.jpg is sha256 870112b7…/235,610 b (Miami) and
  // states/FL-v2.jpg is 58524f94…/137,011 b (Rookery Bay) — genuinely different objects,
  // unlike TX. Author established on Commons: "File:Aerial view of an island in Rookery
  // Bay.jpg" — RW at RookeryBay, CC BY-SA 4.0, matched to FL-v2 at mean abs difference
  // 1.44 per channel on a centred vertical crop.
  FL: 'RW at RookeryBay, CC BY-SA 4.0, via Wikimedia Commons',
  GA: 'Marc Merlin, CC BY-SA 4.0, via Wikimedia Commons',
  HI: 'Cristo Vlahos, CC BY-SA 3.0, via Wikimedia Commons',
  IA: 'Tony Webster, CC BY 2.0, via Wikimedia Commons',
  ID: 'Tamanoeconomico, CC BY-SA 4.0, via Wikimedia Commons',
  IL: 'King of Hearts, CC BY-SA 3.0, brightened, via Wikimedia Commons',
  IN: 'Momoneymoproblemz, CC BY-SA 4.0, via Wikimedia Commons',
  KS: 'Quintin Soloviev, CC BY 4.0, via Wikimedia Commons',
  KY: 'Anindya Chakraborty, CC BY-SA 3.0, brightened, via Wikimedia Commons',
  LA: 'Michael Maples (USACE), public domain, via Wikimedia Commons',
  MA: 'King of Hearts, CC BY-SA 4.0, via Wikimedia Commons',
  MD: 'Quintin Soloviev, CC BY 4.0, via Wikimedia Commons',
  ME: 'Kristen Wheatley, CC BY 2.0, via Wikimedia Commons',
  MI: 'TheWxResearcher, CC0, via Wikimedia Commons',
  MN: 'w_lemay, CC BY-SA 2.0, via Wikimedia Commons',
  MO: 'Buphoff, CC BY-SA 3.0, via Wikimedia Commons',
  MS: 'chmeredith, CC BY 2.0, via Wikimedia Commons',
  MT: 'TerryDOtt, CC BY 2.0, via Wikimedia Commons',
  NC: 'Bruce Emmerling, CC BY-SA 4.0, via Wikimedia Commons',
  ND: 'Acroterion, CC BY-SA 4.0, via Wikimedia Commons',
  NE: 'SounderBruce, CC BY-SA 4.0, via Wikimedia Commons',
  NH: 'YubYub41, CC BY-SA 3.0, via Wikimedia Commons',
  NJ: 'King of Hearts, CC BY-SA 4.0, via Wikimedia Commons',
  NM: 'Daniel Schwen, CC BY-SA 4.0, via Wikimedia Commons',
  NV: 'Paul Harrison, CC BY-SA 4.0, via Wikimedia Commons',
  NY: 'King of Hearts, CC BY-SA 4.0, via Wikimedia Commons',
  OH: 'Ynsalh, CC BY-SA 4.0, via Wikimedia Commons',
  OK: 'Soonerfever, public domain, via Wikimedia Commons',
  OR: "Oregon's Mt. Hood Territory, public domain, via Wikimedia Commons",
  PA: 'Cbaile19, CC0, via Wikimedia Commons',
  RI: 'boliyou, CC BY-SA 2.0, via Wikimedia Commons',
  SC: 'bbatsell, CC BY-SA 2.5, via Wikimedia Commons',
  SD: 'Nick Amoscato, CC BY 2.0, via Wikimedia Commons',
  TN: 'Kaldari, public domain, via Wikimedia Commons',
  // Re-transcribed 2026-09-10: this line was STALE and published the wrong author,
  // caught by Civic Spaces regenerating its own credit table from the registry.
  // Essentials replaced the Texas banner on 2026-08-18 ("Chisos Mountains, Big Bend
  // National Park | Tlshands | CC BY-SA 3.0") because states/TX.jpg had been a
  // photograph of Austin, so the state and its capital shared one subject. Sk5893's
  // Austin skyline moved DOWN to cities/austin.jpg. Identical shape to the WA swap
  // below, and it published the same way: the URL never changed, so nothing failed.
  //
  // The swap was versioned to states/TX-v2.jpg, but the in-place overwrite of the
  // plain path also propagated eventually — so TT was already serving the Chisos
  // frame under Sk5893's name. Confirmed 2026-09-10, not taken from the note:
  // states/TX.jpg and states/TX-v2.jpg are both sha256 b23ea801…/205,609 b (plain
  // and cache-busted alike), and the image is mountains, not a skyline.
  //
  // Author established on the Commons File: page rather than transcribed, per the RI
  // precedent. "File:Chisos Mountains, Big Bend National Park.jpg" — Tlshands,
  // CC BY-SA 3.0, 16618x3456, which is the source size the registry records. Matched
  // to the bucket image by pixel comparison: mean abs difference per channel 3.80 for
  // the centred crop (and an anchor sweep bottoms out at exactly 0.50, the centring
  // the registry documents) versus 49.95 against cities/austin.jpg.
  TX: 'Tlshands, CC BY-SA 3.0, via Wikimedia Commons',
  UT: 'Invictus323, CC BY 4.0, via Wikimedia Commons',
  VA: 'Don.s.okeefe, CC BY-SA 3.0, brightened, via Wikimedia Commons',
  VT: 'chensiyuan, CC BY-SA 4.0, via Wikimedia Commons',
  // Re-transcribed 2026-08-16: this line was STALE and published the wrong author.
  // Essentials re-shot the state banner on 2026-08-14 ("Hurricane Ridge, Olympic
  // National Park | Iamsridhar | CC BY-SA 3.0") because states/WA.jpg had been a
  // photograph of Seattle, so the state and its largest city shared one subject.
  // Daniel Schwen's Kerry Park frame moved DOWN to cities/seattle.jpg, where it is
  // still credited to him — which is why the stale line looked plausible: the
  // author was right, for the other tier. No [brightened] tag on the new line.
  WA: 'Iamsridhar, CC BY-SA 3.0, via Wikimedia Commons',
  WI: 'Dori, CC BY-SA 3.0 US, via Wikimedia Commons',
  WV: 'Gabor Eszes (UED77), CC BY-SA 3.0, via Wikimedia Commons',
  WY: 'GrandTetonNPS, public domain, via Wikimedia Commons',
};

/**
 * States whose banner is NOT at `states/<ABBR>.jpg`, mirroring the essentials registry's
 * `STATE_PANORAMA_FILES`. The city tier has had a filename override since Bend, and the
 * federal banner has been `us-capitol-banner-v2.jpg` for longer than that; the state tier
 * simply never got the same treatment, because its URL was built as `${abbr}.jpg` with no
 * way to express a version. That gap is what let CA, FL and TX all point at objects
 * essentials had superseded and deliberately left in place.
 *
 * WHY VERSIONED FILENAMES EXIST AT ALL: replacing a banner by overwriting the object does
 * not reliably purge the CDN. Essentials measured this on Texas — seconds after the
 * upload, the plain URL still returned the old Austin skyline while `?v=` returned the new
 * Chisos frame. So a consumer on the plain path serves the old picture for an unknown
 * period, and then, with no action from anyone, starts serving the new one. Texas is the
 * proof in both directions: it has now caught up, which is exactly why the stale credit
 * became a live misattribution instead of merely a stale-looking page.
 *
 * ⚠ THE CORRECT ENTRY HERE CANNOT BE INFERRED FROM THE BUCKET. TX-v2.jpg is byte-identical
 * to TX.jpg today, so probing would say "no override needed" — and would be wrong the next
 * time essentials ships a v3. Read `STATE_PANORAMA_FILES` in the essentials registry; it is
 * the authoritative list. Transcribed 2026-09-10.
 *
 * ⚠ AND A FILENAME IS HALF THE CHANGE. FL-v2 is a different photograph by a different
 * author, so its STATE_BANNER_CREDITS line had to move with it. Never add an entry here
 * without re-reading that state's registry credit line in the same edit.
 */
export const STATE_BANNER_FILES: Record<string, string> = {
  // Re-cropped 2026-09-09 from the same Brocken Inaglory photograph — not a new image and
  // not an adjacency swap. The shipped frame failed essentials' own 6:1 desktop band: the
  // Golden Gate towers, Marin and the bay all sat above the visible window, leaving an
  // anonymous field of rooftops on an asset whose credit names the bridge as its subject.
  // Cosmetic rather than a licence problem, which is why TT served the rejected frame for
  // a day without anything being detectably wrong. Credit is unchanged.
  CA: 'CA-v2.jpg',
  // Versioned 2026-08-30, and the one entry here that changes what a reader sees AND who
  // is credited: Euthman's Miami skyline moved down to cities/miami.jpg and the state got
  // a Rookery Bay aerial by RW at RookeryBay. states/FL.jpg still serves the skyline, so
  // TT's old credit was honest — it was the adjacency that was stale, with Florida and
  // Miami showing the same photograph.
  FL: 'FL-v2.jpg',
  // Versioned 2026-08-18 when the Austin skyline became the Chisos Mountains. Points at
  // the same bytes the plain path serves today; the entry is here so it keeps pointing at
  // what essentials publishes if there is ever a TX-v3.
  TX: 'TX-v2.jpg',
};

const toSlug = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '-');

/**
 * Every curated place banner in the shared bucket, keyed "slug|STATE" — one entry
 * per banner carrying BOTH its filename and its credit.
 *
 * ONE TABLE ON PURPOSE. This was three parallel structures (a Set of covered keys,
 * a filename-override map and a credit map) that had to be edited in lockstep, which
 * is survivable at 20 entries and is how the next silent drift happens at 157. Here a
 * banner cannot exist without a credit, and a credit cannot outlive its banner, by
 * construction rather than by assertion.
 *
 * State-scoped so a shared slug (Glendale CA vs Glendale AZ, Portland OR vs Portland
 * ME, Springfield MA vs Springfield MO) can never serve the wrong city's photograph.
 * `file` is present only where the asset is NOT at `cities/<slug>.jpg`; essentials
 * versions or disambiguates a filename rather than overwriting, because an in-place
 * overwrite does not reliably purge the CDN.
 *
 * ── PROVENANCE ──────────────────────────────────────────────────────────────────
 * Transcribed 2026-09-10 from the essentials banner registry (`src/lib/
 * buildingImages.js`, `CURATED_LOCAL` + the credit comment blocks above it), which is
 * the operator-certified record of what was uploaded. Verbatim author and licence,
 * never reconstructed and never inferred from a filename — TT renders these lines as
 * public credits, so an error here is a wrong author on our site.
 *
 * Every one of the 157 assets was HEAD-probed on 2026-09-10 and returned 200/206, and
 * no two keys share a file. Never add a key ahead of an asset: a CSS background-image
 * pointed at a 400 cannot onerror-fallback.
 *
 * Re-deriving the table independently reproduced all 22 previously-published credits
 * unchanged, which is the main evidence the transcription is faithful.
 *
 * ── TWO NORMALISATIONS, both of source-notes rather than names ──────────────────
 * The registry writes two authors with a provenance note attached: "Wikimedia user
 * ASDFGH" (West Covina) and "Rgper22008 (Wikimedia Commons)" (South Tucson). The note
 * is dropped because this credit already ends in "via Wikimedia Commons"; the name is
 * untouched.
 *
 * ── MODIFICATIONS ARE DISCLOSED ─────────────────────────────────────────────────
 * CC BY / CC BY-SA ask that adaptations be indicated, so where the registry records an
 * edit it is carried into the credit: brightened (Seattle, King County, Union Grove),
 * leveled (Newton, Lynn) and both (San Diego). Cropping to the panoramic frame is
 * inherent to the format and is not called out per-image.
 *
 * ── WHAT IS DELIBERATELY ABSENT ─────────────────────────────────────────────────
 * 24 of the registry's 181 state-scoped variants are NOT here, none of them for want
 * of an asset:
 *
 *   19 Utah "Wave 2" cities (alpine, bluffdale, cedar hills, cottonwood heights,
 *      eagle mountain, herriman, lindon, mapleton, midvale, millcreek, payson,
 *      pleasant grove, salem, santaquin, saratoga springs, south jordan, south salt
 *      lake, taylorsville, vineyard) — the registry records no author for any of
 *      them, only "Attribution in review notes", and those notes are not in the repo.
 *      A CC BY image shown without its author is a licence breach, and the generic
 *      WIKIMEDIA_CREDIT does not name anyone. None is a TT entity today.
 *
 *   columbus|GA — its registry line is "<title> | CC BY-SA 4.0 | Wikimedia Commons",
 *      which puts the LICENCE in the author slot and records no author at all. Not a
 *      TT entity today. (macon|GA has the same reversed field order but its author is
 *      still recoverable — see the Georgia block.)
 *
 *   los angeles, pomona, torrance, carson (all CA) — still on the legacy
 *      `la_county/building_photos/<geoid>.jpg` path, which this builder cannot express
 *      and for which the registry carries no credit line at all. These four ARE TT
 *      entities, so they keep falling through to the Wikipedia path until essentials
 *      migrates them to `cities/` with attribution.
 */
export interface CuratedBanner {
  /** Only when the asset is not at `cities/<slug>.jpg`. */
  file?: string;
  credit: string;
}

export const CURATED_CITY_BANNERS: Record<string, CuratedBanner> = {
  // Arizona (6)
  'marana|AZ':       { credit: 'Bernard Gagnon, CC BY-SA 3.0, via Wikimedia Commons' },
  'oro-valley|AZ':   { credit: 'Djmaschek, CC BY-SA 3.0, via Wikimedia Commons' },
  'pima-county|AZ':  { credit: 'WClarke, CC BY-SA 4.0, via Wikimedia Commons' },
  'sahuarita|AZ':    { credit: 'Brian Basgen, CC BY-SA 3.0, via Wikimedia Commons' },
  'south-tucson|AZ': { credit: 'Rgper22008, public domain, via Wikimedia Commons' },
  'tucson|AZ':       { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },

  // California (35)
  'alhambra|CA':         { credit: 'Sony 1992, CC0, via Wikimedia Commons' },
  'bellflower|CA':       { credit: 'YonderStone, CC BY-SA 4.0, via Wikimedia Commons' },
  'berkeley|CA':         { credit: '4300streetcar, CC BY 4.0, via Wikimedia Commons' },
  'beverly-hills|CA':    { credit: 'Jess Hawsor, CC BY-SA 4.0, via Wikimedia Commons' },
  'burbank|CA':          { credit: 'Natecation, CC BY-SA 4.0, via Wikimedia Commons' },
  'compton|CA':          { credit: 'Eric Polk, CC BY 3.0, via Wikimedia Commons' },
  'culver-city|CA':      { credit: 'John Margolies / Library of Congress, public domain, via Wikimedia Commons' },
  'downey|CA':           { credit: 'Northwalker, CC0, via Wikimedia Commons' },
  'el-monte|CA':         { credit: 'Oran Viriyincy, CC BY-SA 2.0, via Wikimedia Commons' },
  'el-segundo|CA':       { credit: 'Caterpillar84, CC BY-SA 4.0, via Wikimedia Commons' },
  'fremont|CA':          { credit: 'Oleg Alexandrov, CC BY-SA 3.0, via Wikimedia Commons' },
  'gardena|CA':          { credit: 'Jengod, CC BY-SA 4.0, via Wikimedia Commons' },
  'glendale|CA':         { credit: 'KeeganProbably, CC BY 4.0, via Wikimedia Commons' },
  'hawthorne|CA':        { credit: 'Juan Kulichevsky, CC BY-SA 2.0, via Wikimedia Commons' },
  'indio|CA':            { credit: 'Northwalker, CC0, via Wikimedia Commons' },
  'inglewood|CA':        { credit: 'Troutfarm27, CC BY-SA 4.0, via Wikimedia Commons' },
  'lancaster|CA':        { credit: 'Rennett Stowe, CC BY 2.0, via Wikimedia Commons' },
  'long-beach|CA':       { credit: 'Christophe.Finot, CC BY-SA 2.5, via Wikimedia Commons' },
  'norwalk|CA':          { credit: 'Northwalker, CC0, via Wikimedia Commons' },
  'palm-springs|CA':     { credit: 'R. Haupt (Renhau), CC BY-SA 3.0, via Wikimedia Commons' },
  'palmdale|CA':         { credit: 'G-BDXH, CC0, via Wikimedia Commons' },
  'pasadena|CA':         { credit: 'RBerteig, CC BY 2.0, via Wikimedia Commons' },
  'riverside|CA':        { credit: 'John Margolies, public domain, via Wikimedia Commons' },
  'riverside-county|CA': { credit: 'Maliagould, CC BY-SA 4.0, via Wikimedia Commons' },
  'sacramento|CA':       { credit: 'Sydchrismom, CC BY-SA 4.0, via Wikimedia Commons' },
  'san-diego|CA':        { credit: 'Mds08011, CC BY 4.0, leveled and brightened, via Wikimedia Commons' },
  'san-francisco|CA':    { credit: 'Dead.rabbit, CC BY-SA 4.0, via Wikimedia Commons' },
  'san-jose|CA':         { credit: 'XAtsukex, CC BY 3.0, via Wikimedia Commons' },
  'santa-clarita|CA':    { credit: 'Konrad Summers, CC BY-SA 2.0, via Wikimedia Commons' },
  'santa-monica|CA':     { credit: 'Erwin Kreijne, CC BY 3.0, via Wikimedia Commons' },
  'south-gate|CA':       { credit: 'ShticktatorTal, CC BY-SA 4.0, via Wikimedia Commons' },
  'temecula|CA':         { credit: 'John Ward (jdubphoto.com), CC BY-SA 3.0, via Wikimedia Commons' },
  'west-covina|CA':      { credit: 'ASDFGH, CC BY-SA 4.0, via Wikimedia Commons' },
  'west-hollywood|CA':   { credit: 'Tony Mariotti, CC BY 2.0, via Wikimedia Commons' },
  'whittier|CA':         { credit: 'Northwalker, CC0, via Wikimedia Commons' },

  // Colorado (2)
  'colorado-springs|CO': { credit: 'WolfmanSF, CC BY-SA 4.0, via Wikimedia Commons' },
  'el-paso-county|CO':   { file: 'el-paso-county-co.jpg', credit: 'MElizabethTill, CC BY-SA 4.0, via Wikimedia Commons' },

  // Florida (3)
  'bradenton|FL':   { credit: 'Ebyabe, CC BY-SA 3.0, via Wikimedia Commons' },
  'miami|FL':       { credit: 'Euthman, CC BY 4.0, via Wikimedia Commons' },
  'tallahassee|FL': { credit: 'Daniel Vorndran (DXR), CC BY-SA 4.0, via Wikimedia Commons' },

  // Georgia (2)
  // ⚠ macon's registry line REVERSES the author and licence fields — it reads
  // "<title> | CC BY-SA 3.0 | Bubba73, Wikimedia Commons, own work". Transcribing it
  // positionally would credit the photograph to "CC BY-SA 3.0". The author is
  // recoverable here; columbus|GA has the same defect with no author to recover, so it
  // is omitted. Both reported back to essentials.
  'macon|GA':         { credit: 'Bubba73, CC BY-SA 3.0, via Wikimedia Commons' },
  'milledgeville|GA': { credit: 'Clifflandis, CC0, via Wikimedia Commons' },

  // Indiana (1)
  'bloomington|IN': { credit: 'Yahala, CC BY-SA 3.0, via Wikimedia Commons' },

  // Massachusetts (14)
  'boston|MA':      { credit: 'Beyond My Ken, CC BY-SA 4.0, via Wikimedia Commons' },
  'brockton|MA':    { credit: 'Tyoung0543, CC BY-SA 4.0, via Wikimedia Commons' },
  'cambridge|MA':   { credit: 'Yishen Miao, CC BY-SA 3.0, via Wikimedia Commons' },
  'fall-river|MA':  { credit: 'Leonardo DaSilva, CC BY 3.0, via Wikimedia Commons' },
  'lowell|MA':      { credit: 'National Park Service, public domain, via Wikimedia Commons' },
  'lynn|MA':        { credit: 'Terageorge, CC BY-SA 4.0, horizon leveled, via Wikimedia Commons' },
  'medford|MA':     { credit: 'John Phelan, CC BY 3.0, via Wikimedia Commons' },
  'new-bedford|MA': { credit: 'Infrogmation, CC BY 2.5, via Wikimedia Commons' },
  'newton|MA':      { credit: 'Kenneth C. Zirkel, CC BY-SA 4.0, leveled, via Wikimedia Commons' },
  'quincy|MA':      { credit: 'Sswonk, CC BY 3.0, via Wikimedia Commons' },
  'somerville|MA':  { credit: '4300streetcar, CC BY 4.0, via Wikimedia Commons' },
  'springfield|MA': { credit: 'Steven Polom, CC BY 2.0, via Wikimedia Commons' },
  'waltham|MA':     { credit: 'Traveler100, CC BY-SA 3.0, via Wikimedia Commons' },
  'worcester|MA':   { credit: '4300streetcar, CC BY 4.0, via Wikimedia Commons' },

  // Maryland (1)
  'leonardtown|MD': { credit: 'Dougtone, CC BY-SA 2.0, via Wikimedia Commons' },

  // Maine (6)
  'auburn|ME':         { credit: 'Kenneth C. Zirkel, CC BY-SA 4.0, via Wikimedia Commons' },
  'bangor|ME':         { credit: 'Warren LeMay, CC BY-SA 2.0, via Wikimedia Commons' },
  'biddeford|ME':      { credit: 'Dcrjsr, CC BY 3.0, via Wikimedia Commons' },
  'lewiston|ME':       { credit: 'Carol Boldt, CC BY-SA 4.0, via Wikimedia Commons' },
  'portland|ME':       { file: 'portland-me.jpg', credit: 'Daderot, CC0, via Wikimedia Commons' },
  'south-portland|ME': { credit: 'Giorgio Galeotti, CC BY-SA 4.0, via Wikimedia Commons' },

  // Missouri (1)
  'springfield|MO': { file: 'springfield-mo.jpg', credit: 'Steven Polom, CC BY 2.0, via Wikimedia Commons' },

  // North Carolina (2)
  'asheville|NC': { credit: 'Bill McMannis, CC BY 2.0, via Wikimedia Commons' },
  'durham|NC':    { credit: 'DiscoA340, CC BY-SA 4.0, via Wikimedia Commons' },

  // Nevada (4)
  'boulder-city|NV':    { credit: 'Karlis Dambrans, CC BY 2.0, via Wikimedia Commons' },
  'henderson|NV':       { credit: 'Coolcaesar, CC BY-SA 4.0, via Wikimedia Commons' },
  'las-vegas|NV':       { credit: 'Christian David, CC BY-SA 4.0, via Wikimedia Commons' },
  'north-las-vegas|NV': { credit: 'Kim Dung Ho, CC BY 2.0, via Wikimedia Commons' },

  // Oregon (14)
  'beaverton|OR':    { credit: 'M.O. Stevens, CC BY 3.0, via Wikimedia Commons' },
  'bend|OR':         { file: 'bend-v2.jpg', credit: 'Spencer Dahl, CC BY-SA 3.0, via Wikimedia Commons' },
  'cornelius|OR':    { credit: 'M.O. Stevens, CC BY-SA 3.0, via Wikimedia Commons' },
  'fairview|OR':     { file: 'fairview-or.jpg', credit: 'Finetooth, CC BY-SA 3.0, via Wikimedia Commons' },
  'forest-grove|OR': { credit: 'Visitor7, CC BY-SA 3.0, via Wikimedia Commons' },
  'gresham|OR':      { credit: 'SkateOregon, CC BY 4.0, via Wikimedia Commons' },
  'hillsboro|OR':    { credit: 'Steve Morgan, CC BY-SA 4.0, via Wikimedia Commons' },
  'maywood-park|OR': { credit: 'Tedder, CC BY 3.0, via Wikimedia Commons' },
  'portland|OR':     { credit: 'Daderot, CC0, via Wikimedia Commons' },
  'sherwood|OR':     { credit: 'dreid1987, CC BY 3.0, via Wikimedia Commons' },
  'tigard|OR':       { credit: 'M.O. Stevens (Aboutmovies), public domain, via Wikimedia Commons' },
  'troutdale|OR':    { credit: 'Another Believer, CC BY-SA 4.0, via Wikimedia Commons' },
  'tualatin|OR':     { credit: 'M.O. Stevens (Aboutmovies), CC BY-SA 3.0, via Wikimedia Commons' },
  'wood-village|OR': { credit: 'Another Believer, CC BY-SA 4.0, via Wikimedia Commons' },

  // Texas (27)
  'allen|TX':                { credit: 'Jphill19, CC BY-SA 4.0, via Wikimedia Commons' },
  'anna|TX':                 { credit: 'Ebmrreditor, CC BY-SA 4.0, via Wikimedia Commons' },
  'arlington|TX':            { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'austin|TX':               { credit: 'Sk5893, CC BY-SA 4.0, via Wikimedia Commons' },
  'blue-ridge|TX':           { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'celina|TX':               { credit: 'Nicolas Henderson, CC BY 2.0, via Wikimedia Commons' },
  'fairview|TX':             { credit: 'Fairsaka, public domain, via Wikimedia Commons' },
  'farmersville|TX':         { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'fort-worth|TX':           { credit: 'DerekAyala27, CC BY 4.0, via Wikimedia Commons' },
  'frisco|TX':               { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'grapevine|TX':            { credit: 'diego_bf109, CC BY-SA 2.0, via Wikimedia Commons' },
  'josephine|TX':            { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'lavon|TX':                { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'longview|TX':             { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'mansfield|TX':            { credit: 'Renelibrary, CC BY-SA 4.0, via Wikimedia Commons' },
  'mckinney|TX':             { credit: 'Rick Ray, CC BY 2.0, via Wikimedia Commons' },
  'murphy|TX':               { credit: 'Flimbone08, CC BY-SA 4.0, via Wikimedia Commons' },
  'nevada|TX':               { credit: 'Michael Barera, CC BY-SA 4.0, via Wikimedia Commons' },
  'north-richland-hills|TX': { credit: 'DerekAyala27, CC BY 4.0, via Wikimedia Commons' },
  'parker|TX':               { credit: 'Carol M. Highsmith, public domain, via Wikimedia Commons' },
  'plano|TX':                { credit: 'Mohidshahab, CC BY-SA 4.0, via Wikimedia Commons' },
  'princeton|TX':            { credit: 'Pinecar, CC0, via Wikimedia Commons' },
  'prosper|TX':              { credit: 'Colby Nate, CC BY 2.0, via Wikimedia Commons' },
  'richardson|TX':           { credit: 'Stan9999, public domain, via Wikimedia Commons' },
  'travis-county|TX':        { credit: 'Fredlyfish4, CC BY-SA 4.0, via Wikimedia Commons' },
  'van-alstyne|TX':          { credit: 'Renelibrary, CC BY-SA 3.0, via Wikimedia Commons' },
  'weston|TX':               { credit: 'City0fWeston, CC BY-SA 4.0, via Wikimedia Commons' },

  // Utah (17)
  'american-fork|UT':    { credit: 'Rick Willoughby, CC BY 2.0, via Wikimedia Commons' },
  'draper|UT':           { credit: 'Leon7, CC BY-SA 3.0, via Wikimedia Commons' },
  'holladay|UT':         { credit: 'Derrellwilliams, CC BY-SA 4.0, via Wikimedia Commons' },
  'layton|UT':           { credit: 'D. Sharon Pruitt, CC BY 2.0, via Wikimedia Commons' },
  'lehi|UT':             { credit: 'Don Ramey Logan, CC BY 4.0, via Wikimedia Commons' },
  'murray|UT':           { credit: 'CountyLemonade, CC BY 3.0, via Wikimedia Commons' },
  'ogden|UT':            { credit: 'sirrobot (Flickr), CC BY 2.0, via Wikimedia Commons' },
  'orem|UT':             { credit: 'An Errant Knight, CC BY-SA 4.0, via Wikimedia Commons' },
  'provo|UT':            { credit: 'Farragutful, CC BY-SA 4.0, via Wikimedia Commons' },
  'riverton|UT':         { credit: 'An Errant Knight, CC BY-SA 4.0, via Wikimedia Commons' },
  'salt-lake-city|UT':   { credit: 'Pocksuppet1999, CC BY-SA 3.0, via Wikimedia Commons' },
  'sandy|UT':            { credit: 'Scott Catron, CC BY-SA 3.0, via Wikimedia Commons' },
  'spanish-fork|UT':     { credit: 'Ken Lund, CC BY-SA 2.0, via Wikimedia Commons' },
  'springville|UT':      { credit: 'Sbharris, CC BY-SA 3.0, via Wikimedia Commons' },
  'st.-george|UT':       { file: 'st-george.jpg', credit: 'Stan Shebs, CC BY-SA 3.0, via Wikimedia Commons' },
  'west-jordan|UT':      { credit: 'Tricia Simpson, CC BY-SA 3.0, via Wikimedia Commons' },
  'west-valley-city|UT': { credit: 'Ben P L, CC BY-SA 2.0, via Wikimedia Commons' },

  // Virginia (2)
  'alexandria|VA':   { credit: 'DiscoA340, CC BY-SA 4.0, via Wikimedia Commons' },
  'falls-church|VA': { credit: 'Southerngs, CC BY-SA 3.0, via Wikimedia Commons' },

  // Washington (4)
  // bainbridge-island and kitsap-county were probed as NoSuchKey on 2026-08-16 and
  // uploaded by essentials the NEXT DAY. seattle's photograph is the PRE-2026-08-14
  // states/WA.jpg byte for byte, which is why STATE_BANNER_CREDITS.WA now names a
  // different photographer for the same place.
  'bainbridge-island|WA': { credit: 'Ecoscapes, CC BY-SA 4.0, via Wikimedia Commons' },
  'king-county|WA':       { credit: 'Kpsudeep, CC BY-SA 4.0, brightened, via Wikimedia Commons' },
  'kitsap-county|WA':     { credit: 'Joe Mabel, CC BY-SA 4.0, via Wikimedia Commons' },
  'seattle|WA':           { credit: 'Daniel Schwen, CC BY-SA 4.0, brightened, via Wikimedia Commons' },

  // Wisconsin (16)
  'burlington|WI':         { file: 'burlington-wi.jpg', credit: 'Royalbroil, CC BY-SA 3.0, via Wikimedia Commons' },
  'caledonia|WI':          { credit: 'Jim Roberts (Boscophotos), CC BY-SA 4.0, via Wikimedia Commons' },
  'dane-county|WI':        { credit: 'Corey Coyle, CC BY 3.0, via Wikimedia Commons' },
  'dover|WI':              { file: 'town-of-dover.jpg', credit: 'Wikideas1, CC0, via Wikimedia Commons' },
  'madison|WI':            { credit: 'John Benson, CC BY 2.5, via Wikimedia Commons' },
  'mount-pleasant|WI':     { credit: 'Alinghi3, CC BY-SA 3.0 / GFDL, via Wikimedia Commons' },
  'norway|WI':             { file: 'town-of-norway.jpg', credit: 'Wikideas1, CC0, via Wikimedia Commons' },
  'racine|WI':             { credit: 'Jeremy Atherton, CC BY-SA 2.5, via Wikimedia Commons' },
  'rochester|WI':          { file: 'rochester-wi.jpg', credit: 'Librerink8, CC BY-SA 4.0, via Wikimedia Commons' },
  'sturtevant|WI':         { credit: 'Znns, CC0, via Wikimedia Commons' },
  'town-of-burlington|WI': { credit: 'Wikideas1, CC0, via Wikimedia Commons' },
  'town-of-waterford|WI':  { credit: 'Wikideas1, CC0, via Wikimedia Commons' },
  'union-grove|WI':        { credit: 'TheCatalyst31, CC BY-SA 4.0, brightened, via Wikimedia Commons' },
  'waterford|WI':          { file: 'waterford-wi.jpg', credit: 'TCP04, CC BY 4.0, via Wikimedia Commons' },
  'wind-point|WI':         { credit: 'Tunads (Daniel J Simanek), CC BY 3.0, via Wikimedia Commons' },
  'yorkville|WI':          { credit: 'Porterhse, CC BY-SA 3.0, via Wikimedia Commons' },
};

/** Build a shared-bucket banner for entities we know are covered, else null.
 *  Returns the credit alongside the URL so per-image attribution can override the
 *  generic one — the two must be chosen together or a banner can be shown under the
 *  wrong author. */
function bucketBanner(entity: Municipality): HeroImage | null {
  switch (entity.entity_type) {
    case 'federal':
      return { url: `${BANNER_BASE}/national/us-capitol-banner-v2.jpg`, credit: FEDERAL_CREDIT };
    case 'state': {
      const abbr = entity.state.toUpperCase();
      // All 50 states are covered at states/<ABBR>.jpg, except the few essentials has
      // versioned — see STATE_BANNER_FILES.
      return STATE_NAMES[abbr]
        ? {
            url: `${BANNER_BASE}/states/${STATE_BANNER_FILES[abbr] ?? `${abbr}.jpg`}`,
            credit: STATE_BANNER_CREDITS[abbr] ?? WIKIMEDIA_CREDIT,
          }
        : null;
    }
    case 'nonprofit':
      return null;
    default: {
      const slug = toSlug(entity.name);
      const key = `${slug}|${entity.state.toUpperCase()}`;
      const banner = CURATED_CITY_BANNERS[key];
      if (!banner) return null;
      return {
        url: `${BANNER_BASE}/cities/${banner.file ?? `${slug}.jpg`}`,
        credit: banner.credit,
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
