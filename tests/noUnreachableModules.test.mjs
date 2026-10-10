import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⚠⚠ NOTHING NOTICED THAT FOUR CHARTS HAD NO CALLER.
 *
 * `BudgetTree`, `BudgetBar`, `CategoryDetail` and `SpendingBreakdownBar` —
 * 754 lines, one of them a full d3 chart — were unreachable from the app.
 * They were deleted on 2026-10-10 (#251), but the cost of them had already
 * been paid twice over before anyone looked:
 *
 *   • all four were migrated to the shared money ladder in #246, so a whole
 *     refactor was spent on code no reader could reach;
 *   • `BudgetTree` still coloured a drilled level by its ROOT's hue, the exact
 *     defect #247 removed from the sunburst, so reviving it later would have
 *     reintroduced a fixed bug silently.
 *
 * They had ZERO tests between them, which is exactly why they went unnoticed:
 * a dead file breaks nothing and fails nothing. `tsc` is happy — an unused
 * MODULE is not an unused local. The only thing that catches this is asking,
 * from the outside, what the entry point can actually reach.
 *
 * ⚠ This is a REACHABILITY check, not a lint. It walks the import graph from
 * `src/main.tsx` the way the bundler does.
 */

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/** The app's only entry — `index.html` loads exactly this. */
const APP_ENTRY = ['src/main.tsx'];

/**
 * Files that are allowed to exist without the app reaching them.
 *
 * ⚠ Keep this list SHORT and justified. Every entry is a file no reader can
 * get to; "it might be useful later" is what the four deleted charts were.
 */
const ALLOWED_TEST_ONLY = [
  /^src\/.*\/__fixtures__\//,   // shared test data, by construction test-only
  /^src\/.*\.test\.tsx?$/,      // the tests themselves
  // ⚠ AMBIENT DECLARATIONS ARE NEVER IMPORTED. A `.d.ts` is picked up by
  // `tsconfig`'s `include`, not by any import, so reachability says nothing
  // about it. `src/types/ev-ui.d.ts` is the live example and this exemption is
  // why it is not reported.
  /\.d\.ts$/,
];

const SOURCE_EXT = ['.ts', '.tsx', '.css'];
const posix = (p) => p.split(sep).join('/');

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.some((x) => e.name.endsWith(x))) out.push(posix(relative(ROOT, full)));
  }
  return out;
}

/**
 * Every module specifier a file imports, in any form the repo uses:
 * `import x from 'y'`, `export * from 'y'`, bare `import 'y'`, `import('y')`.
 *
 * ⚠ Deliberately textual. A real parser is a dependency, and the cost of a
 * false positive here is a failing test that names the file — cheap to check
 * by hand — while the cost of missing one is the defect this exists to catch.
 */
function specifiers(text) {
  const out = [];
  const patterns = [
    /(?:^|\n)\s*import\s[^;]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*export\s[^;]*?from\s*['"]([^'"]+)['"]/g,
    /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\()?['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) out.push(m[1]);
  }
  return out;
}

/** Resolve a relative specifier to a repo-relative file, or null. */
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null;            // bare / package import
  const base = resolve(ROOT, dirname(fromFile), spec);
  const tries = [base, ...SOURCE_EXT.map((e) => base + e),
    ...SOURCE_EXT.map((e) => join(base, 'index' + e))];
  for (const t of tries) {
    if (existsSync(t) && statSync(t).isFile()) return posix(relative(ROOT, t));
  }
  return null;
}

function reachableFrom(roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let text;
    try { text = readFileSync(join(ROOT, file), 'utf8'); } catch { continue; }
    for (const spec of specifiers(text)) {
      const target = resolveSpec(file, spec);
      if (target && !seen.has(target)) queue.push(target);
    }
  }
  return seen;
}

const allSource = walk(SRC);
const testFiles = allSource.filter((f) => /\.test\.tsx?$/.test(f));
const nodeTests = walk(join(ROOT, 'tests'))
  .concat(readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.test.mjs')).map((f) => `tests/${f}`));

const fromApp = reachableFrom(APP_ENTRY);
const fromTests = reachableFrom([...testFiles, ...new Set(nodeTests)]);

const allowed = (f) => ALLOWED_TEST_ONLY.some((re) => re.test(f));

describe('every module under src/ is reachable from the app', () => {
  it('finds the entry point and a decent slice of the app', () => {
    // ⚠ Guards the guard. A resolver that silently resolves nothing would make
    // every assertion below vacuous — the exact shape of the defect it checks.
    expect(allSource.length).toBeGreaterThan(50);
    expect(fromApp.has('src/main.tsx')).toBe(true);
    expect(fromApp.has('src/App.tsx')).toBe(true);
    expect(fromApp.size).toBeGreaterThan(40);
  });

  it('leaves no module that NOTHING reaches', () => {
    // ⚠⚠ THE FOUR DELETED CHARTS WOULD HAVE FAILED HERE. A file in neither
    // graph is reachable by no reader and exercised by no test.
    const orphans = allSource
      .filter((f) => !fromApp.has(f) && !fromTests.has(f) && !allowed(f))
      .sort();
    expect(orphans).toEqual([]);
  });

  it('leaves no module that only its own TEST reaches', () => {
    // ⚠⚠ THE STRONGER RULE, and the one that matters. A component with a test
    // but no caller still reaches no reader -- the test merely makes it look
    // maintained. `__fixtures__` and the test files themselves are exempt.
    const testOnly = allSource
      .filter((f) => !fromApp.has(f) && fromTests.has(f) && !allowed(f))
      .sort();
    expect(testOnly).toEqual([]);
  });
});
