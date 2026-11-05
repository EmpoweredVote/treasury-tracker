/**
 * Collapsing rows where a publisher wrote the CHECK TOTAL on every GL line.
 *
 * ⚠⚠ The danger is not failing to collapse — it is collapsing a file that did
 * nothing wrong. Frisco FY2026 pays FRISCO STADIUM LLC twice monthly at the
 * same amount, as an expenditure and the interfund transfer funding it. Firing
 * this policy there would delete $63,167,944.48 that really moved. Most of
 * what follows guards that direction.
 */
import { describe, it, expect } from 'vitest';
import {
  judgeAllocationRows,
  collapseAllocationRows,
  mergedDescription,
  describeAllocation,
  MIN_SHARE_TO_APPLY,
  MAX_DESCRIPTIONS_SHOWN,
} from '../scripts/lib/allocationRows.mjs';

const OPTS = {
  dateColumn: 'check_date',
  vendorColumn: 'vendor_name',
  amountColumn: 'amount',
  descriptionColumn: 'description',
};

const row = (date, vendor, amount, description) => ({
  check_date: date, vendor_name: vendor, amount, description,
});

/** Frisco's real shape: one check, same amount on every GL line. */
function repeatedCheck(date, vendor, amount, accounts) {
  return accounts.map((a) => row(date, vendor, amount, a));
}

function ordinary(n, from = 0) {
  return Array.from({ length: n }, (_, i) => row('2018-01-02', `VENDOR ${from + i}`, 100 + i, 'SUPPLIES'));
}

describe('judgeAllocationRows — the Frisco FY2018 shape', () => {
  // The real group: 11 lines at $4,359,026.75 to NTMWD on 2017-11-21.
  const ntmwd = repeatedCheck('2017-11-21', 'NORTH TEXAS MUNICIPAL WATER DISTRICT', 4359026.75, [
    'NTMWD-COTTONWOOD CREEK SEWER', 'NTMWD-REGIONAL COMPOSTING SERV', 'NTMWD - PANTHER CREEK WWTP',
    'NTMWD-REGIONAL WASTEWATER', 'NTMWD-STEWART CREEK REGIONAL W', 'ACCRUED ACCOUNTS PAYABLE (MAN)',
    'NTMWD-WATER PURCHASES', 'NTMWD-UPPER EAST FORK WW INTER', 'NTMWD-WASTEWATER PRETREATMENT',
    'AR - OTHER', 'NTMWD-REGIONAL SOLID WASTE',
  ]);

  it('finds the group and counts what a collapse would remove', () => {
    const v = judgeAllocationRows([...ordinary(20), ...ntmwd], OPTS);
    expect(v.supported).toBe(true);
    expect(v.groups).toHaveLength(1);
    expect(v.groups[0].indices).toHaveLength(11);
    expect(v.rowsRemoved).toBe(10);
    expect(v.moneyRemoved).toBe(43590267.5);      // 10 extra copies x $4,359,026.75
  });

  it('reports the share of the file involved', () => {
    const v = judgeAllocationRows([...ordinary(89), ...ntmwd], OPTS);
    expect(v.rowsInGroups).toBe(11);
    expect(v.share).toBeCloseTo(11 / 100, 6);
  });

  it('groups separately per vendor, per date and per amount', () => {
    const rows = [
      ...repeatedCheck('2018-03-01', 'A', 500, ['X', 'Y']),
      ...repeatedCheck('2018-03-02', 'A', 500, ['X', 'Y']),   // different date
      ...repeatedCheck('2018-03-01', 'B', 500, ['X', 'Y']),   // different vendor
      ...repeatedCheck('2018-03-01', 'A', 600, ['X', 'Y']),   // different amount
    ];
    expect(judgeAllocationRows(rows, OPTS).groups).toHaveLength(4);
  });
});

describe('judgeAllocationRows — leaving healthy files alone', () => {
  it('ignores a file whose rows are all distinct', () => {
    const v = judgeAllocationRows(ordinary(50), OPTS);
    expect(v.groups).toEqual([]);
    expect(v.rowsRemoved).toBe(0);
  });

  // ⚠⚠⚠ Rows identical in EVERY column are the row-dedup story
  // (scripts/lib/xlsxRows.mjs), already measured and handled there. Counting
  // them here too would conflate two different defects and double-count the
  // repair.
  it('ignores rows that are identical in every column', () => {
    const rows = [...ordinary(20), ...repeatedCheck('2018-05-05', 'A', 529, ['COURT BOND', 'COURT BOND', 'COURT BOND'])];
    expect(judgeAllocationRows(rows, OPTS).groups).toEqual([]);
  });

  // The FY2020 format: one row per account, each carrying its OWN amount.
  it('ignores a properly allocated payment', () => {
    const rows = [
      row('2019-11-07', 'NTMWD', -838754.28, 'AR - OTHER'),
      row('2019-11-07', 'NTMWD', 490258.00, 'NTMWD-REGIONAL WASTEWATER'),
      row('2019-11-07', 'NTMWD', 1552030.00, 'NTMWD-STEWART CREEK REGIONAL W'),
      row('2019-11-07', 'NTMWD', 1319110.00, 'NTMWD - PANTHER CREEK WWTP'),
    ];
    expect(judgeAllocationRows(rows, OPTS).groups).toEqual([]);
  });

  it('is unsupported rather than clean when a column is missing', () => {
    const v = judgeAllocationRows(ordinary(20), { dateColumn: 'check_date', amountColumn: 'amount' });
    expect(v.supported).toBe(false);
    expect(v.reason).toMatch(/description/);
    expect(v.groups).toEqual([]);
  });

  it('handles an empty file without claiming a verdict', () => {
    const v = judgeAllocationRows([], OPTS);
    expect(v.supported).toBe(true);
    expect(v.groups).toEqual([]);
  });
});

