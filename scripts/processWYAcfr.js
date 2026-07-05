#!/usr/bin/env node
/**
 * Wyoming General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Wyoming Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in dollars).
 *
 * Phase 113. Replaces the NASBO operating rows on the WY state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 dollars; extraction: pdftotext -table
 *   on local copies in _acfr-work/wy/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processWYAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Wyoming State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — WY ACFR, GENERAL FUND column (raw dollars; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2005: { total: 1_630_762_733, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  185_343_153 },
    { name: 'Business Regulation',                 total:    6_473_528 },
    { name: 'Education',                           total:  342_061_127 },
    { name: 'Health Services',                     total:  566_192_252 },
    { name: 'Law, Justice and Safety',             total:  230_417_931 },
    { name: 'Employment',                          total:   45_225_604 },
    { name: 'Recreation and Resource Development', total:  133_673_518 },
    { name: 'Social Services',                     total:  121_375_620 },
    { name: 'Capital Construction',                total:            0 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2006: { total: 1_754_918_335, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  304_251_971 },
    { name: 'Business Regulation',                 total:    6_847_020 },
    { name: 'Education',                           total:  349_953_372 },
    { name: 'Health Services',                     total:  622_453_080 },
    { name: 'Law, Justice and Safety',             total:  166_365_091 },
    { name: 'Employment',                          total:   43_276_550 },
    { name: 'Recreation and Resource Development', total:  132_797_950 },
    { name: 'Social Services',                     total:  112_334_671 },
    { name: 'Transportation',                      total:   16_638_630 },
    { name: 'Capital Construction',                total:            0 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2007: { total: 1_999_049_841, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  332_147_341 },
    { name: 'Business Regulation',                 total:    7_581_622 },
    { name: 'Education',                           total:  373_334_406 },
    { name: 'Health Services',                     total:  664_911_556 },
    { name: 'Law, Justice and Safety',             total:  193_736_842 },
    { name: 'Employment',                          total:   36_350_569 },
    { name: 'Recreation and Resource Development', total:  213_061_441 },
    { name: 'Social Services',                     total:  122_013_645 },
    { name: 'Transportation',                      total:   55_912_419 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2008: { total: 2_264_989_654, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  239_241_876 },
    { name: 'Business Regulation',                 total:    9_413_446 },
    { name: 'Education',                           total:  431_565_472 },
    { name: 'Health Services',                     total:  766_635_001 },
    { name: 'Law, Justice and Safety',             total:  207_832_337 },
    { name: 'Employment',                          total:   48_258_831 },
    { name: 'Recreation and Resource Development', total:  258_640_028 },
    { name: 'Social Services',                     total:  136_671_161 },
    { name: 'Transportation',                      total:  166_731_502 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2009: { total: 2_228_008_386, confidence: 'actual', categories: [
    { name: 'General Government',                  total:   95_509_101 },
    { name: 'Business Regulation',                 total:   11_011_652 },
    { name: 'Education',                           total:  467_246_680 },
    { name: 'Health Services',                     total:  791_662_669 },
    { name: 'Law, Justice and Safety',             total:  229_822_733 },
    { name: 'Employment',                          total:   48_189_292 },
    { name: 'Recreation and Resource Development', total:  328_346_073 },
    { name: 'Social Services',                     total:  144_460_753 },
    { name: 'Transportation',                      total:  111_759_433 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2010: { total: 2_230_948_005, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  116_015_488 },
    { name: 'Business Regulation',                 total:   12_143_857 },
    { name: 'Education',                           total:  428_852_778 },
    { name: 'Health Services',                     total:  778_653_669 },
    { name: 'Law, Justice and Safety',             total:  241_166_879 },
    { name: 'Employment',                          total:   53_876_429 },
    { name: 'Recreation and Resource Development', total:  337_848_222 },
    { name: 'Social Services',                     total:  134_208_672 },
    { name: 'Transportation',                      total:  128_182_011 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2011: { total: 2_218_332_531, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  138_060_847 },
    { name: 'Business Regulation',                 total:   15_267_840 },
    { name: 'Education',                           total:  486_590_099 },
    { name: 'Health Services',                     total:  830_748_491 },
    { name: 'Law, Justice and Safety',             total:  156_422_324 },
    { name: 'Employment',                          total:   59_803_395 },
    { name: 'Recreation and Resource Development', total:  322_362_303 },
    { name: 'Social Services',                     total:  151_428_667 },
    { name: 'Transportation',                      total:   57_648_565 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2012: { total: 2_253_477_647, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  120_990_239 },
    { name: 'Business Regulation',                 total:   12_158_696 },
    { name: 'Education',                           total:  464_544_210 },
    { name: 'Health Services',                     total:  865_241_405 },
    { name: 'Law, Justice and Safety',             total:  250_810_286 },
    { name: 'Employment',                          total:   57_062_670 },
    { name: 'Recreation and Resource Development', total:  283_709_708 },
    { name: 'Social Services',                     total:  141_475_924 },
    { name: 'Transportation',                      total:   57_484_509 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2013: { total: 2_363_376_486, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  183_878_370 },
    { name: 'Business Regulation',                 total:   81_431_755 },
    { name: 'Education',                           total:  588_008_858 },
    { name: 'Health Services',                     total:  872_574_871 },
    { name: 'Law, Justice and Safety',             total:  249_230_539 },
    { name: 'Employment',                          total:   53_570_718 },
    { name: 'Recreation and Resource Development', total:  169_257_320 },
    { name: 'Social Services',                     total:  132_434_700 },
    { name: 'Transportation',                      total:   32_989_355 },
    { name: 'Capital Construction',                total:            0 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2014: { total: 2_305_091_475, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  182_911_267 },
    { name: 'Business Regulation',                 total:   11_861_867 },
    { name: 'Education',                           total:  497_156_389 },
    { name: 'Health Services',                     total:  878_380_929 },
    { name: 'Law, Justice and Safety',             total:  258_452_038 },
    { name: 'Employment',                          total:   53_330_181 },
    { name: 'Recreation and Resource Development', total:  260_773_646 },
    { name: 'Social Services',                     total:  129_078_281 },
    { name: 'Transportation',                      total:   33_146_877 },
    { name: 'Capital Construction',                total:            0 },
    { name: 'Debt service — Principal Retirement', total:            0 },
    { name: 'Debt service — Interest',             total:            0 },
  ]},
  2015: { total: 2_385_695_869, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  205_332_197 },
    { name: 'Business Regulation',                 total:   10_977_547 },
    { name: 'Education',                           total:  508_573_014 },
    { name: 'Health Services',                     total:  892_869_938 },
    { name: 'Law, Justice and Safety',             total:  253_096_886 },
    { name: 'Employment',                          total:   62_940_832 },
    { name: 'Recreation and Resource Development', total:  288_550_607 },
    { name: 'Social Services',                     total:  127_125_825 },
    { name: 'Transportation',                      total:   36_229_023 },
  ]},
  2016: { total: 2_488_603_134, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  237_529_811 },
    { name: 'Business Regulation',                 total:   12_286_887 },
    { name: 'Education',                           total:  551_444_376 },
    { name: 'Health Services',                     total:  905_742_875 },
    { name: 'Law, Justice and Safety',             total:  270_771_229 },
    { name: 'Employment',                          total:   49_813_278 },
    { name: 'Recreation and Resource Development', total:  297_587_505 },
    { name: 'Social Services',                     total:  133_076_830 },
    { name: 'Transportation',                      total:   30_350_343 },
  ]},
  2017: { total: 2_341_750_501, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  200_846_752 },
    { name: 'Business Regulation',                 total:    9_496_230 },
    { name: 'Education',                           total:  528_588_575 },
    { name: 'Health Services',                     total:  902_161_968 },
    { name: 'Law, Justice and Safety',             total:  244_037_763 },
    { name: 'Employment',                          total:   68_960_767 },
    { name: 'Recreation and Resource Development', total:  249_277_515 },
    { name: 'Social Services',                     total:  127_111_386 },
    { name: 'Transportation',                      total:   11_269_545 },
  ]},
  2018: { total: 2_343_828_093, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  194_175_821 },
    { name: 'Business Regulation',                 total:   37_961_645 },
    { name: 'Education',                           total:  512_855_811 },
    { name: 'Health Services',                     total:  915_259_370 },
    { name: 'Law, Justice and Safety',             total:  249_833_718 },
    { name: 'Employment',                          total:   68_598_680 },
    { name: 'Recreation and Resource Development', total:  224_084_141 },
    { name: 'Social Services',                     total:  126_058_907 },
    { name: 'Transportation',                      total:   15_000_000 },
  ]},
  2019: { total: 2_293_172_905, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  200_047_199 },
    { name: 'Business Regulation',                 total:    8_810_220 },
    { name: 'Education',                           total:  504_352_889 },
    { name: 'Health Services',                     total:  928_063_719 },
    { name: 'Law, Justice and Safety',             total:  277_848_601 },
    { name: 'Employment',                          total:   29_502_684 },
    { name: 'Recreation and Resource Development', total:  214_365_139 },
    { name: 'Social Services',                     total:  130_102_454 },
    { name: 'Transportation',                      total:       80_000 },
  ]},
  2020: { total: 2_324_993_843, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  261_767_587 },
    { name: 'Business Regulation',                 total:   11_597_025 },
    { name: 'Education',                           total:  403_289_335 },
    { name: 'Health Services',                     total:  938_538_690 },
    { name: 'Law, Justice and Safety',             total:  291_063_269 },
    { name: 'Employment',                          total:   51_410_243 },
    { name: 'Recreation and Resource Development', total:  188_013_949 },
    { name: 'Social Services',                     total:  179_233_745 },
    { name: 'Transportation',                      total:       80_000 },
  ]},
  2021: { total: 2_364_290_760, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  227_341_848 },
    { name: 'Business Regulation',                 total:   11_378_646 },
    { name: 'Education',                           total:  496_047_784 },
    { name: 'Health Services',                     total:  939_107_584 },
    { name: 'Law, Justice and Safety',             total:  243_639_911 },
    { name: 'Employment',                          total:   56_925_937 },
    { name: 'Recreation and Resource Development', total:  177_427_709 },
    { name: 'Social Services',                     total:  212_418_622 },
    { name: 'Transportation',                      total:        2_719 },
  ]},
  2022: { total: 2_670_977_767, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  219_006_865 },
    { name: 'Business Regulation',                 total:    9_077_768 },
    { name: 'Education',                           total:  649_975_625 },
    { name: 'Health Services',                     total: 1_023_549_989 },
    { name: 'Law, Justice and Safety',             total:  217_255_635 },
    { name: 'Employment',                          total:   88_888_531 },
    { name: 'Recreation and Resource Development', total:  173_450_925 },
    { name: 'Social Services',                     total:  283_276_830 },
    { name: 'Debt service — Principal Retirement', total:    3_968_847 },
    { name: 'Debt service — Interest',             total:    2_526_752 },
  ]},
  2023: { total: 2_867_806_754, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  279_883_961 },
    { name: 'Business Regulation',                 total:   18_166_365 },
    { name: 'Education',                           total:  823_103_878 },
    { name: 'Health Services',                     total: 1_041_784_121 },
    { name: 'Law, Justice and Safety',             total:  176_013_294 },
    { name: 'Employment',                          total:   67_588_579 },
    { name: 'Recreation and Resource Development', total:  172_130_983 },
    { name: 'Social Services',                     total:  258_939_320 },
    { name: 'Debt service — Principal Retirement', total:   24_130_035 },
    { name: 'Debt service — Interest',             total:    6_066_218 },
  ]},
  2024: { total: 2_944_593_681, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  383_394_299 },
    { name: 'Business Regulation',                 total:   20_040_654 },
    { name: 'Education',                           total:  732_182_218 },
    { name: 'Health Services',                     total: 1_085_982_564 },
    { name: 'Law, Justice and Safety',             total:  191_275_533 },
    { name: 'Employment',                          total:   48_506_127 },
    { name: 'Recreation and Resource Development', total:  210_389_276 },
    { name: 'Social Services',                     total:  231_981_705 },
    { name: 'Transportation',                      total:   10_044_444 },
    { name: 'Debt service — Principal Retirement', total:   24_266_847 },
    { name: 'Debt service — Interest',             total:    6_530_014 },
  ]},
  2025: { total: 3_206_868_645, confidence: 'actual', categories: [
    { name: 'General Government',                  total:  508_754_673 },
    { name: 'Business Regulation',                 total:   23_301_024 },
    { name: 'Education',                           total:  658_619_342 },
    { name: 'Health Services',                     total: 1_147_253_250 },
    { name: 'Law, Justice and Safety',             total:  343_642_278 },
    { name: 'Employment',                          total:   58_551_679 },
    { name: 'Recreation and Resource Development', total:  214_083_293 },
    { name: 'Social Services',                     total:  223_166_806 },
    { name: 'Transportation',                      total:    5_377_360 },
    { name: 'Debt service — Principal Retirement', total:   18_455_934 },
    { name: 'Debt service — Interest',             total:    5_663_006 },
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
  return { jsonTree: [{ n: 'Wyoming General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Wyoming General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'wy-acfr-gf-operating', base_url: 'https://sao.wyo.gov/publications/', fiscal_years: [2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
