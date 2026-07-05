#!/usr/bin/env node
/**
 * State General Fund Loader — NASBO source (operating / spending-by-function)  [FALLBACK-ONLY]
 * ──────────────────────────────────────────────────────────────────────────
 * ⚠ FALLBACK-ONLY (retired 2026-07-05, NASBORT-01). All 50 states are now on State-ACFR GAAP
 *   General-Fund data (Phases 118–121 loaded the last 21; 122 deepened CA/FL). This NASBO loader
 *   is DEMOTED to a dormant fallback — kept, NOT deleted (REQUIREMENTS non-goal). A behavioral
 *   never-overwrite-ACFR guard (`isAcfrOccupied`) makes it skip any state-FY already served by a
 *   non-NASBO/ACFR source, so an unfiltered re-run is a safe no-op. It writes ONLY where the node
 *   is absent or itself NASBO — currently the two honest ACFR-gap fallbacks (NV FY2024, KY FY2023).
 *   See docs/state-acfr-5050.md for the 50/50-ACFR end state.
 *
 * Phase 94 (SGFS-01). Source decision LOCKED by Chris 2026-06-27 (94-01-SPIKE.md):
 *   Hybrid — NASBO now (49 states), Minnesota kept as the ACFR gold-standard outlier,
 *   per-state ACFR upgrades for high-traffic states later. (Now complete: all 50 on ACFR.)
 *
 * Basis: NASBO State Expenditure Report (SER) reports each state's GENERAL FUND
 *   spending across functional categories by fund source (the "General Fund" column
 *   of each program-area table). This is a *budgetary* General Fund — close to, but
 *   not identical to, ACFR GAAP General Fund (MN NASBO GF FY2023 $27.2B vs MN ACFR
 *   $26.6B ≈ 2%). Mixed basis is accepted ONLY because every node self-declares its
 *   basis + source (94-01-POLICY.md P3). data_source carries "budgetary basis".
 *
 * 2025 SER taxonomy (6-function — cohort entries use this structure):
 *   Elementary & Secondary Education, Higher Education, Medicaid, Corrections,
 *   Transportation, All Other.
 *   NOTE: Starting with the 2025 SER, Public Assistance (TANF/cash assistance) was
 *   folded into "All Other" and no longer appears as a standalone chapter (NASBO 2025
 *   SER p.490). All Phase 96 cohort state entries use the 6-function structure; no
 *   Public Assistance line. Checksums still close to Table 1 GF exactly (verified).
 *   Georgia FY2023 (loaded from the 2024 SER) retains the original 7-function structure
 *   with a standalone Public Assistance = $0 — do NOT modify that existing row.
 *
 * Scope of THIS loader: operating (spending-by-function) only. NASBO has NO per-state
 *   revenue-by-source table (revenue-by-source is national-aggregate only in the Fiscal
 *   Survey), so per-state GF revenue-by-source DEFERS to the ACFR upgrade per the hybrid
 *   decision (94-01-SPIKE.md "honest gaps"). Revenue is intentionally not loaded here.
 *
 * Policy applied (94-01-POLICY.md): P1 actuals-only window; P2 negative-category
 *   clamp-to-0-area + retain-signed-value-in-label + carry source total; P3 node label +
 *   mandatory basis label; P4 0-NULL source-stamp via targeted post-RPC UPDATE (never
 *   treasury_sync_city_budget); P5 no fabrication; P6 idempotent + targeted write.
 *
 * Data provenance: every figure below is the GENERAL FUND column transcribed from the
 *   NASBO SER per-program-area tables, each value checksum-verified to its row Total, and
 *   the function-sum cross-checked to NASBO Table 1 (Total State Expenditures, GF column)
 *   within rounding. No estimates.
 *
 * Usage:
 *   node scripts/loadStateGF.mjs [--dry-run] [--state GA] [--fy 2023]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── NASBO edition provenance (the resolving source_url + edition). source_date = the
//    state's fiscal-year-end the actual figures represent (per 94-01-POLICY P4). ────────
const NASBO_SER = {
  url: 'https://higherlogicdownload.s3.amazonaws.com/NASBO/9d2d2db1-c943-4f1b-b750-0fca152d64c2/UploadedImages/SER%20Archive/2025_SER/2025_NASBO_State_Expenditure_Report_S.pdf',
  edition: '2025 State Expenditure Report (actual FY2023, FY2024)',
};
const FY_END_MMDD = {
  GA: '06-30',  // Jun 30 (existing)
  AL: '09-30',  // Oct 1 → Sep 30 (verified: 2025 SER p.1)
  MI: '09-30',  // Oct 1 → Sep 30 (verified: 2025 SER p.1)
  TX: '08-31',  // Sep 1 → Aug 31 (verified: 2025 SER p.1)
  NY: '03-31',  // Apr 1 → Mar 31 (verified: 2025 SER p.1)
  // all others: '06-30' (June 30 default — see sourceDate() fallback)
};

// ── Source data: NASBO SER General Fund expenditures by function ($, ACTUAL years only).
//    controlTotalGF = NASBO Table 1 (Total State Expenditures) General Fund column — the
//    independent control the function-sum must tie to (cross-check, P-honesty).
//    2025 SER cohort entries use the 6-function taxonomy (no standalone Public Assistance).
//    GA FY2023 (2024 SER) uses the original 7-function taxonomy — byte-unchanged. ──────
const STATES = {
  GA: {
    name: 'Georgia', abbr: 'GA', population: 11_180_878,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 29_266_000_000,
        categories: [
          { name: 'Elementary & Secondary Education', total: 11_463_000_000 },
          { name: 'All Other',                         total:  6_611_000_000 },
          { name: 'Higher Education',                  total:  3_903_000_000 },
          { name: 'Medicaid',                          total:  3_390_000_000 },
          { name: 'Transportation',                    total:  2_011_000_000 },
          { name: 'Corrections',                       total:  1_888_000_000 },
          { name: 'Public Assistance',                 total:          0       },
        ],
      },
      // GA FY2024 — from 2025 SER (6-function taxonomy; Public Assistance merged into All Other).
      // GA FY2023 above is sourced+stamped to the 2025 SER. Phase 97 fix F-97-01 (2026-06-29):
      // Medicaid corrected 3,398 (stale 2024-SER value) → 3,390 (2025 SER, the stamped source) so the
      // 7 categories sum to controlTotalGF 29,266 (was 29,274; +$8M children-over-parent). All Other
      // (6,611) was already the 2025 residual.
      2024: {
        confidence: 'actual',
        controlTotalGF: 34_594_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 12_269_000_000 },
          { name: 'Higher Education',                  total:  3_964_000_000 },
          { name: 'Medicaid',                          total:  5_318_000_000 },
          { name: 'Corrections',                       total:  2_010_000_000 },
          { name: 'Transportation',                    total:  2_393_000_000 },
          { name: 'All Other',                         total:  8_640_000_000 },
        ],
      },
    },
  },

  // ── Batch A: AK AL AR AZ CA CO (2025 SER — 6-function taxonomy, no Public Assistance) ─

  AK: {
    name: 'Alaska', abbr: 'AK', population: 733_391,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 7_450_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_436_000_000 },
          { name: 'Higher Education',                  total:   325_000_000 },
          { name: 'Medicaid',                          total:   612_000_000 },
          { name: 'Corrections',                       total:   453_000_000 },
          { name: 'Transportation',                    total:   234_000_000 },
          { name: 'All Other',                         total: 4_390_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 6_339_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_460_000_000 },
          { name: 'Higher Education',                  total:   357_000_000 },
          { name: 'Medicaid',                          total:   707_000_000 },
          { name: 'Corrections',                       total:   468_000_000 },
          { name: 'Transportation',                    total:   235_000_000 },
          { name: 'All Other',                         total: 3_112_000_000 },
        ],
      },
    },
  },

  AL: {
    name: 'Alabama', abbr: 'AL', population: 5_024_279,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 13_764_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 6_300_000_000 },
          { name: 'Higher Education',                  total: 3_037_000_000 },
          { name: 'Medicaid',                          total:   813_000_000 },
          { name: 'Corrections',                       total:   759_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 2_855_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 13_511_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 6_389_000_000 },
          { name: 'Higher Education',                  total: 2_629_000_000 },
          { name: 'Medicaid',                          total:   855_000_000 },
          { name: 'Corrections',                       total:   846_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 2_792_000_000 },
        ],
      },
    },
  },

  AR: {
    name: 'Arkansas', abbr: 'AR', population: 3_011_524,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 5_924_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_396_000_000 },
          { name: 'Higher Education',                  total:   829_000_000 },
          { name: 'Medicaid',                          total: 1_347_000_000 },
          { name: 'Corrections',                       total:   443_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total:   909_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 6_075_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_509_000_000 },
          { name: 'Higher Education',                  total:   833_000_000 },
          { name: 'Medicaid',                          total: 1_351_000_000 },
          { name: 'Corrections',                       total:   435_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total:   947_000_000 },
        ],
      },
    },
  },

  AZ: {
    name: 'Arizona', abbr: 'AZ', population: 7_151_502,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 16_001_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 7_327_000_000 },
          { name: 'Higher Education',                  total: 1_209_000_000 },
          { name: 'Medicaid',                          total: 2_172_000_000 },
          { name: 'Corrections',                       total: 1_412_000_000 },
          { name: 'Transportation',                    total:   110_000_000 },
          { name: 'All Other',                         total: 3_771_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 17_903_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 8_056_000_000 },
          { name: 'Higher Education',                  total: 1_166_000_000 },
          { name: 'Medicaid',                          total: 2_401_000_000 },
          { name: 'Corrections',                       total: 1_451_000_000 },
          { name: 'Transportation',                    total:   396_000_000 },
          { name: 'All Other',                         total: 4_433_000_000 },
        ],
      },
    },
  },

  CA: {
    name: 'California', abbr: 'CA', population: 39_538_223,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 195_189_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:  65_687_000_000 },
          { name: 'Higher Education',                  total:  20_116_000_000 },
          { name: 'Medicaid',                          total:  30_614_000_000 },
          { name: 'Corrections',                       total:  14_756_000_000 },
          { name: 'Transportation',                    total:     969_000_000 },
          { name: 'All Other',                         total:  63_047_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 205_671_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:  65_796_000_000 },
          { name: 'Higher Education',                  total:  20_538_000_000 },
          { name: 'Medicaid',                          total:  37_249_000_000 },
          { name: 'Corrections',                       total:  14_577_000_000 },
          { name: 'Transportation',                    total:   2_245_000_000 },
          { name: 'All Other',                         total:  65_265_000_000 },
        ],
      },
    },
  },

  CO: {
    name: 'Colorado', abbr: 'CO', population: 5_773_714,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 13_647_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_500_000_000 },
          { name: 'Higher Education',                  total: 1_386_000_000 },
          { name: 'Medicaid',                          total: 3_344_000_000 },
          { name: 'Corrections',                       total:   924_000_000 },
          { name: 'Transportation',                    total:     1_000_000 },
          { name: 'All Other',                         total: 3_492_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 14_513_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_716_000_000 },
          { name: 'Higher Education',                  total: 1_729_000_000 },
          { name: 'Medicaid',                          total: 4_152_000_000 },
          { name: 'Corrections',                       total:   583_000_000 },
          { name: 'Transportation',                    total:     1_000_000 },
          { name: 'All Other',                         total: 3_332_000_000 },
        ],
      },
    },
  },

  // ── Batch A: CT DE FL HI IA ID (2025 SER — 6-function taxonomy, no Public Assistance) ─

  CT: {
    name: 'Connecticut', abbr: 'CT', population: 3_605_944,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 22_199_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:  4_796_000_000 },
          { name: 'Higher Education',                  total:    915_000_000 },
          { name: 'Medicaid',                          total:  5_020_000_000 },
          { name: 'Corrections',                       total:    723_000_000 },
          { name: 'Transportation',                    total:              0 },
          { name: 'All Other',                         total: 10_745_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 22_779_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:  4_898_000_000 },
          { name: 'Higher Education',                  total:    890_000_000 },
          { name: 'Medicaid',                          total:  5_634_000_000 },
          { name: 'Corrections',                       total:    727_000_000 },
          { name: 'Transportation',                    total:              0 },
          { name: 'All Other',                         total: 10_630_000_000 },
        ],
      },
    },
  },

  DE: {
    name: 'Delaware', abbr: 'DE', population: 989_948,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 5_861_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_911_000_000 },
          { name: 'Higher Education',                  total:   303_000_000 },
          { name: 'Medicaid',                          total:   933_000_000 },
          { name: 'Corrections',                       total:   404_000_000 },
          { name: 'Transportation',                    total:     9_000_000 },
          { name: 'All Other',                         total: 2_301_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 6_232_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_101_000_000 },
          { name: 'Higher Education',                  total:   347_000_000 },
          { name: 'Medicaid',                          total: 1_043_000_000 },
          { name: 'Corrections',                       total:   439_000_000 },
          { name: 'Transportation',                    total:     5_000_000 },
          { name: 'All Other',                         total: 2_297_000_000 },
        ],
      },
    },
  },

  FL: {
    name: 'Florida', abbr: 'FL', population: 21_538_187,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 44_219_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 12_786_000_000 },
          { name: 'Higher Education',                  total:  5_019_000_000 },
          { name: 'Medicaid',                          total:  7_501_000_000 },
          { name: 'Corrections',                       total:  3_274_000_000 },
          { name: 'Transportation',                    total:    192_000_000 },
          { name: 'All Other',                         total: 15_447_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 51_649_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 13_529_000_000 },
          { name: 'Higher Education',                  total:  6_217_000_000 },
          { name: 'Medicaid',                          total:  7_463_000_000 },
          { name: 'Corrections',                       total:  3_839_000_000 },
          { name: 'Transportation',                    total:    329_000_000 },
          { name: 'All Other',                         total: 20_272_000_000 },
        ],
      },
    },
  },

  HI: {
    name: 'Hawaii', abbr: 'HI', population: 1_455_271,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 10_757_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_727_000_000 },
          { name: 'Higher Education',                  total:   581_000_000 },
          { name: 'Medicaid',                          total:   800_000_000 },
          { name: 'Corrections',                       total:   291_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 6_358_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 11_222_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_477_000_000 },
          { name: 'Higher Education',                  total:   694_000_000 },
          { name: 'Medicaid',                          total:   804_000_000 },
          { name: 'Corrections',                       total:   363_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 6_884_000_000 },
        ],
      },
    },
  },

  IA: {
    name: 'Iowa', abbr: 'IA', population: 3_190_369,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 8_216_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_669_000_000 },
          { name: 'Higher Education',                  total:   896_000_000 },
          { name: 'Medicaid',                          total: 1_528_000_000 },
          { name: 'Corrections',                       total:   416_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_707_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 8_560_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_989_000_000 },
          { name: 'Higher Education',                  total:   799_000_000 },
          { name: 'Medicaid',                          total: 1_561_000_000 },
          { name: 'Corrections',                       total:   430_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_781_000_000 },
        ],
      },
    },
  },

  ID: {
    name: 'Idaho', abbr: 'ID', population: 1_839_106,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 4_548_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_353_000_000 },
          { name: 'Higher Education',                  total:   521_000_000 },
          { name: 'Medicaid',                          total:   637_000_000 },
          { name: 'Corrections',                       total:   349_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total:   688_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 5_020_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_676_000_000 },
          { name: 'Higher Education',                  total:   626_000_000 },
          { name: 'Medicaid',                          total:   673_000_000 },
          { name: 'Corrections',                       total:   373_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total:   672_000_000 },
        ],
      },
    },
  },

  // ── Batch B: IL IN KS KY LA MA MD ME MI MO MS MT (2025 SER — 6-function taxonomy) ──

  IL: {
    name: 'Illinois', abbr: 'IL', population: 12_812_508,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 43_693_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:  9_756_000_000 },
          { name: 'Higher Education',                  total:  2_619_000_000 },
          { name: 'Medicaid',                          total:  3_859_000_000 },
          { name: 'Corrections',                       total:  1_725_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 25_733_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 48_563_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 10_349_000_000 },
          { name: 'Higher Education',                  total:  2_505_000_000 },
          { name: 'Medicaid',                          total:  4_685_000_000 },
          { name: 'Corrections',                       total:  1_837_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 29_187_000_000 },
        ],
      },
    },
  },

  IN: {
    name: 'Indiana', abbr: 'IN', population: 6_785_528,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 26_397_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 12_709_000_000 },
          { name: 'Higher Education',                  total:  2_733_000_000 },
          { name: 'Medicaid',                          total:  2_678_000_000 },
          { name: 'Corrections',                       total:  1_628_000_000 },
          { name: 'Transportation',                    total:    45_000_000 },
          { name: 'All Other',                         total:  6_604_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 22_405_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 10_403_000_000 },
          { name: 'Higher Education',                  total:  2_532_000_000 },
          { name: 'Medicaid',                          total:  4_116_000_000 },
          { name: 'Corrections',                       total:    931_000_000 },
          { name: 'Transportation',                    total:     69_000_000 },
          { name: 'All Other',                         total:  4_354_000_000 },
        ],
      },
    },
  },

  KS: {
    name: 'Kansas', abbr: 'KS', population: 2_937_880,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 8_727_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_389_000_000 },
          { name: 'Higher Education',                  total: 1_004_000_000 },
          { name: 'Medicaid',                          total: 1_349_000_000 },
          { name: 'Corrections',                       total:   480_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_506_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 9_365_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_570_000_000 },
          { name: 'Higher Education',                  total: 1_149_000_000 },
          { name: 'Medicaid',                          total: 1_590_000_000 },
          { name: 'Corrections',                       total:   524_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_532_000_000 },
        ],
      },
    },
  },

  KY: {
    name: 'Kentucky', abbr: 'KY', population: 4_505_836,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 14_350_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 5_208_000_000 },
          { name: 'Higher Education',                  total: 1_418_000_000 },
          { name: 'Medicaid',                          total: 1_963_000_000 },
          { name: 'Corrections',                       total:   764_000_000 },
          { name: 'Transportation',                    total:    18_000_000 },
          { name: 'All Other',                         total: 4_979_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 14_188_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 5_173_000_000 },
          { name: 'Higher Education',                  total: 1_485_000_000 },
          { name: 'Medicaid',                          total: 2_403_000_000 },
          { name: 'Corrections',                       total:   902_000_000 },
          { name: 'Transportation',                    total:    17_000_000 },
          { name: 'All Other',                         total: 4_208_000_000 },
        ],
      },
    },
  },

  LA: {
    name: 'Louisiana', abbr: 'LA', population: 4_657_757,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 11_880_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_926_000_000 },
          { name: 'Higher Education',                  total: 1_302_000_000 },
          { name: 'Medicaid',                          total: 1_770_000_000 },
          { name: 'Corrections',                       total: 1_003_000_000 },
          { name: 'Transportation',                    total:    79_000_000 },
          { name: 'All Other',                         total: 3_800_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 11_970_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_245_000_000 },
          { name: 'Higher Education',                  total: 1_469_000_000 },
          { name: 'Medicaid',                          total: 1_721_000_000 },
          { name: 'Corrections',                       total: 1_041_000_000 },
          { name: 'Transportation',                    total:    90_000_000 },
          { name: 'All Other',                         total: 3_404_000_000 },
        ],
      },
    },
  },

  MA: {
    name: 'Massachusetts', abbr: 'MA', population: 7_029_917,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 34_287_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:  6_576_000_000 },
          { name: 'Higher Education',                  total:  1_562_000_000 },
          { name: 'Medicaid',                          total:  9_033_000_000 },
          { name: 'Corrections',                       total:  1_637_000_000 },
          { name: 'Transportation',                    total:    336_000_000 },
          { name: 'All Other',                         total: 15_143_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 35_720_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:  7_522_000_000 },
          { name: 'Higher Education',                  total:  1_756_000_000 },
          { name: 'Medicaid',                          total:  8_870_000_000 },
          { name: 'Corrections',                       total:  1_675_000_000 },
          { name: 'Transportation',                    total:    728_000_000 },
          { name: 'All Other',                         total: 15_169_000_000 },
        ],
      },
    },
  },

  MD: {
    name: 'Maryland', abbr: 'MD', population: 6_177_224,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 27_972_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:  7_230_000_000 },
          { name: 'Higher Education',                  total:  2_759_000_000 },
          { name: 'Medicaid',                          total:  4_068_000_000 },
          { name: 'Corrections',                       total:  1_696_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 12_219_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 27_397_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:  7_564_000_000 },
          { name: 'Higher Education',                  total:  3_154_000_000 },
          { name: 'Medicaid',                          total:  4_505_000_000 },
          { name: 'Corrections',                       total:  1_870_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 10_304_000_000 },
        ],
      },
    },
  },

  ME: {
    name: 'Maine', abbr: 'ME', population: 1_362_359,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 4_304_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_645_000_000 },
          { name: 'Higher Education',                  total:   384_000_000 },
          { name: 'Medicaid',                          total:   886_000_000 },
          { name: 'Corrections',                       total:   208_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_181_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 4_980_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_744_000_000 },
          { name: 'Higher Education',                  total:   397_000_000 },
          { name: 'Medicaid',                          total: 1_132_000_000 },
          { name: 'Corrections',                       total:   230_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_477_000_000 },
        ],
      },
    },
  },

  MI: {
    name: 'Michigan', abbr: 'MI', population: 10_077_331,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 14_861_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:   185_000_000 },
          { name: 'Higher Education',                  total: 1_748_000_000 },
          { name: 'Medicaid',                          total: 3_100_000_000 },
          { name: 'Corrections',                       total: 1_884_000_000 },
          { name: 'Transportation',                    total:   396_000_000 },
          { name: 'All Other',                         total: 7_548_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 15_129_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:   162_000_000 },
          { name: 'Higher Education',                  total: 1_707_000_000 },
          { name: 'Medicaid',                          total: 3_521_000_000 },
          { name: 'Corrections',                       total: 2_231_000_000 },
          { name: 'Transportation',                    total:   300_000_000 },
          { name: 'All Other',                         total: 7_208_000_000 },
        ],
      },
    },
  },

  MO: {
    name: 'Missouri', abbr: 'MO', population: 6_154_913,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 12_526_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_964_000_000 },
          { name: 'Higher Education',                  total: 1_045_000_000 },
          { name: 'Medicaid',                          total: 2_933_000_000 },
          { name: 'Corrections',                       total:   769_000_000 },
          { name: 'Transportation',                    total:    74_000_000 },
          { name: 'All Other',                         total: 3_741_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 14_561_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_916_000_000 },
          { name: 'Higher Education',                  total: 1_121_000_000 },
          { name: 'Medicaid',                          total: 3_184_000_000 },
          { name: 'Corrections',                       total:   830_000_000 },
          { name: 'Transportation',                    total:   217_000_000 },
          { name: 'All Other',                         total: 5_293_000_000 },
        ],
      },
    },
  },

  MS: {
    name: 'Mississippi', abbr: 'MS', population: 2_961_279,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 6_315_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_575_000_000 },
          { name: 'Higher Education',                  total:   900_000_000 },
          { name: 'Medicaid',                          total:   660_000_000 },
          { name: 'Corrections',                       total:   391_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_789_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 6_635_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_688_000_000 },
          { name: 'Higher Education',                  total:   940_000_000 },
          { name: 'Medicaid',                          total:   636_000_000 },
          { name: 'Corrections',                       total:   405_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_966_000_000 },
        ],
      },
    },
  },

  MT: {
    name: 'Montana', abbr: 'MT', population: 1_084_225,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 2_617_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:   926_000_000 },
          { name: 'Higher Education',                  total:   263_000_000 },
          { name: 'Medicaid',                          total:   290_000_000 },
          { name: 'Corrections',                       total:   227_000_000 },
          { name: 'Transportation',                    total:    51_000_000 },
          { name: 'All Other',                         total:   860_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 2_684_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:   507_000_000 },
          { name: 'Higher Education',                  total:   270_000_000 },
          { name: 'Medicaid',                          total:   373_000_000 },
          { name: 'Corrections',                       total:   262_000_000 },
          { name: 'Transportation',                    total:    54_000_000 },
          { name: 'All Other',                         total: 1_219_000_000 },
        ],
      },
    },
  },

  // ── Batch C: NC ND NE NH NJ NM NV NY OK OR PA RI (2025 SER — 6-function taxonomy) ──

  NC: {
    name: 'North Carolina', abbr: 'NC', population: 10_439_388,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 26_775_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 11_039_000_000 },
          { name: 'Higher Education',                  total:  5_145_000_000 },
          { name: 'Medicaid',                          total:  3_947_000_000 },
          { name: 'Corrections',                       total:  2_002_000_000 },
          { name: 'Transportation',                    total:              0 },
          { name: 'All Other',                         total:  4_642_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 29_216_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 11_368_000_000 },
          { name: 'Higher Education',                  total:  5_614_000_000 },
          { name: 'Medicaid',                          total:  4_431_000_000 },
          { name: 'Corrections',                       total:  2_099_000_000 },
          { name: 'Transportation',                    total:              0 },
          { name: 'All Other',                         total:  5_704_000_000 },
        ],
      },
    },
  },

  ND: {
    name: 'North Dakota', abbr: 'ND', population: 779_094,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 2_436_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:   724_000_000 },
          { name: 'Higher Education',                  total:   383_000_000 },
          { name: 'Medicaid',                          total:   467_000_000 },
          { name: 'Corrections',                       total:   124_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total:   738_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 2_876_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:   914_000_000 },
          { name: 'Higher Education',                  total:   448_000_000 },
          { name: 'Medicaid',                          total:   534_000_000 },
          { name: 'Corrections',                       total:   134_000_000 },
          { name: 'Transportation',                    total:     2_000_000 },
          { name: 'All Other',                         total:   844_000_000 },
        ],
      },
    },
  },

  NE: {
    name: 'Nebraska', abbr: 'NE', population: 1_961_504,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 5_154_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_329_000_000 },
          { name: 'Higher Education',                  total:   860_000_000 },
          { name: 'Medicaid',                          total: 1_196_000_000 },
          { name: 'Corrections',                       total:   484_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_285_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 5_314_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_308_000_000 },
          { name: 'Higher Education',                  total:   890_000_000 },
          { name: 'Medicaid',                          total: 1_242_000_000 },
          { name: 'Corrections',                       total:   510_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_364_000_000 },
        ],
      },
    },
  },

  NH: {
    name: 'New Hampshire', abbr: 'NH', population: 1_377_529,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 2_136_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:    28_000_000 },
          { name: 'Higher Education',                  total:   149_000_000 },
          { name: 'Medicaid',                          total:   737_000_000 },
          { name: 'Corrections',                       total:   162_000_000 },
          { name: 'Transportation',                    total:    83_000_000 },
          { name: 'All Other',                         total:   977_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 1_981_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:    32_000_000 },
          { name: 'Higher Education',                  total:   177_000_000 },
          { name: 'Medicaid',                          total:   858_000_000 },
          { name: 'Corrections',                       total:   168_000_000 },
          { name: 'Transportation',                    total:    25_000_000 },
          { name: 'All Other',                         total:   721_000_000 },
        ],
      },
    },
  },

  NJ: {
    name: 'New Jersey', abbr: 'NJ', population: 9_288_994,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 48_837_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 18_820_000_000 },
          { name: 'Higher Education',                  total:  3_303_000_000 },
          { name: 'Medicaid',                          total:  5_248_000_000 },
          { name: 'Corrections',                       total:  1_319_000_000 },
          { name: 'Transportation',                    total:  1_864_000_000 },
          { name: 'All Other',                         total: 18_283_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 52_996_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 19_892_000_000 },
          { name: 'Higher Education',                  total:  3_684_000_000 },
          { name: 'Medicaid',                          total:  6_468_000_000 },
          { name: 'Corrections',                       total:  1_376_000_000 },
          { name: 'Transportation',                    total:  1_959_000_000 },
          { name: 'All Other',                         total: 19_617_000_000 },
        ],
      },
    },
  },

  NM: {
    name: 'New Mexico', abbr: 'NM', population: 2_117_522,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 8_682_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_873_000_000 },
          { name: 'Higher Education',                  total: 1_115_000_000 },
          { name: 'Medicaid',                          total: 1_209_000_000 },
          { name: 'Corrections',                       total:   393_000_000 },
          { name: 'Transportation',                    total:   220_000_000 },
          { name: 'All Other',                         total: 1_872_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 9_975_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_228_000_000 },
          { name: 'Higher Education',                  total: 1_438_000_000 },
          { name: 'Medicaid',                          total: 1_643_000_000 },
          { name: 'Corrections',                       total:   401_000_000 },
          { name: 'Transportation',                    total:   303_000_000 },
          { name: 'All Other',                         total: 1_962_000_000 },
        ],
      },
    },
  },

  NV: {
    name: 'Nevada', abbr: 'NV', population: 3_104_614,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 4_742_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_552_000_000 },
          { name: 'Higher Education',                  total:   698_000_000 },
          { name: 'Medicaid',                          total: 1_049_000_000 },
          { name: 'Corrections',                       total:   321_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_122_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 5_273_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_621_000_000 },
          { name: 'Higher Education',                  total:   803_000_000 },
          { name: 'Medicaid',                          total:   941_000_000 },
          { name: 'Corrections',                       total:   330_000_000 },
          { name: 'Transportation',                    total:     2_000_000 },
          { name: 'All Other',                         total: 1_576_000_000 },
        ],
      },
    },
  },

  NY: {
    // FY end: Apr 1 → Mar 31 (verified: 2025 SER p.1). source_date resolves to FY-03-31 via FY_END_MMDD.
    name: 'New York', abbr: 'NY', population: 20_201_249,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 84_474_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 27_828_000_000 },
          { name: 'Higher Education',                  total:  2_882_000_000 },
          { name: 'Medicaid',                          total: 24_351_000_000 },
          { name: 'Corrections',                       total:  2_685_000_000 },
          { name: 'Transportation',                    total:    511_000_000 },
          { name: 'All Other',                         total: 26_217_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 91_070_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 31_202_000_000 },
          { name: 'Higher Education',                  total:  3_128_000_000 },
          { name: 'Medicaid',                          total: 27_391_000_000 },
          { name: 'Corrections',                       total:  2_689_000_000 },
          { name: 'Transportation',                    total:    916_000_000 },
          { name: 'All Other',                         total: 25_744_000_000 },
        ],
      },
    },
  },

  OK: {
    name: 'Oklahoma', abbr: 'OK', population: 3_959_353,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 7_752_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_180_000_000 },
          { name: 'Higher Education',                  total:   831_000_000 },
          { name: 'Medicaid',                          total: 1_089_000_000 },
          { name: 'Corrections',                       total:   500_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 2_152_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 9_139_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_360_000_000 },
          { name: 'Higher Education',                  total:   924_000_000 },
          { name: 'Medicaid',                          total:   729_000_000 },
          { name: 'Corrections',                       total:   557_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 2_569_000_000 },
        ],
      },
    },
  },

  OR: {
    name: 'Oregon', abbr: 'OR', population: 4_237_256,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 13_586_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_336_000_000 },
          { name: 'Higher Education',                  total: 1_298_000_000 },
          { name: 'Medicaid',                          total: 1_566_000_000 },
          { name: 'Corrections',                       total:   670_000_000 },
          { name: 'Transportation',                    total:    23_000_000 },
          { name: 'All Other',                         total: 5_692_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 16_100_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_935_000_000 },
          { name: 'Higher Education',                  total: 1_608_000_000 },
          { name: 'Medicaid',                          total: 2_934_000_000 },
          { name: 'Corrections',                       total: 1_312_000_000 },
          { name: 'Transportation',                    total:    49_000_000 },
          { name: 'All Other',                         total: 5_263_000_000 },
        ],
      },
    },
  },

  PA: {
    name: 'Pennsylvania', abbr: 'PA', population: 13_002_700,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 40_800_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 15_042_000_000 },
          { name: 'Higher Education',                  total:  2_007_000_000 },
          { name: 'Medicaid',                          total: 11_566_000_000 },
          { name: 'Corrections',                       total:  2_845_000_000 },
          { name: 'Transportation',                    total:      3_000_000 },
          { name: 'All Other',                         total:  9_337_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 44_864_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 15_886_000_000 },
          { name: 'Higher Education',                  total:  2_056_000_000 },
          { name: 'Medicaid',                          total: 13_378_000_000 },
          { name: 'Corrections',                       total:  3_110_000_000 },
          { name: 'Transportation',                    total:    164_000_000 },
          { name: 'All Other',                         total: 10_270_000_000 },
        ],
      },
    },
  },

  RI: {
    name: 'Rhode Island', abbr: 'RI', population: 1_097_379,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 5_075_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_437_000_000 },
          { name: 'Higher Education',                  total:   264_000_000 },
          { name: 'Medicaid',                          total: 1_189_000_000 },
          { name: 'Corrections',                       total:   284_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 1_901_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 5_236_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_494_000_000 },
          { name: 'Higher Education',                  total:   310_000_000 },
          { name: 'Medicaid',                          total: 1_161_000_000 },
          { name: 'Corrections',                       total:   264_000_000 },
          { name: 'Transportation',                    total:             0 },
          { name: 'All Other',                         total: 2_007_000_000 },
        ],
      },
    },
  },

  // ── Batch D: SC SD TN TX UT VT WA WI WV WY (2025 SER — 6-function taxonomy) ──────────

  SC: {
    name: 'South Carolina', abbr: 'SC', population: 5_118_425,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 12_089_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 3_951_000_000 },
          { name: 'Higher Education',                  total: 1_197_000_000 },
          { name: 'Medicaid',                          total: 1_632_000_000 },
          { name: 'Corrections',                       total:   825_000_000 },
          { name: 'Transportation',                    total:   375_000_000 },
          { name: 'All Other',                         total: 4_109_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 14_189_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_215_000_000 },
          { name: 'Higher Education',                  total: 1_465_000_000 },
          { name: 'Medicaid',                          total: 1_799_000_000 },
          { name: 'Corrections',                       total:   827_000_000 },
          { name: 'Transportation',                    total:   163_000_000 },
          { name: 'All Other',                         total: 5_720_000_000 },
        ],
      },
    },
  },

  SD: {
    name: 'South Dakota', abbr: 'SD', population: 886_667,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 2_231_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:   646_000_000 },
          { name: 'Higher Education',                  total:   333_000_000 },
          { name: 'Medicaid',                          total:   381_000_000 },
          { name: 'Corrections',                       total:   315_000_000 },
          { name: 'Transportation',                    total:     7_000_000 },
          { name: 'All Other',                         total:   549_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 2_362_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:   699_000_000 },
          { name: 'Higher Education',                  total:   368_000_000 },
          { name: 'Medicaid',                          total:   457_000_000 },
          { name: 'Corrections',                       total:   299_000_000 },
          { name: 'Transportation',                    total:    11_000_000 },
          { name: 'All Other',                         total:   528_000_000 },
        ],
      },
    },
  },

  TN: {
    name: 'Tennessee', abbr: 'TN', population: 6_910_840,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 19_570_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 5_634_000_000 },
          { name: 'Higher Education',                  total: 4_124_000_000 },
          { name: 'Medicaid',                          total: 3_258_000_000 },
          { name: 'Corrections',                       total: 1_110_000_000 },
          { name: 'Transportation',                    total:   836_000_000 },
          { name: 'All Other',                         total: 4_608_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 23_411_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 6_848_000_000 },
          { name: 'Higher Education',                  total: 3_845_000_000 },
          { name: 'Medicaid',                          total: 4_019_000_000 },
          { name: 'Corrections',                       total: 1_303_000_000 },
          { name: 'Transportation',                    total:   273_000_000 },
          { name: 'All Other',                         total: 7_123_000_000 },
        ],
      },
    },
  },

  TX: {
    // FY end: Sep 1 → Aug 31 (verified: 2025 SER p.1). source_date resolves to FY-08-31 via FY_END_MMDD.
    name: 'Texas', abbr: 'TX', population: 29_145_505,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 45_367_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 19_312_000_000 },
          { name: 'Higher Education',                  total:  7_853_000_000 },
          { name: 'Medicaid',                          total: 14_002_000_000 },
          { name: 'Corrections',                       total:  4_139_000_000 },
          { name: 'Transportation',                    total:      9_000_000 },
          { name: 'All Other',                         total:     52_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 50_512_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 27_479_000_000 },
          { name: 'Higher Education',                  total:  8_711_000_000 },
          { name: 'Medicaid',                          total: 12_345_000_000 },
          { name: 'Corrections',                       total:  1_888_000_000 },
          { name: 'Transportation',                    total:     35_000_000 },
          { name: 'All Other',                         total:     54_000_000 },
        ],
      },
    },
  },

  UT: {
    name: 'Utah', abbr: 'UT', population: 3_271_616,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 11_682_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 4_463_000_000 },
          { name: 'Higher Education',                  total: 1_830_000_000 },
          { name: 'Medicaid',                          total:   567_000_000 },
          { name: 'Corrections',                       total:   499_000_000 },
          { name: 'Transportation',                    total: 1_015_000_000 },
          { name: 'All Other',                         total: 3_308_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 13_674_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 5_366_000_000 },
          { name: 'Higher Education',                  total: 2_275_000_000 },
          { name: 'Medicaid',                          total:   531_000_000 },
          { name: 'Corrections',                       total:   530_000_000 },
          { name: 'Transportation',                    total: 1_367_000_000 },
          { name: 'All Other',                         total: 3_605_000_000 },
        ],
      },
    },
  },

  VT: {
    name: 'Vermont', abbr: 'VT', population: 643_077,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 2_055_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:   206_000_000 },
          { name: 'Higher Education',                  total:   135_000_000 },
          { name: 'Medicaid',                          total:   608_000_000 },
          { name: 'Corrections',                       total:   169_000_000 },
          { name: 'Transportation',                    total:    14_000_000 },
          { name: 'All Other',                         total:   923_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 2_510_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:   217_000_000 },
          { name: 'Higher Education',                  total:   151_000_000 },
          { name: 'Medicaid',                          total:   685_000_000 },
          { name: 'Corrections',                       total:   197_000_000 },
          { name: 'Transportation',                    total:    10_000_000 },
          { name: 'All Other',                         total: 1_250_000_000 },
        ],
      },
    },
  },

  WA: {
    name: 'Washington', abbr: 'WA', population: 7_705_281,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 30_861_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 13_297_000_000 },
          { name: 'Higher Education',                  total:  2_014_000_000 },
          { name: 'Medicaid',                          total:  5_463_000_000 },
          { name: 'Corrections',                       total:  1_472_000_000 },
          { name: 'Transportation',                    total:      3_000_000 },
          { name: 'All Other',                         total:  8_612_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 32_397_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 14_720_000_000 },
          { name: 'Higher Education',                  total:  2_310_000_000 },
          { name: 'Medicaid',                          total:  6_333_000_000 },
          { name: 'Corrections',                       total:  1_391_000_000 },
          { name: 'Transportation',                    total:      4_000_000 },
          { name: 'All Other',                         total:  7_639_000_000 },
        ],
      },
    },
  },

  WI: {
    name: 'Wisconsin', abbr: 'WI', population: 5_893_718,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 18_864_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 8_050_000_000 },
          { name: 'Higher Education',                  total: 1_977_000_000 },
          { name: 'Medicaid',                          total: 3_229_000_000 },
          { name: 'Corrections',                       total: 1_298_000_000 },
          { name: 'Transportation',                    total:    89_000_000 },
          { name: 'All Other',                         total: 4_222_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 22_280_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 8_597_000_000 },
          { name: 'Higher Education',                  total: 2_074_000_000 },
          { name: 'Medicaid',                          total: 4_379_000_000 },
          { name: 'Corrections',                       total: 1_525_000_000 },
          { name: 'Transportation',                    total:   204_000_000 },
          { name: 'All Other',                         total: 5_501_000_000 },
        ],
      },
    },
  },

  WV: {
    name: 'West Virginia', abbr: 'WV', population: 1_793_716,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 3_943_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total: 1_939_000_000 },
          { name: 'Higher Education',                  total:   380_000_000 },
          { name: 'Medicaid',                          total:   568_000_000 },
          { name: 'Corrections',                       total:   331_000_000 },
          { name: 'Transportation',                    total:     5_000_000 },
          { name: 'All Other',                         total:   720_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 4_164_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total: 2_107_000_000 },
          { name: 'Higher Education',                  total:   460_000_000 },
          { name: 'Medicaid',                          total:   985_000_000 },
          { name: 'Corrections',                       total:   357_000_000 },
          { name: 'Transportation',                    total:     8_000_000 },
          { name: 'All Other',                         total:   247_000_000 },
        ],
      },
    },
  },

  WY: {
    name: 'Wyoming', abbr: 'WY', population: 576_851,
    operating: {
      2023: {
        confidence: 'actual',
        controlTotalGF: 1_525_000_000,  // Table 1 GF FY2023
        categories: [
          { name: 'Elementary & Secondary Education', total:             0 },
          { name: 'Higher Education',                  total:   324_000_000 },
          { name: 'Medicaid',                          total:   260_000_000 },
          { name: 'Corrections',                       total:     4_000_000 },
          { name: 'Transportation',                    total:     4_000_000 },
          { name: 'All Other',                         total:   933_000_000 },
        ],
      },
      2024: {
        confidence: 'actual',
        controlTotalGF: 1_654_000_000,  // Table 1 GF FY2024
        categories: [
          { name: 'Elementary & Secondary Education', total:             0 },
          { name: 'Higher Education',                  total:   404_000_000 },
          { name: 'Medicaid',                          total:   265_000_000 },
          { name: 'Corrections',                       total:   136_000_000 },
          { name: 'Transportation',                    total:    39_000_000 },
          { name: 'All Other',                         total:   810_000_000 },
        ],
      },
    },
  },
};

// ── Pure helpers (exported for offline unit tests; no DB / no network) ─────────────────

/** P2: icicle areas cannot render a negative magnitude — clamp to 0 for sizing. */
export function clampForRender(amount) { return Math.max(amount, 0); }

