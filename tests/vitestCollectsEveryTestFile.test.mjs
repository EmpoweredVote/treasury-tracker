import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ⚠⚠ A TEST FILE THAT IS NEVER COLLECTED REPORTS AS A GREEN SUITE.
 *
 * `vitest.config.ts` included only `src` TypeScript tests, so every `.test.tsx`
 * anyone wrote was silently not run — not skipped, not listed, not counted.
 * Nothing says so at any point; the run just comes back passing with one fewer
 * file in it. That is the worst failure shape a harness can have, and it is why
 * this repo carried "no component tests are possible" as a known limitation
 * through two defects a mounted component would have caught on the spot (the
 * icicle's leaf-click level builder, G2 2026-08-22; the bars and the cards
 * disagreeing on colour, 2026-10-10).
 *
 * Adding the glob fixes today. This asserts it STAYS fixed, which the glob
 * cannot do for itself — narrow `include` again and the DOM tests go quiet
 * rather than red, and only a test that reads the config notices.
 *
 * ⚠ Lives in `tests/` because it reads the filesystem. `tsconfig.app.json`
 * types `src` as browser-only (`types: ["vite/client"]`, no node) deliberately,
 * so that app code cannot import `node:fs`, and a guard is not a reason to
 * widen that.
 */

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** The `include` array as `vitest.config.ts` literally spells it. */
function configuredIncludes() {
  const src = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
  const block = src.slice(src.indexOf('include:'));
  const arr = block.slice(block.indexOf('['), block.indexOf(']') + 1);
  return [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Every test file on disk, repo-relative, posix-separated. */
function testFilesOnDisk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) testFilesOnDisk(full, out);
    else if (/\.test\.(ts|tsx|mjs)$/.test(entry.name)) {
      out.push(relative(ROOT, full).split(sep).join('/'));
    }
  }
  return out;
}

/** Minimal glob match for the shapes this config uses. */
function matches(pattern, path) {
  const rx = new RegExp(
    '^' + pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '(?:.*/)?')
      .replace(/\*/g, '[^/]*')
    + '$',
  );
  return rx.test(path);
}

const SWEPT = ['src', 'scripts', 'tests'];

describe('vitest collects every test file that exists', () => {
  const includes = configuredIncludes();

  it('includes a .test.tsx glob at all', () => {
    expect(includes).toContain('src/**/*.test.tsx');
  });

  it('leaves no test file on disk uncollected', () => {
    // ⚠⚠ THE GUARD. Drives from the FILES, not from the config — a pattern
    // nobody wrote is exactly what this has to catch, so asking the config
    // what it covers would be circular.
    const orphans = SWEPT
      .flatMap((d) => testFilesOnDisk(join(ROOT, d)))
      .filter((f) => !includes.some((p) => matches(p, f)));
    expect(orphans).toEqual([]);
  });

  it('finds the files at all, so an empty sweep cannot pass', () => {
    // Without this, a broken walker returns [] and the assertion above is
    // vacuously true — the same shape as the defect it guards against.
    const all = SWEPT.flatMap((d) => testFilesOnDisk(join(ROOT, d)));
    expect(all.length).toBeGreaterThan(150);
    expect(all).toContain('src/components/BudgetIcicle.dom.test.tsx');
  });

  it('proves the matcher can actually fail', () => {
    expect(matches('src/**/*.test.ts', 'src/a/b.test.ts')).toBe(true);
    expect(matches('src/**/*.test.ts', 'src/a/b.test.tsx')).toBe(false);
    expect(matches('src/**/*.test.tsx', 'scripts/a.test.tsx')).toBe(false);
  });
});
