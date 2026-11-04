#!/usr/bin/env node
/**
 * Find days a publisher exported TWICE, across every transaction-backed xlsx
 * source.
 *
 *   node --env-file=.env scripts/detectDoubledExportDays.mjs
 *   node --env-file=.env scripts/detectDoubledExportDays.mjs --source "Frisco Check Register FY2019"
 *
 * READ-ONLY. It downloads and parses; it writes nothing to the database and
 * moves no figure.
 *
 * ── WHY IT MATTERS, AND WHAT IT CORRECTS ──────────────────────────────────
 *
 * PR #334 measured $46.17M discarded fleet-wide by the row-dedup key and
 * concluded Frisco's $17.9M share was "probably real but unprovable without an
 * oracle". THAT CONCLUSION WAS WRONG, and this script is the proof.
 *
 * Frisco needs no oracle. Four days in June 2019 have 100% of their distinct
 * rows appearing an even number of times and NOT ONE row appearing exactly
 * once, against a 1.3% even baseline in the same file one month earlier. That
 * is an export written twice, and the content hash is already doing the right
 * thing by discarding it.
 *
 * Measured 2026-11-04 across all 15 Frisco + Plano sources:
 *
 *     EXPORT DOUBLING — dedup is CORRECT     4,156 rows   $39,075,332.74
 *     ORDINARY BACKGROUND — probably real    6,748 rows    $4,272,431.64
 *
 * ⛔ So do NOT switch Frisco or Plano to dedup:'occurrence'. The comment in
 * supabase/migrations/20261104200000_mckinney_occurrence_dedup.sql reasons from
 * Plano having a DocumentNumber and Frisco lacking one; it reaches the right
 * answer for Plano and the WRONG one for Frisco.
 *
 * ✅ McKinney is clean — zero doubled days across all 8 of its sources — so the
 * occurrence policy it is on remains correct. Its worst-looking day,
 * 2022-02-04 at 51% duplicate rows, is one uniform-rental payment with 132
 * identical $13.60 garment lines, and the test correctly clears it.
 *
 * ⚠ The loader runs the same judgement on every occurrence-keyed source and
 * REFUSES the load if a doubled day appears, because the publisher's own Total
 * row cannot catch one. See scripts/lib/doubledExportDays.mjs.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { downloadXLSX, parseCSV, parseXLSX } from './lib/xlsxRows.mjs';
import { judgeDoubledExportDays, describeDoubledDays } from './lib/doubledExportDays.mjs';

const { values: opts } = parseArgs({
  options: { source: { type: 'string' }, out: { type: 'string' } },
  allowPositionals: true,
});

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

/**
 * ⚠ Only sources that hold transactions. Most of the 182 xlsx_download rows are
 * budget-tree loaders that never call treasury_sync_transactions and so never
 * touch this key; reporting on them would describe a risk they do not carry.
 */
async function targets() {
  const { data: sources, error } = await db.schema('treasury').from('data_sources')
    .select('id, name, base_url, dataset_type, municipality_id, column_mapping, fiscal_years')
    .eq('api_type', 'xlsx_download').eq('is_enabled', true).order('name');
  if (error) throw new Error(error.message);

  const out = [];
  for (const ds of sources) {
    if (opts.source && !ds.name.includes(opts.source)) continue;
    const fy = Array.isArray(ds.fiscal_years) ? ds.fiscal_years[0] : null;
    if (!fy) continue;

    const { data: budget } = await db.schema('treasury').from('budgets')
      .select('id').eq('municipality_id', ds.municipality_id)
      .eq('fiscal_year', fy).eq('dataset_type', ds.dataset_type).maybeSingle();
    if (!budget) continue;

    const { count } = await db.schema('treasury').from('transactions')
      .select('id', { count: 'exact', head: true }).eq('budget_id', budget.id);
    if (!count) continue;

    out.push({ ds, fy });
  }
  return out;
}

