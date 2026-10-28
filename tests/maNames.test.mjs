import { describe, it, expect } from 'vitest';

import {
  squashMa, maEntityFor, maLegalName, maEntityType, maKey, MA_RENAMES,
} from '../scripts/lib/maNames.mjs';
import { MA_MUNICIPAL_TYPES } from '../scripts/data/maMunicipalTypes.mjs';

/**
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * All 351 Massachusetts municipalities were typed `city`. Massachusetts has
 * 306 towns. `scripts/scrapeMaDLS.js` hard-coded `entity_type: 'city'` for
 * every one of them, so the type was never a reading of anything.
 *
 * ⚠⚠ IT IS IDENTITY-LOAD-BEARING, WHICH IS WHY IT SAT OPEN.
 * `treasury_ensure_municipality` keys on (lower(name), state, entity_type) and
 * INSERTS when it finds no match, so retyping Brookline `city` -> `town` and
 * then re-running any loader that passes `city` MINTS A SECOND BROOKLINE
 * instead of colliding visibly. Same shape as the State College retype and the
 * Ellettsville city-vs-town conflict.
 *
 * ⚠⚠ AND THE RENAME MAKES THAT HAZARD LIVE FOR THIRTEEN GOVERNMENTS. Thirteen
 * MA municipalities have a legal name ending in "Town" — Barnstable Town,
 * Amherst Town, Weymouth Town and ten more — and TT now stores them under that
 * legal name while DLS keeps printing "Barnstable". Every MA lookup site
 * matches the publisher's spelling, so each one has to resolve through here or
 * the next MA load forks all thirteen.
 *
 * These tests pin the resolution in both directions and the invariants of the
 * generated roster.
 */

describe('squashMa — the key, because raw spellings disagree', () => {
  it('⭐ absorbs the hyphen-vs-space split that loses Manchester', () => {
    // The census writes "Manchester-by-the-Sea"; DLS and TT write
    // "Manchester By The Sea". A raw match drops it, and a dropped name is a
    // government that forks on the next load.
    expect(squashMa('Manchester-by-the-Sea')).toBe(squashMa('Manchester By The Sea'));
    expect(squashMa('MANCHESTER BY THE SEA')).toBe(squashMa('manchester-by-the-sea'));
  });

  it('does not collapse two different governments', () => {
    expect(squashMa('Bridgewater')).not.toBe(squashMa('East Bridgewater'));
    expect(squashMa('Bridgewater')).not.toBe(squashMa('West Bridgewater'));
    expect(squashMa('Hadley')).not.toBe(squashMa('South Hadley'));
    expect(squashMa('Attleboro')).not.toBe(squashMa('North Attleborough'));
  });
});

describe('the generated roster', () => {
  it('⭐ holds all 351 Massachusetts municipalities, 45 city and 306 town', () => {
    expect(MA_MUNICIPAL_TYPES).toHaveLength(351);
    const byType = MA_MUNICIPAL_TYPES.reduce((a, r) => ((a[r.entityType] = (a[r.entityType] ?? 0) + 1), a), {});
    expect(byType).toEqual({ city: 45, town: 306 });
  });

  it('⚠⚠ diverges from the census on EXACTLY the thirteen "... Town" charters', () => {
    // Keeping both values makes the judgement call visible data. If a future
    // census vintage renames one of these, this count moves and says so.
    const diverge = MA_MUNICIPAL_TYPES.filter((r) => r.entityType !== r.censusType);
    expect(diverge.map((r) => r.legal).sort()).toEqual([
      'Agawam Town', 'Amherst Town', 'Barnstable Town', 'Braintree Town',
      'Bridgewater Town', 'Franklin Town', 'North Attleborough Town',
      'Palmer Town', 'Randolph Town', 'Southbridge Town', 'West Springfield Town',
      'Weymouth Town', 'Winthrop Town',
    ]);
    // Every divergence runs city -> town and never the other way. A row typed
    // `city` here must be one the census also calls a city.
    for (const r of diverge) {
      expect(r.censusType).toBe('city');
      expect(r.entityType).toBe('town');
    }
  });

  it('⚠ no key reaches two different governments, under either spelling', () => {
    // A shadowed government resolves to its twin at every lookup site and
    // nothing fails — the quietest way to lose one. Both spellings are keyed,
    // so BOTH have to be collision-free, not just the legal one.
    const owners = new Map();
    for (const r of MA_MUNICIPAL_TYPES) {
      for (const key of new Set([squashMa(r.legal), squashMa(r.legal.replace(/\sTown$/, ''))])) {
        if (!owners.has(key)) owners.set(key, new Set());
        owners.get(key).add(r.legal);
      }
    }
    const shared = [...owners].filter(([, names]) => names.size > 1)
      .map(([key, names]) => `${key}: ${[...names].join(' / ')}`);
    expect(shared).toEqual([]);
    expect(new Set(MA_MUNICIPAL_TYPES.map((r) => squashMa(r.legal))).size).toBe(351);
  });
});

