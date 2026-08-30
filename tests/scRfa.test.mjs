import { describe, it, expect } from 'vitest';

import {
  parseYearHeader, buildTree, checkTree, assertSiblingNamesUnique, reportedYears,
  money, assertNotError, BLOCK, FINANCING_LEAF, SC_LOAD_FLOOR, NON_COUNTY_SHEETS,
  CITY_BLOCKS_ARE_AGGREGATES,
} from '../scripts/lib/scRfa.mjs';
import {
  sourceNameFor, SOURCE_PREFIX, SOURCE_URL, FUND_SCOPE, BASIS_VALUE, DERIVATION,
} from '../scripts/loadScRfa.mjs';
import {
  SC_ENTITIES, SC_LOAD_WINDOW, SC_SOURCE, scEntityByKey, scBulkEntities,
} from '../scripts/data/scKnightEntities.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';

/** Build a block body the way sliceBlock() returns one. */
function body(rows) {
  return rows.map(([depth, label, value], i) => ({
    depth, label, rowIndex: i, row: Object.assign([], { [9]: value }),
  }));
}
const COL = 9;

describe('parseYearHeader — the asterisk is the non-reporting marker', () => {
  it('reads a plain year', () => {
    expect(parseYearHeader('FY 24')).toEqual({ fiscalYear: 2024, starred: false });
  });

  // ⚠⚠ THE DEFECT THIS PINS: a naive /^FY \d{2}$/ silently DROPS `FY 23*` and a
  // naive strip silently LOADS a year the county never reported. Three county
  // sheets carry one (Clarendon FY23/24, Jasper FY23/24, Kershaw FY21).
  it('reads a starred year AND flags it, rather than dropping or accepting it', () => {
    expect(parseYearHeader('FY 23*')).toEqual({ fiscalYear: 2023, starred: true });
  });

  it('pivots two-digit years at 90 so FY93 is 1993 and FY24 is 2024', () => {
    expect(parseYearHeader('FY 93').fiscalYear).toBe(1993);
    expect(parseYearHeader('FY 99').fiscalYear).toBe(1999);
    expect(parseYearHeader('FY 00').fiscalYear).toBe(2000);
  });

  it('tolerates the FY16-with-no-space form the workbook also uses', () => {
    expect(parseYearHeader('FY16')).toEqual({ fiscalYear: 2016, starred: false });
  });

  it('returns null for anything else', () => {
    for (const s of ['', 'Total', 'FY 2024', '24', null, undefined]) {
      expect(parseYearHeader(s)).toBeNull();
    }
  });
});

describe('reportedYears — the two quality signals must AGREE', () => {
  const window = [2021, 2022, 2023];

  it('accepts a year only when the header is unstarred AND County Info says Y', () => {
    const years = new Map([
      [2021, { col: 1, starred: false }],
      [2022, { col: 2, starred: false }],
      [2023, { col: 3, starred: false }],
    ]);
    const countyInfo = new Map([['Horry', new Map([[2021, true], [2022, true], [2023, true]])]]);
    const r = reportedYears({ years, countyInfo, county: 'Horry', window });
    expect(r.reported).toEqual([2021, 2022, 2023]);
  });

  // Clarendon's shape: the sheet stars it, County Info says it was submitted.
  it('refuses a starred year even when County Info says Y', () => {
    const years = new Map([[2022, { col: 2, starred: false }], [2023, { col: 3, starred: true }]]);
    const countyInfo = new Map([['Clarendon', new Map([[2022, true], [2023, true]])]]);
    const r = reportedYears({ years, countyInfo, county: 'Clarendon', window: [2022, 2023] });
    expect(r.reported).toEqual([2022]);
    expect(r.starred).toEqual([2023]);
  });

  // Allendale's shape: no star, but County Info says it was never submitted.
  it('refuses a not-submitted year even when the header is unstarred', () => {
    const years = new Map([[2022, { col: 2, starred: false }], [2023, { col: 3, starred: false }]]);
    const countyInfo = new Map([['Allendale', new Map([[2022, true], [2023, false]])]]);
    const r = reportedYears({ years, countyInfo, county: 'Allendale', window: [2022, 2023] });
    expect(r.reported).toEqual([2022]);
    expect(r.notSubmitted).toEqual([2023]);
  });

  // ⚠ `County Info` stores Richland with a TRAILING SPACE.
  it('matches a County Info key that carries a trailing space', () => {
    const years = new Map([[2023, { col: 3, starred: false }]]);
    const countyInfo = new Map([['Richland', new Map([[2023, true]])]]);
    expect(reportedYears({ years, countyInfo, county: 'Richland ', window: [2023] }).reported)
      .toEqual([2023]);
  });
});

