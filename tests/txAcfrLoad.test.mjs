import { describe, it, expect } from 'vitest';
import { toBudgetTree, assertProjection } from '../scripts/lib/acfrGfLoad.mjs';
// From the LIB, not from scripts/fetchAustinTravis.mjs: that file starts with a
// shebang, and tests/waSao.test.mjs forbids a test from importing any module
// that does (a CRLF checkout turns `#!/usr/bin/env node\r` into an
// unresolvable interpreter path). That guard caught this exact import.
import { austinUrl, travisUrls } from '../scripts/lib/txAcfrSources.mjs';

describe('toBudgetTree — revenue (flat)', () => {
  const extracted = {
    n: 'General Fund', a: 300,
    c: [{ n: 'Property taxes', a: 200 }, { n: 'Sales taxes', a: 100 }],
  };

  it('maps each revenue source to a category holding one leaf item', () => {
    const { tree, total, rowCount } = toBudgetTree(extracted, 'revenue');
    expect(tree).toEqual([
      { n: 'Property taxes', a: 200, i: [{ d: 'Property taxes', a: 200, aa: null, f: null, e: null }] },
      { n: 'Sales taxes', a: 100, i: [{ d: 'Sales taxes', a: 100, aa: null, f: null, e: null }] },
    ]);
    expect(total).toBe(300);
    expect(rowCount).toBe(2);
  });
});

describe('toBudgetTree — operating (2-level)', () => {
  it('turns a parent with children into a category whose items are those children', () => {
    const { tree, total, rowCount } = toBudgetTree({
      n: 'General Fund', a: 90,
      c: [{ n: 'Current', a: 90, c: [{ n: 'Public safety', a: 60 }, { n: 'Public health', a: 30 }] }],
    }, 'operating');
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('Current');
    expect(tree[0].i.map((i) => i.d)).toEqual(['Public safety', 'Public health']);
    expect(total).toBe(90);
    expect(rowCount).toBe(2);
  });

  it('keeps a VALUED ROOT LEAF at the root as its own single-item category', () => {
    // This is the shape the FY2022 Austin nesting bug produced wrongly: with a
    // too-specific root_leaves prefix, "Lease financing principal" became a
    // CHILD of Debt service and this root category vanished — while the total,
    // and therefore the tie, stayed identical. The mapping must preserve
    // whatever level the extractor reports.
    const { tree, total, rowCount } = toBudgetTree({
      n: 'General Fund', a: 75,
      c: [
        { n: 'Current', a: 70, c: [{ n: 'Public safety', a: 70 }] },
        { n: 'Lease financing principal', a: 5 },
      ],
    }, 'operating');
    expect(tree.map((n) => n.n)).toEqual(['Current', 'Lease financing principal']);
    expect(tree[1].i).toEqual([{ d: 'Lease financing principal', a: 5, aa: null, f: null, e: null }]);
    expect(total).toBe(75);
    expect(rowCount).toBe(2);
  });

  it('REFUSES a three-level tree instead of silently dropping the grandchildren', () => {
    // ⚠⚠ The RPC shape this produces is category -> items, exactly two levels,
    // so a grandchild has nowhere to go. It used to be mapped away in silence:
    // `child.c.map((gc) => ({ d: gc.n, a: gc.a }))` publishes the SUB-GROUP as
    // the item and discards every leaf under it, while `a` still rolls up, so
    // the total, the tie and `assertProjection` all stay green. Same defect
    // `toRpcTree` in loadScCityAcfrs.mjs carried until it was fixed.
    //
    // It became REACHABLE when acfrGfCoords learned to read more than two
    // levels off the printed indentation (Summerville SC prints
    // `Current:` > `General Government:` > `Administrative`). Loaders that need
    // to flatten such a tree deliberately already have `toBudgetTree3`, which
    // keeps the top function as the category and lifts every descendant leaf
    // into it; this function must not make that choice by accident.
    expect(() => toBudgetTree({
      n: 'General Fund', a: 90,
      c: [{
        n: 'Current', a: 90,
        c: [{ n: 'General Government', a: 90, c: [{ n: 'Administrative', a: 90 }] }],
      }],
    }, 'operating')).toThrow(/three levels|toBudgetTree3/i);
  });

  it('returns an empty tree rather than throwing on a childless extract', () => {
    expect(toBudgetTree({ n: 'General Fund', a: 0 }, 'operating')).toEqual({ tree: [], total: 0, rowCount: 0 });
    expect(toBudgetTree(null, 'revenue')).toEqual({ tree: [], total: 0, rowCount: 0 });
  });
});

