#!/usr/bin/env node
/**
 * verify-ca-depth.mjs
 *
 * Persistent verification script for Phase 35 gaps 35-02-02 and 35-03-01.
 *
 * Asserts that treasury.budget_categories has rows at depth 0, 1, AND 2
 * for California operating budgets for each of FY2022-FY2026, and that
 * the depth-2 row counts match the expected values from 35-VERIFICATION.md.
 *
 * Exit 0 = all assertions pass (PASS)
 * Exit 1 = one or more assertions fail (FAIL)
 *
 * Usage: node scripts/verify-ca-depth.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading (same idiom as processCA.js) ──────────────────────────────────
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

// ── Supabase connection ───────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('FAIL: Missing SUPABASE_URL'); process.exit(1); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('FAIL: Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Expected depth-2 counts from 35-VERIFICATION.md ICICLE-01 section ────────
const EXPECTED_DEPTH2 = {
  2022: 252,
  2023: 256,
  2024: 253,
  2025: 253,
  2026: 219,
};

const FISCAL_YEARS = [2022, 2023, 2024, 2025, 2026];

// ── Depth distribution query ──────────────────────────────────────────────────
async function getDepthDistribution(fiscalYear) {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT bc.depth, count(*)::int AS cnt
      FROM treasury.budget_categories bc
      JOIN treasury.budgets b ON b.id = bc.budget_id
      JOIN treasury.municipalities m ON m.id = b.municipality_id
      WHERE m.name = 'California'
        AND b.fiscal_year = ${fiscalYear}
        AND b.dataset_type = 'operating'
      GROUP BY bc.depth
      ORDER BY bc.depth
    `
  });

  if (error) return { error };
  return { data };
}

// Fallback: use direct table query via Supabase JS client if RPC is not available
async function getDepthDistributionDirect(fiscalYear) {
  // Query budget_categories joined through budgets and municipalities
  // We need raw SQL — use the postgres extension if available
  const { data, error } = await supabase
    .from('budget_categories')
    .select(`
      depth,
      budgets!inner(
        fiscal_year,
        dataset_type,
        municipalities!inner(name)
      )
    `)
    .eq('budgets.fiscal_year', fiscalYear)
    .eq('budgets.dataset_type', 'operating')
    .eq('budgets.municipalities.name', 'California');

  if (error) return { error };

  // Aggregate depth counts
  const counts = {};
  for (const row of data || []) {
    const d = row.depth;
    counts[d] = (counts[d] || 0) + 1;
  }
  return { data: Object.entries(counts).map(([depth, cnt]) => ({ depth: parseInt(depth), cnt })) };
}

// ── Main assertion loop ───────────────────────────────────────────────────────
async function main() {
  console.log('Phase 35 — CA depth distribution verification');
  console.log('Gaps: 35-02-02 (FY2026 depth-2 rows) + 35-03-01 (all 5 FYs depth-2 count > 0)');
  console.log('');

  let allPass = true;
  const results = [];

  for (const fy of FISCAL_YEARS) {
    // Try direct PostgREST query first (no custom RPC needed)
    let depthCounts = {};
    let queryError = null;

    // Use the Supabase JS client with nested select + filter (schema must be first)
    const { data: rawData, error: rawError } = await supabase
      .schema('treasury')
      .from('budget_categories')
      .select(`
        depth,
        budget_id,
        budgets!inner(
          fiscal_year,
          dataset_type,
          municipalities!inner(name)
        )
      `)
      .eq('budgets.fiscal_year', fy)
      .eq('budgets.dataset_type', 'operating')
      .eq('budgets.municipalities.name', 'California');

    if (rawError) {
      queryError = rawError;
    } else {
      for (const row of rawData || []) {
        const d = row.depth;
        depthCounts[d] = (depthCounts[d] || 0) + 1;
      }
    }

    const expectedDepth2 = EXPECTED_DEPTH2[fy];

    if (queryError) {
      console.error(`  FY${fy}: QUERY ERROR — ${queryError.message || JSON.stringify(queryError)}`);
      allPass = false;
      results.push({ fy, status: 'ERROR', error: queryError.message });
      continue;
    }

    const depth0Count = depthCounts[0] || 0;
    const depth1Count = depthCounts[1] || 0;
    const depth2Count = depthCounts[2] || 0;

    // Assertions per gap requirements:
    // 35-02-02: depth-2 count > 0 for FY2026
    // 35-03-01: depth-2 count > 0 for ALL 5 FYs, and matches exact expected values
    const hasDepth0 = depth0Count > 0;
    const hasDepth1 = depth1Count > 0;
    const hasDepth2 = depth2Count > 0;
    const depth2Matches = depth2Count === expectedDepth2;

    const pass = hasDepth0 && hasDepth1 && hasDepth2 && depth2Matches;
    const status = pass ? 'PASS' : 'FAIL';
    if (!pass) allPass = false;

    const issues = [];
    if (!hasDepth0) issues.push(`depth-0 count is 0 (expected > 0)`);
    if (!hasDepth1) issues.push(`depth-1 count is 0 (expected > 0)`);
    if (!hasDepth2) issues.push(`depth-2 count is 0 (expected > 0) — ICICLE-01 UNMET`);
    if (hasDepth2 && !depth2Matches) {
      issues.push(`depth-2 count is ${depth2Count} but expected ${expectedDepth2}`);
    }

    console.log(
      `  FY${fy}: [${status}]  depth-0=${depth0Count}  depth-1=${depth1Count}  depth-2=${depth2Count}` +
      (hasDepth2 && depth2Matches ? `  (expected depth-2=${expectedDepth2} ✓)` : `  (expected depth-2=${expectedDepth2})`) +
      (issues.length ? `\n         Issues: ${issues.join('; ')}` : '')
    );

    results.push({ fy, status, depth0Count, depth1Count, depth2Count, expectedDepth2 });
  }

  console.log('');
  console.log('── Summary ─────────────────────────────────────────────────────────────────');
  console.log(`  35-02-02 (FY2026 depth-2 rows > 0):     ${results.find(r => r.fy === 2026)?.depth2Count > 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  35-03-01 (all 5 FYs depth-2 count > 0): ${results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL'}`);
  console.log('');

  if (allPass) {
    console.log('PASS — All depth-2 assertions satisfied for CA FY2022-FY2026');
    process.exit(0);
  } else {
    console.log('FAIL — One or more depth-2 assertions failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('FAIL — Unexpected error:', err.message || err);
  process.exit(1);
});
