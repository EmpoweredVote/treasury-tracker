/**
 * The XLSX row-coverage gate and its registry.
 *
 * ⚠ These tests never touch the network or the database. What they protect is
 * the part of the gate that decides what an operator is TOLD — which is the
 * part that turns a correct measurement into a wrong conclusion.
 */
import { describe, it, expect } from 'vitest';

import { coverageKey, classifyCoverage, isClean } from '../scripts/lib/rowCoverage.mjs';
import { applyRowPolicies } from '../scripts/lib/xlsxPolicies.mjs';
import { describeBlocked, splitUnreachable, amountDisagreements, AMOUNT_TOLERANCE } from '../scripts/verifyXlsxRowCoverage.mjs';
import { XLSX_ROW_COVERAGE } from '../scripts/data/xlsxRowCoverage.mjs';

describe('XLSX_ROW_COVERAGE registry', () => {
  it('has no duplicate keys', () => {
    const seen = new Set();
    const dupes = [];
    for (const e of XLSX_ROW_COVERAGE) {
      const k = coverageKey(e);
      if (seen.has(k)) dupes.push(k);
      seen.add(k);
    }
    expect(dupes).toEqual([]);
  });

  it('gives every entry a source, a fiscal year and a positive row count', () => {
    for (const e of XLSX_ROW_COVERAGE) {
      expect(typeof e.source, JSON.stringify(e)).toBe('string');
      expect(e.source.trim().length, JSON.stringify(e)).toBeGreaterThan(0);
      expect(Number.isInteger(e.fiscalYear), JSON.stringify(e)).toBe(true);
      expect(Number.isInteger(e.rows), JSON.stringify(e)).toBe(true);
      expect(e.rows, JSON.stringify(e)).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠ The whole point of the gate. 22 budgets were unwatched because the
   * sibling gate filters `api_type = 'socrata'`; an empty registry here would
   * pass silently and leave them unwatched again.
   */
  it('covers all three publishers', () => {
    const names = XLSX_ROW_COVERAGE.map((e) => e.source).join(' ');
    expect(names).toMatch(/Frisco/);
    expect(names).toMatch(/McKinney/);
    expect(names).toMatch(/Plano/);
    expect(XLSX_ROW_COVERAGE.length).toBe(23);
  });
});

describe('describeBlocked', () => {
  /**
   * ⚠⚠ Enumerated so that adding a stage to xlsxPolicies.mjs without a line
   * here fails the suite, instead of printing a bare slug like
   * `allocation-below-threshold` to whoever is on the other end of the gate.
   */
  const STAGES = {
    'total-row-ambiguous': { stage: 'total-row-ambiguous' },
    'total-row-does-not-tie': { stage: 'total-row-does-not-tie', tie: { difference: 12.5 } },
    'parse-error-rate': { stage: 'parse-error-rate', parseErrors: 90, of: 100 },
    'allocation-unsupported': { stage: 'allocation-unsupported', verdict: { reason: 'no date column' } },
    'allocation-below-threshold': { stage: 'allocation-below-threshold', verdict: { share: 0.003, moneyRemoved: 63167944.48 } },
    'doubled-days-unsupported': { stage: 'doubled-days-unsupported', verdict: { reason: 'no date column' } },
    'doubled-days-certified': { stage: 'doubled-days-certified', verdict: { certified: ['2024-01-02'], rowsDoubled: 400, amountDoubled: 1234.5 } },
  };

  for (const [stage, blocked] of Object.entries(STAGES)) {
    it(`explains ${stage} without echoing the slug`, () => {
      const line = describeBlocked(blocked);
      expect(line).toBeTruthy();
      expect(line).not.toBe(stage);
      expect(line.length).toBeGreaterThan(20);
    });
  }

  /** Every stage the chain can actually emit must appear above. */
  it('covers every stage applyRowPolicies can block on', () => {
    const emitted = new Set();

    // ambiguous: two rows each equal to the sum of the others.
    const offsetting = [];
    for (let i = 0; i < 4; i++) {
      offsetting.push({ check_date: `2024-02-0${i + 1}`, vendor_name: `P${i}`, amount: 50, description: 'x' });
      offsetting.push({ check_date: `2024-03-0${i + 1}`, vendor_name: `N${i}`, amount: -50, description: 'x' });
    }
    const totalRow = (amount) => ({ check_date: null, vendor_name: null, amount, description: 'TOTAL' });
    const FRISCO = { date_column: 'check_date', amount_column: 'amount', vendor_column: 'vendor_name', description_column: 'description' };
    emitted.add(applyRowPolicies([totalRow(100), totalRow(100), ...offsetting], FRISCO).blocked.stage);

    // doubled-days-unsupported: an occurrence source with no usable date.
    emitted.add(applyRowPolicies(
      [{ net_amount: 1 }],
      { dedup: 'occurrence', amount_column: 'net_amount' },
    ).blocked.stage);

    // allocation-below-threshold: opt-in on a file that does not have the shape.
    const healthy = Array.from({ length: 20 }, (_, i) => ({
      check_date: `2024-05-${String(i + 1).padStart(2, '0')}`, vendor_name: `V${i}`, amount: 100 + i, description: `d${i}`,
    }));
    emitted.add(applyRowPolicies(healthy, { ...FRISCO, allocation_rows: 'repeat-payment-total' }).blocked.stage);

    for (const stage of emitted) {
      expect(Object.keys(STAGES), `stage "${stage}" has no line in describeBlocked`).toContain(stage);
    }
    expect(emitted.size).toBeGreaterThan(0);
  });
});

describe('amountDisagreements', () => {
  const obs = (over) => ({
    source: 'X', fiscalYear: 2024, stored: 100, published: 100,
    storedAmount: 1000, publishedAmount: 1000, blocked: null, ...over,
  });

  it('is silent when rows and dollars both agree', () => {
    expect(amountDisagreements([obs()])).toEqual([]);
  });

  /**
   * ⚠⚠⚠ The defect a row count cannot see. Plano's 455 FY2024 inch-mark lines
   * were all STORED — at $0.00. Every count tied; $786,721.63 was gone.
   */
  it('catches money missing behind a row count that ties', () => {
    const r = amountDisagreements([obs({ storedAmount: 213.37 })]);
    expect(r).toHaveLength(1);
    expect(r[0].difference).toBe(-786.63);
  });

  it('catches money TT holds that the publisher does not show', () => {
    const r = amountDisagreements([obs({ storedAmount: 1500 })]);
    expect(r[0].difference).toBe(500);
  });

  /** ⚠ `total_budget` is a float and reads back as 379429772.1000000000043. */
  it('tolerates a float artefact of one cent or less', () => {
    expect(amountDisagreements([obs({ storedAmount: 1000 + AMOUNT_TOLERANCE })])).toEqual([]);
    expect(amountDisagreements([obs({ storedAmount: 1000.02 })])).toHaveLength(1);
  });

  /**
   * ⚠ When the rows are already short the money is short as a consequence.
   * Reporting both would make one defect look like two, and would bury the
   * row shortfall — which is the thing to act on.
   */
  it('stays quiet when the rows already disagree', () => {
    expect(amountDisagreements([obs({ stored: 50, storedAmount: 500 })])).toEqual([]);
  });

  it('stays quiet when the publisher gave no number at all', () => {
    expect(amountDisagreements([obs({ published: null, publishedAmount: null })])).toEqual([]);
  });
});

describe('splitUnreachable', () => {
  const entry = { source: 'X', fiscalYear: 2024, rows: 10 };

  /**
   * ⚠⚠⚠ The finding this split exists for. A file that downloaded and parsed
   * perfectly well but is refused by a policy must NOT be reported as an
   * unreachable publisher — that sends someone to chase a network problem
   * that is not there, and hides a real problem with the data.
   */
  it('reports a refused file as blocked, never as unreachable', () => {
    const obs = { source: 'X', fiscalYear: 2024, stored: 10, published: null, blocked: { stage: 'total-row-ambiguous' } };
    const r = classifyCoverage([obs], [entry]);
    const split = splitUnreachable(r.unreachable);
    expect(split.blocked).toHaveLength(1);
    expect(split.unreachable).toHaveLength(0);
  });

  it('reports a publisher that could not be reached as unreachable', () => {
    const obs = { source: 'X', fiscalYear: 2024, stored: 10, published: null, blocked: null, unreachableReason: 'HTTP 503' };
    const r = classifyCoverage([obs], [entry]);
    const split = splitUnreachable(r.unreachable);
    expect(split.unreachable).toHaveLength(1);
    expect(split.blocked).toHaveLength(0);
  });

  /** ⚠ Both still FAIL. "Could not look" must never read as "looked and agreed". */
  it('fails the gate either way', () => {
    for (const blocked of [{ stage: 'total-row-ambiguous' }, null]) {
      const obs = { source: 'X', fiscalYear: 2024, stored: 10, published: null, blocked };
      expect(isClean(classifyCoverage([obs], [entry]))).toBe(false);
    }
  });
});
