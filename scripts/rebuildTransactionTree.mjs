#!/usr/bin/env node
/**
 * Rebuild a transaction-backed budget's category tree from its transactions.
 *
 *   node --env-file=.env scripts/rebuildTransactionTree.mjs --source "McKinney Check Register FY2024" --dry-run
 *   node --env-file=.env scripts/rebuildTransactionTree.mjs --municipality McKinney
 *
 * ⚠⚠⚠ THIS IS THE DURABILITY. `treasury_sync_transactions` writes transactions
 * and recomputes `budgets.total_budget`; it does NOT touch `budget_categories`.
 * The trees over those transactions were built once, by a migration applied
 * through the dashboard and never committed, so until now there has been no
 * repeatable way to produce one. A `--force-reload` deletes and rewrites every
 * transaction underneath a tree that nothing re-derives — and nothing noticed
 * when the two drifted apart.
 *
 * They already had. McKinney's $79.1M FY2024 root was keyed `unknown` while
 * the rows beneath it carried a NULL key, and the live drill-down returned
 * `null`. See scripts/lib/publisherIds.mjs for how the key was lost.
 *
 * Run after any load of an enrolled source. bulkLoadXLSX.js calls it
 * automatically; this entry point exists for repair and verification.
 *
 * ⚠ Names come from scripts/lib/transactionTreeSources.mjs, which is opt-in. A
 * source with no sourced naming rule is REFUSED, never given a default —
 * inventing a label is the defect this whole line of work removed.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { rollUpTransactions, diffTree } from './lib/transactionTree.mjs';
import { resolverFor } from './lib/transactionTreeSources.mjs';

const { values: opts } = parseArgs({
  options: {
    source: { type: 'string' },
    municipality: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
  allowPositionals: true,
});

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

/** ⚠ Paged. A budget's transactions run to tens of thousands; PostgREST caps at 1,000. */
async function transactionsOf(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('transactions')
      .select('id, amount, link_key').eq('budget_id', budgetId)
      .order('id').range(from, from + 999);
    if (error) throw new Error(`transactions read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function rootsOf(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('budget_categories')
      .select('id, name, amount, actual_amount, percentage, item_count, sort_order, link_key')
      .eq('budget_id', budgetId).is('parent_id', null)
      .order('id').range(from, from + 999);
    if (error) throw new Error(`budget_categories read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/** Budgets to rebuild, resolved from --source or --municipality. */
async function targets() {
  let q = db.schema('treasury').from('budgets')
    .select('id, fiscal_year, dataset_type, data_source, total_budget, municipality_id');

  if (opts.source) {
    q = q.eq('data_source', opts.source);
  } else if (opts.municipality) {
    const { data: m, error } = await db.schema('treasury').from('municipalities')
      .select('id').ilike('name', opts.municipality);
    if (error) throw new Error(error.message);
    if (!m.length) throw new Error(`no municipality named ${JSON.stringify(opts.municipality)}`);
    q = q.in('municipality_id', m.map((x) => x.id));
  } else {
    throw new Error('usage: --source "<data_source name>" | --municipality <name>  [--dry-run]');
  }

  const { data, error } = await q.order('fiscal_year');
  if (error) throw new Error(error.message);
  return data.filter((b) => resolverFor(b.data_source, b.fiscal_year));
}

export async function rebuildBudget(budget, { dryRun = false, quiet = false } = {}) {
  const r = resolverFor(budget.data_source, budget.fiscal_year);
  if (!r) {
    throw new Error(
      `${budget.data_source} is not enrolled in scripts/lib/transactionTreeSources.mjs. ` +
      `Rebuilding its tree would mean choosing names for it, and an unchecked naming rule is ` +
      `exactly how invented labels got onto McKinney's money. Add a sourced rule and a test first.`,
    );
  }

  const txns = await transactionsOf(budget.id);
  const { roots, total } = rollUpTransactions(txns, r.resolveNames);
  const existing = await rootsOf(budget.id);
  const { inserts, updates, deletes } = diffTree(existing, roots);

  // ⚠⚠ The tree must agree with the headline the RPC computed from the SAME
  // transactions. If it does not, one of the two reads is incomplete — which is
  // what a truncated paged read looks like, and it has gone wrong six times.
  const stored = Number(budget.total_budget);
  if (Math.abs(total - stored) > 0.01) {
    throw new Error(
      `${budget.data_source}: roots sum to ${total.toLocaleString()} but the budget total is ` +
      `${stored.toLocaleString()} (difference ${(total - stored).toLocaleString()}). Both come from ` +
      `the same transactions, so a mismatch means a read came back short. Refusing to write.`,
    );
  }

  if (!quiet) {
    console.log(`${budget.data_source}: ${txns.length} txns -> ${roots.length} roots ` +
      `| +${inserts.length} ~${updates.length} -${deletes.length}`);
    for (const u of updates.slice(0, 4)) {
      const b = u.before; const a = u.after;
      if (b.name !== a.name) console.log(`    ${JSON.stringify(b.name)} -> ${JSON.stringify(a.name)}`);
    }
    for (const d of deletes) console.log(`    - ${JSON.stringify(d.name)} (key ${d.link_key})`);
    for (const i of inserts) console.log(`    + ${JSON.stringify(i.name)} (key ${i.link_key})`);
  }

  if (dryRun) return { inserts: inserts.length, updates: updates.length, deletes: deletes.length };

  // ⚠ UPDATE the columns this script owns and no others. `description` and
  // `why_matters` are enrichment and must survive a rebuild untouched.
  for (const u of updates) {
    const { error } = await db.schema('treasury').from('budget_categories')
      .update({
        name: u.after.name, amount: u.after.amount, actual_amount: u.after.actual_amount,
        percentage: u.after.percentage, item_count: u.after.item_count, sort_order: u.after.sort_order,
      }).eq('id', u.id);
    if (error) throw new Error(`update ${u.id} failed: ${error.message}`);
  }
  if (inserts.length) {
    const { error } = await db.schema('treasury').from('budget_categories')
      .insert(inserts.map((i) => ({
        budget_id: budget.id, parent_id: null, depth: 0,
        name: i.name, amount: i.amount, actual_amount: i.actual_amount,
        percentage: i.percentage, item_count: i.item_count, sort_order: i.sort_order, link_key: i.link_key,
      })));
    if (error) throw new Error(`insert failed: ${error.message}`);
  }
  for (const d of deletes) {
    const { error } = await db.schema('treasury').from('budget_categories').delete().eq('id', d.id);
    if (error) throw new Error(`delete ${d.id} failed: ${error.message}`);
  }

  return { inserts: inserts.length, updates: updates.length, deletes: deletes.length };
}

async function main() {
  const budgets = await targets();
  if (!budgets.length) {
    console.log('no enrolled budget matched — nothing to do.');
    return;
  }
  console.log(`rebuilding ${budgets.length} tree(s)${opts['dry-run'] ? ' (DRY RUN)' : ''}\n`);
  let ins = 0, upd = 0, del = 0;
  for (const b of budgets) {
    const r = await rebuildBudget(b, { dryRun: opts['dry-run'] });
    ins += r.inserts; upd += r.updates; del += r.deletes;
  }
  console.log(`\n${ins} inserted, ${upd} updated, ${del} deleted.`);
}

if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) await main();
