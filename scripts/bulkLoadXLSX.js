/**
 * ⚠ NO SHEBANG. tests/waSao.test.mjs forbids one on any module a test
 * imports, and tests/bulkLoadBatch.test.mjs imports buildBatch from here.
 * Always invoked as `node scripts/bulkLoadXLSX.js`, never as `./...`.
 */
/**
 * Bulk XLSX Loader for Treasury Tracker
 *
 * Downloads XLSX files from URLs stored in treasury.data_sources and
 * bulk-inserts into Supabase via the treasury_sync_transactions RPC.
 * Uses ExcelJS for parsing (NOT xlsx/SheetJS — CVE-2023-30533).
 *
 * Usage:
 *   node scripts/bulkLoadXLSX.js                          # Load all xlsx_download sources
 *   node scripts/bulkLoadXLSX.js --source "Plano FY2025"  # Load a specific source (substring match)
 *   node scripts/bulkLoadXLSX.js --list                   # List available XLSX sources
 *   node scripts/bulkLoadXLSX.js --dry-run                # Parse and preview without inserting
 *   node scripts/bulkLoadXLSX.js --force-reload           # Delete existing rows before inserting
 *
 * Env vars (from .env.local or exported):
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key (sb_secret_ or JWT format)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import { listAllSourcesResult } from './lib/listAllSources.mjs';
import { idOrNull, linkKey } from './lib/publisherIds.mjs';
import { isEnrolled } from './lib/transactionTreeSources.mjs';
// ⚠ Parsing and the dedup hash live in lib so a measurement can import THE SAME
// CODE. See scripts/lib/xlsxRows.mjs and scripts/measureXlsxDedupLoss.mjs.
import {
  parseCSV, parseXLSX, parseAmount, downloadXLSX, rowKeys, looksLikeXlsx, looksLikeHtml,
} from './lib/xlsxRows.mjs';
// ⚠⚠ The guard that stands between dedup:'occurrence' and money never spent.
import { judgeDoubledExportDays, describeDoubledDays } from './lib/doubledExportDays.mjs';
// ⚠⚠⚠ A publisher's own grand total is not a payment. See #335 follow-up.
import {
  findPublisherTotalRow, withoutTotalRow, assertTieToTotal, describeTotalRow,
} from './lib/publisherTotalRow.mjs';
// ⚠⚠⚠ Frisco FY2018/19 wrote the CHECK TOTAL on every GL line. Opt-in only.
import {
  collapseAllocationRows, describeAllocation, MIN_SHARE_TO_APPLY,
} from './lib/allocationRows.mjs';
import { rebuildBudget } from './rebuildTransactionTree.mjs';
// ── Config ──────────────────────────────────────────────────────────────────
/**
 * ⚠⚠⚠ LAZY, and the missing-key check moved in here with it.
 *
 * This block used to run at module scope — including process.exit(1) when no
 * key was set. Importing this module to test buildBatch would therefore have
 * KILLED THE TEST RUNNER outright on any machine without credentials, which
 * is exactly what CI is. A module that exports a function must not exit a
 * process merely by being imported.
 */
let _supabase = null;
function client() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(1);
  }
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key,
    );
  }
  return _supabase;
}

// ── Download helper ──────────────────────────────────────────────────────────

