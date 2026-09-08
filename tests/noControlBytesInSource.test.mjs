import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ── ⚠⚠ A HEREDOC SMUGGLED A BACKSPACE BYTE INTO A REGEX, TWICE ──────────────
 *
 * `scripts/buildInCountyFacRoster.mjs` shipped `/^STATE OF INDIANA\b/` where the
 * `\b` was a LITERAL BACKSPACE (0x08), not the two-character escape. A quoted
 * bash heredoc ate one backslash, python's non-raw string turned the remainder
 * into chr(8), and the regex became unmatchable.
 *
 * ⚠ IT WAS INVISIBLE EVERY WAY IT WAS LOOKED AT. `sed` printed the line as
 * `/^STATE OF INDIANA/`. The Read tool printed the same. `Function.toString()`
 * at runtime printed the same. Only `od -c` showed the byte. Meanwhile the
 * roster it fed reported 88 of 92 counties covered — a plausible number — with
 * Marion County absent.
 *
 * ⭐⭐ AND THE FIRST RUN OF THIS GUARD FOUND THE SAME BUG ALREADY ON MAIN:
 * `scripts/buildFacFiscalYearCensus.mjs:357` carried `/<BS>PARISH<BS>/i`, meant
 * to be `/\bPARISH\b/i`. That predicate was ALWAYS FALSE, so Louisiana parish
 * naming fell through to `stateCode === 'LA'` — which is the only reason the
 * 50-state fiscal calendar census came out right. Latent, not active, and it had
 * shipped.
 *
 * reference_heredoc_eats_backslashes already says to use the Write tool for any
 * content carrying escapes. This is the guard for when that advice is ignored.
 *
 * ⚠ TAB, LF and CR are legitimate. So is FORM FEED (0x0c): `pdftotext` emits it
 * as a page separator and `acfrGF.selftest.py` embeds real extractor output as a
 * fixture. Everything else in the C0 range is a mistake in this codebase.
 *
 * ⚠⚠ THE PATTERN IS BUILT FROM ESCAPE SEQUENCES, NEVER FROM LITERAL BYTES —
 * the first draft of this very file wrote the control characters literally into
 * its own character class and flagged ITSELF. A guard that cannot survive its
 * own rule is not a guard.
 */
const ALLOWED = new Set([0x09, 0x0a, 0x0d, 0x0c]);
const ROOTS = ['scripts', 'tests', 'src'];
const EXTS = ['.mjs', '.js', '.ts', '.tsx', '.py', '.json'];

/** First offending code point in `text`, or -1. */
export function firstControlByte(text) {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x20 && !ALLOWED.has(c)) return i;
  }
  return -1;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

describe('no stray control bytes in source', () => {
  const files = ROOTS.flatMap((r) => {
    try { return walk(r); } catch { return []; }
  });

  it('sweeps a real corpus, so a pass means something', () => {
    // ⚠ A guard that measured nothing would pass silently — the shape this
    // project keeps rediscovering. Assert the sweep actually found files.
    expect(files.length).toBeGreaterThan(200);
  });

  it('finds no C0 control byte other than tab, LF, CR and form feed', () => {
    const offenders = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      const at = firstControlByte(text);
      if (at < 0) continue;
      const line = text.slice(0, at).split('\n').length;
      const hex = text.charCodeAt(at).toString(16).padStart(2, '0');
      offenders.push(`${f}:${line} contains 0x${hex}`);
    }
    expect(offenders).toEqual([]);
  });

  // Mutation-proof: the matcher must actually reject what it claims to.
  it('would catch the byte that caused this, and allows the legitimate ones', () => {
    expect(firstControlByte(`/^STATE OF INDIANA${String.fromCharCode(0x08)}/`)).toBeGreaterThan(-1);
    expect(firstControlByte(`/${String.fromCharCode(0x08)}PARISH/i`)).toBeGreaterThan(-1);
    expect(firstControlByte('/^STATE OF INDIANA\\b/')).toBe(-1);
    expect(firstControlByte('tabs\tnewlines\nreturns\r formfeed\f are fine')).toBe(-1);
    expect(firstControlByte(String.fromCharCode(0x00))).toBe(0);
  });
});
