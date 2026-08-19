import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * REGRESSION GUARD for a silent, self-concealing data bug — not a style rule.
 *
 * `fetchScopeRows` paged `.range(from, from + 999)` over
 * `.order('municipality_id').order('fiscal_year')`. That is NOT a total order:
 * 79,840 of 79,939 rows tie on it, because every city-year carries at least an
 * operating and a revenue row. LIMIT/OFFSET paging over a non-total order is
 * undefined — Postgres may break ties differently between the query for page N
 * and the query for page N+1, so one row comes back TWICE and another is
 * skipped.
 *
 * What makes it vicious is that it hides itself: the duplicate and the miss
 * cancel, so `rows.length` stays exactly right while the row SET is wrong. On
 * 2026-08-18 it surfaced as verify-fund-scope.mjs reporting "FIGURE DIGEST
 * MOVED" — the project's loudest alarm — against a database in which nothing had
 * changed. The tally was off by exactly one in two buckets, the frozen row count
 * was unchanged, and six re-runs plus a registry-vs-stored drift check came back
 * clean.
 *
 * The `municipalities` loop in the same function had NO ordering at all.
 *
 * The invariant: a paged read must end its ordering on the primary key, which
 * makes the order total and paging deterministic by construction.
 */
describe('every paged read orders by a total key', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));

  /** Files that page with .range(...) in a loop. Derived, not hard-coded. */
  function pagedFiles() {
    const out = [];
    for (const dir of [['scripts'], ['scripts', 'lib']]) {
      const d = path.join(root, ...dir);
      for (const f of readdirSync(d)) {
        if (!/\.(mjs|js)$/.test(f)) continue;
        const p = path.join(d, f);
        const src = readFileSync(p, 'utf8');
        if (/\.range\(\s*from\s*,/.test(src)) out.push({ rel: [...dir, f].join('/'), src });
      }
    }
    return out;
  }

  // ⚠ EXPLICIT TIMEOUTS throughout this file: every test here walks the source
  // tree and reads files, so its duration tracks disk contention rather than any
  // property of the code under test. vitest's default 5s then fails a passing
  // test whenever the machine is busy.
  //
  // `noUnconstrainedBudgetSums.test.mjs` already carries `}, 30_000)` for exactly
  // this reason -- SCOPE-02 hit the flake, fixed the instance, and left the
  // siblings that do the same thing unprotected. Measured 2026-08-19: 153ms idle,
  // 445ms under moderate load, and the failing runs showed ~8x.
  it('finds the paged readers at all, so this cannot pass vacuously', () => {
    expect(pagedFiles().length).toBeGreaterThan(0);
  }, 30_000);

  it("scopeDb's budgets read is ordered by id last", () => {
    const src = readFileSync(path.join(root, 'scripts', 'lib', 'scopeDb.mjs'), 'utf8');
    // the ordering chain immediately preceding the paged .range must end in id
    const chains = [...src.matchAll(/((?:\.order\('[a-z_]+'\)\s*)+)\.range\(\s*from\s*,/g)];
    expect(chains.length).toBeGreaterThan(0);
    for (const c of chains) {
      const orders = [...c[1].matchAll(/\.order\('([a-z_]+)'\)/g)].map((m) => m[1]);
      expect(orders.at(-1), `ordering chain ${orders.join(' -> ')} must end on the primary key`)
        .toBe('id');
    }
  }, 30_000);

  it('no paged .range in scopeDb is left with no ordering at all', () => {
    const src = readFileSync(path.join(root, 'scripts', 'lib', 'scopeDb.mjs'), 'utf8');
    const ranges = [...src.matchAll(/\.range\(\s*from\s*,/g)].length;
    const orderedRanges = [...src.matchAll(/\.order\('[a-z_]+'\)\s*\.range\(\s*from\s*,/g)].length;
    expect(orderedRanges).toBe(ranges);
  }, 30_000);
});
