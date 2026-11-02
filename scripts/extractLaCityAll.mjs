#!/usr/bin/env node
/**
 * Batch driver for scripts/extractLosAngelesCA.py — all ten audited years,
 * both modes, with the tie gate reported per run.
 *
 * ⚠⚠ THE TIE GATE PROVES THE READ, NEVER THE SHAPE. Four documented ways exist
 * to produce a wrong tree that ties at exactly $0 (see
 * reference_acfr_gf_extractor_howto). This driver therefore ALSO prints the
 * root child count and the top three children per year, so a silent reparenting
 * or a dropped line shows up as a shape that moves between adjacent years.
 *
 * ⚠ Reads the manifest built from the FAC filing list, never a path guessed
 * from a fiscal year: EIN 956000735 carries the Port and the airports too, and
 * the Census-era report-id suffix repeats across seven years.
 *
 * Usage:
 *   node scripts/extractLaCityAll.mjs            # extract + report
 *   node scripts/extractLaCityAll.mjs --write    # also write extracted.json
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WORK = '_acfr-work/la-city';
const MANIFEST = join(WORK, 'manifest.json');

function python() {
  for (const cmd of [['py', ['-3', '-I']], ['python3', ['-I']], ['python', ['-I']]]) {
    try {
      execFileSync(cmd[0], [...cmd[1], '-c', 'pass'], { stdio: 'ignore' });
      return cmd;
    } catch { /* try the next one */ }
  }
  throw new Error('no python interpreter found');
}

const [PY, PYARGS] = python();
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const write = process.argv.includes('--write');

const out = [];
let failures = 0;

for (const entry of manifest) {
  const pdf = join(WORK, 'pdf', `${entry.report_id}.pdf`);
  for (const mode of ['revenue', 'operating']) {
    let result;
    try {
      const raw = execFileSync(PY, [...PYARGS, 'scripts/extractLosAngelesCA.py', pdf, '--mode', mode],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      result = JSON.parse(raw);
    } catch (err) {
      failures += 1;
      console.log(`FY${entry.fiscal_year} ${mode.padEnd(9)} ✗ ${String(err.message).split('\n')[0].slice(0, 110)}`);
      continue;
    }

    // ⚠ The fiscal year is taken from the DOCUMENT, never from the manifest, and
    // the two must agree. A mismatch means the filing list and the cover page
    // disagree about which year this book is, which is how one year's money
    // gets loaded under another year's label.
    const docYear = result.fiscal_year;
    const yearOk = docYear === entry.fiscal_year;
    const tie = result.tie_delta;
    const kids = result.tree?.c?.length ?? 0;
    const total = result.tree?.a ?? 0;

    if (tie !== 0 || !yearOk) failures += 1;
    const flag = tie === 0 && yearOk ? '✓' : '✗';
    const money = `$${(total / 1e9).toFixed(3)}B`;
    const yearNote = yearOk ? '' : `  ⚠ DOC SAYS FY${docYear}`;
    console.log(
      `FY${entry.fiscal_year} ${mode.padEnd(9)} ${flag} p${String(result.statement_page).padStart(3)}`
      + `  ${money.padStart(9)}  ${String(kids).padStart(2)} children  tie ${tie}${yearNote}`);

    out.push({ ...entry, mode, ...result });
  }
}

console.log(`\n${out.length} extraction(s), ${failures} failure(s).`);

// Shape drift: the child labels of adjacent years, so a reparenting shows up.
const byMode = {};
for (const r of out) (byMode[r.mode] ??= []).push(r);
for (const [mode, rows] of Object.entries(byMode)) {
  const labels = new Map();
  for (const r of rows) for (const c of r.tree.c) {
    if (!labels.has(c.n)) labels.set(c.n, []);
    labels.get(c.n).push(r.fiscal_year);
  }
  console.log(`\n${mode} — root labels and the years each appears in:`);
  for (const [label, years] of [...labels.entries()].sort()) {
    const span = years.length === rows.length ? 'all years' : years.join(',');
    console.log(`  ${label.padEnd(42)} ${span}`);
  }
}

if (write) {
  writeFileSync(join(WORK, 'extracted.json'), JSON.stringify(out, null, 2));
  console.log(`\nwrote ${join(WORK, 'extracted.json')}`);
}

if (failures > 0) process.exit(1);
