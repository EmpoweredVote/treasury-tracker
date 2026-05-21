#!/usr/bin/env node
/**
 * Garland Operating Budget Extractor
 *
 * Extracts General Fund operating expenditures from Garland's FY2024-25
 * Annual Operating Budget PDF using pdftotext — no AI API calls, pure text parsing.
 *
 * PDF layout:
 *   Each General Fund department has a "Department Budget Summary" section with:
 *     - Header row: 2022-23 Actual | 2023-24 Approved | 2023-24 Revised | 2024-25 Approved
 *     - Personnel (Charge-Outs) row: $ X,XXX,XXX $ X,XXX,XXX $ X,XXX,XXX $ X,XXX,XXX
 *     - Operations (Department Total Budget) row
 *     - Final grand total row: $ X,XXX,XXX $ X,XXX,XXX $ X,XXX,XXX $ X,XXX,XXX
 *     - "Change from Prior Year" marker ends the section
 *
 *   The final $ line before "Change from Prior Year" is the true department total.
 *
 *   The "General Fund Expenditures by Area" summary table (pages 54-55) has a
 *   two-column PDF layout that pdftotext interleaves incorrectly — DO NOT USE IT.
 *   Instead, parse each department's individual Budget Summary detail page.
 *
 * Mapping:
 *   adopted_amount = col[3]  (2024-25 Approved, rightmost)
 *   actual_amount  = col[0]  (2022-23 Actual, leftmost)
 *
 * Usage:
 *   node scripts/processGarlandBudget.js              # production (loads to DB)
 *   node scripts/processGarlandBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processGarlandBudget.js --verbose    # log parse decisions
 *   node scripts/processGarlandBudget.js --no-cache   # re-download even if cache exists
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL = 'https://garlandtx.gov/DocumentCenter/View/20565/City-of-Garland-2024-25-Annual-Operating-Budget-PDF';
const CACHE_PATH = 'C:/tmp/collin-budgets/garland_fy2025.pdf';
const FISCAL_YEAR = 2025;
const DATA_SOURCE_NAME = 'Garland Operating Budget FY2025';

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Department name mapping (ALL-CAPS PDF name → display name) ─────────────────
// Only General Fund operating departments. Non-GF funds excluded.
const DEPT_NAME_MAP = {
  'ANIMAL SERVICES':              'Animal Services',
  'OFFICE OF EMERGENCY MANAGEMENT': 'Emergency Management',
  'FIRE DEPARTMENT':              'Fire Department',
  'HEALTH':                       'Health',
  'POLICE':                       'Police',
  'BUDGET & RESEARCH':            'Budget & Research',
  'CITY ADMINISTRATION':          'City Administration',
  'OFFICE OF THE CITY ATTORNEY':  'City Attorney',
  'CITY COUNCIL':                 'City Council',
  "CITY SECRETARY'S OFFICE":      "City Secretary's Office",
  'FINANCIAL SERVICES':           'Financial Services',
  'HUMAN RESOURCES':              'Human Resources',
  'INTERNAL AUDIT':               'Internal Audit',
  'LEGISLATIVE & PUBLIC AFFAIRS': 'Legislative & Public Affairs',
  'MUNICIPAL COURT':              'Municipal Court',
  'PUBLIC & MEDIA RELATIONS':     'Public & Media Relations',
  'PROCUREMENT':                  'Procurement',
  'TAX':                          'Tax Collection',
  'ENGINEERING':                  'Engineering',
  'LANDFILL':                     'Landfill',
  'PROJECT MANAGEMENT OFFICE':    'Project Management Office',
  'TRANSPORTATION':               'Transportation',
  'BUILDING INSPECTION':          'Building Inspection',
  'CODE COMPLIANCE':              'Code Compliance',
  'OFFICE OF NEIGHBORHOOD VITALITY': 'Neighborhood Vitality',
  'PLANNING & DEVELOPMENT':       'Planning & Development',
  'CULTURAL ARTS':                'Cultural Arts',
  'LIBRARY':                      'Library',
  'PARD - PARKS & RECREATION':    'Parks & Recreation',
  'SPECIAL EVENTS':               'Special Events',
};

// Departments to skip (enterprise/special revenue/internal service funds, not GF)
const SKIP_NAMES = new Set([
  'ELECTRIC UTILITY',
  'WATER UTILITY',
  'WASTEWATER UTILITY',
  'SANITATION',
  'STORMWATER MANAGEMENT',
  'FIREWHEEL GOLF PARK',
  'HELIPORT',
  'RECREATION PERFORMANCE',
  'EQUIPMENT REPLACEMENT',
  'SELF INSURANCE',
  'GROUP HEALTH INSURANCE',
  'LONG TERM DISABILITY',
  'CUSTOMER SERVICE',
  'FACILITIES MANAGEMENT',
  'INFORMATION TECHNOLOGY',
  'COMMUNICATIONS',
  'WAREHOUSE',
  'DEBT SERVICE',
  'ECONOMIC DEVELOPMENT',
  'REAL ESTATE MANAGEMENT',
  'INFRASTRUCTURE REPAIR',
  'PUBLIC HEALTH / IMMUNIZATION',
  'CASA FUND',
  'CDBG',
  'CORONAVIRUS',
  'CULTURE & RECREATION GRANT',
  'EMERGENCY SOLUTIONS GRANT',
  'FAIR HOUSING',
  'HOME GRANT',
  'HOUSING ASSISTANCE',
  'PUBLIC SAFETY GRANT',
  'NARCOTIC SEIZURE',
  'HOTEL/MOTEL TAX',
  'TIF',
]);

// ── Parse money token (handles negatives in parens) ───────────────────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── Extract department name from a context line ───────────────────────────────
// Looks for patterns like:
//   "General Fund                    DEPT NAME"
//   "Department Detail               DEPT NAME"
function extractDeptNameFromLine(line) {
  // Pattern: "General Fund" or "Department Detail" followed by 10+ spaces then ALL CAPS name
  const m = line.match(/^(?:General Fund|Department Detail)\s{10,}([A-Z][A-Z\s&\-\/\(\)\.,']+?)\s*$/);
  if (!m) return null;
  const raw = m[1].trim();
  // Skip lines that are just "General Fund" with trailing whitespace
  if (!raw || raw.length < 2) return null;
  return raw;
}

// ── Extract 4 column $ values from a "$ X,XXX $" style line ──────────────────
// Returns [actual(col0), _, _, adopted(col3)] or null if not a valid $ line
function extractFourColumnDollars(line) {
  // Accept any line containing 2+ dollar values (labeled lines like "Percentage Change $ X" are valid)
  const tokens = [];
  const re = /\$\s*([\d,]+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const v = parseMoney(m[1]);
    if (v !== null) tokens.push(v);
  }
  if (tokens.length < 2) return null;
  return tokens; // [col0_actual, col1, col2, col3_adopted]
}

// ── Parse the PDF text and extract department budget data ─────────────────────
function parsePDF(pdfPath, verbose) {
  let text;
  try {
    text = execSync(`pdftotext -layout "${pdfPath}" -`, {
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (e) {
    console.error('pdftotext error:', e.message.slice(0, 300));
    return null;
  }

  const lines = text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);
  const nLines = lines.length;

  // deptDisplayName -> { adopted, actual }
  const deptData = new Map();

  for (let i = 0; i < nLines; i++) {
    const line = lines[i];

    // Look for "Department Budget Summary" header
    if (!/Department Budget Summary/.test(line)) continue;

    // ── Find department name by looking backward up to 80 lines ──────────────
    let rawDeptName = null;
    for (let k = i - 1; k >= Math.max(0, i - 80); k--) {
      const name = extractDeptNameFromLine(lines[k]);
      if (name) {
        rawDeptName = name;
        break;
      }
    }

    if (!rawDeptName) {
      if (verbose) console.error(`[skip-noname] Line ${i}: Department Budget Summary with no dept name found`);
      continue;
    }

    // Check if this dept should be skipped
    let skip = false;
    for (const skipName of SKIP_NAMES) {
      if (rawDeptName.includes(skipName)) { skip = true; break; }
    }
    if (skip) {
      if (verbose) console.error(`[skip-enterprise] Line ${i}: ${rawDeptName}`);
      continue;
    }

    // Map to display name
    const displayName = DEPT_NAME_MAP[rawDeptName];
    if (!displayName) {
      if (verbose) console.error(`[skip-unmapped] Line ${i}: "${rawDeptName}" — not in DEPT_NAME_MAP`);
      continue;
    }

    // Already captured this dept?
    if (deptData.has(displayName)) {
      if (verbose) console.error(`[skip-dup] Line ${i}: ${displayName} (already captured)`);
      continue;
    }

    if (verbose) console.error(`[dept] Line ${i}: "${rawDeptName}" → "${displayName}"`);

    // ── Scan forward for the final $ values line before "Change from Prior Year" ──
    const SCAN_LIMIT = Math.min(i + 60, nLines);
    let lastFourCol = null;

    for (let j = i + 1; j < SCAN_LIMIT; j++) {
      const sl = lines[j];

      // "Department Staffing Summary" ends the section — but for some departments
      // (e.g. PARD - Parks & Recreation) it carries the grand total $ values itself.
      if (/Department Staffing Summary/.test(sl)) {
        const vals = extractFourColumnDollars(sl);
        if (vals && vals.length >= 2) {
          lastFourCol = vals; // override with staffing-summary grand total
          if (verbose) console.error(`  [dept-staffing-total] L${j}: ${JSON.stringify(vals)}`);
        }
        break;
      }

      const vals = extractFourColumnDollars(sl);
      if (vals && vals.length >= 2) {
        lastFourCol = vals;
        if (verbose) console.error(`  [dollar-line] L${j}: ${JSON.stringify(vals)} — "${sl.trim()}"`);
      }
    }

    if (!lastFourCol || lastFourCol.length < 2) {
      if (verbose) console.error(`  [no-data] ${displayName} — no $ line found`);
      continue;
    }

    const actual = lastFourCol[0] ?? null;
    const adopted = lastFourCol.length >= 4 ? (lastFourCol[3] ?? lastFourCol[lastFourCol.length - 1]) : lastFourCol[lastFourCol.length - 1];

    if (adopted === null || adopted === 0) {
      if (verbose) console.error(`  [no-adopted] ${displayName} — adopted is null/zero, skipping`);
      continue;
    }

    deptData.set(displayName, { adopted, actual });
    if (verbose) {
      console.error(`  [captured] ${displayName}: adopted=$${Math.round(adopted).toLocaleString()}, actual=${actual !== null ? '$' + Math.round(actual).toLocaleString() : 'null'}`);
    }
  }

  return deptData;
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  for (const [deptName, { adopted, actual }] of deptData) {
    if (adopted === 0 && actual === null) continue;

    jsonTree.push({
      n: deptName,
      a: adopted,
      c: [{
        n: deptName,
        a: adopted,
        i: [{
          d: deptName,
          a: adopted,
          aa: actual,
          f: 'General Fund',
          e: null,
        }],
      }],
    });

    total += adopted;
  }

  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total };
}

// ── Upsert a data_source record ───────────────────────────────────────────────
async function upsertDataSource(supabase, muniId) {
  const src = {
    name: DATA_SOURCE_NAME,
    api_type: 'pdf_download',
    dataset_type: 'operating',
    dataset_id: 'fy2025',
    base_url: PDF_URL,
    fiscal_years: [FISCAL_YEAR],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2025')
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) throw new Error(`data_sources update failed: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) throw new Error(`data_sources insert failed: ${error.message}`);
  return data;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'verbose': { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const verbose = opts['verbose'];
  const noCache = opts['no-cache'];

  // ── Download or load PDF ──────────────────────────────────────────────────
  const cacheExists = fs.existsSync(CACHE_PATH);
  if (!cacheExists || noCache) {
    console.log(`Downloading PDF from ${PDF_URL} ...`);
    const resp = await fetch(PDF_URL);
    if (!resp.ok) {
      console.error(`Download failed: HTTP ${resp.status} ${resp.statusText}`);
      process.exit(2);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(CACHE_PATH, buf);
    console.log(`Saved to ${CACHE_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`Using cached PDF: ${CACHE_PATH}`);
  }

  // ── Supabase client (needed even in dry-run to look up municipality) ──────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ───────────────────────────────────────────────────
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Garland').single();
  if (muniErr || !muni) {
    console.error('Could not find Garland municipality:', muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})\n`);

  // ── Parse PDF ─────────────────────────────────────────────────────────────
  console.log('Parsing PDF with pdftotext...');
  const deptData = parsePDF(CACHE_PATH, verbose);
  if (!deptData) {
    console.error('PDF parsing failed');
    process.exit(2);
  }

  const { jsonTree, total } = buildTree(deptData);

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log(`Departments parsed: ${deptData.size}`);
  console.log(`General Fund total: $${Math.round(total).toLocaleString()}\n`);
  console.log('Department                              Adopted ($)    Actual ($)');
  console.log('─────────────────────────────────────────────────────────────────────');
  for (const node of jsonTree) {
    const { adopted, actual } = deptData.get(node.n);
    const adoptedStr = adopted ? Math.round(adopted).toLocaleString() : '—';
    const actualStr = actual ? Math.round(actual).toLocaleString() : '—';
    console.log(`${node.n.padEnd(38)}${adoptedStr.padStart(14)}  ${actualStr.padStart(14)}`);
  }
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`${'TOTAL'.padEnd(38)}${Math.round(total).toLocaleString().padStart(14)}\n`);

  // Sanity check — per-dept extraction totals ~$192M (named GF depts only).
  // Official GF is $246.9M but includes $26M support-services, $18.4M transfers,
  // and ~$10M non-departmental overhead that don't appear in dept Budget Summary pages.
  const SANITY_MIN = 150_000_000;
  const SANITY_MAX = 280_000_000;
  if (total < SANITY_MIN || total > SANITY_MAX) {
    console.error(`SANITY FAIL: Total $${Math.round(total).toLocaleString()} is outside $150M–$280M range`);
    process.exit(2);
  }
  console.log(`Sanity check: PASS ($${Math.round(total).toLocaleString()} in $150M–$280M range)\n`);

  if (dryRun) {
    console.log('(dry-run — skipping DB writes)');
    return;
  }

  // ── Upsert data_source ────────────────────────────────────────────────────
  const ds = await upsertDataSource(supabase, muni.id);
  console.log(`data_source: ${ds.id}`);

  // ── Clear prior rows ──────────────────────────────────────────────────────
  const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FISCAL_YEAR);
  const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muni.id)
    .eq('fiscal_year', FISCAL_YEAR)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);
  if (delErr1) throw new Error(`Delete (by data_source_id) failed: ${delErr1.message}`);
  if (delErr2) throw new Error(`Delete (orphaned) failed: ${delErr2.message}`);

  // ── Call treasury_sync_budget_tree RPC ────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: FISCAL_YEAR,
    p_dataset_type: 'operating',
    p_total: total,
    p_tree: jsonTree,
    p_row_count: deptData.size,
    p_triggered_by: 'bulk_load',
  });

  if (rpcErr) { throw new Error(`RPC error: ${rpcErr.message}`); }
  if (rpcResult?.error) { throw new Error(`RPC returned error: ${rpcResult.error}`); }

  const inserted = rpcResult?.rows_inserted ?? deptData.size;
  console.log(`Loaded ${inserted} rows for FY${FISCAL_YEAR} (total $${Math.round(total).toLocaleString()})`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
