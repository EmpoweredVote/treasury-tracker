/**
 * Load the Nevada ACFR General Fund series (Reno + Washoe County) into TT.
 *
 * NO SHEBANG — tests import `sourceNameFor` and `perCapita`.
 *
 * Usage:
 *   node scripts/loadNevadaAcfrs.mjs --dir _acfr-work/nv/extracted --dry-run
 *   node scripts/loadNevadaAcfrs.mjs --dir _acfr-work/nv/extracted --commit
 *   node scripts/loadNevadaAcfrs.mjs --dir <d> --entity reno --fy 2025 --dry-run
 *
 * ⭐ NEVADA'S FIRST LOCAL ENTITIES. `NV` previously held only its state node,
 * so this opens the `nv-local-acfr-gf` family rather than extending one.
 *
 * ── TWO DELIBERATE DIVERGENCES FROM THE COLORADO/KANSAS TEMPLATE ───────────
 *
 * 1. `source_url` IS THE DOCUMENT, NOT THE LANDING PAGE. `loadCoKsAcfrs.mjs`
 *    stamps `SOURCE_PAGE[entity]` on every year, so a reader clicking through
 *    from FY2023 arrives at an index and has to find the year themselves.
 *    #381 and #385 settled that: "a landing page is not a weaker citation, it
 *    is a wrong one". The URL stamped here is the one that SERVED THE BYTES,
 *    read from `docs/<entity>/manifest.json` — never rebuilt from a naming
 *    rule, because Reno's filenames are `2017 CAFR.pdf`, `FY 2018 FINAL
 *    CAFR.pdf` and `City of Reno ACFR June 30 2025 FINAL.pdf` and no rule
 *    should be asked to know that.
 *
 * 2. `source_date` IS THE PERIOD END, NOT THE LOAD DATE. Measured in the
 *    database before choosing:
 *
 *        NC  Asheville FY2021 -> 2021-06-30 ... FY2025 -> 2025-06-30
 *        CO  Boulder County FY2021..FY2025 -> 2026-08-30 (all five)
 *
 *    The chip renders this as "as of", so the load date asserts a currency an
 *    audited annual report does not have. North Carolina's four entities share
 *    Reno's exact June-30 calendar, which makes it the closest precedent as
 *    well as the honest reading.
 *
 * ── THE CHECK THAT CATCHES A WRONG `units` ─────────────────────────────────
 *
 * ⚠⚠ `tie_delta` CANNOT SEE A SCALING ERROR. It compares a computed sum with a
 * printed total read through the SAME multiplier, so it is 0 whether or not
 * the scaling is right, and a thousands-vs-dollars slip ships a silently
 * 1000x-wrong row. Both Nevada entities print whole dollars, but that is a
 * fact about these documents and not a law, so per-capita plausibility is
 * asserted per row: Reno lands near $1,093/capita and Washoe near
 * $1,033/capita, where a 1000x slip lands above $1,000,000/capita.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { NV_ENTITIES, nvEntityByKey } from './data/nvAcfrEntities.mjs';
import { NV_WINDOWS } from './data/nvAcfrSources.mjs';
import { extractedPath } from './extractNvAll.mjs';
import { manifestPath } from './fetchNevadaAcfrs.mjs';
import { ensureMunicipality } from './lib/ensureMunicipality.mjs';

export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
export const FUND_SCOPE = 'general_fund';

/** Per-capita sanity band. Below is implausible for a GF; above is a parse blow-up. */
export const PER_CAPITA_MIN = 100;
export const PER_CAPITA_MAX = 20000;

