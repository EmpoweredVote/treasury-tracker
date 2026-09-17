/**
 * Entity lookup goes through scripts/lib/ensureMunicipality.mjs, nowhere else.
 *
 * ⚠ GREP-SHAPED ON PURPOSE. This repo has been bitten by fixes that were
 * correct in one file and re-broken by the next merge — the shebang/CRLF guard
 * exists for the same reason. A rule that scans every file is the only kind
 * that survives a merge that did not think about it.
 *
 * What a direct call costs: the helper is where `source` and `sourceEntityKey`
 * are plumbed through, and those are the only mechanism that PREVENTS a
 * publisher rename from forking a city rather than catching it afterwards. A
 * loader that bypasses the helper silently opts out of that.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['scripts', 'src', 'supabase'];
const EXTS = ['.mjs', '.js', '.ts'];
const ALLOWED = new Set(['scripts/lib/ensureMunicipality.mjs']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

describe('treasury_ensure_municipality is only called through the helper', () => {
  it('has no direct .rpc() call outside scripts/lib/ensureMunicipality.mjs', () => {
    const offenders = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const rel = file.split('\\').join('/');
        if (ALLOWED.has(rel)) continue;
        const src = readFileSync(file, 'utf8');
        if (/rpc\(\s*['"]treasury_ensure_municipality['"]/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
