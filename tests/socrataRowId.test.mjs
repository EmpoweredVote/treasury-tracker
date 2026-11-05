/**
 * The row-id rule, and the pin that keeps the edge function honest.
 *
 * ⚠⚠ These are not style preferences. Each case is the exact shape that let a
 * demand-register BATCH number stand in for a row id, so that West Hollywood
 * held 143 of 134,643 published rows and LA City FY2025 held 226,909 of
 * 749,295 — about $6.06B of spending, with every cron run logging `success`.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  assertRowIdIsUnique, isSystemRowId, orderFor, selectFor, SYSTEM_ROW_ID,
} from '../scripts/lib/socrataRowId.mjs';

describe('isSystemRowId', () => {
  it('recognises Socrata system fields by their colon prefix', () => {
    expect(isSystemRowId(':id')).toBe(true);
    expect(isSystemRowId(':created_at')).toBe(true);
  });

  it('is false for the publisher columns that caused this', () => {
    expect(isSystemRowId('demand')).toBe(false);
    expect(isSystemRowId('transaction_id')).toBe(false);
  });

  it('is false for absent or non-string values rather than throwing', () => {
    expect(isSystemRowId(null)).toBe(false);
    expect(isSystemRowId(undefined)).toBe(false);
    expect(isSystemRowId(42)).toBe(false);
  });
});

describe('selectFor', () => {
  /**
   * ⚠⚠ A PLAIN FETCH DOES NOT RETURN `:id`. Measured against
   * data.weho.org/resource/7kgt-b5t8: 15 keys without the select, 19 with it.
   * Forget this and every row keys as NULL, which disables dedup entirely.
   */
  it('asks for system fields when the row id is one', () => {
    expect(selectFor(':id')).toBe(':*,*');
  });

  it('leaves the default projection alone otherwise', () => {
    expect(selectFor('transaction_id')).toBeNull();
    expect(selectFor(null)).toBeNull();
  });
});

describe('orderFor', () => {
  it('pages by the system row id, which is a total order', () => {
    expect(orderFor(':id')).toBe(SYSTEM_ROW_ID);
  });

  /**
   * ⚠⚠⚠ NULL, NOT THE DATE COLUMN. The loaders used to page by `check_date`.
   * On WeHo 7kgt-b5t8 that column is TEXT holding "01-13-2022" beside
   * "9/9/2021", so it does not even sort chronologically — and paging any
   * non-total order silently skips and repeats rows.
   */
  it('refuses to invent an order when there is no total one', () => {
    expect(orderFor('demand')).toBeNull();
    expect(orderFor(null)).toBeNull();
  });
});

describe('assertRowIdIsUnique', () => {
  it('passes a column that really is 1:1', () => {
    expect(() => assertRowIdIsUnique('S', 'txn_id', 1000, 1000)).not.toThrow();
  });

  it('never second-guesses a system row id', () => {
    expect(() => assertRowIdIsUnique('S', ':id', 1000, 3)).not.toThrow();
  });

  it('does nothing when no row id is declared', () => {
    expect(() => assertRowIdIsUnique('S', null, 1000, 3)).not.toThrow();
  });

  it('refuses the real West Hollywood numbers', () => {
    expect(() => assertRowIdIsUnique('WeHo FY2018-19', 'demand', 24123, 22))
      .toThrow(/NOT unique/);
    expect(() => assertRowIdIsUnique('WeHo FY2018-19', 'demand', 24123, 22))
      .toThrow(/0\.1%/);
  });

  it('refuses the real LA City numbers', () => {
    expect(() => assertRowIdIsUnique('LA City Checkbook', 'transaction_id', 6584328, 1508282))
      .toThrow(/NOT unique/);
  });

  /** ⚠ One duplicate is still a lost row. There is no tolerance band. */
  it('refuses a single collision, not just a catastrophic one', () => {
    expect(() => assertRowIdIsUnique('S', 'c', 1000, 999)).toThrow(/NOT unique/);
  });

  it('refuses when the measurement itself failed, rather than assuming', () => {
    expect(() => assertRowIdIsUnique('S', 'c', NaN, 10)).toThrow(/could not measure/);
    expect(() => assertRowIdIsUnique('S', 'c', 10, undefined)).toThrow(/could not measure/);
  });
});

/**
 * ⚠⚠⚠ THE EDGE FUNCTION IS THE LIVE PATH — the cron runs it, not the script.
 * Deno cannot import from scripts/, so treasury-sync carries a hand copy. If
 * the two drift, the committed fix stops describing what actually runs.
 */
describe('supabase/functions/treasury-sync mirrors this module', () => {
  const src = readFileSync(
    new URL('../supabase/functions/treasury-sync/index.ts', import.meta.url), 'utf8',
  );

  it('keeps the same system-field prefix rule', () => {
    expect(src).toContain('const SYSTEM_ROW_ID = ":id"');
    expect(src).toMatch(/ridCol\.startsWith\(":"\)/);
  });

  it('asks for system fields the same way', () => {
    expect(src).toMatch(/isSystemRowId\(ridCol\) \? ":\*,\*" : null/);
  });

  it('pages by the system row id and NOT the date column', () => {
    expect(src).toMatch(/isSystemRowId\(ridCol\) \? SYSTEM_ROW_ID : null/);
    expect(src).not.toMatch(/fetchPage\([^)]*cm\.date_column/);
  });

  it('still refuses a non-unique declared row id before inserting', () => {
    expect(src).toContain('assertRowIdIsUnique');
    expect(src).toMatch(/count\(distinct \$\{ridCol\}\)/);
  });
});