describe('buildTree — nesting and the financing exclusion', () => {
  const REVENUE = [
    [1, 'Revenues from Local Sources', 300],
    [2, 'Current Property Taxes', 100],
    [3, 'Current Real & Personal Property Taxes', 90],
    [3, 'All Other', 10],
    [2, 'Licenses, Fees, Charges, & Bonds', 200],
    [3, 'Licenses & Permits', 60],
    [3, FINANCING_LEAF, 50],
    [3, 'Miscellaneous', 90],
    [1, 'Revenues from State Sources', 40],
  ];

  it('preserves the publisher\'s full three-level hierarchy', () => {
    const { tree } = buildTree({ body: body(REVENUE), col: COL });
    expect(tree.map((n) => n.n)).toEqual(['Revenues from Local Sources', 'Revenues from State Sources']);
    const local = tree[0];
    expect(local.c.map((n) => n.n)).toEqual(['Current Property Taxes', 'Licenses, Fees, Charges, & Bonds']);
    expect(local.c[0].c.map((n) => n.n))
      .toEqual(['Current Real & Personal Property Taxes', 'All Other']);
  });

  it('leaves a leaf without an empty children array', () => {
    const { tree } = buildTree({ body: body(REVENUE), col: COL });
    expect(tree[1].c).toBeUndefined();
  });

  /**
   * ⚠⚠ THE BUG THIS PINS, FOUND IN DEVELOPMENT AND FIXED: every node's amount is
   * READ from the sheet rather than summed from its children, so unlinking
   * `Bonds & Leases` without SUBTRACTING it from each ancestor leaves the
   * financing money sitting in the parents. The tree then still adds up to the
   * publisher's headline and the exclusion silently does nothing at all.
   */
  it('subtracts an excluded leaf from EVERY ancestor, not just the parent', () => {
    const { tree, total, excluded } = buildTree({
      body: body(REVENUE), col: COL, exclude: new Set([FINANCING_LEAF]),
    });
    expect(excluded).toEqual([{ n: FINANCING_LEAF, a: 50, parent: 'Licenses, Fees, Charges, & Bonds' }]);
    const local = tree[0];
    expect(local.a).toBe(250);                    // 300 - 50, the grandparent
    expect(local.c[1].a).toBe(150);               // 200 - 50, the parent
    expect(local.c[1].c.map((n) => n.n)).toEqual(['Licenses & Permits', 'Miscellaneous']);
    expect(total).toBe(290);                      // 250 + 40
  });

  it('keeps the tree self-consistent after the exclusion', () => {
    const { tree, total } = buildTree({
      body: body(REVENUE), col: COL, exclude: new Set([FINANCING_LEAF]),
    });
    const fails = checkTree({
      tree, subsetTotal: total, publishedTotal: 340, excludedTotal: 50, label: 'revenue',
    }).filter((c) => !c.ok);
    expect(fails).toEqual([]);
  });

  it('drops the descendants of an excluded node with it', () => {
    const { tree } = buildTree({
      body: body([
        [1, 'Root', 100],
        [2, 'Kept', 40],
        [2, FINANCING_LEAF, 60],
        [3, 'Under the excluded node', 60],
      ]),
      col: COL,
      exclude: new Set([FINANCING_LEAF]),
    });
    expect(tree[0].a).toBe(40);
    expect(tree[0].c.map((n) => n.n)).toEqual(['Kept']);
  });
});

