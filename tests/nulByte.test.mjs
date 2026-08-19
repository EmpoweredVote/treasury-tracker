/**
 * The NUL-byte lint, as a test — so `npm test` enforces it.
 *
 * ⚠ A standalone script nobody runs is how this defect reached FOUR occurrences
 * across three milestones. The gate has to be something already in the loop.
 *
 * Lives in `tests/*.test.mjs`, outside `tsconfig`'s `include`: it reads the
 * filesystem, and a test under `src/` importing `node:fs` passes
 * `tsc --noEmit` and fails `tsc -b`, which is the real CI gate.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  findNulBytes, isTextPath, formatViolation, REMEDY,
} from '../scripts/lib/nulByteLint.mjs';

// ── The detector must be able to FIRE ───────────────────────────────────────
// Without these, the repo scan below passes vacuously the moment the detector
// breaks — which is exactly what happened while developing this lint: a first
// attempt used `LC_ALL=C grep -P '\x00'`, which errors with "supports only
// unibyte and UTF-8 locales" and reported a clean repo it had never read.

describe('findNulBytes — proven able to fire', () => {
  it('finds a NUL and reports its line and column', () => {
    const buf = Buffer.from('clean line\nbefore\u0000after\nlast\n', 'binary');
    const hits = findNulBytes(buf);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
    expect(hits[0].column).toBe(7);
  });

  it('finds several, and counts lines on \\n so CRLF files report editor lines', () => {
    const buf = Buffer.from('a\u0000\r\nb\r\nc\u0000\r\n', 'binary');
    const hits = findNulBytes(buf);
    expect(hits.map((h) => h.line)).toEqual([1, 3]);
  });

  it('returns nothing for clean content', () => {
    expect(findNulBytes(Buffer.from('nothing to see here\n'))).toEqual([]);
  });

  it('does not confuse the two-character text "U+0000" for the byte', () => {
    // The remedy itself must not trip the lint, or fixing a file is impossible.
    expect(findNulBytes(Buffer.from('Write `U+0000`, never the byte.\n'))).toEqual([]);
  });
});

describe('isTextPath', () => {
  it('selects source and prose', () => {
    for (const p of ['src/App.tsx', 'a/b.ts', 'x.mjs', '.planning/STATE.md', 'q.sql', 'r.svg']) {
      expect(isTextPath(p), p).toBe(true);
    }
  });

  it('skips formats that legitimately contain NUL bytes', () => {
    for (const p of ['public/EV-Dark-Logo.png', 'docs/a.pdf', 'x/y.xlsx', 'f.woff2', 'i.jpg']) {
      expect(isTextPath(p), p).toBe(false);
    }
  });

  it('handles a dotfile whose name is its extension', () => {
    expect(isTextPath('.gitignore')).toBe(true);
  });

  it('⚠ does NOT ask git whether the file is binary', () => {
    // Guarding the design, not the code: git calling a file binary is the
    // SYMPTOM being hunted, so it can never also be the filter. A corrupted
    // .ts file must still be examined.
    expect(isTextPath('src/data/budgetSeries.ts')).toBe(true);
  });
});

// ── The actual gate ─────────────────────────────────────────────────────────

/**
 * ⚠ THIS SCANS TRACKED FILES ONLY — `git ls-files` does not list untracked ones.
 *
 * So a brand-new file is invisible to the lint until its first `git add`, and
 * running the suite before staging proves nothing about it. That is not
 * hypothetical: this very lint was written, run green, committed and PUSHED
 * while its own two files were still untracked — both contained literal NUL
 * bytes in their test fixtures and comments, and git stored them as binary.
 * The next run, after they were tracked, failed on them.
 *
 * The lesson is about WHEN the suite runs, not about the scan: run it again
 * after staging. A pre-commit hook would close the gap properly.
 */
describe('the repository contains no raw NUL bytes', () => {
  it('every tracked text file is clean', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    })
      .toString('utf8')
      .split('\0')
      .filter(Boolean);

    // Sanity: the file list must be real. A silently empty list would make this
    // whole test pass while reading nothing -- the vacuous-pass failure mode
    // this repo has hit with `?raw` CSS imports and an uncollected `.test.tsx`.
    expect(tracked.length).toBeGreaterThan(100);

    const candidates = tracked.filter(isTextPath);
    expect(candidates.length).toBeGreaterThan(100);

    const violations = [];
    for (const rel of candidates) {
      let bytes;
      try {
        bytes = readFileSync(new URL(`../${rel}`, import.meta.url));
      } catch {
        continue; // deleted-but-tracked, or a path this platform cannot open
      }
      // Fast path: almost every file is clean, and indexOf is a memchr.
      if (bytes.indexOf(0) === -1) continue;
      violations.push(formatViolation(rel, findNulBytes(bytes)));
    }

    if (violations.length > 0) {
      throw new Error(`\n${violations.join('\n')}\n\n${REMEDY}\n`);
    }
  });
});
