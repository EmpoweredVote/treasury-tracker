/**
 * The guard that stands between `dedup: 'occurrence'` and money a city never
 * spent.
 *
 * ⚠⚠ `occurrence` keeps every copy of an identical row. That is right for a
 * 132-line uniform-rental invoice and catastrophic for a day the publisher
 * exported twice, and the publisher's own Total row cannot tell them apart
 * (the same report generates both, so a doubled export doubles both). These
 * tests pin the only check that can: the shape of the counts.
 */
import { describe, it, expect } from 'vitest';
import {
  judgeDoubledExportDays,
  describeDoubledDays,
  dayKey,
  MIN_ROWS_TO_CERTIFY,
  MAX_MEAN_MULTIPLICITY,
  MIN_EVEN_SHARE,
} from '../scripts/lib/doubledExportDays.mjs';

const OPTS = { dateColumn: 'check_date', amountColumn: 'amount' };

/** n distinct rows on one date, each appearing `times` times. */
function day(date, n, { times = 1, start = 0, amount = (i) => 100 + i } = {}) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    for (let t = 0; t < times; t += 1) {
      out.push({ check_date: date, vendor: `V${start + i}`, amount: amount(i) });
    }
  }
  return out;
}

describe('dayKey', () => {
  it('reads an ExcelJS Date', () => {
    expect(dayKey(new Date('2019-06-06T00:00:00Z'))).toBe('2019-06-06');
  });

  // ⚠ The shape Plano's CSV actually produces. A naive String(v).slice(0, 10)
  // yields "9/30/2024 " and buckets correctly only by accident.
  it('reads M/D/YYYY with a time suffix', () => {
    expect(dayKey('9/30/2024 12:00:00 AM')).toBe('2024-09-30');
    expect(dayKey('10/6/2023 12:00:00 AM')).toBe('2023-10-06');
  });

  it('passes an ISO string through', () => {
    expect(dayKey('2024-03-18')).toBe('2024-03-18');
  });

  it('does not invent a date for empty input', () => {
    expect(dayKey(null)).toBe('');
    expect(dayKey(undefined)).toBe('');
  });
});

describe('judgeDoubledExportDays — an ordinary file', () => {
  it('certifies nothing when every row is distinct', () => {
    const v = judgeDoubledExportDays(day('2024-03-01', 100), OPTS);
    expect(v.supported).toBe(true);
    expect(v.certified).toEqual([]);
    expect(v.rowsDoubled).toBe(0);
    expect(v.amountDoubled).toBe(0);
  });

  // ⚠⚠⚠ THE CASE THAT MUST NOT FIRE. McKinney 2022-02-04 is 51% duplicate
  // rows and entirely legitimate: one uniform-rental payment with 132 identical
  // $13.60 garment lines. If this test ever goes red the guard has started
  // blocking the exact loads the occurrence policy exists to allow.
  it('clears a day whose duplicates are one many-line invoice', () => {
    const rows = [
      ...day('2022-02-04', 260),                                   // 260 ordinary rows
      ...day('2022-02-04', 1, { times: 132, start: 900, amount: () => 13.6 }),
      ...day('2022-02-04', 1, { times: 92, start: 901, amount: () => 27.2 }),
    ];
    const v = judgeDoubledExportDays(rows, OPTS);
    expect(v.certified).toEqual([]);
    const d = v.days[0];
    expect(d.extra / d.rows).toBeGreaterThan(0.40);   // it DOES look duplicate-heavy
    expect(d.rows / d.distinct).toBeLessThan(MAX_MEAN_MULTIPLICITY); // and sits at ~1.8x
    expect(d.evenShare).toBeLessThan(MIN_EVEN_SHARE); // evenness is the ONLY thing that saves it
  });

  // ⚠⚠ The two statistics that are reported but do NOT decide. A row appearing
  // once has an odd count, so demanding 95% even counts already forces at most
  // 5% appearing once — and forces nearly every distinct row to be duplicated,
  // which puts the extra share above 0.48. Pinned so nobody re-adds them as
  // gates believing they add protection.
  it('has an evenness rule that already implies the once- and extra-share floors', () => {
    const v = judgeDoubledExportDays(day('2019-06-06', 60, { times: 2 }), OPTS);
    const d = v.days[0];
    expect(d.evenShare).toBeGreaterThanOrEqual(MIN_EVEN_SHARE);
    expect(d.onceShare).toBeLessThanOrEqual(1 - MIN_EVEN_SHARE);
    expect(d.extra / d.rows).toBeGreaterThan(0.48);
  });

  // ⚠⚠ REGRESSION. The first version of this check certified Frisco
  // 2023-04-04: 84 rows of ONE distinct line, so 100% even and none appearing
  // once. That is a many-line invoice — precisely what `occurrence` exists to
  // keep — and calling it a doubled export would have blocked a correct load.
  it('clears a day that is one line repeated many times', () => {
    const v = judgeDoubledExportDays(
      day('2023-04-04', 1, { times: 84, amount: () => 35 }), OPTS,
    );
    expect(v.certified).toEqual([]);
    const d = v.days[0];
    expect(d.evenShare).toBe(1);                     // every other signal says doubled
    expect(d.onceShare).toBe(0);
    expect(d.rows / d.distinct).toBeGreaterThan(MAX_MEAN_MULTIPLICITY);
  });

  it('clears a day where a few rows genuinely repeat', () => {
    const rows = [...day('2024-05-02', 90), ...day('2024-05-02', 6, { times: 2, start: 500 })];
    expect(judgeDoubledExportDays(rows, OPTS).certified).toEqual([]);
  });
});