/** Reproduces the family label shape used by every other ACFR GF load. */
export function sourceNameFor(entityName, datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${entityName} ACFR — General Fund ${face} (FY${fiscalYear} actual, GAAP basis)`;
}

export function perCapita(amount, population) {
  return population > 0 ? amount / population : Infinity;
}

/** `{n,a,c}` shape the RPC expects, from the extractor's own tree. */
function toRpcTree(tree) {
  return (tree.c || []).map((r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map((k) => ({ n: k.n, a: k.a })) }
    : { n: r.n, a: r.a }));
}

export function readExtracted(dir, entityKey, fiscalYear, datasetType) {
  const mode = datasetType === 'operating' ? 'operating' : 'revenue';
  const p = extractedPath(dir, entityKey, fiscalYear, mode);
  if (!existsSync(p)) return null;
  const data = JSON.parse(readFileSync(p, 'utf8'));
  // ⚠ Belt and braces: the extractor exits non-zero on a bad tie and the batch
  // re-checks, but a loader that trusted a cached file is one refactor away
  // from writing a mis-parse.
  if (data.tie_delta !== 0) throw new Error(`${p}: tie_delta ${data.tie_delta}`);
  if (Number(data.fiscal_year) !== Number(fiscalYear)) {
    throw new Error(`${p}: document reports FY${data.fiscal_year}, expected FY${fiscalYear}`);
  }
  return data;
}

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      commit: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.dir) {
    console.error('Usage: node scripts/loadNevadaAcfrs.mjs --dir <extracted> [--commit|--dry-run]');
    process.exitCode = 1;
    return;
  }
  const dryRun = !values.commit;

  const entities = values.entity
    ? [nvEntityByKey(values.entity)].filter(Boolean)
    : [...NV_ENTITIES];
  if (!entities.length) {
    console.error(`No such entity: ${values.entity}`);
    process.exitCode = 1;
    return;
  }

  // ── Gather and check every filing BEFORE touching the database ───────────
  const filings = [];
  const problems = [];
  for (const ent of entities) {
    const manifest = existsSync(manifestPath(ent.key))
      ? JSON.parse(readFileSync(manifestPath(ent.key), 'utf8'))
      : null;
    if (!manifest) {
      problems.push(`${ent.name}: docs/.../manifest.json missing — run fetchNevadaAcfrs.mjs first; `
        + 'refusing to load an unattributed row');
      continue;
    }
    for (const fy of NV_WINDOWS[ent.key] || []) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const entry = manifest[fy] || manifest[String(fy)];
      if (!entry?.url) { problems.push(`${ent.name} FY${fy}: no source URL in the manifest`); continue; }
      const revenue = readExtracted(values.dir, ent.key, fy, 'revenue');
      const operating = readExtracted(values.dir, ent.key, fy, 'operating');
      if (!revenue || !operating) { problems.push(`${ent.name} FY${fy}: extraction missing in ${values.dir}`); continue; }
      for (const [mode, ex] of [['revenue', revenue], ['operating', operating]]) {
        const pc = perCapita(ex.tree.a, ent.population);
        if (!(pc >= PER_CAPITA_MIN && pc <= PER_CAPITA_MAX)) {
          problems.push(`${ent.name} FY${fy} ${mode}: $${Math.round(pc).toLocaleString()}/capita is outside `
            + `$${PER_CAPITA_MIN}-$${PER_CAPITA_MAX} — check \`units\``);
        }
      }
      filings.push({ entity: ent, fiscalYear: fy, url: entry.url, revenue, operating });
    }
  }
  if (problems.length) {
    console.error(`❌ REFUSING — ${problems.length} problem(s) before any write:`);
    for (const p of problems) console.error(`   ${p}`);
    process.exitCode = 1;
    return;
  }
  if (!filings.length) {
    console.error('❌ REFUSING: no filings matched.');
    process.exitCode = 1;
    return;
  }

  console.log(`=== Nevada ACFR General Fund load${dryRun ? ' [DRY RUN]' : ''} — ${filings.length} filing(s)`);
  for (const f of filings) {
    const r = perCapita(f.revenue.tree.a, f.entity.population);
    console.log(`  ${f.entity.name} FY${f.fiscalYear}  rev ${f.revenue.tree.a.toLocaleString().padStart(13)}`
      + `  exp ${f.operating.tree.a.toLocaleString().padStart(13)}  $${Math.round(r).toLocaleString()}/capita`);
  }
  if (dryRun) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit.');
    return;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exitCode = 1; return; }
  const db = createClient(url, key);

  // Parent counties first, so a child can point at a real id.
  const order = [...entities].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
  const ids = new Map();
  for (const ent of order) {
    const { id } = await ensureMunicipality(db, {
      name: ent.name, state: ent.state, entityType: ent.entityType, population: ent.population,
    });
    ids.set(ent.key, id);
    console.log(`  entity ${ent.name}, ${ent.state} (${ent.entityType}) -> ${id}`);
  }
  for (const ent of entities) {
    if (!ent.parentCountyKey || !ids.has(ent.parentCountyKey)) continue;
    const { error } = await db.schema('treasury').from('municipalities')
      .update({ county_id: ids.get(ent.parentCountyKey) }).eq('id', ids.get(ent.key));
    if (error) throw new Error(`county_id error (${ent.name}): ${error.message}`);
  }

  let written = 0; let conflicts = 0; let categories = 0;
  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
    // ⚠ The period end, not today — see the header.
    const sourceDate = `${f.fiscalYear}-06-30`;
    for (const [datasetType, extracted] of [['operating', f.operating], ['revenue', f.revenue]]) {
      const tree = toRpcTree(extracted.tree);
      const dataSourceName = sourceNameFor(f.entity.name, datasetType, f.fiscalYear);

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
        p_tree: tree,
        p_row_count: tree.length,
        p_data_source_name: dataSourceName,
        p_source_url: f.url,
        p_source_date: sourceDate,
        p_fiscal_year_start_month: f.entity.fiscalYearStartMonth,
        p_fund_scope: FUND_SCOPE,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
      // error. Counting attempts is not counting writes.
      if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success status (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${JSON.stringify(data)}`);
      }
      written += 1;
      categories += tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
    }
  }

  console.log(`\nWrote ${written} budget rows over ${categories.toLocaleString()} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exitCode = 1;
    return;
  }
  console.log('\nNow run, in this order — they are SEPARATE WRITERS and a reload resets axes to `unknown`:');
  console.log('  node scripts/classifyFundScope.mjs');
  console.log('  node scripts/stampBudgetAxes.mjs   # basis / reporting_entity');
  console.log('  node scripts/stampAuditGrade.mjs   # audited_gaap — 11/11 opinions read clean');
}

// ⚠ `process.exitCode`, never `process.exit()` — it races a keep-alive socket.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('loadNevadaAcfrs.mjs')) {
  main().catch((e) => { console.error(`\n❌ ${e.message}`); process.exitCode = 1; });
}
