#!/usr/bin/env node
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
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Download helper ──────────────────────────────────────────────────────────
async function downloadXLSX(url) {
  // Local file support for manual exports (e.g., Plano)
  if (url.startsWith('file://')) {
    const filePath = decodeURIComponent(url.replace(/^file:\/\/\/?/, '').replace(/\//g, path.sep || '\\'));
    console.log('  Reading local file: ' + filePath);
    return readFileSync(filePath);
  }
  if (!url.startsWith('http')) {
    console.log('  Reading local file: ' + url);
    return readFileSync(url);
  }
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    console.error('Download failed: ' + url + ' — HTTP ' + resp.status);
    process.exit(1);
  }
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('spreadsheet') && !contentType.includes('excel') && !contentType.includes('octet-stream')) {
    console.warn('  Warning: unexpected content-type "' + contentType + '" — may not be XLSX');
  }
  return Buffer.from(await resp.arrayBuffer());
}

// ── Parse helper ─────────────────────────────────────────────────────────────
async function parseXLSX(buffer, cm = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  const headerRow = cm.header_row || 1;

  let headers = [];
  const rows = [];
  let blankSkipped = 0;
  let headerDupeSkipped = 0;

  worksheet.eachRow((row, rowNumber) => {
    // CRITICAL: ExcelJS row.values[0] is always null (1-indexed) — slice(1)
    const values = row.values.slice(1);

    if (rowNumber < headerRow) return; // skip title rows before header row

    if (rowNumber === headerRow) {
      // Normalize header row
      headers = values.map(v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_'));
      return;
    }

    // Skip blank rows
    if (values.every(v => v == null || v === '')) {
      blankSkipped++;
      return;
    }

    // Build row object, convert special ExcelJS cell types
    const obj = {};
    headers.forEach((h, i) => {
      let val = values[i] ?? null;

      // Convert ExcelJS Date objects to ISO date string
      if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      }
      // Flatten rich-text cell objects to plain string
      else if (val && typeof val === 'object' && val.richText) {
        val = val.richText.map(t => t.text).join('');
      }
      // Flatten hyperlink objects to their text/value
      else if (val && typeof val === 'object' && val.text !== undefined) {
        val = val.text;
      }

      obj[h] = val;
    });

    // Skip header-duplicate rows (row where column values match the header names)
    if (headers.some(h => h && String(obj[h] ?? '').toLowerCase() === h)) {
      headerDupeSkipped++;
      return;
    }

    rows.push(obj);
  });

  return { headers, rows, blankSkipped, headerDupeSkipped };
}

// ── SHA-256 row hash ─────────────────────────────────────────────────────────
function hashRow(obj) {
  // Sort keys BEFORE JSON.stringify to ensure deterministic hash across runs
  const sorted = Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = obj[k] instanceof Date ? obj[k].toISOString() : obj[k];
    return acc;
  }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ── Amount parser ────────────────────────────────────────────────────────────
