import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareRow, checkManifest, EXTRACTS } from '../scripts/verifyIndianaGatewayRows.mjs';

/** A stored row and the tree it should rebuild to — the shape, minimal. */
const STORED = {
  total: '1000.00',
  cats: 3, // 2 roots + 1 child
  rootNames: ['Taxes', 'Charges'],
};
const REBUILT = {
  subsetTotal: 1000,
  roots: [{ n: 'Taxes', a: 900, c: [{ n: 'Property', a: 900 }] }, { n: 'Charges', a: 100 }],
};

describe('comparing a stored row against a rebuilt tree', () => {
  it('accepts a row that reproduces exactly', () => {
    expect(compareRow(STORED, REBUILT)).toEqual([]);
  });

  it('catches a moved total', () => {
    const c = compareRow({ ...STORED, total: '1000.01' }, REBUILT);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatch(/^total:/);
  });

  /**
   * ⚠⚠ THE WHOLE POINT: a matching total with a different tree is still a
   * change, and it is the change a reader sees. Each of these keeps the total
   * at 1000 and must still be caught.
   */
  it('catches a tree change that leaves the total untouched', () => {
    // renamed root
    expect(compareRow({ ...STORED, rootNames: ['Tax', 'Charges'] }, REBUILT)
      .some((x) => x.startsWith('root names/order'))).toBe(true);
    // REORDERED roots — same names, same sum
    expect(compareRow({ ...STORED, rootNames: ['Charges', 'Taxes'] }, REBUILT)
      .some((x) => x.startsWith('root names/order'))).toBe(true);
    // a leaf appearing or vanishing under a root
    expect(compareRow({ ...STORED, cats: 4 }, REBUILT)
      .some((x) => x.startsWith('categories'))).toBe(true);
    // a root split in two, summing the same
    expect(compareRow({ ...STORED, rootNames: ['Taxes', 'Charges', 'Other'] }, REBUILT)
      .some((x) => x.startsWith('root names/order'))).toBe(true);
  });

  it('counts a root with no children as one category, not zero', () => {
    // 'Charges' has no `c`, so cats = (Taxes + its 1 child) + Charges = 3.
    expect(compareRow({ ...STORED, cats: 2 }, REBUILT)
      .some((x) => x.startsWith('categories'))).toBe(true);
  });

  it('tolerates float noise but not a cent', () => {
    expect(compareRow(STORED, { ...REBUILT, subsetTotal: 1000.000001 })).toEqual([]);
    expect(compareRow(STORED, { ...REBUILT, subsetTotal: 1000.01 })).toHaveLength(1);
  });
});

describe('refusing a download directory that is not one fetch', () => {
  const files = EXTRACTS.map((g) => g.file);

  function dirWith(manifest, sizes) {
    const d = mkdtempSync(join(tmpdir(), 'ingw-'));
    for (const [f, bytes] of Object.entries(sizes)) writeFileSync(join(d, f), 'x'.repeat(bytes));
    if (manifest) writeFileSync(join(d, 'gateway-manifest.json'), JSON.stringify(manifest));
    return d;
  }

  it('passes when every extract is in the manifest at its recorded size', async () => {
    const sizes = Object.fromEntries(files.map((f, i) => [f, 10 + i]));
    const d = dirWith({
      complete: true, fetched_at: 'T',
      files: Object.fromEntries(files.map((f, i) => [f, { size: 10 + i }])),
    }, sizes);
    const r = await checkManifest(d, files);
    expect(r).toMatchObject({ manifested: true, complaints: [] });
  });

  /**
   * ⚠⚠ The observed hazard: each download overwrites in place, so a run where
   * ONE file fails leaves the previous run's copy under the right name and a
   * plausible size. On 2026-09-05 `disfund_county_ALL.txt` was 7 days older
   * than its neighbours for exactly that reason.
   */
  it('catches a leftover file from an earlier fetch', async () => {
    const sizes = Object.fromEntries(files.map((f, i) => [f, 10 + i]));
    sizes[files[1]] = 999; // that one file is last week's
    const d = dirWith({
      complete: true, fetched_at: 'T',
      files: Object.fromEntries(files.map((f, i) => [f, { size: 10 + i }])),
    }, sizes);
    const r = await checkManifest(d, files);
    expect(r.complaints).toHaveLength(1);
    expect(r.complaints[0]).toMatch(new RegExp(`${files[1]}.*999.*recorded ${10 + 1}`));
  });

  it('catches a file the manifest does not mention at all', async () => {
    const d = dirWith({
      complete: true, fetched_at: 'T',
      files: { [files[0]]: { size: 10 } },
    }, Object.fromEntries(files.map((f) => [f, 10])));
    const r = await checkManifest(d, files);
    expect(r.complaints.length).toBe(files.length - 1);
    expect(r.complaints.every((c) => /leftover from an earlier fetch/.test(c))).toBe(true);
  });

  it('refuses a manifest that admits it is incomplete', async () => {
    const d = dirWith({
      complete: false, fetched_at: 'T',
      files: Object.fromEntries(files.map((f) => [f, { size: 10 }])),
    }, Object.fromEntries(files.map((f) => [f, 10])));
    const r = await checkManifest(d, files);
    expect(r.complaints.some((c) => /INCOMPLETE/.test(c))).toBe(true);
  });

  /**
   * ⚠ No manifest is a WARNING, not a failure — the PR #113-era extracts predate
   * it. But it must not read as a PASS either, so `manifested` says which it was.
   */
  it('reports an unmanifested directory as unproven rather than clean', async () => {
    const d = dirWith(null, Object.fromEntries(files.map((f) => [f, 10])));
    const r = await checkManifest(d, files);
    expect(r).toEqual({ manifested: false, complaints: [] });
  });
});

describe('the extract list', () => {
  it('reads Disbursements by Fund, never the General-Fund-only by-department report', () => {
    expect(EXTRACTS.map((g) => g.file).sort()).toEqual([
      'disfund_city_ALL.txt', 'disfund_county_ALL.txt',
      'rec_city_ALL.txt', 'rec_county_ALL.txt',
    ]);
  });

  it('pairs each kind with both unit types exactly once', () => {
    for (const kind of ['revenue', 'operating']) {
      const g = EXTRACTS.filter((x) => x.kind === kind);
      expect(g.map((x) => x.county).sort()).toEqual([false, true]);
    }
  });
});
