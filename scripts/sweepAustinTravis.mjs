#!/usr/bin/env node
/**
 * Austin + Travis extraction sweep — the FY-window recon harness.
 *
 * Runs `extractAustin.py` / `extractTravis.py` over every downloaded ACFR in
 * both modes and reports, per (entity, fiscal year, mode):
 *
 *   - the fiscal year the extractor PARSED (which must equal the year in the
 *     filename; Austin's statement caption is glyph-ciphered, so this is the
 *     assertion that keeps a mislabelled row from loading — see extractAustin.py)
 *   - tie_delta, which must be exactly 0
 *   - the computed total, for an order-of-magnitude read across the window
 *   - the root-level tree labels, so an era whose statement reorganises its
 *     nesting is visible rather than silently mis-shaped
 *
 * A tie is arithmetic proof only. It says nothing about labels, nesting or
 * units — so this harness prints the shape alongside the tie and the window is
 * chosen by reading BOTH.
 *
 * Usage:
 *   node scripts/sweepAustinTravis.mjs                     # everything
 *   node scripts/sweepAustinTravis.mjs --entity austin
 *   node scripts/sweepAustinTravis.mjs --entity travis --json out.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolvePython } from './lib/pythonBin.mjs';

const PY = resolvePython();

const ENTITIES = {
  austin: { dir: 'docs/Austin', script: 'scripts/extractAustin.py', label: 'Austin, TX' },
  travis: { dir: 'docs/TravisCounty', script: 'scripts/extractTravis.py', label: 'Travis County, TX' },
};

function fyOf(file) {
  const m = /-(\d{4})-acfr\.pdf$/.exec(file);
  return m ? Number(m[1]) : null;
}

function runExtract(script, pdf, mode) {
  const r = spawnSync(PY, [script, pdf, '--mode', mode], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const err = (r.stderr || '').trim().split('\n').filter(Boolean);
    return { ok: false, reason: err[err.length - 1] || `exit ${r.status}`, stderr: err };
  }
  try {
    return { ok: true, data: JSON.parse(r.stdout) };
  } catch {
    return { ok: false, reason: 'unparseable JSON on stdout' };
  }
}

function rootLabels(tree) {
  if (!tree || !Array.isArray(tree.c)) return [];
  return tree.c.map((c) => (Array.isArray(c.c) && c.c.length ? `${c.n}[${c.c.length}]` : c.n));
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const only = arg('--entity');
  const jsonOut = arg('--json');
  const results = [];

  for (const [name, ent] of Object.entries(ENTITIES)) {
    if (only && only !== name) continue;
    if (!fs.existsSync(ent.dir)) { console.log(`\n${ent.label}: ${ent.dir} missing — run fetchAustinTravis.mjs`); continue; }
    const pdfs = fs.readdirSync(ent.dir).filter((f) => f.endsWith('.pdf')).sort();
    console.log(`\n=== ${ent.label}  (${pdfs.length} reports)`);
    console.log('  FY    mode       parsedFY  tie      total            roots');

    for (const f of pdfs) {
      const fy = fyOf(f);
      const pdf = path.join(ent.dir, f);
      for (const mode of ['revenue', 'operating']) {
        const r = runExtract(ent.script, pdf, mode);
        if (!r.ok) {
          console.log(`  ${fy}  ${mode.padEnd(10)} FAILED    ${r.reason}`);
          results.push({ entity: name, fy, mode, ok: false, reason: r.reason });
          continue;
        }
        const d = r.data;
        const tie = d.tie_delta;
        const parsed = d.fiscal_year;
        const total = d.computed_total ?? d.total ?? (d.tree && d.tree.a);
        const flag = [
          tie === 0 ? '' : 'TIE',
          parsed === fy ? '' : 'FY!',
        ].filter(Boolean).join(',') || 'ok';
        console.log(
          `  ${fy}  ${mode.padEnd(10)} ${String(parsed).padEnd(9)} ${String(tie).padEnd(8)} `
          + `${String(total).padStart(15)}  ${flag}  ${rootLabels(d.tree).join(' | ').slice(0, 90)}`,
        );
        results.push({
          entity: name, fy, mode, ok: true, parsedFy: parsed, tie, total,
          roots: rootLabels(d.tree), zeroRows: d.zero_rows,
        });
      }
    }
  }

  const bad = results.filter((r) => !r.ok || r.tie !== 0 || r.parsedFy !== r.fy);
  console.log(`\n${results.length} extractions, ${results.length - bad.length} clean, ${bad.length} needing adjudication.`);
  if (jsonOut) { fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2)); console.log(`wrote ${jsonOut}`); }
}

main();
