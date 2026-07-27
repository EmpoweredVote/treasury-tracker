#!/usr/bin/env node
/**
 * Oregon legacy budget-loader provenance backfill — Portland, Gresham, Troutdale.
 *
 * These three cities were loaded by `processPortland.js`, `processGresham.js`
 * and `processTroutdale.js`, which pin their per-FY source PDF URLs in an
 * in-script `PDF_URLS` map but NEVER persist them: none of the three contains a
 * single `source_url` reference. The result is 51 `treasury.budgets` rows with
 * `source_url IS NULL` and `source_date IS NULL` — a violation of the project's
 * always-sourced rule that is invisible from the loader output.
 *
 * This script backfills those two columns ONLY. It never touches amounts,
 * trees, categories, line items or `data_source` labels, so it cannot alter a
 * single figure the site displays.
 *
 * NOTE: the URL maps below are MIRRORED from the three loaders (verified
 * identical at the time of writing, all HTTP 200 application/pdf 2026-07-27).
 * The loaders have also been fixed to stamp on future runs, so this script is a
 * ONE-TIME catch-up for rows already in the database, not an ongoing dependency.
 *
 * BASIS WARNING (not fixed here): unlike Bend / Sherwood / Tualatin / Beaverton
 * — which carry ACFR GAAP *actuals*, General Fund only — these three carry
 * ADOPTED BUDGET figures, city-wide, and include a third `all_funds_requirements`
 * dataset_type and future fiscal years (through FY2026). Oregon therefore has
 * two different bases across cities. That is a data-model question, deliberately
 * out of scope for a provenance backfill.
 *
 * source_date convention: the FISCAL-YEAR END (June 30 of the fiscal year),
 * matching `processBend.js` / `processTucson.js`. It is deliberately the period
 * the row describes, NOT a publication or adoption date — inventing an issue
 * date we have not read off the document would be fabrication.
 *
 * Idempotent and non-destructive:
 *   - only rows where `source_url IS NULL` are touched (an existing stamp is
 *     never overwritten, even if it disagrees with the map);
 *   - a second run reports 0 updates.
 *
 * Usage:
 *   node scripts/backfillOregonBudgetProvenance.mjs --dry-run
 *   node scripts/backfillOregonBudgetProvenance.mjs
 *   node scripts/backfillOregonBudgetProvenance.mjs --verify-urls   (HEAD each URL first)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import path             from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── URL maps, mirrored from the three loaders ────────────────────────────────
// Portland pins a DIFFERENT document per dataset_type: Vol 1 (citywide summaries
// and bureau budgets) backs operating and all_funds_requirements; Vol 2 (city
// funds and capital projects) backs revenue.
const PORTLAND_VOL1 = {
  2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download',
  2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-1-city-portland-city-summaries-and-bureau/download',
  2024: 'https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
  2023: 'https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
  2022: 'https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download',
};
const PORTLAND_VOL2 = {
  2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-2-city-funds-and-capital-projects/download',
  2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-2-city-portland-city-funds-and-capital-projects/download',
  2024: 'https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-2-funds-and-capital-projects/download',
  2023: 'https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-2-funds-and-capital-projects/download',
  2022: 'https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-2-funds-and-capital-projects/download',
};

// Gresham and Troutdale each publish ONE adopted-budget document per FY that
// backs all three dataset_types.
const GRESHAM = {
  2026: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/fy-2025-26-adopted-budget.pdf',
  2025: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy24-25.pdf',
  2024: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy-2023-24.pdf',
  2023: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/adopted-budget-for-fiscal-year-2022-23.pdf',
};
const TROUTDALE = {
  2026: 'https://www.troutdaleoregon.gov/media/31436',
  2025: 'https://www.troutdaleoregon.gov/media/26636',
  2024: 'https://www.troutdaleoregon.gov/media/15016',
  2023: 'https://www.troutdaleoregon.gov/media/15021',
  2022: 'https://www.troutdaleoregon.gov/media/15026',
  2021: 'https://www.troutdaleoregon.gov/media/15031',
  2020: 'https://www.troutdaleoregon.gov/media/15036',
  2019: 'https://www.troutdaleoregon.gov/media/15041',
};

/** Resolve the source URL for one (city, fiscal_year, dataset_type) row. */
function urlFor(city, fy, datasetType) {
  if (city === 'Portland') {
    return (datasetType === 'revenue' ? PORTLAND_VOL2 : PORTLAND_VOL1)[fy] ?? null;
  }
  if (city === 'Gresham')   return GRESHAM[fy]   ?? null;
  if (city === 'Troutdale') return TROUTDALE[fy] ?? null;
  return null;
}

