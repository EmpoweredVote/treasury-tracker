#!/usr/bin/env node
/**
 * Wyoming General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Wyoming Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in dollars).
 *
 * Phase 113. Revenue is NEW on the WY state node → pure insert keyed (muni,fy,'revenue').
 *   WY state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-53, the FINAL state -- Batch-4 close puts all 50 states on ACFR): WY ACFR
 *   GF ~2.43x NASBO GF (FY2025 $4,027,001,270 vs FY2024 NASBO $1,654,000K). UNUSUAL DRIVER
 *   (distinct from every other Batch-4/prior-batch state): a large Federal line ($1,108,650,901
 *   FY2025) AND an even larger Investment Income line ($1,414,203,323 FY2025, the single largest
 *   GF revenue line) both consolidate into the GENERAL column -- Permanent Mineral Trust Fund
 *   earnings routed partly through the General Fund. Investment income, NOT federal-passthrough
 *   or tax consolidation, is WY's largest single scope-divergence driver. Accepted-and-relabelled
 *   honestly (TX precedent) with this prominent basis note.
 *
 * NODE DISAMBIGUATION (T-121-06-A, the WY-specific critical flag): there are THREE
 *   municipalities named 'Wyoming' in the DB -- the STATE node 4009951b-8a23-457e-9591-1597356dfe34
 *   (the ONLY target of this loader) plus two unrelated CITY nodes (Wyoming, MN =
 *   1604b5eb-283d-4f65-91a4-e9de651a4241 and Wyoming, OH = dacac0e3-13ca-46b1-bcad-50b1099032d0,
 *   carrying unrelated MN-OSA / Ohio-AOS municipal rows). The state-node resolution query below
 *   filters on entity_type='state' in addition to name+state, and EXPECTED_MUNI_ID is asserted
 *   before any write -- the two city nodes are never queried or touched by this loader.
 *
 * UNITS = DOLLARS, NOT THOUSANDS (units=1 hard-set) -- WY's printed statement is already in
 *   whole dollars. Bookends verified at load: FY2025 $4,027,001,270 / FY2005 $1,590,602,744
 *   (both sides, $0 diff on revenues AND expenditures, confirmed on all 21 loaded years).
 *
 * MULTI-ERA URL MAP (no single derivable pattern, enumerated from the publications page and
 *   cross-checked live 2026-07-05): FY2005-FY2017 = .../2020/01/{YYYY}-CAFR.pdf; FY2018 =
 *   .../2019/10/2018-CAFR.pdf; FY2019 = .../2020/04/CAFR_2019.pdf; FY2020 =
 *   .../2021/03/FY-20-CAFR-2.26.21.pdf (NOT listed in the 117 recon's SOURCES map -- discovered
 *   live off the publications page during this load, the one FY the recon's naming-era
 *   enumeration skipped); FY2021 = .../2022/06/ACFR-FY2021-5.31.22.pdf; FY2022 =
 *   .../2023/02/ACFR-FY2022-1.31.23.pdf; FY2023 = .../2024/02/2023-ACFR-State-of-Wyoming.pdf;
 *   FY2024 = .../2025/01/2024-ACFR-State-of-Wyoming.pdf; FY2025 =
 *   .../2026/01/2025-ACFR-12.22.25.pdf. Landing: https://sao.wyo.gov/publications/.
 *
 * COLON-LESS SUBSECTION HEADERS (VT precedent, WY's own instances, confirmed on ALL 21 loaded
 *   years' raw pdftotext -table output): the revenue section prints a single "Taxes" sub-heading
 *   with NO trailing colon ahead of "Sales and Use Taxes" (merges via the generic wrapped-label
 *   pending accumulator into "Taxes Sales and Use Taxes"); FY2015-FY2025 (not FY2005-FY2014,
 *   which use colon-terminated "Current:"/"Debt Service:" headings) similarly print colon-less
 *   "Current" (merges into "Current General Government") and "Debt Service" (merges into
 *   "Debt Service Principal Retirement") headings on the expenditure side. A dedicated
 *   wy_assemble.py post-process pass (documented in the load log) strips the three known
 *   header-prefix strings back off the merged labels ("Sales and Use Taxes", "General
 *   Government", "Principal Retirement" with sub='Debt Service' set explicitly so
 *   default_exp_name()'s disambiguation renames it to "Debt service -- Principal Retirement",
 *   matching FY2005-FY2014's own formatting) and propagates sub='Debt Service' onto the
 *   following "Interest" line for FY2015-FY2025 (consistency with FY2005-FY2014, which already
 *   carry sub='Debt Service' on both lines via their colon-terminated heading) -- values
 *   untouched throughout, ties re-verified identical before and after.
 *
 * 6-COLUMN LAYOUT: GENERAL FUND is the 1st of 6 (General Fund | Foundation Program Fund |
 *   Common School Land Fund | Permanent Mineral Trust Fund | Pandemic Relief Fund [FY2021+
 *   only] | Nonmajor Governmental Funds | Total). extract_gf.py's position-anchor isolates
 *   General Fund regardless of the total column count -- confirmed at both bookends (FY2025 rev
 *   $4,027,001,270 / FY2005 rev $1,590,602,744, exact $0 diff on BOTH revenues and expenditures)
 *   and on all 21 loaded years.
 *
 * PRE-2005 EXCLUDED (out of scope, not attempted): FY1980-FY2004 archive exists on the same
 *   publications page but FY2002 (spot-checked in the 117 recon) is a poor-quality OCR scan
 *   (garbled text -- "flna,nce", "STaMe", corrupted digits) -- FY2005 is the clean-text floor,
 *   per the recon's explicit instruction. Not attempted this load.
 *
 * CLEAN EXTRACTION: all 21 years FY2005-FY2025 tied to $0 diff on BOTH the revenue and
 *   expenditure printed GENERAL FUND totals on the FIRST extraction pass (after the colon-less
 *   header post-process above) -- zero honest holes, zero hand-patches, zero soft-404s (all 21
 *   PDFs downloaded cleanly, %PDF magic + size >1.5MB every year).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): PER-YEAR P2 CLAMP MONITORING (T-121-06-C, the WY-specific critical flag -- checked at EVERY loaded year, not just bookends, per the recon's explicit caution): "Net Increase/(Decrease) in the Fair Market Value of Investments" (a mark-to-market sub-line of the large Investment Income revenue line) went NEGATIVE in 7 of the 21 loaded years -- FY2006 -$39,894,527, FY2008 -$17,477,960, FY2009 -$23,909,726, FY2013 -$165,133,848, FY2015 -$62,965,920, FY2017 -$21,735,124, FY2018 -$21,806,236 (all dollars) -- real GAAP fair-value-of-investments losses during down-market years, not extraction artifacts. "Sale of Assets" also went negative in 3 years (FY2019 -$188,575, FY2021 -$37,314, FY2022 -$76,530, immaterial net-book-value-exceeds-proceeds facts). Both bookend years (FY2025, FY2005) are positive on every line. The P2 clamp is the render path for all 7+3 negative-line years; no year shows a negative GF Total revenues.
 *
 * UNITS = dollars (already dollars, no scaling). Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 dollars; extraction: pdftotext -table
 *   on local copies in _acfr-work/wy/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processWYRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Wyoming'; const STATE_ABBR = 'WY'; const POPULATION = 587_618;
const EXPECTED_MUNI_ID = '4009951b-8a23-457e-9591-1597356dfe34';
const UNITS = 1; // WY ACFR is in dollars (already dollars — no scaling)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2005: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2005-CAFR.pdf', date: '2005-06-30' },
  2006: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2006-CAFR.pdf', date: '2006-06-30' },
  2007: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2007-CAFR.pdf', date: '2007-06-30' },
  2008: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2008-CAFR.pdf', date: '2008-06-30' },
  2009: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2009-CAFR.pdf', date: '2009-06-30' },
  2010: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2010-CAFR.pdf', date: '2010-06-30' },
  2011: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2011-CAFR.pdf', date: '2011-06-30' },
  2012: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2012-CAFR.pdf', date: '2012-06-30' },
  2013: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2013-CAFR.pdf', date: '2013-06-30' },
  2014: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2014-CAFR.pdf', date: '2014-06-30' },
  2015: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2015-CAFR.pdf', date: '2015-06-30' },
  2016: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2016-CAFR.pdf', date: '2016-06-30' },
  2017: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/01/2017-CAFR.pdf', date: '2017-06-30' },
  2018: { url: 'https://sao.wyo.gov/wp-content/uploads/2019/10/2018-CAFR.pdf', date: '2018-06-30' },
  2019: { url: 'https://sao.wyo.gov/wp-content/uploads/2020/04/CAFR_2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://sao.wyo.gov/wp-content/uploads/2021/03/FY-20-CAFR-2.26.21.pdf', date: '2020-06-30' },
  2021: { url: 'https://sao.wyo.gov/wp-content/uploads/2022/06/ACFR-FY2021-5.31.22.pdf', date: '2021-06-30' },
  2022: { url: 'https://sao.wyo.gov/wp-content/uploads/2023/02/ACFR-FY2022-1.31.23.pdf', date: '2022-06-30' },
  2023: { url: 'https://sao.wyo.gov/wp-content/uploads/2024/02/2023-ACFR-State-of-Wyoming.pdf', date: '2023-06-30' },
  2024: { url: 'https://sao.wyo.gov/wp-content/uploads/2025/01/2024-ACFR-State-of-Wyoming.pdf', date: '2024-06-30' },
  2025: { url: 'https://sao.wyo.gov/wp-content/uploads/2026/01/2025-ACFR-12.22.25.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Wyoming State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — WY ACFR, GENERAL FUND column (raw dollars; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2005: { total: 1_590_602_744, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  424_357_602 },
    { name: 'Mineral Severance Taxes',                                         total:  230_820_770 },
    { name: 'Other Taxes',                                                     total:   27_044_404 },
    { name: 'Federal Mineral Royalties',                                       total:    2_100_000 },
    { name: 'Use of Property',                                                 total:    4_865_982 },
    { name: 'License & Permits',                                               total:    7_874_046 },
    { name: 'Fines and Forfeitures',                                           total:    4_036_408 },
    { name: 'Federal',                                                         total:  587_285_567 },
    { name: 'Charges for Sales and Services',                                  total:   41_755_253 },
    { name: 'Interest Income',                                                 total:  147_717_146 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:   69_162_751 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:   26_698_597 },
    { name: 'Miscellaneous',                                                   total:      114_326 },
    { name: 'Revenue from Others',                                             total:   16_769_892 },
  ]},
  2006: { total: 1_682_881_108, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  456_998_802 },
    { name: 'Mineral Severance and Royalties Taxes',                           total:  239_446_125 },
    { name: 'Other Taxes',                                                     total:   25_753_016 },
    { name: 'Federal Mineral Royalties',                                       total:    2_000_000 },
    { name: 'Use of Property',                                                 total:    4_974_186 },
    { name: 'License & Permits',                                               total:    5_303_054 },
    { name: 'Fines and Forfeitures',                                           total:    5_237_115 },
    { name: 'Federal',                                                         total:  558_771_965 },
    { name: 'Charges for Sales and Services',                                  total:   27_976_398 },
    { name: 'Interest Income',                                                 total:  248_286_044 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  131_146_902 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:  -39_894_527 },
    { name: 'Miscellaneous Receipts',                                          total:       67_086 },
    { name: 'Revenue from Others',                                             total:   16_814_942 },
  ]},
  2007: { total: 1_892_489_729, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  507_799_309 },
    { name: 'Mineral Severance Taxes',                                         total:  214_195_441 },
    { name: 'Other Taxes',                                                     total:   30_844_715 },
    { name: 'Federal Mineral Royalties',                                       total:    2_000_000 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    6_376_143 },
    { name: 'License & Permits',                                               total:    7_121_315 },
    { name: 'Fines and Forfeitures',                                           total:    2_218_064 },
    { name: 'Federal',                                                         total:  585_697_295 },
    { name: 'Charges for Sales and Services',                                  total:   41_672_823 },
    { name: 'Interest Income',                                                 total:  307_410_057 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  149_957_737 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:   11_814_220 },
    { name: 'Miscellaneous Receipts',                                          total:       65_831 },
    { name: 'Revenue from Others',                                             total:   25_316_779 },
  ]},
  2008: { total: 1_835_210_503, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  530_924_672 },
    { name: 'Mineral Severance Taxes',                                         total:  253_634_701 },
    { name: 'Other Taxes',                                                     total:   27_131_325 },
    { name: 'Federal Mineral Royalties',                                       total:    2_000_000 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    3_948_472 },
    { name: 'License & Permits',                                               total:    7_733_900 },
    { name: 'Fines and Forfeitures',                                           total:    4_558_858 },
    { name: 'Federal',                                                         total:  568_599_536 },
    { name: 'Charges for Sales and Services',                                  total:   24_400_200 },
    { name: 'Interest Income',                                                 total:  272_053_617 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  132_676_930 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:  -17_477_960 },
    { name: 'Miscellaneous Receipts',                                          total:    1_338_632 },
    { name: 'Revenue from Others',                                             total:   23_687_620 },
  ]},
  2009: { total: 1_598_980_555, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  522_223_050 },
    { name: 'Mineral Severance Taxes',                                         total:  228_216_617 },
    { name: 'Other Taxes',                                                     total:   24_091_772 },
    { name: 'Federal Mineral Royalties',                                       total:    2_000_000 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    4_440_067 },
    { name: 'License & Permits',                                               total:    7_641_217 },
    { name: 'Fines and Forfeitures',                                           total:    4_593_486 },
    { name: 'Federal',                                                         total:  614_187_997 },
    { name: 'Charges for Sales and Services',                                  total:   28_103_341 },
    { name: 'Interest Income',                                                 total:  146_907_025 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:   17_288_040 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:  -23_909_726 },
    { name: 'Miscellaneous Receipts',                                          total:       81_235 },
    { name: 'Revenue from Others',                                             total:   23_116_434 },
    { name: 'Sale of Land',                                                    total:            0 },
  ]},
  2010: { total: 1_856_786_453, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  442_823_944 },
    { name: 'Mineral Severance Taxes',                                         total:  221_228_314 },
    { name: 'Other Taxes',                                                     total:   23_833_362 },
    { name: 'Federal Mineral Royalties',                                       total:    2_000_000 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    6_439_376 },
    { name: 'License & Permits',                                               total:    7_833_063 },
    { name: 'Fines and Forfeitures',                                           total:    5_126_345 },
    { name: 'Federal',                                                         total:  641_037_374 },
    { name: 'Charges for Sales and Services',                                  total:   21_994_547 },
    { name: 'Interest Income',                                                 total:  158_744_833 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  211_157_273 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:   82_245_223 },
    { name: 'Miscellaneous Receipts',                                          total:            0 },
    { name: 'Revenue from Others',                                             total:   32_322_799 },
    { name: 'Sale of Land',                                                    total:            0 },
  ]},
  2011: { total: 2_604_557_547, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  494_496_404 },
    { name: 'Mineral Severance Taxes',                                         total:  494_963_427 },
    { name: 'Other Taxes',                                                     total:   23_210_774 },
    { name: 'Federal Mineral Royalties',                                       total:  466_602_075 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:   15_616_620 },
    { name: 'License & Permits',                                               total:    8_470_035 },
    { name: 'Fines and Forfeitures',                                           total:    5_443_017 },
    { name: 'Federal',                                                         total:  622_527_031 },
    { name: 'Charges for Sales and Services',                                  total:   31_951_274 },
    { name: 'Interest Income',                                                 total:  150_851_368 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  240_614_510 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:   19_709_980 },
    { name: 'Miscellaneous Receipts',                                          total:      409_072 },
    { name: 'Revenue from Others',                                             total:   29_691_960 },
    { name: 'Sale of Land',                                                    total:            0 },
  ]},
  2012: { total: 2_573_780_154, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  531_145_133 },
    { name: 'Mineral Severance Taxes',                                         total:  468_580_431 },
    { name: 'Other Taxes',                                                     total:   24_484_327 },
    { name: 'Federal Mineral Royalties',                                       total:  408_218_740 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    3_606_083 },
    { name: 'License & Permits',                                               total:    9_691_532 },
    { name: 'Fines and Forfeitures',                                           total:    6_516_078 },
    { name: 'Federal',                                                         total:  644_399_525 },
    { name: 'Charges for Sales and Services',                                  total:   35_590_561 },
    { name: 'Interest Income',                                                 total:  135_817_392 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  202_845_845 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:   63_305_353 },
    { name: 'Miscellaneous Receipts',                                          total:       84_611 },
    { name: 'Revenue from Others',                                             total:   39_494_543 },
    { name: 'Sale of Land',                                                    total:            0 },
  ]},
  2013: { total: 2_406_105_195, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  504_441_923 },
    { name: 'Mineral Severance and Royalty Taxes',                             total:  442_803_107 },
    { name: 'Other Taxes',                                                     total:   30_544_193 },
    { name: 'Federal Mineral Royalties',                                       total:  350_580_023 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    8_849_075 },
    { name: 'License & Permits',                                               total:   10_168_666 },
    { name: 'Fines and Forfeitures',                                           total:    4_426_331 },
    { name: 'Federal',                                                         total:  630_076_442 },
    { name: 'Charges for Sales and Services',                                  total:   78_012_654 },
    { name: 'Interest Income',                                                 total:  221_430_897 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  253_639_486 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total: -165_133_848 },
    { name: 'Miscellaneous Receipts',                                          total:      102_263 },
    { name: 'Revenue from Others',                                             total:   36_163_983 },
    { name: 'Sale of Land',                                                    total:            0 },
  ]},
  2014: { total: 2_750_388_194, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  557_051_121 },
    { name: 'Mineral Severance and Royalty Taxes',                             total:  513_811_684 },
    { name: 'Other Taxes',                                                     total:   36_128_562 },
    { name: 'Federal Mineral Royalties',                                       total:  397_306_057 },
    { name: 'Coal Bonus Lease Payments',                                       total:            0 },
    { name: 'Use of Property',                                                 total:    4_682_711 },
    { name: 'License & Permits',                                               total:   11_438_269 },
    { name: 'Fines and Forfeitures',                                           total:    6_976_236 },
    { name: 'Federal',                                                         total:  622_033_492 },
    { name: 'Charges for Sales and Services',                                  total:   50_464_451 },
    { name: 'Interest Income',                                                 total:  154_863_159 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  273_248_764 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:   77_493_181 },
    { name: 'Miscellaneous Receipts',                                          total:       70_746 },
    { name: 'Revenue from Others',                                             total:   44_819_761 },
    { name: 'Sale of Land',                                                    total:            0 },
  ]},
  2015: { total: 2_606_828_798, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                             total:  569_929_511 },
    { name: 'Mineral Severance and Royalty Taxes',                             total:  402_303_640 },
    { name: 'Other Taxes',                                                     total:   41_606_971 },
    { name: 'Federal Mineral Royalties',                                       total:  328_149_640 },
    { name: 'Use of Property',                                                 total:    5_621_565 },
    { name: 'License & Permits',                                               total:   12_276_326 },
    { name: 'Fines and Forfeitures',                                           total:    8_726_193 },
    { name: 'Federal',                                                         total:  665_416_172 },
    { name: 'Charges for Sales and Services',                                  total:   46_965_162 },
    { name: 'Interest Income',                                                 total:  178_658_106 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',               total:  359_274_495 },
    { name: 'Net Increase/(Decrease) in the Fair Market Value of Investments', total:  -62_965_920 },
    { name: 'Miscellaneous Receipts',                                          total:      119_123 },
    { name: 'Revenue from Others',                                             total:   50_747_814 },
  ]},
  2016: { total: 2_156_616_633, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                      total:  455_580_356 },
    { name: 'Mineral Severance and Royalty Taxes',                      total:  296_626_739 },
    { name: 'Other Taxes',                                              total:   36_597_035 },
    { name: 'Federal Mineral Royalties',                                total:  190_209_982 },
    { name: 'Use of Property',                                          total:    3_804_356 },
    { name: 'License & Permits',                                        total:   13_514_765 },
    { name: 'Fines and Forfeitures',                                    total:    2_511_043 },
    { name: 'Federal',                                                  total:  669_299_843 },
    { name: 'Charges for Sales and Services',                           total:   45_659_508 },
    { name: 'Interest Income',                                          total:  172_374_042 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',        total:  145_279_839 },
    { name: 'Net Increase/(Decrease) in the Fair Value of Investments', total:   62_889_986 },
    { name: 'Miscellaneous Receipts',                                   total:      103_293 },
    { name: 'Revenue from Others',                                      total:   62_165_846 },
  ]},
  2017: { total: 2_455_083_218, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                      total:  435_463_488 },
    { name: 'Mineral Severance and Royalty Taxes',                      total:  383_667_163 },
    { name: 'Other Taxes',                                              total:   36_122_192 },
    { name: 'Federal Mineral Royalties',                                total:  315_607_766 },
    { name: 'Use of Property',                                          total:    6_347_600 },
    { name: 'License & Permits',                                        total:   13_597_540 },
    { name: 'Fines and Forfeitures',                                    total:    2_926_898 },
    { name: 'Federal',                                                  total:  708_870_160 },
    { name: 'Charges for Sales and Services',                           total:   48_191_514 },
    { name: 'Interest Income',                                          total:  122_097_169 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',        total:  341_234_412 },
    { name: 'Net Increase/(Decrease) in the Fair Value of Investments', total:  -21_735_124 },
    { name: 'Miscellaneous Receipts',                                   total:      141_068 },
    { name: 'Revenue from Others',                                      total:   62_551_372 },
  ]},
  2018: { total: 2_596_456_614, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                                      total:  506_232_246 },
    { name: 'Mineral Severance and Royalty Taxes',                      total:  420_609_941 },
    { name: 'Other Taxes',                                              total:   36_249_982 },
    { name: 'Federal Mineral Royalties',                                total:  277_774_723 },
    { name: 'Use of Property',                                          total:    3_694_937 },
    { name: 'License & Permits',                                        total:   15_757_129 },
    { name: 'Fines and Forfeitures',                                    total:    2_424_838 },
    { name: 'Federal',                                                  total:  706_812_721 },
    { name: 'Charges for Sales and Services',                           total:   44_960_064 },
    { name: 'Interest Income',                                          total:  141_299_667 },
    { name: 'Interest Income From Permanent Mineral Trust Fund',        total:  408_414_805 },
    { name: 'Net Increase/(Decrease) in the Fair Value of Investments', total:  -21_806_236 },
    { name: 'Miscellaneous Receipts',                                   total:       53_545 },
    { name: 'Revenue from Others',                                      total:   53_978_252 },
  ]},
  2019: { total: 2_723_680_549, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  539_372_416 },
    { name: 'Mineral Severance and Royalty Taxes', total:  450_427_914 },
    { name: 'Other Taxes',                         total:   39_375_257 },
    { name: 'Federal Mineral Royalties',           total:  248_624_758 },
    { name: 'Use of Property',                     total:    5_203_372 },
    { name: 'License & Permits',                   total:   16_451_042 },
    { name: 'Fines and Forfeitures',               total:    2_748_931 },
    { name: 'Federal',                             total:  749_894_134 },
    { name: 'Charges for Sales and Services',      total:   45_480_771 },
    { name: 'Interest Income',                     total:  560_304_554 },
    { name: 'Miscellaneous Receipts',              total:       55_048 },
    { name: 'Revenue from Others',                 total:   65_930_927 },
    { name: 'Sale of Assets',                      total:     -188_575 },
  ]},
  2020: { total: 2_443_495_399, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  516_838_646 },
    { name: 'Mineral Severance and Royalty Taxes', total:  314_462_936 },
    { name: 'Other Taxes',                         total:   48_081_704 },
    { name: 'Federal Mineral Royalties',           total:  186_286_008 },
    { name: 'Coal Bonus Lease Payments',           total:      368_640 },
    { name: 'Use of Property',                     total:    5_830_225 },
    { name: 'License & Permits',                   total:   17_583_904 },
    { name: 'Fines and Forfeitures',               total:    3_378_931 },
    { name: 'Federal',                             total:  798_972_518 },
    { name: 'Charges for Sales and Services',      total:   34_864_502 },
    { name: 'Investment Income',                   total:  445_882_736 },
    { name: 'Miscellaneous Receipts',              total:       36_471 },
    { name: 'Revenue from Others',                 total:   70_908_178 },
  ]},
  2021: { total: 2_797_188_612, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  522_986_348 },
    { name: 'Mineral Severance and Royalty Taxes', total:  341_683_176 },
    { name: 'Other Taxes',                         total:   53_972_884 },
    { name: 'Federal Mineral Royalties',           total:  172_683_739 },
    { name: 'Coal Bonus Lease Payments',           total:      184_320 },
    { name: 'Use of Property',                     total:    4_450_788 },
    { name: 'License & Permits',                   total:   19_677_501 },
    { name: 'Fines and Forfeitures',               total:    2_905_931 },
    { name: 'Federal',                             total:  942_282_711 },
    { name: 'Charges for Sales and Services',      total:   41_890_576 },
    { name: 'Investment Income',                   total:  638_911_475 },
    { name: 'Miscellaneous Receipts',              total:       48_168 },
    { name: 'Revenue from Others',                 total:   55_548_309 },
    { name: 'Sale of Assets',                      total:      -37_314 },
  ]},
  2022: { total: 3_349_849_253, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  589_071_850 },
    { name: 'Mineral Severance and Royalty Taxes', total:  615_477_079 },
    { name: 'Other Taxes',                         total:   55_382_613 },
    { name: 'Federal Mineral Royalties',           total:  318_865_845 },
    { name: 'Use of Property',                     total:    5_052_381 },
    { name: 'License & Permits',                   total:   23_160_364 },
    { name: 'Fines and Forfeitures',               total:    7_701_125 },
    { name: 'Federal',                             total: 1_276_694_089 },
    { name: 'Charges for Sales and Services',      total:   48_099_160 },
    { name: 'Investment Income',                   total:  338_911_275 },
    { name: 'Miscellaneous Receipts',              total:       78_934 },
    { name: 'Revenue from Others',                 total:   71_431_068 },
    { name: 'Sale of Assets',                      total:      -76_530 },
  ]},
  2023: { total: 3_574_386_471, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  663_777_958 },
    { name: 'Mineral Severance and Royalty Taxes', total:  522_335_510 },
    { name: 'Other Taxes',                         total:   59_666_794 },
    { name: 'Federal Mineral Royalties',           total:  413_396_639 },
    { name: 'Use of Property',                     total:    4_999_836 },
    { name: 'License & Permits',                   total:   24_386_326 },
    { name: 'Fines and Forfeitures',               total:    2_674_536 },
    { name: 'Federal',                             total: 1_222_901_494 },
    { name: 'Charges for Sales and Services',      total:   48_863_523 },
    { name: 'Investment Income',                   total:  534_130_479 },
    { name: 'Miscellaneous Receipts',              total:       90_822 },
    { name: 'Revenue from Others',                 total:   77_162_554 },
  ]},
  2024: { total: 3_649_083_441, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  667_551_586 },
    { name: 'Mineral Severance and Royalty Taxes', total:  385_223_369 },
    { name: 'Other Taxes',                         total:   69_133_688 },
    { name: 'Federal Mineral Royalties',           total:  242_468_593 },
    { name: 'Use of Property',                     total:    5_190_500 },
    { name: 'License & Permits',                   total:   23_684_309 },
    { name: 'Fines and Forfeitures',               total:    2_711_369 },
    { name: 'Federal',                             total: 1_250_229_444 },
    { name: 'Charges for Sales and Services',      total:   53_477_118 },
    { name: 'Investment Income',                   total:  860_384_814 },
    { name: 'Miscellaneous Receipts',              total:       69_728 },
    { name: 'Revenue from Others',                 total:   88_958_923 },
  ]},
  2025: { total: 4_027_001_270, confidence: 'actual', categories: [
    { name: 'Sales and Use Taxes',                 total:  662_533_806 },
    { name: 'Mineral Severance and Royalty Taxes', total:  340_840_751 },
    { name: 'Other Taxes',                         total:   80_827_338 },
    { name: 'Federal Mineral Royalties',           total:  230_203_757 },
    { name: 'Use of Property',                     total:    5_065_014 },
    { name: 'License & Permits',                   total:   25_747_343 },
    { name: 'Fines and Forfeitures',               total:    3_296_191 },
    { name: 'Federal',                             total: 1_108_650_901 },
    { name: 'Charges for Sales and Services',      total:   60_487_031 },
    { name: 'Investment Income',                   total: 1_414_203_323 },
    { name: 'Miscellaneous Receipts',              total:       41_818 },
    { name: 'Revenue from Others',                 total:   95_103_997 },
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
  return { jsonTree: [{ n: 'Wyoming General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Wyoming General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'wy-acfr-gf-revenue', base_url: 'https://sao.wyo.gov/publications/', fiscal_years: [2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
