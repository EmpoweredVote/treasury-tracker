import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildIntergovernmentalBranches, totalRevenueFromExhibitA, workbookName,
} from '../scripts/loadVAComparativeReport.js';

/**
 * Exhibit B-1 and Exhibit A, built in memory in the APA's real shape.
 *
 * The figures are VIRGINIA BEACH FY2024, read from the amended workbook the
 * stored rows cite (data.virginia.gov resource 742912c5-…), so a regression
 * here is measured against a real filing rather than invented arithmetic.
 *
 * ⚠ The two "Expenditures Made on Behalf" columns are INCLUDED in the fixture
 * on purpose. They are the trap: they sit inside Exhibit B-1, they are not
 * revenue, and Exhibit A's Total Revenue excludes them. A reader that sums the
 * sheet rather than stopping at "Total from the Federal Government" picks up
 * 3,225,136.49 + 3,838,084.51 and publishes money the locality never received.
 */
function vaWorkbook({
  commonwealthTotal = 724366750,
  federalTotal = 233640058,
  exhibitATotalRevenue = 2482035263,
  extraB1Column = null,
} = {}) {
  const wb = new ExcelJS.Workbook();

  const b1 = wb.addWorksheet('Exhibit B1');
  const b1Header = [
    'No.', 'Locality\nCity of:',
    'Payments in Lieu of Taxes', 'Non-\nCategorical State Aid',
    'Shared Expenses (Categorical)', ' Categorical State Aid',
    'Total from the Commonwealth',
    'Payments in Lieu of Taxes', 'Non-\nCategorical Federal Aid',
    ' Categorical Federal Aid', 'Total from the Federal Government',
    'Total State Expenditures Made on Behalf of the Local Government',
    'Total Federal Expenditures Made on Behalf of the Local Government',
  ];
  // ⚠ No. = 1. findLocalityRowInSection segments the sheet by the "No." column
  // RESETTING to 1, because Virginia has city/county homonyms and only
  // (name, section) identifies a row. A fixture numbered 35 with no preceding
  // 1 sits in no section at all and is never found -- which is how this
  // fixture first failed.
  const b1Row = [
    1, 'Virginia Beach',
    0, 94022185, 28306469, 602038096, commonwealthTotal,
    80361, 30395493, 203164204, federalTotal,
    3225136.4875049996, 3838084.5124949999,
  ];
  if (extraB1Column) { b1Header.push(extraB1Column.label); b1Row.push(extraB1Column.value); }
  b1.addRow(b1Header);
  b1.addRow(b1Row);

  // Exhibit A: col 1 = No., col 2 = population, col 4 = locality name.
  const a = wb.addWorksheet('Exhibit A');
  a.addRow([
    'No.', 'Population (Note 1-B)', '', 'Locality\nCity of:',
    'Local Revenue', 'Per Capita ', 'Percent of Revenue',
    'From the Commonwealth', 'Per Capita ', 'Percent of Revenue',
    'Federal Pass-Through', 'Per Capita ', 'Percent of Revenue',
    'Direct Federal Aid', 'Per Capita ', 'Percent of Revenue',
    'Total Revenue', 'Non-Revenue Receipts', 'Transfers from Other Funds',
    'Total Sources Available',
  ]);
  a.addRow([
    1, 453605, '', 'Virginia Beach',
    1524028455, 3359.81, 61.40,
    724366750, 1596.91, 29.18,
    147293060, 324.71, 5.93,
    86346998, 190.35, 3.47,
    exhibitATotalRevenue, 0, 1978174, 2484013437,
  ]);

  return wb;
}

describe('Exhibit B-1 — the intergovernmental branches', () => {
  it('reads the Commonwealth and federal totals the publisher states', () => {
    const [cw, fed] = buildIntergovernmentalBranches(vaWorkbook(), 'Virginia Beach', 0);
    expect(cw.n).toBe('Revenue from the Commonwealth');
    expect(cw.a).toBe(724366750);
    expect(fed.n).toBe('Revenue from the Federal Government');
    expect(fed.a).toBe(233640058);
  });

  it('⚠ STOPS before "Expenditures Made on Behalf" — those are not revenue', () => {
    const [cw, fed] = buildIntergovernmentalBranches(vaWorkbook(), 'Virginia Beach', 0);
    // 3,225,136.49 + 3,838,084.51 = 7,063,221 of money that never reached the
    // locality. If either branch picked it up, one of these would be fractional
    // or over, and the Exhibit A tie in the next describe would fail too.
    expect(Number.isInteger(cw.a)).toBe(true);
    expect(Number.isInteger(fed.a)).toBe(true);
    const names = [...(cw.c ?? []), ...(fed.c ?? [])].map((n) => n.n);
    expect(names.join(' | ')).not.toMatch(/on behalf/i);
    expect(cw.a + fed.a).toBe(958006808);
  });

  it('drops zero columns but keeps the publisher total (PILT is 0 for this city)', () => {
    const [cw] = buildIntergovernmentalBranches(vaWorkbook(), 'Virginia Beach', 0);
    expect(cw.c.map((n) => n.n)).toEqual([
      'Categorical State Aid', 'Non- Categorical State Aid', 'Shared Expenses (Categorical)',
    ]);
    expect(cw.c.reduce((s, n) => s + n.a, 0)).toBe(cw.a);
  });

  it('carries "Payments in Lieu of Taxes" under BOTH parents, not at top level', () => {
    const [, fed] = buildIntergovernmentalBranches(vaWorkbook(), 'Virginia Beach', 0);
    expect(fed.c.map((n) => n.n)).toContain('Payments in Lieu of Taxes');
  });

  it('REFUSES when the leaves stop summing to the publisher\'s own total', () => {
    // The shape of "a column was added or moved between editions".
    expect(() => buildIntergovernmentalBranches(
      vaWorkbook({ commonwealthTotal: 724366750 + 5_000_000 }), 'Virginia Beach', 0,
    )).toThrow(/leaf columns sum to .* publisher's own total/);
  });

  it('REFUSES a workbook whose B-1 total columns are missing', () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Exhibit B1');
    ws.addRow(['No.', 'Locality', 'Payments in Lieu of Taxes']);
    ws.addRow([1, 'Virginia Beach', 100]);
    expect(() => buildIntergovernmentalBranches(wb, 'Virginia Beach', 0))
      .toThrow(/Exhibit B1 layout unrecognised/);
  });
});

describe('Exhibit A is the independent check on B + B-1', () => {
  it('reads "Total Revenue", not "Percent of Revenue" or "Total Sources Available"', () => {
    expect(totalRevenueFromExhibitA(vaWorkbook(), 'Virginia Beach', 0)).toBe(2482035263);
  });

  it('returns null rather than throwing when the locality is absent', () => {
    expect(totalRevenueFromExhibitA(vaWorkbook(), 'Nowhere', 0)).toBeNull();
  });
});

describe('workbookName — TT display name to the name the APA lists', () => {
  it('strips the County suffix a county is stored under', () => {
    expect(workbookName('Albemarle County', 'county')).toBe('Albemarle');
    expect(workbookName('King & Queen County', 'county')).toBe('King & Queen');
  });

  it('leaves cities and towns alone', () => {
    expect(workbookName('Virginia Beach', 'city')).toBe('Virginia Beach');
    expect(workbookName('Colonial Beach', 'town')).toBe('Colonial Beach');
    // ⚠ A city that genuinely ends in "County" must not be truncated by type.
    expect(workbookName('Charles City County', 'city')).toBe('Charles City County');
  });
});
