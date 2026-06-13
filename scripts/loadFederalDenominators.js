#!/usr/bin/env node
/**
 * Federal per-year per-capita denominators loader (Phase 50 per-capita fix).
 *
 * The per-person / per-taxpayer scale toggle was dividing EVERY fiscal year by the
 * current (2024/2025) population and returns count — wrong for historical years now
 * that Phase 50 made them selectable. This loads per-FISCAL-YEAR denominators:
 *
 *   population_fy{N}          FY1976–FY2025  — US resident population (incl. armed
 *                             forces overseas), July of FY N, U.S. Census Bureau /
 *                             BEA via FRED series POPTHM (free, no key).
 *   tax_returns_filed_fy{N}   FY2005–FY2023  — individual income-tax returns filed,
 *                             IRS SOI Historical Table 21b. Plus FY2025 carried from
 *                             the existing `tax_returns_filed` metric so the current
 *                             year keeps per-taxpayer. Pre-2005 + FY2024 have no clean
 *                             free source → per-taxpayer is disabled for those years
 *                             (the frontend hides the toggle; never estimated).
 *
 * $0: free sources, no LLM. Idempotent (upsert by metric_key). Stored in
 * treasury.federal_context_metrics; the frontend reads them via the federal context.
 *
 * Usage: node scripts/loadFederalDenominators.js [--dry-run]
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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const FRED_POP_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=POPTHM';
const FRED_POP_PAGE = 'https://fred.stlouisfed.org/series/POPTHM';
const IRS_HISTAB21B = 'https://www.irs.gov/pub/irs-soi/histab21b.xlsx';
const IRS_PAGE = 'https://www.irs.gov/statistics/soi-tax-stats-historical-data-tables';
const POP_SOURCE_NAME = 'census-bureau'; // descriptive (metrics.source_name is free text)
const IRS_SOURCE_NAME = 'irs-soi';

const FY_MIN = 1976;
const FY_MAX = 2025;

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

// ── Population: FRED POPTHM (thousands, monthly) → July value per fiscal year ──
async function loadPopulation() {
  const csv = await fetchText(FRED_POP_CSV);
  const byDate = new Map();
  for (const line of csv.split('\n').slice(1)) {
    const [date, val] = line.split(',');
    if (date && val && val.trim() !== '.') byDate.set(date.trim(), Number(val) * 1000);
  }
  const out = {};
  for (let fy = FY_MIN; fy <= FY_MAX; fy++) {
    // July of the fiscal year (Census midyear convention; July 1, year N is within FY N).
    const v = byDate.get(`${fy}-07-01`);
    if (v == null || !Number.isFinite(v)) throw new Error(`POPTHM missing ${fy}-07-01`);
    out[fy] = Math.round(v);
  }
  return out;
}

// ── Returns: IRS histab21b "Individual Income Tax, Total" per fiscal year ──────
async function loadReturns() {
  const dir = path.join(tmpdir(), 'irs-soi');
  mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'histab21b.xlsx');
  await download(IRS_HISTAB21B, f);
  const json = execFileSync('python', [path.join(__dirname, 'extractIRSReturns.py'), f],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(json).returns_by_fy; // { "2005": 132854063, ... }
}

async function main() {
  const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  if (!supabase && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

  console.log('Fetching FRED POPTHM + IRS histab21b...');
  const [pop, returns] = await Promise.all([loadPopulation(), loadReturns()]);
  console.log(`Population: FY${FY_MIN}=${pop[FY_MIN].toLocaleString()} ... FY${FY_MAX}=${pop[FY_MAX].toLocaleString()}`);
  const ry = Object.keys(returns).map(Number).sort((a, b) => a - b);
  console.log(`Returns: FY${ry[0]}=${returns[ry[0]].toLocaleString()} ... FY${ry[ry.length - 1]}=${returns[ry[ry.length - 1]].toLocaleString()}`);

  // Carry the existing (current-year) tax_returns_filed so FY2025 keeps per-taxpayer.
  let currentReturns = null;
  if (supabase) {
    const { data } = await supabase.schema('treasury').from('federal_context_metrics')
      .select('value, as_of_date').eq('metric_key', 'tax_returns_filed').maybeSingle();
    if (data?.value != null) {
      const fy = Number(String(data.as_of_date).slice(0, 4)) + (Number(String(data.as_of_date).slice(5, 7)) >= 10 ? 1 : 0);
      currentReturns = { fy, value: Number(data.value) };
      console.log(`Carrying existing tax_returns_filed (${currentReturns.value.toLocaleString()}) → FY${currentReturns.fy}`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  for (let fy = FY_MIN; fy <= FY_MAX; fy++) {
    rows.push({
      metric_key: `population_fy${fy}`, value: pop[fy], as_of_date: `${fy}-07-01`,
      label: `US resident population (incl. armed forces overseas), July ${fy} — denominator for FY${fy} per-person amounts`,
      source_name: POP_SOURCE_NAME, source_url: FRED_POP_PAGE, source_date: today,
    });
  }
  for (const [yStr, val] of Object.entries(returns)) {
    const fy = Number(yStr);
    if (fy < FY_MIN || fy > FY_MAX) continue;
    rows.push({
      metric_key: `tax_returns_filed_fy${fy}`, value: val, as_of_date: `${fy}-09-30`,
      label: `Individual income tax returns filed, FY${fy} (IRS SOI Historical Table 21b) — denominator for FY${fy} per-taxpayer amounts`,
      source_name: IRS_SOURCE_NAME, source_url: IRS_PAGE, source_date: today,
    });
  }
  if (currentReturns && !returns[currentReturns.fy]) {
    rows.push({
      metric_key: `tax_returns_filed_fy${currentReturns.fy}`, value: currentReturns.value, as_of_date: `${currentReturns.fy}-09-30`,
      label: `Individual income tax returns filed, FY${currentReturns.fy} (IRS, carried from current tax_returns_filed) — per-taxpayer denominator`,
      source_name: IRS_SOURCE_NAME, source_url: IRS_PAGE, source_date: today,
    });
  }

  console.log(`Prepared ${rows.length} denominator metrics (${FY_MAX - FY_MIN + 1} population + ${rows.length - (FY_MAX - FY_MIN + 1)} returns).`);
  if (dryRun) {
    for (const r of rows.filter(r => r.metric_key.startsWith('tax_returns'))) console.log(`  ${r.metric_key} = ${r.value.toLocaleString()}`);
    console.log('[dry-run] No DB writes.');
    return;
  }

  for (const r of rows) {
    const { error } = await supabase.schema('treasury').from('federal_context_metrics')
      .upsert({ ...r, updated_at: new Date().toISOString() }, { onConflict: 'metric_key' });
    if (error) throw new Error(`metric ${r.metric_key}: ${error.message}`);
  }
  console.log(`Upserted ${rows.length} metrics. Done.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
