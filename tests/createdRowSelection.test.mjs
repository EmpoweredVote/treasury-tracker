import { describe, it, expect } from 'vitest';
import { rowKey, selectCreatedRows } from '../scripts/lib/createdRowSelection.mjs';

/**
 * ⭐⭐ WHY `--fy` EXISTS. `--match` keys on `name, state :: data_source`, which
 * carries NO fiscal year, so it cannot express a load that EXTENDS an existing
 * series by one year — the entity and the source are already there for every
 * prior year.
 *
 * Measured on the live database 2026-10-31, sizing the CA FY2025 fleet load:
 *
 *   CA State Controller - Expenditures          10,453 rows,  10,425 FROZEN
 *   CA State Controller - Revenues              10,453 rows,  10,437 FROZEN
 *   CA State Controller - County Expenditures    1,188 rows,   1,188 FROZEN
 *   CA State Controller - County Revenues        1,188 rows,   1,188 FROZEN
 *
 * So `--match "CA State Controller - Expenditures"` selects ~10,900 rows
 * against a deficit of ~1,080 and refuses, correctly. `--ids` is the only
 * other selector and the loader never emits ids — the RPC returns
 * `rows_inserted`, not the row id — and 1,080 ids is ~39 KB of argv.
 *
 * ⚠ `--fy` NARROWS, it never widens. It is a filter on `--match` only, so it
 * cannot select a row no match already selected.
 */
const rows = [
  { id: 'a', name: 'Modesto', state: 'CA', data_source: 'CA State Controller - Expenditures', fiscal_year: 2024 },
  { id: 'b', name: 'Modesto', state: 'CA', data_source: 'CA State Controller - Expenditures', fiscal_year: 2025 },
  { id: 'c', name: 'Fresno', state: 'CA', data_source: 'CA State Controller - Revenues', fiscal_year: 2025 },
  { id: 'd', name: 'Fresno', state: 'CA', data_source: 'CA State Controller - Revenues', fiscal_year: 2024 },
  { id: 'e', name: 'Dover', state: 'DE', data_source: 'Somewhere Else', fiscal_year: 2025 },
];

describe('rowKey', () => {
  it('is the key --match substrings are tested against', () => {
    expect(rowKey(rows[0])).toBe('Modesto, CA :: CA State Controller - Expenditures');
  });
});

describe('selectCreatedRows', () => {
  it('selects by match substring when no year is given', () => {
    const out = selectCreatedRows({ rows, matches: ['CA State Controller'], ids: [], fiscalYears: [] });
    expect(out.selected.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(out.perMatch).toEqual([{ match: 'CA State Controller', count: 4 }]);
  });

  // ⭐ THE WHOLE POINT: one year of an existing series, which no substring can isolate.
  it('narrows every match to the given fiscal year', () => {
    const out = selectCreatedRows({ rows, matches: ['CA State Controller'], ids: [], fiscalYears: [2025] });
    expect(out.selected.map((r) => r.id)).toEqual(['b', 'c']);
    expect(out.perMatch).toEqual([{ match: 'CA State Controller', count: 2 }]);
  });

  // ⚠ The per-match count must report what the YEAR FILTER left, not what the
  // substring hit. Reporting the wider number would hide an over-broad match
  // inside a total that happens to reconcile — the thing this tool exists to
  // prevent.
  it('reports each match at its post-filter width', () => {
    const out = selectCreatedRows({
      rows, matches: ['Expenditures', 'Revenues'], ids: [], fiscalYears: [2025],
    });
    expect(out.perMatch).toEqual([
      { match: 'Expenditures', count: 1 },
      { match: 'Revenues', count: 1 },
    ]);
    expect(out.selected.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('accepts several years', () => {
    const out = selectCreatedRows({ rows, matches: ['CA State Controller'], ids: [], fiscalYears: [2024, 2025] });
    expect(out.selected).toHaveLength(4);
  });

  // ⚠⚠ A ROW WITH NO FISCAL YEAR IS NOT A ROW OF EVERY YEAR. The four
  // Virginia APA rows that blocked the LA registration on 2026-10-31 all
  // carried NULL on their own axes; a filter that waves those through files
  // somebody else's rows under your milestone.
  it('never matches a year filter on a row with no fiscal year', () => {
    const withNull = [...rows, { id: 'z', name: 'Nowhere', state: 'VA', data_source: 'Virginia APA Comparative Report', fiscal_year: null }];
    const out = selectCreatedRows({ rows: withNull, matches: ['Virginia APA'], ids: [], fiscalYears: [2025] });
    expect(out.selected).toEqual([]);
  });

  it('still selects a null-year row when no year filter is given', () => {
    const withNull = [...rows, { id: 'z', name: 'Nowhere', state: 'VA', data_source: 'Virginia APA Comparative Report', fiscal_year: null }];
    const out = selectCreatedRows({ rows: withNull, matches: ['Virginia APA'], ids: [], fiscalYears: [] });
    expect(out.selected.map((r) => r.id)).toEqual(['z']);
  });

  // ⚠ The DB returns a number and argv gives a string. Comparing them with ===
  // selects nothing and looks exactly like "the load wrote no rows".
  it('compares a string year from argv against a numeric column', () => {
    const out = selectCreatedRows({ rows, matches: ['CA State Controller'], ids: [], fiscalYears: ['2025'] });
    expect(out.selected.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('counts a row matched by two filters once, and says how many', () => {
    const out = selectCreatedRows({
      rows, matches: ['CA State Controller', 'Expenditures'], ids: [], fiscalYears: [2025],
    });
    expect(out.selected.map((r) => r.id)).toEqual(['b', 'c']);
    expect(out.overlap).toBe(1);
  });

  // ⚠⚠ `--fy` FILTERS MATCHES, NEVER IDS. An id names a row exactly; silently
  // dropping one because of a year filter would select fewer rows than the
  // operator named, which is the failure mode --ids was added to remove.
  it('leaves an explicitly named id alone whatever the year filter says', () => {
    const out = selectCreatedRows({ rows, matches: [], ids: ['a'], fiscalYears: [2025] });
    expect(out.selected.map((r) => r.id)).toEqual(['a']);
    expect(out.unknownIds).toEqual([]);
  });

  it('names an id that is not an unregistered row rather than dropping it', () => {
    const out = selectCreatedRows({ rows, matches: [], ids: ['a', 'nope'], fiscalYears: [] });
    expect(out.unknownIds).toEqual(['nope']);
  });

  it('selects nothing from nothing', () => {
    expect(selectCreatedRows({ rows, matches: [], ids: [], fiscalYears: [] }).selected).toEqual([]);
  });
});
