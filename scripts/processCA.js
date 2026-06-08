#!/usr/bin/env node
/**
 * California LAO General Fund Budget Loader
 *
 * Extracts department-level General Fund budget data from the LAO
 * Historical_Expenditures.xlsx via extractCA.py (openpyxl), builds a
 * 2-level DOF Agency -> Department tree, and loads via treasury_sync_budget_tree RPC.
 *
 * Amount scale: LAO Excel amounts are in THOUSANDS — multiplied by 1000 here.
 * GF totals: FY2026=$228.4B, FY2025=$233.6B, FY2024=$205.7B, FY2023=$195.2B, FY2022=$216.8B
 *
 * 3-level tree shape (Phase 35):
 *   [{ n: 'Health and Human Services', a: 87_139_490_000, c: [
 *       { n: 'Dept of Health Care Services', a: 50_000_000_000, c: [
 *           { n: 'Medi-Cal', a: 40_000_000_000,
 *             i: [{ d: 'Medi-Cal', a: 40_000_000_000, aa: null, f: null, e: null }] }
 *       ]},
 *       ...
 *   ]}, ...]
 *
 * Usage:
 *   node scripts/processCA.js                    # load FY2022-2026
 *   node scripts/processCA.js --dry-run          # parse + sanity check, no DB writes
 *   node scripts/processCA.js --fy 2026          # load single year
 *   node scripts/processCA.js --dry-run --fy 2026
 *
 * Requires: Python 3 + openpyxl (pre-installed, confirmed in RESEARCH.md)
 * Requires: California municipality seeded via seedCAState.js (Plan 01)
 *
 * Security (T-33-07): script path hardcoded, no user input reaches shell command
 * Security (T-33-08): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-33-04/05/06): sanity band $150B-$300B; halt on scale mismatch
 */

import { execSync }                    from 'node:child_process';
import { createClient }                from '@supabase/supabase-js';
import { parseArgs }                   from 'node:util';
import { existsSync, readFileSync }    from 'node:fs';
import path                            from 'node:path';
import { fileURLToPath }               from 'node:url';
import { resolve, dirname }            from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Env loading ───────────────────────────────────────────────────────────────
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

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Sanity band (T-33-04/05/06) ───────────────────────────────────────────────
// CA GF: FY2024-25=$233.6B, FY2025-26=$228.4B — allow $150B-$300B
// If total < SANITY_MIN: amounts not multiplied by 1000 (scale error)
// If total > SANITY_MAX: all-funds loaded instead of General Fund only
const SANITY_MIN = 150_000_000_000;   // $150B
const SANITY_MAX = 300_000_000_000;   // $300B

// ── Level columns for N-level tree (D-02) ─────────────────────────────────────
// Order determines tree depth: index 0 = root, last index = leaf.
// Add a 4th entry here if a future data source has a 4th level — zero code changes needed.
const LEVEL_COLS = ['dof_agency', 'department', 'function'];

// ── Resolve main repo root (worktree-safe) ────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/California/Historical_Expenditures.xlsx live in the main working tree.
// Fall back to the main repo root via git rev-parse --git-common-dir when needed.
function resolveMainRoot() {
  // Check if docs/California exists directly under ROOT (standalone checkout)
  const candidate = path.join(ROOT, 'docs', 'California');
  if (existsSync(candidate)) return ROOT;

  // Worktree: resolve via git-common-dir to find main repo root
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitCommonDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'California');
    if (existsSync(mainCandidate)) return mainRoot;
  } catch (_) { /* not in git repo or no main worktree */ }

  return ROOT;
}

// ── Run Python extractor, return parsed JSON rows ─────────────────────────────
// Security (T-33-07): pyScript is a hardcoded path constant; no user input
// reaches the shell command. maxBuffer 8MB cap.
function extractExcel(fiscalYears, dryRun = false) {
  const pyScript = path.join(ROOT, 'scripts', 'extractCA.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const fyArgs = fiscalYears.map(fy => `--fy ${fy}`).join(' ');
  const dryFlag = dryRun ? ' --dry-run' : '';
  const mainRoot = resolveMainRoot();

  if (dryRun) {
    // Dry-run: Python writes FY summaries to stderr; let them flow through so
    // the operator can see them. No JSON to parse; return empty.
    try {
      execSync(`${pythonBin} "${pyScript}" ${fyArgs}${dryFlag}`, {
        cwd: mainRoot,
        maxBuffer: 8 * 1024 * 1024,
        encoding: 'utf8',
      });
    } catch (err) {
      console.error('Python extractor failed:');
      if (err.stderr) console.error(err.stderr);
      process.exit(3);
    }
    return [];
  }

  // Non-dry-run: capture stderr so Python errors are surfaced clearly on failure.
  let raw;
  try {
    raw = execSync(`${pythonBin} "${pyScript}" ${fyArgs}${dryFlag}`, {
      cwd: mainRoot,           // run from main repo root so XLSX_PATH resolves
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],  // capture stderr for clean error surfacing
    });
  } catch (err) {
    console.error('Python extractor failed:');
    if (err.stderr) console.error(err.stderr);
    if (err.stdout) console.error('stdout:', err.stdout);
    process.exit(3);
  }
  return JSON.parse(raw);
}

// ── Build N-level tree (data-driven depth) ────────────────────────────────────
// Replaces the former 2-level buildCATree. Depth is determined by levelCols length, not hardcoded.
// D-02: N-level, data-driven — adding a 4th column requires zero code changes.
// D-05: rows where the current level's column is empty/null collapse as line items
//        at the nearest complete parent level (no synthetic "General" node invented).
// A2 VERDICT: ACCEPTED — treasury_sync_budget_tree accepts mixed { n, a, c, i } nodes.
// NOTE: LAO amounts are in THOUSANDS — multiply by 1000 for absolute dollars (Pitfall 1)