function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  // Strip $, commas; convert parenthetical negatives (123) → -123
  return parseFloat(String(v).replace(/[$,]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Build compact transaction batch for RPC ───────────────────────────────────
function buildBatch(rows, cm) {
  const vendors = new Set();
  const txns = rows.map(r => {
    const vn = r[cm.vendor_column] || 'Unknown';
    vendors.add(vn);

    // Date: convert Date objects to ISO string, or use raw value
    let dt = null;
    if (cm.date_column && r[cm.date_column]) {
      const raw = r[cm.date_column];
      dt = raw instanceof Date ? raw.toISOString() : raw;
    }

    return {
      a: parseAmount(r[cm.amount_column]),
      d: r[cm.description_column] || null,
      dt,
      pm: r[cm.payment_method_column] || null,
      inv: r[cm.invoice_number_column] || null,
      f: r[cm.fund_column] || null,
      ec: r[cm.expense_category_column] || null,
      dept: r[cm.department_column] || null,
      prog: r[cm.program_column] || null,
      vn,
      lk: [r[cm.department_column], r[cm.fund_column], r[cm.expense_category_column]]
        .filter(Boolean).join('|') || null,
      rid: hashRow(r), // SHA-256 of full row — deterministic dedup key
    };
  });
  return { vendors: [...vendors].map(n => ({ n })), transactions: txns };
}

// ── Sync a single data source ─────────────────────────────────────────────────
async function syncSource(ds, opts = {}) {
  const cm = ds.column_mapping;

  // ── Fail-fast config validation (before any download attempt) ──────────────
  if (!ds.fiscal_year) {
    console.error('Config error: data_sources row "' + ds.name + '" is missing fiscal_year');
    process.exit(1);
  }
  if (!ds.download_url) {
    console.error('Config error: data_sources row "' + ds.name + '" is missing download_url');
    process.exit(1);
  }
  if (!cm) {
    console.error('Config error: data_sources row "' + ds.name + '" is missing column_mapping');
    process.exit(1);
  }

  console.log('\n' + ds.name + ' FY' + ds.fiscal_year + ': downloading...');

  // ── force-reload: clear existing rows for this source + fiscal year ─────────
  if (opts.forceReload) {
    const { error: delErr } = await supabase
      .schema('treasury')
      .from('transactions')
      .delete()
      .eq('data_source_id', ds.id)
      .eq('fiscal_year', ds.fiscal_year);
    if (delErr) {
      console.error('  force-reload delete failed: ' + delErr.message);
      process.exit(1);
    }
    console.log('  --force-reload: cleared existing rows for FY' + ds.fiscal_year);
  }

  // ── Download + parse ────────────────────────────────────────────────────────
  const buffer = await downloadXLSX(ds.download_url);
  const { headers, rows, blankSkipped, headerDupeSkipped } = await parseXLSX(buffer, cm);
  console.log('  Parsed ' + rows.length.toLocaleString() + ' data rows (' +
    blankSkipped + ' blank skipped, ' + headerDupeSkipped + ' header-dupe skipped)');
  console.log('  Headers: ' + headers.join(', '));

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

  // ── Dry-run: preview and exit ───────────────────────────────────────────────
  if (opts.dryRun) {
    console.log('\n  [dry-run] First 3 rows:');
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log('  Row ' + (i + 1) + ':', JSON.stringify(rows[i]).slice(0, 200));
    }
    console.log(ds.name + ' FY' + ds.fiscal_year + ': ' +
      rows.length.toLocaleString() + ' inserted | ' +
      (blankSkipped + headerDupeSkipped).toLocaleString() + ' skipped | ' +
      parseErrors.toLocaleString() + ' errors');
    return;
  }

  // ── Batch RPC calls in chunks of 500 ───────────────────────────────────────
  const RPC_BATCH = 500;
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < rows.length; i += RPC_BATCH) {
    const chunk = rows.slice(i, i + RPC_BATCH);
    const { vendors, transactions } = buildBatch(chunk, cm);

    const { data, error } = await supabase.rpc('treasury_sync_transactions', {
      p_data_source_id: ds.id,
      p_fiscal_year: ds.fiscal_year,
      p_vendors: vendors,
      p_transactions: transactions,
      p_row_count: chunk.length,
      p_triggered_by: 'bulk_xlsx_load',
    });

    if (error) {
      console.error('  RPC error at batch ' + i + ': ' + error.message);
      continue;
    }

    totalInserted += data?.rows_inserted || 0;
    totalSkipped += data?.rows_skipped || 0;
    process.stdout.write('\r  loaded ' + (i + chunk.length) + '/' + rows.length);
  }
  console.log('');

  // ── Final summary — EXACT format required ───────────────────────────────────
  console.log(ds.name + ' FY' + ds.fiscal_year + ': ' +
    totalInserted.toLocaleString() + ' inserted | ' +
    (totalSkipped + blankSkipped + headerDupeSkipped).toLocaleString() + ' skipped | ' +
    parseErrors.toLocaleString() + ' errors');
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
  const { data: sources, error } = await supabase.rpc('treasury_list_source_ids');
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
        console.log('  ' + s.name + ' (' + s.dataset_type + ') — FY: ' + (s.fiscal_year || 'not set'));
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
    const { data: ds, error: cfgErr } = await supabase.rpc('treasury_get_data_source_config', {
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

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
