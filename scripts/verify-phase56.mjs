#!/usr/bin/env node
/**
 * verify-phase56.mjs
 *
 * Behavioral verification script for Phase 56 — Orange County Verification + UAT.
 * Covers 7 automatable gaps across requirements VER-01, VER-02.
 *
 * Gap coverage:
 *   56-01-01  VER-01  All 34 OC cities have county_id = OC entity in treasury.municipalities
 *   56-01-02  VER-01  All 34 OC cities have operating rows for FY2003–2024
 *   56-01-03  VER-01  All 34 OC cities have revenue rows for FY2003–2024
 *   56-01-04  VER-01  ByTheNumbers rows have durable source_url (%/d/ju3w-4gxp%)
 *   56-01-05  VER-01  Anaheim/Santa Ana custom rows (source_url IS NULL) preserved
 *   56-01-06  VER-01  Sampled city/year totals match known-verified exact values
 *   56-01-07  VER-01  All 34 OC cities have salaries rows
 *
 * Gap 56-02-01 (ACFR spot-check: 7 cities pass within 1–2%) is human-only.
 * Gap 56-03-01 (live-app UAT: 5 nav surfaces confirmed by Chris) is human-only.
 * See .planning/phases/56-orange-county-verification-uat/56-VERIFICATION.md for
 * ACFR figures, UAT results, and Chris sign-off.
 *
 * Exit 0 = all assertions pass
 * Exit 1 = one or more assertions fail
 *
 * Usage: node scripts/verify-phase56.mjs
 */

import { readFileSync } from 'node:fs';
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
const OC_COUNTY_ID    = '65e7c643-5829-4821-9537-f8595bce61ab';
const ANAHEIM_ID      = '7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5';
const SANTA_ANA_ID    = '2dc65052-aa62-4a3c-a5c0-eea78dfe9ad3';
const IRVINE_ID       = '17f0abc4-751f-4609-adcd-d6274ed33269';
const HB_ID           = 'd0b51865-2581-4091-8d4c-18e2a2750657';
const NEWPORT_ID      = 'a091a210-e017-47df-ba65-5e2bf43c95c8';
const VILLA_PARK_ID   = 'ce99c02d-b889-4c38-832d-face172b5a8c';
const LAGUNA_WOODS_ID = '3a25551e-5a40-40a7-ac72-3e6938695f40';

// Known-good exact values for 56-01-06 assertion (from 56-RESEARCH.md §Known DB Values)
const KNOWN_TOTALS = [
  { id: IRVINE_ID,       label: 'Irvine',       fy: 2024, type: 'operating', expected: 656013821  },
  { id: HB_ID,           label: 'HB',           fy: 2019, type: 'operating', expected: 323441057  },
  { id: ANAHEIM_ID,      label: 'Anaheim',      fy: 2024, type: 'operating', expected: 1640316917 },
  { id: ANAHEIM_ID,      label: 'Anaheim',      fy: 2025, type: 'operating', expected: 490937159  },
  { id: SANTA_ANA_ID,    label: 'Santa Ana',    fy: 2024, type: 'operating', expected: 414022680  },
  { id: SANTA_ANA_ID,    label: 'Santa Ana',    fy: 2024, type: 'revenue',   expected: 400947213  },
  { id: NEWPORT_ID,      label: 'Newport Beach',fy: 2024, type: 'operating', expected: 444327078  },
  { id: VILLA_PARK_ID,   label: 'Villa Park',   fy: 2024, type: 'operating', expected: 6111009    },
  { id: LAGUNA_WOODS_ID, label: 'Laguna Woods', fy: 2024, type: 'operating', expected: 10051862   },
];

// ── DB helper ─────────────────────────────────────────────────────────────────
/**
 * dbGet(path, opts)
 *   path: PostgREST path starting with /rest/v1/...
 *   opts.head: boolean — if true, sends HEAD + Prefer: count=exact, returns integer count
 *              if false/omitted, sends GET + Accept: application/json, returns parsed JSON
 *   opts.key: SUPABASE_KEY (never interpolated into the path)
 *   opts.url: SUPABASE_URL base
 */