describe('maEntityFor — resolves the publisher spelling AND the stored name', () => {
  it('⭐⭐ resolves the thirteen from BOTH sides of the rename', () => {
    // DLS keeps printing "Barnstable" while TT now stores "Barnstable Town".
    // Both must land on the same entry, or the load forks the government.
    for (const { from, to } of MA_RENAMES) {
      expect(maEntityFor(from), `DLS spelling ${from}`).toBeTruthy();
      expect(maEntityFor(to), `stored name ${to}`).toBeTruthy();
      expect(maEntityFor(from).legal).toBe(to);
      expect(maEntityFor(to).legal).toBe(to);
      expect(maEntityType(from)).toBe('town');
    }
  });

  it('⭐ MA_RENAMES is exactly the thirteen, each adding " Town"', () => {
    expect(MA_RENAMES).toHaveLength(13);
    for (const { from, to } of MA_RENAMES) {
      expect(to).toBe(`${from} Town`);
      expect(maEntityType(to)).toBe('town');
    }
  });

  it('leaves the other 338 names untouched', () => {
    // Only the thirteen are renamed; Brookline stays "Brookline". The census
    // word "town" in "Brookline town" is the TYPE, not part of the name, and
    // reading it as a name would rename 293 governments nobody asked to rename.
    expect(maLegalName('Brookline')).toBe('Brookline');
    expect(maEntityType('Brookline')).toBe('town');
    expect(maLegalName('Boston')).toBe('Boston');
    expect(maEntityType('Boston')).toBe('city');
    const renamed = new Set(MA_RENAMES.map((r) => r.from));
    for (const r of MA_MUNICIPAL_TYPES) {
      if (renamed.has(r.legal.replace(/\sTown$/, ''))) continue;
      expect(maLegalName(r.legal), r.legal).toBe(r.legal);
    }
  });

  it('types the six the defect report named, and does not over-correct', () => {
    for (const n of ['Brookline', 'Lexington', 'Arlington', 'Plymouth']) {
      expect(maEntityType(n), n).toBe('town');
    }
    // ⚠ Amherst and Barnstable were listed as towns in the defect report too,
    // and the census types them `city` because both run a city charter. TT
    // stores `town` — but under the LEGAL name, which is the distinction that
    // makes the claim honest rather than a contradiction.
    expect(maEntityType('Amherst')).toBe('town');
    expect(maLegalName('Amherst')).toBe('Amherst Town');
    expect(maEntityType('Barnstable')).toBe('town');
    expect(maLegalName('Barnstable')).toBe('Barnstable Town');
    // Genuine cities stay cities.
    for (const n of ['Boston', 'Framingham', 'Worcester', 'Springfield', 'Methuen']) {
      expect(maEntityType(n), n).toBe('city');
    }
  });

  it('⭐⭐ maKey makes DLS\'s spelling and TT\'s stored name compare EQUAL', () => {
    // ⚠ The subtle half. squashMa alone fixes punctuation but NOT a genuinely
    // different name — it maps "Amherst" and "Amherst Town" to two keys, which
    // is a miss at every lookup site and a fork on the next load. maKey
    // canonicalises through the roster first, so both sides collapse.
    for (const { from, to } of MA_RENAMES) {
      expect(squashMa(from), `${from} vs ${to} — squash alone`).not.toBe(squashMa(to));
      expect(maKey(from), `${from} vs ${to} — maKey`).toBe(maKey(to));
    }
  });

  it('maKey still handles the punctuation case, and leaves strangers alone', () => {
    expect(maKey('Manchester-by-the-Sea')).toBe(maKey('Manchester By The Sea'));
    // A name MA does not have must still compare equal to itself rather than
    // collapsing to nothing — the caller decides what to do, not this.
    expect(maKey('Providence')).toBe(maKey('providence'));
    expect(maKey('Providence')).not.toBe(maKey('Boston'));
  });

  it('returns null for a name Massachusetts does not have', () => {
    // ⚠ The failure direction is "I do not know", never a guess. A caller that
    // gets null must refuse rather than default to `city` — which is the
    // hard-coded default that caused all of this.
    expect(maEntityFor('Providence')).toBeNull();
    expect(maEntityFor('')).toBeNull();
    expect(maEntityFor(null)).toBeNull();
    expect(maLegalName('Providence')).toBeNull();
    expect(maEntityType('Providence')).toBeNull();
  });
});
