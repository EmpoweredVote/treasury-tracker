/**
 * Mirror the frozen-invariant bookkeeping from the repo into the database, so the
 * in-database check (treasury.run_frozen_invariant_check) is self-contained and
 * needs no credential travelling anywhere.
 *
 * NO SHEBANG — kept importable.
 *
 * ⚠ THE REPO JSON REMAINS THE SOURCE OF TRUTH. These tables are a mirror, never
 * an origin. If they disagree, the JSON wins and this script re-syncs. The JS
 * harness recomputes from the JSON independently, so a silent drift between the
 * two shows up as a digest mismatch rather than passing unnoticed.
 *
 * Usage:
 *   node scripts/syncFrozenInvariantState.mjs            # sync, then report
 *   node scripts/syncFrozenInvariantState.mjs --set-baseline
 *       # additionally record the CURRENT status as the expected baseline.
 *       # ⚠ Only after verifying the JS harness passes — this is the DB-side
 *       # equivalent of writing figures_frozen, and it must never be used to
 *       # make a failing check pass.
 */

import { readFileSync } from 'node:fs';

const BASELINE = 'scripts/data/scopeBaseline.json';
const CHUNK = 500;

let _supabase;
async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).');
    process.exit(1);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

async function replaceAll(client, table, rows) {
  // Delete-then-insert rather than upsert: a row REMOVED from the JSON must also
  // leave the mirror, and an upsert would silently keep it.
  const { error: delErr } = await client.schema('treasury').from(table)
    .delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) throw new Error(`clear ${table}: ${delErr.message}`);

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await client.schema('treasury').from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`insert ${table} at ${i}: ${error.message}`);
  }
}

async function main() {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const client = await getSupabase();

  const excluded = (baseline.excluded_ids_files ?? []).flatMap((file) =>
    JSON.parse(readFileSync(file, 'utf8')).map((id) => ({ id, source_file: file })));

  const ledger = (baseline.figure_change_files ?? []).flatMap((file) =>
    JSON.parse(readFileSync(file, 'utf8')).map((e) => ({
      id: e.id, old_value: String(e.old), why: e.why, source_file: file,
    })));

  await replaceAll(client, 'frozen_excluded_ids', excluded);
  await replaceAll(client, 'frozen_figure_ledger', ledger);
  console.log(`synced ${excluded.length} excluded id(s), ${ledger.length} ledger entr(y/ies)`);

  const { data, error } = await client.schema('treasury').rpc('frozen_invariant_status');
  if (error) throw new Error(`frozen_invariant_status: ${error.message}`);
  const status = Array.isArray(data) ? data[0] : data;
  console.log(`\nin-database status: ${status.frozen_rows} rows, digest ${status.digest}`);
  console.log(`repo baseline     : ${baseline.frozen_row_count} rows, digest ${baseline.figures_frozen}`);

  const agrees = Number(status.frozen_rows) === baseline.frozen_row_count
    && status.digest === baseline.figures_frozen;
  console.log(agrees
    ? '\n✅ the database agrees with the repo baseline'
    : '\n✗ the database does NOT agree with the repo baseline — do not set a baseline from this');

  if (process.argv.includes('--set-baseline')) {
    if (!agrees) {
      console.error('\nRefusing to set a baseline that disagrees with the repo. Fix the disagreement first.');
      process.exit(1);
    }
    const { error: upErr } = await client.schema('treasury').from('frozen_invariant_baseline')
      .upsert({
        singleton: true,
        frozen_rows: status.frozen_rows,
        digest: status.digest,
        updated_at: new Date().toISOString(),
        note: 'Mirrors scopeBaseline.json figures_frozen. Set only after the JS harness passed.',
      });
    if (upErr) throw new Error(`set baseline: ${upErr.message}`);
    console.log('recorded as the in-database baseline');
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('syncFrozenInvariantState.mjs')) await main();
