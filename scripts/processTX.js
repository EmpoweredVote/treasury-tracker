#!/usr/bin/env node
/**
 * Texas General Fund Operating (Expenditure) Loader — FY2015-FY2024 ACTUAL
 * Source: State of Texas Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL REVENUE FUND
 *   column (GAAP basis, in thousands). Published by the Texas Comptroller of Public Accounts.
 *
 * Phase 99 (ACFR-02). Replaces the NASBO operating rows on the TX state node in place
 *   (same (muni,fy,'operating') RPC key). Node resolved by name+state+entity_type='state'.
 *
 * BASIS RELABEL (D-06): the TX ACFR "General Revenue Fund" is a far broader consolidated
 *   operating fund than the NASBO "General Fund" concept — its magnitude is ~3x the NASBO
 *   TX GF (FY2024 $161.4B GR Fund vs $50.5B NASBO GF). We accept it AS TEXAS'S audited GAAP
 *   general-fund-equivalent and label the fund HONESTLY ("General Revenue Fund"). The node
 *   total will visibly jump on load; that is correct + sourced (do NOT carve it down).
 *
 * Control = printed General-Revenue-Fund-column "Total Expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total within $10M or the loader
 *   refuses to write (process.exit(2)). The tiny residuals (≤$31k) seen in some years are
 *   ACFR printed-subtotal rounding, far inside the $10M gate.
 *
 * FY2016 (D-05): the standard `.../2016/96-471.pdf` returns HTTP 404, but the full FY2016
 *   ACFR is published one level deeper at `.../2016/docs/96-471.pdf` (recovered + tied in
 *   Phase 99-01). Included with the alternate URL below. (TX returns honest 404s — no
 *   soft-404 guard needed, unlike CA.)
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/tx/ (NOT -layout).
 *   Bookends (recon-confirmed): FY2015 GR Fund Total revenues 95,574,830k;
 *   FY2024 161,416,562k. General-column debt-service Interest is 0 for FY2019-2024.
 *
 * Usage:
 *   node scripts/processTX.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Texas'; const STATE_ABBR = 'TX'; const POPULATION = 29_145_505;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published State of Texas ACFR (source_date = Aug 31 FYE).
// FY2016 uses the alternate `docs/96-471.pdf` path (standard `96-471.pdf` 404s for 2016).
const SOURCES = {
  2015: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2015/96-471.pdf', date: '2015-08-31' },
  2016: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2016/docs/96-471.pdf', date: '2016-08-31' }, // alt file-id (D-05)
  2017: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2017/96-471.pdf', date: '2017-08-31' },
  2018: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2018/96-471.pdf', date: '2018-08-31' },
  2019: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2019/96-471.pdf', date: '2019-08-31' },
  2020: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2020/96-471.pdf', date: '2020-08-31' },
  2021: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2021/96-471.pdf', date: '2021-08-31' },
  2022: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2022/96-471.pdf', date: '2022-08-31' },
  2023: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2023/96-471.pdf', date: '2023-08-31' },
  2024: { url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2024/96-471.pdf', date: '2024-08-31' },
};
const dataSource = (fy) => `Texas State ACFR — General Revenue Fund (FY${fy} actual, GAAP basis)`;

// General Revenue Fund expenditures by function — State of TX ACFR, GENERAL REVENUE FUND
// column (in $). Verbatim ACFR function names. total = printed "Total Expenditures".
// Debt-service Interest in the General column is 0 for FY2019-2024 (it lives in other funds).
const EXPENDITURES = {
  2015: { total: 91_547_516_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  2_616_953_000 },
    { name: 'Education',                             total: 26_529_797_000 },
    { name: 'Employee Benefits',                     total:      1_808_000 },
    { name: 'Teacher Retirement State Contributions',total:  2_735_912_000 },
    { name: 'Health and Human Services',             total: 51_727_363_000 },
    { name: 'Public Safety and Corrections',         total:  4_982_331_000 },
    { name: 'Transportation',                        total:     89_333_000 },
    { name: 'Natural Resources and Recreation',      total:  2_108_866_000 },
    { name: 'Regulatory Services',                   total:    386_926_000 },
    { name: 'Capital Outlay',                        total:    171_092_000 },
    { name: 'Debt Service — Principal',              total:     86_526_000 },
    { name: 'Debt Service — Interest',               total:    110_051_000 },
    { name: 'Other Financing Fees',                  total:        558_000 },
  ]},
  2016: { total: 96_969_189_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  2_622_829_000 },
    { name: 'Education',                             total: 27_658_325_000 },
    { name: 'Employee Benefits',                     total:     27_698_000 },
    { name: 'Teacher Retirement State Contributions',total:  2_080_935_000 },
    { name: 'Health and Human Services',             total: 55_522_638_000 },
    { name: 'Public Safety and Corrections',         total:  5_964_269_000 },
    { name: 'Transportation',                        total:    137_249_000 },
    { name: 'Natural Resources and Recreation',      total:  2_063_003_000 },
    { name: 'Regulatory Services',                   total:    413_887_000 },
    { name: 'Capital Outlay',                        total:    246_141_000 },
    { name: 'Debt Service — Principal',              total:     89_394_000 },
    { name: 'Debt Service — Interest',               total:    140_914_000 },
    { name: 'Other Financing Fees',                  total:      1_907_000 },
  ]},
  2017: { total: 96_028_761_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  2_916_381_000 },
    { name: 'Education',                             total: 26_279_701_000 },
    { name: 'Employee Benefits',                     total:      2_112_000 },
    { name: 'Teacher Retirement State Contributions',total:  2_148_958_000 },
    { name: 'Health and Human Services',             total: 55_448_840_000 },
    { name: 'Public Safety and Corrections',         total:  6_135_427_000 },
    { name: 'Transportation',                        total:     16_079_000 },
    { name: 'Natural Resources and Recreation',      total:  2_109_290_000 },
    { name: 'Regulatory Services',                   total:    420_185_000 },
    { name: 'Capital Outlay',                        total:    262_565_000 },
    { name: 'Debt Service — Principal',              total:    111_347_000 },
    { name: 'Debt Service — Interest',               total:    177_373_000 },
    { name: 'Other Financing Fees',                  total:        503_000 },
  ]},
  2018: { total: 100_562_405_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  3_089_373_000 },
    { name: 'Education',                             total: 27_419_283_000 },
    { name: 'Employee Benefits',                     total:      2_211_000 },
    { name: 'Teacher Retirement State Contributions',total:  2_629_099_000 },
    { name: 'Health and Human Services',             total: 57_984_242_000 },
    { name: 'Public Safety and Corrections',         total:  6_569_243_000 },
    { name: 'Transportation',                        total:     24_353_000 },
    { name: 'Natural Resources and Recreation',      total:  2_145_918_000 },
    { name: 'Regulatory Services',                   total:    426_985_000 },
    { name: 'Capital Outlay',                        total:    267_505_000 },
    { name: 'Debt Service — Principal',              total:      3_997_000 },
    { name: 'Debt Service — Interest',               total:        196_000 },
    { name: 'Other Financing Fees',                  total:              0 },
  ]},
  2019: { total: 100_119_146_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  3_326_517_000 },
    { name: 'Education',                             total: 27_143_166_000 },
    { name: 'Employee Benefits',                     total:              0 },
    { name: 'Teacher Retirement State Contributions',total:  2_991_655_000 },
    { name: 'Health and Human Services',             total: 57_207_785_000 },
    { name: 'Public Safety and Corrections',         total:  6_535_934_000 },
    { name: 'Transportation',                        total:      8_494_000 },
    { name: 'Natural Resources and Recreation',      total:  2_087_160_000 },
    { name: 'Regulatory Services',                   total:    450_801_000 },
    { name: 'Capital Outlay',                        total:    363_622_000 },
    { name: 'Debt Service — Principal',              total:      4_001_000 },
    { name: 'Debt Service — Interest',               total:              0 },
    { name: 'Other Financing Fees',                  total:              0 },
  ]},
  2020: { total: 110_209_722_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  3_379_433_000 },
    { name: 'Education',                             total: 30_033_172_000 },
    { name: 'Employee Benefits',                     total:     25_256_000 },
    { name: 'Teacher Retirement State Contributions',total:  2_949_854_000 },
    { name: 'Health and Human Services',             total: 63_974_832_000 },
    { name: 'Public Safety and Corrections',         total:  6_218_784_000 },
    { name: 'Transportation',                        total:     46_010_000 },
    { name: 'Natural Resources and Recreation',      total:  2_737_032_000 },
    { name: 'Regulatory Services',                   total:    442_536_000 },
    { name: 'Capital Outlay',                        total:    398_828_000 },
    { name: 'Debt Service — Principal',              total:      3_984_000 },
    { name: 'Debt Service — Interest',               total:              0 },
    { name: 'Other Financing Fees',                  total:              0 },
  ]},
  2021: { total: 127_124_061_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  4_527_364_000 },
    { name: 'Education',                             total: 31_327_882_000 },
    { name: 'Employee Benefits',                     total:      2_620_000 },
    { name: 'Teacher Retirement State Contributions',total:  2_768_429_000 },
    { name: 'Health and Human Services',             total: 77_547_241_000 },
    { name: 'Public Safety and Corrections',         total:  6_156_867_000 },
    { name: 'Transportation',                        total:    137_806_000 },
    { name: 'Natural Resources and Recreation',      total:  3_626_193_000 },
    { name: 'Regulatory Services',                   total:    454_528_000 },
    { name: 'Capital Outlay',                        total:    554_858_000 },
    { name: 'Debt Service — Principal',              total:      3_981_000 },
    { name: 'Debt Service — Interest',               total:              0 },
    { name: 'Other Financing Fees',                  total:     16_290_000 },
  ]},
  2022: { total: 149_657_222_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  5_533_602_000 },
    { name: 'Education',                             total: 38_779_945_000 },
    { name: 'Employee Benefits',                     total:     20_082_000 },
    { name: 'Teacher Retirement State Contributions',total:  4_266_932_000 },
    { name: 'Health and Human Services',             total: 87_623_570_000 },
    { name: 'Public Safety and Corrections',         total:  7_454_700_000 },
    { name: 'Transportation',                        total:    163_528_000 },
    { name: 'Natural Resources and Recreation',      total:  3_385_845_000 },
    { name: 'Regulatory Services',                   total:    463_519_000 },
    { name: 'Capital Outlay',                        total:  1_770_422_000 },
    { name: 'Debt Service — Principal',              total:    182_758_000 },
    { name: 'Debt Service — Interest',               total:              0 },
    { name: 'Other Financing Fees',                  total:     12_318_000 },
  ]},
  2023: { total: 141_704_325_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  5_627_875_000 },
    { name: 'Education',                             total: 34_937_518_000 },
    { name: 'Employee Benefits',                     total:     19_249_000 },
    { name: 'Teacher Retirement State Contributions',total:  3_047_455_000 },
    { name: 'Health and Human Services',             total: 83_619_460_000 },
    { name: 'Public Safety and Corrections',         total:  8_394_776_000 },
    { name: 'Transportation',                        total:     50_491_000 },
    { name: 'Natural Resources and Recreation',      total:  3_952_135_000 },
    { name: 'Regulatory Services',                   total:    525_348_000 },
    { name: 'Capital Outlay',                        total:  1_287_993_000 },
    { name: 'Debt Service — Principal',              total:    240_158_000 },
    { name: 'Debt Service — Interest',               total:              0 },
    { name: 'Other Financing Fees',                  total:      1_847_000 },
  ]},
  2024: { total: 151_740_650_000, confidence: 'actual', categories: [
    { name: 'General Government',                    total:  9_342_624_000 },
    { name: 'Education',                             total: 43_107_284_000 },
    { name: 'Employee Benefits',                     total:     18_672_000 },
    { name: 'Teacher Retirement State Contributions',total:  8_895_341_000 },
    { name: 'Health and Human Services',             total: 74_994_862_000 },
    { name: 'Public Safety and Corrections',         total:  8_833_505_000 },
    { name: 'Transportation',                        total:     74_783_000 },
    { name: 'Natural Resources and Recreation',      total:  3_958_249_000 },
    { name: 'Regulatory Services',                   total:    574_457_000 },
    { name: 'Capital Outlay',                        total:  1_652_884_000 },
    { name: 'Debt Service — Principal',              total:    280_241_000 },
    { name: 'Debt Service — Interest',               total:         31_000 },
    { name: 'Other Financing Fees',                  total:      7_717_000 },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total})`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: [] }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Texas General Revenue Fund Budget', a: total, c: children }], total, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, General Revenue Fund)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Texas General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'tx-acfr-gf-operating', base_url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/', fiscal_years: [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL EXPENDITURES (Gen Revenue Fund)'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
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
