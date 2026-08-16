/**
 * Unit tests for the WA-CITIES-01 enrichment loader's pure guards.
 *
 * Task 13 mutation-tests check (h) on the premise that a green suite which cannot
 * fail is worth nothing. That premise applies with more force to a guard that has
 * never fired: three of the four below were written in Task 12 and were satisfied
 * on the first dry-run, so without these tests "0 leaks" would be indistinguishable
 * from "the guard is inert".
 *
 * Each test therefore asserts BOTH directions -- that the guard catches the thing
 * it exists for, and that it does not fire on the real authored copy.
 */
import { describe, it, expect } from 'vitest';
import {
  findDollarLeaks, findLocalityLeaks, findMissingCaveat, findVariantDivergence,
} from '../scripts/loadWaCitiesEnrichment.mjs';
import {
  TACOMA_ENRICHMENT, VANCOUVER_ENRICHMENT, BELLEVUE_ENRICHMENT, CAVEAT_MARKER,
} from '../data/waCitiesEnrichment.mjs';

/** The row shape the loader builds, reduced to the fields the guards read. */
const row = (name_key, over = {}) => ({
  name_key,
  plain_name: 'Taxes',
  short_description: 'The city\'s own tax revenue.',
  description: `Taxes are the largest source of General Fund money.\n\n${CAVEAT_MARKER} The city also reports other funds.\n\nReported in the city's annual financial statements.`,
  ...over,
});

const rowsOf = (map) => Object.entries(map).map(([k, v]) => ({ name_key: k, ...v }));

describe('enrichment guard: $-figure leak', () => {
  // Rows are reused across up to 20 fiscal years, so a hardcoded amount would go
  // stale silently and read to a user as current.
  it('catches a figure in the description', () => {
    const bad = row('taxes', { description: `Property tax raised $12,345,678 last year.\n\n${CAVEAT_MARKER}` });
    expect(findDollarLeaks([bad]).map((r) => r.name_key)).toEqual(['taxes']);
  });

  it('catches a figure in the short description too', () => {
    expect(findDollarLeaks([row('taxes', { short_description: 'About $40 per resident.' })])).toHaveLength(1);
  });

  it('does not fire on a bare dollar sign with no digits', () => {
    expect(findDollarLeaks([row('taxes', { short_description: 'Amounts are shown in $ terms.' })])).toHaveLength(0);
  });

  it('does not fire on any authored row', () => {
    for (const map of [TACOMA_ENRICHMENT, VANCOUVER_ENRICHMENT, BELLEVUE_ENRICHMENT]) {
      expect(findDollarLeaks(rowsOf(map))).toHaveLength(0);
    }
  });
});

describe('enrichment guard: cross-locality leak', () => {
  // A Tacoma row naming another WA municipality is the bleed that once leaked
  // Indiana and California text app-wide, in miniature.
  it('catches another municipality named in the copy', () => {
    const bad = row('taxes', { description: `Unlike Bellevue, this city taxes differently.\n\n${CAVEAT_MARKER}` });
    expect(findLocalityLeaks([bad], ['Bellevue', 'Kent'])).toEqual([{ name_key: 'taxes', leaked: 'bellevue' }]);
  });

  it('matches on a word boundary, so a substring is not a leak', () => {
    // "Kent" must not match inside "Kentish" or "Kentucky".
    const ok = row('taxes', { description: `Kentucky is irrelevant here.\n\n${CAVEAT_MARKER}` });
    expect(findLocalityLeaks([ok], ['Kent'])).toHaveLength(0);
  });

  it('does not fire on a city naming ITSELF', () => {
    // Every row's provenance sentence names its own city, so a guard that flagged
    // that would be unusable.
    const rows = rowsOf(TACOMA_ENRICHMENT);
    expect(findLocalityLeaks(rows, ['Bellevue', 'Kent', 'Everett', 'Spokane', 'Vancouver'])).toHaveLength(0);
  });
});

describe('enrichment guard: the General-Fund-only caveat', () => {
  it('catches a row that omits it', () => {
    const bad = row('taxes', { description: 'Taxes are the largest source of money.' });
    expect(findMissingCaveat([bad]).map((r) => r.name_key)).toEqual(['taxes']);
  });

  it('does not fire on any authored row', () => {
    for (const map of [TACOMA_ENRICHMENT, VANCOUVER_ENRICHMENT, BELLEVUE_ENRICHMENT]) {
      expect(findMissingCaveat(rowsOf(map))).toHaveLength(0);
    }
  });
});

describe('enrichment guard: era-variant copy divergence', () => {
  // When a line renames itself partway through a window, every variant needs a row
  // so every year renders something -- and the copy must match, or a reader
  // comparing two fiscal years sees one source described two different ways.
  it('catches two variants of one line carrying different copy', () => {
    const a = row('fines and forfeitures', { plain_name: 'Fines & Forfeitures' });
    const b = row('fines and forfeits', { plain_name: 'Fines & Forfeitures', short_description: 'Something else entirely.' });
    expect(findVariantDivergence([a, b])).toHaveLength(1);
  });

  it('catches a divergent long description, not just the short one', () => {
    const a = row('capital outlay', { plain_name: 'Capital Outlay' });
    const b = row('capital expenditures', { plain_name: 'Capital Outlay', description: `Different body.\n\n${CAVEAT_MARKER}` });
    expect(findVariantDivergence([a, b])).toHaveLength(1);
  });

  it('does not fire on distinct lines that merely sit side by side', () => {
    expect(findVariantDivergence([row('taxes'), row('rent', { plain_name: 'Rent & Lease Income' })])).toHaveLength(0);
  });

  it('does not fire on the authored maps, which have real variant families', () => {
    // Tacoma has six renamed lines across its window; Bellevue renames six more
    // in FY2023. If the concept table ever stopped unifying them this would fail.
    for (const map of [TACOMA_ENRICHMENT, BELLEVUE_ENRICHMENT]) {
      expect(findVariantDivergence(rowsOf(map))).toEqual([]);
    }
  });

  it('proves the authored maps actually CONTAIN variant families', () => {
    // Otherwise the test above passes vacuously.
    const names = rowsOf(TACOMA_ENRICHMENT).map((r) => r.plain_name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes.length).toBeGreaterThan(0);
  });
});
