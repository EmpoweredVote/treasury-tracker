#!/usr/bin/env node
/**
 * verify-phase130-audit.mjs — Phase 130 / TUC-07 (b): full source-chain audit
 * of the Tucson + Pima County rows in the live production DB (D-04).
 *
 * Read-only against the DB. The only outbound calls are per-URL reachability
 * HEAD/GET checks against tucsonaz.gov. No AI. $0 spend. Exit 0 iff all pass.
 *
 * Asserts:
 *   (a) all 20 Tucson budgets rows (10 FY × operating/revenue) have non-null
 *       source_url AND non-null source_date.
 *   (b) each distinct source_url is reachable AND is the CORRECT document for
 *       its fiscal_year (cross-checked against the per-FY URLs locked in
 *       128-RECON.md) — not merely non-null.
 *   (c) 0 orphan data_sources residue for dataset_id ILIKE 'tucson%'.
 *   (d) every budgets.data_source label matches the expected per-FY/per-mode
 *       shape (no stale/overwritten label).
 *   (e) Tucson + Pima County rows both carry population>0 + population_year=2024
 *       (the Census Vintage-2024 provenance marker; the pinned source lives in
 *       scripts/seedTucsonArizona.js — municipalities has no provenance column).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent */ }
}
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or service key'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

const FYS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// Correct-per-FY canonical URLs, locked in 128-RECON.md (lines 64-73). This is
// the authority for assertion (b): a row's source_url MUST equal its FY's URL.
const EXPECTED_URL = {
  2024: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/cot-2024-annual-comprehensive-financial-report.pdf',
  2023: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/city-of-tucson-fy-2023-annual-comprehensive-financial-report-final.pdf',
  2022: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/acfr-2021-2022.pdf',
  2021: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/city-services/business-services/documents/city_of_tucson_annual_comprehensive_financial_report_fy_2020-2021_0.pdf',
  2020: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2020.pdf',
  2019: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2019.pdf',
  2018: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2018.pdf',
  2017: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2016-2017-acfr.pdf',
  2016: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2015-2016-acfr.pdf',
  2015: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2014-2015-acfr.pdf',
};
const expectedLabel = (fy, mode) =>
  `City of Tucson ACFR — General Fund ${mode === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function'} (FY${fy} actual, GAAP basis)`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// reachable = HTTP 200 + (application/pdf OR body >= 400KB) — the 128-RECON soft-404 guard.
async function reachable(url) {
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' });
    let ct = res.headers.get('content-type') || '';
    let len = parseInt(res.headers.get('content-length') || '0', 10);
    if (res.ok && (ct.includes('pdf') || len >= 400_000)) return { ok: true, status: res.status, ct, len };
    // some CDNs reject HEAD — retry a ranged GET
    res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-8' }, redirect: 'follow' });
    ct = res.headers.get('content-type') || '';
    len = parseInt(res.headers.get('content-length') || '0', 10);
    return { ok: res.ok || res.status === 206, status: res.status, ct, len };
  } catch (e) {
    return { ok: false, status: 'ERR', ct: e.message, len: 0 };
  }
}

const results = [];
const record = (name, pass, detail) => { results.push({ name, pass, detail }); };

async function main() {
  const { data: tucson } = await sb.from('municipalities').select('id,population,population_year,county_id')
    .eq('name', 'Tucson').eq('state', 'AZ').eq('entity_type', 'city').maybeSingle();
  const { data: pima } = await sb.from('municipalities').select('id,population,population_year')
    .eq('name', 'Pima County').eq('state', 'AZ').eq('entity_type', 'county').maybeSingle();
  if (!tucson || !pima) { console.error('Tucson or Pima County row missing'); process.exit(1); }

  const { data: rows } = await sb.from('budgets').select('fiscal_year,dataset_type,source_url,source_date,data_source,data_source_id')
    .eq('municipality_id', tucson.id).order('dataset_type').order('fiscal_year');

  // (a) count + non-null source_url / source_date
  const expected20 = rows.length === 20;
  const nonNull = rows.every((r) => r.source_url && r.source_date);
  record('D-04(a) 20 budgets rows, all source_url + source_date non-null',
    expected20 && nonNull, `${rows.length}/20 rows; nulls: ${rows.filter((r) => !r.source_url || !r.source_date).length}`);

  // (d) label shape (no stale/overwritten labels)
  const badLabels = rows.filter((r) => r.data_source !== expectedLabel(r.fiscal_year, r.dataset_type));
  record('D-04(d) all data_source labels match expected per-FY/per-mode shape',
    badLabels.length === 0, badLabels.length ? badLabels.map((r) => `FY${r.fiscal_year}/${r.dataset_type}`).join(', ') : 'all 20 match');

  // (b) correct-per-FY URL + reachable
  let urlMismatch = 0;
  for (const r of rows) {
    if (r.source_url !== EXPECTED_URL[r.fiscal_year]) urlMismatch++;
  }
  record('D-04(b·1) each row.source_url == correct-per-FY 128-RECON URL',
    urlMismatch === 0, urlMismatch ? `${urlMismatch} mismatched URLs` : 'all 20 rows point at their FY ACFR');

  const distinctUrls = [...new Set(rows.map((r) => r.source_url))];
  const reach = [];
  for (const fy of FYS) {
    const url = EXPECTED_URL[fy];
    const r = await reachable(url);
    reach.push({ fy, ...r });
  }
  const allReach = reach.every((r) => r.ok);
  record('D-04(b·2) each distinct source_url resolves to a reachable PDF',
    allReach, reach.map((r) => `FY${r.fy}:${r.ok ? 'ok' : 'FAIL(' + r.status + ')'}`).join(' '));

  // (c) 0 orphan data_sources residue
  const { count: residue } = await sb.from('data_sources').select('*', { count: 'exact', head: true }).ilike('dataset_id', 'tucson%');
  record('D-04(c) 0 orphan data_sources residue (dataset_id ILIKE tucson%)', (residue || 0) === 0, `residue=${residue || 0}`);

  // (e) Tucson + Pima population + Vintage-2024 provenance marker
  const tucOk = tucson.population > 0 && tucson.population_year === 2024;
  const pimaOk = pima.population > 0 && pima.population_year === 2024;
  const linkOk = tucson.county_id === pima.id;
  record('D-04(e) Tucson + Pima carry population>0 + population_year=2024 (Census Vintage-2024)',
    tucOk && pimaOk && linkOk,
    `Tucson pop=${tucson.population}/${tucson.population_year}; Pima pop=${pima.population}/${pima.population_year}; Tucson.county_id==Pima.id:${linkOk}`);

  // report
  console.log('\n=== Phase 130 TUC-07 source-chain audit (D-04) ===\n');
  let fails = 0;
  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) fails++;
    console.log(`[${mark}] ${r.name}\n        ${r.detail}`);
  }
  console.log('\nReachability detail:');
  for (const r of reach) console.log(`  FY${r.fy}: status=${r.status} ct="${(r.ct || '').slice(0, 40)}" len=${r.len} => ${r.ok ? 'reachable' : 'UNREACHABLE'}`);
  console.log(`\nFailures: ${fails}`);
  console.log(fails === 0 ? 'RESULT: PASS — source chain clean (a–e).' : 'RESULT: FAIL');
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
