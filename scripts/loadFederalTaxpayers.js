#!/usr/bin/env node
/**
 * Federal Taxpayer Denominator Loader (Phase 45, Plan 03)
 *
 * Loads the per-taxpayer denominator (VIZ-05) from the IRS Data Book
 * Table 1-2 "Number of Returns and Other Forms Filed" xlsx:
 * the "Individual, total" row, latest fiscal-year column.
 * → federal_context_metrics.tax_returns_filed
 *
 * Verified 2026-06-12: https://www.irs.gov/pub/irs-soi/25db-1-02-nr.xlsx
 * row "Individual, total [3]" col 2025 = 162,754,810. irs.gov does NOT
 * bot-block (unlike CBO/GAO). Sanity band 100M–200M (T-45-03).
 *
 * Usage: node scripts/loadFederalTaxpayers.js [--dry-run]
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

const PAGE_URL = 'https://www.irs.gov/statistics/returns-filed-taxes-collected-and-refunds-issued';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const BAND = [100_000_000, 200_000_000];

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

const PY = `
import sys, re, warnings
warnings.filterwarnings("ignore")
import openpyxl
ws = openpyxl.load_workbook(sys.argv[1]).active
rows = list(ws.iter_rows(values_only=True))
header = None
for r in rows[:8]:
    years = [c for c in r if re.fullmatch(r"\\d{4}", str(c or ""))]
    if years:
        header = r
        break
if not header: sys.exit("no year header row")
year_cols = [(i, int(c)) for i, c in enumerate(header) if re.fullmatch(r"\\d{4}", str(c or ""))]
col, year = max(year_cols, key=lambda t: t[1])
for r in rows:
    label = str(r[0] or "")
    if label.startswith("Individual, total"):
        print(f"{year},{int(r[col])}")
        sys.exit(0)
sys.exit("'Individual, total' row not found")
`;

async function main() {
  // Scrape the page for the current Table 1-2 xlsx (editions advance yearly: 25db-1-02-nr → 26db-…)
  const pageRes = await fetch(PAGE_URL, { headers: { 'User-Agent': UA } });
  if (!pageRes.ok) throw new Error(`IRS page HTTP ${pageRes.status}`);
  const html = await pageRes.text();
  const m = html.match(/href="(\/pub\/irs-soi\/\d{2}db-1-02-nr\.xlsx)"/i);
  if (!m) throw new Error('Table 1-2 xlsx link not found on IRS page — layout changed?');
  const xlsxUrl = `https://www.irs.gov${m[1]}`;
  console.log(`Fetching: ${xlsxUrl}`);

  const dir = path.join(tmpdir(), 'irs-databook');
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'table1-2.xlsx');
  const res = await fetch(xlsxUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`xlsx HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));

  const out = execFileSync('python', ['-c', PY, dest], { encoding: 'utf8' }).trim();
  const [yearStr, countStr] = out.split(',');
  const year = Number(yearStr);
  const count = Number(countStr);
  console.log(`  Individual returns filed, IRS FY${year}: ${count.toLocaleString()}`);
  if (!Number.isInteger(count) || count < BAND[0] || count > BAND[1]) {
    throw new Error(`Count ${count} outside sanity band — halting (T-45-03)`);
  }

  if (dryRun) { console.log('[dry-run] No DB writes.'); return; }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await supabase.schema('treasury').from('federal_context_metrics').upsert({
    metric_key: 'tax_returns_filed',
    value: count,
    as_of_date: `${year}-09-30`,
    label: `Individual income tax returns filed, IRS fiscal year ${year} (Data Book Table 1-2, "Individual, total")`,
    source_name: 'irs-data-book',
    source_url: xlsxUrl,
    source_date: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'metric_key' });
  if (error) { console.error('Upsert failed:', error.message); process.exit(1); }
  console.log('Metric tax_returns_filed loaded.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
