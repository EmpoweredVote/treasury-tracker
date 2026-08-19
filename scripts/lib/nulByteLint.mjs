/**
 * The NUL-byte lint.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * A raw `U+0000` written into a source file as a BYTE (rather than as an escape
 * such as `\0` or the text `U+0000`) makes git classify the whole file as
 * **binary**. Git then stops producing a diff for it and `git blame` returns
 * nothing. The file still opens, still compiles, still passes every test — the
 * only thing destroyed is the project's ability to review its own history.
 *
 * It has fired FOUR times across three milestones:
 *   1. SCOPE-01 `scripts/lib/scopeVerify.mjs`
 *   2. SCOPE-02 `src/data/budgetSeries.ts` — caught only by a reviewer hex-dumping
 *      the committed blob, after the diff rendered as `Bin`
 *   3. SCOPE-02, twice more (one self-caught, one caught in review)
 *   4. SCOPE-03 `.planning/STATE.md` — sitting INSIDE the bullet that warns
 *      against NUL bytes, written as a literal while documenting "never write
 *      the byte"
 *
 * SCOPE-02's closeout said "three occurrences is a pattern, not bad luck. It
 * wants a lint." This is that lint.
 *
 * ── WHY AN EXTENSION ALLOWLIST, NOT "ASK GIT IF IT IS BINARY" ───────────────
 * ⚠ Git calling a file binary is the SYMPTOM being hunted, so it cannot also be
 * the filter — a corrupted `.ts` file would be excluded by the very corruption
 * this looks for. Files are selected by extension instead: an explicit list of
 * formats that must never contain a NUL. PNGs, XLSXs and PDFs legitimately
 * contain thousands and are simply never examined.
 *
 * Pure: no filesystem, no git, no process. IO lives in the caller.
 */

/**
 * Extensions whose contents must never contain a NUL byte.
 *
 * Derived from the tracked-file inventory (2026-08-18). Adding a text format
 * here is always safe; the cost of omitting one is that the lint silently stops
 * covering it, so prefer over-inclusion.
 */
export const TEXT_EXTENSIONS = new Set([
  'md', 'js', 'mjs', 'cjs', 'json', 'jsonc', 'tsx', 'ts', 'py', 'sql', 'svg',
  'sh', 'bash', 'css', 'scss', 'yml', 'yaml', 'txt', 'toml', 'patch', 'diff',
  'html', 'htm', 'csv', 'tsv', 'xml', 'ini', 'cfg', 'env', 'gitignore',
  'gitattributes', 'lock', 'map',
]);

/** True when this path is one the lint should examine. */
export function isTextPath(path) {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  // A dotfile with no further extension (`.gitignore`) reads its name as the ext.
  const ext = dot <= 0 ? base.replace(/^\./, '') : base.slice(dot + 1);
  return TEXT_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Every NUL byte in a buffer, located by 1-indexed line and column.
 *
 * Takes a Buffer or Uint8Array and walks BYTES, never a decoded string —
 * decoding an arbitrary file risks replacement characters, which shift every
 * index and make the reported line and column lie.
 *
 * Lines are counted on `\n` (0x0A), so a CRLF file reports the same line
 * numbers an editor shows.
 */
export function findNulBytes(bytes) {
  const hits = [];
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x0a) {
      line++;
      lineStart = i + 1;
      continue;
    }
    if (b === 0x00) hits.push({ line, column: i - lineStart + 1, offset: i });
  }
  return hits;
}

/** Human-readable report for one offending file. */
export function formatViolation(path, hits) {
  const where = hits
    .slice(0, 5)
    .map((h) => `line ${h.line}, column ${h.column}`)
    .join('; ');
  const more = hits.length > 5 ? ` (and ${hits.length - 5} more)` : '';
  return `${path}: ${hits.length} raw NUL byte${hits.length === 1 ? '' : 's'} — ${where}${more}`;
}

/** The fix, printed once under the violations rather than per file. */
export const REMEDY =
  'A raw NUL byte makes git treat the file as BINARY: no diff, no blame.\n'
  + 'Write it as text — `U+0000`, or the escape `\\0` / `\\u0000` in source code —\n'
  + 'never as the byte itself.\n'
  + '\n'
  + '⚠ Do NOT fix this with `sed -i`. On a CRLF file sed silently strips every\n'
  + 'CR, turning a one-line change into a whole-file rewrite. Use:\n'
  + "  perl -i -0777 -pe 'BEGIN{binmode(ARGV);binmode(ARGVOUT)} s/\\x00/U+0000/g' <file>";
