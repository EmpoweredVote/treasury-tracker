/**
 * `link_key_columns` — which columns make a link key, and in what order.
 *
 * ⚠⚠⚠ THE ORDER IS NOT COSMETIC. The drill-down matches only a LEADING `|`
 * segment, so whichever column comes first is the ONLY axis a reader can ever
 * be given for that source. Plano published a clean fund name and an unusable
 * truncated cost centre, the hardcode put the cost centre first, and Plano
 * therefore had no publishable breakdown at all.
 *
 * ⚠⚠ A link key is also the definition of "the same row" for dedup
 * (`ON CONFLICT`), so changing it for a loaded source re-keys its rows. The
 * tests below exist mostly to pin that NOTHING changes for a source that does
 * not ask.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  linkKey, linkKeyFromMapping, DEFAULT_LINK_KEY_COLUMNS,
} from '../scripts/lib/publisherIds.mjs';

const read = (row) => (name) => (name == null ? undefined : row[name]);

describe('linkKeyFromMapping', () => {
  const row = { dept: 'POLICE', fundname: 'General', cat: 'Supplies' };
  const mapping = { department_column: 'dept', fund_column: 'fundname', expense_category_column: 'cat' };

  it('keeps the historical order when the source says nothing', () => {
    expect(linkKeyFromMapping(mapping, read(row))).toBe('POLICE|General|Supplies');
  });

  it('treats an empty or non-array setting as absent', () => {
    for (const bad of [[], null, undefined, 'fund_column', {}]) {
      expect(linkKeyFromMapping({ ...mapping, link_key_columns: bad }, read(row)))
        .toBe('POLICE|General|Supplies');
    }
  });

  it('uses the declared order when the source gives one', () => {
    const cm = { ...mapping, link_key_columns: ['fund_column', 'department_column'] };
    expect(linkKeyFromMapping(cm, read(row))).toBe('General|POLICE');
  });

  it('can key on a single column', () => {
    const cm = { ...mapping, link_key_columns: ['fund_column'] };
    expect(linkKeyFromMapping(cm, read(row))).toBe('General');
  });

  // ⚠ The whole point for Plano: the fund must be the FIRST segment, because
  // only a leading segment is a prefix the drill-down can match.
  it('puts Plano’s fund first, so a fund root is a matchable prefix', () => {
    const plano = {
      department_column: 'costcentername', fund_column: 'fundname',
      link_key_columns: ['fund_column', 'department_column'],
    };
    const key = linkKeyFromMapping(plano, read({
      costcentername: 'UTILITYMAINTADMINISTRATIO', fundname: 'Water & Sewer',
    }));
    expect(key).toBe('Water & Sewer|UTILITYMAINTADMINISTRATIO');
    expect(key.split('|')[0]).toBe('Water & Sewer');
  });

  // ⚠⚠ Zero is an identifier. McKinney department 0 held $79,113,310.
  it('keeps a zero segment', () => {
    const cm = { department_column: 'd', link_key_columns: ['department_column'] };
    expect(linkKeyFromMapping(cm, read({ d: 0 }))).toBe('0');
  });

  it('is null when every named column is empty', () => {
    const cm = { department_column: 'd', fund_column: 'f' };
    expect(linkKeyFromMapping(cm, read({ d: '', f: null }))).toBeNull();
  });

  it('skips a column the mapping does not name', () => {
    const cm = { fund_column: 'fundname' };
    expect(linkKeyFromMapping(cm, read(row))).toBe('General');
  });
});

/**
 * ⚠⚠⚠ THE EDGE FUNCTION IS THE LIVE PATH — the cron runs it, not the script —
 * and it is Deno, so it cannot import this module. It carries a hand-mirror,
 * and a hand-mirror that drifts is worse than no mirror at all. Same
 * arrangement as socrataRowId.mjs.
 */
describe('the edge function mirrors the rule', () => {
  const src = readFileSync(
    new URL('../supabase/functions/treasury-sync/index.ts', import.meta.url), 'utf8',
  );

  it('declares the same default order, in the same order', () => {
    const m = src.match(/const DEFAULT_LINK_KEY_COLUMNS = \[([^\]]*)\]/);
    expect(m, 'DEFAULT_LINK_KEY_COLUMNS missing from the edge function').not.toBeNull();
    const declared = [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
    expect(declared).toEqual(DEFAULT_LINK_KEY_COLUMNS);
  });

  it('builds the key through the mapping, not from three hardcoded columns', () => {
    expect(src).toMatch(/lk:\s*linkKeyFromMapping\(cm,/);
    // The old hardcode must be gone, or a Socrata source could never re-key.
    expect(src).not.toMatch(/linkKey\(\[cell\(r, cm\.department_column\)/);
  });

  it('reads link_key_columns off the mapping and falls back when absent', () => {
    expect(src).toMatch(/Array\.isArray\(cm\.link_key_columns\)\s*&&\s*cm\.link_key_columns\.length/);
    expect(src).toMatch(/:\s*DEFAULT_LINK_KEY_COLUMNS/);
  });

  it('declares link_key_columns on ColumnMapping', () => {
    expect(src).toMatch(/link_key_columns\?:\s*string\[\]\s*\|\s*null;/);
  });
});
