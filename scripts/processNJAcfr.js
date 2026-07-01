#!/usr/bin/env node
/**
 * New Jersey General Fund Operating (Expenditure) Loader — FY2020-FY2025 ACTUAL
 * Source: State of New Jersey Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis). Published by the NJ Office of Management and Budget (OMB).
 *
 * Phase 108 (ACFR-09 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the
 *   NJ state node in place (same (muni,fy,'operating') RPC key). NJ state node resolved by
 *   name='New Jersey', state='NJ', entity_type='state' (id 91f310a1-bec9-404a-9825-82b1106c911f).
 *
 * ⚠ UNITS = 1 — NJ reports the ACFR in DOLLARS, NOT thousands. This is the ONLY state in the
 *   tranche with this. Do NOT multiply by 1,000. The bookend dollar totals guard it.
 *
 * SOURCES uses EXPLICIT per-year URLs. The recon-recorded pattern had a spurious `/pdfs/` path
 *   segment; the real paths are `publications/{YY}fr/…`. FY2020-FY2024 = `NJFRFY{YYYY}Complete.pdf`;
 *   FY2025 DROPS the "FR" infix → `NJFY2025Complete.pdf` (special-cased). Landing: nj.gov/treasury/omb/fr.shtml
 *   (Deeper history FY2002-FY2019 exists under varying filenames — deferred to a future deepening pass.)
 *
 * TX-TRAP SCOPE NOTE (ACFR-19): NJ ACFR General Fund ~1.15× NASBO GF (smallest divergence in the
 *   tranche) because the GAAP General Fund consolidates federal/intergovernmental revenue that
 *   NASBO's budgetary concept excludes. Accepted-and-relabelled honestly via the GAAP basis label.
 *
 * P2 CLAMP (ACFR-20): NJ investment earnings are positive in every loaded year; clampForRender is
 *   a safety net for any negative category.
 *
 * Control = printed General-Fund-column "Total Expenditures". Each FY's transcribed spend-by-function
 *   categories tie to the printed Total (dollars) or the loader refuses to write (process.exit(2)).
 *   All 6 FYs tie 0 diff. Extraction: pdftotext -table on local PDFs in _acfr-work/nj/ (NOT -layout).
 *
 * Usage: node scripts/processNJAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New Jersey'; const STATE_ABBR = 'NJ'; const POPULATION = 9_288_994;
const UNITS = 1; // ⚠ NJ ACFR is in DOLLARS — do NOT ×1,000.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const NJ_BASE = 'https://www.nj.gov/treasury/omb/publications';
const SOURCES = {
  2020: { url: `${NJ_BASE}/20fr/NJFRFY2020Complete.pdf`, date: '2020-06-30' },
  2021: { url: `${NJ_BASE}/21fr/NJFRFY2021Complete.pdf`, date: '2021-06-30' },
  2022: { url: `${NJ_BASE}/22fr/NJFRFY2022Complete.pdf`, date: '2022-06-30' },
  2023: { url: `${NJ_BASE}/23fr/NJFRFY2023Complete.pdf`, date: '2023-06-30' },
  2024: { url: `${NJ_BASE}/24fr/NJFRFY2024Complete.pdf`, date: '2024-06-30' },
  2025: { url: `${NJ_BASE}/25fr/NJFY2025Complete.pdf`,   date: '2025-06-30' }, // FR infix dropped — special-case
};
const dataSource = (fy) => `New Jersey State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — NJ ACFR, GENERAL FUND column (raw DOLLARS; UNITS=1).
// Verbatim ACFR function names from the Governmental Funds Statement of Rev/Exp/Changes.
// total = printed General-Fund "Total Expenditures" (dollars). All 6 FYs tie 0 diff.
const EXPENDITURES = {
  2020: { total: 36_563_705_440, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 15_701_316_051 },
    { name: 'Economic planning, development, and security',        total:  5_264_516_794 },
    { name: 'Educational, cultural, and intellectual development', total:  4_535_783_310 },
    { name: 'Government direction, management, and control',        total:  4_307_484_964 },
    { name: 'Public safety and criminal justice',                  total:  3_464_684_239 },
    { name: 'Community development and environmental management',  total:  1_655_370_737 },
    { name: 'Transportation programs',                             total:    877_022_170 },
    { name: 'Special government services',                         total:    358_566_836 },
    { name: 'Debt Service — Principal',                            total:    277_025_000 },
    { name: 'Interest',                                            total:     70_365_817 },
    { name: 'Capital Outlay',                                      total:     51_569_522 },
  ]},
  2021: { total: 43_197_990_156, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 17_630_508_473 },
    { name: 'Educational, cultural, and intellectual development', total:  7_708_364_030 },
    { name: 'Economic planning, development, and security',        total:  5_943_704_090 },
    { name: 'Government direction, management, and control',        total:  4_139_526_548 },
    { name: 'Public safety and criminal justice',                  total:  3_832_692_542 },
    { name: 'Community development and environmental management',  total:  2_073_728_408 },
    { name: 'Transportation programs',                             total:    713_835_803 },
    { name: 'Capital Outlay',                                      total:    434_891_333 },
    { name: 'Special government services',                         total:    353_155_158 },
    { name: 'Debt Service — Principal',                            total:    216_585_000 },
    { name: 'Interest',                                            total:    150_998_771 },
  ]},
  2022: { total: 50_311_616_860, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 20_295_300_745 },
    { name: 'Government direction, management, and control',        total:  7_945_467_930 },
    { name: 'Economic planning, development, and security',        total:  7_036_576_357 },
    { name: 'Educational, cultural, and intellectual development', total:  5_718_619_926 },
    { name: 'Public safety and criminal justice',                  total:  4_141_431_417 },
    { name: 'Community development and environmental management',  total:  3_732_087_988 },
    { name: 'Transportation programs',                             total:    643_739_508 },
    { name: 'Special government services',                         total:    409_466_912 },
    { name: 'Interest',                                            total:    221_586_501 },
    { name: 'Debt Service — Principal',                            total:    159_415_000 },
    { name: 'Capital Outlay',                                      total:      7_924_576 },
  ]},
  2023: { total: 53_640_149_629, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 21_846_545_988 },
    { name: 'Economic planning, development, and security',        total:  7_533_972_119 },
    { name: 'Educational, cultural, and intellectual development', total:  7_359_960_199 },
    { name: 'Government direction, management, and control',        total:  6_983_170_691 },
    { name: 'Public safety and criminal justice',                  total:  4_676_751_590 },
    { name: 'Community development and environmental management',  total:  2_884_977_217 },
    { name: 'Transportation programs',                             total:  1_256_240_674 },
    { name: 'Special government services',                         total:    416_822_820 },
    { name: 'Debt Service — Principal',                            total:    417_010_000 },
    { name: 'Interest',                                            total:    214_240_923 },
    { name: 'Capital Outlay',                                      total:     50_457_408 },
  ]},
  2024: { total: 59_174_201_425, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 23_032_877_863 },
    { name: 'Educational, cultural, and intellectual development', total: 12_937_793_234 },
    { name: 'Economic planning, development, and security',        total:  7_825_051_562 },
    { name: 'Government direction, management, and control',        total:  5_969_614_760 },
    { name: 'Public safety and criminal justice',                  total:  4_247_268_386 },
    { name: 'Community development and environmental management',  total:  2_843_943_097 },
    { name: 'Transportation programs',                             total:  1_009_850_945 },
    { name: 'Special government services',                         total:    521_711_542 },
    { name: 'Debt Service — Principal',                            total:    374_345_000 },
    { name: 'Capital Outlay',                                      total:    230_312_326 },
    { name: 'Interest',                                            total:    181_432_710 },
  ]},
  2025: { total: 59_603_886_014, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 24_066_301_495 },
    { name: 'Educational, cultural, and intellectual development', total: 11_695_394_902 },
    { name: 'Economic planning, development, and security',        total:  8_030_184_577 },
    { name: 'Government direction, management, and control',        total:  6_125_847_029 },
    { name: 'Public safety and criminal justice',                  total:  4_384_995_823 },
    { name: 'Community development and environmental management',  total:  3_277_032_324 },
    { name: 'Transportation programs',                             total:    901_904_480 },
    { name: 'Special government services',                         total:    528_131_553 },
    { name: 'Debt Service — Principal',                            total:    410_755_000 },
    { name: 'Interest',                                            total:    163_427_135 },
    { name: 'Capital Outlay',                                      total:     19_911_696 },
  ]},
};

// P2 clamp (ACFR-20): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 1_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
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
  return { jsonTree: [{ n: 'New Jersey General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, DOLLARS ×${UNITS})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'New Jersey General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'nj-acfr-gf-operating', base_url: 'https://www.nj.gov/treasury/omb/fr.shtml', fiscal_years: [2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