/** P2: a negative category keeps its true signed value visible in the label, flagged. */
export function categoryLabel(name, amount) {
  if (amount < 0) {
    const b = (Math.abs(amount) / 1e9).toFixed(2);
    return `${name} (net −$${b}B — shown at 0)`;
  }
  return name;
}

/** Build one depth-1 leaf {n,a,i} applying the negative-category rule (P2). */
export function buildCategoryLeaf(cat) {
  return { n: categoryLabel(cat.name, cat.total), a: clampForRender(cat.total), i: [] };
}

/**
 * Build the operating (spending-by-function) tree for one state-FY.
 * Drops exact-zero categories (P5: nothing to show); RETAINS negatives (shown at 0, P2).
 * Node total = the source's reported control total (P2 #3) — never recomputed from leaves.
 */
export function buildOperatingTree(stateName, entry) {
  const children = entry.categories
    .filter(c => c.total !== 0)
    .map(buildCategoryLeaf)
    .sort((a, b) => b.a - a.a);
  const total = entry.controlTotalGF;
  return { jsonTree: [{ n: `${stateName} General Fund Budget`, a: total, c: children }], total, rowCount: children.length };
}

/** Cross-check: sum of function GF values must tie to the NASBO Table 1 GF control. */
export function validateAgainstControl(entry, toleranceFrac = 0.005) {
  const catSum = entry.categories.reduce((s, c) => s + c.total, 0);
  const diff = Math.abs(catSum - entry.controlTotalGF);
  return { ok: diff <= entry.controlTotalGF * toleranceFrac, catSum, control: entry.controlTotalGF, diff };
}