/**
 * @param {Array<Object>} rows - flat rows from extractCA.py
 * @param {string[]} levelCols - ordered column names, e.g. ['dof_agency','department','function']
 * @returns {Array} N-level tree in treasury_sync_budget_tree shape
 */
function buildNLevelTree(rows, levelCols) {
  const amtDollars = r => (r.amount_thousands || 0) * 1000;  // CRITICAL: x1000

  function recurse(rows, levelIdx) {
    const col = levelCols[levelIdx];
    const isLastLevel = levelIdx === levelCols.length - 1;

    const grouped = new Map(); // key -> { sum, rows }
    const collapseItems = []; // rows where this level's col is null/blank (D-05)

    for (const row of rows) {
      const key = (row[col] ?? '').toString().trim();
      if (!key) {
        // D-05 (A2 ACCEPTED): collapse to line item at current level's parent node.
        // Use the parent-level column value as the line item label.
        const label = row[levelCols[levelIdx - 1]] || 'Unknown';
        collapseItems.push({ d: label, a: amtDollars(row), aa: null, f: null, e: null });
        continue;
      }
      if (!grouped.has(key)) grouped.set(key, { sum: 0, rows: [] });
      grouped.get(key).sum += amtDollars(row);
      grouped.get(key).rows.push(row);
    }

    const nodes = [];
    for (const [key, g] of grouped) {
      if (isLastLevel) {
        // Leaf level: each group key becomes a leaf node with line items
        const items = g.rows.map(r => ({ d: key, a: amtDollars(r), aa: null, f: null, e: null }));
        nodes.push({ n: key, a: g.sum, i: items });
      } else {
        // Internal level: recurse into children; collapseItems from deeper levels
        // are handled via the mixed-node emit (A2 ACCEPTED).
        const { nodes: children, collapseItems: deepCollapse } = recurse(g.rows, levelIdx + 1);
        if (children.length > 0 && deepCollapse.length > 0) {
          // Mixed node: dept has both function children AND null-function collapsed items
          nodes.push({ n: key, a: g.sum, c: children, i: deepCollapse });
        } else if (children.length > 0) {
          nodes.push({ n: key, a: g.sum, c: children });
        } else {
          // All rows at this group collapsed — emit as leaf with items
          nodes.push({ n: key, a: g.sum, i: deepCollapse });
        }
      }
    }

    nodes.sort((a, b) => b.a - a.a);
    return { nodes, collapseItems };
  }

  const { nodes } = recurse(rows, 0);
  return nodes;
}

// ── Ensure California municipality exists; return its id ─────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'California')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  California, CA municipality not found — run seedCAState.js first');
  process.exit(2);
}

// ── Look up the single canonical data_source seeded by seedCAState.js ─────────
async function getDataSource() {
  const { data: sources, error } = await supabase.rpc('treasury_list_source_ids');
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  const ds = (sources || []).find(s => s.name === 'California General Fund Operating Budget');
  if (!ds) {
    console.error('Data source "California General Fund Operating Budget" not found.');
    console.error('Run seedCAState.js first.');
    process.exit(1);
  }
  return ds;
}

// ── Load one fiscal year into DB ──────────────────────────────────────────────
async function loadFiscalYear(ds, fiscalYear, tree, total, rowCount) {
  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
  return true;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      fy:        { type: 'string', multiple: true },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const fiscalYears = opts.fy ? opts.fy.map(Number) : [2022, 2023, 2024, 2025, 2026];

  console.log(`CA State Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`Fiscal years: ${fiscalYears.join(', ')}`);

  let muniId = null;
  let ds = null;
  if (!dryRun) {
    console.log('\nLooking up municipality and data_source...');
    muniId = await ensureMunicipality();
    ds = await getDataSource();
    console.log(`  Data source: ${ds.name} (${ds.id})`);
  }

  console.log('\nExtracting from Excel...');
  const allRows = extractExcel(fiscalYears, dryRun);

  if (dryRun) {
    console.log('(dry-run: Python printed FY summaries above via stderr)');
    console.log('\nDone (dry-run).');
    return;
  }

  // Group rows by fiscal year
  const fyMap = new Map();
  for (const row of allRows) {
    if (!fyMap.has(row.fiscal_year)) fyMap.set(row.fiscal_year, []);
    fyMap.get(row.fiscal_year).push(row);
  }

  for (const fiscalYear of fiscalYears) {
    const fyRows = fyMap.get(fiscalYear) || [];
    if (!fyRows.length) {
      console.warn(`\n  FY${fiscalYear}: no rows found — skipping`);
      continue;
    }

    const tree = buildNLevelTree(fyRows, LEVEL_COLS);
    const total = tree.reduce((sum, n) => sum + n.a, 0);
    const agencyCount = tree.length;

    console.log(`\n  FY${fiscalYear} GF Operating — $${total.toLocaleString()} total (${agencyCount} agencies)`);
    for (const n of tree.slice(0, 5)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (agencyCount > 5) console.log(`    … +${agencyCount - 5} more`);

    // Sanity check (T-33-04/05/06)
    if (total < SANITY_MIN || total > SANITY_MAX) {
      console.error(`\n  SCALE MISMATCH: FY${fiscalYear} total $${total.toLocaleString()} outside [$${(SANITY_MIN/1e9).toFixed(0)}B, $${(SANITY_MAX/1e9).toFixed(0)}B].`);
      console.error('  Likely cause: forgot to multiply LAO thousands by 1000 (check buildNLevelTree),');
      console.error('  or wrong Fund filter (all-funds ~$495B would exceed $300B upper bound).');
      process.exit(3);
    }

    await loadFiscalYear(ds, fiscalYear, tree, total, fyRows.length);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