// ── Build compact transaction batch for RPC ───────────────────────────────────
export function buildBatch(rows, cm, keys) {
  const vendors = new Set();
  const txns = rows.map((r, idx) => {
    // ⚠⚠⚠ NO vendor_column means the publisher gives TT nothing usable to name
    // a payee with, and the honest answer is SILENCE — not a row attributed to
    // a vendor called "Unknown".
    //
    // Plano is why. Its PayeeName is truncated to a 5-character fixed width in
    // every row of every file: TT's largest Plano payee read "MO MI" and held
    // $483,527,652.16. Worse than a bad label, it MIS-AGGREGATES — "COLLI"
    // merges Collin County with Collin Creek — and a wrong aggregation with a
    // plausible name is the kind of number that gets quoted.
    const vn = cm.vendor_column ? (r[cm.vendor_column] || 'Unknown') : null;
    if (vn !== null) vendors.add(vn);

    // Date: normalize to ISO date string (YYYY-MM-DD)
    let dt = null;
    if (cm.date_column && r[cm.date_column]) {
      const raw = r[cm.date_column];
      if (raw instanceof Date) {
        dt = raw.toISOString().slice(0, 10);
      } else if (typeof raw === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}/.test(raw)) {
        const d = new Date(raw);
        dt = isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10);
      } else {
        dt = raw;
      }
    }

    return {
      a: parseAmount(r[cm.amount_column]),
      d: idOrNull(r[cm.description_column]),
      dt,
      pm: idOrNull(r[cm.payment_method_column]),
      inv: idOrNull(r[cm.invoice_number_column]),
      f: idOrNull(r[cm.fund_column]),
      ec: idOrNull(r[cm.expense_category_column]),
      dept: idOrNull(r[cm.department_column]),
      prog: idOrNull(r[cm.program_column]),
      vn,
      // ⚠⚠⚠ `.filter(Boolean)` DROPPED THE INTEGER ZERO. McKinney's department
      // column is numeric and code `0` is real — the `0000` account segment,
      // carrying $79,113,310 in FY2024 alone. Every dollar of it lost its key
      // here and surfaced to readers as `Unknown Department`. An identifier is
      // absent when it is null or blank, never when it is zero.
      lk: linkKey([r[cm.department_column], r[cm.fund_column], r[cm.expense_category_column]]),
      // ⚠ Key supplied by the caller, computed over the WHOLE file. Counting
      // occurrences inside this 500-row chunk would give two identical rows in
      // different chunks the same key and collapse them anyway.
      rid: keys[idx],
    };
  });
  return { vendors: [...vendors].map(n => ({ n })), transactions: txns };
}

