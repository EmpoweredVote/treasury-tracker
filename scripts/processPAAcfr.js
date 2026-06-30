#!/usr/bin/env node
/**
 * Pennsylvania General Fund Operating (Expenditure) Loader — FY2016-FY2025 ACTUAL
 * Source: Commonwealth of Pennsylvania Annual Comprehensive Financial Report (ACFR),
 *   Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances,
 *   GENERAL FUND column (GAAP basis, in thousands). Published by the Governor's Office
 *   of the Budget.
 *   Per-FY source URL below (pa.gov annualfinancialreport).
 *
 * Phase 105-01 (ACFR-06, ACFR-08, RECON-05). Replaces the NASBO operating rows on the
 *   PA state node in place (same (muni,fy,'operating') RPC key).
 *   PA state node resolved by name+state+entity_type='state'.
 *
 * URL SPECIAL-CASE: FY2016-FY2023 use hyphen filename (june-30-{YYYY}-acfr.pdf);
 *   FY2024-FY2025 use LITERAL SPACE (%20) filename (june-30-{YYYY}%20acfr.pdf).
 *   See SOURCES map below.
 *
 * UNITS = thousands (D-05): ×1,000 to store dollars (same as FL, CA). PA ACFR is in
 *   thousands. The General Fund is the 1st column of (General Fund | Motor License Fund
 *   | Nonmajor Funds | Total) — take the FIRST numeric token per row.
 *
 * SCOPE vs NASBO (D-04, TX-trap): PA ACFR GF ~2.0× NASBO GF because federal/
 *   intergovernmental (~$42.3B) sits inside the GAAP General Fund. Accept-and-relabel
 *   honestly via the GAAP basis label + source chip (confirmed at load in Plan 105-03).
 *   Do NOT silently double the node.
 *
 * Control = printed General-Fund-column "Total expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total (in thousands) or the
 *   loader refuses to write (process.exit(2)). Tolerance = 10,000 thousands.
 *   All FY2016-FY2025 transcriptions verified to tie at 0 diff vs printed totals.
 *
 * P2 clamp (ACFR-08): if any FY shows a negative GF expenditure category, clamp to 0
 *   for render with the signed magnitude in the label; root total carries the net.
 *   No negative expenditure categories found in PA FY2016-FY2025.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-work/pa/ (NOT -layout).
 *   GF column = 1st of (General Fund | Motor License Fund | Nonmajor | Total).
 *
 * IDEMPOTENCY (RECON-05): treasury_sync_budget_tree RPC is keyed (muni,fy,dataset_type)
 *   — re-running replaces existing rows; NASBO operating rows for same (muni,fy) are
 *   replaced in place. No duplicate nodes.
 *
 * Usage:
 *   node scripts/processPAAcfr.js [--dry-run] [--fy YYYY]
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const STATE_NAME = 'Pennsylvania'; const STATE_ABBR = 'PA'; const POPULATION = 13_002_700;
const UNITS = 1_000; // PA ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PA_BASE_HYPHEN = 'https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport';
// FY2016-FY2023: hyphen filename (june-30-{YYYY}-acfr.pdf)
// FY2024-FY2025: LITERAL SPACE (%20) filename (june-30-{YYYY}%20acfr.pdf) — special-case!
const SOURCES = {
  2016: { url: `${PA_BASE_HYPHEN}/june-30-2016-acfr.pdf`, date: '2016-06-30' },
  2017: { url: `${PA_BASE_HYPHEN}/june-30-2017-acfr.pdf`, date: '2017-06-30' },
  2018: { url: `${PA_BASE_HYPHEN}/june-30-2018-acfr.pdf`, date: '2018-06-30' },
  2019: { url: `${PA_BASE_HYPHEN}/june-30-2019-acfr.pdf`, date: '2019-06-30' },
  2020: { url: `${PA_BASE_HYPHEN}/june-30-2020-acfr.pdf`, date: '2020-06-30' },
  2021: { url: `${PA_BASE_HYPHEN}/june-30-2021-acfr.pdf`, date: '2021-06-30' },
  2022: { url: `${PA_BASE_HYPHEN}/june-30-2022-acfr.pdf`, date: '2022-06-30' },
  2023: { url: `${PA_BASE_HYPHEN}/june-30-2023-acfr.pdf`, date: '2023-06-30' },
  2024: { url: `${PA_BASE_HYPHEN}/june-30-2024%20acfr.pdf`, date: '2024-06-30' }, // %20 special-case
  2025: { url: `${PA_BASE_HYPHEN}/june-30-2025%20acfr.pdf`, date: '2025-06-30' }, // %20 special-case
};
const dataSource = (fy) => `Pennsylvania State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — PA ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim ACFR function names from the Governmental Funds Statement of Revenues,
// Expenditures and Changes in Fund Balances. total = printed General-Fund "Total
// expenditures" (thousands). Transcribed from pdftotext -table extraction; all FY tie at
// 0 diff vs printed totals.
// Note: no zero-value or negative GF expenditure categories found in PA FY2016-FY2025.
const EXPENDITURES = {
  2016: { total: 56_135_869, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:    629_484 },
    { name: 'Protection of persons and property', total:  4_241_572 },
    { name: 'Health and human services',          total: 36_116_515 },
    { name: 'Public education',                   total: 14_233_462 },
    { name: 'Recreation and cultural enrichment', total:    291_359 },
    { name: 'Economic development',               total:    425_765 },
    { name: 'Transportation',                     total:     65_942 },
    { name: 'Capital outlay',                     total:    116_497 },
    { name: 'Debt service — Principal retirement', total:          0 },
    { name: 'Debt service — Interest and fiscal charges', total:  15_273 },
  ]},
  2017: { total: 61_606_897, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:    669_491 },
    { name: 'Protection of persons and property', total:  4_540_329 },
    { name: 'Health and human services',          total: 39_688_917 },
    { name: 'Public education',                   total: 15_705_958 },
    { name: 'Recreation and cultural enrichment', total:    305_531 },
    { name: 'Economic development',               total:    487_300 },
    { name: 'Transportation',                     total:     28_400 },
    { name: 'Capital outlay',                     total:    158_177 },
    { name: 'Debt service — Principal retirement', total:          0 },
    { name: 'Debt service — Interest and fiscal charges', total:  22_794 },
  ]},
  2018: { total: 61_607_586, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:    907_813 },
    { name: 'Protection of persons and property', total:  4_514_633 },
    { name: 'Health and human services',          total: 39_447_145 },
    { name: 'Public education',                   total: 15_832_100 },
    { name: 'Recreation and cultural enrichment', total:    308_792 },
    { name: 'Economic development',               total:    406_499 },
    { name: 'Transportation',                     total:     62_969 },
    { name: 'Capital outlay',                     total:     99_552 },
    { name: 'Debt service — Principal retirement', total:          0 },
    { name: 'Debt service — Interest and fiscal charges', total:  28_083 },
  ]},
  2019: { total: 65_677_284, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:    908_473 },
    { name: 'Protection of persons and property', total:  4_806_069 },
    { name: 'Health and human services',          total: 42_633_941 },
    { name: 'Public education',                   total: 16_295_404 },
    { name: 'Recreation and cultural enrichment', total:    324_364 },
    { name: 'Economic development',               total:    493_406 },
    { name: 'Transportation',                     total:     57_473 },
    { name: 'Capital outlay',                     total:    127_394 },
    { name: 'Debt service — Principal retirement', total:      8_140 },
    { name: 'Debt service — Interest and fiscal charges', total:  22_620 },
  ]},
  2020: { total: 71_839_247, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:  1_267_988 },
    { name: 'Protection of persons and property', total:  4_647_132 },
    { name: 'Health and human services',          total: 47_128_172 },
    { name: 'Public education',                   total: 16_824_044 },
    { name: 'Recreation and cultural enrichment', total:    341_621 },
    { name: 'Economic development',               total:  1_400_678 },
    { name: 'Transportation',                     total:     58_193 },
    { name: 'Capital outlay',                     total:    106_233 },
    { name: 'Debt service — Principal retirement', total:     17_370 },
    { name: 'Debt service — Interest and fiscal charges', total:  47_816 },
  ]},
  2021: { total: 76_524_883, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:  1_296_900 },
    { name: 'Protection of persons and property', total:  5_365_030 },
    { name: 'Health and human services',          total: 51_172_007 },
    { name: 'Public education',                   total: 17_398_728 },
    { name: 'Recreation and cultural enrichment', total:    341_335 },
    { name: 'Economic development',               total:    561_813 },
    { name: 'Transportation',                     total:     86_243 },
    { name: 'Capital outlay',                     total:    234_753 },
    { name: 'Debt service — Principal retirement', total:     24_740 },
    { name: 'Debt service — Interest and fiscal charges', total:  43_334 },
  ]},
  2022: { total: 87_003_182, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:  1_317_608 },
    { name: 'Protection of persons and property', total:  5_567_082 },
    { name: 'Health and human services',          total: 57_923_444 },
    { name: 'Public education',                   total: 20_434_292 },
    { name: 'Recreation and cultural enrichment', total:    353_066 },
    { name: 'Economic development',               total:    788_580 },
    { name: 'Transportation',                     total:     85_971 },
    { name: 'Capital outlay',                     total:    464_451 },
    { name: 'Debt service — Principal retirement', total:     24_900 },
    { name: 'Debt service — Interest and fiscal charges', total:  43_788 },
  ]},
  2023: { total: 89_473_087, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:  1_221_402 },
    { name: 'Protection of persons and property', total:  6_223_912 },
    { name: 'Health and human services',          total: 58_431_165 },
    { name: 'Public education',                   total: 21_393_851 },
    { name: 'Recreation and cultural enrichment', total:    414_876 },
    { name: 'Economic development',               total:  1_290_744 },
    { name: 'Transportation',                     total:     92_568 },
    { name: 'Capital outlay',                     total:    332_613 },
    { name: 'Debt service — Principal retirement', total:     26_305 },
    { name: 'Debt service — Interest and fiscal charges', total:  45_651 },
  ]},
  2024: { total: 89_446_895, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:  1_104_612 },
    { name: 'Protection of persons and property', total:  6_572_875 },
    { name: 'Health and human services',          total: 56_647_920 },
    { name: 'Public education',                   total: 23_293_580 },
    { name: 'Recreation and cultural enrichment', total:    462_896 },
    { name: 'Economic development',               total:    835_469 },
    { name: 'Transportation',                     total:     61_071 },
    { name: 'Capital outlay',                     total:    399_285 },
    { name: 'Debt service — Principal retirement', total:     21_530 },
    { name: 'Debt service — Interest and fiscal charges', total:  47_657 },
  ]},
  2025: { total: 94_758_255, confidence: 'actual', categories: [
    { name: 'Direction and supportive services',  total:  1_123_698 },
    { name: 'Protection of persons and property', total:  7_486_600 },
    { name: 'Health and human services',          total: 62_897_654 },
    { name: 'Public education',                   total: 21_089_370 },
    { name: 'Recreation and cultural enrichment', total:    454_339 },
    { name: 'Economic development',               total:  1_074_518 },
    { name: 'Transportation',                     total:     60_301 },
    { name: 'Capital outlay',                     total:    502_318 },
    { name: 'Debt service — Principal retirement', total:     19_595 },
    { name: 'Debt service — Interest and fiscal charges', total:  49_862 },
  ]},
};

// P2 clamp (ACFR-08): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Pennsylvania General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Pennsylvania General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'pa-acfr-gf-operating', base_url: 'https://www.pa.gov/agencies/budget/publications-and-reports/annual-financial-report', fiscal_years: [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('dataset_id', srcPayload.dataset_id).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = EXPENDITURES[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${c.total.toLocaleString()} (net loss — shown at 0)]`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL EXPENDITURES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} operating row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} operating budget row to stamp source`); process.exit(2); }
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
