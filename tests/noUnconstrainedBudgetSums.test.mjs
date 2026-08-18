import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SCOPE-02 — a city-year may now hold two rows, so any aggregate over
 * treasury.budgets that does not constrain basis can double-count. This is a
 * lint, not a proof: it catches the obvious textual shape, which is what a
 * future contributor is most likely to write by habit.
 *
 * ALLOWLIST holds the aggregates reviewed and deliberately left unconstrained,
 * each with the reason. Adding to it is a decision, not a formality.
 */
const ALLOWLIST = new Set([
  // The digests intentionally cover every row; they are integrity checks, not figures.
  'scripts/lib/scopeVerify.mjs',
]);

/** Manual walk rather than fs.globSync — that needs Node 22 and this must not
 *  depend on the runner's version. */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(mjs|js|ts|tsx)$/.test(e.name)) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const FILES = [...walk('scripts'), ...walk('src')];

describe('no unconstrained sum over treasury.budgets', () => {
  it('every aggregate constrains basis, or is allowlisted with a reason', () => {
    const offenders = [];
    for (const f of FILES) {
      if (ALLOWLIST.has(f.replace(/\\/g, '/'))) continue;
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/sum\(\s*(?:b\.)?total_budget\s*\)/gi)) {
        const window = src.slice(Math.max(0, m.index - 400), m.index + 400);
        if (!/basis/i.test(window)) offenders.push(`${f}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
