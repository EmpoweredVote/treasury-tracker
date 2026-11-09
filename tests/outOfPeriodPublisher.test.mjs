/**
 * Asking a publisher for its own out-of-period count.
 *
 * ⚠ The whole value of this is that it replaces a frozen number with a live
 * comparison. So the tests that matter are the ones proving a failure to ask
 * NEVER reads as agreement.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  outOfPeriodWhere, publisherOutOfPeriodCount, dateColumnIsComparable, __resetDateTypeCache,
} from '../scripts/lib/outOfPeriodPublisher.mjs';
import { classifyOutOfPeriod, isClean, periodKey } from '../scripts/lib/outOfPeriodRows.mjs';

describe('outOfPeriodWhere', () => {
  const base = {
    dateColumn: 'check_date', fiscalYear: 2026,
    periodStart: '2025-07-01', periodEnd: '2026-07-01',
  };

  /**
   * ⚠⚠ HALF-OPEN, matching treasury.out_of_period_transaction_status(). `<=`
   * on the end bound would disagree with the database by one day of payments.
   */
  it('counts rows before the start or ON/AFTER the end', () => {
    const w = outOfPeriodWhere(base);
    expect(w).toContain("check_date < '2025-07-01T00:00:00'");
    expect(w).toContain("check_date >= '2026-07-01T00:00:00'");
    expect(w).not.toContain('<=');
  });

  /** West Hollywood publishes ONE DATASET PER FILE — there is no year to filter. */
  it('omits the fiscal-year clause when the source skips it', () => {
    const w = outOfPeriodWhere({ ...base, fiscalYearColumn: 'fiscal_year', skipFyFilter: true });
    expect(w).not.toContain('fiscal_year=');
  });

  it('accepts the string "true" as well as the boolean, as the database stores it', () => {
    const asString = outOfPeriodWhere({ ...base, fiscalYearColumn: 'fiscal_year', skipFyFilter: 'true' === 'true' });
    expect(asString).not.toContain('fiscal_year=');
  });

  /**
   * ⚠ LA publishes ONE DATASET FOR NINE YEARS. Without this clause the count
   * returned is every out-of-period row in all of them.
   */
  it('filters by fiscal year when the publisher spans years', () => {
    const w = outOfPeriodWhere({ ...base, fiscalYearColumn: 'fiscal_year' });
    expect(w).toContain("fiscal_year='2026'");
  });

  /**
   * ⚠⚠ QUOTED. Both hosts hold this as text; an unquoted number returns ZERO
   * rows rather than an error — which would read as "the publisher agrees",
   * the worst available way to be wrong.
   */
  it('quotes the fiscal year', () => {
    expect(outOfPeriodWhere({ ...base, fiscalYearColumn: 'fiscal_year' })).toContain("='2026'");
  });

  it('accepts a timestamp as well as a date, and refuses anything else', () => {
    expect(outOfPeriodWhere({ ...base, periodStart: '2025-07-01T00:00:00.000Z' }))
      .toContain("< '2025-07-01T00:00:00'");
    expect(() => outOfPeriodWhere({ ...base, periodStart: 'not-a-date' })).toThrow();
  });

  it('requires a date column rather than guessing one', () => {
    expect(() => outOfPeriodWhere({ ...base, dateColumn: undefined })).toThrow(/dateColumn/);
  });
});