describe('judgeDoubledExportDays — a doubled export', () => {
  it('certifies a day where every row appears exactly twice', () => {
    const v = judgeDoubledExportDays(day('2019-06-06', 243, { times: 2 }), OPTS);
    expect(v.certified).toHaveLength(1);
    const d = v.certified[0];
    expect(d.date).toBe('2019-06-06');
    expect(d.rows).toBe(486);
    expect(d.distinct).toBe(243);
    expect(d.evenShare).toBe(1);
    expect(d.onceShare).toBe(0);
    expect(v.rowsDoubled).toBe(243);
  });

  // ⚠ Frisco 2019-06-04 is 272 of 273 distinct rows even — one row that really
  // did occur three times rides along inside a doubled day. A rule demanding
  // 100% would miss the largest single event in the fleet.
  it('tolerates one odd row inside a doubled day', () => {
    const rows = [...day('2019-06-04', 272, { times: 2 }), ...day('2019-06-04', 1, { times: 3, start: 800 })];
    expect(judgeDoubledExportDays(rows, OPTS).certified).toHaveLength(1);
  });

  it('counts the duplicated money, not the day total', () => {
    const v = judgeDoubledExportDays(day('2020-04-10', 25, { times: 2, amount: () => 1000 }), OPTS);
    expect(v.amountDoubled).toBe(25000);   // 25 extra copies x $1,000, not $50,000
  });

  it('leaves money at zero when no amount column is given', () => {
    const v = judgeDoubledExportDays(day('2020-04-10', 25, { times: 2 }), { dateColumn: 'check_date' });
    expect(v.certified).toHaveLength(1);
    expect(v.amountDoubled).toBe(0);
  });

  it('judges each date independently', () => {
    const rows = [...day('2022-03-18', 30, { times: 2 }), ...day('2022-03-19', 80, { start: 400 })];
    const v = judgeDoubledExportDays(rows, OPTS);
    expect(v.certified.map((d) => d.date)).toEqual(['2022-03-18']);
  });
});

