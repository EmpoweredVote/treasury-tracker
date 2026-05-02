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
  // stub — implemented in Task 2
}

// ── Parse helper ─────────────────────────────────────────────────────────────
async function parseXLSX(buffer) {
  // stub — implemented in Task 2
}

// ── SHA-256 row hash ─────────────────────────────────────────────────────────
function hashRow(obj) {
  // stub — implemented in Task 2
}

// ── Amount parser ────────────────────────────────────────────────────────────
function parseAmount(v) {
  // stub — implemented in Task 2
}

// ── Build compact transaction batch for RPC ───────────────────────────────────
function buildBatch(rows, cm) {
  // stub — implemented in Task 2
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