describe('publisherOutOfPeriodCount', () => {
  const socrata = {
    api_type: 'socrata',
    base_url: 'https://data.example.org',
    dataset_id: 'abcd-1234',
    column_mapping: { date_column: 'check_date', skip_fy_filter: true },
  };
  const hit = { fiscal_year: 2026, period_start: '2025-07-01', period_end: '2026-07-01' };

  beforeEach(() => __resetDateTypeCache());

  /**
   * ⚠ Two requests now happen: the column-type check, then the count. A mock
   * that answers only one of them is testing the wrong thing.
   */
  const route = ({ count, type = 'calendar_date', column = 'check_date', metaOk = true }) =>
    async (url) => {
      if (String(url).includes('/api/views/')) {
        return metaOk
          ? { ok: true, json: async () => ({ columns: [{ fieldName: column, dataTypeName: type }] }) }
          : { ok: false };
      }
      return { ok: true, json: async () => [{ count: String(count) }] };
    };

  const okFetch = (n) => route({ count: n });

  it('returns the publisher’s count', async () => {
    expect(await publisherOutOfPeriodCount(socrata, hit, okFetch(6393))).toBe(6393);
  });

  it('asks with the dataset’s OWN date column, not a hardcoded one', async () => {
    let seen = '';
    const inner = route({ count: 1, column: 'date' });
    const spy = async (url, opts) => { if (!String(url).includes('/api/views/')) seen = url; return inner(url, opts); };
    await publisherOutOfPeriodCount(
      { ...socrata, column_mapping: { date_column: 'date', skip_fy_filter: true } }, hit, spy,
    );
    // ⚠ URLSearchParams encodes a space as `+`, which decodeURIComponent does
    // NOT undo — so the query is normalised before asserting on it.
    const q = decodeURIComponent(seen).replace(/\+/g, ' ');
    // ⚠ West Hollywood's two oldest files use `date`; the rest use `check_date`.
    expect(q).toContain('date <');
    expect(q).not.toContain('check_date');
  });

  // ── ⚠⚠⚠ EVERY WAY OF NOT KNOWING MUST RETURN null, NEVER A NUMBER ────────

  it('returns null for a publisher that is not Socrata', async () => {
    expect(await publisherOutOfPeriodCount(
      { ...socrata, api_type: 'xlsx_download' }, hit, okFetch(1),
    )).toBeNull();
  });

  it('returns null when the host refuses', async () => {
    expect(await publisherOutOfPeriodCount(socrata, hit, async () => ({ ok: false }))).toBeNull();
  });

  it('returns null when the host throws', async () => {
    expect(await publisherOutOfPeriodCount(socrata, hit, async () => { throw new Error('dns'); }))
      .toBeNull();
  });

  it('returns null when the answer is not a number', async () => {
    expect(await publisherOutOfPeriodCount(
      socrata, hit, async () => ({ ok: true, json: async () => [{ count: 'lots' }] }),
    )).toBeNull();
  });

  it('returns null when the period is unusable, instead of asking a nonsense question', async () => {
    expect(await publisherOutOfPeriodCount(socrata, { ...hit, period_start: null }, okFetch(1)))
      .toBeNull();
  });

  /**
   * ⚠⚠⚠ THE REAL ONE. Four of West Hollywood's ten registers store check_date
   * as TEXT in MM-DD-YYYY. `check_date < '2023-07-01T00:00:00'` is then a
   * STRING comparison, every value begins with a month digit 0 or 1, so every
   * row sorts below '2' and the publisher answers with the WHOLE FILE.
   *
   * Asked that question, b8ph-69yc returned 23,553 against TT's 5,791 — no
   * error, just a confident wrong number. The only safe answer is "cannot ask".
   */
  it('refuses to ask when the date column is TEXT, rather than believing the answer', async () => {
    expect(await publisherOutOfPeriodCount(socrata, hit, route({ count: 23553, type: 'text' })))
      .toBeNull();
  });

  it('asks when the date column is a real date type', async () => {
    for (const type of ['calendar_date', 'floating_timestamp', 'fixed_timestamp']) {
      __resetDateTypeCache();
      expect(await publisherOutOfPeriodCount(socrata, hit, route({ count: 7, type })), type).toBe(7);
    }
  });

  it('refuses when the metadata does not name the date column at all', async () => {
    expect(await publisherOutOfPeriodCount(socrata, hit, route({ count: 9, column: 'something_else' })))
      .toBeNull();
  });

  it('refuses when the metadata cannot be fetched', async () => {
    expect(await publisherOutOfPeriodCount(socrata, hit, route({ count: 9, metaOk: false })))
      .toBeNull();
  });
});

