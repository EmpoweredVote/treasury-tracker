#!/usr/bin/env node
/**
 * Maine General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Maine Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the ME state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   ME state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-40): ME ACFR GF ~1.24x NASBO GF (FY2025 $6,194,288K vs FY2024 NASBO
 *   $4,980,000K) -- modest divergence, the same mechanism as KS/KY. Maine books essentially
 *   all Federal Grants & Reimbursements to a SEPARATE "Federal" major fund column
 *   ($5,972,037K FY2025), not the General column (General's own Federal line is only $27K
 *   FY2025) -- keeps the GAAP General Fund close to NASBO's own-source budgetary scope.
 *   Accepted-and-relabelled honestly.
 *
 * DERIVABLE URL WITH ONE EXCEPTION (the cleanest URL pattern in the entire cohort):
 *   https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr{YYYY}.pdf for
 *   FY2002-FY2025 EXCEPT FY2020 = acfr2020v2_0.pdf (special-cased above). Landing:
 *   https://www.maine.gov/osc/financial-reporting/annual-comprehensive-financial-report.
 *
 * JUNE-30 FY-END CONFIRMED (the pre-recon "non-June to watch" flag is RESOLVED): every one
 *   of the 26 downloaded PDFs' cover page reads "FOR THE FISCAL YEAR ENDED JUNE 30, {YYYY}"
 *   (or the equivalent title-case form) for its own stated FY -- verified directly (not just
 *   the two recon bookends) at load time; no year needed a shift.
 *
 * HONEST HOLE (FY2000-FY2001, pre-GASB-34 boundary): both files download cleanly (real PDFs,
 *   June-30 FY-end confirmed on their own covers) but their Governmental Funds statement is
 *   titled "COMBINED STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES" (the
 *   pre-GASB-34 combined-fund-type layout), not the modern "Statement of Revenues,
 *   Expenditures and Changes in Fund Balances -- Governmental Funds" with a distinct General
 *   column that extract_gf.py's find_statement() anchors on (same SC/AL FY2002 pre-GASB-34
 *   boundary precedent) -- extract_gf.py correctly reports "statement not found" for both
 *   years rather than mis-transcribing a different statement shape. OMITTED; the durable
 *   clean window is FY2002-FY2025 (24 years, not the recon's aspirational 26yr FY2000 floor --
 *   the recon itself only bookend-tied FY2002 and FY2025, never FY2000/FY2001 directly).
 *
 * 6-COLUMN LAYOUT: General is the 1st of 6 (General | Highway | Federal | Other Special
 *   Revenue | Other Governmental Funds | Total Governmental). extract_gf.py's position-anchor
 *   isolates General regardless of the total column count -- confirmed at both bookends
 *   (FY2025 $6,194,288K / FY2002 $2,302,006K, exact $0 diff on BOTH revenues and
 *   expenditures) and on all 24 loaded years (zero honest holes within the window, zero
 *   rev_boundary sub-heading complications -- ME's revenue lines carry no sub-heading at all,
 *   sub=None throughout). One real GAAP quirk: "Capital Outlay" prints under the "Debt
 *   service:" subsection heading on the expenditure side (confirmed in the source PDF, not a
 *   parsing artifact) -- default_exp_name()'s Debt-service disambiguation only renames
 *   principal/interest lines, so "Capital Outlay" passes through unchanged with no collision.
 *
 * CLEAN EXTRACTION: no wrapped labels, no ALL-CAPS source text, no dual-subsection name
 *   collisions -- every one of the 24 in-window years tied exactly on the first extraction
 *   pass on both the revenue and expenditure sides.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment Income (Loss)" went NEGATIVE in FY2011 only: -54 (thousands, immaterial) -- a real GAAP fair-value-of-investments loss, not an extraction artifact. Every other loaded year is positive (FY2025 +113,749K / FY2002 +3,830K, the recon-confirmed bookends). The P2 clamp is the render path for FY2011; no year shows a negative GF Total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/me/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMEAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Maine'; const STATE_ABBR = 'ME'; const POPULATION = 1_362_359;
const EXPECTED_MUNI_ID = '53f26018-1d20-4f6a-9c0e-400bfb91199a';
const UNITS = 1_000; // ME ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2002.pdf', date: '2002-06-30' },
  2003: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2003.pdf', date: '2003-06-30' },
  2004: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2004.pdf', date: '2004-06-30' },
  2005: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2005.pdf', date: '2005-06-30' },
  2006: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2020v2_0.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2025.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Maine State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — ME ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 2_604_696, confidence: 'actual', categories: [
    { name: 'General Government',                total:      277_640 },
    { name: 'Economic Development',              total:       61_348 },
    { name: 'Education and Culture',             total:    1_157_639 },
    { name: 'Human Services',                    total:      927_868 },
    { name: 'Labor',                             total:       14_729 },
    { name: 'Natural Resources',                 total:       51_439 },
    { name: 'Public Protection',                 total:       24_941 },
    { name: 'Transportation',                    total:        9_308 },
    { name: 'Debt service — Principal Payments', total:       64_305 },
    { name: 'Debt service — Interest Payments',  total:       15_479 },
  ]},
  2003: { total: 2_541_251, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      172_344 },
    { name: 'Economic Development & Workforce Training',  total:       54_292 },
    { name: 'Education',                                  total:    1_143_982 },
    { name: 'Health and Human Services',                  total:      813_105 },
    { name: 'Business Licensing & Regulation',            total:           37 },
    { name: 'Natural Resources Development & Protection', total:       67_315 },
    { name: 'Justice and Protection',                     total:      202_653 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        9_017 },
    { name: 'Transportation Safety & Development',        total:        1_603 },
    { name: 'Debt service — Principal Payments',          total:       63_950 },
    { name: 'Debt service — Interest Payments',           total:       12_953 },
  ]},
  2004: { total: 2_583_425, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      263_839 },
    { name: 'Economic Development & Workforce Training',  total:       47_095 },
    { name: 'Education',                                  total:    1_144_907 },
    { name: 'Heatlh and Human Services',                  total:      777_074 },
    { name: 'Natural Resources Development & Protection', total:       66_692 },
    { name: 'Justice and Protection',                     total:      203_360 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_352 },
    { name: 'Transportation Safety & Development',        total:        3_338 },
    { name: 'Debt service — Principal Payments',          total:       56_310 },
    { name: 'Debt service — Interest Payments',           total:       12_458 },
  ]},
  2005: { total: 2_833_884, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      270_370 },
    { name: 'Economic Development & Workforce Training',  total:       42_278 },
    { name: 'Education',                                  total:    1_201_008 },
    { name: 'Heatlh and Human Services',                  total:      957_371 },
    { name: 'Business Licensing & Regulation',            total:            3 },
    { name: 'Natural Resources Development & Protection', total:       67_310 },
    { name: 'Justice and Protection',                     total:      220_141 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_521 },
    { name: 'Transportation Safety & Development',        total:          831 },
    { name: 'Debt service — Principal Payments',          total:       53_510 },
    { name: 'Debt service — Interest Payments',           total:       12_541 },
  ]},
  2006: { total: 3_133_919, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      327_529 },
    { name: 'Economic Development & Workforce Training',  total:       45_324 },
    { name: 'Education',                                  total:    1_283_214 },
    { name: 'Heatlh and Human Services',                  total:    1_097_456 },
    { name: 'Natural Resources Development & Protection', total:       70_878 },
    { name: 'Justice and Protection',                     total:      227_588 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_504 },
    { name: 'Transportation Safety & Development',        total:          178 },
    { name: 'Debt service — Principal Payments',          total:       57_985 },
    { name: 'Debt service — Interest Payments',           total:       15_263 },
  ]},
  2007: { total: 3_126_123, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      262_721 },
    { name: 'Economic Development & Workforce Training',  total:       40_280 },
    { name: 'Education',                                  total:    1_438_605 },
    { name: 'Health and Human Services',                  total:      972_875 },
    { name: 'Natural Resources Development & Protection', total:       70_373 },
    { name: 'Justice and Protection',                     total:      245_592 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_958 },
    { name: 'Debt service — Principal Payments',          total:       69_350 },
    { name: 'Debt service — Interest Payments',           total:       17_369 },
  ]},
  2008: { total: 3_292_688, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      280_871 },
    { name: 'Economic Development & Workforce Training',  total:       39_360 },
    { name: 'Education',                                  total:    1_478_192 },
    { name: 'Health and Human Services',                  total:    1_063_499 },
    { name: 'Natural Resources Development & Protection', total:       72_709 },
    { name: 'Justice and Protection',                     total:      267_117 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_632 },
    { name: 'Debt service — Principal Payments',          total:       66_250 },
    { name: 'Debt service — Interest Payments',           total:       16_058 },
  ]},
  2009: { total: 2_974_311, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      273_595 },
    { name: 'Economic Development & Workforce Training',  total:       35_751 },
    { name: 'Education',                                  total:    1_451_223 },
    { name: 'Health and Human Services',                  total:      786_512 },
    { name: 'Business Licensing & Regulation',            total:            6 },
    { name: 'Natural Resources Development & Protection', total:       67_669 },
    { name: 'Justice and Protection',                     total:      270_594 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_096 },
    { name: 'Transportation Safety & Development',        total:            1 },
    { name: 'Debt service — Principal Payments',          total:       65_685 },
    { name: 'Debt service — Interest Payments',           total:       15_179 },
  ]},
  2010: { total: 2_932_814, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      257_093 },
    { name: 'Economic Development & Workforce Training',  total:       35_646 },
    { name: 'Education',                                  total:    1_419_891 },
    { name: 'Health and Human Services',                  total:      758_808 },
    { name: 'Business Licensing & Regulation',            total:           22 },
    { name: 'Natural Resources Development & Protection', total:       67_324 },
    { name: 'Justice and Protection',                     total:      270_581 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_311 },
    { name: 'Debt service — Principal Payments',          total:       92_035 },
    { name: 'Debt service — Interest Payments',           total:       24_103 },
  ]},
  2011: { total: 3_050_768, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      238_729 },
    { name: 'Economic Development & Workforce Training',  total:       34_504 },
    { name: 'Education',                                  total:    1_389_383 },
    { name: 'Health and Human Services',                  total:      933_047 },
    { name: 'Natural Resources Development & Protection', total:       64_972 },
    { name: 'Justice and Protection',                     total:      264_792 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_081 },
    { name: 'Transportation Safety & Development',        total:        7_000 },
    { name: 'Debt service — Principal Payments',          total:       89_835 },
    { name: 'Debt service — Interest Payments',           total:       21_425 },
  ]},
  2012: { total: 3_197_022, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      255_191 },
    { name: 'Economic Development & Workforce Training',  total:       33_561 },
    { name: 'Education',                                  total:    1_335_736 },
    { name: 'Health and Human Services',                  total:    1_126_805 },
    { name: 'Natural Resources Development & Protection', total:       65_332 },
    { name: 'Justice and Protection',                     total:      253_226 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_117 },
    { name: 'Debt service — Principal Payments',          total:       98_340 },
    { name: 'Debt service — Interest Payments',           total:       21_714 },
  ]},
  2013: { total: 2_992_485, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      265_160 },
    { name: 'Economic Development & Workforce Training',  total:       31_922 },
    { name: 'Education',                                  total:    1_332_688 },
    { name: 'Health and Human Services',                  total:      907_141 },
    { name: 'Business Licensing & Regulation',            total:          992 },
    { name: 'Natural Resources Development & Protection', total:       64_184 },
    { name: 'Justice and Protection',                     total:      258_969 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        6_932 },
    { name: 'Debt service — Principal Payments',          total:      103_840 },
    { name: 'Debt service — Interest Payments',           total:       20_657 },
  ]},
  2014: { total: 3_280_224, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      219_125 },
    { name: 'Economic Development & Workforce Training',  total:       32_635 },
    { name: 'Education',                                  total:    1_404_149 },
    { name: 'Health and Human Services',                  total:    1_159_000 },
    { name: 'Business Licensing & Regulation',            total:        3_797 },
    { name: 'Natural Resources Development & Protection', total:       66_684 },
    { name: 'Justice and Protection',                     total:      283_477 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_459 },
    { name: 'Debt service — Principal Payments',          total:       85_735 },
    { name: 'Debt service — Interest Payments',           total:       18_163 },
  ]},
  2015: { total: 3_252_959, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      218_279 },
    { name: 'Economic Development & Workforce Training',  total:       31_501 },
    { name: 'Education',                                  total:    1_401_594 },
    { name: 'Health and Human Services',                  total:    1_119_182 },
    { name: 'Natural Resources Development & Protection', total:       68_870 },
    { name: 'Justice and Protection',                     total:      302_133 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_358 },
    { name: 'Debt service — Principal Payments',          total:       84_875 },
    { name: 'Debt service — Interest Payments',           total:       19_167 },
  ]},
  2016: { total: 3_303_495, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      230_692 },
    { name: 'Economic Development & Workforce Training',  total:       39_885 },
    { name: 'Education',                                  total:    1_422_871 },
    { name: 'Health and Human Services',                  total:    1_107_675 },
    { name: 'Natural Resources Development & Protection', total:       73_225 },
    { name: 'Justice and Protection',                     total:      320_810 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_623 },
    { name: 'Debt service — Principal Payments',          total:       80_405 },
    { name: 'Debt service — Interest Payments',           total:       20_309 },
  ]},
  2017: { total: 3_454_184, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      260_661 },
    { name: 'Economic Development & Workforce Training',  total:       42_379 },
    { name: 'Education',                                  total:    1_503_763 },
    { name: 'Health & Human Services',                    total:    1_126_330 },
    { name: 'Natural Resources Development & Protection', total:       75_445 },
    { name: 'Justice & Protection',                       total:      336_267 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_852 },
    { name: 'Debt service — Principal Payments',          total:       78_940 },
    { name: 'Debt service — Interest Expense',            total:       22_547 },
  ]},
  2018: { total: 3_518_735, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      278_502 },
    { name: 'Economic Development & Workforce Training',  total:       41_861 },
    { name: 'Education',                                  total:    1_518_098 },
    { name: 'Health & Human Services',                    total:    1_142_645 },
    { name: 'Business Licensing & Regulation',            total:           73 },
    { name: 'Natural Resources Development & Protection', total:       79_245 },
    { name: 'Justice & Protection',                       total:      338_241 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        7_921 },
    { name: 'Debt service — Principal Payments',          total:       86_075 },
    { name: 'Debt service — Interest Expense',            total:       26_074 },
  ]},
  2019: { total: 3_818_009, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      300_840 },
    { name: 'Economic Development & Workforce Training',  total:       42_688 },
    { name: 'Education',                                  total:    1_610_210 },
    { name: 'Health & Human Services',                    total:    1_310_680 },
    { name: 'Natural Resources Development & Protection', total:       85_649 },
    { name: 'Justice & Protection',                       total:      335_478 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_223 },
    { name: 'Debt service — Principal Payments',          total:       94_515 },
    { name: 'Debt service — Interest Expense',            total:       29_726 },
  ]},
  2020: { total: 3_871_148, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      322_063 },
    { name: 'Economic Development & Workforce Training',  total:       44_460 },
    { name: 'Education',                                  total:    1_732_975 },
    { name: 'Health & Human Services',                    total:    1_191_315 },
    { name: 'Natural Resources Development & Protection', total:       85_122 },
    { name: 'Justice & Protection',                       total:      341_748 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        9_317 },
    { name: 'Transportation Safety & Development',        total:        8_000 },
    { name: 'Debt service — Principal Payments',          total:      101_200 },
    { name: 'Debt service — Interest Expense',            total:       34_948 },
  ]},
  2021: { total: 3_840_542, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      337_750 },
    { name: 'Economic Development & Workforce Training',  total:       44_638 },
    { name: 'Education',                                  total:    1_780_320 },
    { name: 'Health & Human Services',                    total:    1_181_934 },
    { name: 'Natural Resources Development & Protection', total:       68_515 },
    { name: 'Justice & Protection',                       total:      274_665 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        9_255 },
    { name: 'Transportation Safety & Development',        total:        2_000 },
    { name: 'Debt service — Principal Payments',          total:       99_235 },
    { name: 'Debt service — Interest Expense',            total:       42_230 },
  ]},
  2022: { total: 4_224_248, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      371_052 },
    { name: 'Economic Development & Workforce Training',  total:       46_056 },
    { name: 'Education',                                  total:    1_892_691 },
    { name: 'Health & Human Services',                    total:    1_276_680 },
    { name: 'Natural Resources Development & Protection', total:       93_520 },
    { name: 'Justice & Protection',                       total:      378_204 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        8_728 },
    { name: 'Debt service — Principal Payments',          total:      103_372 },
    { name: 'Debt service — Interest Expense',            total:       41_881 },
    { name: 'Capital Outlay',                             total:       12_064 },
  ]},
  2023: { total: 4_522_077, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      286_512 },
    { name: 'Economic Development & Workforce Training',  total:       58_205 },
    { name: 'Education',                                  total:    2_001_566 },
    { name: 'Health & Human Services',                    total:    1_422_937 },
    { name: 'Business Licensing & Regulation',            total:          500 },
    { name: 'Natural Resources Development & Protection', total:      105_278 },
    { name: 'Justice & Protection',                       total:      398_834 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:        9_509 },
    { name: 'Debt service — Principal Payments',          total:      120_732 },
    { name: 'Debt service — Interest Expense',            total:       43_348 },
    { name: 'Capital Outlay',                             total:       74_656 },
  ]},
  2024: { total: 5_253_584, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      442_266 },
    { name: 'Economic Development & Workforce Training',  total:       62_293 },
    { name: 'Education',                                  total:    2_133_321 },
    { name: 'Health & Human Services',                    total:    1_823_324 },
    { name: 'Natural Resources Development & Protection', total:      130_531 },
    { name: 'Justice & Protection',                       total:      455_200 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:       11_531 },
    { name: 'Debt service — Principal Payments',          total:      135_752 },
    { name: 'Debt service — Interest Expense',            total:       43_897 },
    { name: 'Capital Outlay',                             total:       15_469 },
  ]},
  2025: { total: 5_681_088, confidence: 'actual', categories: [
    { name: 'Governmental Support & Operations',          total:      454_078 },
    { name: 'Economic Development & Workforce Training',  total:       64_886 },
    { name: 'Education',                                  total:    2_224_805 },
    { name: 'Health & Human Services',                    total:    2_102_410 },
    { name: 'Natural Resources Development & Protection', total:      136_079 },
    { name: 'Justice & Protection',                       total:      511_357 },
    { name: 'Arts, Heritage & Cultural Enrichment',       total:       11_399 },
    { name: 'Debt service — Principal Payments',          total:      127_711 },
    { name: 'Debt service — Interest Expense',            total:       40_893 },
    { name: 'Capital Outlay',                             total:        7_470 },
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
  return { jsonTree: [{ n: 'Maine General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Maine General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'me-acfr-gf-operating', base_url: 'https://www.maine.gov/osc/financial-reporting/annual-comprehensive-financial-report', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