// ── Sync a single data source ─────────────────────────────────────────────────
async function syncSource(ds, opts = {}) {
  const cm = ds.column_mapping;

  // ── Normalize schema fields: XLSX sources store URL in base_url and fiscal
  //    year as fiscal_years[0] (matching the treasury.data_sources schema).
  //    Use local vars so the rest of the function is consistent. ───────────────
  const fiscalYear = ds.fiscal_year ?? (Array.isArray(ds.fiscal_years) ? ds.fiscal_years[0] : ds.fiscal_years);
  const downloadUrl = ds.download_url ?? ds.base_url;

  // ── Fail-fast config validation (before any download attempt) ──────────────
  if (!fiscalYear) {
    console.error('Config error: data_sources row "' + ds.name + '" is missing fiscal_year / fiscal_years');
    process.exit(1);
  }
  if (!downloadUrl) {
    console.error('Config error: data_sources row "' + ds.name + '" is missing download_url / base_url');
    process.exit(1);
  }
  if (!cm) {
    console.error('Config error: data_sources row "' + ds.name + '" is missing column_mapping');
    process.exit(1);
  }

  console.log('\n' + ds.name + ' FY' + fiscalYear + ': downloading...');

  // ── force-reload: clear existing rows for this source + fiscal year ─────────
  // The treasury_sync_transactions RPC creates budgets keyed on
  // (municipality_id, fiscal_year, dataset_type). The budget rows do not store
  // data_source_id (the RPC sets it to null). We therefore find the matching
  // budget via municipality_id + fiscal_year + dataset_type, then delete
  // only its transactions — leaving other fiscal years of the same source untouched.
  if (opts.forceReload) {
    const { data: matchBudgets, error: findErr } = await client()
      .schema('treasury')
      .from('budgets')
      .select('id')
      .eq('municipality_id', ds.municipality_id)
      .eq('fiscal_year', fiscalYear)
      .eq('dataset_type', ds.dataset_type);
    if (findErr) {
      console.error('  force-reload budget lookup failed: ' + findErr.message);
      process.exit(1);
    }
    if (!matchBudgets || matchBudgets.length === 0) {
      console.log('  --force-reload: no existing budget found for FY' + fiscalYear + ' (nothing to clear)');
    } else {
      for (const budget of matchBudgets) {
        const { error: delErr } = await client()
          .schema('treasury')
          .from('transactions')
          .delete()
          .eq('budget_id', budget.id);
        if (delErr) {
          console.error('  force-reload delete failed for budget ' + budget.id + ': ' + delErr.message);
          process.exit(1);
        }
      }
      console.log('  --force-reload: cleared existing rows for FY' + fiscalYear);
    }
  }

  // ── Download + parse ────────────────────────────────────────────────────────
  const buffer = await downloadXLSX(downloadUrl);
  // ⚠⚠ Pick the parser by CONTENT, not by the URL's suffix. Plano's register
  // serves CSV from ReportExport.aspx?...&Detail=T — a query string with no
  // suffix — and the old `endsWith('.csv')` test would have handed that CSV to
  // the XLSX parser. Every XLSX is a zip, so it starts `PK`.
  if (looksLikeHtml(buffer)) {
    console.error('  Aborting: ' + downloadUrl + ' returned HTML, not a workbook or CSV.');
    console.error('  That is usually a WAF block page or an error page served as 200.');
    process.exit(1);
  }
  const isCsv = !looksLikeXlsx(buffer);
  const parsed = isCsv ? parseCSV(buffer) : await parseXLSX(buffer, cm);
  const { headers, blankSkipped, headerDupeSkipped } = parsed;
  let rows = parsed.rows;
  console.log('  Parsed ' + rows.length.toLocaleString() + ' data rows (' +
    blankSkipped + ' blank skipped, ' + headerDupeSkipped + ' header-dupe skipped)');
  console.log('  Headers: ' + headers.join(', '));

  // ── ⚠⚠⚠ The publisher's own grand total is NOT a payment ───────────────────
  //
  // Frisco's registers end with a row carrying no date, no vendor and the
  // description TOTAL. Loading it as a transaction published FY2018, FY2019 and
  // FY2022 at EXACTLY TWICE the truth — $2,523,034,629.69 of money nobody
  // spent — and no gate could see it, because a self-consistent file had simply
  // been counted twice.
  //
  // ⭐ Once the row is out it becomes an ORACLE: the remaining rows must sum to
  // it. That turns the thing that broke the figure into the thing that proves
  // it, which is the same bargain McKinney's Total row gave us in #334.
  const totalRow = findPublisherTotalRow(rows, {
    amountColumn: cm.amount_column,
    dateColumn: cm.date_column,
    vendorColumn: cm.vendor_column,
    descriptionColumn: cm.description_column,
  });
  if (totalRow.ambiguous) {
    console.error('  Aborting: cannot tell which row is the publisher\'s grand total in ' + ds.name + '.');
    for (const line of describeTotalRow(totalRow)) console.error('     ' + line);
    console.error('  Picking one would delete a real payment. Resolve by hand.');
    process.exit(1);
  }
  if (totalRow.found) {
    for (const line of describeTotalRow(totalRow)) console.log('  publisher grand total — ' + line);
    rows = withoutTotalRow(rows, totalRow);
    const tie = assertTieToTotal(rows, totalRow, cm.amount_column);
    if (!tie.ok) {
      console.error('  Aborting: the remaining rows do not sum to the publisher\'s own total.');
      console.error('     expected $' + tie.expected.toLocaleString(undefined, { minimumFractionDigits: 2 }) +
        '  got $' + tie.actual.toLocaleString(undefined, { minimumFractionDigits: 2 }) +
        '  difference $' + tie.difference.toLocaleString(undefined, { minimumFractionDigits: 2 }));
      process.exit(1);
    }
    console.log('  ✅ ' + rows.length.toLocaleString() + ' data rows tie to it exactly — excluded from the load');
  }

  // ── Parse error rate check (fail if > 5% of rows have bad amounts) ──────────
  let parseErrors = 0;
  for (const r of rows) {
    const a = parseAmount(r[cm.amount_column]);
    if (isNaN(a)) parseErrors++;
  }
  if (rows.length > 0 && parseErrors / rows.length > 0.05) {
    console.error('  Aborting: parse error rate ' +
      (parseErrors / rows.length * 100).toFixed(1) + '% exceeds 5% threshold (' +
      parseErrors + '/' + rows.length + ' rows)');
    process.exit(1);
  }

  // ── ⚠⚠⚠ Repeated-allocation collapse, opt-in per source ───────────────────
  //
  // Frisco FY2018/FY2019 repeat the FULL payment amount on every GL line. One
  // check to NTMWD appears 11 times at $4,359,026.75 — TT read $47,949,294.25
  // for a $4.36M payment, and both years published at ~3x the audited total.
  //
  // ⚠⚠ The share threshold is the real guard. Identical amounts on one day are
  // NOT always a repeated allocation: Frisco FY2026 pays FRISCO STADIUM LLC
  // twice monthly at the same amount, as an expenditure and the transfer
  // funding it, and collapsing there would delete $63,167,944.48 that really
  // moved. Broken years run 22-23% of rows; healthy ones 0.3%.
  if (cm.allocation_rows === 'repeat-payment-total') {
    const collapsed = collapseAllocationRows(rows, {
      dateColumn: cm.date_column,
      vendorColumn: cm.vendor_column,
      amountColumn: cm.amount_column,
      descriptionColumn: cm.description_column,
    });
    const v = collapsed.verdict;
    if (!v.supported) {
      console.error('  Aborting: cannot judge repeated allocations in ' + ds.name + ' — ' + v.reason);
      process.exit(1);
    }
    if (v.share < MIN_SHARE_TO_APPLY) {
      console.error('\n  ⛔ Aborting: ' + ds.name + ' does NOT have the repeated-allocation shape.');
      for (const line of describeAllocation(v)) console.error('     ' + line);
      console.error('\n  Only ' + (v.share * 100).toFixed(1) + '% of rows are in identical-amount groups; the' +
        '\n  policy needs at least ' + (MIN_SHARE_TO_APPLY * 100).toFixed(0) + '%. Frisco FY2018 and FY2019 run 22-23%; a healthy' +
        '\n  file runs 0.3%, and those few groups are usually REAL — an expenditure' +
        '\n  beside the interfund transfer funding it. Collapsing here would delete $' +
        v.moneyRemoved.toLocaleString(undefined, { minimumFractionDigits: 2 }) +
        '\n  that was actually moved. Remove allocation_rows from this source\'s column_mapping.');
      process.exit(1);
    }
    for (const line of describeAllocation(v)) console.log('  repeated allocations — ' + line);
    rows = collapsed.rows;
    console.log('  ✅ collapsed to ' + rows.length.toLocaleString() + ' payment row(s)');
  }

  // ── ⚠⚠⚠ Doubled-export guard, for occurrence-keyed sources only ────────────
  //
  // 'occurrence' KEEPS every copy of an identical row. That is the whole point
  // for a 132-line uniform-rental invoice, and it is catastrophic for a day the
  // publisher exported twice — every duplicate would be money never spent, and
  // this loader would faithfully insert all of it.
  //
  // ⚠⚠ THE PUBLISHER'S TOTAL ROW CANNOT CATCH IT. McKinney's register carries
  // its own Total, and that oracle is what proved the repair in #334 — but the
  // same report generates the data rows and the total, so a doubled export
  // doubles both and they still agree to the cent. Only the shape of the counts
  // can tell, so it is checked here, before anything is written.
  //
  // ⚠ Runs BEFORE the dry-run exit on purpose: a dry run is exactly when
  // someone is deciding whether a file is safe to load.
  if (cm.dedup === 'occurrence') {
    const verdict = judgeDoubledExportDays(rows, {
      dateColumn: cm.date_column,
      amountColumn: cm.amount_column,
    });
    if (!verdict.supported) {
      console.error('  Aborting: cannot check ' + ds.name + ' for doubled export days — ' + verdict.reason);
      console.error('  A source keyed by occurrence must be checkable. Fix column_mapping, or move it back to the default content dedup.');
      process.exit(1);
    }
    if (verdict.certified.length) {
      console.error('\n  ⛔ Aborting: ' + ds.name + ' contains ' + verdict.certified.length +
        ' day(s) the publisher appears to have EXPORTED TWICE.');
      for (const line of describeDoubledDays(verdict)) console.error('     ' + line);
      console.error('\n  On those days every distinct row appears an even number of times and' +
        '\n  (almost) none appears exactly once. An ordinary day is ~99% rows-that-occur-once.' +
        '\n  Because this source is keyed by occurrence, loading would ADD ' +
        verdict.rowsDoubled.toLocaleString() + ' row(s) worth $' +
        verdict.amountDoubled.toLocaleString(undefined, { minimumFractionDigits: 2 }) +
        '\n  that was never spent. The publisher\'s own Total row would NOT disagree.' +
        '\n\n  Re-publish from the source, or move this source back to the default content' +
        '\n  dedup, which discards the duplicates correctly. See scripts/lib/doubledExportDays.mjs.');
      process.exit(1);
    }
    console.log('  doubled-export check: clean across ' + verdict.days.length.toLocaleString() + ' publication date(s)');
  }

  // ── Dry-run: preview and exit ───────────────────────────────────────────────
  if (opts.dryRun) {
    console.log('\n  [dry-run] First 3 rows:');
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log('  Row ' + (i + 1) + ':', JSON.stringify(rows[i]).slice(0, 200));
    }
    console.log(ds.name + ' FY' + fiscalYear + ': ' +
      rows.length.toLocaleString() + ' inserted | ' +
      (blankSkipped + headerDupeSkipped).toLocaleString() + ' skipped | ' +
      parseErrors.toLocaleString() + ' errors');
    return;
  }

  // ── Batch RPC calls in chunks of 500 ───────────────────────────────────────
  const RPC_BATCH = 500;
  let totalInserted = 0;
  let totalSkipped = 0;

  // ⚠⚠ Keys for the WHOLE file, before chunking. See rowKeys() for why the
  // policy is per-source and why the default must stay 'content'.
  const allKeys = rowKeys(rows, cm.dedup);
  if (cm.dedup === 'occurrence') {
    const extra = allKeys.length - new Set(allKeys.slice(0, allKeys.length)).size;
    const repeats = allKeys.filter(k => k.includes('#')).length;
    console.log('  dedup policy: occurrence — ' + repeats.toLocaleString() +
      ' repeated row(s) kept that a content hash would have discarded' +
      (extra ? ' (⚠ ' + extra + ' key collisions remain)' : ''));
  }

  for (let i = 0; i < rows.length; i += RPC_BATCH) {
    const chunk = rows.slice(i, i + RPC_BATCH);
    const { vendors, transactions } = buildBatch(chunk, cm, allKeys.slice(i, i + RPC_BATCH));

    const { data, error } = await client().rpc('treasury_sync_transactions', {
      p_data_source_id: ds.id,
      p_fiscal_year: fiscalYear,
      p_vendors: vendors,
      p_transactions: transactions,
      p_row_count: chunk.length,
      p_triggered_by: 'bulk_load',
    });

    if (error) {
      console.error('  RPC error at batch ' + i + ': ' + error.message);
      continue;
    }

    // Detect RPC-level errors returned in the response body (e.g., constraint violations)
    if (data?.error) {
      console.error('  RPC returned error at batch ' + i + ': ' + data.error);
      process.exit(1);
    }

    totalInserted += data?.rows_inserted || 0;
    totalSkipped += data?.rows_skipped || 0;
    process.stdout.write('\r  loaded ' + (i + chunk.length) + '/' + rows.length);
  }
  console.log('');

  // ── Final summary — EXACT format required ───────────────────────────────────
  console.log(ds.name + ' FY' + fiscalYear + ': ' +
    totalInserted.toLocaleString() + ' inserted | ' +
    (totalSkipped + blankSkipped + headerDupeSkipped).toLocaleString() + ' skipped | ' +
    parseErrors.toLocaleString() + ' errors');

  // ── Rebuild the category tree over what we just wrote ───────────────────────
  //
  // ⚠⚠⚠ WITHOUT THIS, A RELOAD SILENTLY BREAKS THE PAGE. treasury_sync_transactions
  // writes transactions and recomputes budgets.total_budget; it does NOT touch
  // budget_categories. The trees over these transactions were built once by a
  // migration that was never committed, so --force-reload deletes and rewrites
  // every row underneath a tree nothing re-derives. The headline still ties and
  // the labels still look right — but a root can end up pointing at a key no
  // transaction carries, and its drill-down returns null. That is not
  // hypothetical: McKinney's $79.1M FY2024 root did exactly that on the live
  // site. See supabase/migrations/20261104170000_transaction_tree_status.sql.
  //
  // ⚠ Only ENROLLED sources are rebuilt (scripts/lib/transactionTreeSources.mjs).
  // Frisco, Plano and West Hollywood key their roots on vendor names, not on
  // link_key, and rebuilding one of those would mean inventing a naming rule —
  // the very thing that put fabricated department names on McKinney's money.
  if (isEnrolled(ds.name)) {
    const { data: budget, error: bErr } = await client().schema('treasury').from('budgets')
      .select('id, fiscal_year, data_source, total_budget')
      .eq('municipality_id', ds.municipality_id).eq('fiscal_year', fiscalYear)
      .eq('dataset_type', ds.dataset_type).maybeSingle();
    if (bErr) throw new Error('tree rebuild: budget lookup failed: ' + bErr.message);
    if (!budget) throw new Error('tree rebuild: no budget found for ' + ds.name + ' FY' + fiscalYear);
    const r = await rebuildBudget(budget, { quiet: true });
    console.log('  tree rebuilt from transactions: +' + r.inserts + ' ~' + r.updates + ' -' + r.deletes);
  }
}

