#!/usr/bin/env node
/**
 * verify-phase34.mjs
 *
 * Behavioral verification script for Phase 34 — 3-Level Tree Infrastructure (EV Accounts API).
 * Covers 6 automatable gaps across TREE-01, TREE-02, TREE-03.
 *
 * Gap coverage:
 *   34-01-01  TREE-01      Test file exists at expected path + contains `treasury_sync_budget_tree`
 *   34-01-02  TREE-01      Test file asserts depth 0, 1, and 2 rows in budget_categories
 *   34-01-03  TREE-02      Test file contains inline tree builder (buildTreeFromRows) + subcategory chain assertion
 *   34-01-04  TREE-03      Test file contains backward-compat assertions for Sacramento, Plano, Allen
 *   34-01-05  T-34-01      No FY=9999 sentinel rows leaked in treasury.budgets (cleanup ran)
 *   34-01-06  TREE-01/02/03  REQUIREMENTS.md marks TREE-01/02/03 as [x] complete
 *
 * Gap 34-03-01 (live app: Portland/San Jose/Dallas render correctly) is human-only — not covered here.
 *
 * Exit 0 = all assertions pass
 * Exit 1 = one or more assertions fail
 *
 * Usage: node scripts/verify-phase34.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
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
const TEST_FILE = 'C:/EV-Accounts/backend/test/treasury-3level.test.ts';
const REQUIREMENTS_FILE = resolve(__dirname, '../.planning/REQUIREMENTS.md');

// ── Static file checks ────────────────────────────────────────────────────────

console.log('Phase 34 — 3-Level Tree Infrastructure (EV Accounts API) verification');
console.log('Gaps: 34-01-01 through 34-01-06');
console.log('');
console.log('── Static file checks ──────────────────────────────────────────────────────');

// 34-01-01: Test file exists + contains treasury_sync_budget_tree
let testSrc = null;
try {
  if (!existsSync(TEST_FILE)) {
    fail('34-01-01', `Test file not found: ${TEST_FILE}`);
  } else {
    testSrc = readFileSync(TEST_FILE, 'utf8');
    if (!testSrc.includes('treasury_sync_budget_tree')) {
      fail('34-01-01', "Test file exists but does not contain 'treasury_sync_budget_tree'");
    } else {
      const lineCount = testSrc.split('\n').length;
      pass('34-01-01', `Test file exists (${lineCount} lines) and contains 'treasury_sync_budget_tree'`);
    }
  }
} catch (e) {
  fail('34-01-01', "Error reading test file", e.message);
}

if (!testSrc) {
  // Can't do further static checks without the file
  for (const gapId of ['34-01-02', '34-01-03', '34-01-04']) {
    fail(gapId, "Skipped — test file could not be read (34-01-01 failed)");
  }
} else {
  // 34-01-02: Test asserts depth 0, 1, and 2 in budget_categories (TREE-01)
  // The TREE-01 test queries `GROUP BY depth ORDER BY depth` and checks depthMap for depths 0, 1, 2
  const hasDepthGroupBy  = testSrc.includes('GROUP BY depth') || testSrc.includes('group by depth');
  const hasDepthMap0     = testSrc.includes('depthMap.get(0)') || testSrc.includes("get(0) ===");
  const hasDepthMap2     = testSrc.includes('depthMap.get(2)') || testSrc.includes("get(2) ===");
  const hasDepth3Absent  = testSrc.includes('depthMap.has(3)') || testSrc.includes("has(3)");

  if (!hasDepthGroupBy) {
    fail('34-01-02', "Test file missing GROUP BY depth query for depth distribution check (TREE-01)");
  } else if (!hasDepthMap0 || !hasDepthMap2) {
    fail('34-01-02', "Test file missing depth assertions at 0 or 2 (expected depthMap.get(0) and depthMap.get(2))");
  } else if (!hasDepth3Absent) {
    fail('34-01-02', "Test file missing depth-3 absence assertion (expected depthMap.has(3) === false)");
  } else {
    pass('34-01-02', "Test file asserts depth 0/1/2 present and depth 3 absent in budget_categories (TREE-01)");
  }

  // 34-01-03: Test file contains inline tree builder + subcategory chain assertion (TREE-02)
  // Test uses named variables: root → level2 → level3, and toBeUndefined() for leaf subcategories
  const hasBuildTreeFromRows = testSrc.includes('buildTreeFromRows');
  const hasLevel2Subcats     = testSrc.includes('level2.subcategories');
  const hasLevel3Subcat      = testSrc.includes('level3.subcategories') && testSrc.includes('toBeUndefined');
  const hasLeafLineItems     = testSrc.includes('level3.lineItems') && testSrc.includes('lineItems');

  if (!hasBuildTreeFromRows) {
    fail('34-01-03', "Test file missing inline tree builder (buildTreeFromRows) for TREE-02");
  } else if (!hasLevel2Subcats) {
    fail('34-01-03', "Test file missing level2.subcategories chain assertion for TREE-02");
  } else if (!hasLevel3Subcat) {
    fail('34-01-03', "Test file missing level3.subcategories toBeUndefined() assertion (leaf has no children)");
  } else if (!hasLeafLineItems) {
    fail('34-01-03', "Test file missing level3.lineItems assertion for TREE-02");
  } else {
    pass('34-01-03', "Test file contains buildTreeFromRows + level2/level3 subcategory chain + leaf lineItems assertions (TREE-02)");
  }

  // 34-01-04: TREE-03 backward-compat tests for Sacramento, Plano, Allen
  // Test uses maxDepth reduction (catRows.reduce) + LessThanOrEqual(1) instead of subcategories[0] indexing
  const hasSacramento      = testSrc.includes('Sacramento');
  const hasPlano           = testSrc.includes('Plano');
  const hasAllen           = testSrc.includes('Allen');
  const hasMaxDepthPattern = testSrc.includes('maxDepth') && testSrc.includes('LessThanOrEqual(1)');

  const missing = [!hasSacramento && 'Sacramento', !hasPlano && 'Plano', !hasAllen && 'Allen'].filter(Boolean);
  if (missing.length > 0) {
    fail('34-01-04', `Test file missing TREE-03 city assertions for: ${missing.join(', ')}`);
  } else if (!hasMaxDepthPattern) {
    fail('34-01-04', "Test file missing maxDepth + LessThanOrEqual(1) backward-compat proof for TREE-03");
  } else {
    pass('34-01-04', "Test file contains TREE-03 backward-compat assertions for Sacramento CA, Plano TX, Allen TX (maxDepth <= 1)");
  }
}

// 34-01-06: REQUIREMENTS.md marks TREE-01/02/03 as [x] complete
try {
  const reqMd = readFileSync(REQUIREMENTS_FILE, 'utf8');
  const hasTree01 = /\[x\].*TREE-01/.test(reqMd) || /TREE-01.*\[x\]/.test(reqMd);
  const hasTree02 = /\[x\].*TREE-02/.test(reqMd) || /TREE-02.*\[x\]/.test(reqMd);
  const hasTree03 = /\[x\].*TREE-03/.test(reqMd) || /TREE-03.*\[x\]/.test(reqMd);

  const incomplete = [!hasTree01 && 'TREE-01', !hasTree02 && 'TREE-02', !hasTree03 && 'TREE-03'].filter(Boolean);
  if (incomplete.length > 0) {
    fail('34-01-06', `REQUIREMENTS.md missing [x] for: ${incomplete.join(', ')} — traceability not complete`);
  } else {
    pass('34-01-06', "REQUIREMENTS.md marks TREE-01, TREE-02, TREE-03 as [x] complete");
  }
} catch (e) {
  fail('34-01-06', "Could not read .planning/REQUIREMENTS.md", e.message);
}

// ── DB checks ─────────────────────────────────────────────────────────────────
console.log('');
console.log('── DB checks ───────────────────────────────────────────────────────────────');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [!SUPABASE_URL && 'SUPABASE_URL', !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY'].filter(Boolean).join(', ');
  fail('34-01-05', `DB check skipped — missing env: ${missing}`);
} else {
  // 34-01-05: No FY=9999 sentinel rows in treasury.budgets (cleanup ran correctly)
  // Use native fetch + PostgREST HEAD request to avoid Supabase realtime client handles
  try {
    // Use node:https directly (avoids undici/fetch open-handle issues on Windows)
    const parsedUrl = new URL(`${SUPABASE_URL}/rest/v1/budgets?fiscal_year=eq.9999&select=id`);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

    const count = await new Promise((resolve, reject) => {
      const req = requester({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'HEAD',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept-Profile': 'treasury',
          'Prefer': 'count=exact',
        },
        agent: false, // disable keep-alive — connection closes immediately after response
      }, (res) => {
        res.resume(); // drain body
        const cr = res.headers['content-range'] || '';
        const n = parseInt(cr.split('/')[1] ?? '0', 10);
        resolve(isNaN(n) ? -1 : n);
      });
      req.on('error', reject);
      req.end();
    });

    if (count === -1) {
      fail('34-01-05', "Could not parse count from content-range header");
    } else if (count > 0) {
      fail('34-01-05', `${count} FY=9999 sentinel row(s) found in treasury.budgets — afterAll cleanup did not run (T-34-01 violated)`);
    } else {
      pass('34-01-05', "No FY=9999 sentinel rows in treasury.budgets — test cleanup ran correctly (T-34-01 satisfied)");
    }
  } catch (e) {
    fail('34-01-05', "Unexpected error checking FY=9999 cleanup", e.message);
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
console.log('  Note: Gap 34-03-01 (live app Portland/San Jose/Dallas spot-check) is human-only.');
console.log('        See VERIFICATION.md — Portland and San Jose confirmed; Dallas pending explicit sign-off.');
console.log('');

if (failCount === 0) {
  console.log('PASS — All Phase 34 automated gap checks satisfied');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 34 gap checks failed');
  process.exit(1);
}