const CITIES = ['Portland', 'Gresham', 'Troutdale'];

async function headOk(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(30_000),
    });
    return { ok: res.ok, status: res.status, type: res.headers.get('content-type') ?? '' };
  } catch (e) {
    return { ok: false, status: 0, type: String(e.message ?? e).slice(0, 60) };
  }
}

async function main() {
  const { values: opts } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false },
               'verify-urls': { type: 'boolean', default: false } },
    strict: false,
  });
  const dryRun = opts['dry-run'];

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const t = () => supabase.schema('treasury');

  console.log(`Oregon legacy budget provenance backfill${dryRun ? ' (dry-run)' : ''}`);
  console.log('Cities: %s\n', CITIES.join(', '));

  const { data: munis, error: mErr } = await t()
    .from('municipalities').select('id, name')
    .eq('state', 'OR').in('name', CITIES);
  if (mErr) { console.error('municipality lookup failed:', mErr.message); process.exit(2); }
  const byId = new Map(munis.map(m => [m.id, m.name]));

  const { data: rows, error: bErr } = await t()
    .from('budgets')
    .select('id, municipality_id, fiscal_year, dataset_type, source_url, source_date')
    .in('municipality_id', [...byId.keys()])
    .order('fiscal_year');
  if (bErr) { console.error('budgets lookup failed:', bErr.message); process.exit(2); }

  // Plan first, so a missing URL aborts BEFORE any write.
  const plan = [];
  const skippedStamped = [];
  const unmapped = [];
  for (const r of rows) {
    const city = byId.get(r.municipality_id);
    if (r.source_url !== null) { skippedStamped.push(`${city} FY${r.fiscal_year} ${r.dataset_type}`); continue; }
    const url = urlFor(city, r.fiscal_year, r.dataset_type);
    if (!url) { unmapped.push(`${city} FY${r.fiscal_year} ${r.dataset_type}`); continue; }
    plan.push({ id: r.id, city, fy: r.fiscal_year, datasetType: r.dataset_type, url });
  }

  console.log(`rows examined      : ${rows.length}`);
  console.log(`already stamped    : ${skippedStamped.length} (left untouched)`);
  console.log(`to stamp           : ${plan.length}`);
  if (unmapped.length) {
    console.error(`\nNO URL MAPPED for ${unmapped.length} row(s) — aborting rather than ` +
                  `stamping a partial set:`);
    for (const u of unmapped) console.error(`  ${u}`);
    process.exit(1);
  }

  if (opts['verify-urls']) {
    const uniq = [...new Set(plan.map(p => p.url))];
    console.log(`\nVerifying ${uniq.length} distinct URLs...`);
    let bad = 0;
    for (const u of uniq) {
      const r = await headOk(u);
      if (!r.ok || !r.type.includes('pdf')) { bad++; console.log(`  DEAD ${r.status} ${r.type}  ${u}`); }
    }
    if (bad) { console.error(`\n${bad} URL(s) not returning a PDF — aborting.`); process.exit(1); }
    console.log('  all URLs return HTTP 200 application/pdf');
  }

  const byCity = {};
  for (const p of plan) (byCity[p.city] ??= []).push(p);
  console.log();
  for (const [city, ps] of Object.entries(byCity)) {
    const fys = [...new Set(ps.map(p => p.fy))].sort();
    console.log(`  ${city}: ${ps.length} rows, FY${fys[0]}-FY${fys[fys.length - 1]}`);
  }

  if (dryRun) { console.log('\nDry run — nothing written.'); return; }

  let updated = 0;
  for (const p of plan) {
    // Re-assert source_url IS NULL in the WHERE clause so a concurrent writer
    // cannot be clobbered between the plan and the write.
    const { data, error } = await t().from('budgets')
      .update({ source_url: p.url, source_date: `${p.fy}-06-30` })
      .eq('id', p.id).is('source_url', null).select('id');
    if (error) { console.error(`  FAILED ${p.city} FY${p.fy} ${p.datasetType}: ${error.message}`); process.exit(2); }
    if (data?.length) updated++;
  }
  console.log(`\nStamped ${updated} row(s).`);

  // Post-condition: no NULL provenance left for these three cities.
  const { data: after, error: aErr } = await t()
    .from('budgets').select('id, source_url, source_date')
    .in('municipality_id', [...byId.keys()]);
  if (aErr) { console.error('verify failed:', aErr.message); process.exit(2); }
  const stillNull = after.filter(r => r.source_url === null || r.source_date === null).length;
  console.log(`Verify: ${after.length} rows, ${stillNull} still missing provenance.`);
  if (stillNull) process.exit(1);
  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
