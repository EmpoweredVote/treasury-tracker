/**
 * The mirror diff must be SET-BASED.
 *
 * ⚠⚠ `diffFrozenExclusionMirror.mjs` reports 81 ids forever because it
 * compares file by file while the mirror dedupes — the arithmetic ties
 * exactly and the tool can never read clean. A diff that can never be clean
 * is a diff people learn to ignore, so this one is pinned against that shape.
 */

import { describe, it, expect } from 'vitest';
import { diffMirror, mirrorIsClean } from '../scripts/lib/mirrorDiff.mjs';

const row = (axis, id, pattern = `^${id}$`) => ({ axis, entry_id: id, pattern });

describe('diffMirror', () => {
  it('is clean when both sides hold the same set', () => {
    const d = diffMirror([row('basis', 'a'), row('fund_scope', 'b')],
      [row('fund_scope', 'b'), row('basis', 'a')]);
    expect(mirrorIsClean(d)).toBe(true);
    expect(d.same).toBe(2);
  });

  it('reports an entry the registries have and the table does not', () => {
    const d = diffMirror([row('basis', 'a'), row('basis', 'b')], [row('basis', 'a')]);
    expect(d.insert.map((r) => r.entry_id)).toEqual(['b']);
    expect(mirrorIsClean(d)).toBe(false);
  });

  it('reports an entry the table has and the registries no longer do', () => {
    const d = diffMirror([row('basis', 'a')], [row('basis', 'a'), row('basis', 'gone')]);
    expect(d.remove.map((r) => r.entry_id)).toEqual(['gone']);
  });

  it('reports a changed pattern as an update, not an insert plus a remove', () => {
    const d = diffMirror([row('basis', 'a', '^new$')], [row('basis', 'a', '^old$')]);
    expect(d.update.map((r) => r.pattern)).toEqual(['^new$']);
    expect(d.insert).toEqual([]);
    expect(d.remove).toEqual([]);
  });

  // ⚠⚠ THE diffFrozenExclusionMirror SHAPE, PINNED. The same id under two
  // axes is two different rows and must not read as drift; and an id
  // appearing twice on one side must not make the other side look short.
  it('does not report drift when one id appears under two axes', () => {
    const both = [row('basis', 'shared'), row('fund_scope', 'shared')];
    expect(mirrorIsClean(diffMirror(both, [...both].reverse()))).toBe(true);
  });

  // ⚠⚠⚠ THE AXIS IS PART OF THE KEY. Found by mutation testing: with the
  // axis dropped, the two tests above still passed because both sides held
  // the same pair. The case that bites is one side holding the id under TWO
  // axes and the other under ONE — collapsing by entry_id alone makes the
  // missing axis row invisible, and the gate would then trust a mirror that
  // is short an entire axis for that family.
  it('sees a row missing on one axis when the same id exists on another', () => {
    const d = diffMirror(
      [row('basis', 'shared'), row('fund_scope', 'shared')],
      [row('basis', 'shared')],
    );
    expect(d.insert.map((r) => `${r.axis}|${r.entry_id}`)).toEqual(['fund_scope|shared']);
    expect(mirrorIsClean(d)).toBe(false);
  });

  it('does not report drift from a duplicate on one side alone', () => {
    const d = diffMirror([row('basis', 'a'), row('basis', 'a')], [row('basis', 'a')]);
    expect(mirrorIsClean(d)).toBe(true);
  });

  it('treats a missing or null side as empty rather than throwing', () => {
    expect(mirrorIsClean(diffMirror(null, null))).toBe(true);
    expect(diffMirror([row('basis', 'a')], null).insert).toHaveLength(1);
  });
});
