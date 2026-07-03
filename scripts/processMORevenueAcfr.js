#!/usr/bin/env node
/**
 * Missouri General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Missouri Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the MO state node → pure insert keyed (muni,fy,'revenue').
 *   MO state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): MO ACFR GF ~2.25× NASBO GF — "Contributions and Intergovernmental"
 *   (federal passthrough, $18,773,418K FY2024) is consolidated into the GAAP GF, excluded from
 *   NASBO's budgetary concept. Accepted-and-relabelled honestly (TX precedent).
 *
 * URL NOTE: per-year node pages acct.oa.mo.gov/media/report/...june-30-{YYYY} resolve to
 *   non-derivable PDF filenames (scraped from each node page's data-src embed).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Net Increase (Decrease) in the Fair Value of Investments" CAN go negative (was negative in the FY2024 Road Fund column) — clamp is the render path if a GF year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/mo/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMORevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Missouri'; const STATE_ABBR = 'MO'; const POPULATION = 6_154_913;
const EXPECTED_MUNI_ID = '21892bb7-1a1d-4038-8665-51c256ab5875';
const UNITS = 1_000; // MO ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2012: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302012.pdf', date: '2012-06-30' },
  2013: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302013.pdf', date: '2013-06-30' },
  2014: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302014.pdf', date: '2014-06-30' },
  2015: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302015.pdf', date: '2015-06-30' },
  2016: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302016.pdf', date: '2016-06-30' },
  2017: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302017.pdf', date: '2017-06-30' },
  2018: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302018.pdf', date: '2018-06-30' },
  2019: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302019.pdf', date: '2019-06-30' },
  2020: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302020.pdf', date: '2020-06-30' },
  2021: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302021.pdf', date: '2021-06-30' },
  2022: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2023-03/ACFR_2022_Final.pdf', date: '2022-06-30' },
  2023: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2024-03/2023%20ACFR.pdf', date: '2023-06-30' },
  2024: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2025-04/2024%20ACFR%20-%20Final%20for%20Internet.pdf', date: '2024-06-30' },
  2025: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2026-02/2025%20ACFR%20Final.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Missouri State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — MO ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2012: { total: 18_068_155, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    7_440_009 },
    { name: 'Licenses, Fees, and Permits',                              total:       86_851 },
    { name: 'Sales',                                                    total:          532 },
    { name: 'Leases and Rentals',                                       total:           42 },
    { name: 'Services',                                                 total:      118_919 },
    { name: 'Intergovernmental',                                        total:    9_873_837 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:        5_109 },
    { name: 'Interest',                                                 total:       14_956 },
    { name: 'Penalties and Unclaimed Properties',                       total:       42_193 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      485_707 },
  ]},
  2013: { total: 18_185_825, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    8_080_658 },
    { name: 'Licenses, Fees, and Permits',                              total:       85_759 },
    { name: 'Sales',                                                    total:        1_316 },
    { name: 'Leases and Rentals',                                       total:           12 },
    { name: 'Services',                                                 total:      114_733 },
    { name: 'Intergovernmental',                                        total:    9_416_472 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:      -11_518 },
    { name: 'Interest',                                                 total:       13_896 },
    { name: 'Penalties and Unclaimed Properties',                       total:       97_914 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      386_583 },
  ]},
  2014: { total: 17_903_912, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    8_012_838 },
    { name: 'Licenses, Fees, and Permits',                              total:       89_537 },
    { name: 'Sales',                                                    total:          801 },
    { name: 'Leases and Rentals',                                       total:           34 },
    { name: 'Services',                                                 total:      110_526 },
    { name: 'Intergovernmental',                                        total:    9_333_214 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:        9_282 },
    { name: 'Interest',                                                 total:       12_885 },
    { name: 'Penalties and Unclaimed Properties',                       total:       63_661 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      271_134 },
  ]},
  2015: { total: 18_941_593, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    8_655_638 },
    { name: 'Licenses, Fees, and Permits',                              total:       92_710 },
    { name: 'Sales',                                                    total:        1_878 },
    { name: 'Leases and Rentals',                                       total:           38 },
    { name: 'Services',                                                 total:      104_026 },
    { name: 'Intergovernmental',                                        total:    9_650_495 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:          877 },
    { name: 'Interest',                                                 total:       10_882 },
    { name: 'Penalties and Unclaimed Properties',                       total:       95_048 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      330_001 },
  ]},
  2016: { total: 19_239_061, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    8_798_146 },
    { name: 'Licenses, Fees, and Permits',                              total:       90_932 },
    { name: 'Sales',                                                    total:          490 },
    { name: 'Leases and Rentals',                                       total:           18 },
    { name: 'Services',                                                 total:      115_060 },
    { name: 'Intergovernmental',                                        total:    9_883_791 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:        2_377 },
    { name: 'Interest',                                                 total:       11_836 },
    { name: 'Penalties and Unclaimed Properties',                       total:       62_207 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      274_204 },
  ]},
  2017: { total: 19_801_137, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    9_084_735 },
    { name: 'Licenses, Fees, and Permits',                              total:       91_142 },
    { name: 'Sales',                                                    total:          496 },
    { name: 'Leases and Rentals',                                       total:           23 },
    { name: 'Services',                                                 total:      121_670 },
    { name: 'Contributions and Intergovernmental',                      total:   10_090_297 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:       -3_250 },
    { name: 'Interest',                                                 total:       14_397 },
    { name: 'Penalties and Unclaimed Properties',                       total:       83_824 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      317_803 },
  ]},
  2018: { total: 20_213_937, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    9_333_308 },
    { name: 'Licenses, Fees, and Permits',                              total:       92_915 },
    { name: 'Sales',                                                    total:          531 },
    { name: 'Leases and Rentals',                                       total:           12 },
    { name: 'Services',                                                 total:      147_851 },
    { name: 'Contributions and Intergovernmental',                      total:   10_259_288 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:       -2_981 },
    { name: 'Interest',                                                 total:       23_358 },
    { name: 'Penalties and Unclaimed Properties',                       total:       54_888 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      304_767 },
  ]},
  2019: { total: 20_761_089, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    9_667_614 },
    { name: 'Licenses, Fees, and Permits',                              total:       95_606 },
    { name: 'Sales',                                                    total:          486 },
    { name: 'Leases and Rentals',                                       total:           11 },
    { name: 'Services',                                                 total:      120_150 },
    { name: 'Contributions and Intergovernmental',                      total:   10_476_465 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:        7_339 },
    { name: 'Interest',                                                 total:       37_913 },
    { name: 'Penalties and Unclaimed Properties',                       total:       71_761 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      283_744 },
  ]},
  2020: { total: 21_931_368, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:    9_433_118 },
    { name: 'Licenses, Fees, and Permits',                              total:       95_059 },
    { name: 'Sales',                                                    total:          470 },
    { name: 'Services',                                                 total:      121_087 },
    { name: 'Contributions and Intergovernmental',                      total:   11_788_584 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:        6_675 },
    { name: 'Interest',                                                 total:       42_732 },
    { name: 'Penalties and Unclaimed Properties',                       total:       62_962 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      380_681 },
  ]},
  2021: { total: 27_260_093, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:   10_866_236 },
    { name: 'Licenses, Fees, and Permits',                              total:      101_199 },
    { name: 'Sales',                                                    total:        2_538 },
    { name: 'Leases and Rentals',                                       total:           13 },
    { name: 'Services',                                                 total:      128_936 },
    { name: 'Contributions and Intergovernmental',                      total:   15_708_889 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:       -7_566 },
    { name: 'Interest',                                                 total:       22_646 },
    { name: 'Penalties and Unclaimed Properties',                       total:       63_055 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      374_147 },
  ]},
  2022: { total: 29_984_198, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:   12_981_480 },
    { name: 'Licenses, Fees, and Permits',                              total:      110_203 },
    { name: 'Sales',                                                    total:        3_107 },
    { name: 'Leases and Rentals',                                       total:            9 },
    { name: 'Services',                                                 total:      134_173 },
    { name: 'Contributions and Intergovernmental',                      total:   16_632_319 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:     -309_337 },
    { name: 'Interest',                                                 total:       40_786 },
    { name: 'Penalties and Unclaimed Properties',                       total:       67_632 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      323_826 },
  ]},
  2023: { total: 32_948_695, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:   13_099_893 },
    { name: 'Licenses, Fees, and Permits',                              total:      125_648 },
    { name: 'Sales',                                                    total:        2_551 },
    { name: 'Services',                                                 total:      169_619 },
    { name: 'Contributions and Intergovernmental',                      total:   19_110_137 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:     -187_845 },
    { name: 'Interest',                                                 total:      296_768 },
    { name: 'Penalties and Unclaimed Properties',                       total:      114_378 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      217_546 },
  ]},
  2024: { total: 32_756_386, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:   12_663_352 },
    { name: 'Licenses, Fees, and Permits',                              total:      108_421 },
    { name: 'Sales',                                                    total:        4_235 },
    { name: 'Leases and Rentals',                                       total:            5 },
    { name: 'Services',                                                 total:      221_181 },
    { name: 'Contributions and Intergovernmental',                      total:   18_773_418 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:      204_127 },
    { name: 'Interest',                                                 total:      452_434 },
    { name: 'Penalties and Unclaimed Properties',                       total:       85_449 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      243_764 },
  ]},
  2025: { total: 32_960_973, confidence: 'actual', categories: [
    { name: 'Taxes',                                                    total:   13_007_623 },
    { name: 'Licenses, Fees, and Permits',                              total:      120_837 },
    { name: 'Sales',                                                    total:        4_667 },
    { name: 'Leases and Rentals',                                       total:           10 },
    { name: 'Services',                                                 total:      255_297 },
    { name: 'Contributions and Intergovernmental',                      total:   18_569_050 },
    { name: 'Net Increase (Decrease) in the Fair Value of Investments', total:      242_090 },
    { name: 'Interest',                                                 total:      448_115 },
    { name: 'Penalties and Unclaimed Properties',                       total:       95_776 },
    { name: 'Cost Reimbursement/Miscellaneous',                         total:      217_508 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Missouri General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    if (muni.id !== EXPECTED_MUNI_ID) { console.error(`Resolved node ${muni.id} ≠ expected ${EXPECTED_MUNI_ID} — refusing to write`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Missouri General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'mo-acfr-gf-revenue', base_url: 'https://oa.mo.gov/accounting/reports/annual-reports/annual-comprehensive-financial-reports', fiscal_years: [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL REVENUES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
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
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
