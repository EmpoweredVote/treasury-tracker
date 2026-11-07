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
 * The budget's transactions, ALREADY GROUPED BY `link_key`, from
 * `treasury.transaction_roots`.
 *
 * ── ⚠⚠⚠ WHY THIS IS AN AGGREGATE AND NOT A PAGED READ ───────────────────────
 *
 * This used to read every transaction a page at a time and add them up in
 * Node. It did not work. All four McKinney registers (45,844 / 47,169 /
 * 47,324 / 50,096 rows) died with `canceling statement due to statement
 * timeout` — and that is the exact command `verify:txn-trees` prints when a
 * tree goes red, so the fleet's largest trees could not be repaired at all.
 *
 * ⚠⚠ LA CITY SETTLED IT: FY2025 is 749,295 transactions, or 750 pages. There
 * is no version of page-by-page that builds that tree, and LA is $24.5B over
 * two years with no breakdown today.
 *
 * ⚠ MEASURED along the way, because the obvious culprit was the wrong one.
 * Deep offsets were CHEAP (page 41 of McKinney FY2022: 332ms with the vendors
 * join, 106ms without). The join was slow and, worse, VARIABLE — 114ms,
 * 3,015ms and 5,041ms for the same page shape — and ONE page over the
 * statement timeout fails the whole read. Keyset paging was written for this,
 * measured, and reverted: it was never a paging bug. The fix is to not ship
 * the rows at all. LA FY2025 now groups in ~1.1s.
 *
 * ⚠ STILL PAGED, but over KEYS, not transactions: PostgREST caps any response
 * at 1,000 rows, and LA FY2025 has 2,846 distinct keys. That is 3 pages, not
 * 750. Ordered by `link_key` so the pages cannot overlap or skip — see
 * [[paged_reads_need_total_order]]; `link_key` is unique per group here, so it
 * is a total order.
 */
async function groupedTransactionsOf(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().schema('treasury')
      .rpc('transaction_roots', { p_budget_id: budgetId })
      .select('link_key, amount, item_count, vendor_name')
      // ⚠ nullsFirst:false pins the unkeyed group to the END on every page,
      // rather than letting its position vary between requests.
      .order('link_key', { nullsFirst: false })
      .range(from, from + 999);
    if (error) throw new Error(`transaction_roots failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/**
 * How many unkeyed rows this script is willing to look at one by one.
 *
 * ⚠ An unkeyed row is supposed to be vanishingly rare — the whole point of the
 * refusal it feeds. One (West Hollywood FY2018-19) is a publisher's empty row;
 * thousands is a broken load, and re-reading them to ask politely whether each
 * is "empty" would be both slow and beside the point.
 */
const UNKEYED_INSPECT_LIMIT = 1000;

/**
 * The actual unkeyed rows, with the publisher columns `isEmptyPublishedRow`
 * needs to tell a row the publisher published EMPTY from a row whose key the
 * loader lost.
 *
 * ⚠⚠ The aggregate cannot answer this: a GROUP has no `description` or
 * `payment_date` to inspect. So the keyed groups come back summed, and the
 * handful of unkeyed rows come back individually — which is also why a group
 * and a transaction can be fed to `rollUpTransactions` side by side.
 *
 * ⚠ Matches `link_key is null` OR `= ''`. An empty STRING is unkeyed too, and
 * a filter that missed it would hand back a row with no publisher columns,
 * which `isEmptyPublishedRow` would then read as empty. A row must never be
 * called empty because we failed to look at it.
 */
async function unkeyedRowsOf(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().schema('treasury').from('transactions')
      .select('id, amount, link_key, description, payment_date, payment_method, '
        + 'payment_number, invoice_number, fund, expense_category, department, program')
      .eq('budget_id', budgetId).or('link_key.is.null,link_key.eq.')
      .order('id').range(from, from + 999);
    if (error) throw new Error(`unkeyed rows read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
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

  const grouped = await groupedTransactionsOf(budget.id);

  /**
   * ⚠⚠ The keyed groups arrive SUMMED; the unkeyed rows arrive ONE BY ONE and
   * replace their group. `rollUpTransactions` accepts both because a group is
   * just a row carrying an `item_count` — see its note. The unkeyed group is
   * dropped here precisely so it cannot be counted twice.
   */
  const unkeyedGroup = grouped.find((g) => g.link_key === null || g.link_key === '');
  const keyed = grouped.filter((g) => g !== unkeyedGroup);

  let unkeyedRows = [];
  if (unkeyedGroup) {
    const n = Number(unkeyedGroup.item_count);
    // ⚠ Refuse with the AGGREGATE's own numbers rather than re-reading
    // thousands of rows to ask whether each is an empty publisher row. At this
    // volume it is a broken load, not a publisher's blank line.
    if (n > UNKEYED_INSPECT_LIMIT) {
      throw new Error(
        `${budget.data_source}: ${n.toLocaleString()} transaction(s) totalling ` +
        `${Number(unkeyedGroup.amount).toLocaleString(undefined, { style: 'currency', currency: 'USD' })} ` +
        `have NO link_key. That is far too many to be rows the publisher published empty — ` +
        `the loader lost the key. Fix the loader; do NOT bucket them.`,
      );
    }
    unkeyedRows = await unkeyedRowsOf(budget.id);
    if (unkeyedRows.length !== n) {
      throw new Error(
        `${budget.data_source}: the aggregate counted ${n} unkeyed row(s) but ${unkeyedRows.length} ` +
        `came back. Refusing to judge rows we did not see.`,
      );
    }
  }

  // ⚠ Built from the SAME read the roll-up sees, so a key can never resolve to
  // a name that came from a different query. Only Frisco reads this: its
  // link_key is DERIVED from the vendor name, so the relation is 1:1.
  const vendorNameByKey = new Map();
  for (const g of keyed) {
    if (g.link_key != null && g.vendor_name != null) vendorNameByKey.set(g.link_key, g.vendor_name);
  }

  const { roots, total, emptyRows } = rollUpTransactions(
    [...keyed, ...unkeyedRows],
    (keys) => r.resolveNames(keys, { vendorNameByKey }),
    { keepTop: r.keepTop, tailKey: r.tailKey, tailName: r.tailName, keyOf: r.keyOf },
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
    // ⚠ The transaction count now comes from the aggregate's item_counts, not
    // from the length of a list of rows — nothing reads the rows one by one.
    const txnCount = roots.reduce((a, x) => a + x.item_count, 0) + emptyRows;
    console.log(`${budget.data_source}: ${txnCount.toLocaleString()} txns -> ${roots.length} roots ` +
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
