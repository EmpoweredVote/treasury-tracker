#!/usr/bin/env node
/**
 * Measure how much money the row-dedup key is throwing away.
 *
 *   node --env-file=.env scripts/measureXlsxDedupLoss.mjs
 *   node --env-file=.env scripts/measureXlsxDedupLoss.mjs --source "McKinney Check Register FY2024"
 *
 * READ-ONLY. It downloads and parses; it writes nothing to the database and
 * moves no figure.
 *
 * ── ⚠⚠⚠ THE DEFECT ────────────────────────────────────────────────────────
 *
 * `treasury_sync_transactions` inserts with
 * `ON CONFLICT (budget_id, source_row_id) DO NOTHING`, and `source_row_id` is
 * `hashRow(row)` — a SHA-256 over the WHOLE parsed row. So two rows whose every
 * published column is identical become ONE row in the database.
 *
 * That treats "identical content" as "the same row". It is correct when a
 * publisher exports a line twice. It is WRONG, and silently deletes money, when
 * a government legitimately records the same thing more than once — which is
 * the ordinary case, not the edge case:
 *
 *   x4  $52,962.25  pay#79961  "2024 CHEV TAHOE/DEL FEE"  032-3100-606.92-04
 *
 * Four police vehicles on one purchase order, four identical lines. TT keeps
 * one and discards three.
 *
 * ⚠⚠ THE PUBLISHER'S OWN TOTAL IS THE ORACLE, and it is how this was caught:
 * McKinney FY2024's register carries a `Total` row reading $488,161,856.36
 * while TT publishes $487,659,280.32. The gap is $502,576.04 — exactly the sum
 * this measurement computes. There is no judgement call about whether the
 * figure is wrong.
 *
 * ── WHY IT IMPORTS THE LOADER'S OWN CODE ──────────────────────────────────
 *
 * Parsing and hashing come from scripts/lib/xlsxRows.mjs, which is the module
 * bulkLoadXLSX.js itself uses. A measurement that re-implemented either would
 * be measuring something else and would agree with the loader only by luck.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { writeFileSync } from 'node:fs';
import { downloadXLSX, parseCSV, parseXLSX, hashRow, parseAmount } from './lib/xlsxRows.mjs';

const { values: opts } = parseArgs({
  options: { source: { type: 'string' }, out: { type: 'string' } },
  allowPositionals: true,
});

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

/**
 * The sources this measurement applies to: loaded by bulkLoadXLSX AND holding
 * transactions.
 *
 * ⚠ NOT every `xlsx_download` source. There are 182, but most are budget-tree
 * loaders (processNY.js, seedCAState.js and friends) that never call
 * treasury_sync_transactions and so never touch this dedup key. Measuring them
 * would report a loss that cannot happen.
 */
async function targets() {
  const { data: sources, error } = await db.schema('treasury').from('data_sources')
    .select('id, name, base_url, dataset_type, municipality_id, column_mapping, fiscal_years')
    .eq('api_type', 'xlsx_download').eq('is_enabled', true).order('name');
  if (error) throw new Error(error.message);

  const out = [];
  for (const ds of sources) {
    if (opts.source && ds.name !== opts.source) continue;
    const fy = Array.isArray(ds.fiscal_years) ? ds.fiscal_years[0] : null;
    if (!fy) continue;

    const { data: budget } = await db.schema('treasury').from('budgets')
      .select('id, total_budget')
      .eq('municipality_id', ds.municipality_id).eq('fiscal_year', fy)
      .eq('dataset_type', ds.dataset_type).maybeSingle();
    if (!budget) continue;

    const { count } = await db.schema('treasury').from('transactions')
      .select('id', { count: 'exact', head: true }).eq('budget_id', budget.id);
    if (!count) continue;                 // no transactions → not this loader

    out.push({ ds, fy, budget, stored: count });
  }
  return out;
}

async function measure({ ds, fy, budget, stored }) {
  const buf = await downloadXLSX(ds.base_url);
  const isCsv = /\.csv$/i.test(ds.base_url);
  const { rows } = isCsv ? parseCSV(buf) : await parseXLSX(buf, ds.column_mapping || {});

  const amountCol = (ds.column_mapping || {}).amount_column;
  const seen = new Map();          // hash -> { n, amount }
  for (const r of rows) {
    const h = hashRow(r);
    if (!seen.has(h)) seen.set(h, { n: 0, amount: amountCol ? parseAmount(r[amountCol]) : 0 });
    seen.get(h).n += 1;
  }

  let collapsed = 0;
  let lost = 0;
  for (const g of seen.values()) {
    if (g.n > 1) { collapsed += g.n - 1; lost += g.amount * (g.n - 1); }
  }

  return {
    source: ds.name,
    fiscal_year: fy,
    parsed_rows: rows.length,
    distinct_rows: seen.size,
    collapsed,
    money_lost: Math.round(lost * 100) / 100,
    stored_txns: stored,
    stored_total: Number(budget.total_budget),
    // ⚠ The reconciliation that makes this more than an estimate: if the loader
    // is the only thing dropping rows, parsed - collapsed must equal what is
    // stored. Where it does not, something ELSE is also dropping rows and the
    // figure below is only part of the story.
    reconciles: rows.length - collapsed === stored,
  };
}

async function main() {
  const list = await targets();
  if (!list.length) {
    console.error('no transaction-backed xlsx source matched.');
    process.exitCode = 1;
    return;
  }
  console.log(`measuring ${list.length} transaction-backed xlsx source(s)\n`);

  const results = [];
  for (const t of list) {
    try {
      const r = await measure(t);
      results.push(r);
      const flag = r.reconciles ? ' ' : '⚠';
      console.log(
        `${flag} ${r.source.padEnd(34)} parsed ${String(r.parsed_rows).padStart(7)} ` +
        `| collapsed ${String(r.collapsed).padStart(6)} ` +
        `| lost $${r.money_lost.toLocaleString(undefined, { minimumFractionDigits: 2 }).padStart(16)}`,
      );
    } catch (e) {
      console.log(`✗ ${t.ds.name.padEnd(34)} ${e.message.slice(0, 90)}`);
      results.push({ source: t.ds.name, fiscal_year: t.fy, error: e.message });
    }
  }

  const ok = results.filter((r) => !r.error);
  const totalLost = ok.reduce((a, r) => a + r.money_lost, 0);
  const totalCollapsed = ok.reduce((a, r) => a + r.collapsed, 0);
  const unreconciled = ok.filter((r) => !r.reconciles);

  console.log(`\n${'='.repeat(78)}`);
  console.log(`${ok.length} source(s) measured, ${results.length - ok.length} failed`);
  console.log(`rows discarded by the dedup key : ${totalCollapsed.toLocaleString()}`);
  console.log(`money discarded                 : $${totalLost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
  if (unreconciled.length) {
    console.log(`\n⚠ ${unreconciled.length} source(s) do NOT reconcile — parsed minus collapsed does not`);
    console.log('  equal what is stored, so dedup is not the only thing dropping rows there:');
    for (const r of unreconciled) {
      console.log(`    ${r.source}: parsed ${r.parsed_rows} - collapsed ${r.collapsed} = ` +
        `${r.parsed_rows - r.collapsed}, stored ${r.stored_txns} (diff ${r.parsed_rows - r.collapsed - r.stored_txns})`);
    }
  }

  const path = opts.out || 'dedup-loss.json';
  writeFileSync(path, `${JSON.stringify({ measured_at: new Date().toISOString(), results }, null, 2)}\n`);
  console.log(`\nwrote ${path}`);
}

await main();
