import { describe, it, expect } from 'vitest';
import { financingInflow, financingInflowNote } from '../src/data/fundScopeVocabulary';

/**
 * The Money In / Money Out totals are not always like-for-like.
 *
 * MA DLS folds `Other Financing Sources` and `Transfers` INTO its revenue total,
 * while its expenditure product has no transfers-out column at all. CA State
 * Controller does the same with `Other Financing Sources`. So a reader comparing
 * the two tiles is subtracting figures built on different bases.
 *
 * Measured: aggregate 2.73% (MA) and 3.71% (CA), but per municipality-year up to
 * 56.5% (Goshen MA FY2003) and 77.8% (Healdsburg CA FY2006).
 *
 * The figures cannot be adjusted — subtracting would fabricate a total neither
 * publisher reports, and would move `figures_frozen`. So the asymmetry is
 * DISCLOSED, and it is derived from the categories already loaded rather than
 * from a hard-coded list of sources, so it generalises to any source shaped this
 * way. That is how the CA exposure was found at all.
 */
describe('financingInflow', () => {
  const cats = [
    { name: 'Taxes', amount: 620_738_771 },
    { name: 'Service Charges', amount: 82_425_016 },
    { name: 'Transfers', amount: 49_133_465 },
    { name: 'Other Financing Sources', amount: 775_000 },
  ];

  it('sums both financing categories and reports the share', () => {
    const f = financingInflow(cats, 917_998_626);
    expect(f.amount).toBe(49_908_465);
    expect(f.pct).toBeCloseTo(5.44, 1);
    expect(f.categories).toEqual(['Other Financing Sources', 'Transfers']);
  });

  it('matches either category alone — CA carries only Other Financing Sources', () => {
    const f = financingInflow([{ name: 'Taxes', amount: 90 }, { name: 'Other Financing Sources', amount: 10 }], 100);
    expect(f.amount).toBe(10);
    expect(f.categories).toEqual(['Other Financing Sources']);
  });

  it('returns null when there is no financing inflow — most sources', () => {
    expect(financingInflow([{ name: 'Taxes', amount: 100 }], 100)).toBeNull();
  });

  it('returns null rather than dividing by zero or guessing', () => {
    expect(financingInflow(cats, 0)).toBeNull();
    expect(financingInflow(cats, null)).toBeNull();
    expect(financingInflow(null, 100)).toBeNull();
    expect(financingInflow([], 100)).toBeNull();
  });

  it('ignores a zero-amount financing category — nothing to disclose', () => {
    expect(financingInflow([{ name: 'Transfers', amount: 0 }], 100)).toBeNull();
  });

  it('does NOT match on a substring — "Transfers to Other Funds" is an outflow', () => {
    // Guard against loosening this to /transfer/i, which would match expenditure
    // lines and invert the meaning of the note.
    expect(financingInflow([{ name: 'Transfers to Other Funds', amount: 10 }], 100)).toBeNull();
    expect(financingInflow([{ name: 'Operating Transfers Out', amount: 10 }], 100)).toBeNull();
  });

  it('is case- and whitespace-tolerant, since category text comes from loaders', () => {
    const f = financingInflow([{ name: '  transfers  ', amount: 10 }], 100);
    expect(f.amount).toBe(10);
  });
});

describe('financingInflowNote', () => {
  it('names the amount, the share, and why it matters', () => {
    const note = financingInflowNote({ amount: 110_307_414, pct: 31.5, categories: ['Transfers'] });
    expect(note).toMatch(/\$110\.3M/);
    expect(note).toMatch(/31\.5%/);
    // the load-bearing half: it must say the other side has no matching line
    expect(note).toMatch(/not like-for-like|no matching/i);
  });

  it('renders a sub-1% share without collapsing to 0%', () => {
    const note = financingInflowNote({ amount: 400_000, pct: 0.4, categories: ['Transfers'] });
    expect(note).toMatch(/0\.4%/);
  });
});