describe('judgeDoubledExportDays — the small-day rule', () => {
  const tiny = (date) => day(date, 1, { times: 2, start: 700, amount: () => 3482404.02 });

  // ⚠ Two identical rows on a two-row day are 100% even with nothing appearing
  // once — the exact signature — and prove nothing whatever.
  it('refuses to certify a tiny day on its own', () => {
    const v = judgeDoubledExportDays(tiny('2022-03-15'), OPTS);
    expect(v.certified).toEqual([]);
    expect(v.days[0].shaped).toBe(true);     // shaped, but not certified
    expect(v.days[0].big).toBe(false);
  });

  // ⭐ This is Plano's TMRS pair: $3,482,404.02 twice on a two-row day, three
  // days before a 1,082-row day that is 100% even.
  it('certifies a tiny day inside the window of a big one', () => {
    const v = judgeDoubledExportDays([...tiny('2022-03-15'), ...day('2022-03-18', 30, { times: 2 })], OPTS);
    expect(v.certified.map((d) => d.date)).toEqual(['2022-03-15', '2022-03-18']);
    expect(v.certified[0].spillover).toBe(true);
    expect(v.certified[1].spillover).toBe(false);
  });

  it('leaves a tiny day alone when the big one is far away', () => {
    const v = judgeDoubledExportDays([...tiny('2022-01-15'), ...day('2022-03-18', 30, { times: 2 })], OPTS);
    expect(v.certified.map((d) => d.date)).toEqual(['2022-03-18']);
  });

  it('holds the certainty floor where the constant says it does', () => {
    const under = judgeDoubledExportDays(day('2024-01-02', MIN_ROWS_TO_CERTIFY / 2 - 1, { times: 2 }), OPTS);
    const at = judgeDoubledExportDays(day('2024-01-02', MIN_ROWS_TO_CERTIFY / 2, { times: 2 }), OPTS);
    expect(under.certified).toEqual([]);
    expect(at.certified).toHaveLength(1);
  });
});

describe('judgeDoubledExportDays — refusing to guess', () => {
  // ⚠⚠ A check that reports "nothing found" when it never looked is how a gate
  // becomes decoration. These must come back unsupported, not clean.
  it('is unsupported without a date column', () => {
    const v = judgeDoubledExportDays(day('2024-01-01', 50, { times: 2 }), { amountColumn: 'amount' });
    expect(v.supported).toBe(false);
    expect(v.reason).toMatch(/date_column/);
    expect(v.certified).toEqual([]);
  });

  it('is unsupported when every row lands in one unparseable bucket', () => {
    const rows = day('2024-01-01', 50, { times: 2 }).map((r) => ({ ...r, check_date: 'n/a' }));
    const v = judgeDoubledExportDays(rows, OPTS);
    expect(v.supported).toBe(false);
    expect(v.reason).toMatch(/unparseable/);
  });

  it('handles an empty file without claiming a verdict it did not reach', () => {
    const v = judgeDoubledExportDays([], OPTS);
    expect(v.supported).toBe(true);
    expect(v.days).toEqual([]);
  });

  it('still judges a single-date file whose date parses', () => {
    const v = judgeDoubledExportDays(day('2024-01-01', 50, { times: 2 }), OPTS);
    expect(v.supported).toBe(true);
    expect(v.certified).toHaveLength(1);
  });
});

describe('describeDoubledDays', () => {
  it('names the day, the shape and the money', () => {
    const v = judgeDoubledExportDays(day('2019-06-06', 25, { times: 2, amount: () => 400 }), OPTS);
    const [line] = describeDoubledDays(v);
    expect(line).toContain('2019-06-06');
    expect(line).toContain('100% even');
    expect(line).toContain('0% appear once');
    expect(line).toContain('$10,000.00');
  });

  it('marks a spillover day so a reader knows why it counted', () => {
    const rows = [
      ...day('2022-03-15', 1, { times: 2, start: 700 }),
      ...day('2022-03-18', 30, { times: 2 }),
    ];
    const lines = describeDoubledDays(judgeDoubledExportDays(rows, OPTS));
    expect(lines[0]).toContain('[small day inside the window]');
    expect(lines[1]).not.toContain('[small day inside the window]');
  });

  it('says nothing when nothing is certified', () => {
    expect(describeDoubledDays(judgeDoubledExportDays(day('2024-01-01', 50), OPTS))).toEqual([]);
  });
});
