#!/usr/bin/env node
/**
 * Capture the 40 Ohio AOS **city MOD** rows' figures into
 * scripts/data/figureChanges.json, so the #316 layout fix can be loaded
 * without rebasing `figures_frozen`.
 *
 * All 40 rows are INSIDE the frozen set (measured 2026-11-03: 40 in
 * treasury.frozen_figure_snapshot, 0 in frozen_excluded_ids), so the reload
 * moves published figures. The digest reads
 * `coalesce(l.old_value, b.total_budget::text, '~')`, so a ledger entry
 * carrying the value it REPLACED keeps figures_frozen verifying while the row
 * tells the truth.
 *
 * ⚠⚠ CAPTURE `old` BEFORE THE WRITE. Run phase 1 afterwards and it records the
 * NEW figures as though they were the old ones, silently re-basing the
 * invariant while looking like documentation.
 *
 * ⚠⚠ THIS SCRIPT MERGES. scripts/captureVaRevenueFigureChanges.mjs, which this
 * is modelled on, does `writeFileSync(OUT, entries)` and therefore OWNS the
 * whole file — correct when VA's 304 rows were the only ledger, destructive
 * now. Reusing that shape here would have deleted all 304 VA entries and
 * silently re-based the invariant for Virginia instead of Ohio.
 *
 * ⚠ THE VALUE MUST BE POSTGRES' OWN `total_budget::text`, NOT a JS number —
 * PostgREST's JSON drops numeric scale.
 *
 * Usage:
 *   node --env-file=.env scripts/captureOhioCityModFigureChanges.mjs            # phase 1: old
 *   node --env-file=.env scripts/captureOhioCityModFigureChanges.mjs --record-new  # phase 2: new
 *   ... --dry-run  on either phase
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const OUT = 'scripts/data/figureChanges.json';
const EXPECTED_ROWS = 40;
const FILENAME = /\/City_20(?:1[6-9]|2[0-5])_MOD_Summarized\.XLSX$/;

const WHY = 'Ohio AOS city MOD layout defect (#316): stored expenditure was the '
          + '"Excess Of Receipts Over Disbursements" column and stored revenue was a '
          + 'single function. Reloaded from the workbook.';

function client() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY.');
    process.exit(2);
  }
  return createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);
}

/** The 40 city MOD rows, asserted to be exactly that set. */
async function cityModRows(supabase) {
  const { data, error } = await supabase.schema('treasury')
    .from('budgets')
    // ⚠ `total_budget::text` — cast in Postgres. See the warning above.
    .select('id, total_budget::text, source_url')
    .like('data_source', 'Ohio Auditor of State%')
    .like('source_url', '%City%MOD%')
    .order('id');
  if (error) throw new Error(`budgets query failed: ${error.message}`);

  // `_` is a LIKE wildcard, so the filter above is looser than it reads.
  // Re-assert against a real regex rather than trusting the pattern.
  const rows = data.filter((r) => FILENAME.test(r.source_url));
  if (rows.length !== data.length) {
    throw new Error(`LIKE matched ${data.length} rows but only ${rows.length} are City_YYYY_MOD files`);
  }
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`expected ${EXPECTED_ROWS} city MOD rows, got ${rows.length} — `
      + 're-measure before ledgering; do NOT edit the expectation to match');
  }
  const distinct = new Set(rows.map((r) => r.id)).size;
  if (distinct !== rows.length) throw new Error('duplicate ids in the read');
  return rows;
}

function readLedger() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    return [];
  }
}

async function recordOld({ dryRun }) {
  const supabase = client();
  const rows = await cityModRows(supabase);
  const existing = readLedger();
  const seen = new Set(existing.map((e) => e.id));

  const already = rows.filter((r) => seen.has(r.id));
  if (already.length) {
    throw new Error(`${already.length} of these rows are ALREADY in the ledger — `
      + 'ledgering a row twice is refused by tests/frozenBaselineIntegrity.test.mjs');
  }

  const added = rows.map((r) => ({ id: r.id, old: r.total_budget, why: WHY }));
  const merged = [...existing, ...added].sort((a, b) => (a.id < b.id ? -1 : 1));

  console.log(`existing ledger entries : ${existing.length}`);
  console.log(`Ohio city MOD to add    : ${added.length}`);
  console.log(`merged total            : ${merged.length}`);
  for (const e of added.slice(0, 3)) console.log(`  ${e.id}  old=${e.old}`);
  if (dryRun) return console.log('\n(dry run — nothing written)');
  writeFileSync(OUT, `${JSON.stringify(merged, null, 2)}\n`);
  console.log(`\n✅ wrote ${OUT}`);
}

async function recordNew({ dryRun }) {
  const supabase = client();
  const rows = await cityModRows(supabase);
  const byId = new Map(rows.map((r) => [r.id, r.total_budget]));
  const ledger = readLedger();

  let filled = 0;
  const unchanged = [];
  for (const e of ledger) {
    if (!byId.has(e.id)) continue;           // VA's entries, untouched
    const now = byId.get(e.id);
    // ⚠ Refuse an entry whose stored figure still equals `old` — that means the
    // load did NOT land, and writing new===old would ledger a no-op.
    if (now === e.old) { unchanged.push(e.id); continue; }
    e.new = now;
    filled += 1;
  }

  if (unchanged.length) {
    throw new Error(`${unchanged.length} row(s) still hold their OLD figure — the load did not `
      + `land for them. First: ${unchanged[0]}`);
  }
  console.log(`filled \`new\` on ${filled} entr(ies); ledger total ${ledger.length}`);
  if (dryRun) return console.log('(dry run — nothing written)');
  writeFileSync(OUT, `${JSON.stringify(ledger, null, 2)}\n`);
  console.log(`✅ wrote ${OUT}`);
}

const dryRun = process.argv.includes('--dry-run');
if (process.argv.includes('--record-new')) await recordNew({ dryRun });
else await recordOld({ dryRun });
