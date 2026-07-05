#!/usr/bin/env node
/**
 * Florida General Fund Revenue (by source) Loader — FY2021-FY2024 ACTUAL
 * Source: State of Florida Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Florida Dept. of Financial Services (DFS).
 *
 * Phase 100 (ACFR-04 + ACFR-05). Revenue is NEW on the FL state node (NASBO had no
 *   revenue-by-source) → pure insert keyed (muni,fy,'revenue'). FL state node id (D-05):
 *   adb19ea0-de7c-4cd5-9445-cbf2108a8a1a.
 *
 * UNITS = thousands (D-06): ×1,000 to store dollars.
 *
 * Control = printed General-Fund-column "Total revenues". Each FY's transcribed rev-by-source
 *   categories must tie to the printed Total (thousands) or the loader refuses to write
 *   (process.exit(2)). Bookends (recon-confirmed): FY2021 46,989,188k; FY2022 57,241,428k;
 *   FY2024 59,810,603k.
 *
 * P2 clamp (ACFR-05 / ACFR-08): FL FY2022 has TWO negative GF revenue categories —
 *   "Investment earnings (losses)" −1,573,844k and "Other" −56,189k. FL FY2021 has ONE —
 *   "Investment earnings (losses)" −398,287k. Each renders at 0 area with the true signed
 *   value preserved in the label; the FY total carries the net (which already nets the
 *   negatives). FY2021 is the Phase 104 clamp demonstration (ACFR-08).
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/fl/ (NOT -layout). The
 *   GENERAL FUND value is the 1st numeric token per row. All 4 years tie to 0 diff.
 *
 * Usage:
 *   node scripts/processFLRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Florida'; const STATE_ABBR = 'FL'; const POPULATION = 21_538_187;
const STATE_NODE_ID = 'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a'; // D-05
const UNITS = 1_000; // thousands → dollars (D-06)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const FL_BASE = 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr';
// Phase 122 (DEEP-05): explicit per-year filename map FY2003–FY2020. Convention alternates
// cafr{YYYY}.pdf ↔ {YYYY}cafr.pdf with NO single rule (flips at FY2013 and FY2018) — each
// filename curl-confirmed application/pdf. FY2000–FY2002 durable URLs exist but pdftotext
// fails on damaged xref (repair-pending hole, not loaded). FY2021+ keep the fye-… formula.
const SOURCES = {
  2003: { url: `${FL_BASE}/cafr2003.pdf`, date: '2003-06-30' },
  2004: { url: `${FL_BASE}/cafr2004.pdf`, date: '2004-06-30' },
  2005: { url: `${FL_BASE}/cafr2005.pdf`, date: '2005-06-30' },
  2006: { url: `${FL_BASE}/cafr2006.pdf`, date: '2006-06-30' },
  2007: { url: `${FL_BASE}/cafr2007.pdf`, date: '2007-06-30' },
  2008: { url: `${FL_BASE}/cafr2008.pdf`, date: '2008-06-30' },
  2009: { url: `${FL_BASE}/cafr2009.pdf`, date: '2009-06-30' },
  2010: { url: `${FL_BASE}/cafr2010.pdf`, date: '2010-06-30' },
  2011: { url: `${FL_BASE}/cafr2011.pdf`, date: '2011-06-30' },
  2012: { url: `${FL_BASE}/cafr2012.pdf`, date: '2012-06-30' },
  2013: { url: `${FL_BASE}/2013cafr.pdf`, date: '2013-06-30' },
  2014: { url: `${FL_BASE}/2014cafr.pdf`, date: '2014-06-30' },
  2015: { url: `${FL_BASE}/2015cafr.pdf`, date: '2015-06-30' },
  2016: { url: `${FL_BASE}/2016cafr.pdf`, date: '2016-06-30' },
  2017: { url: `${FL_BASE}/2017cafr.pdf`, date: '2017-06-30' },
  2018: { url: `${FL_BASE}/cafr2018.pdf`, date: '2018-06-30' },
  2019: { url: `${FL_BASE}/cafr2019.pdf`, date: '2019-06-30' },
  2020: { url: `${FL_BASE}/2020cafr.pdf`, date: '2020-06-30' },
  ...Object.fromEntries(
    [2021, 2022, 2023, 2024].map(fy => [fy, { url: `${FL_BASE}/fye-${fy}-state-of-florida-annual-comprehensive-financial-report.pdf`, date: `${fy}-06-30` }])
  ),
};
const dataSource = (fy) => `Florida State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF net revenues by source — FL ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim ACFR source names. total = printed General-Fund "Total revenues". 0-diff verified.
// FY2021 has negative "Investment earnings (losses)" → P2 clamp fires (ACFR-08, Phase 104).
// FY2022 has negative "Investment earnings (losses)" + "Other" → P2 clamp fires (ACFR-05).
const REVENUE = {
  // Phase 122 (DEEP-05): FY2003–FY2020 GENERAL FUND column, raw thousands. FY2004 (-78,773) + FY2009 (-374,931) Investment earnings negative → P2 clamp fires. All tie $0.
  2003: { total: 19857818, confidence: 'actual', categories: [
    { name: 'Taxes', total: 18801456 },
    { name: 'Licenses and permits', total: 94847 },
    { name: 'Fees and charges', total: 386627 },
    { name: 'Grants and donations', total: 10342 },
    { name: 'Investment earnings', total: 537369 },
    { name: 'Fines, forfeits, settlements and judgments', total: 26509 },
    { name: 'Other revenue', total: 668 },
  ]},
  2004: { total: 21829932, confidence: 'actual', categories: [
    { name: 'Taxes', total: 20515750 },
    { name: 'Licenses and permits', total: 68918 },
    { name: 'Fees and charges', total: 587550 },
    { name: 'Grants and donations', total: 554769 },
    { name: 'Investment earnings', total: -78773 },
    { name: 'Fines, forfeits, settlements and judgments', total: 60419 },
    { name: 'Other revenue', total: 121299 },
  ]},
  2005: { total: 25171792, confidence: 'actual', categories: [
    { name: 'Taxes', total: 23779262 },
    { name: 'Licenses and permits', total: 93559 },
    { name: 'Fees and charges', total: 698288 },
    { name: 'Grants and donations', total: 16100 },
    { name: 'Investment earnings', total: 302350 },
    { name: 'Fines, forfeits, settlements and judgments', total: 64360 },
    { name: 'Other revenue', total: 217873 },
  ]},
  2006: { total: 32233584, confidence: 'actual', categories: [
    { name: 'Taxes', total: 31209623 },
    { name: 'Licenses and permits', total: 126645 },
    { name: 'Fees and charges', total: 714445 },
    { name: 'Grants and donations', total: 15674 },
    { name: 'Investment earnings', total: 96793 },
    { name: 'Fines, forfeits, settlements and judgments', total: 64457 },
    { name: 'Other revenue', total: 5947 },
  ]},
  2007: { total: 31546749, confidence: 'actual', categories: [
    { name: 'Taxes', total: 30028527 },
    { name: 'Licenses and permits', total: 122219 },
    { name: 'Fees and charges', total: 738522 },
    { name: 'Grants and donations', total: 3705 },
    { name: 'Investment earnings', total: 582196 },
    { name: 'Fines, forfeits, settlements and judgments', total: 68293 },
    { name: 'Other revenue', total: 3287 },
  ]},
  2008: { total: 28595132, confidence: 'actual', categories: [
    { name: 'Taxes', total: 27175236 },
    { name: 'Licenses and permits', total: 131453 },
    { name: 'Fees and charges', total: 723174 },
    { name: 'Grants and donations', total: 6129 },
    { name: 'Investment earnings', total: 478953 },
    { name: 'Fines, forfeits, settlements and judgments', total: 72351 },
    { name: 'Other revenue', total: 7836 },
  ]},
  2009: { total: 24105954, confidence: 'actual', categories: [
    { name: 'Taxes', total: 23368397 },
    { name: 'Licenses and permits', total: 129920 },
    { name: 'Fees and charges', total: 916385 },
    { name: 'Grants and donations', total: 9834 },
    { name: 'Investment earnings', total: -374931 },
    { name: 'Fines, forfeits, settlements and judgments', total: 54651 },
    { name: 'Other', total: 1698 },
  ]},
  2010: { total: 25978531, confidence: 'actual', categories: [
    { name: 'Taxes', total: 23803370 },
    { name: 'Licenses and permits', total: 266192 },
    { name: 'Fees and charges', total: 1439692 },
    { name: 'Grants and donations', total: 14111 },
    { name: 'Investment earnings', total: 402174 },
    { name: 'Fines, forfeits, settlements and judgments', total: 45644 },
    { name: 'Other', total: 7348 },
  ]},
  2011: { total: 27288574, confidence: 'actual', categories: [
    { name: 'Taxes', total: 24740356 },
    { name: 'Licenses and permits', total: 402885 },
    { name: 'Fees and charges', total: 1777793 },
    { name: 'Grants and donations', total: 10755 },
    { name: 'Investment earnings', total: 281800 },
    { name: 'Fines, forfeits, settlements and judgments', total: 72247 },
    { name: 'Other', total: 2738 },
  ]},
  2012: { total: 28554204, confidence: 'actual', categories: [
    { name: 'Taxes', total: 25861116 },
    { name: 'Licenses and permits', total: 437256 },
    { name: 'Fees and charges', total: 1882851 },
    { name: 'Grants and donations', total: 17078 },
    { name: 'Investment earnings', total: 197392 },
    { name: 'Fines, forfeits, settlements and judgments', total: 152443 },
    { name: 'Other', total: 6068 },
  ]},
  2013: { total: 30304288, confidence: 'actual', categories: [
    { name: 'Taxes', total: 27442050 },
    { name: 'Licenses and permits', total: 503175 },
    { name: 'Fees and charges', total: 1903996 },
    { name: 'Grants and donations', total: 20344 },
    { name: 'Investment earnings (losses)', total: 58668 },
    { name: 'Fines, forfeits, settlements and judgments', total: 374141 },
    { name: 'Other', total: 1914 },
  ]},
  2014: { total: 31577252, confidence: 'actual', categories: [
    { name: 'Taxes', total: 28823083 },
    { name: 'Licenses and permits', total: 510440 },
    { name: 'Fees and charges', total: 1822909 },
    { name: 'Grants and donations', total: 21212 },
    { name: 'Investment earnings (losses)', total: 268083 },
    { name: 'Fines, forfeits, settlements and judgments', total: 128019 },
    { name: 'Other', total: 3506 },
  ]},
  2015: { total: 33317827, confidence: 'actual', categories: [
    { name: 'Taxes', total: 31056529 },
    { name: 'Licenses and permits', total: 457344 },
    { name: 'Fees and charges', total: 1615609 },
    { name: 'Grants and donations', total: 20001 },
    { name: 'Investment earnings (losses)', total: 67275 },
    { name: 'Fines, forfeits, settlements and judgments', total: 98289 },
    { name: 'Other', total: 2780 },
  ]},
  2016: { total: 34525423, confidence: 'actual', categories: [
    { name: 'Taxes', total: 32239393 },
    { name: 'Licenses and permits', total: 446439 },
    { name: 'Fees and charges', total: 1487836 },
    { name: 'Grants and donations', total: 16326 },
    { name: 'Investment earnings (losses)', total: 237504 },
    { name: 'Fines, forfeits, settlements and judgments', total: 92484 },
    { name: 'Other', total: 5441 },
  ]},
  2017: { total: 36178507, confidence: 'actual', categories: [
    { name: 'Taxes', total: 33551201 },
    { name: 'Licenses and permits', total: 508292 },
    { name: 'Fees and charges', total: 1535964 },
    { name: 'Grants and donations', total: 22415 },
    { name: 'Investment earnings (losses)', total: 24528 },
    { name: 'Fines, forfeits, settlements and judgments', total: 532709 },
    { name: 'Other', total: 3398 },
  ]},
  2018: { total: 37715324, confidence: 'actual', categories: [
    { name: 'Taxes', total: 35282816 },
    { name: 'Licenses and permits', total: 606216 },
    { name: 'Fees and charges', total: 1540934 },
    { name: 'Grants and donations', total: 22777 },
    { name: 'Investment earnings (losses)', total: 163510 },
    { name: 'Fines, forfeits, settlements and judgments', total: 89605 },
    { name: 'Other', total: 9466 },
  ]},
  2019: { total: 40405714, confidence: 'actual', categories: [
    { name: 'Taxes', total: 37333820 },
    { name: 'Licenses and permits', total: 532363 },
    { name: 'Fees and charges', total: 1597796 },
    { name: 'Grants and donations', total: 17740 },
    { name: 'Investment earnings (losses)', total: 536802 },
    { name: 'Fines, forfeits, settlements and judgments', total: 342050 },
    { name: 'Other', total: 45143 },
  ]},
  2020: { total: 40534343, confidence: 'actual', categories: [
    { name: 'Taxes', total: 35915086 },
    { name: 'Licenses and permits', total: 256563 },
    { name: 'Fees and charges', total: 1417351 },
    { name: 'Grants and donations', total: 1873588 },
    { name: 'Investment earnings (losses)', total: 787493 },
    { name: 'Fines, forfeits, settlements and judgments', total: 284197 },
    { name: 'Other', total: 65 },
  ]},
  2021: { total: 46_989_188, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 41_873_817 },
    { name: 'Licenses and permits',                        total:    272_136 },
    { name: 'Fees and charges',                            total:  1_629_633 },
    { name: 'Grants and donations',                        total:  3_068_898 },
    { name: 'Investment earnings (losses)',                total:   -398_287 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    526_221 },
    { name: 'Other',                                       total:     16_770 },
  ]},
  2022: { total: 57_241_428, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 51_757_327 },
    { name: 'Licenses and permits',                        total:    450_317 },
    { name: 'Fees and charges',                            total:  1_690_723 },
    { name: 'Grants and donations',                        total:  4_787_704 },
    { name: 'Investment earnings (losses)',                total: -1_573_844 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    185_390 },
    { name: 'Other',                                       total:    -56_189 },
  ]},
  2023: { total: 59_446_062, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 54_259_527 },
    { name: 'Licenses and permits',                        total:    242_256 },
    { name: 'Fees and charges',                            total:  1_727_882 },
    { name: 'Grants and donations',                        total:  1_563_847 },
    { name: 'Investment earnings (losses)',                total:  1_126_538 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    351_678 },
    { name: 'Other',                                       total:    174_334 },
  ]},
  2024: { total: 59_810_603, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 54_521_794 },
    { name: 'Licenses and permits',                        total:    428_481 },
    { name: 'Fees and charges',                            total:  1_735_524 },
    { name: 'Grants and donations',                        total:     26_448 },
    { name: 'Investment earnings (losses)',                total:  2_551_901 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    431_592 },
    { name: 'Other',                                       total:    114_863 },
  ]},
};

// P2: clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Florida General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Florida General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'fl-acfr-gf-revenue', base_url: 'https://www.myfloridacfo.com/transparency', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total*UNITS).toLocaleString()} (net loss — shown at 0)]`);
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
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
