import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ── The tree item contract, enforced across every loader ──
 *
 * `_treasury_insert_tree` persists each tree item as:
 *
 *     approved_amount := (i->>'aa')::numeric
 *     actual_amount   := (i->>'a')::numeric
 *
 * ⚠ THE TRAP, and it has now caused four separate defects: at NODE level the key `a`
 * IS the rollup amount and correctly holds the budget figure, while one line below at
 * ITEM level `a` is actual_amount. Same letter, two meanings. Every loader that got
 * this wrong wrote its ADOPTED BUDGET into actual_amount and rendered as
 * "Budgeted $0 / Actual $X" with a nonsense variance:
 *
 *   PR #83  Dallas          PR #85  San Francisco (4 shared loaders)
 *   PR #91  Sacramento, San Diego
 *   PR #92  105 rows / 102 sources
 *   this    22 rows holding BOTH columns, across 7 publishers
 *
 * This test is a source-level guard, not a behavioural one: these loaders are CLI
 * scripts that fetch PDFs and hit Supabase, so they cannot be executed here. It reads
 * every loader and fails if a tree item puts an explicitly budget-named value into
 * `a`, or an explicitly actual-named value into `aa`.
 *
 * ⚠ Deliberately NARROW. A bare `amount` is NOT treated as budget-named: the state
 * ACFR loaders emit `{ a: li.amount, aa: null }` for ACTUALS datasets and are
 * CORRECT. An earlier, looser version of this scan flagged 138 of 191 emissions,
 * nearly all of them false — the same "confidently wrong about every source" failure
 * scripts/lib/sourceMappingChecks.mjs already has history with. Only unambiguous
 * words count, and the exceptions below are listed by name with a reason.
 */

const ITEM_LITERAL = /\{[^{}]*\bd:\s*[^{}]*\baa:\s*[^{}]*\}/gs;
const BUDGET_WORD = /adopted|approved|proposed|budget/i;
const ACTUAL_WORD = /actual/i;

/**
 * Emissions that legitimately place the same value in both slots, because the source
 * publishes one figure that IS both the budget and the outturn.
 */
const ALLOWED = new Set([
  'scripts/loadCountyBudget.js',
  'scripts/loadLACountyOperating.js',
  'scripts/loadLACountyRevenue.js',
  'scripts/loadLACountySalaries.js',
  'scripts/processAllenBudget.js',
]);

function loaderFiles() {
  return readdirSync('scripts', { withFileTypes: true })
    .filter((e) => e.isFile() && (e.name.endsWith('.js') || e.name.endsWith('.mjs')))
    .map((e) => join('scripts', e.name).replace(/\\/g, '/'));
}

/** Every `{ d: …, a: X, aa: Y }` literal in a file, with comments stripped. */
function itemEmissions(path) {
  const src = readFileSync(path, 'utf8');
  const out = [];
  for (const m of src.matchAll(ITEM_LITERAL)) {
    const bare = m[0].replace(/\/\/[^\n]*/g, '');
    const one = bare.split(/\s+/).join(' ');
    const a = /\ba:\s*([^,}]+)/.exec(one);
    const aa = /\baa:\s*([^,}]+)/.exec(one);
    if (!a || !aa) continue;
    out.push({
      path,
      line: src.slice(0, m.index).split('\n').length,
      a: a[1].trim(),
      aa: aa[1].trim(),
    });
  }
  return out;
}

const EMISSIONS = loaderFiles().flatMap(itemEmissions);

describe('tree item contract: aa is approved_amount, a is actual_amount', () => {
  it('finds tree item emissions to check (the scan itself must not silently match nothing)', () => {
    // A guard that matches nothing passes forever. This is the control.
    expect(EMISSIONS.length).toBeGreaterThan(100);
  });

  it('never puts a budget-named value in `a` (which is actual_amount)', () => {
    const bad = EMISSIONS
      .filter((e) => !ALLOWED.has(e.path))
      .filter((e) => BUDGET_WORD.test(e.a) && !ACTUAL_WORD.test(e.a))
      .map((e) => `${e.path}:${e.line} a=${e.a}`);
    expect(bad).toEqual([]);
  });

  it('never puts an actual-named value in `aa` (which is approved_amount)', () => {
    const bad = EMISSIONS
      .filter((e) => !ALLOWED.has(e.path))
      .filter((e) => ACTUAL_WORD.test(e.aa) && !BUDGET_WORD.test(e.aa))
      .map((e) => `${e.path}:${e.line} aa=${e.aa}`);
    expect(bad).toEqual([]);
  });

  it('still recognises the inverted shape when it sees one', () => {
    // Verifying the gate against a case we KNOW is broken. A gate nobody has watched
    // fail is not a gate — the lesson from tests/syncAuth.test.mjs.
    const inverted = { a: 'adopted', aa: 'actual' };
    expect(BUDGET_WORD.test(inverted.a) && !ACTUAL_WORD.test(inverted.a)).toBe(true);
    expect(ACTUAL_WORD.test(inverted.aa) && !BUDGET_WORD.test(inverted.aa)).toBe(true);

    // ...and does NOT flag the correct shape, nor an actuals dataset's `a: amount`.
    const correct = { a: 'actual', aa: 'adopted' };
    expect(BUDGET_WORD.test(correct.a) && !ACTUAL_WORD.test(correct.a)).toBe(false);
    expect(ACTUAL_WORD.test(correct.aa) && !BUDGET_WORD.test(correct.aa)).toBe(false);

    const actualsDataset = { a: 'li.amount', aa: 'null' };
    expect(BUDGET_WORD.test(actualsDataset.a)).toBe(false);
  });
});
