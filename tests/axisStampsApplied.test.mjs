import { describe, it, expect } from 'vitest';
import { unstampedRows, AXES } from '../scripts/lib/axisStamps.mjs';

/**
 * ⚠⚠ THE HOLE THIS CLOSES. Every partition gate in this repo counts rows whose
 * `data_source` MATCHES a registry entry — it never checks that the row's
 * COLUMN actually holds the entry's value. A row can be counted toward
 * `wa-sao: 328`, pass `planAxis`, pass `checkPartition`, and hold `unknown`.
 *
 * That is not hypothetical. Duvall FY2016-FY2019 were reloaded to fix a label
 * after the stampers had run, and the 8 recreated rows carried `unknown` on
 * ALL FIVE axes while the full test suite, both Python selftests and all three
 * partition gates stayed green — including the gate that reported 328.
 *
 * A reader opening those years saw "Audit status not established — we have not
 * yet checked what assurance stands behind this figure" about a figure read
 * out of an audited WA SAO report whose split opinion is transcribed into the
 * registry three files away.
 *
 * This is the SECOND time this repo has lost state to a delete-and-reinsert;
 * the EV financials refresh is the other.
 */
describe('unstampedRows', () => {
  const REGISTRY = [
    { id: 'alpha', match: /^Alpha — /, value: 'cash', evidence: { document: 'd', figures: 'f' } },
    { id: 'beta', match: /^Beta — /, value: 'gaap', evidence: { document: 'd', figures: 'f' } },
  ];
  const LEGAL = ['unknown', 'cash', 'gaap'];
  const row = (data_source, accounting_basis, id = data_source) =>
    ({ id, data_source, accounting_basis });

  it('reports a row whose data_source classifies but whose column is still unknown', () => {
    const out = unstampedRows(
      [row('Alpha — FY2024', 'unknown')], REGISTRY, LEGAL, 'unknown', 'accounting_basis');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ entryId: 'alpha', expected: 'cash', actual: 'unknown' });
  });

  it('reports a row stamped with the WRONG value, not only an unstamped one', () => {
    // A stale stamp left behind by a registry change is the same defect as a
    // missing one, and strictly harder to notice.
    const out = unstampedRows(
      [row('Beta — FY2024', 'cash')], REGISTRY, LEGAL, 'unknown', 'accounting_basis');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ entryId: 'beta', expected: 'gaap', actual: 'cash' });
  });

  it('is silent when every classified row carries its entry value', () => {
    expect(unstampedRows(
      [row('Alpha — FY2024', 'cash'), row('Beta — FY2024', 'gaap')],
      REGISTRY, LEGAL, 'unknown', 'accounting_basis')).toEqual([]);
  });

  it('ignores a row no entry claims — those are legitimately unknown', () => {
    // 65,397 rows match no entry and are LEFT ALONE by the stampers on
    // purpose. Reporting them here would bury the real finding in noise.
    expect(unstampedRows(
      [row('Gamma — FY2024', 'unknown')], REGISTRY, LEGAL, 'unknown', 'accounting_basis')).toEqual([]);
  });

  it('treats a NULL column as unstamped rather than skipping it', () => {
    const out = unstampedRows(
      [row('Alpha — FY2024', null)], REGISTRY, LEGAL, 'unknown', 'accounting_basis');
    expect(out).toHaveLength(1);
    expect(out[0].actual).toBe(null);
  });

  it('covers all five axes, so no axis can be added without one', () => {
    expect(AXES.map((a) => a.column).sort()).toEqual(
      ['accounting_basis', 'audit_grade', 'basis', 'fund_scope', 'reporting_entity']);
    for (const a of AXES) {
      expect(a.registry.length, `${a.column} registry`).toBeGreaterThan(0);
      expect(a.legal, `${a.column} legal values`).toContain(a.unknown);
    }
  });
});
