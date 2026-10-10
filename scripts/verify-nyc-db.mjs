/**
 * NO SHEBANG — see scripts/loadNYCAcfrs.mjs.
 *
 * CHECK 3 + CHECK 4 only, without CHECK 1's cost.
 *
 * `scripts/verify-nyc.mjs` re-extracts all 96 series to build its expected
 * values, which takes ~30 minutes. CHECK 1 has already passed 96/96, so this
 * compares the DATABASE against the INDEPENDENT glyph reader directly — a
 * stronger comparison than against the loader's own reader, and 24 PDF reads
 * instead of 120.
 *
 * CHECK 3  Every book in the window carries an UNMODIFIED audit opinion.
 *          ⚠⚠ The gate must not match `qualified` INSIDE `unqualified`.
 * CHECK 4  Every stored row matches the glyph reader's printed total, with the
 *          right fund_scope, basis, fiscal_year_start_month, source_url and
 *          data_source label.
 *
 * Usage:
 *   node --env-file=.env scripts/verify-nyc-db.mjs
 */
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';
import { NYC_FYS, nycAcfrUrl } from './lib/nycAcfrSources.mjs';
import { NYC_ENTITY } from './seedNewYorkCity.mjs';
import {
  FUND_SCOPES, FISCAL_YEAR_START_MONTH, BASIS_VALUE, sourceNameFor,
} from './loadNYCAcfrs.mjs';

const python = resolvePython();
const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`  FAIL ${msg}`); };
const pdfFor = (fy) => `docs/NYC/nyc-${fy}-acfr.pdf`;

// ── CHECK 3 ─────────────────────────────────────────────────────────────────
console.log('CHECK 3  audit opinion is unmodified in every book');
let c3 = 0;
for (const fy of NYC_FYS) {
  const r = spawnSync('pdftotext', ['-f', '1', '-l', '140', pdfFor(fy), '-'],
    { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const flat = (r.stdout || '').replace(/\s+/g, ' ').toLowerCase();
  c3 += 1;

  const hasOpinion = flat.includes('present fairly, in all material respects');
  // ⚠⚠ `qualified` is a SUBSTRING of `unqualified`. Blank out the compound
  // first, so only a genuine "qualified opinion" can match.
  const masked = flat.replace(/unqualified/g, 'UNQUAL');
  const modified = /(?:^|[^a-z])(adverse opinion|disclaimer of opinion|qualified opinion)/.test(masked);

  if (!hasOpinion) {
    fail(`CHECK 3 FY${fy}: no unmodified-opinion language found `
      + '(FY2018 has a known interleaved opinion-page text layer — confirm by eye)');
  } else if (modified) {
    fail(`CHECK 3 FY${fy}: a MODIFIED opinion phrase is present`);
  }
}
console.log(`         ${c3} books read\n`);

// ── CHECK 4 ─────────────────────────────────────────────────────────────────
console.log('CHECK 4  database parity against the INDEPENDENT glyph reader');
const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(url, key);

const { data: muni } = await db.schema('treasury').from('municipalities')
  .select('id, county_id, geoid, population')
  .eq('name', NYC_ENTITY.name).eq('state', 'NY').maybeSingle();
if (!muni?.id) { console.error('New York City is not seeded'); process.exit(1); }

if (muni.county_id !== null) fail(`CHECK 4 entity: county_id is ${muni.county_id}, expected NULL`);
if (muni.geoid !== NYC_ENTITY.geoid) fail(`CHECK 4 entity: geoid ${muni.geoid}`);

const { data: rows, error } = await db.schema('treasury').from('budgets')
  .select('fiscal_year, dataset_type, fund_scope, basis, total_budget, source_url, '
    + 'fiscal_year_start_month, data_source')
  .eq('municipality_id', muni.id);
if (error) throw new Error(`budgets read failed: ${error.message}`);

let c4 = 0;
for (const fy of NYC_FYS) {
  const g = spawnSync(python, ['scripts/verifyNycGlyphs.py', pdfFor(fy), String(fy)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (g.status !== 0) { fail(`CHECK 4 FY${fy}: glyph reader failed`); continue; }
  const want = JSON.parse(g.stdout);

  for (const scope of FUND_SCOPES) {
    for (const mode of ['revenue', 'operating']) {
      c4 += 1;
      const row = rows.find((r) => r.fiscal_year === fy
        && r.dataset_type === mode && r.fund_scope === scope);
      if (!row) { fail(`CHECK 4 FY${fy} ${mode} ${scope}: NO ROW`); continue; }

      if (Number(row.total_budget) !== want[scope][mode]) {
        fail(`CHECK 4 FY${fy} ${mode} ${scope}: db ${row.total_budget} vs glyphs ${want[scope][mode]}`);
      }
      if (row.fiscal_year_start_month !== FISCAL_YEAR_START_MONTH) {
        fail(`CHECK 4 FY${fy} ${mode} ${scope}: fysm ${row.fiscal_year_start_month}, expected 7`);
      }
      if (row.basis !== BASIS_VALUE) {
        fail(`CHECK 4 FY${fy} ${mode} ${scope}: basis "${row.basis}"`);
      }
      if (row.source_url !== nycAcfrUrl(fy)) {
        fail(`CHECK 4 FY${fy} ${mode} ${scope}: source_url "${row.source_url}"`);
      }
      if (row.data_source !== sourceNameFor(mode, fy, scope)) {
        fail(`CHECK 4 FY${fy} ${mode} ${scope}: data_source "${row.data_source}"`);
      }
    }
  }
}
if (rows.length !== c4) fail(`CHECK 4: expected ${c4} rows, found ${rows.length}`);
console.log(`         ${c4} rows compared\n`);

if (failures.length) {
  console.error(`\n${failures.length} FAILURE(S)`);
  process.exit(1);
}
console.log(`ALL PASSED  (${c3} opinions, ${c4} rows vs an independent reader)`);
