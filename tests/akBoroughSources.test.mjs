import { describe, it, expect } from 'vitest';
import {
  AK_BOROUGHS, FAC_ROSTER, FAC_PDF_BASE, documentUrlFor, fysFor, assertCitable,
} from '../scripts/lib/akBoroughSources.mjs';

describe('assertCitable', () => {
  // ⚠⚠ THE DEFECT THIS PINS SHIPPED TWICE AND NO OTHER GATE COULD SEE IT.
  // FAC answers its PDF endpoint with a 302 to a presigned S3 object carrying
  // `X-Amz-Expires=30` — thirty SECONDS — and the fetcher recorded that
  // redirect target as the manifest URL, which the loader stamps as
  // `source_url`. 227 Alaska borough rows carried a link that was dead before
  // the load writing it had finished. Every figure was correct throughout:
  // nothing in the tie gate, the per-capita guard, the frozen invariant or the
  // scope sweep reads a URL.
  it('refuses a presigned, expiring S3 link', () => {
    const presigned = `${FAC_PDF_BASE}x`.replace('app.fac.gov', 's3-us-gov-west-1.amazonaws.com')
      + '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=30&X-Amz-Signature=deadbeef';
    expect(() => assertCitable(presigned)).toThrow(/PRESIGNED|EXPIRING/i);
  });

  it('refuses a signature-only presigned link', () => {
    expect(() => assertCitable('https://example.gov/a.pdf?X-Amz-Signature=abc')).toThrow(/PRESIGNED/i);
  });

  it('returns an ordinary publisher URL unchanged', () => {
    const u = 'https://app.fac.gov/dissemination/report/pdf/2024-06-GSAFAC-0000359317';
    expect(assertCitable(u)).toBe(u);
  });
});

describe('the Alaska borough roster', () => {
  it('builds every document URL from the citable FAC endpoint', () => {
    for (const ent of AK_BOROUGHS) {
      for (const fy of fysFor(ent.key)) {
        const u = documentUrlFor(ent.key, fy);
        expect(u.startsWith(FAC_PDF_BASE)).toBe(true);
        expect(() => assertCitable(u)).not.toThrow();
      }
    }
  });

  it('holds sixteen boroughs, each with exactly one EIN', () => {
    // 19 organized boroughs in Alaska; Anchorage is loaded separately and
    // Skagway (fiscal-year change) and Denali (image-only scan) are not loaded.
    expect(AK_BOROUGHS).toHaveLength(16);
    // ⚠ The FAC auditee NAME is not stable (Mat-Su files under three spellings,
    // Bristol Bay under five) and its EIN can even belong to another entity.
    // The roster is keyed on the borough, and the fetcher verifies the document
    // itself — but a duplicate EIN here would mean two boroughs share a key.
    const eins = AK_BOROUGHS.map((b) => b.facEin);
    expect(new Set(eins).size).toBe(eins.length);
  });

  it('types the unified city-boroughs `city` and the rest `county`', () => {
    // ⚠ An Alaska borough is a census SUMLEV 050 COUNTY-EQUIVALENT, so it is
    // `county`; `borough` in TT means the 949 Pennsylvania boroughs, a unit
    // BENEATH a county. The four unified city-boroughs are `city`, which the
    // census proves by printing an identical population at SUMLEV 050/162/157.
    // ⚠⚠ Petersburg is deliberately NOT among them: it looks unified (the City
    // of Petersburg dissolved into it in 2013) but Kupreanof city sits inside.
    const byKey = Object.fromEntries(AK_BOROUGHS.map((b) => [b.key, b.entityType]));
    expect(byKey.juneau).toBe('city');
    expect(byKey.sitka).toBe('city');
    expect(byKey.wrangell).toBe('city');
    expect(byKey.petersburg).toBe('county');
    expect(byKey.northslope).toBe('county');
    expect(byKey.nwarctic).toBe('county');
    expect(byKey.aleutianseast).toBe('county');
    expect(AK_BOROUGHS.every((b) => ['city', 'county'].includes(b.entityType))).toBe(true);
  });

  it('closes every borough on June 30', () => {
    // ⚠⚠ Anchorage, in the SAME `ak-local-acfr-gf` family, closes December 31.
    // Carrying a month between entities mislabels the period of every row it
    // writes without changing a dollar.
    for (const ent of AK_BOROUGHS) expect(ent.fiscalYearStartMonth).toBe(7);
    for (const key of Object.keys(FAC_ROSTER)) {
      for (const [fy, rec] of Object.entries(FAC_ROSTER[key])) {
        expect(rec.fy_end).toBe(`${fy}-06-30`);
      }
    }
  });

  it('raises the per-capita ceiling for exactly two boroughs, and only upward', () => {
    // Both have an INDUSTRIAL tax base and a tiny resident population, so
    // per-capita measures the wrong denominator rather than the wrong units:
    // North Slope taxes Prudhoe Bay oil and gas (~$47,000/capita against
    // 10,663 residents), and Bristol Bay taxes the salmon catch — a "Sales tax
    // on raw fish" that is 72% of its General Fund revenue, ~$20,300/capita
    // against 884. Every other borough must leave the shared $20,000 alone.
    const raised = AK_BOROUGHS.filter((b) => b.perCapitaMax !== undefined);
    expect(raised.map((b) => b.key).sort()).toEqual(['bristolbay', 'northslope']);
    for (const b of raised) expect(b.perCapitaMax).toBeGreaterThan(20_000);
  });

  it('types the home rule BOROUGHS `county` however their names read', () => {
    // ⚠⚠⚠ YAKUTAT IS THE TRAP. "City and Borough of Yakutat" is the SAME NAME
    // CONSTRUCTION as Sitka's and Wrangell's, which are `city` — and it is a
    // `county`. Its own Note 1: the voters created a "home rule borough" in
    // 1992 and "simultaneously dissolve[d] the City of Yakutat". Haines says
    // the same of itself ("a Home Rule borough", after absorbing the City of
    // Haines in 2002). Alaska distinguishes a unified home rule MUNICIPALITY
    // from a home rule BOROUGH, and only the former is `city`.
    const byKey = Object.fromEntries(AK_BOROUGHS.map((b) => [b.key, b.entityType]));
    expect(byKey.yakutat).toBe('county');
    expect(byKey.haines).toBe('county');
    expect(byKey.bristolbay).toBe('county');
    expect(byKey.lakepen).toBe('county');
    // Exactly three `city` entries here; Anchorage is seeded elsewhere.
    const cities = AK_BOROUGHS.filter((b) => b.entityType === 'city').map((b) => b.key).sort();
    expect(cities).toEqual(['juneau', 'sitka', 'wrangell']);
  });
});
