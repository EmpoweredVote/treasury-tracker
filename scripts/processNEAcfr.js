#!/usr/bin/env node
/**
 * Nebraska General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Nebraska Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the NE state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   NE state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-43): NE ACFR GF ~1.19x NASBO GF (FY2025 $6,308,910K vs FY2024 NASBO
 *   $5,314,000K) -- the SMALLEST divergence in Batch 3. Nebraska's General Fund is ~91%
 *   own-source (Income Taxes $3,094,901K + Sales and Use Taxes $2,619,973K FY2025); Federal
 *   Grants and Contracts is only $157K (~0.002%) of the General column -- federal flows are
 *   booked to the separate FEDERAL major-fund column, not General. Accepted-and-relabelled
 *   honestly (OH/VA/IN precedent, near-parity).
 *
 * FULLY DERIVABLE URL, NO NAMING EXCEPTIONS: das.nebraska.gov/accounting/docs/
 *   NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_{YYYY}.pdf
 *   for FY2020-FY2025, all confirmed application/pdf (not soft-404) -- the cleanest URL
 *   pattern in Batch 3. Landing: das.nebraska.gov/accounting/financial_reports.php.
 *
 * 7-COLUMN LAYOUT: GENERAL FUND is the 1st of 7 (General | Highway | Federal | Health and
 *   Social Services | Permanent School | Nonmajor | Totals). extract_gf.py's position-anchor
 *   isolates General regardless of the total column count -- confirmed at both bookends
 *   (FY2025 rev $6,308,910K / FY2020 rev $4,993,719K, exact $0 diff on BOTH revenues and
 *   expenditures) and on all 6 loaded years.
 *
 * SHARED EXTRACTOR FIX (ACFR-43 discovered it, reusable): the FY2024 PDF's pdftotext -table
 *   output renders the blank-GF-cell placeholder glyph as an invalid standalone UTF-8 byte
 *   (0xAD, a soft hyphen) instead of the ASCII '-'/'--' used by every other loaded state's
 *   PDF (and NE's own FY2020-2023/2025 PDFs). Decoded with the old errors='ignore', that byte
 *   vanished entirely (rather than leaving an explicit blank marker), which silently shifted
 *   a LATER major-fund column's real value into an EARLIER blank General-Fund cell's position
 *   (FY2024 "Petroleum Taxes"/"Surcharge" wrongly picked up Highway's/Nonmajor's values).
 *   Fixed generically in extract_gf.py: read source files with errors='replace' (so the
 *   invalid byte becomes a single U+FFFD replacement char, preserving column position) and
 *   recognize U+FFFD as a DASH_TOKEN alongside '-'/'--'/'—'. Verified zero regression on
 *   NE's own other 5 years and a spot-check of KS/MT (all still tie exactly).
 *
 * WINDOW: FY2020-FY2025 (6 years, the recon's full target window) -- zero honest holes, every
 *   year tied to $0 diff on BOTH revenues and expenditures on extraction.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): FY2020 "Other Taxes" = -193K (thousands, immaterial) -- a real GAAP-basis minor tax refund/adjustment, not an extraction artifact. Every other loaded year's "Other Taxes" line is positive (FY2025 +136K, FY2021-2024 range +126K to +747K). The P2 clamp is the render path for FY2020; no year shows a negative GF Total revenues.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ne/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processNEAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Nebraska'; const STATE_ABBR = 'NE'; const POPULATION = 1_961_504;
const EXPECTED_MUNI_ID = 'ccfb8751-ae32-4974-96a9-d8c8ea85a898';
const UNITS = 1_000; // NE ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2020: { url: 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2025.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Nebraska State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — NE ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2020: { total: 4_751_700, confidence: 'actual', categories: [
    { name: 'General Government',                         total:      686_264 },
    { name: 'Conservation of Natural Resources',          total:       25_691 },
    { name: 'Culture � Recreation',                       total:        6_024 },
    { name: 'Economic Development and Assistance',        total:       10_718 },
    { name: 'Education',                                  total:    1_494_640 },
    { name: 'Higher Education - Colleges and University', total:      665_609 },
    { name: 'Health and Social Services',                 total:    1_533_164 },
    { name: 'Public Safety',                              total:      326_130 },
    { name: 'Regulation of Business and Professions',     total:        3_460 },
  ]},
  2021: { total: 4_818_326, confidence: 'actual', categories: [
    { name: 'General Government',                         total:      702_209 },
    { name: 'Conservation of Natural Resources',          total:       31_507 },
    { name: 'Culture � Recreation',                       total:        6_462 },
    { name: 'Economic Development and Assistance',        total:       10_718 },
    { name: 'Education',                                  total:    1_486_900 },
    { name: 'Higher Education - Colleges and University', total:      690_175 },
    { name: 'Health and Social Services',                 total:    1_600_153 },
    { name: 'Public Safety',                              total:      285_834 },
    { name: 'Regulation of Business and Professions',     total:        4_368 },
  ]},
  2022: { total: 5_031_866, confidence: 'actual', categories: [
    { name: 'General Government',                         total:      724_765 },
    { name: 'Conservation of Natural Resources',          total:       29_384 },
    { name: 'Culture � Recreation',                       total:        6_320 },
    { name: 'Economic Development and Assistance',        total:       19_429 },
    { name: 'Education',                                  total:    1_488_779 },
    { name: 'Higher Education - Colleges and University', total:      715_200 },
    { name: 'Health and Social Services',                 total:    1_693_382 },
    { name: 'Public Safety',                              total:      343_899 },
    { name: 'Regulation of Business and Professions',     total:        8_825 },
    { name: 'Transportation',                             total:           41 },
    { name: 'Debt service — Principal - Lease Financing', total:        1_527 },
    { name: 'Debt service — Interest - Lease Financing',  total:          315 },
  ]},
  2023: { total: 5_588_274, confidence: 'actual', categories: [
    { name: 'General Government',                                total:      768_401 },
    { name: 'Conservation of Natural Resources',                 total:       48_320 },
    { name: 'Culture � Recreation',                              total:       15_884 },
    { name: 'Economic Development and Assistance',               total:       33_762 },
    { name: 'Education',                                         total:    1_543_929 },
    { name: 'Higher Education - Colleges and University',        total:      737_242 },
    { name: 'Health and Social Services',                        total:    2_001_395 },
    { name: 'Public Safety',                                     total:      430_461 },
    { name: 'Regulation of Business and Professions',            total:        4_140 },
    { name: 'Transportation',                                    total:           57 },
    { name: 'Debt service — Principal - Lease Financing',        total:        1_516 },
    { name: 'Debt service — Interest - Lease Financing',         total:          333 },
    { name: 'Debt service — Principal - Subscription Financing', total:        2_751 },
    { name: 'Debt service — Interest - Subscription Financing',  total:           83 },
  ]},
  2024: { total: 6_327_646, confidence: 'actual', categories: [
    { name: 'General Government',                                total:      852_605 },
    { name: 'Conservation of Natural Resources',                 total:       63_663 },
    { name: 'Culture � Recreation',                              total:        7_918 },
    { name: 'Economic Development and Assistance',               total:      191_006 },
    { name: 'Education',                                         total:    1_928_795 },
    { name: 'Higher Education - Colleges & University',          total:      759_298 },
    { name: 'Health and Social Services',                        total:    2_047_828 },
    { name: 'Public Safety',                                     total:      467_389 },
    { name: 'Regulation of Business and Professions',            total:        4_718 },
    { name: 'Debt service — Principal - Lease Financing',        total:        1_350 },
    { name: 'Debt service — Interest - Lease Financing',         total:          323 },
    { name: 'Debt service — Principal - Subscription Financing', total:        2_631 },
    { name: 'Debt service — Interest - Subscription Financing',  total:          122 },
  ]},
  2025: { total: 7_776_942, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    1_703_716 },
    { name: 'Conservation of Natural Resources',                 total:       57_827 },
    { name: 'Culture � Recreation',                              total:        7_753 },
    { name: 'Economic Development and Assistance',               total:      300_782 },
    { name: 'Education',                                         total:    2_204_026 },
    { name: 'Higher Education - Colleges & University',          total:      796_791 },
    { name: 'Health and Social Services',                        total:    2_201_949 },
    { name: 'Public Safety',                                     total:      494_893 },
    { name: 'Regulation of Business and Professions',            total:        4_792 },
    { name: 'Debt service — Principal - Lease Financing',        total:        1_356 },
    { name: 'Debt service — Interest - Lease Financing',         total:          346 },
    { name: 'Debt service — Principal - Subscription Financing', total:        2_545 },
    { name: 'Debt service — Interest - Subscription Financing',  total:          166 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name.trim()} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name.trim(); // WR-01: trim so a stray-space transcription can never fork a category name across years
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Nebraska General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06: validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (EXPENDITURES[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
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
    const srcPayload = { name: 'Nebraska General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ne-acfr-gf-operating', base_url: 'https://das.nebraska.gov/accounting/financial_reports.php', fiscal_years: [2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
      console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
      const { jsonTree, total, rowCount } = buildTree(fy);
      const cats = jsonTree[0].c;
      console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
      for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
      const neg = EXPENDITURES[fy].categories.filter(c => c.total < 0);
      for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
      console.log('─'.repeat(72)); console.log(`${'TOTAL EXPENDITURES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
      console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
      if (dryRun) { console.log(`(dry-run)\n`); continue; }
      const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
      if (rpcErr) throw new Error(`FY${fy} RPC error: ${rpcErr.message}`);
      if (r?.error) throw new Error(`FY${fy} RPC error: ${r.error}`);
      console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
      if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`); // WR-07: surface select errors — do not misreport as a missing row
      if (bud?.id) {
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
        if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`);
        console.log(`Stamped source on FY${fy} operating row (GAAP basis)\n`);
      } else { throw new Error(`Could not find FY${fy} operating budget row to stamp source`); }
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