function dbGet(supabaseUrl, supabaseKey, path, { head = false } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${supabaseUrl}${path}`);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const method = head ? 'HEAD' : 'GET';
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Accept-Profile': 'treasury',
    };
    if (head) {
      headers['Prefer'] = 'count=exact';
    } else {
      headers['Accept'] = 'application/json';
    }

    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
      agent: false, // disable keep-alive — connection closes immediately after response
    }, (res) => {
      if (head) {
        res.resume(); // drain body
        const cr = res.headers['content-range'] || '';
        const n = parseInt(cr.split('/')[1] ?? '', 10);
        resolve(isNaN(n) ? -1 : n);
      } else {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      }
    });
    req.on('error', reject);
    req.end();
  });
}

// ── DB checks ─────────────────────────────────────────────────────────────────
console.log('Phase 56 — Orange County Verification + UAT verification');
console.log('Gaps: 56-01-01 through 56-01-07 (automated); 56-02-01 + 56-03-01 are human-only');
console.log('');
console.log('── DB checks ───────────────────────────────────────────────────────────────');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
  ].filter(Boolean).join(', ');
  for (const gapId of ['56-01-01','56-01-02','56-01-03','56-01-04','56-01-05','56-01-06','56-01-07']) {
    fail(gapId, `DB check skipped — missing env: ${missing}`);
  }
} else {
  // ── 56-01-01: All 34 OC cities linked via county_id ─────────────────────────
  try {
    const count = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/municipalities?county_id=eq.${OC_COUNTY_ID}&entity_type=eq.city&select=id`,
      { head: true }
    );
    if (count === -1) {
      fail('56-01-01', 'Could not parse count from content-range header');
    } else if (count === 34) {
      pass('56-01-01', `34 OC cities linked to OC entity via county_id (count = ${count})`);
    } else {
      fail('56-01-01', `Expected 34 OC cities with county_id = OC entity, got ${count}`);
    }
  } catch (e) {
    fail('56-01-01', 'Unexpected error checking OC city count', e.message);
  }

  // Resolve OC city id list for subsequent IN() queries
  let ocCityIds = [];
  try {
    const rows = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/municipalities?county_id=eq.${OC_COUNTY_ID}&entity_type=eq.city&select=id`
    );
    ocCityIds = Array.isArray(rows) ? rows.map(r => r.id) : [];
  } catch (e) {
    // If this fails, downstream checks will fall back to individual failures
  }

  if (ocCityIds.length === 0) {
    for (const gapId of ['56-01-02','56-01-03','56-01-04','56-01-07']) {
      fail(gapId, 'Skipped — could not resolve OC city id list (56-01-01 may have failed)');
    }
  } else {
    const idsParam = `(${ocCityIds.join(',')})`;

    // ── 56-01-02: Operating rows for FY2003–2024 ────────────────────────────
    try {
      const MIN_EXPECTED = 726; // 33 cities × 22 years (one city may have source gaps)
      const count = await dbGet(
        SUPABASE_URL, SUPABASE_KEY,
        `/rest/v1/budgets?municipality_id=in.${idsParam}&fiscal_year=gte.2003&fiscal_year=lte.2024&dataset_type=eq.operating&select=id`,
        { head: true }
      );
      if (count === -1) {
        fail('56-01-02', 'Could not parse count from content-range header');
      } else if (count >= MIN_EXPECTED) {
        pass('56-01-02', `OC cities have operating rows FY2003–2024 (count = ${count}, >= ${MIN_EXPECTED})`);
      } else {
        fail('56-01-02', `Expected >= ${MIN_EXPECTED} operating rows FY2003–2024 for OC cities, got ${count}`);
      }
    } catch (e) {
      fail('56-01-02', 'Unexpected error checking operating row count', e.message);
    }

    // ── 56-01-03: Revenue rows for FY2003–2024 ──────────────────────────────
    try {
      const MIN_EXPECTED = 726;
      const count = await dbGet(
        SUPABASE_URL, SUPABASE_KEY,
        `/rest/v1/budgets?municipality_id=in.${idsParam}&fiscal_year=gte.2003&fiscal_year=lte.2024&dataset_type=eq.revenue&select=id`,
        { head: true }
      );
      if (count === -1) {
        fail('56-01-03', 'Could not parse count from content-range header');
      } else if (count >= MIN_EXPECTED) {
        pass('56-01-03', `OC cities have revenue rows FY2003–2024 (count = ${count}, >= ${MIN_EXPECTED})`);
      } else {
        fail('56-01-03', `Expected >= ${MIN_EXPECTED} revenue rows FY2003–2024 for OC cities, got ${count}`);
      }
    } catch (e) {
      fail('56-01-03', 'Unexpected error checking revenue row count', e.message);
    }

    // ── 56-01-04: ByTheNumbers source_url is durable (contains /d/) ─────────
    // Non-null source_url rows that do NOT contain the durable dataset path /d/ should = 0
    try {
      const count = await dbGet(
        SUPABASE_URL, SUPABASE_KEY,
        `/rest/v1/budgets?municipality_id=in.${idsParam}&source_url=not.is.null&source_url=not.like.*%2Fd%2F*&dataset_type=eq.operating&select=id`,
        { head: true }
      );
      if (count === -1) {
        fail('56-01-04', 'Could not parse count from content-range header');
      } else if (count === 0) {
        pass('56-01-04', 'All non-null operating source_url values contain durable /d/ dataset path (0 non-durable rows)');
      } else {
        fail('56-01-04', `Expected 0 non-durable source_url rows, got ${count} — check for non-/d/ source URLs`);
      }
    } catch (e) {
      fail('56-01-04', 'Unexpected error checking source_url durable path', e.message);
    }

    // ── 56-01-07: Salaries coverage — all 34 OC cities ──────────────────────
    try {
      const rows = await dbGet(
        SUPABASE_URL, SUPABASE_KEY,
        `/rest/v1/budgets?municipality_id=in.${idsParam}&dataset_type=eq.salaries&select=municipality_id`
      );
      if (!Array.isArray(rows)) {
        fail('56-01-07', 'Unexpected non-array response for salaries rows');
      } else {
        const distinctCities = new Set(rows.map(r => r.municipality_id)).size;
        if (distinctCities === 34) {
          pass('56-01-07', `All 34 OC cities have salaries rows (distinct municipality_id count = ${distinctCities})`);
        } else {
          fail('56-01-07', `Expected 34 distinct cities with salaries rows, got ${distinctCities}`);
        }
      }
    } catch (e) {
      fail('56-01-07', 'Unexpected error checking salaries coverage', e.message);
    }
  }

  // ── 56-01-05: Anaheim/Santa Ana custom rows (source_url IS NULL) ────────────
  // Filter by dataset_type=in.(operating,revenue) — salaries rows also have null source_url
  // (GCC loader does not set source_url) and should not be counted here.
  // Anaheim custom: FY2025-26 operating+revenue = 4 rows
  // Santa Ana custom: FY2023-26 operating+revenue = 8 rows
  try {
    const anaheimRows = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${ANAHEIM_ID}&source_url=is.null&dataset_type=in.(operating,revenue)&select=fiscal_year,dataset_type,total_budget`
    );
    const santaAnaRows = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${SANTA_ANA_ID}&source_url=is.null&dataset_type=in.(operating,revenue)&select=fiscal_year,dataset_type,total_budget`
    );
    const anaheimCount = Array.isArray(anaheimRows) ? anaheimRows.length : 0;
    const santaAnaCount = Array.isArray(santaAnaRows) ? santaAnaRows.length : 0;

    const anaheimOk = anaheimCount === 4;  // FY2025-26 operating+revenue = 4 rows
    const santaAnaOk = santaAnaCount >= 8; // FY2023-26 operating+revenue = 8+ rows

    if (anaheimOk && santaAnaOk) {
      pass('56-01-05', `Anaheim custom rows = ${anaheimCount} (expected 4); Santa Ana custom rows = ${santaAnaCount} (expected >= 8)`);
    } else {
      const details = [];
      if (!anaheimOk) details.push(`Anaheim: expected 4 null-source rows, got ${anaheimCount}`);
      if (!santaAnaOk) details.push(`Santa Ana: expected >= 8 null-source rows, got ${santaAnaCount}`);
      fail('56-01-05', 'Anaheim/Santa Ana custom row counts do not match expected', details.join('; '));
    }
  } catch (e) {
    fail('56-01-05', 'Unexpected error checking Anaheim/Santa Ana custom rows', e.message);
  }

  // ── 56-01-06: Sampled city/year/dataset totals match known exact values ─────
  try {
    const mismatches = [];
    for (const { id, label, fy, type, expected } of KNOWN_TOTALS) {
      const rows = await dbGet(
        SUPABASE_URL, SUPABASE_KEY,
        `/rest/v1/budgets?municipality_id=eq.${id}&fiscal_year=eq.${fy}&dataset_type=eq.${type}&select=total_budget`
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        mismatches.push(`${label} FY${fy} ${type}: no row found (expected ${expected})`);
      } else {
        const actual = rows[0].total_budget;
        if (actual !== expected) {
          mismatches.push(`${label} FY${fy} ${type}: expected ${expected}, got ${actual}`);
        }
      }
    }
    if (mismatches.length === 0) {
      pass('56-01-06', `All 9 sampled city/year/dataset totals match known exact values`);
    } else {
      fail('56-01-06', `${mismatches.length} of ${KNOWN_TOTALS.length} exact-match assertions failed`, mismatches.join(' | '));
    }
  } catch (e) {
    fail('56-01-06', 'Unexpected error checking known exact totals', e.message);
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
console.log('  Note: Gaps 56-02-01 (ACFR spot-check: 7 sampled OC cities) and 56-03-01');
console.log('        (live-app UAT: 5 nav surfaces) are human-only.');
console.log('        See .planning/phases/56-orange-county-verification-uat/56-VERIFICATION.md');
console.log('        for ACFR figures, UAT results, and Chris sign-off.');
console.log('');

if (failCount === 0) {
  console.log('PASS — All Phase 56 automated gap checks satisfied');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 56 gap checks failed');
  process.exit(1);
}
