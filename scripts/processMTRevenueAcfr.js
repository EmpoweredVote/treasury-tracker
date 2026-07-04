#!/usr/bin/env node
/**
 * Montana General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Montana Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the MT state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/mt/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMTRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Montana State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — MT ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2015: { total: 2_122_413, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      122_946 },
    { name: 'Natural resource taxes',                          total:      116_169 },
    { name: 'Individual income taxes',                         total:    1_158_636 },
    { name: 'Corporate income taxes',                          total:      171_836 },
    { name: 'Property taxes',                                  total:      247_365 },
    { name: 'Other taxes',                                     total:      225_392 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       37_701 },
    { name: 'Investment earnings',                             total:        3_650 },
    { name: 'Securities lending income',                       total:           88 },
    { name: 'Sale of documents/merchandise/property',          total:          368 },
    { name: 'Rentals/leases/royalties',                        total:           18 },
    { name: 'Grants/contracts/donations',                      total:        9_777 },
    { name: 'Federal',                                         total:       27_784 },
    { name: 'Federal indirect cost recoveries',                total:          204 },
    { name: 'Other revenues',                                  total:          479 },
  ]},
  2016: { total: 2_039_879, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      125_357 },
    { name: 'Natural resource taxes',                          total:       65_218 },
    { name: 'Individual income taxes',                         total:    1_170_799 },
    { name: 'Corporate income taxes',                          total:      119_539 },
    { name: 'Property taxes',                                  total:      258_864 },
    { name: 'Other taxes',                                     total:      229_026 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       38_370 },
    { name: 'Investment earnings',                             total:        5_703 },
    { name: 'Securities lending income',                       total:           32 },
    { name: 'Sale of documents/merchandise/property',          total:          360 },
    { name: 'Rentals/leases/royalties',                        total:           43 },
    { name: 'Contributions/premiums',                          total:        1_736 },
    { name: 'Grants/contracts/donations',                      total:        7_388 },
    { name: 'Federal',                                         total:       16_126 },
    { name: 'Federal indirect cost recoveries',                total:          216 },
    { name: 'Other revenues',                                  total:        1_102 },
  ]},
  2017: { total: 2_065_370, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      125_737 },
    { name: 'Natural resource taxes',                          total:       71_042 },
    { name: 'Individual income taxes',                         total:    1_161_730 },
    { name: 'Corporate income taxes',                          total:      133_247 },
    { name: 'Property taxes',                                  total:      258_698 },
    { name: 'Other taxes',                                     total:      237_589 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       35_035 },
    { name: 'Investment earnings',                             total:        7_400 },
    { name: 'Securities lending income',                       total:           55 },
    { name: 'Sale of documents/merchandise/property',          total:          369 },
    { name: 'Rentals/leases/royalties',                        total:            8 },
    { name: 'Contributions/premiums',                          total:        4_727 },
    { name: 'Grants/contracts/donations',                      total:       10_116 },
    { name: 'Federal',                                         total:       18_416 },
    { name: 'Federal indirect cost recoveries',                total:          244 },
    { name: 'Other revenues',                                  total:          957 },
  ]},
  2018: { total: 2_265_331, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      126_637 },
    { name: 'Natural resource taxes',                          total:       86_090 },
    { name: 'Individual income taxes',                         total:    1_285_132 },
    { name: 'Corporate income taxes',                          total:      166_393 },
    { name: 'Property taxes',                                  total:      277_127 },
    { name: 'Other taxes',                                     total:      237_112 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       35_776 },
    { name: 'Investment earnings',                             total:       12_805 },
    { name: 'Securities lending income',                       total:            1 },
    { name: 'Sale of documents/merchandise/property',          total:          334 },
    { name: 'Rentals/leases/royalties',                        total:            7 },
    { name: 'Contributions/premiums',                          total:        5_250 },
    { name: 'Grants/contracts/donations',                      total:       10_856 },
    { name: 'Federal',                                         total:       21_154 },
    { name: 'Federal indirect cost recoveries',                total:          257 },
    { name: 'Other revenues',                                  total:          400 },
  ]},
  2019: { total: 2_450_704, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      126_135 },
    { name: 'Natural resource taxes',                          total:       86_211 },
    { name: 'Individual income taxes',                         total:    1_419_959 },
    { name: 'Corporate income taxes',                          total:      186_012 },
    { name: 'Property taxes',                                  total:      288_070 },
    { name: 'Other taxes',                                     total:      241_604 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       37_153 },
    { name: 'Investment earnings',                             total:       23_647 },
    { name: 'Sale of documents/merchandise/property',          total:          314 },
    { name: 'Rentals/leases/royalties',                        total:           10 },
    { name: 'Contributions/premiums',                          total:        5_833 },
    { name: 'Grants/contracts/donations',                      total:        8_261 },
    { name: 'Federal',                                         total:       21_475 },
    { name: 'Federal indirect cost recoveries',                total:          157 },
    { name: 'Other revenues',                                  total:        5_863 },
  ]},
  2020: { total: 2_443_134, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      132_654 },
    { name: 'Natural resource taxes',                          total:       69_726 },
    { name: 'Individual income taxes',                         total:    1_421_934 },
    { name: 'Corporate income taxes',                          total:      186_680 },
    { name: 'Property taxes',                                  total:      308_093 },
    { name: 'Other taxes',                                     total:      237_274 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       33_453 },
    { name: 'Investment earnings',                             total:       20_243 },
    { name: 'Sale of documents/merchandise/property',          total:          273 },
    { name: 'Rentals/leases/royalties',                        total:            8 },
    { name: 'Grants/contracts/donations',                      total:       11_315 },
    { name: 'Federal',                                         total:       18_889 },
    { name: 'Federal indirect cost recoveries',                total:          178 },
    { name: 'Other revenues',                                  total:        2_414 },
  ]},
  2021: { total: 2_848_663, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      142_810 },
    { name: 'Natural resource taxes',                          total:       68_068 },
    { name: 'Individual income taxes',                         total:    1_734_627 },
    { name: 'Corporate income taxes',                          total:      263_869 },
    { name: 'Property taxes',                                  total:      309_495 },
    { name: 'Other taxes',                                     total:      253_940 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       45_488 },
    { name: 'Investment earnings',                             total:        5_093 },
    { name: 'Securities lending income',                       total:           39 },
    { name: 'Sale of documents/merchandise/property',          total:          251 },
    { name: 'Rentals/leases/royalties',                        total:            8 },
    { name: 'Grants/contracts/donations',                      total:       13_665 },
    { name: 'Federal',                                         total:       10_767 },
    { name: 'Federal indirect cost recoveries',                total:          164 },
    { name: 'Other revenues',                                  total:          379 },
  ]},
  2022: { total: 3_663_543, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      150_223 },
    { name: 'Natural resource taxes',                          total:      113_578 },
    { name: 'Individual income taxes',                         total:    2_379_459 },
    { name: 'Corporate income taxes',                          total:      293_108 },
    { name: 'Property taxes',                                  total:      347_201 },
    { name: 'Other taxes',                                     total:      290_457 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       35_162 },
    { name: 'Investment earnings (losses)',                    total:       11_764 },
    { name: 'Securities lending income',                       total:           28 },
    { name: 'Sale of documents/merchandise/property',          total:          296 },
    { name: 'Rentals/leases/royalties',                        total:           55 },
    { name: 'Grants/contracts/donations',                      total:       15_584 },
    { name: 'Federal',                                         total:       25_155 },
    { name: 'Federal indirect cost recoveries',                total:          253 },
    { name: 'Other revenues',                                  total:        1_220 },
  ]},
  2023: { total: 2_995_228, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      155_003 },
    { name: 'Natural resource taxes',                          total:      115_793 },
    { name: 'Individual income taxes',                         total:    1_759_856 },
    { name: 'Corporate income taxes',                          total:      308_829 },
    { name: 'Property taxes',                                  total:      162_176 },
    { name: 'Other taxes',                                     total:      294_299 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       27_457 },
    { name: 'Investment earnings (losses)',                    total:      121_851 },
    { name: 'Securities lending income',                       total:          193 },
    { name: 'Sale of documents/merchandise/property',          total:          291 },
    { name: 'Rentals/leases/royalties',                        total:           37 },
    { name: 'Contributions/premiums',                          total:          130 },
    { name: 'Grants/contracts/donations',                      total:       17_469 },
    { name: 'Federal',                                         total:       31_372 },
    { name: 'Federal indirect cost recoveries',                total:          380 },
    { name: 'Other revenues',                                  total:           92 },
  ]},
  2024: { total: 3_380_852, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      154_991 },
    { name: 'Natural resource taxes',                          total:      103_997 },
    { name: 'Individual income taxes',                         total:    2_227_702 },
    { name: 'Corporate income taxes',                          total:      310_515 },
    { name: 'Property taxes',                                  total:       16_946 },
    { name: 'Other taxes',                                     total:      311_100 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       29_539 },
    { name: 'Investment earnings (losses)',                    total:      182_322 },
    { name: 'Securities lending income',                       total:          536 },
    { name: 'Sale of documents/merchandise/property',          total:          312 },
    { name: 'Rentals/leases/royalties',                        total:           38 },
    { name: 'Contributions/premiums',                          total:          127 },
    { name: 'Grants/contracts/donations',                      total:       25_411 },
    { name: 'Federal',                                         total:       15_878 },
    { name: 'Federal indirect cost recoveries',                total:          389 },
    { name: 'Other revenues',                                  total:        1_049 },
  ]},
  2025: { total: 3_453_804, confidence: 'actual', categories: [
    { name: 'Licenses/permits',                                total:      159_699 },
    { name: 'Natural resource taxes',                          total:       97_860 },
    { name: 'Individual income taxes',                         total:    2_292_065 },
    { name: 'Corporate income taxes',                          total:      319_959 },
    { name: 'Property taxes',                                  total:       15_562 },
    { name: 'Other taxes',                                     total:      326_183 },
    { name: 'Charges for services/fines/forfeits/settlements', total:       28_544 },
    { name: 'Investment earnings (losses)',                    total:      156_745 },
    { name: 'Securities lending income',                       total:        1_531 },
    { name: 'Sale of documents/merchandise/property',          total:          384 },
    { name: 'Rentals/leases/royalties',                        total:           42 },
    { name: 'Contributions/premiums',                          total:           46 },
    { name: 'Grants/contracts/donations',                      total:       31_639 },
    { name: 'Federal',                                         total:       22_186 },
    { name: 'Federal indirect cost recoveries',                total:          244 },
    { name: 'Other revenues',                                  total:        1_115 },
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
  return { jsonTree: [{ n: 'Montana General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Montana General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'mt-acfr-gf-revenue', base_url: 'https://doa.mt.gov/SFSD/ACFR-PAFR', fiscal_years: [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
