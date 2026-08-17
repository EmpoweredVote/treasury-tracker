/**
 * CA-CITIES-01 reconciliation driver.
 *
 * For one city, for every fiscal year in its window: extract the ACFR tree, read
 * the State Controller row already in production for the same (muni, fy,
 * dataset), reconcile the two, and record the verdict in
 * `scripts/data/ca-recon.json`. Every loader in Tasks 8–12 reads that file and
 * refuses any city-year it does not clear.
 *
 * NOTHING IS WRITTEN TO THE DATABASE HERE. This driver only reads production and
 * writes a JSON verdict. The loaders are the only writers.
 *
 * ⚠ NO SHEBANG. Nothing imports this today, but `verify-ca-recon.mjs` sits one
 * directory over and does get imported, and a `#!` on an imported module
 * silently erases a test file on Windows (40aa706). Keeping the whole cohort
 * shebang-free removes the question. Run as `node scripts/reconcileCaCity.mjs`.
 *
 * Usage:
 *   node scripts/reconcileCaCity.mjs --city Modesto [--dry-run]
 *
 * Spec: docs/superpowers/specs/2026-08-16-ca-cities-01-design.md §4
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import { cityByName } from './lib/caRoster.mjs';
import { reconcile } from './lib/caRecon.mjs';
import { resolvePython } from './lib/pythonBin.mjs';
import { CA_CALIBRATION } from './data/caCalibration.mjs';

const RECON_PATH = 'scripts/data/ca-recon.json';
const DATASETS = ['operating', 'revenue'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Hand-rolled .env reader — this repo has no `dotenv` dependency and every
 *  loader carries this same loop (see scripts/processBend.js). */
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent — ignore */ }
  }
}

/** Run this city's extractor and return `{total, categories, lineItemCount}`, or null. */
function extractAcfr(city, fy, dataset) {
  const script = `scripts/extract${city.name.replace(/\s+/g, '')}.py`;
  if (!existsSync(script)) {
    throw new Error(`${script} does not exist — that city's extractor task has not run yet`);
  }
  const pdf = path.join(city.docDir, `${city.pdfPrefix}-fy${fy}.pdf`);
  if (!existsSync(pdf)) return null; // outside the window; not an error

  // resolvePython(), never the bare name: `python` on PATH here is a Microsoft
  // Store alias stub that does not run Python. See scripts/lib/pythonBin.mjs.
  const out = execFileSync(resolvePython(), [script, pdf, '--mode', dataset], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  const tree = JSON.parse(out);
  return flatten(tree);
}

/** Collapse an extractor's nested {n,a,c:[…]} tree into the shape reconcile() wants. */
function flatten(tree) {
  const categories = (tree.c ?? []).map((n) => ({ name: n.n, amount: n.a }));
  let lineItemCount = 0;
  const walk = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.c?.length) walk(n.c);
      else lineItemCount += 1;
    }
  };
  walk(tree.c);
  return { total: tree.a, categories, lineItemCount };
}

/** Read the production SCO row for one (muni, fy, dataset), or null if absent. */
async function readSco(db, municipalityId, fy, dataset) {
  const { data: budgets } = await db
    .schema('treasury')
    .from('budgets')
    .select('id, total_budget, data_source')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', fy)
    .eq('dataset_type', dataset);

  const row = (budgets ?? []).find((b) => /State Controller/i.test(b.data_source ?? ''));
  if (!row) return null;

  const { data: cats } = await db
    .schema('treasury')
    .from('budget_categories')
    .select('id, name, amount')
    .eq('budget_id', row.id);

  const ids = (cats ?? []).map((c) => c.id);
  let lineItemCount = 0;
  if (ids.length) {
    const { count } = await db
      .schema('treasury')
      .from('budget_line_items')
      .select('id', { count: 'exact', head: true })
      .in('category_id', ids);
    lineItemCount = count ?? 0;
  }

  return {
    total: Number(row.total_budget),
    categories: (cats ?? []).map((c) => ({ name: c.name, amount: Number(c.amount) })),
    lineItemCount,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const cityName = argv[argv.indexOf('--city') + 1];
  const dryRun = argv.includes('--dry-run');

  const city = cityByName(cityName);
  if (!city) throw new Error(`unknown city: ${cityName} — must be one of the five in caRoster.mjs`);
  if (!city.fys.length) {
    throw new Error(`${city.name} has no fiscal years in the roster — run its source recon first`);
  }

  if (CA_CALIBRATION.calibratedFrom === null) {
    console.warn(
      '⚠ calibration is the empty sentinel — every divergent year will land UNEXPLAINED.\n' +
        '  That is the expected state before Task 6, and it is why nothing can load yet.\n'
    );
  }

  loadEnv();
  const db = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const existing = existsSync(RECON_PATH) ? JSON.parse(readFileSync(RECON_PATH, 'utf8')) : [];
  const kept = existing.filter((e) => e.city !== city.name); // this city is re-reconciled wholesale
  const results = [];

  for (const fy of city.fys) {
    for (const dataset of DATASETS) {
      const acfr = extractAcfr(city, fy, dataset);
      if (!acfr) continue; // no ACFR for this year: outside the window, nothing to record

      const sco = await readSco(db, city.municipalityId, fy, dataset);

      // No SCO row means there is nothing to contradict. Recorded explicitly so
      // the completeness harness sees a verdict rather than a hole.
      if (!sco) {
        results.push({
          city: city.name, fy, dataset,
          bucket: 'TIE', reason: 'NO-SCO-ROW', deltaAbs: 0, deltaPct: 0,
          depthFlag: false, depth: null, unmatchedAcfr: [], unmatchedSco: [], loadable: true,
        });
        continue;
      }

      results.push({ city: city.name, fy, dataset, ...reconcile(acfr, sco, CA_CALIBRATION) });
    }
  }

  for (const r of results) {
    const flag = r.depthFlag ? ' +DEPTH' : '';
    console.log(
      `${r.city} FY${r.fy} ${r.dataset.padEnd(9)} ${r.bucket}${flag}` +
        `  Δ ${r.deltaAbs.toLocaleString()} (${(r.deltaPct * 100).toFixed(3)}%)` +
        `${r.reason ? `  [${r.reason}]` : ''}`
    );
  }

  const tally = results.reduce((a, r) => ({ ...a, [r.bucket]: (a[r.bucket] ?? 0) + 1 }), {});
  console.log(`\n${city.name}: ${JSON.stringify(tally)}  loadable ${results.filter((r) => r.loadable).length}/${results.length}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing written');
    return;
  }
  writeFileSync(RECON_PATH, `${JSON.stringify([...kept, ...results], null, 2)}\n`);
  console.log(`\nwrote ${RECON_PATH}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
