#!/usr/bin/env node
/**
 * New Jersey General Fund Revenue (by source) Loader — FY2020-FY2025 ACTUAL
 * Source: State of New Jersey Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis). Published by the NJ Office of Management and Budget (OMB).
 *
 * Phase 108 (ACFR-09 / ACFR-19 / ACFR-20 / RECON-08). Revenue is NEW on the NJ state node
 *   (NASBO had no revenue-by-source) → pure insert keyed (muni,fy,'revenue'). Node resolved by
 *   name='New Jersey', state='NJ', entity_type='state' (id 91f310a1-bec9-404a-9825-82b1106c911f).
 *   Revenue landing enables the data-driven "Money In" view automatically.
 *
 * ⚠ UNITS = 1 — NJ reports the ACFR in DOLLARS, NOT thousands. Do NOT multiply by 1,000.
 *
 * SOURCES uses EXPLICIT per-year URLs (recon's `/pdfs/` segment was spurious). FY2020-FY2024 =
 *   `NJFRFY{YYYY}Complete.pdf`; FY2025 DROPS the "FR" infix → `NJFY2025Complete.pdf`.
 *
 * TX-TRAP SCOPE NOTE (ACFR-19): NJ ACFR General Fund ~1.15× NASBO GF (smallest divergence in the
 *   tranche) — the GAAP General Fund consolidates federal/intergovernmental revenue ("Federal and
 *   other grants") that NASBO's budgetary concept excludes. Accepted-and-relabelled honestly.
 *
 * P2 CLAMP (ACFR-20): NJ "Investment earnings" is positive in every loaded year; clampForRender is
 *   a safety net for any negative category.
 *
 * Control = printed General-Fund-column "Total Revenues" (dollars). Each FY's transcribed
 *   rev-by-source categories tie to the printed Total or the loader refuses to write (exit 2).
 *   Bookends: FY2025 = 60,979,024,211 ; FY2020 = 38,768,977,008. All 6 FYs tie 0 diff.
 *   Extraction: pdftotext -table on local PDFs in _acfr-work/nj/ (NOT -layout).
 *
 * Usage: node scripts/processNJRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `New Jersey State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund revenues by source — NJ ACFR, GENERAL FUND column (raw DOLLARS; UNITS=1).
// Verbatim ACFR revenue source names from the Governmental Funds Statement of Rev/Exp/Changes.
// total = printed General-Fund "Total Revenues" (dollars). All 6 FYs tie 0 diff.
const REVENUE = {
  2020: { total: 38_768_977_008, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 17_769_218_114 },
    { name: 'Federal and other grants',          total: 16_465_961_692 },
    { name: 'Services and assessments',          total:  1_929_890_116 },
    { name: 'Licenses and fees',                 total:  1_246_220_106 },
    { name: 'Other',                             total:  1_092_941_716 },
    { name: 'Component Units and Port Authority',total:    199_261_897 },
    { name: 'Investment earnings',               total:     65_483_367 },
  ]},
  2021: { total: 48_182_629_272, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 22_570_520_406 },
    { name: 'Federal and other grants',          total: 20_749_590_577 },
    { name: 'Services and assessments',          total:  1_982_119_316 },
    { name: 'Licenses and fees',                 total:  1_489_455_586 },
    { name: 'Other',                             total:  1_145_826_133 },
    { name: 'Component Units and Port Authority',total:    219_052_270 },
    { name: 'Investment earnings',               total:     26_064_984 },
  ]},
  2022: { total: 57_510_588_567, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 27_083_749_525 },
    { name: 'Federal and other grants',          total: 24_821_548_745 },
    { name: 'Services and assessments',          total:  2_017_816_056 },
    { name: 'Other',                             total:  1_753_877_406 },
    { name: 'Licenses and fees',                 total:  1_431_897_949 },
    { name: 'Component Units and Port Authority',total:    363_030_124 },
    { name: 'Investment earnings',               total:     38_668_762 },
  ]},
  2023: { total: 61_016_633_737, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 27_093_040_155 },
    { name: 'Federal and other grants',          total: 26_449_583_346 },
    { name: 'Services and assessments',          total:  2_265_920_747 },
    { name: 'Other',                             total:  2_053_171_608 },
    { name: 'Licenses and fees',                 total:  1_456_856_815 },
    { name: 'Investment earnings',               total:    928_949_659 },
    { name: 'Component Units and Port Authority',total:    769_111_407 },
  ]},
  2024: { total: 60_554_040_145, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 26_698_781_241 },
    { name: 'Federal and other grants',          total: 25_579_758_801 },
    { name: 'Services and assessments',          total:  2_949_512_530 },
    { name: 'Other',                             total:  2_133_031_203 },
    { name: 'Licenses and fees',                 total:  1_470_981_982 },
    { name: 'Investment earnings',               total:  1_236_245_708 },
    { name: 'Component Units and Port Authority',total:    485_728_680 },
  ]},
  2025: { total: 60_979_024_211, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 27_535_370_653 },
    { name: 'Federal and other grants',          total: 25_944_819_933 },
    { name: 'Other',                             total:  2_385_370_907 },
    { name: 'Services and assessments',          total:  2_140_760_752 },
    { name: 'Licenses and fees',                 total:  1_582_616_065 },
    { name: 'Investment earnings',               total:    952_995_499 },
    { name: 'Component Units and Port Authority',total:    437_090_402 },
  ]},
};

// P2 (ACFR-20): clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 1_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
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
  return { jsonTree: [{ n: 'New Jersey General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, General Fund, DOLLARS)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'New Jersey General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'nj-acfr-gf-revenue', base_url: 'https://www.nj.gov/treasury/omb/fr.shtml', fiscal_years: [2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (net loss — shown at 0)]`);
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
