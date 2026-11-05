/**
 * Bulk Transaction Loader for Treasury Tracker
 *
 * Downloads data from Socrata APIs and bulk-inserts into Supabase via the
 * treasury_sync_transactions RPC. Much faster than paginated Edge Function
 * calls for large/historical datasets.
 *
 * ⚠ NO SHEBANG. A module a test imports must not start with one — Vite's
 * shebang strip is broken and takes the whole suite down. The guard in
 * tests/waSao.test.mjs named this exact file as the next casualty, and was
 * right the moment a test first imported it.
 *
 * Usage:
 *   node scripts/bulkLoadTransactions.js                    # Load all configured sources
 *   node scripts/bulkLoadTransactions.js --source "LA City Checkbook" --fy 2025
 *   node scripts/bulkLoadTransactions.js --source "LA City Checkbook" --fy 2024 --fy 2025
 *   node scripts/bulkLoadTransactions.js --source "..." --force-reload
 *
 * ⚠⚠ --force-reload DELETES the year's rows before loading. It is for a
 * change of `source_row_id` key, where the stored rows can no longer conflict
 * with the incoming ones. A routine refresh must NOT use it.
 *
 * Env vars (from .env or exported):
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key (sb_secret_ or JWT format)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { listAllSourcesResult } from './lib/listAllSources.mjs';
import {
  assertRowIdIsUnique, isSystemRowId, orderFor, selectFor,
} from './lib/socrataRowId.mjs';
// ── Config ──────────────────────────────────────────────────────────────
/**
 * ⚠⚠ LAZY, AND NO process.exit AT MODULE SCOPE.
 *
 * This file used to call `process.exit(1)` on import when no key was set,
 * which KILLS the test runner, and `createClient` at module scope throws
 * without one. Either makes the module impossible to import in CI, where
 * there are deliberately no credentials — so none of the logic below could be
 * tested at all. Same fix as the one #340 applied to bulkLoadXLSX.js.
 */
let _supabase = null;
function db() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY env var');
  _supabase = createClient(url, key);
  return _supabase;
}

// ── Socrata CSV/JSON fetcher ────────────────────────────────────────────
async function socrataAggregate(baseUrl, datasetId, select, where) {
  const params = new URLSearchParams({ $select: select });
  if (where) params.set('$where', where);
  const url = `${baseUrl}/resource/${datasetId}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const row = data[0] || {};
  return parseInt(Object.values(row)[0] ?? '0', 10);
}

async function fetchSocrataCount(baseUrl, datasetId, where) {
  return await socrataAggregate(baseUrl, datasetId, 'count(*)', where);
}

/**
 * ⚠⚠ A LONG PULL WILL BE INTERRUPTED — PLAN FOR IT, DO NOT HOPE.
 *
 * LA City FY2025 is 749,295 rows over 150 requests. The first attempt died at
 * row 65,000 with `ECONNRESET` and the whole run exited 1, leaving the year
 * part-loaded and live. The publisher is not at fault and neither is the
 * query; a connection simply does not survive a quarter of an hour.
 *
 * ⚠ Retries are safe here ONLY because `source_row_id` is now a real row id:
 * re-fetching a page that already landed re-keys to the same `:id` and the
 * ON CONFLICT clause absorbs it. Under the old batch-number key a retry would
 * have silently dropped rows instead.
 */
export async function withRetry(label, fn, attempts = 5) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      const waitMs = 1000 * 2 ** (i - 1); // 1s, 2s, 4s, 8s
      console.log(`  ⚠ ${label} failed (${err.message}); retry ${i}/${attempts - 1} in ${waitMs / 1000}s`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastErr?.message}`);
}

async function fetchSocrataPage(baseUrl, datasetId, offset, limit, where, order, select) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
  });
  // ⚠ An empty $where is not the same as none: Socrata rejects it.
  if (where) params.set('$where', where);
  // ⚠⚠ System fields such as `:id` are ONLY returned when asked for.
  if (select) params.set('$select', select);
  if (order) params.set('$order', order);
  const url = `${baseUrl}/resource/${datasetId}.json?${params}`;
  return await withRetry(`fetch offset ${offset}`, async () => {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    return await resp.json();
  });
}

