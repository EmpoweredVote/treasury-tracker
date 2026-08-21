#!/usr/bin/env node
/**
 * Restore rows archived by LA-02 back into treasury.budgets (+ categories, line items).
 *
 * A backup nobody can restore is an artifact, not a backup. This is the restore path
 * for `.planning/backups/la-city/la02-withdrawn-rows-fy2021-2026.json.gz`.
 *
 * ⚠ READ THIS BEFORE RESTORING ANYTHING. The archived FMS appropriation-ledger rows are
 * NOT comparable to the CA State Controller series now in production:
 *   - they include Tax Revenue Anticipation Note PROCEEDS (borrowing, i.e. money IN) —
 *     16.5% of the FY2026 total,
 *   - they are a departmental appropriation ledger, not audited fund-statement actuals.
 * They were withdrawn deliberately (see docs/superpowers/plans/LA-02-CLOSEOUT.md §3).
 * Restoring them as `operating` puts them straight back on the Money Out chart. If you
 * want the departmental detail back, give it an honest source label and a scope/basis that
 * does NOT collide with the SCO series — do not simply undo the withdrawal.
 *
 * Dry run by default. Nothing is written without --commit.
 *
 * Usage:
 *   node scripts/la02RestoreBackup.mjs <archive.json.gz>                    # dry run
 *   node scripts/la02RestoreBackup.mjs <archive.json.gz> --only 2026        # one FY
 *   node scripts/la02RestoreBackup.mjs <archive.json.gz> --only 2026 --commit
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
const COMMIT = argv.includes('--commit');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx >= 0 && argv[onlyIdx + 1] ? Number(argv[onlyIdx + 1]) : null;
if (!file) { console.error('usage: la02RestoreBackup.mjs <archive.json.gz> [--only FY] [--commit]'); process.exit(1); }

const SB_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY && COMMIT) { console.error('Missing SUPABASE_SERVICE_KEY (needed for --commit)'); process.exit(1); }
const db = KEY ? createClient(SB_URL, KEY) : null;

const buf = readFileSync(file);
const archive = JSON.parse((file.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8'));

let budgets = archive.budgets;
if (ONLY != null) budgets = budgets.filter(b => b.fiscal_year === ONLY);
if (!budgets.length) { console.error(`Nothing in the archive matches --only ${ONLY}`); process.exit(1); }

console.log(`Archive: ${archive.archive} (created ${archive.created})`);
console.log(`⚠ ${archive.do_not_restore_blindly}\n`);
console.log(COMMIT ? '*** COMMIT MODE — this WILL write to the database ***\n' : 'DRY RUN — nothing will be written (pass --commit to write)\n');

let wrote = 0;
for (const b of budgets.sort((x, y) => x.fiscal_year - y.fiscal_year)) {
  const cats = archive.categories.filter(c => c.budget_id === b.id);
  const catIds = new Set(cats.map(c => c.id));
  const items = archive.line_items.filter(li => catIds.has(li.category_id));
  const roots = cats.filter(c => !c.parent_id);
  const rootSum = roots.reduce((s, c) => s + Number(c.amount || 0), 0);
  const total = Number(b.total_budget);
  const ties = Math.abs(rootSum - total) < 1;

  console.log(`FY${b.fiscal_year} ${b.dataset_type} — ${total.toLocaleString()} · ${b.data_source}`);
  console.log(`  ${cats.length} categories (${roots.length} roots), ${items.length} line items · roots sum ${ties ? 'TIES' : 'DIFFERS: ' + rootSum.toLocaleString()}`);
  if (!ties) { console.error('  ✗ refusing: archived roots do not sum to the archived total'); process.exitCode = 1; continue; }

  if (db) {
    const { data: clash } = await db.schema('treasury').from('budgets')
      .select('id,data_source,fund_scope,basis')
      .eq('municipality_id', b.municipality_id).eq('fiscal_year', b.fiscal_year)
      .eq('dataset_type', b.dataset_type);
    if (clash?.length) {
      console.log(`  ⚠ ${clash.length} row(s) already occupy (muni, FY, ${b.dataset_type}): ` +
        clash.map(c => `${c.data_source} [${c.fund_scope}/${c.basis}]`).join(', '));
      console.log('    Restoring would create a SECOND row for this year. Decide the scope/basis first.');
    }
  }
  if (!COMMIT) { console.log('  (dry run — not written)\n'); continue; }

  const { error: bErr } = await db.schema('treasury').from('budgets').insert(b);
  if (bErr) { console.error(`  ✗ budget insert failed: ${bErr.message}`); process.exitCode = 1; continue; }
  for (let i = 0; i < cats.length; i += 500) {
    const { error } = await db.schema('treasury').from('budget_categories').insert(cats.slice(i, i + 500));
    if (error) { console.error(`  ✗ categories failed: ${error.message}`); process.exitCode = 1; }
  }
  for (let i = 0; i < items.length; i += 500) {
    const { error } = await db.schema('treasury').from('budget_line_items').insert(items.slice(i, i + 500));
    if (error) { console.error(`  ✗ line items failed: ${error.message}`); process.exitCode = 1; }
  }
  console.log('  ✓ restored\n');
  wrote++;
}
console.log(COMMIT ? `Done — ${wrote} budget row(s) restored.` : 'Dry run complete. Re-run with --commit to write.');
