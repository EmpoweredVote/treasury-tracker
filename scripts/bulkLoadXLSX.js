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
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    console.error('Download failed: ' + url + ' — HTTP ' + resp.status);
    process.exit(1);
  }
  // Warn if content-type looks unexpected, but do not fail
  const ct = resp.headers.get('content-type') || '';
  if (!ct.includes('spreadsheet') && !ct.includes('excel') && !ct.includes('octet-stream')) {
    console.warn('  Warning: unexpected content-type "' + ct + '" — proceeding anyway');
  }
  return Buffer.from(await resp.arrayBuffer());
}

// ── Parse helper ─────────────────────────────────────────────────────────────
async function parseXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  let headers = [];
  const rows = [];
  let blankSkipped = 0;
  let headerDupeSkipped = 0;

  worksheet.eachRow((row, rowNumber) => {
    // CRITICAL: ExcelJS row.values[0] is always null (1-indexed) — slice(1)
    const values = row.values.slice(1);

    if (rowNumber === 1) {
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
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      let val = values[i] !== undefined ? values[i] : null;

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
    }

    // Skip header-duplicate rows (row where column values match the header names)
    if (headers.some(h => String(obj[h] ?? '').toLowerCase() === h)) {
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
  // stub — implemented in Task 3
}

// ── CLI entry point ───────────────────────────────────────────────────────────
async function main() {
  // stub — implemented in Task 3
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
