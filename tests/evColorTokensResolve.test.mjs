import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ── ⚠⚠ A COLOUR CLASS NAMING AN UNDEFINED TOKEN IS DISCARDED IN SILENCE ─────
 *
 * Tailwind drops a class whose token does not exist. There is no error and no
 * warning. `npm run build` is clean, `tsc` is clean, and the whole suite passes
 * — jsdom never runs Tailwind, so no rendering test can see it either.
 *
 * The element does not fall back to something sane. `bg-*` drops to
 * transparent and, worse, **`border-*` drops to `currentColor`**, so an element
 * whose border colour was dropped renders a HEAVIER border than one that
 * resolved.
 *
 * ⚠ The trap is the light end of each scale: steps there are THREE digits.
 * `ev-gray-050` is real; `ev-gray-50` is nothing.
 *
 * Found twice now. SCOPE-01 UAT: `ScopeLabel.tsx` styled its three verified
 * fund-scope chips `bg-ev-blue-50 text-ev-blue-700 border-ev-blue-200` and its
 * unverified chip `bg-ev-gray-50` — all six classes dropped, the verified chips
 * got dark currentColor borders, and "scope not established" came out the
 * softest thing on the page. Exactly inverted, shipped through 298 green tests.
 * Then again on 2026-09-22: the nonprofit stat tiles shipped `bg-ev-gray-50`
 * and rendered as three columns of floating text on a white card, caught only
 * by looking at the running app.
 *
 * ⚠ THIS IS A GUARD ON THE CLASS, NOT ON THOSE TWO FILES. A new component with
 * a typo'd token is the same defect, so the sweep walks every component rather
 * than listing the ones that have already been caught.
 *
 * ⚠ It is the CHEAP half. It cannot see a token that resolves to the WRONG
 * colour, only one that does not resolve at all. Contrast and layout still need
 * the running app — see project_local_ui_verify_workflow.
 */

const root = join(import.meta.dirname, '..');

/** Token names from `--color-<name>:` declarations in src/index.css. */
const definedTokens = () => {
  const css = readFileSync(join(root, 'src/index.css'), 'utf8');
  return new Set([...css.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map(m => m[1]));
};

/**
 * Comments are stripped first. Several files DISCUSS a wrong class in a warning
 * about why it is wrong, and a guard that flagged its own documentation would
 * push the next person to delete the warning to get green.
 *
 * Line comments are stripped only when they open a line, so a `https://` inside
 * a string is never mistaken for one.
 */
const stripComments = source =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');

const UTILITIES =
  'bg|text|border|decoration|ring|fill|stroke|from|via|to|outline|divide|shadow|accent|caret';

/**
 * `ev-*` tokens named by a colour utility. Any variant prefix (`dark:`,
 * `hover:`, `sm:`) and any `/40` opacity suffix are ignored; arbitrary values
 * (`text-[15px]`) never match, since the capture requires an `ev-` name.
 */
const colorClassTokens = source => {
  const pattern = new RegExp(`(?:^|[\\s:"'\`])(?:${UTILITIES})-(ev-[a-z0-9-]+)`, 'g');
  return [...source.matchAll(pattern)].map(m => m[1]);
};

/** Every .tsx/.ts under src/, without walking node_modules. */
const sourceFiles = async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const out = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== 'node_modules') walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
  };
  walk(join(root, 'src'));
  return out;
};

/**
 * ⛔ PRE-EXISTING, DELIBERATELY NOT FIXED HERE — these are not exemptions.
 *
 * Both dropped classes are real: the elements render transparent today. But
 * `bg-ev-gray-50` → `bg-ev-gray-050` is a VISIBLE change (#F7F7F8 appears where
 * nothing was), on the dataset tabs and a page banner, in components this
 * guard's author was not asked to restyle. Making the guard green by quietly
 * repainting three unrelated elements would be the wrong trade.
 *
 * ⚠ Each entry is asserted to STILL BE BROKEN below. Fix one and this file
 * fails, telling you to delete its line — so the list cannot rot into a
 * permanent exemption.
 */
const KNOWN_PREEXISTING = [
  'src/App.tsx: ev-gray-50',
  'src/components/datasets/DatasetTabs.tsx: ev-gray-50',
];

describe('ev-* colour classes resolve to defined tokens', () => {
  it('every component names only tokens defined in index.css', async () => {
    const tokens = definedTokens();
    const files = await sourceFiles();
    const offenders = [];

    for (const file of files) {
      const used = new Set(colorClassTokens(stripComments(readFileSync(file, 'utf8'))));
      for (const token of used) {
        if (!tokens.has(token)) {
          offenders.push(`${file.slice(root.length + 1).replace(/\\/g, '/')}: ${token}`);
        }
      }
    }

    expect(offenders.filter(o => !KNOWN_PREEXISTING.includes(o)).sort()).toEqual([]);

    // The allowlist must not outlive the defects it names.
    expect(KNOWN_PREEXISTING.filter(k => !offenders.includes(k))).toEqual([]);
  });

  it('actually sees the classes it is guarding', async () => {
    // Without this, a regex that silently stopped matching would leave the
    // sweep above passing forever on an empty list.
    const files = await sourceFiles();
    const all = new Set(
      files.flatMap(f => colorClassTokens(stripComments(readFileSync(f, 'utf8'))))
    );
    expect(all.size).toBeGreaterThan(10);
    expect(all.has('ev-gray-050')).toBe(true); // the nonprofit stat tiles' surface
  });

  it('would catch the two-digit light step Tailwind drops', () => {
    const tokens = definedTokens();
    expect(colorClassTokens('className="bg-ev-gray-50"').filter(t => !tokens.has(t)))
      .toEqual(['ev-gray-50']);
    expect(tokens.has('ev-gray-050')).toBe(true);
  });
});
