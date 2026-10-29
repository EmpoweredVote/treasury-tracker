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

  it('holds twelve boroughs, each with exactly one EIN', () => {
    expect(AK_BOROUGHS).toHaveLength(12);
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

  it('raises the per-capita ceiling for North Slope ONLY, and only upward', () => {
    // Its General Fund is funded by the Prudhoe Bay oil and gas tax base, not
    // by its 10,663 residents, so it runs ~$47,000/capita against a shared
    // $20,000 default. Every other borough must leave the guard alone.
    const raised = AK_BOROUGHS.filter((b) => b.perCapitaMax !== undefined);
    expect(raised.map((b) => b.key)).toEqual(['northslope']);
    expect(raised[0].perCapitaMax).toBeGreaterThan(20_000);
  });
});
