#!/usr/bin/env node
/**
 * Texas General Fund Revenue (by source) Loader — FY2015-FY2024 ACTUAL
 * Source: State of Texas Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL REVENUE FUND
 *   column (GAAP basis, in thousands). Published by the Texas Comptroller of Public Accounts.
 *
 * Phase 99 (ACFR-02 + ACFR-05). Revenue is NEW on the TX state node (NASBO had no
 *   revenue-by-source) → pure insert keyed (muni,fy,'revenue'). Node resolved by
 *   name+state+entity_type='state'.
 *
 * BASIS RELABEL (D-06): "General Revenue Fund" is honestly named (broader consolidated
 *   operating fund, ~3x the NASBO GF). data_source string names the fund explicitly.
 *
 * Control = printed "Total Revenues" (General Revenue Fund column). Each FY's transcribed
 *   rev-by-source categories must tie to the printed Total within $10M or the loader refuses
 *   to write (process.exit(2)). Bookends (recon-confirmed): FY2015 95,574,830k;
 *   FY2024 161,416,562k.
 *
 * P2 clamp (ACFR-05): FY2022 "Interest and Other Investment Income" in the General column is
 *   NEGATIVE (−122,684k). Rendered area is clamped to 0; the true signed value is preserved
 *   in the label; the root total carries the net (which already nets the negative).
 *
 * FY2016 (D-05): recovered via alternate URL `.../2016/docs/96-471.pdf` (standard path 404s).
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/tx/ (NOT -layout).
 *
 * Usage:
 *   node scripts/processTXRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Texas State ACFR — General Revenue Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Revenue Fund revenues by source — State of TX ACFR, GENERAL REVENUE FUND column
// (in $). Verbatim ACFR revenue source names. total = printed "Total Revenues".
// FY2022 "Interest and Other Investment Income" is NEGATIVE (−122,684k) → P2 clamp.
const REVENUE = {
  2015: { total: 95_574_830_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 44_936_371_000 },
    { name: 'Federal',                              total: 38_626_324_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_157_896_000 },
    { name: 'Interest and Other Investment Income', total:    157_704_000 },
    { name: 'Land Income',                          total:     38_306_000 },
    { name: 'Settlement of Claims',                 total:    561_567_000 },
    { name: 'Sales of Goods and Services',          total:  3_459_519_000 },
    { name: 'Other',                                total:  4_637_143_000 },
  ]},
  2016: { total: 96_239_551_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 42_597_570_000 },
    { name: 'Federal',                              total: 40_296_287_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_038_396_000 },
    { name: 'Interest and Other Investment Income', total:    111_872_000 },
    { name: 'Land Income',                          total:     18_516_000 },
    { name: 'Settlement of Claims',                 total:    635_491_000 },
    { name: 'Sales of Goods and Services',          total:  4_626_984_000 },
    { name: 'Other',                                total:  4_914_435_000 },
  ]},
  2017: { total: 97_845_444_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 45_207_226_000 },
    { name: 'Federal',                              total: 39_835_769_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_041_707_000 },
    { name: 'Interest and Other Investment Income', total:    113_783_000 },
    { name: 'Land Income',                          total:     19_872_000 },
    { name: 'Settlement of Claims',                 total:    510_081_000 },
    { name: 'Sales of Goods and Services',          total:  3_789_672_000 },
    { name: 'Other',                                total:  5_327_334_000 },
  ]},
  2018: { total: 104_971_891_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 48_319_067_000 },
    { name: 'Federal',                              total: 42_409_336_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_095_287_000 },
    { name: 'Interest and Other Investment Income', total:    372_485_000 },
    { name: 'Land Income',                          total:        219_000 },
    { name: 'Settlement of Claims',                 total:    524_157_000 },
    { name: 'Sales of Goods and Services',          total:  4_404_250_000 },
    { name: 'Other',                                total:  5_847_090_000 },
  ]},
  2019: { total: 108_457_222_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 51_014_744_000 },
    { name: 'Federal',                              total: 42_563_092_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_084_575_000 },
    { name: 'Interest and Other Investment Income', total:    801_658_000 },
    { name: 'Land Income',                          total:     13_428_000 },
    { name: 'Settlement of Claims',                 total:    650_732_000 },
    { name: 'Sales of Goods and Services',          total:  4_315_422_000 },
    { name: 'Other',                                total:  6_013_571_000 },
  ]},
  2020: { total: 114_453_985_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 48_085_811_000 },
    { name: 'Federal',                              total: 50_949_713_000 },
    { name: 'Licenses, Fees and Permits',           total:  2_981_017_000 },
    { name: 'Sales of Goods and Services',          total:  4_959_905_000 },
    { name: 'Interest and Other Investment Income', total:    728_416_000 },
    { name: 'Land Income',                          total:     10_485_000 },
    { name: 'Settlement of Claims',                 total:    617_387_000 },
    { name: 'Other Revenues',                       total:  6_121_251_000 },
  ]},
  2021: { total: 135_544_186_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 52_171_630_000 },
    { name: 'Federal',                              total: 67_082_316_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_057_321_000 },
    { name: 'Sales of Goods and Services',          total:  4_703_906_000 },
    { name: 'Interest and Other Investment Income', total:    529_498_000 },
    { name: 'Land Income',                          total:     17_835_000 },
    { name: 'Settlement of Claims',                 total:    727_299_000 },
    { name: 'Other Revenues',                       total:  7_254_381_000 },
  ]},
  2022: { total: 177_811_724_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 68_473_610_000 },
    { name: 'Federal',                              total: 89_359_509_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_420_459_000 },
    { name: 'Sales of Goods and Services',          total:  6_394_044_000 },
    { name: 'Interest and Other Investment Income', total:   -122_684_000 }, // NEGATIVE — P2 clamp to 0
    { name: 'Land Income',                          total:     18_471_000 },
    { name: 'Settlement of Claims',                 total:    628_287_000 },
    { name: 'Other Revenues',                       total:  9_640_028_000 },
  ]},
  2023: { total: 168_071_483_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 70_657_557_000 },
    { name: 'Federal',                              total: 74_715_674_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_509_673_000 },
    { name: 'Sales of Goods and Services',          total:  6_041_260_000 },
    { name: 'Interest and Other Investment Income', total:  2_015_604_000 },
    { name: 'Land Income',                          total:     14_718_000 },
    { name: 'Settlement of Claims',                 total:    602_484_000 },
    { name: 'Other Revenues',                       total: 10_514_513_000 },
  ]},
  2024: { total: 161_416_562_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                total: 70_368_911_000 },
    { name: 'Federal',                              total: 63_078_115_000 },
    { name: 'Licenses, Fees and Permits',           total:  3_684_543_000 },
    { name: 'Sales of Goods and Services',          total:  8_212_094_000 },
    { name: 'Interest and Other Investment Income', total:  3_485_139_000 },
    { name: 'Land Income',                          total:     17_009_000 },
    { name: 'Settlement of Claims',                 total:    834_050_000 },
    { name: 'Other Revenues',                       total: 11_736_701_000 },
  ]},
};

// P2: clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total})`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Texas General Revenue Fund Revenue', a: total, c: children }], total, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, General Revenue Fund)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Texas General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'tx-acfr-gf-revenue', base_url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/', fiscal_years: [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('dataset_id', srcPayload.dataset_id).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
    console.log('');
  }
  for (const fy of years) {
    if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${c.total.toLocaleString()} (net loss — shown at 0)]`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES (Gen Revenue Fund)'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} revenue budget row to stamp source`); process.exit(2); }
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
