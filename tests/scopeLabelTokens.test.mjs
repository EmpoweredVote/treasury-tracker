import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TONE } from '../src/components/ScopeLabel.tsx';
import { FUND_SCOPE_VALUES } from '../src/data/fundScopeVocabulary.ts';

/**
 * Guard: every colour class on the scope chip must name a token that exists.
 *
 * SCOPE-01 UAT found ScopeLabel styled against an `ev-blue` scale this project
 * has never had, and against `ev-gray-50` where the token is `ev-gray-050`.
 * All six classes were dropped, so the three VERIFIED scopes rendered with no
 * background and a border falling back to currentColor — leaving the
 * "scope not established" chip as the softest one on the page, the exact
 * inversion of the component's purpose.
 *
 * Nothing caught it: Tailwind discards an unknown colour class silently, the
 * build stayed clean, and all 298 tests passed. A rendering test would not have
 * caught it either — Vitest runs in a `node` environment here and does not run
 * Tailwind at all. The only cheap check that works is comparing the class names
 * against the token list in index.css, which is what this does.
 *
 * ⚠ This lives in tests/*.mjs, NOT under src/, for two reasons that both bit
 * once: src is compiled by tsconfig.app.json with `types: ["vite/client"]` and
 * no node types, so a `node:fs` import there passes a bare `tsc --noEmit` but
 * fails the `tsc -b` that CI runs; and `import css from '../index.css?raw'` —
 * the obvious way to avoid node:fs — resolves to an EMPTY STRING under
 * vitest.config.ts, which registers no CSS plugin. The empty string is why the
 * first assertion below checks that the parse found anything at all.
 */

const CSS = readFileSync(
  fileURLToPath(new URL('../src/index.css', import.meta.url)),
  'utf8',
);

/** Every `--color-<name>` custom property declared in index.css. */
const DEFINED = new Set(
  [...CSS.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
);

/** `dark:bg-ev-skyblue-900/30` → `ev-skyblue-900` */
function tokenOf(cls) {
  const bare = cls.replace(/^[a-z-]+:/, '').replace(/\/\d+$/, '');
  const m = bare.match(/^(?:bg|text|border)-(.+)$/);
  return m ? m[1] : null;
}

describe('ScopeLabel colour tokens', () => {
  it('index.css actually parsed', () => {
    // Not ceremony: `?raw` silently yielded '' here, which would have made
    // every assertion below pass vacuously by finding no classes to reject.
    expect(DEFINED.size).toBeGreaterThan(20);
    expect(DEFINED.has('ev-gray-050')).toBe(true);
    // The scale the original code reached for, recorded so the failure is legible.
    expect(DEFINED.has('ev-blue-50')).toBe(false);
  });

  it.each(FUND_SCOPE_VALUES)('%s chip uses only tokens that exist', (scope) => {
    const classes = TONE[scope].split(/\s+/).filter(Boolean);
    expect(classes.length).toBeGreaterThan(0);

    const unknownTokens = classes
      .map((cls) => ({ cls, token: tokenOf(cls) }))
      .filter((x) => x.token !== null && !DEFINED.has(x.token))
      .map((x) => x.cls);

    expect(unknownTokens).toEqual([]);
  });

  it('every scope is styled, and unknown is styled differently from the verified ones', () => {
    for (const scope of FUND_SCOPE_VALUES) expect(TONE[scope]).toBeTruthy();

    // The whole point of the chip: a reader can tell verified from unverified
    // without reading the words.
    const verified = FUND_SCOPE_VALUES.filter((s) => s !== 'unknown');
    for (const s of verified) expect(TONE[s]).not.toBe(TONE.unknown);
    expect(new Set(verified.map((s) => TONE[s])).size).toBe(1); // verified levels share one tone
  });
});
