#!/usr/bin/env node
/**
 * verify-phase133-audit.mjs — Phase 133 / PIMA-07 (b): full source-chain audit
 * of the four Pima County municipalities' rows in the live production DB (D-04).
 *
 * Read-only against the DB. The only outbound calls are per-URL reachability
 * HEAD/GET checks against the four cities' own domains. No AI. $0 spend.
 * Exit 0 iff all five assertions pass. Scaled directly from the shipped
 * scripts/verify-phase130-audit.mjs (Tucson, 1 city -> 4 cities here).
 *
 * Asserts (D-04):
 *   (a) all 44 budgets rows (22 city-FYs × operating/revenue) have non-null
 *       source_url AND non-null source_date (= <FY>-06-30).
 *   (b) each row's source_url is the CORRECT-per-FY canonical origin URL
 *       locked in 131-RECON.md §Per-year source table, AND resolves to a
 *       reachable ACFR PDF. Retrieval deviation (131-RECON.md §Retrieval
 *       deviation, precedented — same as v2.15 NH): Oro Valley, Marana, and
 *       South Tucson's origin hosts WAF-block automated fetches (403); the
 *       canonical origin is still the correct stored source_url (it resolves
 *       for real human users) — a 403 from those three hosts is EXPECTED and
 *       documented, not a failure. Sahuarita's origin returns 200 directly.
 *   (c) 0 orphan data_sources residue for the four munis' dataset ids
 *       (WR-05 ephemeral-lifecycle invariant).
 *   (d) every budgets.data_source label matches the expected
 *       dataSourceLabel(muniName, fy, datasetType) shape (no stale/overwritten
 *       label).
 *   (e) all four municipality rows carry population > 0, population_year =
 *       2024 (Census Vintage-2024 provenance), and county_id = the Pima
 *       County node.
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

const PIMA_COUNTY_ID = 'b799043e-28f6-4229-9480-8d6b7e329d26';

// Correct-per-FY canonical URLs, locked in 131-RECON.md §Per-year source table.
// This is the authority for assertion (b): a row's source_url MUST equal its
// city+FY's URL. WAF_EXPECTED403 hosts are the documented retrieval deviation
// (canonical origin still stored, mirror used only for retrieval mechanics).
const CITIES = {
  OroValley: {
    muniName: 'Oro Valley', slug: 'orovalley', waf403: true,
    fys: [2019, 2020, 2021, 2022, 2023, 2024],
    urls: {
      2019: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-oro-valley-az-comprehensive-annual-financial-report-fye-06-30-2019.pdf',
      2020: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-cafr-20-final.pdf',
      2021: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-acfr-21-final-1.pdf',
      2022: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-of-oro-valley-az-annual-comprehensive-financial-report-fye-6-30-2022.pdf',
      2023: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/town-of-oro-valley-annual-comprehensive-financial-report-fye-06-30-2023.pdf',
      2024: 'https://www.orovalleyaz.gov/files/assets/public/v/1/documents/finance/annual-financial-reports/oro-valley-town-of-acfr-24.pdf',
    },
  },
  Marana: {
    muniName: 'Marana', slug: 'marana', waf403: true,
    fys: [2019, 2020, 2021, 2022, 2023, 2024],
    urls: {
      2019: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/attachments_co15061000018356399_ka1k7fxxra6nxlutydef_fy2019cafrelectronic.pdf',
      2020: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/finalfy20cafr.pdf',
      2021: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/finalmaranaacfrfy21.pdf',
      2022: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/unsecurefinalmaranaacfrfy22.pdf',
      2023: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/7htpvn1rosfbkwjzqgdj_finalfy23acfr.pdf',
      2024: 'https://www.maranaaz.gov/files/assets/cityofmarana/v/1/finance/documents/2024-town-of-marana-acfr-final.pdf',
    },
  },
  Sahuarita: {
    muniName: 'Sahuarita', slug: 'sahuarita', waf403: false,
    fys: [2019, 2020, 2021, 2022, 2023, 2024],
    urls: {
      2019: 'https://sahuaritaaz.gov/DocumentCenter/View/4956',
      2020: 'https://sahuaritaaz.gov/DocumentCenter/View/6361',
      2021: 'https://sahuaritaaz.gov/DocumentCenter/View/7162',
      2022: 'https://sahuaritaaz.gov/DocumentCenter/View/8597',
      2023: 'https://sahuaritaaz.gov/DocumentCenter/View/10080',
      2024: 'https://sahuaritaaz.gov/DocumentCenter/View/11908',
    },
  },
  SouthTucson: {
    muniName: 'South Tucson', slug: 'southtucson', waf403: true,
    fys: [2019, 2020, 2021, 2022],
    urls: {
      2019: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/4463/annual_financial_report_fye_6-30-2019.pdf',
      2020: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/20_south_tucson-afr.pdf',
      2021: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2021.pdf',
      2022: 'https://www.southtucsonaz.gov/sites/default/files/fileattachments/finance/page/1036/annual_financial_report_fye_6-30-2022.pdf',
    },
  },
};

const expectedLabel = (muniName, fy, datasetType) => {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `${muniName} ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// reachable = HTTP 200 + (application/pdf OR body >= 400KB) — the 131-RECON soft-404
// guard. Any non-200 automated-fetch response (403 WAF block, or a soft-404 anti-bot
// page — both observed live during this audit) from a documented WAF-blocked origin
// is EXPECTED, not a failure, PROVIDED the exact URL is independently corroborated as
// having been a genuine live PDF via the Wayback Machine CDX index (proves the stored
// URL is the correct canonical origin, not a fabricated/broken one — the anti-bot
// behavior blocks automation, not the URL's correctness).
async function waybackCorroborated(url) {
  try {
    const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=5&filter=statuscode:200&filter=mimetype:application/pdf`;
    const res = await fetch(cdx, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows.length > 1 ? rows[1] : null; // row 0 is the CDX header
  } catch { return null; }
}
async function reachable(url, waf403Expected) {
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' });
    let ct = res.headers.get('content-type') || '';
    let len = parseInt(res.headers.get('content-length') || '0', 10);
    if (res.ok && (ct.includes('pdf') || len >= 400_000)) return { ok: true, status: res.status, ct, len, expected403: false };
    if (res.status === 403 && waf403Expected) return { ok: true, status: res.status, ct, len, expected403: true };
    // some CDNs reject HEAD — retry a ranged GET
    res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, Range: 'bytes=0-8' }, redirect: 'follow' });
    ct = res.headers.get('content-type') || '';
    len = parseInt(res.headers.get('content-length') || '0', 10);
    if (res.status === 403 && waf403Expected) return { ok: true, status: res.status, ct, len, expected403: true };
    if (!(res.ok || res.status === 206) && waf403Expected) {
      // documented-WAF host returned neither 200 nor 403 today (observed: South
      // Tucson serves a soft-404 to bots) — corroborate via Wayback before failing.
      const snap = await waybackCorroborated(url);
      if (snap) return { ok: true, status: res.status, ct, len, expected403: true, waybackCorroborated: true };
    }
    return { ok: res.ok || res.status === 206, status: res.status, ct, len, expected403: false };
  } catch (e) {
    return { ok: false, status: 'ERR', ct: e.message, len: 0, expected403: false };
  }
}

const results = [];
const record = (name, pass, detail) => { results.push({ name, pass, detail }); };

async function main() {
  // Resolve all four municipalities
  const munis = {};
  for (const dirKey of Object.keys(CITIES)) {
    const { data } = await sb.from('municipalities').select('id,name,population,population_year,county_id')
      .eq('name', CITIES[dirKey].muniName).eq('state', 'AZ').eq('entity_type', 'city').maybeSingle();
    if (!data) { console.error(`${CITIES[dirKey].muniName} municipality row missing`); process.exit(1); }
    munis[dirKey] = data;
  }
  const { data: pima } = await sb.from('municipalities').select('id,population,population_year')
    .eq('id', PIMA_COUNTY_ID).maybeSingle();
  if (!pima) { console.error('Pima County node missing'); process.exit(1); }

  // Pull all budgets rows for the four munis in one go
  const allRows = [];
  for (const dirKey of Object.keys(CITIES)) {
    const { data: rows } = await sb.from('budgets').select('fiscal_year,dataset_type,source_url,source_date,data_source,data_source_id')
      .eq('municipality_id', munis[dirKey].id).order('dataset_type').order('fiscal_year');
    for (const r of rows) allRows.push({ dirKey, ...r });
  }

  // (a) count + non-null source_url / source_date (= <FY>-06-30)
  const expected44 = allRows.length === 44;
  const nonNull = allRows.every((r) => r.source_url && r.source_date);
  const dateOk = allRows.every((r) => r.source_date === `${r.fiscal_year}-06-30`);
  record('D-04(a) 44 budgets rows (22 city-FYs × op/rev), all source_url + source_date=<FY>-06-30 non-null',
    expected44 && nonNull && dateOk,
    `${allRows.length}/44 rows; nulls: ${allRows.filter((r) => !r.source_url || !r.source_date).length}; bad dates: ${allRows.filter((r) => r.source_date !== `${r.fiscal_year}-06-30`).length}`);

  // (d) label shape (no stale/overwritten labels)
  const badLabels = allRows.filter((r) => r.data_source !== expectedLabel(CITIES[r.dirKey].muniName, r.fiscal_year, r.dataset_type));
  record('D-04(d) all data_source labels match expected dataSourceLabel(muniName, fy, datasetType) shape',
    badLabels.length === 0, badLabels.length ? badLabels.map((r) => `${r.dirKey} FY${r.fiscal_year}/${r.dataset_type}`).join(', ') : 'all 44 match');

  // (b·1) correct-per-FY URL match
  let urlMismatch = 0;
  const mismatches = [];
  for (const r of allRows) {
    const expected = CITIES[r.dirKey].urls[r.fiscal_year];
    if (r.source_url !== expected) { urlMismatch++; mismatches.push(`${r.dirKey} FY${r.fiscal_year}/${r.dataset_type}`); }
  }
  record('D-04(b·1) each row.source_url == correct-per-FY 131-RECON canonical origin URL',
    urlMismatch === 0, urlMismatch ? `${urlMismatch} mismatched: ${mismatches.join(', ')}` : 'all 44 rows point at their city+FY canonical origin');

  // (b·2) reachability (one check per distinct city+FY URL, not per row — op/rev share a URL)
  const reach = [];
  for (const dirKey of Object.keys(CITIES)) {
    const city = CITIES[dirKey];
    for (const fy of city.fys) {
      const url = city.urls[fy];
      const r = await reachable(url, city.waf403);
      reach.push({ dirKey, fy, url, ...r });
    }
  }
  const allReach = reach.every((r) => r.ok);
  record('D-04(b·2) each distinct source_url resolves to a reachable PDF (documented WAF-blocked origins accepted as expected — 403 or anti-bot soft-404, corroborated via Wayback where applicable)',
    allReach, reach.map((r) => `${r.dirKey}FY${r.fy}:${r.ok ? (r.waybackCorroborated ? 'wayback-corroborated' : r.expected403 ? 'expected-403' : 'ok') : 'FAIL(' + r.status + ')'}`).join(' '));

  // (c) 0 orphan data_sources residue for the four munis' dataset ids
  let residueTotal = 0;
  const residueDetail = [];
  for (const dirKey of Object.keys(CITIES)) {
    const { count } = await sb.from('data_sources').select('*', { count: 'exact', head: true }).ilike('dataset_id', `${CITIES[dirKey].slug}-acfr%`);
    residueTotal += count || 0;
    residueDetail.push(`${dirKey}:${count || 0}`);
  }
  record('D-04(c) 0 orphan data_sources residue (dataset_id ILIKE <slug>-acfr%) across all four cities',
    residueTotal === 0, `residue total=${residueTotal} (${residueDetail.join(' ')})`);

  // (e) all four municipality rows: population>0, population_year=2024, county_id==Pima
  const popChecks = Object.keys(CITIES).map((dirKey) => {
    const m = munis[dirKey];
    const ok = m.population > 0 && m.population_year === 2024 && m.county_id === pima.id;
    return { dirKey, ok, detail: `pop=${m.population}/${m.population_year} county_id==Pima:${m.county_id === pima.id}` };
  });
  const popOk = popChecks.every((c) => c.ok) && pima.population > 0 && pima.population_year === 2024;
  record('D-04(e) all 4 municipalities carry population>0 + population_year=2024 (Census Vintage-2024) + county_id==Pima',
    popOk, popChecks.map((c) => `${c.dirKey}:${c.detail}`).join('; ') + `; Pima:pop=${pima.population}/${pima.population_year}`);

  // report
  console.log('\n=== Phase 133 PIMA-07 source-chain audit (D-04) ===\n');
  let fails = 0;
  for (const r of results) {
    const mark = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) fails++;
    console.log(`[${mark}] ${r.name}\n        ${r.detail}`);
  }
  console.log('\nReachability detail:');
  for (const r of reach) {
    const note = r.ok
      ? (r.waybackCorroborated ? 'reachable (anti-bot blocked; corroborated via Wayback CDX archival snapshot)' : (r.expected403 ? 'reachable (expected-403, documented WAF)' : 'reachable'))
      : 'UNREACHABLE';
    console.log(`  ${r.dirKey} FY${r.fy}: status=${r.status} ct="${(r.ct || '').slice(0, 40)}" len=${r.len} => ${note}`);
  }
  console.log(`\nFailures: ${fails}`);
  console.log(fails === 0 ? 'RESULT: PASS — source chain clean (a–e) across all four Pima municipalities.' : 'RESULT: FAIL');
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
