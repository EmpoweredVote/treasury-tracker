/**
 * Load the South Dakota ACFR General Fund series into TT (Knight session 8).
 *
 * NO SHEBANG — tests import `sourceNameFor` and `toBudgetTree3`.
 *
 * Usage:
 *   node scripts/loadSdAcfrs.mjs --dir _acfr-work/s8/extracted --dry-run
 *   node scripts/loadSdAcfrs.mjs --dir _acfr-work/s8/extracted --commit
 *
 * ── ⚠⚠ THIS FAMILY IS NOT GAAP ─────────────────────────────────────────────
 *
 * Brown County reports on the MODIFIED CASH BASIS. Its rows carry
 * `audit_grade = audited_ocboa` (added in this session — see
 * scripts/lib/budgetAxes.mjs) and their data_source label says so in words,
 * because `audit_grade` is not yet surfaced by ev-accounts and the label is
 * currently the only place a reader can see it:
 *
 *     Brown County ACFR — General Fund Revenue by Source (FY2024 actual, modified cash basis)
 *
 * ⚠ Contrast the GAAP families, whose labels read `(FY2024 actual, GAAP basis)`.
 * The auditGradeRegistry match is anchored on this difference, so an OCBOA entry
 * can never claim a GAAP source.
 *
 * ── ⚠⚠ THE PUBLISHED TREE IS THREE LEVELS AND THE RPC HOLDS TWO ────────────
 *
 * Brown County prints `General Government:` -> `Legislative:` -> `Board of
 * County Commissioners`. The RPC's contract (scripts/lib/acfrGfLoad.mjs
 * `toBudgetTree`, and every loader before it) is a TWO-level tree: a category
 * `{n, a}` with drill-down items `i:[{d, a, ...}]`. Something has to give.
 *
 * `toBudgetTree3` keeps the TOP function as the category and flattens every
 * DESCENDANT LEAF into its items:
 *
 *     General Government  ->  Board of County Commissioners, Elections,
 *                             Judicial System, Auditor, Treasurer,
 *                             State's Attorney, ... (15 real spending lines)
 *
 * The middle tier (`Legislative`, `Financial Administration`, `Legal Services`,
 * `Other General Government`) is the only thing lost, and it is a heading that
 * carries no figure of its own. The alternative — keeping the middle tier as
 * the items — would discard the actual spending lines, which are what a reader
 * came for.
 *
 * ⚠ NOTHING IS INVENTED AND NOTHING IS DOUBLE-COUNTED: the items are exactly
 * the tree's leaves, so they still sum to the category, and the categories
 * still sum to the printed total. `assertProjection` below enforces both
 * against the extractor's own totals and refuses the load on any mismatch.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { SD_ENTITIES, SD_WINDOWS } from './data/sdKnightEntities.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';

export const BASIS_VALUE = 'actual';        // actuals, not an appropriation
export const DERIVATION = 'published';
export const FUND_SCOPE = 'general_fund';

/**
 * ⚠ The basis LABEL is the entity's, not a constant. Aberdeen (GAAP) and Brown
 * County (modified cash) sit in the same state family and must not share it.
 */
