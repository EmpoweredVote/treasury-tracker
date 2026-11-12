#!/usr/bin/env node
/**
 * The provenance ratchet: hold the standing debt flat so it can only shrink.
 *
 * (Shebang is correct HERE — entry point with a main guard.)
 *
 *   npm run verify:provenance
 *   node scripts/verifyProvenanceGate.mjs --set-baseline    (deliberate, rare)
 *
 * ⚠⚠ WHY THIS EXISTS ALONGSIDE THE GATE. treasury_sync_city_budget refuses a
 * NEW unregistered family outright, but it grandfathers families already in
 * the database — only 1,966 of 5,929 match all three active axes, and
 * refusing the rest would block the very re-runs that fix bad data. That
 * leaves standing debt by design, and debt nobody counts is debt that grows.
 *
 * Measured 2026-11-02: 3,963 unregistered families (54,914 rows) and 24,947
 * rows carrying no source_url.
 *
 * ⚠ --set-baseline RECORDS WHATEVER IS THERE. It is not a way to make a red
 * run green; it is for after real work has reduced the debt. The frozen
 * invariant has the same rule and the same trap.
 *
 * Exit 0 no worse · 1 worse · 2 INCONCLUSIVE (could not reach the database).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { missingAxes } from './lib/registeredFamilies.mjs';
import {
  summarizeProvenanceDebt, toBaseline, familyIsShapeAnswered, gradeDecayOf,
} from './lib/provenanceDebt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'data', 'provenanceDebtBaseline.json');

/**
 * One row per data_source: how many rows, how many linkless, registered?
 *
 * ⚠ `dataset_type` is read so a family can be recognised as SHAPE-ANSWERED —
 * see `SHAPE_ANSWERED_DATASET_TYPES` for why a check or payroll register can
 * never satisfy the registry and must not be asked to.
 */
export async function measure(client) {
  const fam = new Map();
  for (let from = 0; ; from += 1000) {
    // ⚠ A paged read needs a total order — broken five times in this repo.
    const { data, error } = await client.schema('treasury').from('budgets')
      .select('id,data_source,source_url,dataset_type,audit_grade').order('id').range(from, from + 999);
    if (error) throw new Error(`budgets read failed: ${error.message}`);
    for (const r of data) {
      const e = fam.get(r.data_source) ?? { rows: 0, linkless: 0, types: new Set(), decayed: 0 };
      e.rows += 1;
      if (r.source_url == null || String(r.source_url).trim() === '') e.linkless += 1;
      e.types.add(r.dataset_type);
      e.decayed += gradeDecayOf([r]);
      fam.set(r.data_source, e);
    }
    if (data.length < 1000) break;
  }
  return [...fam.entries()].map(([data_source, e]) => ({
    data_source, rows: e.rows, linkless: e.linkless, decayed: e.decayed,
    unregistered: missingAxes(data_source).length > 0,
    shapeAnswered: familyIsShapeAnswered(e.types),
  }));
}

async function main() {
  const setBaseline = process.argv.includes('--set-baseline');
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // A check that cannot reach its source must NOT look like a clean pass.
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so no row was measured.');
    process.exitCode = 2;
    return;
  }

  const current = await measure(createClient(url, key));

  if (setBaseline) {
    writeFileSync(BASELINE, `${JSON.stringify(toBaseline(current), null, 2)}\n`);
    const t = summarizeProvenanceDebt(current, toBaseline(current)).totals;
    console.log(`baseline written: ${Object.keys(toBaseline(current).sources).length} source(s) carrying debt`);
    console.log(`  unregistered rows ${t.unregisteredRows.toLocaleString()}   linkless ${t.linkless.toLocaleString()}`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const r = summarizeProvenanceDebt(current, baseline);

  console.log(`families ${current.length.toLocaleString()}   rows ${r.totals.rows.toLocaleString()}`);
  console.log(`  unregistered rows ${r.totals.unregisteredRows.toLocaleString()}`);
  console.log(`  rows with no link ${r.totals.linkless.toLocaleString()}`);

  for (const b of r.better.slice(0, 10)) {
    console.log(`  ✅ better  ${b.name}: unregistered ${b.wasUnregisteredRows}→${b.unregisteredRows}, linkless ${b.wasLinkless}→${b.linkless}`);
  }
  if (r.better.length > 10) console.log(`  ✅ …and ${r.better.length - 10} more improved`);

  for (const w of r.worse) {
    console.error(`  ❌ WORSE   ${w.name}: unregistered ${w.wasUnregisteredRows}→${w.unregisteredRows}, linkless ${w.wasLinkless}→${w.linkless}`);
  }
  for (const a of r.added) {
    console.error(`  ❌ NEW DEBT ${a.name}: unregistered ${a.unregisteredRows}, linkless ${a.linkless}`);
  }

  // ⚠⚠ THE EXCUSE MUST NOT OUTLIVE THE GRADE. Salaries and transactions rows
  // are excused the registry because their audit grade is answered by shape —
  // true only while something applies it. If
  // `budgets_fill_not_applicable_audit_grade` is dropped, they fall back to
  // `unknown`, this gate keeps excusing them, and a correct rule becomes a
  // blindfold. Zero tolerance: the trigger makes 0 the steady state, so any
  // number above it means the mechanism is gone, not that debt crept up.
  const decayed = current.reduce((a, f) => a + (f.decayed ?? 0), 0);
  if (decayed > 0) {
    console.error(`\n❌ ${decayed} shape-answered row(s) have fallen back to audit_grade='unknown'.`);
    for (const f of current.filter((x) => (x.decayed ?? 0) > 0).slice(0, 10)) {
      console.error(`     ${f.decayed} × ${f.data_source}`);
    }
    console.error('   These are excused the registry BECAUSE the grade is answered by shape,'
      + '\n   so an unknown here makes the excuse a blindfold. Check the trigger'
      + '\n   `budgets_fill_not_applicable_audit_grade` still exists, then re-run'
      + '\n   `node scripts/stampNotApplicableGrade.mjs`.');
    process.exitCode = 1;
    return;
  }

  if (!r.ok) {
    console.error('\n❌ provenance debt grew. A row published without a label or a link is one'
      + '\n   a reader has to take on trust. Classify the source, or give it a source_url.');
    process.exitCode = 1;
    return;
  }
  console.log('\n✅ OK — no source is worse than its recorded baseline.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
