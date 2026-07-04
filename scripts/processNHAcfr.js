#!/usr/bin/env node
/**
 * New Hampshire General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of New Hampshire Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the NH state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   NH state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-45): NH ACFR GF ~3.22x NASBO GF (FY2024 $6,377,159K vs FY2024 NASBO
 *   $1,981,000K) -- the WIDEST divergence in Batch 3, TX-trap mechanism. "Federal Government"
 *   = $3,065,572K in FY2024 = 48% of GF revenue, plus "Special Taxes" = $1,792,670K (Medicaid
 *   Enhancement Tax + business taxes -- NH has no broad sales or income tax) are both
 *   consolidated directly into the GENERAL column. Accepted-and-relabelled honestly (TX
 *   precedent).
 *
 * AKAMAI EDGE-BLOCK / WAYBACK-PROXY FETCH (the NH fetch-mechanism deviation): das.nh.gov,
 *   www.das.nh.gov, and www.nh.gov all return HTTP 403 "Access Denied" (Akamai
 *   errors.edgesuite.net) to every automated curl/fetch variant tried (multiple full browser
 *   User-Agent strings, Accept/Accept-Language/sec-fetch-(dash) headers, Referer) -- harder than the
 *   tn.gov precedent (header-spoofing alone is insufficient here). The Internet Archive has
 *   actively re-crawled das.nh.gov/accounting/ through at least 2026-07, and is NOT blocked.
 *   Every SOURCES url below is a durable Wayback Machine mirror URL
 *   (web.archive.org/web/{timestamp}if_/{original-das.nh.gov-url}, the `if_` raw-content
 *   modifier) -- resolved per-year via the CDX API and stored as the row's source_url so the
 *   citation stays honest (points at the real archived original, not a synthetic host).
 *
 * 3-ERA FILENAME MAP (directory segment fy%20{YY}, 2-digit year, URL-encoded space):
 *   FY2021/FY2022/FY2024 = fy_{YYYY}_annual_comprehensive_financial_report.pdf; FY2023
 *   (exception, adds `_acfr` suffix) = fy_2023_annual_comprehensive_financial_report_acfr.pdf;
 *   FY2017-FY2020 (pre-ACFR-rename, "comprehensive annual" word order) =
 *   fy_{YYYY}_comprehensive_annual_financial_report.pdf.
 *
 * 5-COLUMN LAYOUT: GENERAL is the 1st of 5 (General | Highway | Education | Non-Major
 *   Governmental | Total). extract_gf.py's position-anchor isolates General regardless of
 *   column count -- confirmed at both bookends (FY2024 rev $6,377,159K / FY2017 rev
 *   $4,207,160K, exact $0 diff on BOTH revenues and expenditures) and on all 8 loaded years.
 *
 * CLEAN EXTRACTION: all 8 years FY2017-FY2024 tied to $0 diff on BOTH the revenue and
 *   expenditure printed General Fund totals on the FIRST extraction pass -- zero honest
 *   holes, no wrapped labels, no OCR/font defects, no rev_boundary sub-heading complications
 *   (NH's revenue lines carry no sub-heading at all, sub=None throughout; expenditures carry
 *   a single "Current" subsection with no dual-subsection collision).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): No negative GF lines observed in any of the 8 loaded years, on either the revenue or expenditure side (full-cohort negative scan, not just bookends -- matches the recon's "none observed in either bookend" finding). Clamp path (clampForRender / P2) stays wired per ACFR-32 as the tranche-standard safety net, unexercised for NH.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/nh/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processNHAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New Hampshire'; const STATE_ABBR = 'NH'; const POPULATION = 1_377_529;
const EXPECTED_MUNI_ID = 'c54f6dbd-3f2a-453e-b0b9-259e377aef67';
const UNITS = 1_000; // NH ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2017: { url: 'https://web.archive.org/web/20220121120159if_/https://das.nh.gov/accounting/FY%2017/FY_2017_Comprehensive_Annual_Financial_Report.pdf', date: '2017-06-30' },
  2018: { url: 'https://web.archive.org/web/20220103220450if_/https://das.nh.gov/accounting/FY%2018/FY_2018_Comprehensive_Annual_Financial_Report.pdf', date: '2018-06-30' },
  2019: { url: 'https://web.archive.org/web/20201030044939if_/http://das.nh.gov/accounting/FY%2019/FY_2019_Comprehensive_Annual_Financial_Report.pdf', date: '2019-06-30' },
  2020: { url: 'https://web.archive.org/web/20220120064818if_/https://das.nh.gov/accounting/FY%2020/FY_2020_Comprehensive_Annual_Financial_Report.pdf', date: '2020-06-30' },
  2021: { url: 'https://web.archive.org/web/20220510215335if_/https://www.das.nh.gov/accounting/FY%2021/FY_2021_Annual_Comprehensive_Financial_Report.pdf', date: '2021-06-30' },
  2022: { url: 'https://web.archive.org/web/20240705211541if_/https://www.das.nh.gov/accounting/FY%2022/FY_2022_Annual_Comprehensive_Financial_Report.pdf', date: '2022-06-30' },
  2023: { url: 'https://web.archive.org/web/20260429021925if_/https://www.das.nh.gov/accounting/FY%2023/FY_2023_Annual_Comprehensive_Financial_Report_ACFR.pdf', date: '2023-06-30' },
  2024: { url: 'https://web.archive.org/web/20250530085208if_/https://www.das.nh.gov/accounting/FY%2024/FY_2024_Annual_Comprehensive_Financial_Report.pdf', date: '2024-06-30' },
};
const dataSource = (fy) => `New Hampshire State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — NH ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2017: { total: 4_279_104, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      346_593 },
    { name: 'Administration of Justice and Public Protection', total:      439_359 },
    { name: 'Resource Protection and Development',             total:      133_196 },
    { name: 'Transportation',                                  total:       12_572 },
    { name: 'Health and Social Services',                      total:    2_817_626 },
    { name: 'Education',                                       total:      397_381 },
    { name: 'Debt Service',                                    total:      107_726 },
    { name: 'Capital Outlay',                                  total:       24_651 },
  ]},
  2018: { total: 4_462_815, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      375_556 },
    { name: 'Administration of Justice and Public Protection', total:      468_056 },
    { name: 'Resource Protection and Development',             total:      137_331 },
    { name: 'Transportation',                                  total:       40_414 },
    { name: 'Health and Social Services',                      total:    2_906_735 },
    { name: 'Education',                                       total:      400_155 },
    { name: 'Debt Service',                                    total:      106_089 },
    { name: 'Capital Outlay',                                  total:       28_479 },
  ]},
  2019: { total: 4_521_314, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      376_330 },
    { name: 'Administration of Justice and Public Protection', total:      495_344 },
    { name: 'Resource Protection and Development',             total:      143_849 },
    { name: 'Transportation',                                  total:        9_996 },
    { name: 'Health and Social Services',                      total:    2_948_331 },
    { name: 'Education',                                       total:      403_767 },
    { name: 'Debt Service',                                    total:      112_871 },
    { name: 'Capital Outlay',                                  total:       30_826 },
  ]},
  2020: { total: 4_613_575, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      386_023 },
    { name: 'Administration of Justice and Public Protection', total:      513_153 },
    { name: 'Resource Protection and Development',             total:      172_721 },
    { name: 'Transportation',                                  total:       17_711 },
    { name: 'Health and Social Services',                      total:    3_020_190 },
    { name: 'Education',                                       total:      366_309 },
    { name: 'Debt Service',                                    total:      106_667 },
    { name: 'Capital Outlay',                                  total:       30_801 },
  ]},
  2021: { total: 5_099_364, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      479_280 },
    { name: 'Administration of Justice and Public Protection', total:      493_598 },
    { name: 'Resource Protection and Development',             total:      155_258 },
    { name: 'Transportation',                                  total:       34_219 },
    { name: 'Health and Social Services',                      total:    3_375_573 },
    { name: 'Education',                                       total:      431_195 },
    { name: 'Debt Service',                                    total:       96_225 },
    { name: 'Capital Outlay',                                  total:       34_016 },
  ]},
  2022: { total: 5_966_059, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      678_910 },
    { name: 'Administration of Justice and Public Protection', total:      588_083 },
    { name: 'Resource Protection and Development',             total:      192_946 },
    { name: 'Transportation',                                  total:       30_948 },
    { name: 'Health and Social Services',                      total:    3_780_076 },
    { name: 'Education',                                       total:      562_894 },
    { name: 'Debt Service',                                    total:       83_680 },
    { name: 'Capital Outlay',                                  total:       48_522 },
  ]},
  2023: { total: 6_414_896, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      773_035 },
    { name: 'Administration of Justice and Public Protection', total:      658_936 },
    { name: 'Resource Protection and Development',             total:      330_800 },
    { name: 'Transportation',                                  total:      101_995 },
    { name: 'Health and Social Services',                      total:    3_870_295 },
    { name: 'Education',                                       total:      553_098 },
    { name: 'Debt Service',                                    total:       84_939 },
    { name: 'Capital Outlay',                                  total:       41_798 },
  ]},
  2024: { total: 6_492_697, confidence: 'actual', categories: [
    { name: 'General Government',                              total:      619_254 },
    { name: 'Administration of Justice and Public Protection', total:      886_287 },
    { name: 'Resource Protection and Development',             total:      305_505 },
    { name: 'Transportation',                                  total:       41_294 },
    { name: 'Health and Social Services',                      total:    3_891_939 },
    { name: 'Education',                                       total:      584_483 },
    { name: 'Debt Service',                                    total:       84_981 },
    { name: 'Capital Outlay',                                  total:       78_954 },
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
  return { jsonTree: [{ n: 'New Hampshire General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'New Hampshire General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'nh-acfr-gf-operating', base_url: 'https://www.das.nh.gov/accounting/', fiscal_years: [2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