describe('the share threshold — the guard that matters', () => {
  /**
   * ⚠⚠⚠ Frisco FY2026, to scale: 23 two-row groups in 17,909 rows = 0.3%,
   * carrying $63,167,944.48 of REAL money — FRISCO STADIUM LLC booked as an
   * expenditure and as the transfer funding it. The broken years run 22-23%.
   * The loader refuses below MIN_SHARE_TO_APPLY, so this file cannot be
   * collapsed by someone enabling the policy on the wrong source.
   */
  it('puts a healthy file far below the floor and a broken one far above', () => {
    const healthy = [...ordinary(994), ...repeatedCheck('2026-01-23', 'FRISCO STADIUM LLC', 6387321.11,
      ['CAPITAL EXP-BLDGS/IMPRVMNTS', 'TRANSFER OUT - CAPITAL PROJECT'])];
    const broken = [...ordinary(78), ...Array.from({ length: 11 }, (_, i) =>
      repeatedCheck(`2018-02-${String(i + 1).padStart(2, '0')}`, `V${i}`, 1000, ['A', 'B'])).flat()];

    expect(judgeAllocationRows(healthy, OPTS).share).toBeLessThan(MIN_SHARE_TO_APPLY);
    expect(judgeAllocationRows(broken, OPTS).share).toBeGreaterThan(MIN_SHARE_TO_APPLY);
  });

  it('keeps the floor at five percent', () => {
    expect(MIN_SHARE_TO_APPLY).toBe(0.05);
  });
});

describe('mergedDescription', () => {
  // ⚠⚠ NOT one of the group's descriptions. A check hitting eleven accounts is
  // not "COTTONWOOD CREEK SEWER", and saying so would invent a label the
  // publisher never attached to that amount.
  it('names the accounts and says how many it left out', () => {
    expect(mergedDescription(['A', 'B', 'C', 'D', 'E'])).toBe('A | B | C +2 more');
  });

  it('does not say "+0 more"', () => {
    expect(mergedDescription(['A', 'B', 'C'])).toBe('A | B | C');
    expect(mergedDescription(['A', 'B'])).toBe('A | B');
  });

  it('passes a lone description straight through', () => {
    expect(mergedDescription(['ONLY'])).toBe('ONLY');
  });

  it('returns null rather than an empty string', () => {
    expect(mergedDescription([])).toBeNull();
    expect(mergedDescription([''])).toBeNull();
  });

  it('shows exactly MAX_DESCRIPTIONS_SHOWN names', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f'];
    const shown = mergedDescription(many).split(' +')[0].split(' | ');
    expect(shown).toHaveLength(MAX_DESCRIPTIONS_SHOWN);
  });
});

describe('collapseAllocationRows', () => {
  const rows = [
    ...ordinary(5),
    ...repeatedCheck('2017-11-21', 'NTMWD', 4359026.75, ['SEWER', 'COMPOSTING', 'WATER', 'AR - OTHER']),
    ...ordinary(5, 100),
  ];

  it('keeps one row per group and every ungrouped row', () => {
    const out = collapseAllocationRows(rows, OPTS);
    expect(out.rows).toHaveLength(11);          // 5 + 1 + 5
    expect(out.removed).toBe(3);
    expect(out.money).toBe(13077080.25);
  });

  it('keeps the check total on the surviving row', () => {
    const kept = collapseAllocationRows(rows, OPTS).rows.find((r) => r.vendor_name === 'NTMWD');
    expect(kept.amount).toBe(4359026.75);
  });

  it('gives the surviving row the merged description', () => {
    const kept = collapseAllocationRows(rows, OPTS).rows.find((r) => r.vendor_name === 'NTMWD');
    expect(kept.description).toBe('SEWER | COMPOSTING | WATER +1 more');
  });

  it('keeps the survivor where the group started, preserving order', () => {
    const out = collapseAllocationRows(rows, OPTS).rows;
    expect(out[5].vendor_name).toBe('NTMWD');
    expect(out[4].vendor_name).toBe('VENDOR 4');
    expect(out[6].vendor_name).toBe('VENDOR 100');
  });

  it('does not mutate the rows it was given', () => {
    const before = JSON.stringify(rows);
    collapseAllocationRows(rows, OPTS);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('returns the same array when there is nothing to collapse', () => {
    const clean = ordinary(20);
    const out = collapseAllocationRows(clean, OPTS);
    expect(out.rows).toBe(clean);
    expect(out.removed).toBe(0);
  });
});

describe('describeAllocation', () => {
  it('names the scale, the money and the largest group', () => {
    const rows = [...ordinary(20), ...repeatedCheck('2017-11-21', 'NTMWD', 4359026.75, ['SEWER', 'COMPOSTING', 'WATER'])];
    const lines = describeAllocation(judgeAllocationRows(rows, OPTS));
    expect(lines[0]).toContain('1 group(s)');
    expect(lines[1]).toContain('$8,718,053.50');
    expect(lines[2]).toContain('3 lines at $4,359,026.75');
  });

  it('says so when it could not judge', () => {
    expect(describeAllocation(judgeAllocationRows(ordinary(5), {}))[0]).toMatch(/cannot judge/);
  });
});
