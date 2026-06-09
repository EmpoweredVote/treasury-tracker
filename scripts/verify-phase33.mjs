#!/usr/bin/env node
/**
 * verify-phase33.mjs
 *
 * Behavioral verification script for Phase 33 — CA State Budget Data.
 * Covers 10 automatable gaps across requirements DATA-01, DATA-02, DATA-03.
 *
 * Gap coverage:
 *   33-01-01  DATA-01  CA municipality: entity_type='state', population=39500000, state='CA'
 *   33-01-02  DATA-01  data_source 'California General Fund Operating Budget': api_type='xlsx_download', dataset_id='ca-lao-gf-operating'
 *   33-02-01  DATA-02  5 budget rows in treasury.budgets for CA (FY2022-2026)
 *   33-02-02  DATA-02  FY2026 total in [$225B, $232B]
 *   33-02-03  DATA-02  All 5 FY totals within sanity band [$150B, $300B]
 *   33-02-04  DATA-02  budget_categories count > 0 for CA operating budgets
 *   33-03-01  DATA-03  enrichCategories.js contains case 'state':
 *   33-03-02  DATA-03  enrichCategories.js 'state' case references 'General Fund' + 'Medi-Cal'
 *   33-03-03  DATA-03  category_enrichment rows exist for California (count > 0)
 *   33-03-04  DATA-03  No CA category_enrichment row contains "city council" or "mayor"
 *
 * Exit 0 = all assertions pass
 * Exit 1 = one or more assertions fail
 *
 * Usage: node scripts/verify-phase33.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    } catch {}
  }
}
loadEnv();

// ── Result tracking ───────────────────────────────────────────────────────────
const results = [];

function pass(gapId, description) {
  console.log(`  [PASS] ${gapId}: ${description}`);
  results.push({ gapId, status: 'PASS', description });
}

function fail(gapId, description, detail) {
  console.log(`  [FAIL] ${gapId}: ${description}`);
  if (detail) console.log(`         Detail: ${detail}`);
  results.push({ gapId, status: 'FAIL', description, detail });
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SANITY_MIN   = 150_000_000_000;
const SANITY_MAX   = 300_000_000_000;
const FY2026_MIN   = 225_000_000_000;
const FY2026_MAX   = 232_000_000_000;
const FISCAL_YEARS = [2022, 2023, 2024, 2025, 2026];

// ── Static file checks (no network needed) ────────────────────────────────────

console.log('Phase 33 — CA State Budget Data verification');
console.log('Gaps: 33-01-01 through 33-03-04');
console.log('');
console.log('── Static file checks ──────────────────────────────────────────────────────');

// 33-03-01: enrichCategories.js contains case 'state':
// 33-03-02: 'state' case references 'General Fund' and 'Medi-Cal'
try {
  const enrichJs = readFileSync(resolve(__dirname, '../scripts/enrichCategories.js'), 'utf8');

  if (!enrichJs.includes("case 'state':")) {
    fail('33-03-01', "enrichCategories.js missing `case 'state':` in buildEntityContext()");
  } else {
    pass('33-03-01', "enrichCategories.js contains `case 'state':` in buildEntityContext()");
  }

  const stateMatch = enrichJs.match(/case 'state':[\s\S]*?return `[\s\S]*?`;/);
  if (!stateMatch) {
    fail('33-03-02', "enrichCategories.js 'state' case return body not found");
  } else {
    const caseBody = stateMatch[0];
    const hasGeneralFund = caseBody.includes('General Fund');
    const hasMediCal     = caseBody.includes('Medi-Cal');
    if (hasGeneralFund && hasMediCal) {
      pass('33-03-02', "enrichCategories.js 'state' case references 'General Fund' and 'Medi-Cal'");
    } else {
      const missing = [!hasGeneralFund && 'General Fund', !hasMediCal && 'Medi-Cal'].filter(Boolean).join(', ');
      fail('33-03-02', `enrichCategories.js 'state' case missing state-level language: ${missing}`);
    }
  }
} catch (e) {
  fail('33-03-01', "Could not read scripts/enrichCategories.js", e.message);
  fail('33-03-02', "Could not read scripts/enrichCategories.js", e.message);
}

// ── DB checks ─────────────────────────────────────────────────────────────────
console.log('');
console.log('── DB checks ───────────────────────────────────────────────────────────────');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [!SUPABASE_URL && 'SUPABASE_URL', !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY'].filter(Boolean).join(', ');
  for (const gapId of ['33-01-01', '33-01-02', '33-02-01', '33-02-02', '33-02-03', '33-02-04', '33-03-03', '33-03-04']) {
    fail(gapId, `DB check skipped — missing env: ${missing}`);
  }
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 33-01-01: California municipality row
  let caId = null;
  try {
    const { data: muni, error } = await supabase.schema('treasury')
      .from('municipalities')
      .select('id, name, entity_type, population, state')
      .eq('name', 'California')
      .eq('state', 'CA')
      .maybeSingle();

    if (error) {
      fail('33-01-01', "DB query failed for California municipality", error.message);
    } else if (!muni) {
      fail('33-01-01', "No row found for California in treasury.municipalities");
    } else if (muni.entity_type !== 'state') {
      fail('33-01-01', `California exists but entity_type='${muni.entity_type}' — expected 'state'`);
    } else if (muni.population !== 39500000) {
      fail('33-01-01', `entity_type='state' ✓ but population=${muni.population} — expected 39500000`);
    } else {
      pass('33-01-01', `California municipality: entity_type='state', population=39500000, state='CA' (id: ${muni.id.slice(0, 8)}...)`);
      caId = muni.id;
    }
  } catch (e) {
    fail('33-01-01', "Unexpected error checking California municipality", e.message);
  }

  // 33-01-02: data_source row — query data_sources directly (treasury_list_source_ids RPC
  // does not expose dataset_id; direct table query does)
  try {
    const { data: dsRows, error } = await supabase.schema('treasury')
      .from('data_sources')
      .select('id, name, api_type, dataset_id')
      .eq('name', 'California General Fund Operating Budget')
      .maybeSingle();

    if (error) {
      fail('33-01-02', "DB query failed for CA data_source", error.message);
    } else if (!dsRows) {
      fail('33-01-02', "No data_source named 'California General Fund Operating Budget' found");
    } else if (dsRows.api_type !== 'xlsx_download') {
      fail('33-01-02', `data_source found but api_type='${dsRows.api_type}' — expected 'xlsx_download'`);
    } else if (dsRows.dataset_id !== 'ca-lao-gf-operating') {
      fail('33-01-02', `data_source found but dataset_id='${dsRows.dataset_id}' — expected 'ca-lao-gf-operating'`);
    } else {
      pass('33-01-02', "data_source 'California General Fund Operating Budget': api_type='xlsx_download', dataset_id='ca-lao-gf-operating'");
    }
  } catch (e) {
    fail('33-01-02', "Unexpected error checking data_source row", e.message);
  }

  // Budget and enrichment checks require caId
  if (!caId) {
    for (const gapId of ['33-02-01', '33-02-02', '33-02-03', '33-02-04', '33-03-03', '33-03-04']) {
      fail(gapId, "Skipped — California municipality id unavailable (33-01-01 failed)");
    }
  } else {
    // 33-02-01, 33-02-02, 33-02-03, 33-02-04: budget rows
    try {
      const { data: budgets, error } = await supabase.schema('treasury')
        .from('budgets')
        .select('id, fiscal_year, total_budget')
        .eq('municipality_id', caId)
        .eq('dataset_type', 'operating')
        .order('fiscal_year');

      if (error) {
        for (const gapId of ['33-02-01', '33-02-02', '33-02-03', '33-02-04']) {
          fail(gapId, "DB query failed for CA budgets", error.message);
        }
      } else {
        const fyFound = (budgets || []).map(b => b.fiscal_year);

        // 33-02-01: all 5 FYs present
        const missingFYs = FISCAL_YEARS.filter(fy => !fyFound.includes(fy));
        if (missingFYs.length > 0) {
          fail('33-02-01', `Missing budget rows for FY${missingFYs.join(', FY')} (found ${fyFound.length} of 5)`);
        } else {
          pass('33-02-01', `5 budget rows in treasury.budgets for California: FY${FISCAL_YEARS.join(', FY')}`);
        }

        // 33-02-02: FY2026 total in range
        const fy2026 = (budgets || []).find(b => b.fiscal_year === 2026);
        if (!fy2026) {
          fail('33-02-02', "FY2026 budget row not found for California");
        } else {
          const total = Number(fy2026.total_budget);
          if (total < FY2026_MIN || total > FY2026_MAX) {
            fail('33-02-02', `FY2026 total=${(total/1e9).toFixed(1)}B — outside [$225B, $232B] range (expected ~$228.4B)`);
          } else {
            pass('33-02-02', `FY2026 total=${(total/1e9).toFixed(1)}B — within [$225B, $232B] (General Fund enacted budget)`);
          }
        }

        // 33-02-03: all 5 FYs in sanity band
        const outOfBand = (budgets || []).filter(b => {
          const t = Number(b.total_budget);
          return t < SANITY_MIN || t > SANITY_MAX;
        });
        if (outOfBand.length > 0) {
          const detail = outOfBand.map(b => `FY${b.fiscal_year}=${(Number(b.total_budget)/1e9).toFixed(1)}B`).join(', ');
          fail('33-02-03', `${outOfBand.length} FY total(s) outside sanity band [$150B, $300B]: ${detail}`);
        } else if (!budgets || budgets.length < 5) {
          fail('33-02-03', `Only ${budgets?.length || 0} FY rows — cannot verify all 5 in band`);
        } else {
          const bandSummary = budgets.map(b => `FY${b.fiscal_year}:$${(Number(b.total_budget)/1e9).toFixed(0)}B`).join(' ');
          pass('33-02-03', `All 5 FY totals within [$150B, $300B]: ${bandSummary}`);
        }

        // 33-02-04: budget_categories count > 0
        const budgetIds = (budgets || []).map(b => b.id);
        if (budgetIds.length === 0) {
          fail('33-02-04', "No CA budget IDs found — cannot check budget_categories");
        } else {
          try {
            const { count, error: catErr } = await supabase.schema('treasury')
              .from('budget_categories')
              .select('id', { count: 'exact', head: true })
              .in('budget_id', budgetIds);

            if (catErr) {
              fail('33-02-04', "DB query failed for CA budget_categories count", catErr.message);
            } else if (!count || count === 0) {
              fail('33-02-04', "budget_categories count is 0 for CA operating budgets — tree not loaded");
            } else {
              pass('33-02-04', `budget_categories count=${count} for CA FY2022-2026 operating budgets`);
            }
          } catch (e) {
            fail('33-02-04', "Unexpected error checking budget_categories", e.message);
          }
        }
      }
    } catch (e) {
      fail('33-02-01', "Unexpected error checking CA budget rows", e.message);
    }

    // 33-03-03, 33-03-04: category_enrichment
    try {
      const { data: enrichRows, error: enrichErr } = await supabase.schema('treasury')
        .from('category_enrichment')
        .select('description')
        .eq('municipality_id', caId);

      if (enrichErr) {
        fail('33-03-03', "DB query failed for CA category_enrichment", enrichErr.message);
        fail('33-03-04', "Skipped — category_enrichment query failed");
      } else if (!enrichRows || enrichRows.length === 0) {
        fail('33-03-03', "No category_enrichment rows found for California");
        fail('33-03-04', "Skipped — no enrichment rows found");
      } else {
        pass('33-03-03', `category_enrichment count=${enrichRows.length} for California`);

        const badRows = enrichRows.filter(r =>
          r.description &&
          (r.description.toLowerCase().includes('city council') ||
           r.description.toLowerCase().includes('mayor'))
        );
        if (badRows.length > 0) {
          fail('33-03-04', `${badRows.length} CA enrichment row(s) contain city-government language ("city council" or "mayor")`);
        } else {
          pass('33-03-04', `All ${enrichRows.length} CA enrichment rows free of city-government language ("city council", "mayor")`);
        }
      }
    } catch (e) {
      fail('33-03-03', "Unexpected error checking category_enrichment", e.message);
      fail('33-03-04', "Unexpected error checking category_enrichment", e.message);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log('── Summary ─────────────────────────────────────────────────────────────────');

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;

for (const r of results) {
  console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.gapId}`);
}
console.log('');
console.log(`  ${passCount} passed, ${failCount} failed (of ${results.length} gap checks)`);
console.log('');

if (failCount === 0) {
  console.log('PASS — All Phase 33 gap checks satisfied');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 33 gap checks failed');
  process.exit(1);
}
