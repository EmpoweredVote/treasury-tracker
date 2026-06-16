#!/usr/bin/env node
/**
 * verify-phase57.mjs
 *
 * Behavioral verification script for Phase 57 — Orange County County-Government Budget.
 * Covers 7 automatable gaps across requirements OCB-01, OCB-02.
 *
 * Gap coverage:
 *   57-02-01  OCB-01  OC county entity has >= 1 operating budget row
 *   57-02-02  OCB-01  OC county entity has >= 1 revenue budget row
 *   57-02-03  OCB-01  County budget rows carry durable source_url (/d/uctr-c2j8 or
 *                     /d/emxv-k8xv, NOT /resource/*.json) AND non-null source_date
 *   57-02-04  OCB-01  OC county entity population > 0 (per-capita denominator, D-06)
 *   57-02-05  OCB-01  A sampled county FY total matches the SCO source figure within
 *                     rounding tolerance (from 57-01-SUMMARY sampled totals)
 *   57-02-06  OCB-01  A sampled OC city budget row's data_source is NOT a county-load
 *                     label — the county load did not overwrite city rows (T-57-01)
 *   57-02-07  OCB-01/02  .planning/REQUIREMENTS.md marks OCB-01 AND OCB-02 as [x]
 *                         (traceability)
 *
 * Human-only gaps (not automatable here):
 *   ACFR cross-check (one FY, basis-matched, delta recorded): requires human to open
 *     OC ACFR PDF and confirm figure + delta — documented in 57-VERIFICATION.md
 *   Live-app UAT: OC county page icicle/summary + per-capita, SourceChip, 34 cities
 *     — requires human at https://treasurytracker.empowered.vote — Chris sign-off
 *
 * Exit 0 = all assertions pass
 * Exit 1 = one or more assertions fail
 *
 * Usage: node scripts/verify-phase57.mjs
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
const OC_COUNTY_ID = '65e7c643-5829-4821-9537-f8595bce61ab';

// Irvine — sampled OC city for the non-overwrite assertion (57-02-06)
// Its FY2024 operating data_source must still be the cities ByTheNumbers label,
// NOT the county label loaded in Phase 57.
const IRVINE_ID = '17f0abc4-751f-4609-adcd-d6274ed33269';

// Sampled exact-match total for 57-02-05 (from 57-01-SUMMARY sampled totals)
// FY2010 operating: $3,007,166,924  (also the ACFR cross-check year in 57-01)
// FY2024 operating: $6,424,119,390  (canary year from 57-01-03)
const SAMPLE_CHECK = {
  label: 'OC county FY2024 operating',
  fiscal_year: 2024,
  dataset_type: 'operating',
  expected: 6424119390,
  // Allow +/- $1 for any integer rounding in the pipeline
  tolerance: 1,
};

// County data_source labels (Phase 57 loader) — used in 57-02-06 to confirm
// NO OC city row carries one of these.
const COUNTY_DATA_SOURCES = [
  'CA State Controller - County Expenditures',
  'CA State Controller - County Revenues',
];

// Durable county source URLs (loaded in Phase 57)
const COUNTY_SOURCE_URL_FRAGMENTS = ['/d/uctr-c2j8', '/d/emxv-k8xv'];

// ── DB helper ─────────────────────────────────────────────────────────────────
/**
 * dbGet(supabaseUrl, supabaseKey, path, opts)
 *   path: PostgREST path starting with /rest/v1/...
 *   opts.head: boolean — sends HEAD + Prefer:count=exact, returns integer count
 *              false/omitted — sends GET + Accept:application/json, returns JSON
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
      agent: false, // disable keep-alive
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
console.log('Phase 57 — Orange County County-Government Budget verification');
console.log('Gaps: 57-02-01 through 57-02-07 (automated); ACFR cross-check + live-app UAT are human-only');
console.log('');
console.log('── DB checks ───────────────────────────────────────────────────────────────');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
  ].filter(Boolean).join(', ');
  for (const gapId of ['57-02-01','57-02-02','57-02-03','57-02-04','57-02-05','57-02-06']) {
    fail(gapId, `DB check skipped — missing env: ${missing}`);
  }
} else {
  // ── 57-02-01: County entity has >= 1 operating budget row ────────────────────
  try {
    const count = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${OC_COUNTY_ID}&dataset_type=eq.operating&select=id`,
      { head: true }
    );
    if (count === -1) {
      fail('57-02-01', 'Could not parse count from content-range header');
    } else if (count >= 1) {
      pass('57-02-01', `OC county entity has ${count} operating budget row(s) (OCB-01)`);
    } else {
      fail('57-02-01', `Expected >= 1 operating budget row for OC county entity, got ${count}`);
    }
  } catch (e) {
    fail('57-02-01', 'Unexpected error checking county operating coverage', e.message);
  }

  // ── 57-02-02: County entity has >= 1 revenue budget row ──────────────────────
  try {
    const count = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${OC_COUNTY_ID}&dataset_type=eq.revenue&select=id`,
      { head: true }
    );
    if (count === -1) {
      fail('57-02-02', 'Could not parse count from content-range header');
    } else if (count >= 1) {
      pass('57-02-02', `OC county entity has ${count} revenue budget row(s) (OCB-01)`);
    } else {
      fail('57-02-02', `Expected >= 1 revenue budget row for OC county entity, got ${count}`);
    }
  } catch (e) {
    fail('57-02-02', 'Unexpected error checking county revenue coverage', e.message);
  }

  // ── 57-02-03: County budget rows carry durable source_url + non-null source_date
  // (a) All county budget rows with non-null source_url must contain /d/uctr-c2j8 or
  //     /d/emxv-k8xv (durable page, NOT /resource/*.json)
  // (b) All county budget rows must have a non-null source_date
  try {
    // (a) Non-null source_url rows that do NOT contain /d/ should = 0
    const nonDurableCount = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${OC_COUNTY_ID}&source_url=not.is.null&source_url=not.like.*%2Fd%2F*&select=id`,
      { head: true }
    );
    // (b) Rows missing source_date should = 0
    const missingDateCount = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${OC_COUNTY_ID}&source_date=is.null&dataset_type=in.(operating,revenue)&select=id`,
      { head: true }
    );

    const aOk = nonDurableCount === 0;
    const bOk = missingDateCount === 0;

    if (aOk && bOk) {
      pass('57-02-03', 'All county budget rows have durable /d/<id> source_url and non-null source_date (OCB-01)');
    } else {
      const details = [];
      if (!aOk) details.push(`non-durable source_url rows: ${nonDurableCount} (expected 0)`);
      if (!bOk) details.push(`rows missing source_date: ${missingDateCount} (expected 0)`);
      fail('57-02-03', 'County budget rows have non-durable source_url or missing source_date', details.join('; '));
    }
  } catch (e) {
    fail('57-02-03', 'Unexpected error checking source_url/source_date durable attribution', e.message);
  }

  // ── 57-02-04: OC county entity population > 0 ────────────────────────────────
  try {
    const rows = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/municipalities?id=eq.${OC_COUNTY_ID}&select=name,population,entity_type`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      fail('57-02-04', 'OC county entity not found in municipalities table');
    } else {
      const { name, population, entity_type } = rows[0];
      if (population > 0) {
        pass('57-02-04', `OC county entity ("${name}", entity_type=${entity_type}) population = ${population.toLocaleString()} > 0 (per-capita denominator, D-06)`);
      } else {
        fail('57-02-04', `OC county entity population is ${population} — expected > 0 for per-capita (D-06)`);
      }
    }
  } catch (e) {
    fail('57-02-04', 'Unexpected error checking OC county entity population', e.message);
  }

  // ── 57-02-05: Sampled FY total matches SCO source figure within tolerance ─────
  try {
    const { label, fiscal_year, dataset_type, expected, tolerance } = SAMPLE_CHECK;
    const rows = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${OC_COUNTY_ID}&fiscal_year=eq.${fiscal_year}&dataset_type=eq.${dataset_type}&select=total_budget`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      fail('57-02-05', `${label}: no row found (expected ${expected.toLocaleString()})`);
    } else {
      const actual = rows[0].total_budget;
      const delta = Math.abs(actual - expected);
      if (delta <= tolerance) {
        pass('57-02-05', `${label} = $${actual.toLocaleString()} (expected $${expected.toLocaleString()}, delta = $${delta})`);
      } else {
        fail('57-02-05', `${label}: expected $${expected.toLocaleString()}, got $${actual.toLocaleString()}, delta = $${delta.toLocaleString()} (tolerance $${tolerance})`);
      }
    }
  } catch (e) {
    fail('57-02-05', 'Unexpected error checking sampled county FY total', e.message);
  }

  // ── 57-02-06: Sampled OC city budget row data_source is NOT a county load label
  // Checks that the Phase 57 county load did not overwrite city rows (T-57-01)
  // Sample: Irvine FY2024 operating — must retain its cities ByTheNumbers source
  try {
    const rows = await dbGet(
      SUPABASE_URL, SUPABASE_KEY,
      `/rest/v1/budgets?municipality_id=eq.${IRVINE_ID}&fiscal_year=eq.2024&dataset_type=eq.operating&select=data_source,source_url`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      fail('57-02-06', 'Irvine FY2024 operating row not found — cannot verify non-overwrite');
    } else {
      const { data_source, source_url } = rows[0];
      const isCountySource = COUNTY_DATA_SOURCES.some(s => data_source === s);
      const isCountyUrl = COUNTY_SOURCE_URL_FRAGMENTS.some(f => (source_url || '').includes(f));
      if (!isCountySource && !isCountyUrl) {
        pass('57-02-06', `Irvine FY2024 operating retains its original data_source="${data_source}" — county load did not overwrite city rows (T-57-01)`);
      } else {
        fail('57-02-06', `Irvine FY2024 operating was overwritten: data_source="${data_source}", source_url="${source_url}" — county load contaminated a city row`);
      }
    }
  } catch (e) {
    fail('57-02-06', 'Unexpected error checking city non-overwrite (T-57-01)', e.message);
  }
}

// ── 57-02-07: REQUIREMENTS.md marks OCB-01 and OCB-02 as [x] ─────────────────
console.log('');
console.log('── Requirements traceability check ─────────────────────────────────────────');
try {
  const requirementsPath = resolve(__dirname, '../.planning/REQUIREMENTS.md');
  const reqContent = readFileSync(requirementsPath, 'utf8');

  const ocb01Match = reqContent.match(/\[([x ])\]\s+\*\*OCB-01\*\*/);
  const ocb02Match = reqContent.match(/\[([x ])\]\s+\*\*OCB-02\*\*/);

  const ocb01Done = ocb01Match?.[1] === 'x';
  const ocb02Done = ocb02Match?.[1] === 'x';

  if (ocb01Done && ocb02Done) {
    pass('57-02-07', 'REQUIREMENTS.md shows OCB-01 [x] and OCB-02 [x] (traceability complete)');
  } else {
    const details = [];
    if (!ocb01Done) details.push(`OCB-01 is ${ocb01Match ? '[ ]' : 'NOT FOUND'}`);
    if (!ocb02Done) details.push(`OCB-02 is ${ocb02Match ? '[ ]' : 'NOT FOUND'}`);
    fail('57-02-07', 'REQUIREMENTS.md OCB-01/OCB-02 not marked [x]', details.join('; '));
  }
} catch (e) {
  fail('57-02-07', 'Unexpected error reading REQUIREMENTS.md', e.message);
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
console.log('  Note: The ACFR cross-check (OC ACFR all-funds vs SCO loaded total, basis-matched,');
console.log('        delta documented) is human-only — see 57-VERIFICATION.md for the FY2010');
console.log('        cross-check: SCO $3,007,166,924 vs ACFR governmental-activities ~$2.35B,');
console.log('        delta ~$655M = all-governmental-funds basis documented variance.');
console.log('  Note: Live-app OC county page UAT (icicle/summary + per-capita + SourceChip +');
console.log('        34 cities listed) requires Chris at https://treasurytracker.empowered.vote');
console.log('        See 57-VERIFICATION.md for UAT checklist and sign-off line.');
console.log('');

if (failCount === 0) {
  console.log('PASS — All Phase 57 automated gap checks satisfied');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 57 gap checks failed');
  process.exit(1);
}
