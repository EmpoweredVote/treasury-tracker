import { describe, it, expect } from 'vitest';
import { toBudgetTree } from '../scripts/lib/txAcfrLoad.mjs';
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

  it('returns an empty tree rather than throwing on a childless extract', () => {
    expect(toBudgetTree({ n: 'General Fund', a: 0 }, 'operating')).toEqual({ tree: [], total: 0, rowCount: 0 });
    expect(toBudgetTree(null, 'revenue')).toEqual({ tree: [], total: 0, rowCount: 0 });
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