export function sourceNameFor(entity, datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${entity.name} ACFR — General Fund ${face} `
    + `(FY${fiscalYear} actual, ${entity.basisLabel})`;
}

/** Every LEAF under `node`, in printed order. A leaf is a node with no children. */
function leavesOf(node) {
  if (!Array.isArray(node.c) || node.c.length === 0) return [node];
  return node.c.flatMap(leavesOf);
}

/**
 * Project the extractor's (possibly 3-level) tree onto the RPC's 2-level shape.
 * Top-level nodes become categories; all their descendant leaves become items.
 */
export function toBudgetTree3(extractorTree) {
  const roots = extractorTree?.c || [];
  const mapped = roots.map((root) => ({
    n: root.n,
    a: root.a,
    i: leavesOf(root).map((lf) => ({ d: lf.n, a: lf.a, aa: null, f: null, e: null })),
  }));
  return {
    tree: mapped,
    total: mapped.reduce((s, n) => s + n.a, 0),
    rowCount: mapped.reduce((s, n) => s + n.i.length, 0),
  };
}

/**
 * ⚠⚠ The projection is ARITHMETIC, so it is checked arithmetically. A flatten
 * that dropped or duplicated a leaf would still produce a plausible-looking
 * tree; only the sums catch it. Both directions are asserted:
 *   - every category's items sum to that category
 *   - the categories sum to the extractor's own verified total
 */
export function assertProjection(projected, extracted, label) {
  for (const cat of projected.tree) {
    const itemSum = cat.i.reduce((s, it) => s + it.a, 0);
    if (itemSum !== cat.a) {
      throw new Error(`${label}: category "${cat.n}" is ${cat.a} but its ${cat.i.length} `
        + `items sum to ${itemSum} (delta ${itemSum - cat.a})`);
    }
  }
  if (projected.total !== extracted.tree.a) {
    throw new Error(`${label}: projected total ${projected.total} != extracted `
      + `${extracted.tree.a} (delta ${projected.total - extracted.tree.a})`);
  }
}

export function readExtracted(dir, entityKey, fiscalYear, datasetType) {
  const path = join(dir, `${entityKey}-${fiscalYear}-${datasetType}.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  // ⚠ Belt and braces. The extractor exits non-zero on a bad tie, but a loader
  // that trusted a cached file blindly is one refactor away from a mis-parse.
  //
  // ⚠⚠ CHECK THE AUTHORITATIVE FIELD. For a cents-basis issuer the exact tie is
  // `tie_delta_cents`; the dollar `tie_delta` is a rounding residue of OUR
  // conversion (sum-of-rounded-leaves vs rounded-printed-total) and is expected
  // to be a few dollars. Asserting the dollar field here would reject a
  // perfectly verified extraction — and asserting NEITHER would let a real
  // mis-parse through, so the cents field is required when it is present.
  if (data.money_domain === 'cents_verified_dollars_emitted') {
    if (data.tie_delta_cents !== 0) {
      throw new Error(`${path}: tie_delta_cents ${data.tie_delta_cents}`);
    }
    const residue = Math.abs(data.dollar_rounding_residue ?? 0);
    // A rounding residue is bounded by half a dollar per leaf. Anything larger
    // is not rounding.
    if (residue > 50) throw new Error(`${path}: dollar residue ${residue} is too large to be rounding`);
  } else if (data.tie_delta !== 0) {
    throw new Error(`${path}: tie_delta ${data.tie_delta}`);
  }
  if (Number(data.fiscal_year) !== Number(fiscalYear)) {
    throw new Error(`${path}: document reports FY${data.fiscal_year}, expected FY${fiscalYear}`);
  }
  if (!data.tree || !Array.isArray(data.tree.c) || data.tree.c.length === 0) {
    throw new Error(`${path}: empty tree`);
  }
  return data;
}

