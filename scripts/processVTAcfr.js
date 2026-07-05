#!/usr/bin/env node
/**
 * Vermont General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Vermont Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in dollars).
 *
 * Phase 113. Replaces the NASBO operating rows on the VT state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   VT state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-51): VT ACFR GF ~1.01x NASBO GF (FY2025 $2,543,030,123 vs FY2024 NASBO
 *   $2,510,000,000) -- the SMALLEST divergence in Batch 4 (SD FY121-03 ~1.03x precedent, even
 *   tighter here). Vermont books Federal grants overwhelmingly to the SEPARATE Transportation
 *   Fund column (FY2025 Federal grants $410,507,441 in Transportation vs $0 in General) --
 *   the General column's own Federal grants line is a dash (blank) at every loaded year --
 *   keeping the GAAP General Fund essentially at parity with NASBO's own-source budgetary
 *   scope. Accepted-and-relabelled honestly (SD/NE precedent, near-parity).
 *
 * UNITS = DOLLARS, NOT THOUSANDS (units=1 hard-set) -- VT's printed statement is already in
 *   whole dollars. Bookends verified at load: FY2025 $2,543,030,123 / FY2015 $1,392,033,404
 *   (both sides, $0 diff on revenues AND expenditures, confirmed on all 11 loaded years).
 *
 * BROWSER USER-AGENT REQUIRED (finance.vermont.gov 403s bare curl, tn.gov precedent): every
 *   fetch sent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like
 *   Gecko) Chrome/120 Safari/537.36' -- all 11 PDFs downloaded cleanly (%PDF magic + size
 *   guard, no soft-404s).
 *
 * NAMING (3-way exception, the VT naming trap): FY2021-FY2025 use
 *   VERMONT_{YYYY}_ACFR_FINAL.pdf (FY2021 alone lives under the /Rpts_Pubs/CAFR/ subpath,
 *   FY2022-2025 sit directly under /documents/); FY2015-FY2018 use the older
 *   FIN-{YYYY}_CAFR_FINAL.pdf naming; FY2020 breaks the FIN- pattern with
 *   VERMONT_2020_CAFR_FINAL.pdf; FY2019 breaks it further with the bare 2019_CAFR_FINAL.pdf
 *   (no FIN- prefix, no VERMONT_ prefix) -- all three exceptions special-cased in the SOURCES
 *   map above, read directly off the 117-BATCH4-SOURCES.md VT Detail Block, never guessed
 *   from the FY.
 *
 * ZERO/ONE-WHITESPACE DOT-LEADER DEFECT (FY2024/FY2025 discovered it, shared extract_gf.py
 *   fix): VT's `pdftotext -table` rendering of the wider FY2024/FY2025 layout occasionally
 *   runs the dot-leader straight into the GF value with NO or exactly ONE whitespace char
 *   ("Human services....758,416,630", "General education.... 287,833,468") instead of the
 *   normal dot-leader-then-2+-spaces-then-value shape every other row uses -- the prior
 *   whitespace-only separator regex silently dropped both rows (their labels absorbed the
 *   value as unparsed trailing text), understating GF Total Expenditures by exactly the sum
 *   of the two dropped lines ($1,046,250,098 FY2025). Fixed generically in extract_gf.py's
 *   split_row(): the separator now accepts any MIX of 2+ dot/whitespace chars immediately
 *   followed by the value token (safe superset -- normal rows never have a digit/$/-
 *   immediately after their trailing dot-or-space run, which stays >=2 chars either way).
 *   Re-verified zero regression against ND/SD/MT/NE's already-extracted text (identical
 *   sums/ties before and after, including SD's known hand-patched/hand-transcribed
 *   non-tying years, which fail identically both ways).
 *
 * COLON-LESS SUBSECTION HEADERS (VT-specific label cleanup, no tie impact): VT's revenue
 *   section prints three subsection headers with NO trailing colon ("Taxes", "Earnings of
 *   departments", "Licenses") -- extract_gf.py's colon-based sub-heading detector only
 *   recognizes ':'-terminated headers, so these three merged into the FIRST following item's
 *   label via the generic wrapped-label pending-accumulator (KY precedent, designed for
 *   genuine two-line wraps) -- e.g. "Taxes" + "Personal income tax" -> "Taxes Personal income
 *   tax". A small one-off post-process pass over vt_all.json (documented in the load log)
 *   strips the three known header-prefix strings back off the merged labels
 *   ("Personal income tax", "Fees", "Business") -- values untouched, ties unaffected,
 *   confirmed identical before/after on all 11 years.
 *
 * 7-COLUMN LAYOUT: GENERAL FUND is the 1st of 7 (General Fund | Transportation Fund |
 *   Education Fund | Special Fund | Federal Revenue Fund | Global Commitment Fund | Non-major
 *   Governmental Funds | Total) -- extract_gf.py's position-anchor isolates General regardless
 *   of the total column count -- confirmed at both bookends (FY2025 rev $2,543,030,123 /
 *   FY2015 rev $1,392,033,404, exact $0 diff on BOTH revenues and expenditures) and on all 11
 *   loaded years. Sales and use tax / Motor fuels tax / Purchase and use tax / Statewide
 *   education tax / Federal grants are routinely blank ("-") in the General column at later
 *   years (diverted to Education/Transportation/Federal Revenue Fund columns instead) --
 *   correctly extracted as None/skipped, not a defect.
 *
 * CLEAN WINDOW: FY2015-FY2025 (11 years, the full recon target window), ZERO honest holes --
 *   every year ties $0 diff on both the revenue and expenditure printed GENERAL FUND totals
 *   after the split_row generalization above.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Full-cohort negative scan (all 11 loaded years, both revenue and expenditure sections): ZERO negative GF line items found anywhere -- "Investment income"/"Investment income/(loss)" is positive throughout (FY2025 +$60,960,064 / FY2015 +$304,938, the recon-confirmed bookends). The column header itself flags a "(loss)" possibility (confirmed present from later years onward) but no interior year triggers it. Clamp path (clampForRender / P2) stays wired per ACFR-32 as the tranche-standard safety net, unexercised for VT.
 *
 * UNITS = dollars (already dollars, no scaling). Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 dollars; extraction: pdftotext -table
 *   on local copies in _acfr-work/vt/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processVTAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Vermont'; const STATE_ABBR = 'VT'; const POPULATION = 647_064;
const EXPECTED_MUNI_ID = '563d6f1c-ce2b-4071-938f-01725d283504';
const UNITS = 1; // VT ACFR is in dollars (already dollars — no scaling)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2015: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2015_CAFR_FINAL.pdf', date: '2015-06-30' },
  2016: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2016_CAFR_FINAL.pdf', date: '2016-06-30' },
  2017: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2017_CAFR_FINAL.pdf', date: '2017-06-30' },
  2018: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2018_CAFR_FINAL.pdf', date: '2018-06-30' },
  2019: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/2019_CAFR_FINAL.pdf', date: '2019-06-30' },
  2020: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/VERMONT_2020_CAFR_FINAL.pdf', date: '2020-06-30' },
  2021: { url: 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/VERMONT_2021_ACFR_FINAL.pdf', date: '2021-06-30' },
  2022: { url: 'https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2022_ACFR_FINAL.pdf', date: '2022-06-30' },
  2023: { url: 'https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2023_ACFR_FINAL.pdf', date: '2023-06-30' },
  2024: { url: 'https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2024_ACFR_FINAL.pdf', date: '2024-06-30' },
  2025: { url: 'https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2025_ACFR_FINAL.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Vermont State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — VT ACFR, GENERAL FUND column (raw dollars; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2015: { total: 828_929_456, confidence: 'actual', categories: [
    { name: 'General government',                 total:   74_490_741 },
    { name: 'Protection to persons and property', total:  128_210_961 },
    { name: 'Human services',                     total:  401_635_451 },
    { name: 'Labor',                              total:    2_950_771 },
    { name: 'General education',                  total:  178_804_787 },
    { name: 'Natural resources',                  total:   28_191_874 },
    { name: 'Commerce and community development', total:   14_644_871 },
  ]},
  2016: { total: 803_696_532, confidence: 'actual', categories: [
    { name: 'General government',                 total:   77_099_307 },
    { name: 'Protection to persons and property', total:  133_480_662 },
    { name: 'Human services',                     total:  367_375_164 },
    { name: 'Labor',                              total:    3_256_821 },
    { name: 'General education',                  total:  181_097_686 },
    { name: 'Natural resources',                  total:   26_685_423 },
    { name: 'Commerce and community development', total:   14_701_469 },
  ]},
  2017: { total: 896_218_729, confidence: 'actual', categories: [
    { name: 'General government',                 total:   78_858_432 },
    { name: 'Protection to persons and property', total:  144_869_787 },
    { name: 'Human services',                     total:  428_741_001 },
    { name: 'Labor',                              total:    3_934_111 },
    { name: 'General education',                  total:  195_798_068 },
    { name: 'Natural resources',                  total:   28_323_940 },
    { name: 'Commerce and community development', total:   15_693_390 },
  ]},
  2018: { total: 926_931_860, confidence: 'actual', categories: [
    { name: 'General government',                 total:   79_677_259 },
    { name: 'Protection to persons and property', total:  149_643_251 },
    { name: 'Human services',                     total:  422_741_459 },
    { name: 'Labor',                              total:    3_163_000 },
    { name: 'General education',                  total:  226_667_698 },
    { name: 'Natural resources',                  total:   28_556_611 },
    { name: 'Commerce and community development', total:   16_482_582 },
  ]},
  2019: { total: 1_023_627_442, confidence: 'actual', categories: [
    { name: 'General government',                 total:  118_181_654 },
    { name: 'Protection to persons and property', total:  161_357_698 },
    { name: 'Human services',                     total:  434_300_766 },
    { name: 'Labor',                              total:    3_080_250 },
    { name: 'General education',                  total:  260_505_401 },
    { name: 'Natural resources',                  total:   28_654_610 },
    { name: 'Commerce and community development', total:   17_547_063 },
  ]},
  2020: { total: 994_638_981, confidence: 'actual', categories: [
    { name: 'General government',                 total:   92_770_233 },
    { name: 'Protection to persons and property', total:  163_006_133 },
    { name: 'Human services',                     total:  434_659_642 },
    { name: 'Labor',                              total:    3_995_159 },
    { name: 'General education',                  total:  252_702_652 },
    { name: 'Natural resources',                  total:   30_183_250 },
    { name: 'Commerce and community development', total:   17_147_249 },
    { name: 'Debt service',                       total:      174_663 },
  ]},
  2021: { total: 1_045_477_912, confidence: 'actual', categories: [
    { name: 'General government',                 total:  147_990_010 },
    { name: 'Protection to persons and property', total:  138_572_394 },
    { name: 'Human services',                     total:  412_308_342 },
    { name: 'Labor',                              total:    3_519_159 },
    { name: 'General education',                  total:  286_287_734 },
    { name: 'Natural resources',                  total:   30_783_918 },
    { name: 'Commerce and community development', total:   24_747_397 },
    { name: 'Debt service',                       total:    1_268_958 },
  ]},
  2022: { total: 1_467_335_595, confidence: 'actual', categories: [
    { name: 'General government',                 total:  176_642_305 },
    { name: 'Protection to persons and property', total:  178_429_613 },
    { name: 'Human services',                     total:  474_589_087 },
    { name: 'Labor',                              total:    4_795_430 },
    { name: 'General education',                  total:  456_471_185 },
    { name: 'Natural resources',                  total:   40_014_703 },
    { name: 'Commerce and community development', total:  135_780_902 },
    { name: 'Transportation',                     total:      244_539 },
    { name: 'Capital outlay',                     total:      254_793 },
    { name: 'Debt service',                       total:      113_038 },
  ]},
  2023: { total: 1_452_737_080, confidence: 'actual', categories: [
    { name: 'General government',                 total:  112_002_934 },
    { name: 'Protection to persons and property', total:  211_803_461 },
    { name: 'Human services',                     total:  642_352_603 },
    { name: 'Labor',                              total:    4_114_040 },
    { name: 'General education',                  total:  340_959_815 },
    { name: 'Natural resources',                  total:   46_204_332 },
    { name: 'Commerce and community development', total:   65_059_236 },
    { name: 'Transportation',                     total:   14_735_006 },
    { name: 'Capital outlay',                     total:   11_599_001 },
    { name: 'Debt service',                       total:    3_906_652 },
  ]},
  2024: { total: 1_695_914_208, confidence: 'actual', categories: [
    { name: 'General government',                 total:  143_916_286 },
    { name: 'Protection to persons and property', total:  246_493_847 },
    { name: 'Human services',                     total:  744_249_740 },
    { name: 'Labor',                              total:    3_028_235 },
    { name: 'General education',                  total:  377_612_800 },
    { name: 'Natural resources',                  total:   49_473_255 },
    { name: 'Commerce and community development', total:  111_185_258 },
    { name: 'Transportation',                     total:   11_760_997 },
    { name: 'Capital outlay',                     total:    3_703_805 },
    { name: 'Debt service',                       total:    4_489_985 },
  ]},
  2025: { total: 1_627_200_216, confidence: 'actual', categories: [
    { name: 'General government',                 total:  142_833_302 },
    { name: 'Protection to persons and property', total:  278_650_041 },
    { name: 'Human services',                     total:  758_416_630 },
    { name: 'Labor',                              total:   13_486_997 },
    { name: 'General education',                  total:  287_833_468 },
    { name: 'Natural resources',                  total:   62_421_523 },
    { name: 'Commerce and community development', total:   70_972_414 },
    { name: 'Transportation',                     total:    5_870_548 },
    { name: 'Capital outlay',                     total:    2_554_926 },
    { name: 'Debt service',                       total:    4_160_367 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
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
  return { jsonTree: [{ n: 'Vermont General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, dollars×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Vermont General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'vt-acfr-gf-operating', base_url: 'https://finance.vermont.gov/reports-and-publications/annual-comprehensive-financial-report', fiscal_years: [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
