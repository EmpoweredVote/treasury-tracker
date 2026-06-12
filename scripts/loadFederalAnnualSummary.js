#!/usr/bin/env node
/**
 * Federal Annual Summary Loader (Phase 44, Plan 02)
 *
 * OMB Historical Tables 1.1 (receipts/outlays/deficit, in millions) +
 * 8.1 (BEA categories, in BILLIONS — units read from each file by the extractor)
 * → treasury.federal_annual_summary, FY1962–FY2025 actuals only, dollars.
 *
 * Steps:
 *   1. Scrape the historical-tables landing page (browser UA required) for the
 *      current hist01z1*.xlsx / hist08z1*.xlsx URLs — editions move yearly.
 *      Only https://www.whitehouse.gov/ URLs accepted (T-44-04).
 *   2. Download both; run scripts/extractOMBHistorical.py (validations inside:
 *      per-year identity checks, BEA sum 0.5%, 1.1↔8.1 cross-check 0.1%).
 *   3. Upsert by fiscal_year with source metadata.
 *      source_url = the landing page (each row blends both files; exact file
 *      URLs are logged below and in 44-VERIFICATION.md).
 *
 * Anchors (halt on mismatch): FY2025 receipts 5,236,421M / outlays 7,011,105M /
 * deficit -1,774,684M; FY2024 outlays 6,735,261M.
 *
 * Usage: node scripts/loadFederalAnnualSummary.js [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const LANDING = 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const SOURCE_NAME = 'omb-historical-tables'; // treasury.source_registry key

const ANCHORS = {
  2025: { receipts: 5_236_421e6, outlays: 7_011_105e6, surplus_or_deficit: -1_774_684e6 },
  2024: { outlays: 6_735_261e6 },
};

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function findXlsxUrl(html, stem) {
  const re = new RegExp(`href="(https://www\\.whitehouse\\.gov/[^"]*${stem}[^"]*\\.xlsx)"`, 'i');
  const m = html.match(re);
  if (!m) throw new Error(`No ${stem} xlsx link found on landing page (T-44-04: whitehouse.gov only)`);
  return m[1];
}

async function main() {
  console.log(`Scraping: ${LANDING}`);
  const html = await fetchText(LANDING);
  const url11 = findXlsxUrl(html, 'hist01z1');
  const url81 = findXlsxUrl(html, 'hist08z1');
  console.log(`  Table 1.1: ${url11}`);
  console.log(`  Table 8.1: ${url81}`);

  const dir = path.join(tmpdir(), 'omb-historical');
  mkdirSync(dir, { recursive: true });
  const f11 = path.join(dir, 'hist01z1.xlsx');
  const f81 = path.join(dir, 'hist08z1.xlsx');
  await download(url11, f11);
  await download(url81, f81);
  console.log('  Downloaded both files.');

  const json = execFileSync('python', [path.join(__dirname, 'extractOMBHistorical.py'), f11, f81], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  const rows = JSON.parse(json);
  console.log(`  Extracted ${rows.length} fiscal years (${rows[0].fiscal_year}–${rows[rows.length - 1].fiscal_year}).`);

  // Anchor checks (T-44-03)
  for (const [year, fields] of Object.entries(ANCHORS)) {
    const row = rows.find(r => r.fiscal_year === Number(year));
    if (!row) throw new Error(`Anchor year ${year} missing`);
    for (const [field, expected] of Object.entries(fields)) {
      if (Math.abs(row[field] - expected) > 1) {
        throw new Error(`ANCHOR MISMATCH FY${year} ${field}: got ${row[field]}, expected ${expected} — halting`);
      }
    }
  }
  console.log('  Anchors verified (FY2025, FY2024).');

  if (rows.length !== 64) throw new Error(`Expected 64 rows, got ${rows.length}`);

  if (dryRun) {
    const fy25 = rows.find(r => r.fiscal_year === 2025);
    console.log('[dry-run] FY2025:', JSON.stringify(fy25));
    console.log('[dry-run] Would upsert 64 rows. No DB writes.');
    return;
  }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const today = new Date().toISOString().slice(0, 10);

  const payload = rows.map(r => ({
    ...r,
    source_name: SOURCE_NAME,
    source_url: LANDING,
    source_date: today,
  }));

  const { error } = await supabase.schema('treasury')
    .from('federal_annual_summary')
    .upsert(payload, { onConflict: 'fiscal_year' });
  if (error) { console.error('Upsert failed:', error.message); process.exit(1); }

  const { count } = await supabase.schema('treasury')
    .from('federal_annual_summary').select('id', { count: 'exact', head: true });
  console.log(`Loaded. federal_annual_summary now holds ${count} rows.`);
  if (count !== 64) { console.error(`Expected 64 rows, found ${count}`); process.exit(1); }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