/** Per-year source URL, read from the hunt manifest — never a single family page. */
function manifestUrls(dir) {
  const p = join(dir, '..', 'manifest.json');
  if (!existsSync(p)) {
    console.error(`ERROR: ${p} missing. Refusing to load without the URL that served each file.`);
    process.exit(2);
  }
  const map = new Map();
  for (const row of JSON.parse(readFileSync(p, 'utf8'))) {
    map.set(`${row.entity}-${row.fiscal_year}`, row.url);
  }
  return map;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/s8/extracted' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      commit: { type: 'boolean', default: false },
    },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    process.exit(1);
  }
  const entities = values.entity
    ? SD_ENTITIES.filter((e) => e.key === values.entity)
    : SD_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  const urls = manifestUrls(values.dir);
  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const filings = [];
  const gaps = [];
  const censusNotes = [];
  let checks = 0;
  let bad = 0;

  for (const ent of entities) {
    for (const fy of SD_WINDOWS[ent.key]) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const stem = `${ent.key}-${fy}`;
      const revenue = readExtracted(values.dir, ent.key, fy, 'revenue');
      const operating = readExtracted(values.dir, ent.key, fy, 'operating');
      if (!revenue || !operating) { gaps.push(`${stem}: extraction missing`); continue; }
      if (!urls.has(stem)) { gaps.push(`${stem}: no source URL in the manifest`); continue; }
      checks += 2;                                   // both ties, counted

      const pr = toBudgetTree3(revenue.tree);
      const po = toBudgetTree3(operating.tree);
      assertProjection(pr, revenue, `${stem} revenue`);
      assertProjection(po, operating, `${stem} operating`);
      checks += 2;                                   // both projections, counted

      // ⚠ censusGuard returns {ok:true} when it has NO evidence — silence is
      // not confirmation, so an uncovered year is reported, never counted.
      const guard = censusGuard(ent.censusName, ent.state, ent.fiscalYearStartMonth, fy);
      if (guard.error) {
        console.error(`      CENSUS CONTRADICTION: ${guard.error}`);
        bad += 1;
      } else if (guard.unknown) {
        censusNotes.push(`${ent.name} FY${fy}: UNCOVERED`);
      } else {
        checks += 1;
      }
      filings.push({ entity: ent, fiscalYear: fy, revenue, operating, pr, po, url: urls.get(stem) });
    }
  }

  for (const f of filings) {
    console.log(`  ${f.entity.name} FY${f.fiscalYear}  rev ${usd(f.revenue.tree.a)}   `
      + `exp ${usd(f.operating.tree.a)}   `
      + `(${f.pr.rowCount}+${f.po.rowCount} items)  [${f.entity.basisLabel}]`);
  }
  if (gaps.length) {
    console.log(`\nGAPS (${gaps.length}) — reported, never written as $0:`);
    for (const g of gaps) console.log(`  - ${g}`);
  }
  if (censusNotes.length) {
    console.log(`\nFAC census UNCOVERED for ${censusNotes.length} entity-years (never counted):`);
    for (const n of censusNotes) console.log(`  - ${n}`);
  }

  console.log(`\nChecks: ${checks - bad}/${checks} pass across ${filings.length} entity-years.`);
  // ⚠⚠ A gate that measured nothing must FAIL, not pass.
  if (checks === 0 || filings.length === 0) {
    console.error('REFUSING: zero checks ran. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  if (bad > 0) {
    console.error(`REFUSING: ${bad} check failures.`);
    process.exit(1);
  }
  if (!values.commit) {
    console.log('\nDry run — nothing written.');
    return filings;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  const ids = new Map();
  for (const ent of entities) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: ent.state,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name}, ${ent.state} (${ent.entityType}) -> ${data}`);
  }

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0; let conflicts = 0; let categories = 0;
  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
    for (const [datasetType, extracted, projected] of
      [['operating', f.operating, f.po], ['revenue', f.revenue, f.pr]]) {
      const dataSourceName = sourceNameFor(f.entity, datasetType, f.fiscalYear);

      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', f.fiscalYear)
        .eq('dataset_type', datasetType)
        .eq('fund_scope', FUND_SCOPE)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').includes('ACFR — General Fund')) {
        conflicts += 1;
        console.log(`  SKIP ${f.entity.name} FY${f.fiscalYear} ${datasetType} — "${existing[0].data_source}" preserved`);
        continue;
      }

      const { data, error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: f.fiscalYear,
        p_dataset_type: datasetType,
        p_total: extracted.tree.a,
        p_tree: projected.tree,
        p_row_count: projected.rowCount,
        p_data_source_name: dataSourceName,
        p_source_url: f.url,
        p_source_date: sourceDate,
        p_fiscal_year_start_month: f.entity.fiscalYearStartMonth,
        p_fund_scope: FUND_SCOPE,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
      // error. Counting attempts is not counting writes (session 4).
      if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success status (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${JSON.stringify(data)}`);
      }
      written += 1;
      categories += projected.tree.length;
    }
  }
  console.log(`\nWrote ${written} budget rows over ${categories} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  console.log('\nNow run, in this order:');
  console.log('  node scripts/stampBudgetAxes.mjs   # fund_scope / basis / reporting_entity');
  console.log('  node scripts/stampAuditGrade.mjs   # audit_grade — audited_ocboa here');
  console.log('  npm run verify:frozen');
  console.log('  npm run register:rows -- --milestone knight-s8-sd --match "Brown County ACFR — General Fund"');
  console.log('  node scripts/syncFrozenInvariantState.mjs');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadSdAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
