import { describe, it, expect } from 'vitest';

import { AK_FIGURE_FLAGS, akFlagsFor } from '../scripts/data/akAcfrAnomalies.mjs';

/**
 * The Alaska anomaly register, and the properties that make it honest.
 *
 * ⚠⚠ A SEAM HAS TWO SIDES. The Ketchikan FY2017 entry exists because the
 * General Fund stopped containing local education — which makes FY2016 exactly
 * as affected as FY2017, since it is the last year on the old boundary. Marking
 * only FY2017 would tell a reader the drop happened TO that year, which is the
 * opposite of what the documents say. `seamYears` is asserted to carry both.
 *
 * ⚠ Nothing here is withheld from the product. `loaded` is true on every entry
 * and a test says so, because the Milledgeville Rule is about flagging figures
 * rather than suppressing them, and a register that ever starts hiding one
 * should fail loudly.
 */

describe('the register records, and never withholds', () => {
  it('⭐ loads every flagged figure', () => {
    for (const f of AK_FIGURE_FLAGS) expect(f.loaded, f.id).toBe(true);
  });

  it('carries the evidence a reader would need to check it', () => {
    for (const f of AK_FIGURE_FLAGS) {
      expect(f.what.length, f.id).toBeGreaterThan(80);
      expect(f.magnitude.length, f.id).toBeGreaterThan(1);
      expect(f.verifiedBecause.length, f.id).toBeGreaterThan(1);
      // ⚠ A flag without a benign explanation on file is a flag that went
      // looking for fault. Both of these have ordinary causes and say so.
      expect(f.benignExplanations.length, f.id).toBeGreaterThan(0);
      expect(f.corroboration, f.id).toMatch(/independent/i);
    }
  });

  it('⚠ states the limits of its own corroboration', () => {
    // Both external legs reported, unprompted, that no independent publisher
    // reprints these General Fund totals and that FAC is a second ACCESS PATH
    // rather than a second source. That belongs in the record, not glossed.
    for (const f of AK_FIGURE_FLAGS) {
      expect(f.corroboration, f.id).toMatch(/access path|No independent publisher|no independent publisher/);
    }
  });
});

describe('Ketchikan FY2017 — the seam', () => {
  const ket = AK_FIGURE_FLAGS.find((f) => f.entity === 'Ketchikan Gateway Borough');

  it('⭐⭐ marks BOTH sides of the seam, not just the year that looks wrong', () => {
    expect(ket.seamYears).toEqual([2016, 2017]);
    expect(akFlagsFor('Ketchikan Gateway Borough', 2016)).toHaveLength(1);
    expect(akFlagsFor('Ketchikan Gateway Borough', 2017)).toHaveLength(1);
  });

  it('⚠ is a comparability note, NOT a warning', () => {
    // Both figures are correct and the change was disclosed a year in advance.
    // Rendering it as a caution would imply a defect where there is none.
    expect(ket.severity).toBe('not-comparable');
    expect(ket.rendersAs).toBe('comparability-note');
    expect(ket.readerFacing).toBe(true);
  });

  it('does not reach the years either side of the seam', () => {
    expect(akFlagsFor('Ketchikan Gateway Borough', 2015)).toEqual([]);
    expect(akFlagsFor('Ketchikan Gateway Borough', 2018)).toEqual([]);
  });
});

describe('Kodiak FY2021 — explained, and deliberately not reader-facing', () => {
  const kod = AK_FIGURE_FLAGS.find((f) => f.entity === 'Kodiak Island Borough');

  it('⭐ is recorded but NOT surfaced', () => {
    // Both legs concluded this is an ordinary pandemic-year pattern with no
    // data problem. It is on file so the next reader does not re-derive it.
    expect(kod.severity).toBe('explained-spike');
    expect(kod.readerFacing).toBe(false);
    expect(kod.rendersAs).toBeNull();
  });

  it('⚠⚠ records BOTH causes — the earlier note had only one', () => {
    // The explanation on file before 2026-10-28 credited the whole rise to
    // federal relief and called the property-tax line "volatile". A third of
    // the rise is a mill-rate reallocation that was transferred straight out,
    // and both independent legs found it separately.
    expect(kod.what).toMatch(/TWO causes, not one/);
    expect(kod.what).toMatch(/CARES/);
    expect(kod.what).toMatch(/0\.56 mills to 2\.75 mills/);
    expect(kod.magnitude.join(' ')).toMatch(/per mill/i);
  });

  it('names the one genuinely external source it has', () => {
    // The relief award is confirmed by a State of Alaska legislative document
    // published a year before the audit existed. The General Fund totals are
    // not externally sourced, and the entry says which is which.
    expect(kod.verifiedBecause.join(' ')).toMatch(/RPL# 08-2020-0250/);
    expect(kod.corroboration).toMatch(/CARES\s+AWARD is externally sourced/);
  });
});

describe('akFlagsFor', () => {
  it('returns an empty array for an entity with nothing recorded', () => {
    expect(akFlagsFor('Municipality of Anchorage', 2021)).toEqual([]);
    expect(akFlagsFor('Kodiak Island Borough', 2019)).toEqual([]);
  });
});
