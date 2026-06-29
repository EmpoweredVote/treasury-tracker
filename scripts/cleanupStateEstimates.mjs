#!/usr/bin/env node
/**
 * Cleanup: Unsourced Cohort State Estimate Rows
 * ──────────────────────────────────────────────
 * Phase 96 (SGFS-04). Wave 0 cleanup — run BEFORE the NASBO operating load (Plan 07).
 *
 * Purpose: D-96-03 (BLOCKING) — the 46 cohort states have unsourced revenue estimate rows
 *   that ARE displayed in the live app ("Money In" tab), violating the ground rule
 *   "NEVER create or display unsourced data." NASBO loader writes operating-only and does
 *   NOT touch revenue rows. The out-of-window operating estimate rows (FY2022/2025/2026)
 *   are also not overwritten by the NASBO load (which only writes FY2023 + FY2024).
 *
 * What this script deletes (two targeted DELETEs):
 *   (a) municipality_id IN COHORT AND dataset_type = 'revenue'
 *       → removes the unsourced revenue display (D-96-03 resolution)
 *   (b) municipality_id IN COHORT AND dataset_type = 'operating' AND fiscal_year IN (2022, 2025, 2026)
 *       → removes out-of-window operating estimate rows the NASBO load will NOT overwrite
 *          (FY2022 not in 2025 SER scope; FY2025/2026 are estimated years — Pitfall 5)
 *
 * Policy (94-01-POLICY.md):
 *   P4: NEVER treasury_sync_city_budget; NEVER write budgets.data_source_id.
 *   P6: Idempotent — second run finds 0 matching rows, deletes 0.
 *
 * Excluded from COHORT (already on real actuals — DO NOT TOUCH):
 *   MN — ACFR GAAP actuals FY2008–2025 (Phase 95)
 *   OH — ACFR GAAP actuals FY2020–2025 (Phase 95)
 *   VA — ACFR GAAP actuals FY2022–2025 (Phase 95)
 *   GA — NASBO FY2023 actual (Phase 94 pilot); FY2024 extension in Phase 96 Plan 06
 *
 * Safety gates:
 *   --dry-run   : print per-state summary of rows that WOULD be deleted; EXIT without writing
 *   --confirm   : required for any live delete; bare run (no flag) refuses to delete
 *   bare run    : prints the same dry-run summary, then exits with an error message
 *   exit 2      : on any DB error
 *
 * Usage:
 *   node scripts/cleanupStateEstimates.mjs --dry-run      # audit what would be deleted
 *   node scripts/cleanupStateEstimates.mjs --confirm      # live delete (Plan 07)
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
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── The 46-State Cohort ────────────────────────────────────────────────────────────────
// These are the ONLY municipality_id values this script may touch.
// MN / OH / VA / GA are EXCLUDED (they carry real sourced actuals).
// Source: 96-RESEARCH.md §"The 46-State Cohort" (verified live API query 2026-06-28).
const COHORT = [
  'b268c415-0058-4fea-8ba1-24f49fb434b4', // AK — Alaska
  'bc953061-98de-43ad-878a-c6564bf75dbc', // AL — Alabama
  '5efd2f95-6deb-4118-a07a-9f48cdca681c', // AR — Arkansas
  '866036ee-20b2-4e3c-a4f3-5100659edf31', // AZ — Arizona
  'e1007bf5-bac9-4b1c-878e-f6834885f850', // CA — California
  '89d2aff1-6980-4c20-80fe-513618bce8ac', // CO — Colorado
  'd01de53e-d687-4825-bfe2-09f7694c28d6', // CT — Connecticut
  'a7854fa3-8e68-4a0e-b92a-415bad6bccd2', // DE — Delaware
  'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a', // FL — Florida
  'bf5b7221-9c8e-4df7-961d-e9c020ca733e', // HI — Hawaii
  '6e71a93f-a43d-4972-a239-85ddbebe2545', // IA — Iowa
  '247ca2d0-44bc-4ef0-bc0d-4875758bae5e', // ID — Idaho
  'ac8b3dee-b431-48d0-9f59-deea46c85948', // IL — Illinois
  '7eb77ada-b504-4531-98cc-8262cfb22ff5', // IN — Indiana
  'bb3dcf05-586c-4e68-85d3-26a6199cc4ab', // KS — Kansas
  '6d9dfe88-f908-466c-95d5-66dce0777ee0', // KY — Kentucky
  'b7e9e7cd-8b7e-4272-8e42-ef41b293120b', // LA — Louisiana
  'fd6b008f-4d35-4665-8c6a-0429de5a4e1f', // MA — Massachusetts
  '8e597f8f-c696-47c0-9001-ed78a54f2228', // MD — Maryland
  '53f26018-1d20-4f6a-9c0e-400bfb91199a', // ME — Maine
  '38c9f1ff-130e-423d-955a-6f0aa5aecae2', // MI — Michigan
  '21892bb7-1a1d-4038-8665-51c256ab5875', // MO — Missouri
  'ebec9e07-a79e-44b0-b5d5-2551625d4b8e', // MS — Mississippi
  '6e085a8b-97e3-479d-8879-9bb7ff4f9fb1', // MT — Montana
  'dd5281e8-6988-4f42-b83c-4fed43c7ada4', // NC — North Carolina
  'e84aafe0-eeaa-470a-8fd3-708c88af2a80', // ND — North Dakota
  'ccfb8751-ae32-4974-96a9-d8c8ea85a898', // NE — Nebraska
  'c54f6dbd-3f2a-453e-b0b9-259e377aef67', // NH — New Hampshire
  '91f310a1-bec9-404a-9825-82b1106c911f', // NJ — New Jersey
  '1e60ff76-c9fa-48d0-9442-042f61cd40ea', // NM — New Mexico
  'd0879e45-0b72-41ee-bdbd-a214a4f2a1d5', // NV — Nevada
  '1a7f871c-7f2e-4786-9c55-5ab3409716f4', // NY — New York
  '54233a91-919d-4a5f-9f24-2f9325250e64', // OK — Oklahoma
  '7686da27-5d64-44c2-bae2-f8c85c073e37', // OR — Oregon
  'd4a4aadc-f91e-45e4-852f-2cf21e177de5', // PA — Pennsylvania
  '483f02b4-2167-4e3d-9f5c-0f3ed83be2e6', // RI — Rhode Island
  'f0024b19-1b89-4bdf-af47-d2e28c21278f', // SC — South Carolina
  'e7273079-b392-449d-af38-d2e4d0df73e0', // SD — South Dakota
  'f96037ba-af9e-406d-a98f-8c5e2fd299d6', // TN — Tennessee
  'dc93d846-ef3e-4a41-b58f-06be2d1ab40a', // TX — Texas
  '740cffee-3111-44c0-9473-a77acb6c42f8', // UT — Utah
  '563d6f1c-ce2b-4071-938f-01725d283504', // VT — Vermont
  'd8257751-45c4-4853-9621-e1841e7d4998', // WA — Washington
  '15fe5240-19d9-4fef-b785-d624b0a39a2a', // WI — Wisconsin
  'e21923d7-ad99-4711-b765-255b9807c059', // WV — West Virginia
  '4009951b-8a23-457e-9591-1597356dfe34', // WY — Wyoming
];

// Abbr map for readable output (keyed by municipality_id)
const COHORT_ABBR = {
  'b268c415-0058-4fea-8ba1-24f49fb434b4': 'AK',
  'bc953061-98de-43ad-878a-c6564bf75dbc': 'AL',
  '5efd2f95-6deb-4118-a07a-9f48cdca681c': 'AR',
  '866036ee-20b2-4e3c-a4f3-5100659edf31': 'AZ',
  'e1007bf5-bac9-4b1c-878e-f6834885f850': 'CA',
  '89d2aff1-6980-4c20-80fe-513618bce8ac': 'CO',
  'd01de53e-d687-4825-bfe2-09f7694c28d6': 'CT',
  'a7854fa3-8e68-4a0e-b92a-415bad6bccd2': 'DE',
  'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a': 'FL',
  'bf5b7221-9c8e-4df7-961d-e9c020ca733e': 'HI',
  '6e71a93f-a43d-4972-a239-85ddbebe2545': 'IA',
  '247ca2d0-44bc-4ef0-bc0d-4875758bae5e': 'ID',
  'ac8b3dee-b431-48d0-9f59-deea46c85948': 'IL',
  '7eb77ada-b504-4531-98cc-8262cfb22ff5': 'IN',
  'bb3dcf05-586c-4e68-85d3-26a6199cc4ab': 'KS',
  '6d9dfe88-f908-466c-95d5-66dce0777ee0': 'KY',
  'b7e9e7cd-8b7e-4272-8e42-ef41b293120b': 'LA',
  'fd6b008f-4d35-4665-8c6a-0429de5a4e1f': 'MA',
  '8e597f8f-c696-47c0-9001-ed78a54f2228': 'MD',
  '53f26018-1d20-4f6a-9c0e-400bfb91199a': 'ME',
  '38c9f1ff-130e-423d-955a-6f0aa5aecae2': 'MI',
  '21892bb7-1a1d-4038-8665-51c256ab5875': 'MO',
  'ebec9e07-a79e-44b0-b5d5-2551625d4b8e': 'MS',
  '6e085a8b-97e3-479d-8879-9bb7ff4f9fb1': 'MT',
  'dd5281e8-6988-4f42-b83c-4fed43c7ada4': 'NC',
  'e84aafe0-eeaa-470a-8fd3-708c88af2a80': 'ND',
  'ccfb8751-ae32-4974-96a9-d8c8ea85a898': 'NE',
  'c54f6dbd-3f2a-453e-b0b9-259e377aef67': 'NH',
  '91f310a1-bec9-404a-9825-82b1106c911f': 'NJ',
  '1e60ff76-c9fa-48d0-9442-042f61cd40ea': 'NM',
  'd0879e45-0b72-41ee-bdbd-a214a4f2a1d5': 'NV',
  '1a7f871c-7f2e-4786-9c55-5ab3409716f4': 'NY',
  '54233a91-919d-4a5f-9f24-2f9325250e64': 'OK',
  '7686da27-5d64-44c2-bae2-f8c85c073e37': 'OR',
  'd4a4aadc-f91e-45e4-852f-2cf21e177de5': 'PA',
  '483f02b4-2167-4e3d-9f5c-0f3ed83be2e6': 'RI',
  'f0024b19-1b89-4bdf-af47-d2e28c21278f': 'SC',
  'e7273079-b392-449d-af38-d2e4d0df73e0': 'SD',
  'f96037ba-af9e-406d-a98f-8c5e2fd299d6': 'TN',
  'dc93d846-ef3e-4a41-b58f-06be2d1ab40a': 'TX',
  '740cffee-3111-44c0-9473-a77acb6c42f8': 'UT',
  '563d6f1c-ce2b-4071-938f-01725d283504': 'VT',
  'd8257751-45c4-4853-9621-e1841e7d4998': 'WA',
  '15fe5240-19d9-4fef-b785-d624b0a39a2a': 'WI',
  'e21923d7-ad99-4711-b765-255b9807c059': 'WV',
  '4009951b-8a23-457e-9591-1597356dfe34': 'WY',
};

// Out-of-window operating FY years to delete (not written by NASBO FY2023+FY2024 load)
// FY2022: actual in 2024 SER but NOT in scope for Phase 96 (D-96-02: current 2025 SER only)
// FY2025: estimated year in 2025 SER — must NOT be loaded (P1)
// FY2026: future estimate row from original all-50-states seed
const OOW_OPERATING_FYS = [2022, 2025, 2026];

// ── Audit: SELECT rows that match the delete predicates ───────────────────────────────

async function fetchPreview(supabase) {
  // (a) Revenue estimate rows for the cohort
  const { data: revRows, error: revErr } = await supabase
    .schema('treasury')
    .from('budgets')
    .select('municipality_id, fiscal_year, dataset_type, total_budget, source_url')
    .in('municipality_id', COHORT)
    .eq('dataset_type', 'revenue');
  if (revErr) {
    console.error('DB error fetching revenue rows:', revErr.message);
    process.exit(2);
  }

  // (b) Out-of-window operating estimate rows for the cohort
  const { data: oowRows, error: oowErr } = await supabase
    .schema('treasury')
    .from('budgets')
    .select('municipality_id, fiscal_year, dataset_type, total_budget, source_url')
    .in('municipality_id', COHORT)
    .eq('dataset_type', 'operating')
    .in('fiscal_year', OOW_OPERATING_FYS);
  if (oowErr) {
    console.error('DB error fetching out-of-window operating rows:', oowErr.message);
    process.exit(2);
  }

  return { revRows: revRows || [], oowRows: oowRows || [] };
}

function printSummary(revRows, oowRows) {
  // Group revenue rows by state (abbr)
  const revByState = {};
  for (const row of revRows) {
    const abbr = COHORT_ABBR[row.municipality_id] || row.municipality_id;
    if (!revByState[abbr]) revByState[abbr] = [];
    revByState[abbr].push(row);
  }

  // Group OOW operating rows by state + FY
  const oowByState = {};
  for (const row of oowRows) {
    const abbr = COHORT_ABBR[row.municipality_id] || row.municipality_id;
    if (!oowByState[abbr]) oowByState[abbr] = [];
    oowByState[abbr].push(row);
  }

  const allAbbrs = [...new Set([...Object.keys(revByState), ...Object.keys(oowByState)])].sort();

  console.log('');
  console.log('┌─ PER-STATE ROW AUDIT ───────────────────────────────────────────────────────────┐');
  console.log('│ Abbr  dataset_type  fiscal_year  count  source_url                              │');
  console.log('├─────────────────────────────────────────────────────────────────────────────────┤');

  let totalRevRows = 0;
  let totalOowRows = 0;
  let statesWithRevenue = 0;
  let statesWithOow = 0;

  for (const abbr of allAbbrs) {
    const revList = revByState[abbr] || [];
    const oowList = oowByState[abbr] || [];

    if (revList.length > 0) {
      // Group revenue by FY
      const fyMap = {};
      for (const r of revList) {
        if (!fyMap[r.fiscal_year]) fyMap[r.fiscal_year] = 0;
        fyMap[r.fiscal_year]++;
      }
      for (const [fy, cnt] of Object.entries(fyMap).sort()) {
        const srcSample = revList.find(r => r.fiscal_year === Number(fy));
        const srcLabel = srcSample?.source_url ? srcSample.source_url.slice(0, 36) + '…' : 'NULL (unsourced)';
        console.log(`│ ${abbr.padEnd(4)}   revenue       ${String(fy).padEnd(12)} ${String(cnt).padEnd(6)} ${srcLabel.padEnd(40)} │`);
        totalRevRows += cnt;
      }
      statesWithRevenue++;
    }

    if (oowList.length > 0) {
      const fyMap = {};
      for (const r of oowList) {
        if (!fyMap[r.fiscal_year]) fyMap[r.fiscal_year] = 0;
        fyMap[r.fiscal_year]++;
      }
      for (const [fy, cnt] of Object.entries(fyMap).sort()) {
        const srcSample = oowList.find(r => r.fiscal_year === Number(fy));
        const srcLabel = srcSample?.source_url ? srcSample.source_url.slice(0, 36) + '…' : 'NULL (unsourced)';
        console.log(`│ ${abbr.padEnd(4)}   operating      ${String(fy).padEnd(11)} ${String(cnt).padEnd(6)} ${srcLabel.padEnd(40)} │`);
        totalOowRows += cnt;
      }
      statesWithOow++;
    }
  }

  if (allAbbrs.length === 0) {
    console.log('│  (no matching rows found — already clean or COHORT IDs not in DB)             │');
  }

  console.log('└─────────────────────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`SUMMARY:`);
  console.log(`  Revenue rows to delete:            ${totalRevRows}  (across ${statesWithRevenue} states)`);
  console.log(`  Out-of-window operating rows:      ${totalOowRows}  (FY${OOW_OPERATING_FYS.join('/')} across ${statesWithOow} states)`);
  console.log(`  Total rows that would be deleted:  ${totalRevRows + totalOowRows}`);
  console.log('');
  return { totalRevRows, totalOowRows };
}

// ── Live DELETE (requires --confirm) ─────────────────────────────────────────────────

async function performDeletes(supabase) {
  // (a) Delete unsourced revenue rows for all 46 cohort states
  const { error: revDelErr, count: revDelCount } = await supabase
    .schema('treasury')
    .from('budgets')
    .delete({ count: 'exact' })
    .in('municipality_id', COHORT)
    .eq('dataset_type', 'revenue');
  if (revDelErr) {
    console.error('DB error deleting revenue rows:', revDelErr.message);
    process.exit(2);
  }
  console.log(`  Deleted ${revDelCount ?? '?'} revenue row(s) for 46 cohort states.`);

  // (b) Delete out-of-window operating estimate rows
  const { error: oowDelErr, count: oowDelCount } = await supabase
    .schema('treasury')
    .from('budgets')
    .delete({ count: 'exact' })
    .in('municipality_id', COHORT)
    .eq('dataset_type', 'operating')
    .in('fiscal_year', OOW_OPERATING_FYS);
  if (oowDelErr) {
    console.error('DB error deleting out-of-window operating rows:', oowDelErr.message);
    process.exit(2);
  }
  console.log(`  Deleted ${oowDelCount ?? '?'} operating row(s) for FY${OOW_OPERATING_FYS.join('/')}.`);

  return { revDelCount: revDelCount ?? 0, oowDelCount: oowDelCount ?? 0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'confirm': { type: 'boolean', default: false },
    },
    strict: false,
  });
  const dryRun  = opts['dry-run'];
  const confirm = opts['confirm'];

  console.log(`Cleanup: Unsourced Cohort State Estimate Rows`);
  console.log(`Cohort: ${COHORT.length} states (MN/OH/VA/GA excluded)`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : confirm ? 'LIVE DELETE (--confirm)' : 'BARE RUN (no --confirm — will refuse to delete)'}`);
  console.log('');

  if (!SUPABASE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_KEY not found in environment.');
    console.error('       Check that .env.local or .env is present and has SUPABASE_SERVICE_KEY.');
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Always fetch and display the audit summary first
  console.log('Fetching rows that match the delete predicates...');
  const { revRows, oowRows } = await fetchPreview(supabase);
  const { totalRevRows, totalOowRows } = printSummary(revRows, oowRows);

  if (dryRun) {
    console.log('DRY-RUN complete. No rows were deleted.');
    console.log('Re-run with --confirm to execute the live delete (Plan 07).');
    process.exit(0);
  }

  if (!confirm) {
    console.log('REFUSED: No --confirm flag provided.');
    console.log('This is the safety gate — a bare run will never delete rows.');
    console.log('');
    console.log('To execute the live delete, run:');
    console.log('  node scripts/cleanupStateEstimates.mjs --confirm');
    console.log('');
    console.log('To audit only (no writes), run:');
    console.log('  node scripts/cleanupStateEstimates.mjs --dry-run');
    process.exit(1);
  }

  // Live delete path — only reached with --confirm
  if (totalRevRows + totalOowRows === 0) {
    console.log('Nothing to delete — all cohort rows are already clean. (Idempotent: 0 deletes)');
    process.exit(0);
  }

  console.log('Executing live deletes...');
  const { revDelCount, oowDelCount } = await performDeletes(supabase);
  console.log('');
  console.log(`DONE. Deleted ${revDelCount + oowDelCount} row(s) total.`);
  console.log('  Revenue rows deleted:            ' + revDelCount);
  console.log('  Out-of-window operating deleted: ' + oowDelCount);
  console.log('');
  console.log('Re-running this script is safe (idempotent — a second run finds 0 matching rows).');
}

// Run only when executed directly — not when imported.
const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