describe('checkTree', () => {
  it('fails when a parent does not equal the sum of its children', () => {
    const { tree, total } = buildTree({
      body: body([[1, 'Root', 100], [2, 'A', 40], [2, 'B', 30]]), col: COL,
    });
    const fails = checkTree({ tree, subsetTotal: total, label: 'x' }).filter((c) => !c.ok);
    expect(fails).toHaveLength(1);
    expect(fails[0].kind).toBe('parent=Σchildren');
    expect(fails[0].diff).toBe(-30);
  });

  // ⚠ The loaded tree DELIBERATELY differs from the printed headline. What must
  // hold is subset + exactly-what-we-removed = published. Never widen the tree.
  it('fails when the subset plus the exclusion does not return the headline', () => {
    const { tree, total } = buildTree({ body: body([[1, 'Root', 100]]), col: COL });
    const fails = checkTree({
      tree, subsetTotal: total, publishedTotal: 175, excludedTotal: 50, label: 'x',
    }).filter((c) => !c.ok);
    expect(fails.map((f) => f.kind)).toEqual(['subset+excluded=published']);
  });
});

describe('assertSiblingNamesUnique — link_key collisions', () => {
  // budget_categories.link_key is the lowercased name joined to its ancestors by
  // `|`, so two siblings sharing a name silently merge in the icicle.
  it('throws on duplicate siblings', () => {
    expect(() => assertSiblingNamesUnique([{ n: 'All Other' }, { n: 'all other' }], []))
      .toThrow(/Duplicate sibling category/);
  });

  it('allows the same name under different parents', () => {
    expect(() => assertSiblingNamesUnique(
      [{ n: 'A', c: [{ n: 'All Other' }] }, { n: 'B', c: [{ n: 'All Other' }] }], [],
    )).not.toThrow();
  });
});

describe('money and error cells', () => {
  it('rounds to cents, which is what makes the .xls -> .xlsx conversion exact', () => {
    expect(money(52733895.239999995)).toBe(52733895.24);
    expect(money(52733895.23999999)).toBe(52733895.24);
  });

  it('treats blanks as zero', () => {
    for (const v of [null, undefined, '']) expect(money(v)).toBe(0);
  });

  // Georgia turned 1,851 `#REF!` cells into the number 23. Never again.
  it('refuses an Excel error cell rather than reading it as a number', () => {
    expect(() => assertNotError({ error: '#REF!' }, 'here')).toThrow(/Excel error cell/);
    expect(() => assertNotError('#DIV/0!', 'here')).toThrow(/Excel error text/);
  });
});

describe('source naming and axes', () => {
  it('names the two datasets distinctly and records the financing exclusion', () => {
    expect(sourceNameFor('revenue', 2024))
      .toBe(`${SOURCE_PREFIX} — Revenue by Source (FY2024 actual, county only, excl. bond and lease proceeds)`);
    expect(sourceNameFor('operating', 2024))
      .toBe(`${SOURCE_PREFIX} — Expenditure by Function (FY2024 actual, county only)`);
  });

  // ⚠ The file URL is stamped with the month RFA last revised it and has moved
  // once already; the landing page is what a reader can navigate to.
  it('cites the durable landing page, not the dated file path', () => {
    expect(SOURCE_URL).toBe('https://rfa.sc.gov/data-research/local-government/finance');
    expect(SOURCE_URL).not.toMatch(/\.xls$/);
  });

  /**
   * ⚠ `unknown` is DELIBERATE and must not be "tidied" to all_funds. The report
   * drops utility sales REVENUE while keeping utility spending, so the two sides
   * are on different scopes by construction — which is why RFA itself says the
   * data should not be used to relate revenues to expenditures.
   */
  it('records fund_scope as unknown, honestly', () => {
    expect(FUND_SCOPE).toBe('unknown');
    expect(BASIS_VALUE).toBe('actual');
    expect(DERIVATION).toBe('published');
  });

  it('grades every source name it emits, across the whole window', () => {
    for (let fy = SC_LOAD_WINDOW.first; fy <= SC_LOAD_WINDOW.last; fy += 1) {
      for (const ds of ['revenue', 'operating']) {
        expect(gradeFor(sourceNameFor(ds, fy)).value).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
      }
    }
  });

  it('does not claim a grade for a year outside the window', () => {
    expect(gradeFor(sourceNameFor("revenue", 2011)).value).toBe(AUDIT_GRADE.UNKNOWN);
    expect(gradeFor(sourceNameFor("revenue", 2025)).value).toBe(AUDIT_GRADE.UNKNOWN);
  });

  it('does not claim any neighbouring South Carolina source', () => {
    for (const s of ['South Carolina RFA', 'SC RFA Local Government Finance Report',
      'South Carolina RFA Local Government Finance Report']) {
      expect(gradeFor(s).value).toBe(AUDIT_GRADE.UNKNOWN);
    }
  });
});

