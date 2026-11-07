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

/**
 * ⚠⚠⚠ ARGV IS PARSED INSIDE main(), NOT AT IMPORT.
 *
 * This module exports rebuildBudget(), and bulkLoadXLSX.js imports it. When
 * parseArgs ran at module scope it ran in the IMPORTER'S process, against the
 * IMPORTER'S argv, in strict mode — so `bulkLoadXLSX.js --force-reload` died
 * at import with "Unknown option '--force-reload'" before a single row moved.
 *
 * `--force-reload` was broken for every xlsx source from #331 until this was
 * found, and nothing caught it because the loader's own tests never import it
 * with a flag this module does not declare. A library that reads argv when it
 * is merely imported is a library that breaks its callers.
 */
let opts = {};
function parseCliArgs() {
  return parseArgs({
    options: {
      source: { type: 'string' },
      municipality: { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
    allowPositionals: true,
    strict: false,
  }).values;
}

/**
 * ⚠⚠⚠ LAZY. createClient() THROWS when no key is present, so building the
 * client at module scope made this module impossible to import without
 * credentials — which broke CI the moment a test imported bulkLoadXLSX.js,
 * since that imports rebuildBudget from here.
 *
 * This is the same lesson as the argv parsing above, in the same file: a
 * module that exports a function must not DO anything merely by being
 * imported. Build the client when a caller actually needs it.
 */
let _db = null;
function db() {
  if (!_db) {
    _db = createClient(
      process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }
  return _db;
}

/**
 * ⚠ Paged. A budget's transactions run to tens of thousands; PostgREST caps at 1,000.
 *
 * ── ⚠⚠ THE VENDOR JOIN IS ASKED FOR, NOT ASSUMED ────────────────────────────
 *
 * Only a vendor-KEYED source needs the names (Frisco labels its roots with
 * them). McKinney keys on department codes and West Hollywood on the
 * publisher's category, and both were paying for a join they never read. When
 * it IS asked for it still travels with the same read, so the naming rule
 * stays a pure function of the rows it was given.
 *
 * ⚠ MEASURED, because the obvious culprit was the wrong one. Deep offsets are
 * CHEAP here — page 41 of McKinney FY2022 came back in 332ms with the join and
 * 106ms without. The join is what is slow and, worse, VARIABLE: the same page
 * shape took 114ms, 3,015ms and 5,041ms across runs, and ONE page exceeding
 * the statement timeout fails the whole read. This is not a paging bug, and
 * keyset paging does not fix it.
 *
 * ── ⛔⛔ AND IT IS NOT FIXED, ONLY CHEAPER. READ THIS BEFORE TRUSTING IT ──────
 *
 * `rebuildTransactionTree.mjs --municipality McKinney` still FAILS. Before
 * this change every one of McKinney's four registers (45,844 / 47,169 /
 * 47,324 / 50,096 rows) died on the FIRST one with `canceling statement due
 * to statement timeout`; now FY2022 and FY2023 complete and FY2024 still
 * times out (FY2025 is never reached). That command is the exact remedy
 * `verify:txn-trees` prints when a tree goes red, so the fleet's largest
 * trees STILL cannot be repaired.
 *
 * ⭐ The real fix is to stop shipping ~48,000 rows to Node to add them up.
 * The grouping already exists in SQL — `transaction_tree_status()` does the
 * same `group by link_key` in-database — so a `treasury.transaction_roots
 * (budget_id)` RPC returning `(link_key, amount, item_count)` would make a
 * rebuild ONE query instead of forty-eight, at any size. That is a change to
 * how every tree is built, including Frisco's vendor labels, and it is
 * deliberately NOT bundled into the West Hollywood fix.
 *
 * ⚠ West Hollywood is unaffected either way: its largest year is 24,831 rows
 * and all eight rebuild in well under the timeout.
 */
async function transactionsOf(budgetId, { withVendorNames = false } = {}) {
  const rows = [];
  const select = withVendorNames
    ? 'id, amount, link_key, vendors(name)'
    : 'id, amount, link_key';
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().schema('treasury').from('transactions')
      .select(select).eq('budget_id', budgetId)
      .order('id').range(from, from + 999);
    if (error) throw new Error(`transactions read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/**
 * Fill in the publisher columns for the UNKEYED rows only, so
 * `isEmptyPublishedRow` can tell a row the publisher published empty from a
 * row whose key the loader lost.
 *
 * ⚠⚠ A SECOND, TINY QUERY RATHER THAN A WIDER FIRST ONE. Selecting these nine
 * columns in `transactionsOf` instead put McKinney straight back into
 * `canceling statement due to statement timeout` — 13 columns across ~48,000
 * rows where 3 had been enough. Unkeyed rows are vanishingly rare by
 * construction, which is the whole point of the refusal they feed: this reads
 * ONE row on West Hollywood FY2018-19 and none at all anywhere else.
 */
async function fillUnkeyedDetail(txns) {
  const unkeyed = txns.filter((t) => t.link_key === null || t.link_key === undefined || t.link_key === '');
  if (!unkeyed.length) return;

  const byId = new Map(unkeyed.map((t) => [t.id, t]));
  // ⚠ Fetched BY ID, not by `is('link_key', null)`. An empty-STRING key is
  // unkeyed too and that filter would miss it — leaving the row with no
  // publisher columns at all, which `isEmptyPublishedRow` would then read as
  // empty. A row must never be called empty because we failed to look at it.
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await db().schema('treasury').from('transactions')
      .select('id, description, payment_date, payment_method, payment_number, '
        + 'invoice_number, fund, expense_category, department, program')
      .in('id', ids.slice(i, i + 500));
    if (error) throw new Error(`unkeyed detail read failed: ${error.message}`);
    for (const row of data) Object.assign(byId.get(row.id), row);
  }

  const missed = ids.filter((id) => !('description' in byId.get(id)));
  if (missed.length) {
    throw new Error(
      `${missed.length} unkeyed row(s) could not be re-read (first ${missed[0]}). Refusing to ` +
      `judge whether they are empty without having seen them.`,
    );
  }
}

async function rootsOf(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().schema('treasury').from('budget_categories')
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
  let q = db().schema('treasury').from('budgets')
    .select('id, fiscal_year, dataset_type, data_source, total_budget, municipality_id');

  if (opts.source) {
    q = q.eq('data_source', opts.source);
  } else if (opts.municipality) {
    const { data: m, error } = await db().schema('treasury').from('municipalities')
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

  const txns = await transactionsOf(budget.id, { withVendorNames: r.needsVendorNames });
  await fillUnkeyedDetail(txns);

  // ⚠ Built from the SAME rows the roll-up sees, so a key can never resolve to
  // a name that came from a different read. Empty for a source that did not
  // ask for the join — and a resolver that needs it declares that it does.
  const vendorNameByKey = new Map();
  for (const t of txns) {
    const name = t.vendors?.name;
    if (t.link_key != null && name != null && !vendorNameByKey.has(t.link_key)) {
      vendorNameByKey.set(t.link_key, name);
    }
  }

  const { roots, total, emptyRows } = rollUpTransactions(
    txns,
    (keys) => r.resolveNames(keys, { vendorNameByKey }),
    { keepTop: r.keepTop, tailKey: r.tailKey, tailName: r.tailName },
  );
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
    // ⚠ Printed every run, never swallowed. An exclusion nobody can see is
    // indistinguishable from a row that was quietly lost.
    if (emptyRows) {
      console.log(`    ${emptyRows} row(s) the publisher published EMPTY ($0, no date, no ` +
        `description) are in no category — they are stored, and they move no money.`);
    }
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
    const { error } = await db().schema('treasury').from('budget_categories')
      .update({
        name: u.after.name, amount: u.after.amount, actual_amount: u.after.actual_amount,
        percentage: u.after.percentage, item_count: u.after.item_count, sort_order: u.after.sort_order,
      }).eq('id', u.id);
    if (error) throw new Error(`update ${u.id} failed: ${error.message}`);
  }
  if (inserts.length) {
    const { error } = await db().schema('treasury').from('budget_categories')
      .insert(inserts.map((i) => ({
        budget_id: budget.id, parent_id: null, depth: 0,
        name: i.name, amount: i.amount, actual_amount: i.actual_amount,
        percentage: i.percentage, item_count: i.item_count, sort_order: i.sort_order, link_key: i.link_key,
      })));
    if (error) throw new Error(`insert failed: ${error.message}`);
  }
  for (const d of deletes) {
    const { error } = await db().schema('treasury').from('budget_categories').delete().eq('id', d.id);
    if (error) throw new Error(`delete ${d.id} failed: ${error.message}`);
  }

  return { inserts: inserts.length, updates: updates.length, deletes: deletes.length };
}

async function main() {
  opts = parseCliArgs();
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
