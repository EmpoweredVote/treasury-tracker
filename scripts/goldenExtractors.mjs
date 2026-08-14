#!/usr/bin/env node
/**
 * Golden-diff harness for scripts/lib/acfrGF.py.
 *
 * Runs every per-city extractor across every PDF and both modes, and records
 * the exact stdout. Capture BEFORE changing the shared library, compare AFTER.
 * A byte-identical compare is the only evidence that a shared-library change
 * did not silently alter an already-loaded city.
 */
import { readdirSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const CITIES = [
  { name: 'Bend',      script: 'scripts/extractBend.py',      docs: 'docs/Bend' },
  { name: 'Sherwood',  script: 'scripts/extractSherwood.py',  docs: 'docs/Sherwood' },
  { name: 'Tualatin',  script: 'scripts/extractTualatin.py',  docs: 'docs/Tualatin' },
  { name: 'Beaverton', script: 'scripts/extractBeaverton.py', docs: 'docs/Beaverton' },
  { name: 'Hillsboro', script: 'scripts/extractHillsboro.py', docs: 'docs/Hillsboro' },
  { name: 'Tigard',    script: 'scripts/extractTigard.py',    docs: 'docs/Tigard' },
  { name: 'Cornelius', script: 'scripts/extractCornelius.py', docs: 'docs/Cornelius' },
];
const MODES = ['revenue', 'operating'];

function runAll() {
  const out = {}, skipped = [];
  for (const c of CITIES) {
    if (!existsSync(c.script)) { skipped.push(`${c.name}: no extractor ${c.script}`); continue; }
    if (!existsSync(c.docs))   { skipped.push(`${c.name}: no PDF dir ${c.docs}`); continue; }
    const pdfs = readdirSync(c.docs).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    if (!pdfs.length) { skipped.push(`${c.name}: 0 PDFs in ${c.docs}`); continue; }
    for (const pdf of pdfs) {
      for (const mode of MODES) {
        const r = spawnSync('py', ['-3', c.script, path.join(c.docs, pdf), '--mode', mode],
                            { encoding: 'utf8' });
        out[`${c.name}/${pdf}/${mode}`] = { status: r.status, stdout: r.stdout ?? '' };
      }
    }
  }
  return { out, skipped };
}

const [cmd, dir] = process.argv.slice(2);
if (!cmd || !dir) { console.error('usage: goldenExtractors.mjs <capture|compare> <dir>'); process.exit(2); }
const { out, skipped } = runAll();
const file = path.join(dir, 'golden.json');

if (cmd === 'capture') {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ skipped, out }, null, 2));
  console.log(`captured ${Object.keys(out).length} outputs -> ${file}`);
  if (skipped.length) console.log('SKIPPED:\n  ' + skipped.join('\n  '));
  process.exit(0);
}

const prev = JSON.parse(readFileSync(file, 'utf8'));
if (JSON.stringify(prev.skipped) !== JSON.stringify(skipped)) {
  console.error('DRIFT: skip list changed.'); console.error('  before:', prev.skipped);
  console.error('  after :', skipped); process.exit(1);
}
const keys = new Set([...Object.keys(prev.out), ...Object.keys(out)]);
let bad = 0;
for (const k of keys) {
  if (JSON.stringify(prev.out[k]) !== JSON.stringify(out[k])) { console.error(`DRIFT: ${k}`); bad++; }
}
console.log(bad === 0 ? `IDENTICAL across ${keys.size} outputs` : `${bad} DRIFTED`);
process.exit(bad === 0 ? 0 : 1);
