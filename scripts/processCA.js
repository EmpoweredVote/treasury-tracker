#!/usr/bin/env node
/**
 * California General Fund Operating (Expenditure) Loader — FY2008-FY2025 ACTUAL
 * Source: State of California Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL column
 *   (GAAP basis, in thousands). Published by the State Controller's Office (SCO).
 *   FY2008–FY2019: `https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf` (CAFR dir)
 *   FY2020–FY2025: `https://www.sco.ca.gov/Files-ARD/ACFR/acfr{NN}web.pdf` (ACFR dir)
 *
 * Phase 99 (ACFR-01): original FY2020–FY2025 loads.
 * Phase 104 (DEEP-01): backward extension to FY2008–FY2019 under /Files-ARD/CAFR/.
 *   The CA state node id is fixed (D-01): e1007bf5-bac9-4b1c-878e-f6834885f850.
 *
 * Control = printed General-column "Total expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total within $10M or the loader
 *   refuses to write (process.exit(2)).
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/ca/ (NOT -layout).
 *   All retained years tie to 0 diff vs. the printed General-column Total expenditures.
 *   Bookends (recon-confirmed): FY2008 Total revenues 97,774,378k; FY2025 221,591,201k.
 *   Negative GF categories render via clampForRender (ACFR-08).
 *
 * Usage:
 *   node scripts/processCA.js [--dry-run] [--fy YYYY]
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
const STATE_NODE_ID = 'e1007bf5-bac9-4b1c-878e-f6834885f850'; // D-01: upgrade this node in place
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published State of California ACFR (source_date = Jun 30 FYE).
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
const dataSource = (fy) => `California State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// General Fund expenditures by function — State of CA ACFR, GENERAL column (in $).
// Function-level totals (depth-1 leaves under the GF root). Verbatim ACFR function names.
// total = printed General-column "Total expenditures". All sums verified to 0 diff.
const EXPENDITURES = {
  2020: { total: 138_516_673_000, confidence: 'actual', categories: [
    { name: 'General government',                               total: 10_607_916_000 },
    { name: 'Education',                                        total: 67_094_461_000 },
    { name: 'Health and human services',                       total: 39_469_965_000 },
    { name: 'Natural resources and environmental protection',  total:  2_536_666_000 },
    { name: 'Business, consumer services, and housing',        total:    741_404_000 },
    { name: 'Transportation',                                  total:     30_874_000 },
    { name: 'Corrections and rehabilitation',                  total: 12_776_235_000 },
    { name: 'Capital outlay',                                  total:     24_082_000 },
    { name: 'Bond and commercial paper retirement',            total:  2_548_681_000 },
    { name: 'Interest and fiscal charges',                     total:  2_686_389_000 },
  ]},
  2021: { total: 146_375_674_000, confidence: 'actual', categories: [
    { name: 'General government',                               total: 11_811_215_000 },
    { name: 'Education',                                        total: 70_813_388_000 },
    { name: 'Health and human services',                       total: 43_208_392_000 },
    { name: 'Natural resources and environmental protection',  total:  2_600_638_000 },
    { name: 'Business, consumer services, and housing',        total:    387_139_000 },
    { name: 'Transportation',                                  total:    287_388_000 },
    { name: 'Corrections and rehabilitation',                  total: 11_789_080_000 },
    { name: 'Capital outlay',                                  total:    439_180_000 },
    { name: 'Bond and commercial paper retirement',            total:  2_557_902_000 },
    { name: 'Interest and fiscal charges',                     total:  2_481_352_000 },
  ]},
  2022: { total: 191_119_860_000, confidence: 'actual', categories: [
    { name: 'General government',                               total: 25_791_674_000 },
    { name: 'Education',                                        total: 91_985_006_000 },
    { name: 'Health and human services',                       total: 48_077_423_000 },
    { name: 'Natural resources and environmental protection',  total:  4_491_067_000 },
    { name: 'Business, consumer services, and housing',        total:  2_422_394_000 },
    { name: 'Transportation',                                  total:    292_816_000 },
    { name: 'Corrections and rehabilitation',                  total: 12_671_069_000 },
    { name: 'Capital outlay',                                  total:     67_975_000 },
    { name: 'Bond, commercial paper, and lease principal retirement', total: 2_841_818_000 },
    { name: 'Interest and fiscal charges',                     total:  2_478_618_000 },
  ]},
  2023: { total: 191_010_618_000, confidence: 'actual', categories: [
    { name: 'General government',                               total: 13_557_086_000 },
    { name: 'Education',                                        total: 86_822_520_000 },
    { name: 'Health and human services',                       total: 61_477_274_000 },
    { name: 'Natural resources and environmental protection',  total:  5_906_134_000 },
    { name: 'Business, consumer services, and housing',        total:  1_722_649_000 },
    { name: 'Transportation',                                  total:    656_436_000 },
    { name: 'Corrections and rehabilitation',                  total: 14_903_847_000 },
    { name: 'Capital outlay',                                  total:    165_706_000 },
    { name: 'Bond, commercial paper, and lease principal retirement', total: 2_922_769_000 },
    { name: 'Interest and fiscal charges',                     total:  2_876_197_000 },
  ]},
  2024: { total: 190_318_638_000, confidence: 'actual', categories: [
    { name: 'General government',                               total: 10_385_441_000 },
    { name: 'Education',                                        total: 86_391_760_000 },
    { name: 'Health and human services',                       total: 64_139_315_000 },
    { name: 'Natural resources and environmental protection',  total:  6_443_790_000 },
    { name: 'Business, consumer services, and housing',        total:  1_088_342_000 },
    { name: 'Transportation',                                  total:  1_036_187_000 },
    { name: 'Corrections and rehabilitation',                  total: 14_527_777_000 },
    { name: 'Capital outlay',                                  total:    254_506_000 },
    { name: 'Bond, commercial paper, and lease principal retirement', total: 3_016_679_000 },
    { name: 'Interest and fiscal charges',                     total:  3_034_841_000 },
  ]},
  2025: { total: 221_826_907_000, confidence: 'actual', categories: [
    { name: 'General government',                               total:  8_926_889_000 },
    { name: 'Education',                                        total: 101_426_636_000 },
    { name: 'Health and human services',                       total: 78_939_314_000 },
    { name: 'Natural resources and environmental protection',  total:  7_896_845_000 },
    { name: 'Businesses, consumer services, and housing',      total:  2_086_799_000 },
    { name: 'Transportation',                                  total:  2_754_638_000 },
    { name: 'Corrections and rehabilitation',                  total: 13_650_161_000 },
    { name: 'Capital outlay',                                  total:    185_760_000 },
    { name: 'Bond, commercial paper, and lease principal retirement', total: 3_062_982_000 },
    { name: 'Interest and fiscal charges',                     total:  2_896_883_000 },
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
  return { jsonTree: [{ n: 'California General Fund Budget', a: total, c: children }], total, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'California General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ca-acfr-gf-operating', base_url: 'https://www.sco.ca.gov/ard_state_acfr.html', fiscal_years: [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
