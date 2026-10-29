import { describe, it, expect } from 'vitest';
import { seedPayloadFor } from '../scripts/seedHiCounties.mjs';
import { HI_COUNTIES } from '../scripts/lib/hiCountySources.mjs';

describe('the Hawaii county seed payloads', () => {
  // ⚠⚠⚠ Honolulu is a CONSOLIDATED CITY AND COUNTY. Alaska's census typing
  // rule (no SUMLEV 162 row => `county`) is an ALASKA rule and would type it
  // wrong. TT's precedent — San Francisco, Philadelphia, Nashville-Davidson —
  // is `city` with county_id null, re-verified live 2026-10-29.
  //
  // `entity_type` is identity-load-bearing: `treasury_ensure_municipality`
  // keys on it, so a wrong value MINTS A SECOND GOVERNMENT rather than
  // mislabelling this one.
  it('types Honolulu as a parentless city and the rest as parentless counties', () => {
    expect(seedPayloadFor('honolulu')).toMatchObject({
      name: 'Honolulu',
      state: 'HI',
      entity_type: 'city',
      county_id: null,
      population: 998747,
      population_year: 2024,
      geoid: '15003',
    });
    expect(seedPayloadFor('hawaii')).toMatchObject({
      name: 'Hawaii County', entity_type: 'county', county_id: null, geoid: '15001',
    });
    expect(seedPayloadFor('maui')).toMatchObject({
      name: 'Maui County', entity_type: 'county', county_id: null, geoid: '15009',
    });
    expect(seedPayloadFor('kauai')).toMatchObject({
      name: 'Kauai County', entity_type: 'county', county_id: null, geoid: '15007',
    });
  });

  // ⚠ Honolulu has NO SUMLEV 162 geography — the census prints only
  // `Urban Honolulu CDP`, which is a different place. So it cannot carry San
  // Francisco's `census-pep-162-exact` basis; its only census geography IS the
  // county. The basis value must say so rather than claiming a place geoid.
  it('does not claim a place-level geoid basis for Honolulu', () => {
    const p = seedPayloadFor('honolulu');
    expect(p.geoid_basis).toBeTruthy();
    expect(p.geoid_basis).not.toBe('census-pep-162-exact');
    expect(p.geoid_basis).toMatch(/050|county|consolidated/i);
  });

  // ⚠⚠ `Hawaii County` and the existing `Hawaii` state node differ by one
  // word. check:forks is the only thing that looks at this.
  it('never emits a payload colliding with the HI state node', () => {
    for (const c of HI_COUNTIES) {
      const p = seedPayloadFor(c.key);
      expect([p.name, p.entity_type]).not.toEqual(['Hawaii', 'state']);
    }
  });

  // ⚠⚠ Kalawao County (pop 81) is state-administered and has no government.
  it('refuses to emit a payload for a non-government', () => {
    expect(() => seedPayloadFor('kalawao')).toThrow();
    expect(() => seedPayloadFor('kauai-water')).toThrow();
  });
});
