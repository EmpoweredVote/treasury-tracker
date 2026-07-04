#!/usr/bin/env node
/**
 * Nevada General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Nevada Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in dollars).
 *
 * Phase 113. Revenue is NEW on the NV state node → pure insert keyed (muni,fy,'revenue').
 *   NV state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-44): NV ACFR GF ~2.87x NASBO GF (FY2023 $15,153,168,081 vs FY2024 NASBO
 *   $5,273,000K) -- the WIDEST divergence in Batch 3, TX/NC-trap mechanism. Nevada's GAAP General
 *   Fund consolidates federal Medicaid/grant pass-through directly into the General column:
 *   "Intergovernmental" = $8,940,557,604 in FY2023 = 59% of GF revenue. Accepted-and-relabelled
 *   honestly (TX precedent).
 *
 * UNITS = DOLLARS, NOT THOUSANDS (the #1 NV load risk) -- NV's printed statement is already in
 *   whole dollars (bookends run into the $10-15 BILLION range, not thousands). UNITS=1 hard-set;
 *   bookends asserted at load: FY2023 $15,153,168,081 / FY2019 $10,411,179,917 (both sides, $0
 *   diff on revenues AND expenditures, confirmed on all 5 loaded years).
 *
 * OPAQUE FILENAMES (no derivable pattern, explicit per-year enumeration required):
 *   under https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/ --
 *   FY2023=2023-acfr-report.pdf, FY2022=2022_ACFR_Report.pdf, FY2021=FY21_ACFR.pdf,
 *   FY2020=ACFR_FY2020.pdf, FY2019=CAFR_Web_2019.pdf. Landing page states ACFR documents are
 *   "currently being remediated" but the underlying PDFs remain directly fetchable by filename.
 *
 * PARTIAL-WINDOW LOAD (D-07): NV has NOT published a FY2024/FY2025 ACFR as of this load
 *   (re-checked controller.nv.gov live at Phase-120 load time -- 2026-07-04 -- every tested
 *   FY2024/FY2025 filename variant 404s, landing page still reads "currently being remediated",
 *   no FY2024/2025 mention). Loaded FY2019-FY2023 on ACFR; the FY2024 NASBO operating row is
 *   INTENTIONALLY RETAINED with its honest NASBO label (not fabricated, not dropped) -- re-check
 *   controller.nv.gov on a future touch.
 *
 * 4-COLUMN LAYOUT: General Fund is the 1st of 4 (General Fund | State Education Fund | Nonmajor
 *   Governmental Funds | Total Governmental Funds). extract_gf.py's position-anchor isolates
 *   General Fund regardless of the total column count -- confirmed at both bookends and on all 5
 *   loaded years (zero honest holes, no rev_boundary sub-heading complications -- NV's revenue
 *   lines carry no sub-heading at all, sub=None throughout; the raw labels already read as
 *   complete tax names e.g. "Sales taxes", "Gaming taxes, fees, licenses").
 *
 * PRESENTATION CHANGE (FY2022+, real GAAP change not an extraction artifact): FY2019-FY2021 split
 *   K-12 education into two lines ("Education - K-12 state support" + "Education - K-12
 *   administrative"); FY2022-FY2023 merge them into one "Education - K-12" line. Each year's own
 *   category list ties independently -- no name collision across years (per-year lists, not a
 *   fixed shared schema).
 *
 * CLEAN EXTRACTION: all 5 years FY2019-FY2023 tied to $0 diff on BOTH the revenue and expenditure
 *   printed General Fund totals on the first extraction pass -- zero honest holes, no wrapped
 *   labels beyond normal whitespace collapse, no OCR/font defects (pdftotext -table emits
 *   "Invalid entry in bfchar block" warnings on all 5 PDFs -- cosmetic ToUnicode-CMap noise that
 *   does not affect numeric-table extraction, confirmed by the exact $0 ties).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Interest and investment income (loss)" went NEGATIVE in FY2022 only: -$141,921,982 (dollars) -- a real GAAP fair-value-of-investments loss, not an extraction artifact. Both bookend years are positive (FY2023 +$113,563,504 / FY2019 +$44,986,413, matching the recon's "none observed in either bookend" finding -- the negative is an interior-year discovery made during this load). The P2 clamp is the render path for FY2022; no year shows a negative GF Total.
 *
 * UNITS = dollars (already dollars, no scaling). Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 dollars; extraction: pdftotext -table
 *   on local copies in _acfr-work/nv/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processNVRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Nevada'; const STATE_ABBR = 'NV'; const POPULATION = 3_104_614;
const EXPECTED_MUNI_ID = 'd0879e45-0b72-41ee-bdbd-a214a4f2a1d5';
const UNITS = 1; // NV ACFR is in dollars (already dollars — no scaling)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2019: { url: 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/CAFR_Web_2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/ACFR_FY2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/FY21_ACFR.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2022_ACFR_Report.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2023-acfr-report.pdf', date: '2023-06-30' },
};
const dataSource = (fy) => `Nevada State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — NV ACFR, GENERAL FUND column (raw dollars; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2019: { total: 10_411_179_917, confidence: 'actual', categories: [
    { name: 'Gaming taxes, fees, licenses',   total:  941_144_174 },
    { name: 'Sales taxes',                    total: 1_465_518_389 },
    { name: 'Modified business taxes',        total:  640_374_679 },
    { name: 'Insurance premium taxes',        total:  422_512_406 },
    { name: 'Lodging taxes',                  total:  183_397_890 },
    { name: 'Cigarette taxes',                total:  164_392_540 },
    { name: 'Commerce taxes',                 total:  226_770_333 },
    { name: 'Property and transfer taxes',    total:  104_430_645 },
    { name: 'Motor and special fuel taxes',   total:    2_289_106 },
    { name: 'Other taxes',                    total:  434_980_283 },
    { name: 'Intergovernmental',              total: 5_246_960_224 },
    { name: 'Licenses, fees and permits',     total:  388_527_182 },
    { name: 'Sales and charges for services', total:   70_008_241 },
    { name: 'Interest and investment income', total:   44_986_413 },
    { name: 'Settlement income',              total:   22_779_743 },
    { name: 'Other',                          total:   52_107_669 },
  ]},
  2020: { total: 10_308_923_845, confidence: 'actual', categories: [
    { name: 'Gaming taxes, fees, licenses',   total:  856_816_611 },
    { name: 'Sales taxes',                    total: 1_493_717_694 },
    { name: 'Modified business taxes',        total:  642_603_267 },
    { name: 'Insurance premium taxes',        total:  450_738_957 },
    { name: 'Lodging taxes',                  total:  138_010_767 },
    { name: 'Cigarette taxes',                total:  156_694_742 },
    { name: 'Commerce taxes',                 total:  204_983_790 },
    { name: 'Property and transfer taxes',    total:  103_064_985 },
    { name: 'Motor and special fuel taxes',   total:    2_190_399 },
    { name: 'Other taxes',                    total:  431_520_916 },
    { name: 'Intergovernmental',              total: 5_273_127_125 },
    { name: 'Licenses, fees and permits',     total:  379_278_906 },
    { name: 'Sales and charges for services', total:   67_688_334 },
    { name: 'Interest and investment income', total:   49_745_192 },
    { name: 'Settlement income',              total:    1_390_300 },
    { name: 'Other',                          total:   57_351_860 },
  ]},
  2021: { total: 12_265_829_792, confidence: 'actual', categories: [
    { name: 'Gaming taxes, fees, licenses',   total:  579_224_841 },
    { name: 'Sales taxes',                    total: 1_671_350_898 },
    { name: 'Modified business taxes',        total:  597_144_096 },
    { name: 'Insurance premium taxes',        total:  487_866_081 },
    { name: 'Lodging taxes',                  total:   81_947_509 },
    { name: 'Cigarette taxes',                total:  152_701_797 },
    { name: 'Commerce taxes',                 total:  221_958_301 },
    { name: 'Property and transfer taxes',    total:  136_950_802 },
    { name: 'Motor and special fuel taxes',   total:    2_215_911 },
    { name: 'Other taxes',                    total:  641_356_804 },
    { name: 'Intergovernmental',              total: 7_102_604_480 },
    { name: 'Licenses, fees and permits',     total:  421_562_786 },
    { name: 'Sales and charges for services', total:   62_788_878 },
    { name: 'Interest and investment income', total:    3_268_499 },
    { name: 'Settlement income',              total:   14_276_991 },
    { name: 'Other',                          total:   88_611_118 },
  ]},
  2022: { total: 14_612_607_899, confidence: 'actual', categories: [
    { name: 'Gaming taxes, fees, licenses',          total: 1_183_763_979 },
    { name: 'Sales taxes',                           total: 1_679_871_808 },
    { name: 'Modified business taxes',               total:  780_476_130 },
    { name: 'Insurance premium taxes',               total:  516_355_310 },
    { name: 'Cigarette taxes',                       total:  144_068_816 },
    { name: 'Commerce taxes',                        total:  281_881_659 },
    { name: 'Property and transfer taxes',           total:  179_998_944 },
    { name: 'Motor and special fuel taxes',          total:    2_225_046 },
    { name: 'Other taxes',                           total:  523_693_004 },
    { name: 'Intergovernmental',                     total: 8_855_438_910 },
    { name: 'Licenses, fees and permits',            total:  445_877_086 },
    { name: 'Sales and charges for services',        total:   69_741_429 },
    { name: 'Interest and investment income (loss)', total: -141_921_982 },
    { name: 'Settlement income',                     total:   11_639_326 },
    { name: 'Other',                                 total:   79_498_434 },
  ]},
  2023: { total: 15_153_168_081, confidence: 'actual', categories: [
    { name: 'Gaming taxes, fees, licenses',          total: 1_220_118_628 },
    { name: 'Sales taxes',                           total: 1_791_686_534 },
    { name: 'Modified business taxes',               total:  846_497_958 },
    { name: 'Insurance premium taxes',               total:  545_115_017 },
    { name: 'Cigarette taxes',                       total:  135_275_124 },
    { name: 'Commerce taxes',                        total:  302_379_605 },
    { name: 'Property and transfer taxes',           total:  112_485_117 },
    { name: 'Motor and special fuel taxes',          total:    2_411_199 },
    { name: 'Other taxes',                           total:  509_478_514 },
    { name: 'Intergovernmental',                     total: 8_940_557_604 },
    { name: 'Licenses, fees and permits',            total:  450_445_039 },
    { name: 'Sales and charges for services',        total:   72_479_264 },
    { name: 'Interest and investment income (loss)', total:  113_563_504 },
    { name: 'Settlement income',                     total:    6_740_146 },
    { name: 'Other',                                 total:  103_934_828 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name.trim()} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name.trim(); // WR-01: trim so a stray-space transcription can never fork a category name across years
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Nevada General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2019, 2020, 2021, 2022, 2023];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, dollars×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06: validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (REVENUE[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
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
    const srcPayload = { name: 'Nevada General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'nv-acfr-gf-revenue', base_url: 'https://controller.nv.gov/financial-reports/annual-comprehensive-financial-report-acfr/', fiscal_years: [2019,2020,2021,2022,2023], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
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
      if (rpcErr) throw new Error(`FY${fy} RPC error: ${rpcErr.message}`);
      if (r?.error) throw new Error(`FY${fy} RPC error: ${r.error}`);
      console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
      if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`); // WR-07: surface select errors — do not misreport as a missing row
      if (bud?.id) {
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
        if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`);
        console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
      } else { throw new Error(`Could not find FY${fy} revenue budget row to stamp source`); }
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
