#!/usr/bin/env node
/**
 * Arkansas General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Arkansas Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the AR state node → pure insert keyed (muni,fy,'revenue').
 *   AR state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-34): AR ACFR GF ~3.96x NASBO GF (FY2024 $24,045,611K vs FY2024 NASBO
 *   $6,075,000K) -- the WIDEST scope divergence in the entire ACFR cohort to date. Arkansas is a
 *   SINGLE-fund state: the whole Governmental Fund statement IS the General Fund (no major/nonmajor
 *   split), so ~$11.2B of Intergovernmental/federal revenue sits inside the reported GF column that
 *   NASBO's narrower budgetary concept excludes. Accepted-and-relabelled honestly with a prominent basis note.
 *
 * SINGLE-FUND LAYOUT: title is "Statement of Revenues, Expenditures, and Changes in Fund Balance"
 *   (singular) over "Governmental Fund" (singular); GENERAL FUND is the sole column. extract_gf.py
 *   gained singular-fund detection + space-tolerant section headers (some AR years letter-space
 *   "Re ve nue s :") -- reusable generalizations.
 *
 * HONEST HOLE (FY2025): 2025-Arkansas-ACFR.pdf is a valid ~49MB PDF but Type-3-font garbled (no
 *   ToUnicode CMap, pdftotext unreadable, KY FY2023 precedent) -> NOT loaded. Window ends FY2024;
 *   re-check for a corrected upload / browser-OCR at a future touch.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Investment earnings (loss) positive at both bookends (FY2024 +$442,735K, FY2003 +$46,139K); every loaded year scanned - clamp is the render path if any interior year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ar/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processARRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Arkansas'; const STATE_ABBR = 'AR'; const POPULATION = 3_011_524;
const EXPECTED_MUNI_ID = '5efd2f95-6deb-4118-a07a-9f48cdca681c';
const UNITS = 1_000; // AR ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2003: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2003.pdf', date: '2003-06-30' },
  2004: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2004.pdf', date: '2004-06-30' },
  2005: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2005.pdf', date: '2005-06-30' },
  2006: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2024.pdf', date: '2024-06-30' },
};
const dataSource = (fy) => `Arkansas State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — AR ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2003: { total: 9_434_421, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    1_714_603 },
    { name: 'Consumer sales taxes',                total:    1_770_946 },
    { name: 'Gas and motor carrier taxes',         total:      439_614 },
    { name: 'Other taxes',                         total:      638_510 },
    { name: 'Intergovernmental',                   total:    3_823_171 },
    { name: 'Licenses, permits, and fees',         total:      750_872 },
    { name: 'Investment earnings',                 total:       46_139 },
    { name: 'Miscellaneous',                       total:      250_566 },
  ]},
  2004: { total: 10_327_672, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    1_914_067 },
    { name: 'Consumers sales and use taxes',       total:    1_951_475 },
    { name: 'Gas and motor carrier taxes',         total:      450_444 },
    { name: 'Other taxes',                         total:      694_802 },
    { name: 'Intergovernmental',                   total:    4_249_189 },
    { name: 'Licenses, permits, and fees',         total:      717_092 },
    { name: 'Investment earnings',                 total:       36_651 },
    { name: 'Miscellaneous',                       total:      313_952 },
  ]},
  2005: { total: 11_285_100, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_169_849 },
    { name: 'Consumers sales and use taxes',       total:    2_382_865 },
    { name: 'Gas and motor carrier taxes',         total:      450_269 },
    { name: 'Other taxes',                         total:      721_144 },
    { name: 'Intergovernmental',                   total:    4_418_148 },
    { name: 'Licenses, permits, and fees',         total:      836_688 },
    { name: 'Investment earnings',                 total:       57_999 },
    { name: 'Miscellaneous',                       total:      248_138 },
  ]},
  2006: { total: 11_907_985, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_374_853 },
    { name: 'Consumers sales and use taxes',       total:    2_519_443 },
    { name: 'Gas and motor carrier taxes',         total:      456_569 },
    { name: 'Other taxes',                         total:      760_799 },
    { name: 'Intergovernmental',                   total:    4_540_408 },
    { name: 'Licenses, permits, and fees',         total:      858_136 },
    { name: 'Investment earnings',                 total:       96_369 },
    { name: 'Miscellaneous',                       total:      301_408 },
  ]},
  2007: { total: 12_318_533, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_515_958 },
    { name: 'Consumer sales and use taxes',        total:    2_624_325 },
    { name: 'Gas and motor carrier taxes',         total:      463_362 },
    { name: 'Other taxes',                         total:      784_936 },
    { name: 'Intergovernmental',                   total:    4_594_212 },
    { name: 'Licenses, permits, and fees',         total:      886_106 },
    { name: 'Investment earnings',                 total:      162_603 },
    { name: 'Miscellaneous',                       total:      287_031 },
  ]},
  2008: { total: 12_680_212, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_644_852 },
    { name: 'Consumers sales and use taxes',       total:    2_551_222 },
    { name: 'Gas and motor carrier taxes',         total:      456_216 },
    { name: 'Other taxes',                         total:      790_122 },
    { name: 'Intergovernmental',                   total:    4_832_649 },
    { name: 'Licenses, permits, and fees',         total:      957_424 },
    { name: 'Investment earnings',                 total:      172_081 },
    { name: 'Miscellaneous',                       total:      275_646 },
  ]},
  2009: { total: 13_097_507, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_549_965 },
    { name: 'Consumers sales and use taxes',       total:    2_502_403 },
    { name: 'Gas and motor carrier taxes',         total:      444_573 },
    { name: 'Other taxes',                         total:      813_733 },
    { name: 'Intergovernmental',                   total:    5_394_538 },
    { name: 'Licenses, permits and fees',          total:    1_031_568 },
    { name: 'Investment earnings',                 total:       82_681 },
    { name: 'Miscellaneous',                       total:      278_046 },
  ]},
  2010: { total: 14_025_583, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_471_420 },
    { name: 'Consumers sales and use taxes',       total:    2_390_819 },
    { name: 'Gas and motor carrier taxes',         total:      449_754 },
    { name: 'Other taxes',                         total:      903_618 },
    { name: 'Intergovernmental',                   total:    6_364_695 },
    { name: 'Licenses, permits and fees',          total:    1_055_693 },
    { name: 'Investment earnings',                 total:       52_809 },
    { name: 'Miscellaneous',                       total:      336_775 },
  ]},
  2011: { total: 14_699_674, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_697_352 },
    { name: 'Consumers sales and use taxes',       total:    2_491_772 },
    { name: 'Gas and motor carrier taxes',         total:      444_232 },
    { name: 'Other taxes',                         total:      927_452 },
    { name: 'Intergovernmental',                   total:    6_642_135 },
    { name: 'Licenses, permits and fees',          total:    1_109_258 },
    { name: 'Investment earnings',                 total:       43_232 },
    { name: 'Miscellaneous',                       total:      344_241 },
  ]},
  2012: { total: 14_719_520, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    2_798_083 },
    { name: 'Consumers sales and use taxes',       total:    2_552_282 },
    { name: 'Gas and motor carrier taxes',         total:      442_772 },
    { name: 'Other taxes',                         total:      944_406 },
    { name: 'Intergovernmental',                   total:    6_402_940 },
    { name: 'Licenses, permits and fees',          total:    1_186_346 },
    { name: 'Investment earnings',                 total:       40_374 },
    { name: 'Miscellaneous',                       total:      352_317 },
  ]},
  2013: { total: 14_715_155, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_011_514 },
    { name: 'Consumers sales and use taxes',       total:    2_571_964 },
    { name: 'Gas and motor carrier taxes',         total:      436_390 },
    { name: 'Other taxes',                         total:      956_482 },
    { name: 'Intergovernmental',                   total:    6_232_982 },
    { name: 'Licenses, permits and fees',          total:    1_182_989 },
    { name: 'Investment earnings',                 total:       -1_911 },
    { name: 'Miscellaneous',                       total:      324_745 },
  ]},
  2014: { total: 15_530_914, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_002_722 },
    { name: 'Consumers sales and use taxes',       total:    2_880_146 },
    { name: 'Gas and motor carrier taxes',         total:      433_108 },
    { name: 'Other taxes',                         total:      997_563 },
    { name: 'Intergovernmental',                   total:    6_584_513 },
    { name: 'Licenses, permits and fees',          total:    1_253_365 },
    { name: 'Investment earnings',                 total:       70_578 },
    { name: 'Miscellaneous',                       total:      308_919 },
  ]},
  2015: { total: 16_893_127, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_207_038 },
    { name: 'Consumers sales and use taxes',       total:    2_929_426 },
    { name: 'Gas and motor carrier taxes',         total:      443_058 },
    { name: 'Other taxes',                         total:    1_005_951 },
    { name: 'Intergovernmental',                   total:    7_564_360 },
    { name: 'Licenses, permits and fees',          total:    1_368_678 },
    { name: 'Investment earnings',                 total:       40_471 },
    { name: 'Miscellaneous',                       total:      334_145 },
  ]},
  2016: { total: 17_333_233, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_219_066 },
    { name: 'Consumers sales and use taxes',       total:    3_031_524 },
    { name: 'Gas and motor carrier taxes',         total:      462_761 },
    { name: 'Other taxes',                         total:      989_962 },
    { name: 'Intergovernmental',                   total:    7_888_337 },
    { name: 'Licenses, permits and fees',          total:    1_327_225 },
    { name: 'Investment earnings',                 total:       84_100 },
    { name: 'Miscellaneous',                       total:      330_258 },
  ]},
  2017: { total: 17_915_395, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_165_911 },
    { name: 'Consumers sales and use taxes',       total:    3_113_922 },
    { name: 'Gas and motor carrier taxes',         total:      469_542 },
    { name: 'Other taxes',                         total:    1_023_060 },
    { name: 'Intergovernmental',                   total:    8_443_611 },
    { name: 'Licenses, permits and fees',          total:    1_291_699 },
    { name: 'Investment earnings',                 total:       60_201 },
    { name: 'Miscellaneous',                       total:      347_449 },
  ]},
  2018: { total: 17_966_567, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_232_455 },
    { name: 'Consumers sales and use taxes',       total:    3_218_765 },
    { name: 'Gas and motor carrier taxes',         total:      475_225 },
    { name: 'Other taxes',                         total:    1_044_078 },
    { name: 'Intergovernmental',                   total:    8_231_911 },
    { name: 'Licenses, permits and fees',          total:    1_293_003 },
    { name: 'Investment earnings',                 total:       61_087 },
    { name: 'Miscellaneous',                       total:      410_043 },
  ]},
  2019: { total: 18_527_679, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_532_123 },
    { name: 'Consumers sales and use taxes',       total:    3_280_703 },
    { name: 'Gas and motor carrier taxes',         total:      476_683 },
    { name: 'Other taxes',                         total:    1_057_303 },
    { name: 'Intergovernmental',                   total:    8_242_021 },
    { name: 'Licenses, permits and fees',          total:    1_304_469 },
    { name: 'Investment earnings',                 total:      187_790 },
    { name: 'Miscellaneous',                       total:      446_587 },
  ]},
  2020: { total: 19_761_471, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_654_603 },
    { name: 'Consumers sales and use taxes',       total:    3_410_118 },
    { name: 'Gas and motor carrier taxes',         total:      477_660 },
    { name: 'Other taxes',                         total:    1_204_519 },
    { name: 'Intergovernmental',                   total:    9_235_843 },
    { name: 'Licenses, permits and fees',          total:    1_273_012 },
    { name: 'Investment earnings',                 total:      110_418 },
    { name: 'Miscellaneous',                       total:      395_298 },
  ]},
  2021: { total: 22_391_839, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_921_586 },
    { name: 'Consumers sales and use taxes',       total:    3_860_050 },
    { name: 'Gas and motor carrier taxes',         total:      488_737 },
    { name: 'Other taxes',                         total:    1_410_108 },
    { name: 'Intergovernmental',                   total:   10_836_160 },
    { name: 'Licenses, permits and fees',          total:    1_369_747 },
    { name: 'Investment earnings (loss)',          total:      -25_725 },
    { name: 'Miscellaneous',                       total:      531_176 },
  ]},
  2022: { total: 24_464_227, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    4_490_595 },
    { name: 'Consumers sales and use taxes',       total:    4_199_145 },
    { name: 'Gas and motor carrier taxes',         total:      506_521 },
    { name: 'Other taxes',                         total:    1_571_273 },
    { name: 'Intergovernmental',                   total:   12_177_163 },
    { name: 'Licenses, permits and fees',          total:    1_441_788 },
    { name: 'Investment earnings (loss)',          total:     -472_773 },
    { name: 'Miscellaneous',                       total:      550_515 },
  ]},
  2023: { total: 25_280_362, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_932_123 },
    { name: 'Consumers sales and use taxes',       total:    4_559_747 },
    { name: 'Gas and motor carrier taxes',         total:      494_805 },
    { name: 'Other taxes',                         total:    1_629_533 },
    { name: 'Intergovernmental',                   total:   12_490_430 },
    { name: 'Licenses, permits, and fees',         total:    1_520_617 },
    { name: 'Investment earnings (loss)',          total:       49_453 },
    { name: 'Miscellaneous',                       total:      603_654 },
  ]},
  2024: { total: 24_045_611, confidence: 'actual', categories: [
    { name: 'Personal and corporate income taxes', total:    3_521_101 },
    { name: 'Consumers sales and use taxes',       total:    4_639_049 },
    { name: 'Gas and motor carrier taxes',         total:      506_911 },
    { name: 'Other taxes',                         total:    1_628_312 },
    { name: 'Intergovernmental',                   total:   11_221_223 },
    { name: 'Licenses, permits, and fees',         total:    1_516_933 },
    { name: 'Investment earnings (loss)',          total:      442_735 },
    { name: 'Miscellaneous',                       total:      569_347 },
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
  return { jsonTree: [{ n: 'Arkansas General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'Arkansas General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ar-acfr-gf-revenue', base_url: 'https://www.dfa.arkansas.gov/office/accounting/annual-comprehensive-financial-report/', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