// ── CLI entry point ───────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      list: { type: 'boolean', short: 'l' },
      'dry-run': { type: 'boolean' },
      'force-reload': { type: 'boolean' },
    },
    strict: false,
  });

  // Fetch all data sources
  const { data: sources, error } = await listAllSourcesResult(client());
  if (error) {
    console.error('Failed to list sources:', error.message);
    process.exit(1);
  }

  // Filter to XLSX download sources only
  const xlsxSources = (sources || []).filter(s => s.api_type === 'xlsx_download');

  if (values.list) {
    if (xlsxSources.length === 0) {
      console.log('No XLSX data sources configured. Use --list after adding xlsx_download rows to treasury.data_sources.');
    } else {
      console.log('\nAvailable XLSX data sources:\n');
      for (const s of xlsxSources) {
        const fy = s.fiscal_year ?? (Array.isArray(s.fiscal_years) ? s.fiscal_years[0] : s.fiscal_years) ?? 'not set';
        console.log('  ' + s.name + ' (' + s.dataset_type + ') — FY: ' + fy);
      }
    }
    return;
  }

  // Determine targets — filter by --source or use all XLSX sources
  let targets = xlsxSources;
  if (values.source) {
    targets = targets.filter(s => s.name.toLowerCase().includes(values.source.toLowerCase()));
  }

  if (targets.length === 0) {
    console.log('No matching XLSX sources found. Use --list to see available sources.');
    return;
  }

  console.log('\nLoading ' + targets.length + ' XLSX source(s)...');

  for (const src of targets) {
    // Fetch full config (column_mapping, fiscal_year, download_url, etc.)
    const { data: ds, error: cfgErr } = await client().rpc('treasury_get_data_source_config', {
      p_data_source_id: src.id,
    });
    if (cfgErr || !ds) {
      console.error('  Config not found for ' + src.name + (cfgErr ? ': ' + cfgErr.message : ''));
      continue;
    }

    await syncSource(ds, {
      dryRun: values['dry-run'],
      forceReload: values['force-reload'],
    });
  }

  console.log('\nDone.');
}

// ⚠⚠⚠ RUN ONLY AS A CLI, never on import. This module exports buildBatch so
// the vendor and link-key rules can be tested, and without this guard merely
// importing it would DOWNLOAD AND LOAD EVERY xlsx SOURCE.
//
// ⚠ pathToFileURL, not `file://${process.argv[1]}` — on Windows the naive form
// compares `file:///C:/...` against `file://C:\...`, never matches, and the
// script silently does nothing. That cost a session once already.
const { pathToFileURL } = await import('node:url');
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error('Fatal:', err); process.exit(1); });
}