describe('the South Carolina roster', () => {
  it('holds the four session-6a entities', () => {
    expect(SC_ENTITIES.map((e) => e.key).sort())
      .toEqual(['columbia', 'horry-county', 'myrtle-beach', 'richland-county']);
  });

  /**
   * ⚠⚠ THE SOURCE PUBLISHES NO INDIVIDUAL MUNICIPALITY. Each county sheet's
   * "Cities only" block is every city in the county summed — its own footnote
   * lists them. Only the counties may reach this loader.
   */
  it('routes only the counties through the bulk loader', () => {
    expect(CITY_BLOCKS_ARE_AGGREGATES).toBe(true);
    expect(scBulkEntities().map((e) => e.key)).toEqual(['richland-county', 'horry-county']);
    for (const c of ['columbia', 'myrtle-beach']) {
      expect(scEntityByKey(c).source).toBe(SC_SOURCE.CITY_ACFR);
    }
  });

  // ⚠ SOURCE_CHIP_ENTITY_TYPES omitted `city` for months with every gate green.
  it('types every entity so the provenance chip renders', () => {
    for (const e of SC_ENTITIES) expect(SOURCE_CHIP_ENTITY_TYPES).toContain(e.entityType);
  });

  // FAC actively confirms month 7 for all four; the publisher warns the month is
  // NOT uniform ("fiscal year ended on or before June 30"), so this is evidence.
  it('carries an explicit fiscal month on every entity', () => {
    for (const e of SC_ENTITIES) expect(e.fiscalYearStartMonth).toBe(7);
  });

  // ⚠ The FAC census holds Columbia in MO (month 10), CT, IL, KY, LA, MS and NC,
  // and Richland in GA, MS, MT and IL. The join is censusName + state.
  it('records a censusName for every entity', () => {
    for (const e of SC_ENTITIES) expect(e.censusName).toBeTruthy();
  });

  it('points each city at its parent county', () => {
    expect(scEntityByKey('columbia').parentCountyKey).toBe('richland-county');
    expect(scEntityByKey('myrtle-beach').parentCountyKey).toBe('horry-county');
  });

  // The floor is a scope decision: bonds/leases and county local option sales tax
  // both changed definition at FY2012.
  it('floors the window at FY2012, matching the library', () => {
    expect(SC_LOAD_WINDOW.first).toBe(SC_LOAD_FLOOR);
    expect(SC_LOAD_WINDOW.first).toBe(2012);
    expect(SC_LOAD_WINDOW.last).toBe(2024);
  });
});

describe('workbook structure constants', () => {
  it('names the county-only blocks the loader slices', () => {
    expect(BLOCK.COUNTY_REVENUE).toBe('Total Revenues (County only)');
    expect(BLOCK.COUNTY_EXPENDITURE).toBe('Total Expenditures (County only)');
  });

  it('excludes every non-county sheet from the statewide oracle', () => {
    for (const s of ['State Summary', 'County Info', 'Municipal Info', 'About the Report']) {
      expect(NON_COUNTY_SHEETS.has(s)).toBe(true);
    }
    expect(NON_COUNTY_SHEETS.has('Richland')).toBe(false);
  });
});
