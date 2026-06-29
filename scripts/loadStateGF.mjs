#!/usr/bin/env node
/**
 * State General Fund Loader — NASBO source (operating / spending-by-function)
 * ──────────────────────────────────────────────────────────────────────────
 * Phase 94 (SGFS-01). Source decision LOCKED by Chris 2026-06-27 (94-01-SPIKE.md):
 *   Hybrid — NASBO now (49 states), Minnesota kept as the ACFR gold-standard outlier,
 *   per-state ACFR upgrades for high-traffic states later.
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
          { name: 'Medicaid',                          total:  3_398_000_000 },
          { name: 'Transportation',                    total:  2_011_000_000 },
          { name: 'Corrections',                       total:  1_888_000_000 },
          { name: 'Public Assistance',                 total:          0       },
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

  // Find-or-create the NASBO operating data_source for this state (idempotent, P6).
  const srcName = `${st.name} General Fund Operating Budget`;
  const srcPayload = {
    name: srcName, api_type: 'nasbo-ser', dataset_type: 'operating',
    dataset_id: `${st.abbr.toLowerCase()}-gf-operating-nasbo`,
    base_url: 'https://www.nasbo.org/reports-data/state-expenditure-report',
    fiscal_years: Object.keys(st.operating).map(Number), municipality_id: muni.id,
  };
  const { data: existingDs } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muni.id).eq('api_type', 'nasbo-ser').eq('dataset_type', 'operating').maybeSingle();
  let ds;
  if (existingDs?.id) {
    const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existingDs.id).select().single();
    ds = data;
  } else {
    const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single();
    if (error) { console.error('  data_source insert failed:', error.message); process.exit(2); }
    ds = data;
  }

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
  await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  return true;
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, state: { type: 'string' }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run'];
  const stateFilter = opts.state ? opts.state.toUpperCase() : null;
  const fyFilter = opts.fy ? parseInt(opts.fy, 10) : null;
  console.log(`State GF Loader — NASBO (operating)${dryRun ? ' (dry-run)' : ''}\n`);
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
