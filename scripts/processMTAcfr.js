#!/usr/bin/env node
/**
 * Montana General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Montana Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the MT state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   MT state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-42): MT ACFR GF ~1.29x NASBO GF (FY2025 $3,453,804K vs FY2024 NASBO
 *   $2,684,000K) -- modest divergence, the SAME mechanism as ME/KS in this batch. Montana books
 *   Federal revenue overwhelmingly to a SEPARATE "Federal Special Revenue" major fund column
 *   ($4,309,139K Federal line in FY2025) -- the General column's own Federal line is only $22,186K
 *   FY2025 -- keeping the GAAP General Fund close to NASBO's own-source budgetary scope.
 *   Accepted-and-relabelled honestly (NJ/ME precedent, modest divergence).
 *
 * ANNUAL-VS-BIENNIAL RESOLVED (D-03/D-09 pre-flagged risk): Montana adopts its BUDGET biennially
 *   but publishes GAAP financials ANNUALLY -- every FY2015-FY2025 has its own individually-signed
 *   single-year ACFR on doa.mt.gov/SFSD/ACFR-PAFR, each cover reading "FOR THE FISCAL YEAR ENDED
 *   JUNE 30, {YYYY}" (confirmed directly on the FY2016 and FY2025 bookend PDFs). Each FY loaded as
 *   a distinct single-year actual -- no biennium is split or doubled, no FY-attribution exception.
 *   June-30 FY-end confirmed.
 *
 * "REVENUES (Note 14)" HEADER FIX (shared extract_gf.py fix, MT discovered it): MT's printed
 *   Governmental Funds statement titles its revenue section "REVENUES (Note 14)" -- a trailing
 *   statement-note reference the exact-match section-header test ('revenues'/'revenues:') did not
 *   recognize, silently skipping the ENTIRE revenue section (expenditures, plain "EXPENDITURES",
 *   tied fine -- the tell). extract_gf.py now strips any trailing parenthetical from a candidate
 *   header line before matching (reusable; item lines like "Investment earnings (losses)" reduce
 *   to a non-header token, so no false section trigger). All 11 years then tied on both sides.
 *
 * SINGLE "Taxes:" HEADER (SC/MS precedent, MT's own instance): MT prints one "Taxes:" subsection
 *   header ahead of its six tax lines (Natural resource, Individual income, Corporate income,
 *   Property, Fuel, Other) with NO closing header before the non-tax lines that follow (Charges
 *   for services..., Investment earnings, Securities lending, ..., Federal, Other revenues).
 *   rev_boundary='Charges for services' clears the sub-heading at the first genuinely non-tax line
 *   (present in the same position every loaded year) so only the true tax lines get the " taxes"
 *   suffix -- "Federal" is never mislabeled "Federal taxes". "Licenses/permits" prints AHEAD of the
 *   "Taxes:" header (sub=None), so it is unaffected.
 *
 * WIDE MULTI-FUND LAYOUT: GENERAL is the 1st column (General | State Special Revenue | Federal
 *   Special Revenue | ... | Total Governmental). extract_gf.py's position-anchor isolates the 1st
 *   numeric token (GENERAL), NOT the Total -- confirmed at both bookends (FY2025 rev $3,453,804K /
 *   FY2016 rev $2,039,879K, exact $0 diff on BOTH revenues and expenditures) and on all 11 loaded
 *   years. Expenditure side: "Capital outlay" and "Securities lending" print under the "Debt
 *   service:" subsection heading (a source-PDF grouping quirk, not a parsing artifact) --
 *   default_exp_name()'s Debt-service disambiguation only renames principal/interest lines, so both
 *   pass through unchanged with no collision.
 *
 * OPAQUE/VARYING FILENAMES: doa.mt.gov/SFSD/ACFR-PAFR lists every year's ACFR/CAFR at a
 *   non-derivable, wildly-varying filename (2015.pdf, 2016_ACFR.pdf, FY17_ACFR.pdf,
 *   Montana-CAFR-2018-web-version-protected.pdf, 2019-ACFR-Web-protected-002.pdf,
 *   2020-Montana-ACFR.pdf, Final-Montana-ACFR---2021-wo-signature.pdf [triple hyphen],
 *   Final-Montana-ACFR-2022-wo-signature.pdf, Montana-ACFR-2023-Final-w_-sig-on-file.pdf,
 *   Montana-ACFR-2024-sig-on-file.pdf, Montana-ACFR-2025-sig-on-file1.pdf [note the "1" suffix])
 *   -- pre-2021 files live under a /Documents/ subpath, FY2023-2025 do not. Every URL below was
 *   read directly off the ACFR-PAFR archive page and verified individually (%PDF magic + size
 *   >500KB, all 11 years), never guessed from the FY. FY2018/FY2019 filenames are "protected" but
 *   pdftotext -table extracts them cleanly (DE precedent: owner-password alone doesn't block text).
 *
 * WINDOW: FY2015-FY2025 (11 years). Recon's clean window was FY2016-FY2025 with FY2015 flagged as a
 *   load-time re-attempt candidate -- FY2015 tied at $0 diff on both sides on the first extraction
 *   pass, so it is INCLUDED. The archive's earliest listed file is 2015.pdf; pre-FY2015 is a future
 *   extension candidate if an older archive is found. Zero honest holes within the window -- all 11
 *   years tied exactly on the first pass, no wrapped labels, no OCR/font defects, no dual-subsection
 *   name collisions.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): No negative GF lines observed in any of the 11 loaded years, on either the revenue or expenditure side (full-cohort negative scan, not just bookends -- "Investment earnings (losses)" is positive throughout, FY2025 +$156,745K / FY2016 +$5,703K / FY2015 +$3,650K). Clamp path (clampForRender / P2) stays wired per ACFR-32 as the tranche-standard safety net, unexercised for MT.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/mt/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMTAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Montana'; const STATE_ABBR = 'MT'; const POPULATION = 1_084_225;
const EXPECTED_MUNI_ID = '6e085a8b-97e3-479d-8879-9bb7ff4f9fb1';
const UNITS = 1_000; // MT ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2015: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/2016_ACFR.pdf', date: '2016-06-30' },
  2017: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/FY17_ACFR.pdf', date: '2017-06-30' },
  2018: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/Montana-CAFR-2018-web-version-protected.pdf', date: '2018-06-30' },
  2019: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/2019-ACFR-Web-protected-002.pdf', date: '2019-06-30' },
  2020: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/2020-Montana-ACFR.pdf', date: '2020-06-30' },
  2021: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/Final-Montana-ACFR---2021-wo-signature.pdf', date: '2021-06-30' },
  2022: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Documents/Final-Montana-ACFR-2022-wo-signature.pdf', date: '2022-06-30' },
  2023: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2023-Final-w_-sig-on-file.pdf', date: '2023-06-30' },
  2024: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2024-sig-on-file.pdf', date: '2024-06-30' },
  2025: { url: 'https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2025-sig-on-file1.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Montana State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — MT ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2015: { total: 2_109_168, confidence: 'actual', categories: [
    { name: 'General government',                     total:      350_877 },
    { name: 'Public safety',                          total:      291_093 },
    { name: 'Health and human services',              total:      446_541 },
    { name: 'Education',                              total:      985_103 },
    { name: 'Natural resources',                      total:       32_582 },
    { name: 'Debt service — Principal retirement',    total:           17 },
    { name: 'Debt service — Interest/fiscal charges', total:          184 },
    { name: 'Capital outlay',                         total:        2_761 },
    { name: 'Securities lending',                     total:           10 },
  ]},
  2016: { total: 2_226_225, confidence: 'actual', categories: [
    { name: 'General government',                     total:      343_252 },
    { name: 'Public safety',                          total:      316_079 },
    { name: 'Health and human services',              total:      485_714 },
    { name: 'Education',                              total:    1_036_830 },
    { name: 'Natural resources',                      total:       35_008 },
    { name: 'Debt service — Principal retirement',    total:           48 },
    { name: 'Debt service — Interest/fiscal charges', total:          193 },
    { name: 'Capital outlay',                         total:        9_085 },
    { name: 'Securities lending',                     total:           16 },
  ]},
  2017: { total: 2_315_122, confidence: 'actual', categories: [
    { name: 'General government',                     total:      353_582 },
    { name: 'Public safety',                          total:      318_926 },
    { name: 'Health and human services',              total:      538_738 },
    { name: 'Education',                              total:    1_058_596 },
    { name: 'Natural resources',                      total:       37_738 },
    { name: 'Debt service — Principal retirement',    total:           56 },
    { name: 'Debt service — Interest/fiscal charges', total:          197 },
    { name: 'Capital outlay',                         total:        7_270 },
    { name: 'Securities lending',                     total:           19 },
  ]},
  2018: { total: 2_220_270, confidence: 'actual', categories: [
    { name: 'General government',                     total:      350_591 },
    { name: 'Public safety',                          total:      311_184 },
    { name: 'Health and human services',              total:      517_528 },
    { name: 'Education',                              total:    1_007_891 },
    { name: 'Natural resources',                      total:       31_394 },
    { name: 'Debt service — Principal retirement',    total:           22 },
    { name: 'Debt service — Interest/fiscal charges', total:          283 },
    { name: 'Capital outlay',                         total:        1_377 },
  ]},
  2019: { total: 2_273_659, confidence: 'actual', categories: [
    { name: 'General government',                     total:      360_596 },
    { name: 'Public safety',                          total:      313_996 },
    { name: 'Health and human services',              total:      526_712 },
    { name: 'Education',                              total:    1_036_533 },
    { name: 'Natural resources',                      total:       32_012 },
    { name: 'Debt service — Principal retirement',    total:           15 },
    { name: 'Debt service — Interest/fiscal charges', total:          216 },
    { name: 'Capital outlay',                         total:        3_579 },
  ]},
  2020: { total: 2_305_354, confidence: 'actual', categories: [
    { name: 'General government',                     total:      372_209 },
    { name: 'Public safety',                          total:      321_661 },
    { name: 'Health and human services',              total:      480_752 },
    { name: 'Education',                              total:    1_082_324 },
    { name: 'Natural resources',                      total:       36_263 },
    { name: 'Debt service — Principal retirement',    total:          208 },
    { name: 'Debt service — Interest/fiscal charges', total:          256 },
    { name: 'Capital outlay',                         total:       11_681 },
  ]},
  2021: { total: 2_352_529, confidence: 'actual', categories: [
    { name: 'General government',                     total:      385_619 },
    { name: 'Public safety',                          total:      310_373 },
    { name: 'Transportation',                         total:          174 },
    { name: 'Health and human services',              total:      490_805 },
    { name: 'Education',                              total:    1_119_344 },
    { name: 'Natural resources',                      total:       38_226 },
    { name: 'Debt service — Principal retirement',    total:          295 },
    { name: 'Debt service — Interest/fiscal charges', total:          247 },
    { name: 'Capital outlay',                         total:        7_436 },
    { name: 'Securities lending',                     total:           10 },
  ]},
  2022: { total: 2_401_873, confidence: 'actual', categories: [
    { name: 'General government',                     total:      383_413 },
    { name: 'Public safety',                          total:      321_168 },
    { name: 'Transportation',                         total:            1 },
    { name: 'Health and human services',              total:      504_083 },
    { name: 'Education',                              total:    1_140_171 },
    { name: 'Natural resources',                      total:       38_521 },
    { name: 'Debt service — Principal retirement',    total:        9_098 },
    { name: 'Debt service — Interest/fiscal charges', total:        1_222 },
    { name: 'Capital outlay',                         total:        4_194 },
    { name: 'Securities lending',                     total:            2 },
  ]},
  2023: { total: 2_689_563, confidence: 'actual', categories: [
    { name: 'General government',                     total:      408_047 },
    { name: 'Public safety',                          total:      365_312 },
    { name: 'Transportation',                         total:       15_000 },
    { name: 'Health and human services',              total:      616_588 },
    { name: 'Education',                              total:    1_195_410 },
    { name: 'Natural resources',                      total:       63_697 },
    { name: 'Debt service — Principal retirement',    total:       11_568 },
    { name: 'Debt service — Interest/fiscal charges', total:        1_533 },
    { name: 'Capital outlay',                         total:       12_312 },
    { name: 'Securities lending',                     total:           96 },
  ]},
  2024: { total: 2_754_747, confidence: 'actual', categories: [
    { name: 'General government',                     total:      676_508 },
    { name: 'Public safety',                          total:      408_684 },
    { name: 'Transportation',                         total:       29_642 },
    { name: 'Health and human services',              total:      722_679 },
    { name: 'Education',                              total:      783_463 },
    { name: 'Natural resources',                      total:      101_018 },
    { name: 'Debt service — Principal retirement',    total:       11_958 },
    { name: 'Debt service — Interest/fiscal charges', total:        1_932 },
    { name: 'Capital outlay',                         total:       18_524 },
    { name: 'Securities lending',                     total:          339 },
  ]},
  2025: { total: 2_947_803, confidence: 'actual', categories: [
    { name: 'General government',                     total:      619_059 },
    { name: 'Public safety',                          total:      428_333 },
    { name: 'Transportation',                         total:       17_495 },
    { name: 'Health and human services',              total:      800_055 },
    { name: 'Education',                              total:      903_357 },
    { name: 'Natural resources',                      total:      137_245 },
    { name: 'Debt service — Principal retirement',    total:       11_802 },
    { name: 'Debt service — Interest/fiscal charges', total:        2_185 },
    { name: 'Capital outlay',                         total:       27_042 },
    { name: 'Securities lending',                     total:        1_230 },
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
  return { jsonTree: [{ n: 'Montana General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Montana General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'mt-acfr-gf-operating', base_url: 'https://doa.mt.gov/SFSD/ACFR-PAFR', fiscal_years: [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
