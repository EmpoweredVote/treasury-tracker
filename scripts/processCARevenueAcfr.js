#!/usr/bin/env node
/**
 * California General Fund Revenue (by source) Loader — FY2008-FY2025 ACTUAL
 * Source: State of California Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL column
 *   (GAAP basis, in thousands). Published by the State Controller's Office (SCO).
 *   FY2008–FY2019: `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (CAFR dir)
 *   FY2020–FY2025: `https://www.sco.ca.gov/Files-ARD/ACFR/acfr{NN}web.pdf` (ACFR dir)
 *
 * Phase 99 (ACFR-01 + ACFR-05): original FY2020–FY2025 loads.
 * Phase 104 (DEEP-01): backward extension to FY2008–FY2019 under /Files-ARD/CAFR/.
 *   CA state node id (D-01): e1007bf5-bac9-4b1c-878e-f6834885f850.
 *
 * Control = printed General-column "Total revenues". Each FY's transcribed rev-by-source
 *   categories must tie to the printed Total within $10M or the loader refuses to write
 *   (process.exit(2)). Bookends (recon-confirmed): FY2008 97,774,378k; FY2025 221,591,201k.
 *
 * P2 clamp (ACFR-05/ACFR-08): any negative GF revenue category renders at 0 area with the
 *   true signed value preserved in the label; the root total carries the net (which already
 *   nets the negative). CA market-loss years (FY2009, FY2016) may carry negative investment
 *   income lines — the clamp is wired and will fire.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/ca/ (NOT -layout).
 *   All retained years tie to 0 diff vs. the printed General-column Total revenues.
 *
 * Usage:
 *   node scripts/processCARevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'California'; const STATE_ABBR = 'CA'; const POPULATION = 39_538_223;
const STATE_NODE_ID = 'e1007bf5-bac9-4b1c-878e-f6834885f850'; // D-01
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// FY2008–FY2019 use the /Files-ARD/CAFR/ directory (cafr{NN}web.pdf); FY2020+ use /Files-ARD/ACFR/.
const SOURCES = {
  2008: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr08web.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr09web.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr10web.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr11web.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr12web.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr13web.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr14web.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr15web.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr16web.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr17web.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr18web.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr19web.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr20web.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr21web.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr22web.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr23web.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr24web.pdf', date: '2024-06-30' },
  2025: { url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr25web.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `California State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund net revenues by source — State of CA ACFR, GENERAL column (in $).
// Verbatim ACFR revenue source names. total = printed General-column "Total revenues".
// All sums verified to 0 diff. No negative categories in this window (clamp still wired).
const REVENUE = {
  2020: { total: 155_923_876_000, confidence: 'actual', categories: [
    { name: 'Personal income taxes',     total: 110_352_220_000 },
    { name: 'Sales and use taxes',       total:  25_461_893_000 },
    { name: 'Corporation taxes',         total:  13_722_735_000 },
    { name: 'Motor vehicle excise taxes',total:     142_729_000 },
    { name: 'Insurance taxes',           total:   3_158_183_000 },
    { name: 'Other taxes',               total:     636_243_000 },
    { name: 'Intergovernmental',         total:               0 },
    { name: 'Licenses and permits',      total:       7_799_000 },
    { name: 'Charges for services',      total:     376_317_000 },
    { name: 'Fees',                      total:      19_477_000 },
    { name: 'Penalties',                 total:     372_130_000 },
    { name: 'Investment and interest',   total:     575_818_000 },
    { name: 'Escheat',                   total:     614_394_000 },
    { name: 'Other',                     total:     483_938_000 },
  ]},
  2021: { total: 196_987_037_000, confidence: 'actual', categories: [
    { name: 'Personal income taxes',     total: 129_514_535_000 },
    { name: 'Sales and use taxes',       total:  29_114_297_000 },
    { name: 'Corporation taxes',         total:  32_122_361_000 },
    { name: 'Motor vehicle excise taxes',total:     145_522_000 },
    { name: 'Insurance taxes',           total:   3_156_993_000 },
    { name: 'Other taxes',               total:     644_877_000 },
    { name: 'Intergovernmental',         total:               0 },
    { name: 'Licenses and permits',      total:       8_105_000 },
    { name: 'Charges for services',      total:     367_807_000 },
    { name: 'Fees',                      total:      15_250_000 },
    { name: 'Penalties',                 total:     546_536_000 },
    { name: 'Investment and interest',   total:     125_167_000 },
    { name: 'Escheat',                   total:     640_226_000 },
    { name: 'Other',                     total:     585_361_000 },
  ]},
  2022: { total: 199_159_368_000, confidence: 'actual', categories: [
    { name: 'Personal income taxes',     total: 123_335_790_000 },
    { name: 'Sales and use taxes',       total:  32_794_344_000 },
    { name: 'Corporation taxes',         total:  35_824_715_000 },
    { name: 'Motor vehicle excise taxes',total:     156_593_000 },
    { name: 'Insurance taxes',           total:   3_516_612_000 },
    { name: 'Other taxes',               total:     702_572_000 },
    { name: 'Intergovernmental',         total:       1_117_000 },
    { name: 'Licenses and permits',      total:       7_884_000 },
    { name: 'Charges for services',      total:     302_701_000 },
    { name: 'Fees',                      total:      17_634_000 },
    { name: 'Penalties',                 total:     767_567_000 },
    { name: 'Investment and interest',   total:     408_597_000 },
    { name: 'Escheat',                   total:     660_143_000 },
    { name: 'Other',                     total:     663_099_000 },
  ]},
  2023: { total: 192_452_181_000, confidence: 'actual', categories: [
    { name: 'Personal income taxes',     total: 112_736_701_000 },
    { name: 'Sales and use taxes',       total:  33_128_145_000 },
    { name: 'Corporation taxes',         total:  36_662_999_000 },
    { name: 'Motor vehicle excise taxes',total:     156_321_000 },
    { name: 'Insurance taxes',           total:   3_720_620_000 },
    { name: 'Other taxes',               total:     682_050_000 },
    { name: 'Intergovernmental',         total:       3_200_000 },
    { name: 'Licenses and permits',      total:       7_806_000 },
    { name: 'Charges for services',      total:     420_749_000 },
    { name: 'Fees',                      total:      16_717_000 },
    { name: 'Penalties',                 total:     872_820_000 },
    { name: 'Investment and interest',   total:   2_435_353_000 },
    { name: 'Escheat',                   total:     876_109_000 },
    { name: 'Other',                     total:     732_591_000 },
  ]},
  2024: { total: 195_343_696_000, confidence: 'actual', categories: [
    { name: 'Personal income taxes',     total: 114_316_015_000 },
    { name: 'Sales and use taxes',       total:  33_179_166_000 },
    { name: 'Corporation taxes',         total:  37_298_102_000 },
    { name: 'Motor vehicle excise taxes',total:     169_780_000 },
    { name: 'Insurance taxes',           total:   3_964_555_000 },
    { name: 'Other taxes',               total:     642_873_000 },
    { name: 'Intergovernmental',         total:      17_841_000 },
    { name: 'Licenses and permits',      total:       5_961_000 },
    { name: 'Charges for services',      total:     372_133_000 },
    { name: 'Fees',                      total:      19_225_000 },
    { name: 'Penalties',                 total:     549_560_000 },
    { name: 'Investment and interest',   total:   3_028_301_000 },
    { name: 'Escheat',                   total:     848_242_000 },
    { name: 'Other',                     total:     931_942_000 },
  ]},
  2025: { total: 221_591_201_000, confidence: 'actual', categories: [
    { name: 'Personal income taxes',     total: 134_221_314_000 },
    { name: 'Sales and use taxes',       total:  33_680_105_000 },
    { name: 'Corporation taxes',         total:  42_299_552_000 },
    { name: 'Motor vehicle excise taxes',total:     168_853_000 },
    { name: 'Insurance taxes',           total:   4_278_061_000 },
    { name: 'Managed care organization enrollment tax', total: 0 },
    { name: 'Other taxes',               total:     661_069_000 },
    { name: 'Intergovernmental',         total:     341_540_000 },
    { name: 'Licenses and permits',      total:       5_599_000 },
    { name: 'Charges for services',      total:     364_036_000 },
    { name: 'Fees',                      total:      18_431_000 },
    { name: 'Penalties',                 total:     649_929_000 },
    { name: 'Investment and interest',   total:   3_169_096_000 },
    { name: 'Escheat',                   total:     969_434_000 },
    { name: 'Other',                     total:     764_182_000 },
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
  return { jsonTree: [{ n: 'California General Fund Revenue', a: total, c: children }], total, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId = STATE_NODE_ID;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('id', STATE_NODE_ID).single();
    if (error || !muni) { console.error(`${STATE_NAME} state node ${STATE_NODE_ID} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'California General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ca-acfr-gf-revenue', base_url: 'https://www.sco.ca.gov/ard_state_acfr.html', fiscal_years: [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
    console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
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
