#!/usr/bin/env node
/**
 * Pre-commit gate: reject a commit that would introduce a raw NUL byte.
 *
 * ── WHY A HOOK, WHEN `npm test` ALREADY LINTS THIS ──────────────────────────
 * The vitest lint scans **tracked** files, and `git ls-files` does not list
 * untracked ones. So a brand-new file is invisible to it until its first
 * `git add`, and a suite run before staging proves nothing about that file.
 *
 * That is not hypothetical — it is occurrence #6. The NUL-byte lint itself was
 * written, run green, committed and pushed while its own two files were still
 * untracked, and both contained literal NUL bytes.
 *
 * A pre-commit hook closes exactly that window: at commit time every file being
 * introduced is, by definition, staged.
 *
 * ⚠ Reads the STAGED BLOB (`git show :path`), never the working tree. The two
 * differ whenever a file is edited after `git add`, and the staged content is
 * what the commit will actually contain — checking the working tree would let a
 * NUL through in exactly the case that matters.
 *
 * Bypass with `git commit --no-verify` if you genuinely must; the vitest lint
 * will still fail afterwards, which is the intended backstop.
 */

import { execFileSync } from 'node:child_process';
import { collectViolations, REMEDY } from './lib/nulByteLint.mjs';

function stagedPaths() {
  // ACM: added, copied, modified. Deleted paths have no blob to read.
  const out = execFileSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  return out.toString('utf8').split('\0').filter(Boolean);
}

function stagedBytes(path) {
  try {
    return execFileSync('git', ['show', `:${path}`], {
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch {
    return null; // unreadable in the index (submodule, or a path this OS rejects)
  }
}

const files = [];
for (const path of stagedPaths()) {
  const bytes = stagedBytes(path);
  if (bytes) files.push({ path, bytes });
}

const violations = collectViolations(files);

if (violations.length > 0) {
  console.error('\nCommit rejected — raw NUL bytes in staged content:\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\n${REMEDY}\n`);
  process.exit(1);
}