/** P3: mandatory per-node basis-bearing data_source label. */
export function dataSourceLabel(fy) {
  return `NASBO State Expenditure Report — General Fund (FY${fy} actual, budgetary basis)`;
}

/**
 * NASBORT-01 never-overwrite-ACFR guard (pure, unit-tested; no DB).
 * Decides whether the existing operating node is occupied by a source this
 * FALLBACK-ONLY loader must NOT overwrite. Returns:
 *   - false when `existingDataSource` is null/empty (node absent → NASBO may fill it),
 *   - false when it matches /NASBO/i (node is itself NASBO → allow idempotent refresh),
 *   - true otherwise (a non-NASBO/ACFR source occupies the node → protect it, skip).
 */
export function isAcfrOccupied(existingDataSource) {
  if (!existingDataSource) return false;      // absent node → NASBO fallback may fill
  if (/NASBO/i.test(existingDataSource)) return false; // own fallback → idempotent refresh OK
  return true;                                // ACFR/other source present → protect, never overwrite
}

/** P4: source_date = the state's fiscal-year end the figures represent. */
export function sourceDate(abbr, fy) {
  const mmdd = FY_END_MMDD[abbr] || '06-30';
  return `${fy}-${mmdd}`;
}

// ── Loader (DB) ────────────────────────────────────────────────────────────────────────