async function inspect({ ds, fy }) {
  const cm = ds.column_mapping || {};
  const buf = ds.base_url.startsWith('file://')
    ? readFileSync(decodeURIComponent(ds.base_url.replace(/^file:\/\//, '')))
    : await downloadXLSX(ds.base_url);
  const isCsv = /\.csv$/i.test(ds.base_url);
  const { rows } = isCsv ? parseCSV(buf) : await parseXLSX(buf, cm);

  const verdict = judgeDoubledExportDays(rows, {
    dateColumn: cm.date_column,
    amountColumn: cm.amount_column,
  });

  return {
    source: ds.name,
    fiscal_year: fy,
    dedup_policy: cm.dedup || 'content',
    parsed_rows: rows.length,
    supported: verdict.supported,
    reason: verdict.reason || null,
    doubled_days: verdict.certified.map((d) => ({
      date: d.date, rows: d.rows, distinct: d.distinct, extra: d.extra,
      even_share: Number(d.evenShare.toFixed(4)), once_share: Number(d.onceShare.toFixed(4)),
      amount: d.amount, spillover: d.spillover,
    })),
    rows_doubled: verdict.rowsDoubled,
    amount_doubled: verdict.amountDoubled,
    // ⚠ The money the key discards that this test does NOT explain. Probably
    // genuine repeated payments — and still unprovable without an oracle.
    background_rows: verdict.days.reduce((a, d) => a + (d.certified ? 0 : d.extra), 0),
    background_amount: Math.round(verdict.days.reduce((a, d) => a + (d.certified ? 0 : d.amount), 0) * 100) / 100,
  };
}

async function main() {
  const list = await targets();
  if (!list.length) {
    console.error('no transaction-backed xlsx source matched.');
    process.exitCode = 1;
    return;
  }
  console.log(`checking ${list.length} transaction-backed xlsx source(s) for doubled export days\n`);

  const results = [];
  for (const t of list) {
    try {
      const r = await inspect(t);
      results.push(r);
      const flag = !r.supported ? '? ' : (r.doubled_days.length ? '⛔' : '✅');
      console.log(`${flag} ${r.source.padEnd(34)} ${String(r.parsed_rows).padStart(7)} rows` +
        (r.supported
          ? (r.doubled_days.length
            ? `  | ${r.doubled_days.length} DOUBLED day(s), ${r.rows_doubled.toLocaleString()} rows, $${r.amount_doubled.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            : '  | clean')
          : `  | NOT CHECKABLE: ${r.reason}`));
      for (const line of describeDoubledDays({ certified: r.doubled_days.map((d) => ({ ...d, evenShare: d.even_share, onceShare: d.once_share })) })) {
        console.log(`     ${line}`);
      }
    } catch (e) {
      console.log(`✗ ${t.ds.name.padEnd(34)} ${e.message.slice(0, 90)}`);
      results.push({ source: t.ds.name, fiscal_year: t.fy, error: e.message });
    }
  }

  const ok = results.filter((r) => !r.error && r.supported);
  const doubledRows = ok.reduce((a, r) => a + r.rows_doubled, 0);
  const doubledMoney = ok.reduce((a, r) => a + r.amount_doubled, 0);
  const bgRows = ok.reduce((a, r) => a + r.background_rows, 0);
  const bgMoney = ok.reduce((a, r) => a + r.background_amount, 0);
  const atRisk = ok.filter((r) => r.dedup_policy === 'occurrence' && r.doubled_days.length);

  const money = (n) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  console.log(`\n${'='.repeat(84)}`);
  console.log(`EXPORT DOUBLING — the dedup key is CORRECT to discard this`);
  console.log(`  ${doubledRows.toLocaleString()} rows  ${money(doubledMoney)}`);
  console.log(`ORDINARY BACKGROUND — probably genuine repeats, still unprovable`);
  console.log(`  ${bgRows.toLocaleString()} rows  ${money(bgMoney)}`);

  if (atRisk.length) {
    console.log(`\n⛔ ${atRisk.length} source(s) are keyed by OCCURRENCE *and* contain a doubled day.`);
    console.log('   Their loads would insert money that was never spent. The loader refuses these.');
    for (const r of atRisk) console.log(`     ${r.source}`);
    process.exitCode = 1;
  } else {
    console.log('\n✅ No occurrence-keyed source contains a doubled export day.');
  }

  const unchecked = results.filter((r) => !r.error && !r.supported);
  if (unchecked.length) {
    console.log(`\n⚠ ${unchecked.length} source(s) could not be checked at all:`);
    for (const r of unchecked) console.log(`     ${r.source}: ${r.reason}`);
  }

  if (opts.out) {
    writeFileSync(opts.out, `${JSON.stringify({ measured_at: new Date().toISOString(), results }, null, 2)}\n`);
    console.log(`\nwrote ${opts.out}`);
  }
}

await main();