describe('toBudgetTree — GROUPED revenue', () => {
  // ⚠⚠ THE REGRESSION THIS PINS SHIPPED, AND NOTHING DOWNSTREAM COULD SEE IT.
  // The mapper branched on `mode` and ran every revenue root child through the
  // single-item path, on the assumption that revenue is always flat. It is not:
  // `CityConfig.revenue_parents` exists because some issuers group it, and for
  // those the group's CHILDREN were discarded — the category kept its correct
  // group total and published ONE item repeating the group's own name.
  //
  // Measured live on Kodiak Island Borough FY2024: the stored `Intergovernmental`
  // category carries 4,060,437 with `item_count` 1, where the borough's own
  // statement prints two sources under that heading. The total, the tie and the
  // per-capita guard were all green, because the amounts roll up.
  const grouped = {
    n: 'General Fund', a: 300,
    c: [
      { n: 'Intergovernmental', a: 200, c: [{ n: 'Federal', a: 120 }, { n: 'State', a: 80 }] },
      { n: 'Charges for services', a: 100 },
    ],
  };

  it('keeps a revenue GROUP\'s children as its drill-down items', () => {
    const { tree, total, rowCount } = toBudgetTree(grouped, 'revenue');
    expect(tree[0].n).toBe('Intergovernmental');
    expect(tree[0].i.map((i) => i.d)).toEqual(['Federal', 'State']);
    expect(tree[0].i.reduce((s, i) => s + i.a, 0)).toBe(200);
    expect(total).toBe(300);
    expect(rowCount).toBe(3);
  });

  it('leaves an UNGROUPED revenue source as its own single-item category', () => {
    const { tree } = toBudgetTree(grouped, 'revenue');
    expect(tree[1]).toEqual({
      n: 'Charges for services', a: 100,
      i: [{ d: 'Charges for services', a: 100, aa: null, f: null, e: null }],
    });
  });
});

describe('toBudgetTree — opt-in third-level flattening', () => {
  // Northwest Arctic Borough prints `Current:` > `Education:` > `Payments to
  // School District`. The RPC shape holds two levels, so a driver that wants
  // the third one must say so; the default still refuses (pinned above).
  const threeLevel = {
    n: 'General Fund', a: 100,
    c: [{
      n: 'Current', a: 100,
      c: [
        { n: 'General government', a: 40 },
        { n: 'Education', a: 60, c: [{ n: 'Payments to School District', a: 50 }, { n: 'Other', a: 10 }] },
      ],
    }],
  };

  it('lifts every DESCENDANT LEAF into the top category and loses only the heading', () => {
    const { tree, total, rowCount } = toBudgetTree(threeLevel, 'operating', true);
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('Current');
    expect(tree[0].i.map((i) => i.d))
      .toEqual(['General government', 'Payments to School District', 'Other']);
    // ⚠ The middle tier carries no figure of its own, so dropping it cannot
    // move money — the leaves still sum to the category.
    expect(tree[0].i.reduce((s, i) => s + i.a, 0)).toBe(100);
    expect(total).toBe(100);
    expect(rowCount).toBe(3);
  });

  it('still refuses the same tree when the driver has NOT opted in', () => {
    expect(() => toBudgetTree(threeLevel, 'operating')).toThrow(/three levels|toBudgetTree3/i);
  });
});

describe('assertProjection', () => {
  it('rejects a category whose items do not sum to it', () => {
    const projected = {
      tree: [{ n: 'Current', a: 100, i: [{ d: 'A', a: 40 }, { d: 'B', a: 50 }] }],
      total: 100, rowCount: 2,
    };
    expect(() => assertProjection(projected, { n: 'General Fund', a: 100 }, 'FY2024 operating'))
      .toThrow(/items sum to 90/);
  });

  it('rejects a projection whose categories do not sum to the extracted total', () => {
    const projected = {
      tree: [{ n: 'Current', a: 90, i: [{ d: 'A', a: 90 }] }],
      total: 90, rowCount: 1,
    };
    expect(() => assertProjection(projected, { n: 'General Fund', a: 100 }, 'FY2024 operating'))
      .toThrow(/projected total 90 != extracted 100/);
  });
});

describe('austinUrl', () => {
  it('builds the DOWNLOADABLE /content/ path, not the /view/ viewer path', () => {
    // The links published on austintexas.gov are `/view/pdf/<id>/<name>.pdf`,
    // which serve text/html — a pdf.js shell. Fetching one writes a ~24KB HTML
    // file with a .pdf name. Only /content/<id>/pdf/<name>.pdf returns bytes.
    const u = austinUrl(2024);
    expect(u).toContain('/content/');
    expect(u).not.toContain('/view/');
    expect(u.endsWith('.pdf')).toBe(true);
  });

  it('covers FY1998 through FY2025 and returns null outside the manifest', () => {
    for (let fy = 1998; fy <= 2025; fy++) expect(austinUrl(fy)).toBeTruthy();
    expect(austinUrl(1997)).toBeNull();
    expect(austinUrl(2026)).toBeNull();
  });
});

describe('travisUrls', () => {
  it('offers BOTH the acfr and cafr spellings for any year', () => {
    // Travis renamed its files mid-corpus (FY2018 is -cafr.pdf, FY2019 is
    // -acfr.pdf). Hardcoding the boundary would silently drop a year if the
    // county ever relabelled an old file, so both are always tried.
    const urls = travisUrls(2018);
    expect(urls.some((u) => u.endsWith('fy2018-acfr.pdf'))).toBe(true);
    expect(urls.some((u) => u.endsWith('fy2018-cafr.pdf'))).toBe(true);
  });

  it('uses the tctransparency host', () => {
    // `financialtransparency.traviscountytx.gov` is a plausible-looking host
    // that 404s on every path, and is what a summarizing model produced while
    // this milestone was being scoped. The real host is tctransparency.
    for (const u of travisUrls(2024)) {
      expect(u).toContain('tctransparency.traviscountytx.gov');
      expect(u).not.toContain('financialtransparency.');
    }
  });
});
