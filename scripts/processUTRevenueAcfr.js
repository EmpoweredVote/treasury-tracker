#!/usr/bin/env node
/**
 * Utah General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Utah Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the UT state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ut/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processUTRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Utah State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — UT ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2019: { total: 6_509_587, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    2_147_235 },
    { name: 'Other Taxes',                    total:      342_048 },
    { name: 'Federal Contracts and Grants',   total:    3_103_195 },
    { name: 'Charges for Services/Royalties', total:      501_910 },
    { name: 'Licenses, Permits, and Fees',    total:       25_664 },
    { name: 'Federal Mineral Lease',          total:       77_607 },
    { name: 'Investment Income',              total:       43_630 },
    { name: 'Miscellaneous and Other',        total:      268_298 },
  ]},
  2020: { total: 7_321_072, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    2_302_910 },
    { name: 'Other Taxes',                    total:      364_794 },
    { name: 'Federal Contracts and Grants',   total:    3_652_812 },
    { name: 'Charges for Services/Royalties', total:      537_191 },
    { name: 'Licenses, Permits, and Fees',    total:       25_659 },
    { name: 'Federal Mineral Lease',          total:       58_606 },
    { name: 'Investment Income',              total:       35_148 },
    { name: 'Miscellaneous and Other',        total:      343_952 },
  ]},
  2021: { total: 9_299_461, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    2_711_382 },
    { name: 'Other Taxes',                    total:      385_635 },
    { name: 'Federal Contracts and Grants',   total:    5_117_824 },
    { name: 'Charges for Services/Royalties', total:      552_524 },
    { name: 'Licenses, Permits, and Fees',    total:       25_635 },
    { name: 'Federal Mineral Lease',          total:       49_039 },
    { name: 'Investment Income',              total:       27_415 },
    { name: 'Miscellaneous and Other',        total:      430_007 },
  ]},
  2022: { total: 10_798_468, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    3_207_116 },
    { name: 'Other Taxes',                    total:      446_509 },
    { name: 'Federal Contracts and Grants',   total:    5_945_597 },
    { name: 'Charges for Services/Royalties', total:      607_031 },
    { name: 'Licenses, Permits, and Fees',    total:       24_367 },
    { name: 'Federal Mineral Lease',          total:       75_616 },
    { name: 'Investment Income (Loss)',       total:       -4_304 },
    { name: 'Miscellaneous and Other',        total:      496_536 },
  ]},
  2023: { total: 11_239_243, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    3_377_229 },
    { name: 'Other Taxes',                    total:      463_726 },
    { name: 'Federal Contracts and Grants',   total:    5_830_034 },
    { name: 'Charges for Services/Royalties', total:      632_535 },
    { name: 'Licenses, Permits, and Fees',    total:       25_119 },
    { name: 'Federal Mineral Lease',          total:      137_559 },
    { name: 'Investment Income (Loss)',       total:      286_414 },
    { name: 'Miscellaneous and Other',        total:      486_627 },
  ]},
  2024: { total: 11_209_884, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    3_458_181 },
    { name: 'Other Taxes',                    total:      468_117 },
    { name: 'Federal Contracts and Grants',   total:    5_557_294 },
    { name: 'Charges for Services/Royalties', total:      739_151 },
    { name: 'Licenses, Permits, and Fees',    total:       28_048 },
    { name: 'Federal Mineral Lease',          total:       84_283 },
    { name: 'Investment Income (Loss)',       total:      376_965 },
    { name: 'Miscellaneous and Other',        total:      497_845 },
  ]},
  2025: { total: 11_404_950, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',            total:    3_554_097 },
    { name: 'Other Taxes',                    total:      483_073 },
    { name: 'Federal Contracts and Grants',   total:    5_721_061 },
    { name: 'Charges for Services/Royalties', total:      832_166 },
    { name: 'Licenses, Permits, and Fees',    total:       31_254 },
    { name: 'Federal Mineral Lease',          total:       88_631 },
    { name: 'Investment Income (Loss)',       total:      270_301 },
    { name: 'Miscellaneous and Other',        total:      424_367 },
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
  return { jsonTree: [{ n: 'Utah General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Utah General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ut-acfr-gf-revenue', base_url: 'https://finance.utah.gov/', fiscal_years: [2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
      if (!validate(fy)) throw new Error(`FY${fy} validation failed`);
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
      const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
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