async function loadStateFY(supabase, st, fy, dryRun) {
  const entry = st.operating[fy];
  if (!entry) { console.warn(`  No operating data for ${st.abbr} FY${fy}`); return false; }

  const check = validateAgainstControl(entry);
  const { jsonTree, total, rowCount } = buildOperatingTree(st.name, entry);
  console.log(`── ${st.name} (${st.abbr}) FY${fy} operating ─ ${entry.confidence} ─────────`);
  console.log(`${'Function'.padEnd(40)} ${'GF ($)'.padStart(18)}`);
  console.log('─'.repeat(60));
  for (const c of jsonTree[0].c) console.log(`  ${c.n.slice(0,38).padEnd(38)}${Math.round(c.a).toLocaleString().padStart(18)}`);
  console.log('─'.repeat(60));
  console.log(`${'NODE TOTAL (NASBO Table 1 GF)'.padEnd(40)}${Math.round(total).toLocaleString().padStart(18)}`);
  console.log(`Function sum: ${Math.round(check.catSum).toLocaleString()}  | control diff: $${Math.round(check.diff).toLocaleString()} (${(check.diff/check.control*100).toFixed(3)}%)  | tie: ${check.ok ? 'PASS' : 'FAIL'}`);
  console.log(`Per-capita: $${Math.round(total/st.population).toLocaleString()}/person\n`);
  if (!check.ok) { console.error('  Control cross-check FAILED — refusing to load (P-honesty).'); process.exit(2); }
  if (dryRun) { console.log('  (dry-run — no write)\n'); return true; }

  // Resolve the state node.
  const { data: muni, error: mErr } = await supabase.schema('treasury').from('municipalities')
    .select('id,name').eq('name', st.name).eq('state', st.abbr).eq('entity_type', 'state').single();
  if (mErr || !muni) { console.error(`  ${st.name} state node not found`); process.exit(2); }

  // NASBORT-01 never-overwrite-ACFR guard: this loader is FALLBACK-ONLY. Read the existing
  // operating row's data_source BEFORE any write; if a non-NASBO (ACFR/other) source already
  // occupies the node, skip entirely — no data_sources insert, no RPC → 0 residue on skips.
  const { data: existing } = await supabase.schema('treasury').from('budgets')
    .select('data_source').eq('municipality_id', muni.id).eq('fiscal_year', fy)
    .eq('dataset_type', 'operating').maybeSingle();
  if (isAcfrOccupied(existing?.data_source)) {
    console.log(`  SKIP ${st.abbr} FY${fy}: ACFR node present — NASBO retired to fallback-only`);
    return false;
  }

  // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance,
  // so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
  const srcName = `${st.name} General Fund Operating Budget`;
  const srcPayload = {
    name: srcName, api_type: 'nasbo-ser', dataset_type: 'operating',
    dataset_id: `${st.abbr.toLowerCase()}-gf-operating-nasbo`,
    base_url: 'https://www.nasbo.org/reports-data/state-expenditure-report',
    fiscal_years: Object.keys(st.operating).map(Number), municipality_id: muni.id,
  };
  await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
  const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single();
  if (dsErr) { console.error('  data_source insert failed:', dsErr.message); process.exit(2); }

  // Build budget + depth-1 category tree (RPC keys on muni+fy+dataset_type → updates in place).
  const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating',
    p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load',
  });
  if (rpcErr) { console.error(`  RPC error: ${rpcErr.message}`); process.exit(2); }
  if (r?.error)  { console.error(`  RPC error: ${r.error}`); process.exit(2); }
  console.log(`  RPC: ${r?.rows_inserted ?? rowCount} leaf rows for FY${fy}`);

  // P4: targeted post-RPC stamp (RPC does NOT set source_url/date; never a full re-sync).
  const { data: bud } = await supabase.schema('treasury').from('budgets')
    .select('id').eq('municipality_id', muni.id).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
  if (!bud?.id) { console.error(`  Could not find FY${fy} operating row to stamp`); process.exit(2); }
  // Stamp text provenance only (P4). Mirrors the MN template: the budgets.data_source_id
  // FK is left as-is — provenance lives in source_url + source_date + data_source.
  const { error: upErr } = await supabase.schema('treasury').from('budgets').update({
    source_url: NASBO_SER.url, source_date: sourceDate(st.abbr, fy),
    data_source: dataSourceLabel(fy),
  }).eq('id', bud.id);
  if (upErr) { console.error(`  source stamp failed: ${upErr.message}`); process.exit(2); }
  console.log(`  Stamped NASBO source (${NASBO_SER.edition}) on FY${fy} operating row\n`);
  await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  return true;
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, state: { type: 'string' }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run'];
  const stateFilter = opts.state ? opts.state.toUpperCase() : null;
  const fyFilter = opts.fy ? parseInt(opts.fy, 10) : null;
  console.log(`State GF Loader — NASBO (operating) [FALLBACK-ONLY]${dryRun ? ' (dry-run)' : ''}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  const abbrs = stateFilter ? [stateFilter] : Object.keys(STATES);
  let loaded = 0;
  for (const abbr of abbrs) {
    const st = STATES[abbr];
    if (!st) { console.error(`No NASBO data for state "${abbr}"`); process.exit(2); }
    const fys = fyFilter ? [fyFilter] : Object.keys(st.operating).map(Number);
    for (const fy of fys) if (await loadStateFY(supabase, st, fy, dryRun)) loaded++;
  }
  console.log(`Done. ${loaded} state-FY ${dryRun ? 'validated' : 'loaded'}.`);
}

// Run only when executed directly — importing for unit tests must NOT touch the DB.
const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });

// Exported for offline tests.
export const __STATES = STATES;
