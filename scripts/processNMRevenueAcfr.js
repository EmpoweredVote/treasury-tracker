#!/usr/bin/env node
/**
 * New Mexico General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of New Mexico Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the NM state node → pure insert keyed (muni,fy,'revenue').
 *   NM state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-46): NM ACFR GF ~3.06x NASBO GF (FY2024 $30,530,269K vs FY2024 NASBO
 *   $9,975,000K) -- TX-trap mechanism, similar magnitude to NV/NH in this batch. "Federal
 *   Revenue" = $11,691,941K in FY2024 (38% of GF revenue) is consolidated into the GAAP
 *   General Fund column, PLUS a substantial own-source stream not seen in most other tranche
 *   states: "Rentals and Royalties" (oil & gas) = $5,353,926K FY2024. Both federal passthrough
 *   AND the state's own severance/royalty revenue land in the same GENERAL FUND column.
 *   Accepted-and-relabelled honestly (TX precedent) with this two-driver note.
 *
 * FY2022 IMAGE-ONLY / EMBEDDED-DATA (the NM load-time finding, LOAD-01/NJ-115 precedent):
 *   the FY2022 ACFR's Statement of Revenues, Expenditures, and Changes in Fund Balances --
 *   Governmental Funds (printed pp. 36-37) renders as a RASTER IMAGE, not embedded text --
 *   `pdftotext -table`/`-layout` on the live PDF return zero numeric content for those two
 *   pages (extract_gf.py correctly reports "statement not found" rather than mis-transcribing
 *   a blank/zero row -- the KY FY2023 no-ToUnicode-CMap precedent, a different failure mode
 *   from OCR-recoverable scans). Phase 117 recon rendered the two pages to PNG
 *   (`_acfr-work/nm/nm_2022_hires-048.png` / `-049.png`) and this load HAND-TRANSCRIBED the
 *   GENERAL FUND column directly from the rendered image (both readable at full resolution,
 *   not a case of illegible/degraded source) -- embedded as static data in `nm/nm_all.json`
 *   (NJ Phase 115 precedent) rather than left to an automated pass. Independently re-summed at
 *   assembly time: GF Total revenues $26,161,736K (9 line items, $0 diff) and GF Total
 *   expenditures $20,159,689K (12 line items, $0 diff) -- both exact-tie the printed totals.
 *
 * FY2023 LIVE-DISCOVERY (resolves the recon's NM gap-log item): nmdfa.state.nm.us's own
 *   landing/reports pages do not link the ACFR directly (recon precedent). Re-crawled at load
 *   time via the Wayback CDX API against `nmdfa.state.nm.us/wp-content/uploads/2024/*` and
 *   found `FINAL-341-A-State-of-New-Mexico-FY-2023-FS-5-15-2024.pdf` (confirmed live, %PDF
 *   magic, application/pdf, ~3.2MB) -- extracted cleanly via the standard pdftotext -table +
 *   extract_gf.py pass, ties exactly ($0 diff both revenues $30,260,179K and expenditures
 *   $22,181,074K) on the FIRST extraction pass, no embedded-data fallback needed for this year.
 *
 * OPAQUE WORDPRESS SLUGS (no shared pattern, explicit per-year enumeration, NM's own instance
 *   of the KS/MS/MT opaque-URL pattern): FY2019 lives under `2021/01/Final-Version-State-of-
 *   New-Mexico-CAFR-2019-Audit-05-07-20.pdf` (pre-ACFR-rename "CAFR" naming), FY2022 under
 *   `2023/07/Agency-341-A-SoNM-FY22-ACFR-Final.pdf`, FY2023 under `2024/05/FINAL-341-A-State-
 *   of-New-Mexico-FY-2023-FS-5-15-2024.pdf`, FY2024 under `2025/04/FINAL-341a-State-of-New-
 *   Mexico-FY24-ACFR.pdf` (lowercase "a" in "341a", the sole naming variant across the loaded
 *   window). Every URL confirmed live (%PDF magic + size, all four years), never guessed from
 *   the FY. Landing page itself does not link the current ACFR -- confirmed only via the
 *   Wayback CDX crawl of the uploads directory (recon + this load's own FY2023 re-discovery).
 *
 * HONEST GAP (FY2020-FY2021, not chased beyond a bounded CDX search): a live crawl of
 *   nmdfa.state.nm.us's uploads directories for 2020-2022 found many single-agency "Financial
 *   Statements FY20/FY21" style filings (DFA's own agency-341 audit, a DIFFERENT and narrower
 *   document than the statewide "341-A"/"SoNM" ACFR used for every other loaded year) but NO
 *   statewide-ACFR-pattern PDF for FY2020 or FY2021 -- consistent with the recon's original
 *   3-year source enumeration (FY2019/FY2022/FY2024 only). Not pursued further this pass
 *   (effort-bounded, matches the NE "pre-FY2020, low priority" / KS "shallow window, not
 *   chased" precedent in this same tranche) -- durable loaded window is FY2019, FY2022
 *   (embedded), FY2023, FY2024 (4 of the aspirational 6 target years).
 *
 * 3-COLUMN LAYOUT: GENERAL FUND is the 1st of 3 (General Fund | Severance Tax/Debt Service
 *   Fund | Land Grant/Capital Projects Fund) -- extract_gf.py's position-anchor isolates
 *   General Fund regardless of column count, confirmed at both machine-readable bookends
 *   (FY2024 rev $30,530,269K / FY2019 rev $15,358,087K, exact $0 diff on BOTH revenues and
 *   expenditures) and independently on FY2023 ($30,260,179K / $22,181,074K, also $0 diff).
 *
 * CLEAN EXTRACTION (machine-readable years): FY2019/FY2023/FY2024 all tied to $0 diff on BOTH
 *   the revenue and expenditure printed GENERAL FUND totals on the FIRST extraction pass -- no
 *   wrapped labels, no rev_boundary sub-heading complications (both "General and Selective
 *   Taxes" and "Income Taxes" already end in the word "Taxes" in NM's own printed labels, so
 *   default_rev_name()'s Taxes-suffix logic is a no-op here -- no boundary config needed,
 *   unlike SC/MS/MT's "Taxes:" header pattern). Expenditures carry a single "Current" +
 *   "Debt Service" subsection pair with no dual-subsection collision.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment Income (Loss)" went NEGATIVE in FY2022 only: -91,222K (thousands) -- a real GAAP fair-value-of-investments loss, not an extraction artifact (independently confirmed twice: recon's hand-verification and this load's own re-transcription from the rendered page image both read the identical parenthesized value). Every other loaded year is positive (FY2024 +1,163,349K / FY2023 +419,897K / FY2019 +122,313K). The P2 clamp is the render path for FY2022 -- confirmed the FY2022 dry-run/live run renders the line at 0 with the signed magnitude in the label while the parent GF total stays the printed $26,161,736K.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/nm/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processNMRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New Mexico'; const STATE_ABBR = 'NM'; const POPULATION = 2_117_522;
const EXPECTED_MUNI_ID = '1e60ff76-c9fa-48d0-9442-042f61cd40ea';
const UNITS = 1_000; // NM ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2019: { url: 'https://www.nmdfa.state.nm.us/wp-content/uploads/2021/01/Final-Version-State-of-New-Mexico-CAFR-2019-Audit-05-07-20.pdf', date: '2019-06-30' },
  2022: { url: 'https://www.nmdfa.state.nm.us/wp-content/uploads/2023/07/Agency-341-A-SoNM-FY22-ACFR-Final.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.nmdfa.state.nm.us/wp-content/uploads/2024/05/FINAL-341-A-State-of-New-Mexico-FY-2023-FS-5-15-2024.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.nmdfa.state.nm.us/wp-content/uploads/2025/04/FINAL-341a-State-of-New-Mexico-FY24-ACFR.pdf', date: '2024-06-30' },
};
const dataSource = (fy) => `New Mexico State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — NM ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2019: { total: 15_358_087, confidence: 'actual', categories: [
    { name: 'General and Selective Taxes', total:    4_622_354 },
    { name: 'Income Taxes',                total:    1_694_822 },
    { name: 'Federal Revenue',             total:    6_714_376 },
    { name: 'Investment Income (Loss)',    total:      122_313 },
    { name: 'Rentals and Royalties',       total:    1_331_343 },
    { name: 'Charges for Services',        total:      164_815 },
    { name: 'Licenses, Fees, and Permits', total:      316_276 },
    { name: 'Assessments',                 total:       14_976 },
    { name: 'Miscellaneous and Other',     total:      376_812 },
  ]},
  2022: { total: 26_161_736, confidence: 'actual', categories: [
    { name: 'General and Selective Taxes', total:    7_098_087 },
    { name: 'Income Taxes',                total:    1_772_472 },
    { name: 'Federal Revenue',             total:   11_885_445 },
    { name: 'Investment Income (Loss)',    total:      -91_222 },
    { name: 'Rentals and Royalties',       total:    4_671_209 },
    { name: 'Charges for Services',        total:      191_057 },
    { name: 'Licenses, Fees, and Permits', total:      346_739 },
    { name: 'Assessments',                 total:       47_430 },
    { name: 'Miscellaneous and Other',     total:      240_519 },
  ]},
  2023: { total: 30_260_179, confidence: 'actual', categories: [
    { name: 'General and Selective Taxes', total:    8_089_331 },
    { name: 'Income Taxes',                total:    2_111_568 },
    { name: 'Federal Revenue',             total:   12_476_168 },
    { name: 'Investment Income (Loss)',    total:      419_897 },
    { name: 'Rentals and Royalties',       total:    5_936_929 },
    { name: 'Charges for Services',        total:      206_219 },
    { name: 'Licenses, Fees, and Permits', total:      364_446 },
    { name: 'Assessments',                 total:       52_420 },
    { name: 'Miscellaneous and Other',     total:      603_201 },
  ]},
  2024: { total: 30_530_269, confidence: 'actual', categories: [
    { name: 'General and Selective Taxes', total:    8_024_146 },
    { name: 'Income Taxes',                total:    2_820_364 },
    { name: 'Federal Revenue',             total:   11_691_941 },
    { name: 'Investment Income',           total:    1_163_349 },
    { name: 'Rentals and Royalties',       total:    5_353_926 },
    { name: 'Charges for Services',        total:      218_088 },
    { name: 'Licenses, Fees, and Permits', total:      417_201 },
    { name: 'Assessments',                 total:       55_507 },
    { name: 'Miscellaneous and Other',     total:      785_747 },
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
    const label = cat.total < 0 ? `${cat.name.trim()} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name.trim(); // WR-01: trim so a stray-space transcription can never fork a category name across years
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'New Mexico General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2019, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'New Mexico General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'nm-acfr-gf-revenue', base_url: 'https://www.nmdfa.state.nm.us/financial-control/statewide-financial-reporting-accountability-bureau/', fiscal_years: [2019,2022,2023,2024], municipality_id: muniId };
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