describe('dateColumnIsComparable', () => {
  const src = (col) => ({
    base_url: 'https://data.example.org', dataset_id: 'abcd-1234',
    column_mapping: { date_column: col },
  });
  const meta = (type) => async () => ({
    ok: true, json: async () => ({ columns: [{ fieldName: 'check_date', dataTypeName: type }] }),
  });

  beforeEach(() => __resetDateTypeCache());

  it('accepts a date, refuses text', async () => {
    expect(await dateColumnIsComparable(src('check_date'), meta('calendar_date'))).toBe(true);
    __resetDateTypeCache();
    expect(await dateColumnIsComparable(src('check_date'), meta('text'))).toBe(false);
  });

  /** ⚠ One metadata request per dataset, not per budget — LA has nine years. */
  it('caches per dataset so a run makes one request', async () => {
    let calls = 0;
    const counting = async (u, o) => { calls += 1; return meta('calendar_date')(u, o); };
    await dateColumnIsComparable(src('check_date'), counting);
    await dateColumnIsComparable(src('check_date'), counting);
    expect(calls).toBe(1);
  });
});

describe('classifyOutOfPeriod — a moved count against the publisher', () => {
  const entry = { municipality: 'West Hollywood', state: 'CA', fiscalYear: 2026, outRows: 1164 };
  const hit = {
    municipality: 'West Hollywood', state: 'CA', fiscal_year: 2026, out_rows: 6393,
    period_start: '2025-07-01', period_end: '2026-07-01',
  };
  const key = periodKey(hit);

  /**
   * ⭐⭐ THE POINT OF THE CHANGE. The city appended 5,229 rows overnight; TT
   * kept up. Failing here is what made this gate cry wolf monthly.
   */
  it('is a NOTICE when the publisher holds exactly what TT now holds', () => {
    const r = classifyOutOfPeriod([hit], [entry], new Map([[key, 6393]]));
    expect(r.publisherConfirmed).toHaveLength(1);
    expect(r.mismatched).toHaveLength(0);
    expect(isClean(r)).toBe(true);
  });

  it('still FAILS when the publisher disagrees', () => {
    const r = classifyOutOfPeriod([hit], [entry], new Map([[key, 20]]));
    expect(r.mismatched).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  /** ⚠⚠⚠ "Could not look" must never read as "looked and agreed". */
  it('still FAILS when the publisher could not be asked', () => {
    for (const counts of [new Map([[key, null]]), new Map()]) {
      const r = classifyOutOfPeriod([hit], [entry], counts);
      expect(r.mismatched).toHaveLength(1);
      expect(r.publisherConfirmed).toHaveLength(0);
      expect(isClean(r)).toBe(false);
    }
  });

  /** ⚠ A count that has NOT moved needs no publisher at all. */
  it('does not consult the publisher when the count still matches', () => {
    const steady = { ...hit, out_rows: 1164 };
    const r = classifyOutOfPeriod([steady], [entry], new Map());
    expect(r.declared).toHaveLength(1);
    expect(isClean(r)).toBe(true);
  });

  /** ⚠ Undeclared stays a hard failure however much the publisher agrees. */
  it('never lets a publisher excuse an undeclared budget', () => {
    const r = classifyOutOfPeriod([hit], [], new Map([[key, 6393]]));
    expect(r.undeclared).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  /** Zero is a real count, not an absent one. */
  it('treats a published zero as an answer', () => {
    const r = classifyOutOfPeriod([{ ...hit, out_rows: 0 }], [entry], new Map([[key, 0]]));
    expect(r.publisherConfirmed).toHaveLength(1);
    expect(isClean(r)).toBe(true);
  });
});