// ── Amount parser ───────────────────────────────────────────────────────
function amt(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Build compact transaction batch for RPC ─────────────────────────────
export function buildBatch(rows, cm) {
  const vendors = new Set();
  const ridCol = cm.source_row_id_column; // e.g. "transaction_id" for LA, "demand" for WeHo
  const txns = rows.map(r => {
    const vn = r[cm.vendor_column] || 'Unknown';
    vendors.add(vn);
    return {
      a: amt(r[cm.amount_column]), d: r[cm.description_column] || null,
      dt: r[cm.date_column] || null, pm: r[cm.payment_method_column] || null,
      inv: r[cm.invoice_number_column] || null, f: r[cm.fund_column] || null,
      ec: r[cm.expense_category_column] || null, dept: r[cm.department_column] || null,
      prog: r[cm.program_column] || null, vn,
      lk: [r[cm.department_column], r[cm.fund_column], r[cm.expense_category_column]]
        .filter(Boolean).join('|') || null,
      rid: ridCol ? r[ridCol] || null : null, // source unique row ID for dedup
    };
  });
  return { vendors: [...vendors].map(n => ({ n })), transactions: txns };
}

/**
 * Delete a budget's transactions so the year can be rebuilt from scratch.
 *
 * ⚠⚠⚠ ONLY CORRECT WHEN THE KEY ITSELF CHANGED. `source_row_id` moved from a
 * publisher column to Socrata's `:id`, so the stored rows can never conflict
 * with the incoming ones: without this they would survive as unreachable
 * duplicates and the recomputed total would count both sets.
 *
 * ⚠ A plain re-sync does NOT need this and must not use it. Dedup on a sound
 * key already makes a repeat run a no-op.
 */
async function deleteBudgetRows(ds, fiscalYear) {
  /**
   * ⚠⚠⚠ RESOLVE THE BUDGET THE WAY THE RPC DOES, OR CLEAR THE WRONG ONE.
   * `treasury_sync_transactions` finds its target with
   *     municipality_id = v_ds.municipality_id
   *       AND fiscal_year = p_fiscal_year
   *       AND dataset_type = v_ds.dataset_type
   * and NOT by data_source at all.
   *
   * ⚠ `budgets.data_source_id` is NOT usable here: it is a DANGLING
   * reference. The FY2020-21 budget points at a6b0a958-… which no longer
   * exists in treasury.data_sources. Matching on it silently found nothing,
   * left 20 stale rows in place, and double-counted $251,952.50 into an
   * otherwise correct $160,686,729.33 year. Caught by comparing the reloaded
   * total against the publisher's own sum.
   */
  const { data: budgets, error: bErr } = await db().schema('treasury')
    .from('budgets').select('id, fiscal_year, data_source')
    .eq('municipality_id', ds.municipality_id)
    .eq('dataset_type', ds.dataset_type)
    .eq('fiscal_year', fiscalYear);
  if (bErr) throw new Error(`budget lookup failed: ${bErr.message}`);
  if (!budgets?.length) {
    console.log(`  ℹ️  no existing budget for FY${fiscalYear} — nothing to clear`);
    return 0;
  }
  let deleted = 0;
  for (const b of budgets) {
    const { count, error } = await db().schema('treasury')
      .from('transactions').delete({ count: 'exact' }).eq('budget_id', b.id);
    if (error) throw new Error(`delete failed for budget ${b.id}: ${error.message}`);
    deleted += count ?? 0;
  }
  console.log(`  🗑️  cleared ${deleted.toLocaleString()} stale row(s) from FY${fiscalYear}`);
  return deleted;
}

// ── Main sync logic ─────────────────────────────────────────────────────
async function syncSource(ds, fiscalYear, { forceReload = false } = {}) {
  const cm = ds.column_mapping;
  /**
   * ⚠⚠ `skip_fy_filter` means the dataset HAS NO fiscal-year column. This
   * loader used to ignore the flag and send `$where=fiscal_year='2019'`
   * anyway, which every West Hollywood dataset answers with
   * `HTTP 400 no-such-column: fiscal_year` — so the committed loader could not
   * load them at all, and only the edge function (which does honour it) ever
   * did. Measured 2026-11-05.
   */
  const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
  const fyCol = cm.fiscal_year_column || 'fiscal_year';
  const where = skipFy ? '' : `${fyCol}='${fiscalYear}'`;

  /**
   * ⚠⚠⚠ Prove the declared row id really is one BEFORE inserting anything.
   * See scripts/lib/socrataRowId.mjs: a batch number used as a row id is how
   * West Hollywood came to hold 143 of its 134,643 rows.
   */
  const ridCol = cm.source_row_id_column;
  if (ridCol && !isSystemRowId(ridCol)) {
    assertRowIdIsUnique(
      ds.name, ridCol,
      await socrataAggregate(ds.base_url, ds.dataset_id, 'count(*)', where),
      await socrataAggregate(ds.base_url, ds.dataset_id, `count(distinct ${ridCol})`, where),
    );
  }

  // Get total count
  const totalCount = await fetchSocrataCount(ds.base_url, ds.dataset_id, where);
  console.log(`\n📊 ${ds.name} FY${fiscalYear}: ${totalCount.toLocaleString()} total rows`);

  // ⚠ Clear only AFTER the publisher has answered. Deleting first and then
  // failing to fetch would leave the year empty on the live site.
  if (forceReload && totalCount > 0) await deleteBudgetRows(ds, fiscalYear);

  if (totalCount === 0) {
    console.log('  ⏭️  No data for this fiscal year');
    return { rows_fetched: 0, rows_inserted: 0, status: 'empty' };
  }

  const PAGE_SIZE = 5000;
  const RPC_BATCH = 5000; // Send to RPC in 5K chunks
  let offset = 0;
  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  while (offset < totalCount) {
    // Fetch a page
    const rows = await fetchSocrataPage(
      ds.base_url, ds.dataset_id, offset, PAGE_SIZE, where,
      // ⚠⚠ Page by a TOTAL order (`:id`), never by the date column. See
      // socrataRowId.mjs — WeHo's check_date is TEXT in MM-DD-YYYY and does
      // not even sort chronologically, and paging a non-total order silently
      // skips and repeats rows.
      orderFor(ridCol), selectFor(ridCol),
    );
    totalFetched += rows.length;

    if (rows.length === 0) break;

    // Build compact batch and send to RPC
    const { vendors, transactions } = buildBatch(rows, cm);

    /**
     * ⚠⚠⚠ A FAILED PAGE USED TO BE SWALLOWED. The old code logged the RPC
     * error and carried on to the next offset — 5,000 rows gone, and the run
     * still printed "✅ Done" and exited 0. That is the same silent-loss
     * shape as the defect this whole change exists to fix, so it now retries
     * and then FAILS the run.
     *
     * ⚠ Retrying is safe because `:id` makes a repeated page a no-op: the
     * rows that already landed conflict and are skipped.
     */
    const data = await withRetry(`RPC at offset ${offset}`, async () => {
      const { data: d, error } = await db().rpc('treasury_sync_transactions', {
        p_data_source_id: ds.id,
        p_fiscal_year: fiscalYear,
        p_vendors: vendors,
        p_transactions: transactions,
        p_row_count: rows.length,
        p_triggered_by: 'bulk_load',
      });
      if (error) throw new Error(error.message);
      // The RPC reports its own failures in the payload rather than throwing.
      if (d?.error) throw new Error(d.error);
      return d;
    });
    totalInserted += data?.rows_inserted || 0;
    totalSkipped += data?.rows_skipped || 0;

    offset += rows.length;
    const pct = Math.round((offset / totalCount) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(totalFetched / (elapsed / 60));
    process.stdout.write(`\r  📥 ${offset.toLocaleString()}/${totalCount.toLocaleString()} (${pct}%) | +${totalInserted.toLocaleString()} new, ${totalSkipped.toLocaleString()} skipped | ${elapsed}s | ${rate.toLocaleString()}/min`);

    if (rows.length < PAGE_SIZE) break;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✅ Done in ${elapsed}s: ${totalFetched.toLocaleString()} fetched, ${totalInserted.toLocaleString()} inserted, ${totalSkipped.toLocaleString()} skipped`);

  return { rows_fetched: totalFetched, rows_inserted: totalInserted, rows_skipped: totalSkipped, duration_s: elapsed };
}

// ── CLI ─────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      fy: { type: 'string', short: 'y', multiple: true },
      'list': { type: 'boolean', short: 'l' },
      'all-types': { type: 'boolean' }, // Include salary/budget too, not just transactions
      'force-reload': { type: 'boolean' }, // Delete the year's rows first — see deleteBudgetRows
    },
    strict: false,
  });

  // Get all data sources
  const { data: sources, error } = await listAllSourcesResult(db());
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  const socraSources = sources.filter(s => s.api_type === 'socrata');

  if (values.list) {
    console.log('\n📋 Available Socrata data sources:\n');
    for (const s of socraSources) {
      console.log(`  ${s.name} (${s.dataset_type}) — FYs: ${s.fiscal_years?.join(', ') || 'current'}`);
    }
    return;
  }

  // Filter to target sources
  let targets = socraSources;
  if (values.source) {
    targets = targets.filter(s => s.name.toLowerCase().includes(values.source.toLowerCase()));
  }
  if (!values['all-types']) {
    // Default to just transaction sources (the big ones that benefit from bulk load)
    targets = targets.filter(s => s.dataset_type === 'transactions');
  }

  if (targets.length === 0) {
    /**
     * ⚠⚠ LOADING NOTHING IS NOT SUCCESS. This printed a note and exited 0, so
     * a re-run of LA City FY2025 against a DISABLED source reported success
     * while leaving the year part-loaded and live. `listAllSources` filters
     * `is_enabled = true` on purpose, so that is the usual reason a name that
     * plainly exists does not match.
     */
    throw new Error(
      `No enabled source matched${values.source ? ` ${JSON.stringify(values.source)}` : ''}. `
      + 'Note that disabled sources are not listed — check is_enabled before assuming the '
      + 'name is wrong. Use --list to see what is available.',
    );
  }

  console.log(`\n🚀 Bulk loading ${targets.length} source(s)...\n`);

  for (const src of targets) {
    // Get full config
    const { data: ds } = await db().rpc('treasury_get_data_source_config', { p_data_source_id: src.id });
    if (!ds) { console.error(`  ❌ Config not found for ${src.name}`); continue; }

    // Determine fiscal years
    const fiscalYears = values.fy
      ? values.fy.map(Number)
      : (ds.fiscal_years || [new Date().getFullYear()]);

    for (const fy of fiscalYears) {
      await syncSource(ds, fy, { forceReload: values['force-reload'] === true });
    }
  }

  console.log('\n🎉 Bulk load complete!\n');
}

/**
 * ⚠⚠ ENTRY GUARD. Without it, importing this module RUNS THE LOADER — see
 * tests/bulkLoadBatch.test.mjs for the time that actually happened.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error('Fatal:', err.message || err); process.exit(1); });
}
