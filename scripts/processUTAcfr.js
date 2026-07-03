#!/usr/bin/env node
/**
 * Utah General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Utah Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the UT state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   UT state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE DECISION (ACFR-31 — the tranche's one narrower-than-NASBO state): UT ACFR GF Total
 *   revenues ~0.83x NASBO GF ($11,404,950K FY2025 vs $13,674,000,000 NASBO FY2024) — the ONLY
 *   state in Batch 1/2 where the ACFR figure UNDERSHOOTS NASBO. Driver: Utah's income tax
 *   revenue is constitutionally earmarked (Article XIII, broadened by 2020's Amendment G) into
 *   a legally separate major fund column ("Income Tax Fund" as of FY2025, labeled "Education"
 *   in FY2019 -- pure fund-rename, not a data error, tied to the amendment broadening the
 *   earmark beyond education). NASBO's survey-reported "General Fund" concept for Utah appears
 *   to combine the true GAAP General Fund with this earmarked fund; the ACFR statement legally
 *   separates them into two major-fund columns.
 *
 *   THIS LOADER'S DECISION (resolving the 112-BATCH2-SOURCES.md Section 4 load-phase flag):
 *   load the printed GENERAL FUND column ALONE (option a) -- NOT a synthetic GF+Income-Tax-Fund
 *   composite. Rationale: the phase's tie standard ("every loaded FY ties to its printed GF
 *   column total") and the cohort-wide uniform mold (every ACFR state loads the printed GF
 *   column of the same statement) both point at the printed column; a two-fund composite is a
 *   total no statement prints. The node total DROPS vs the prior NASBO rows -- that drop is
 *   honest and GAAP-correct, not a regression.
 *
 * COLUMN-POSITION NOTE: the 2nd column's header string changed Education (FY2019) -> Income Tax
 *   (FY2025) across the loaded window; the GF column is always 1st (General Fund | Income
 *   Tax/Education | Transportation | Transportation Investment Fund | Trust Lands Permanent
 *   Fund | Nonmajor Governmental | Total) and was extracted by POSITION (first numeric token
 *   anchored to the "Total revenues"/"Total expenditures" row), never by matching the 2nd
 *   column's header text -- a naive header-string match would have broken across this window.
 *
 * WINDOW NOTE (D-06): FY2019-FY2025 (7 years) is UT's full live-durable window on the
 *   WordPress-migrated finance.utah.gov site. A pre-2019 `{{YY}}UTCAFR.pdf` naming era
 *   (FY2006-FY2016) plus an older NXT document-gateway both 404 live today (Wayback-only) --
 *   EXCLUDED per D-06, not chased.
 *
 * FY2019 LABEL FIX (one-off, hand-corrected in ut_all.json, KY-FY2002-OCR-typo precedent):
 *   `pdftotext -table` split "Human Services and Juvenile Justice Services" across two
 *   physical lines in the FY2019 PDF only (data+numbers on the first line, a bare
 *   "Services ...." continuation below the pending-accumulator's length threshold on the
 *   second) -- every other loaded year prints the full label on one line. The numeric value
 *   (908,593 thousand) was never affected, only the display label; corrected directly in the
 *   extracted JSON.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment Income (Loss)" went NEGATIVE in FY2022 only: -4,304 (thousands) -- a real GAAP fair-value/loss line, not an extraction artifact. Every other loaded year (FY2019, FY2020, FY2021, FY2023, FY2024, FY2025) is positive ($43,630K / $35,148K / $27,415K / $286,414K / $376,965K / $270,301K). The P2 clamp is the render path for FY2022; no year shows a negative GF Total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ut/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processUTAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Utah'; const STATE_ABBR = 'UT'; const POPULATION = 3_271_616;
const EXPECTED_MUNI_ID = '740cffee-3111-44c0-9473-a77acb6c42f8';
const UNITS = 1_000; // UT ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2019: { url: 'https://finance.utah.gov/wp-content/uploads/2019-ACFR.pdf', date: '2019-06-30' },
  2020: { url: 'https://finance.utah.gov/wp-content/uploads/2020-ACFR.pdf', date: '2020-06-30' },
  2021: { url: 'https://finance.utah.gov/wp-content/uploads/2021-ACFR.pdf', date: '2021-06-30' },
  2022: { url: 'https://finance.utah.gov/wp-content/uploads/2022-ACFR.pdf', date: '2022-06-30' },
  2023: { url: 'https://finance.utah.gov/wp-content/uploads/2023-ACFR.pdf', date: '2023-06-30' },
  2024: { url: 'https://finance.utah.gov/wp-content/uploads/FY24-ACFR-Final.pdf', date: '2024-06-30' },
  2025: { url: 'https://finance.utah.gov/wp-content/uploads/FY25-ACFR-FINAL-reduced-size.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Utah State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — UT ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2019: { total: 7_386_308, confidence: 'actual', categories: [
    { name: 'General Government',                           total:      420_062 },
    { name: 'Human Services and Juvenile Justice Services', total:      908_593 },
    { name: 'Corrections',                                  total:      322_230 },
    { name: 'Public Safety',                                total:      300_839 },
    { name: 'Courts',                                       total:      159_098 },
    { name: 'Health and Environmental Quality',             total:    2_995_463 },
    { name: 'Higher Education State Administration',        total:       96_323 },
    { name: 'Higher Education Colleges and Universities',   total:    1_063_258 },
    { name: 'Employment and Family Services',               total:      744_336 },
    { name: 'Natural Resources',                            total:      247_042 },
    { name: 'Heritage and Arts',                            total:       31_145 },
    { name: 'Business, Labor, and Agriculture',             total:       97_919 },
  ]},
  2020: { total: 8_079_513, confidence: 'actual', categories: [
    { name: 'General Government',                           total:      525_846 },
    { name: 'Human Services and Juvenile Justice Services', total:      969_244 },
    { name: 'Corrections',                                  total:      331_116 },
    { name: 'Public Safety',                                total:      299_167 },
    { name: 'Courts',                                       total:      161_204 },
    { name: 'Health and Environmental Quality',             total:    3_423_327 },
    { name: 'Higher Education State Administration',        total:      125_335 },
    { name: 'Higher Education Colleges and Universities',   total:    1_063_339 },
    { name: 'Employment and Family Services',               total:      769_126 },
    { name: 'Natural Resources',                            total:      263_264 },
    { name: 'Heritage and Arts',                            total:       40_124 },
    { name: 'Business, Labor, and Agriculture',             total:      108_421 },
  ]},
  2021: { total: 9_647_977, confidence: 'actual', categories: [
    { name: 'General Government',                           total:      851_602 },
    { name: 'Human Services and Juvenile Justice Services', total:    1_013_956 },
    { name: 'Corrections',                                  total:      330_760 },
    { name: 'Public Safety',                                total:      320_785 },
    { name: 'Courts',                                       total:      159_020 },
    { name: 'Health and Environmental Quality',             total:    4_043_152 },
    { name: 'Higher Education State Administration',        total:      182_070 },
    { name: 'Higher Education Colleges and Universities',   total:    1_221_898 },
    { name: 'Employment and Family Services',               total:    1_057_614 },
    { name: 'Natural Resources',                            total:      271_596 },
    { name: 'Heritage and Arts',                            total:       66_373 },
    { name: 'Business, Labor, and Agriculture',             total:      129_151 },
  ]},
  2022: { total: 10_729_051, confidence: 'actual', categories: [
    { name: 'General Government',                           total:      697_259 },
    { name: 'Human Services and Juvenile Justice Services', total:    1_092_554 },
    { name: 'Corrections',                                  total:      358_339 },
    { name: 'Public Safety',                                total:      405_790 },
    { name: 'Courts',                                       total:      170_465 },
    { name: 'Health and Environmental Quality',             total:    4_766_967 },
    { name: 'Higher Education State Administration',        total:      114_235 },
    { name: 'Higher Education Colleges and Universities',   total:    1_274_218 },
    { name: 'Employment and Family Services',               total:    1_379_278 },
    { name: 'Natural Resources',                            total:      294_380 },
    { name: 'Cultural and Community Engagement',            total:       56_942 },
    { name: 'Business, Labor, and Agriculture',             total:      115_282 },
    { name: 'Capital Outlay',                               total:        3_342 },
  ]},
  2023: { total: 11_769_561, confidence: 'actual', categories: [
    { name: 'General Government',                         total:      721_791 },
    { name: 'Health and Human Services',                  total:    6_148_317 },
    { name: 'Corrections',                                total:      420_654 },
    { name: 'Public Safety',                              total:      459_988 },
    { name: 'Courts',                                     total:      190_730 },
    { name: 'Environmental Quality',                      total:       77_454 },
    { name: 'Higher Education State Administration',      total:      133_320 },
    { name: 'Higher Education Colleges and Universities', total:    1_478_339 },
    { name: 'Employment and Family Services',             total:    1_559_233 },
    { name: 'Natural Resources',                          total:      383_153 },
    { name: 'Cultural and Community Engagement',          total:       58_739 },
    { name: 'Business, Labor, and Agriculture',           total:      137_843 },
  ]},
  2024: { total: 12_493_247, confidence: 'actual', categories: [
    { name: 'General Government',                         total:      723_800 },
    { name: 'Health and Human Services',                  total:    6_686_617 },
    { name: 'Corrections',                                total:      431_368 },
    { name: 'Public Safety',                              total:      462_768 },
    { name: 'Courts',                                     total:      216_665 },
    { name: 'Environmental Quality',                      total:       79_222 },
    { name: 'Higher Education State Administration',      total:      147_522 },
    { name: 'Higher Education Colleges and Universities', total:    1_761_881 },
    { name: 'Employment and Family Services',             total:    1_246_725 },
    { name: 'Natural Resources',                          total:      504_023 },
    { name: 'Cultural and Community Engagement',          total:       58_664 },
    { name: 'Business, Labor, and Agriculture',           total:      173_961 },
    { name: 'Public Education',                           total:           31 },
  ]},
  2025: { total: 12_924_757, confidence: 'actual', categories: [
    { name: 'General Government',                         total:      673_251 },
    { name: 'Health and Human Services',                  total:    6_989_076 },
    { name: 'Corrections',                                total:      489_695 },
    { name: 'Public Safety',                              total:      586_767 },
    { name: 'Courts',                                     total:      219_354 },
    { name: 'Environmental Quality',                      total:       93_385 },
    { name: 'Higher Education State Administration',      total:      138_352 },
    { name: 'Higher Education Colleges and Universities', total:    1_741_397 },
    { name: 'Employment and Family Services',             total:    1_188_794 },
    { name: 'Natural Resources',                          total:      549_470 },
    { name: 'Cultural and Community Engagement',          total:       62_504 },
    { name: 'Business, Labor, and Agriculture',           total:      192_712 },
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
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Utah General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Utah General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ut-acfr-gf-operating', base_url: 'https://finance.utah.gov/', fiscal_years: [2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
      if (!validate(fy)) throw new Error(`FY${fy} validation failed`);
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
      const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
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
