#!/usr/bin/env node
/**
 * Austin + Travis verification harness.
 *
 * Reads what is IN THE DATABASE and checks it against the PDFs by a route that
 * shares no code with the loader:
 *
 *   loader path    extract<Entity>.py -> scripts/lib/acfrGF.py
 *                  (`pdftotext -table`, nearest-column-anchor assignment,
 *                   component sum vs printed total)
 *
 *   this harness   scripts/acfrPrintedTotal.py
 *                  (pdfplumber glyph coordinates, reads the printed TOTAL cell
 *                   and nothing else)
 *
 * ── WHY A SECOND IMPLEMENTATION AND NOT A DB SELF-CHECK ─────────────────────
 * The obvious check — "does budgets.total_budget equal the sum of its line
 * items" — is TAUTOLOGICAL here. The loader computes `p_total` as the sum of the
 * nodes it passes to the RPC, so the two agree by construction and the check
 * would pass on a completely mis-parsed statement. (The same tautology bit
 * SCOPE-04: its handoff reported a "0 of 23,260 rows tie" green light for
 * `total = Σ roots`, which is an identity, not evidence.)
 *
 * The extractor's own `tie_delta == 0` is stronger but still INTERNAL to one
 * parse: it holds under a wrong `units` multiplier and under wrong nesting.
 *
 * So the assertion that carries weight is: the dollar figure in the database
 * equals the dollar figure a DIFFERENT tool reads off the printed page. That
 * is what CHECK 1 does, and it is the check that would have caught a 1000x
 * units error on either entity.
 *
 * CHECKS
 *   1. DB total_budget == printed GF total, read independently, EXACTLY.
 *   2. Row inventory: the expected (entity, fy, dataset) set, no more, no less.
 *   3. Every row carries source_url, source_date and a data_source label, and
 *      source_date is the September 30 fiscal-year end.
 *   4. fiscal_year_start_month == 10 (Oct-Sep fiscal year, not calendar).
 *   5. No `data_sources` residue for either entity — those rows are ephemeral.
 *   6. Austin is entity_type 'city' linked to Travis County, and no duplicate
 *      name/type row exists for either (the Utah phantom-row defect).
 *   7. Every row is classified general_fund / actual / primary_government by the
 *      `tx-local-acfr-gf` registry entries, so a re-run of the loader (which
 *      writes the DEFAULT 'unknown' on a fresh row) cannot silently drop these
 *      rows out of scope-matched comparison without this harness noticing.
 *      Evidence: docs/superpowers/plans/AUSTIN-TRAVIS-01-SCOPE-RECON.md.
 *
 * Exits non-zero on any failure. Usage:
 *   node scripts/verify-austin-travis.mjs
 *   node scripts/verify-austin-travis.mjs --entity austin
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}
loadEnv();

const ENTITIES = {
  austin: {
    label: 'City of Austin', muniName: 'Austin', entityType: 'city',
    dir: 'docs/Austin', file: (fy) => `austin-${fy}-acfr.pdf`,
    units: 1000, fys: Array.from({ length: 16 }, (_, i) => 2010 + i),
  },
  travis: {
    label: 'Travis County', muniName: 'Travis County', entityType: 'county',
    dir: 'docs/TravisCounty', file: (fy) => `travis-${fy}-acfr.pdf`,
    units: 1, fys: Array.from({ length: 22 }, (_, i) => 2004 + i),
  },
};

const PY = resolvePython();
const failures = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };

function printedTotals(ent, fy) {
  const pdf = path.join(ROOT, ent.dir, ent.file(fy));
  if (!existsSync(pdf)) return { error: `PDF missing: ${pdf}` };
  const r = spawnSync(PY, [path.join(ROOT, 'scripts', 'acfrPrintedTotal.py'), pdf, '--units', String(ent.units)],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) return { error: `oracle exit ${r.status}: ${(r.stderr || '').trim().split('\n').pop()}` };
  try { return JSON.parse(r.stdout); } catch { return { error: 'oracle emitted unparseable JSON' }; }
}

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--entity');
  const only = i >= 0 ? argv[i + 1] : null;

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('ERROR: SUPABASE_SERVICE_KEY required'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  let checked = 0;

  for (const [name, ent] of Object.entries(ENTITIES)) {
    if (only && only !== name) continue;
    console.log(`\n=== ${ent.label}`);

    // CHECK 6 — entity identity and the phantom-row guard.
    const { data: munis } = await db.from('municipalities')
      .select('id, name, entity_type, county_id, population').eq('state', 'TX').eq('name', ent.muniName);
    if (munis.length !== 1) { fail(`${ent.muniName}: expected 1 TX row, found ${munis.length}`); continue; }
    const muni = munis[0];
    if (muni.entity_type !== ent.entityType) fail(`${ent.muniName}: entity_type ${muni.entity_type} != ${ent.entityType}`);
    if (name === 'austin') {
      const { data: travis } = await db.from('municipalities')
        .select('id').eq('state', 'TX').eq('name', 'Travis County').maybeSingle();
      if (!travis?.id) fail('Travis County row missing — Austin.county_id cannot be verified');
      else if (muni.county_id !== travis.id) fail(`Austin.county_id ${muni.county_id} does not point at Travis County ${travis.id}`);
      else console.log('  OK    Austin is a city linked to Travis County');
    }

    // CHECK 5 — ephemeral data_sources must not survive a run.
    const { data: residue } = await db.from('data_sources').select('id, dataset_id').eq('municipality_id', muni.id);
    if (residue.length) fail(`${ent.label}: ${residue.length} data_sources row(s) left behind: ${residue.map((r) => r.dataset_id).join(', ')}`);
    else console.log('  OK    no data_sources residue');

    // CHECK 2 — row inventory.
    const { data: rows } = await db.from('budgets')
      .select('fiscal_year, dataset_type, total_budget, source_url, source_date, data_source, '
        + 'fiscal_year_start_month, fund_scope, basis, reporting_entity')
      .eq('municipality_id', muni.id)
      .order('fiscal_year')
      .order('dataset_type');
    const expected = new Set(ent.fys.flatMap((fy) => [`${fy}|revenue`, `${fy}|operating`]));
    const actual = new Set(rows.map((r) => `${r.fiscal_year}|${r.dataset_type}`));
    for (const k of expected) if (!actual.has(k)) fail(`${ent.label}: missing row ${k}`);
    for (const k of actual) if (!expected.has(k)) fail(`${ent.label}: UNEXPECTED row ${k}`);
    console.log(`  ${expected.size === actual.size && [...expected].every((k) => actual.has(k)) ? 'OK   ' : 'FAIL '} inventory: ${rows.length} rows (expected ${expected.size})`);

    // CHECKS 1, 3, 4 — figure, provenance, fiscal calendar, per fiscal year.
    for (const fy of ent.fys) {
      const oracle = printedTotals(ent, fy);
      if (oracle.error) { fail(`FY${fy}: ${oracle.error}`); continue; }

      for (const dataset of ['revenue', 'operating']) {
        const row = rows.find((r) => r.fiscal_year === fy && r.dataset_type === dataset);
        if (!row) continue; // already reported by the inventory check
        const printed = dataset === 'revenue' ? oracle.revenue_total : oracle.expenditure_total;

        if (Number(row.total_budget) !== printed) {
          fail(`FY${fy} ${dataset}: DB ${Number(row.total_budget).toLocaleString()} != printed ${printed.toLocaleString()} `
            + `(delta ${(Number(row.total_budget) - printed).toLocaleString()})`);
        }
        if (!row.source_url) fail(`FY${fy} ${dataset}: no source_url`);
        if (row.source_date !== `${fy}-09-30`) fail(`FY${fy} ${dataset}: source_date ${row.source_date} != ${fy}-09-30`);
        if (!row.data_source) fail(`FY${fy} ${dataset}: no data_source label`);
        if (row.fiscal_year_start_month !== 10) fail(`FY${fy} ${dataset}: fiscal_year_start_month ${row.fiscal_year_start_month} != 10`);
        // CHECK 7 — the classification axes. 'unknown' here means the loader has
        // been re-run since the last classify/stamp pass: both write the column
        // default on a fresh row, so the fix is to re-run
        // classifyFundScope.mjs + stampBudgetAxes.mjs, not to edit anything.
        if (row.fund_scope !== 'general_fund') fail(`FY${fy} ${dataset}: fund_scope '${row.fund_scope}' != general_fund — re-run scripts/classifyFundScope.mjs`);
        if (row.basis !== 'actual') fail(`FY${fy} ${dataset}: basis '${row.basis}' != actual — re-run scripts/stampBudgetAxes.mjs`);
        if (row.reporting_entity !== 'primary_government') fail(`FY${fy} ${dataset}: reporting_entity '${row.reporting_entity}' != primary_government — re-run scripts/stampBudgetAxes.mjs`);
        checked++;
      }
      console.log(`  FY${fy}: printed rev ${oracle.revenue_total.toLocaleString()} / exp ${oracle.expenditure_total.toLocaleString()}`
        + `  (statement p${oracle.statement_page})`);
    }
  }

  console.log(`\n${checked} row(s) checked against the independent oracle.`);
  if (failures.length) {
    console.error(`\n${failures.length} FAILURE(S):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED.');
}

await main();
