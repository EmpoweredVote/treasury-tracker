/**
 * Load the Colorado + Kansas ACFR General Fund series into TT (Knight 7b).
 *
 * NO SHEBANG — tests import `sourceNameFor`.
 *
 * Usage:
 *   node scripts/loadCoKsAcfrs.mjs --dir _acfr-work/coks/extracted --dry-run
 *   node scripts/loadCoKsAcfrs.mjs --dir _acfr-work/coks/extracted --commit
 *   node scripts/loadCoKsAcfrs.mjs --entity wichita --fy 2024 --dry-run
 *
 * ── TWO FAMILIES, AND ONE OF THEM IS AN EXTENSION ──────────────────────────
 *
 * Colorado already has locals in TT — Colorado Springs and El Paso County,
 * v2.29 — under `co-local-acfr-gf`. Boulder and Boulder County EXTEND that
 * family rather than opening a parallel one, which is why their source labels
 * reproduce its existing shape exactly:
 *
 *     El Paso County ACFR — General Fund Revenue by Source (FY2005 actual, GAAP basis)
 *     City of Boulder ACFR — General Fund Revenue by Source (FY2022 actual, GAAP basis)
 *
 * Kansas has none, so Wichita and Sedgwick County found `ks-local-acfr-gf`.
 *
 * ⚠ The existing 64 Colorado rows carry `audit_grade = unknown` — Colorado has
 * never had an `auditGradeRegistry` entry. This load does NOT grade them: an
 * opinion has not been read for Colorado Springs or El Paso County, and §3.5
 * requires evidence per document rather than an assumption that an ACFR is
 * audited. The new entries are therefore anchored to the four entities whose
 * opinions THIS session verified. Grading the older two is a filed follow-up,
 * and a cheap one — the same script that verified these four would do it.
 *
 * ── ⚠⚠ FOUR DOCUMENT GAPS, DECLARED RATHER THAN SILENT ─────────────────────
 *
 * Wichita FY2001 and FY2008 are image-only scans; Sedgwick County FY2005 is a
 * dead link in the county's own archive; Sedgwick County FY2019 has a custom
 * font encoding under which no number survives extraction. All four are
 * reported by scripts/extractCoKsAll.mjs and NONE is written as $0.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { CO_KS_ENTITIES, entityByKey } from './data/coKsKnightEntities.mjs';
import { CO_KS_WINDOWS, SOURCE_PAGE } from './data/coKsAcfrSources.mjs';
import { KNOWN_DOCUMENT_GAPS } from './extractCoKsAll.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';

export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
export const FUND_SCOPE = 'general_fund';

/**
 * ⚠ Reproduces the EXISTING `co-local-acfr-gf` label shape exactly, so the two
 * Boulder entities join that family instead of forming a lookalike beside it.
 */
export function sourceNameFor(entityName, datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${entityName} ACFR — General Fund ${face} (FY${fiscalYear} actual, GAAP basis)`;
}

/** `{n,a,c}` shape the RPC expects, from the extractor's own tree. */
function toRpcTree(tree) {
  return (tree.c || []).map((r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map((k) => ({ n: k.n, a: k.a })) }
    : { n: r.n, a: r.a }));
}

export function readExtracted(dir, entityKey, fiscalYear, datasetType) {
  const mode = datasetType === 'operating' ? 'operating' : 'revenue';
  const path = join(dir, `${entityKey}-${fiscalYear}-${mode}.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  // ⚠ Belt and braces. The extractor exits non-zero on a bad tie and
  // extractCoKsAll re-checks, but a loader that trusted a cached file blindly
  // would be one refactor away from writing a mis-parse.
  if (data.tie_delta !== 0) throw new Error(`${path}: tie_delta ${data.tie_delta}`);
  if (Number(data.fiscal_year) !== Number(fiscalYear)) {
    throw new Error(`${path}: document reports FY${data.fiscal_year}, expected FY${fiscalYear}`);
  }
  if (!data.tree || !Array.isArray(data.tree.c) || data.tree.c.length === 0) {
    throw new Error(`${path}: empty tree`);
  }
  return data;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/coks/extracted' },
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
    ? CO_KS_ENTITIES.filter((e) => e.key === values.entity)
    : CO_KS_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const filings = [];
  const gaps = [];
  const censusNotes = [];
  let checks = 0;
  let bad = 0;

  for (const ent of entities) {
    for (const fy of CO_KS_WINDOWS[ent.key]) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const stem = `${ent.key}-${fy}`;
      if (KNOWN_DOCUMENT_GAPS[stem]) { gaps.push(`${stem}: ${KNOWN_DOCUMENT_GAPS[stem]}`); continue; }
      const revenue = readExtracted(values.dir, ent.key, fy, 'revenue');
      const operating = readExtracted(values.dir, ent.key, fy, 'operating');
      if (!revenue || !operating) { gaps.push(`${stem}: extraction missing`); continue; }
      // Both sides tie by construction; count them so the gate cannot be vacuous.
      checks += 2;

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
      filings.push({ entity: ent, fiscalYear: fy, revenue, operating });
    }
  }

  for (const f of filings) {
    console.log(`  ${f.entity.name} FY${f.fiscalYear}  rev ${usd(f.revenue.tree.a)}   exp ${usd(f.operating.tree.a)}`
      + `   (page ${f.revenue.statement_page}/${f.operating.statement_page})`);
  }
  if (gaps.length) {
    console.log(`\nDOCUMENT GAPS (${gaps.length}) — reported, never written as $0:`);
    for (const g of gaps) console.log(`  - ${g}`);
  }
  if (censusNotes.length) {
    console.log(`\nFAC census UNCOVERED for ${censusNotes.length} entity-years (never counted as confirmed):`);
    for (const n of censusNotes.slice(0, 5)) console.log(`  - ${n}`);
    if (censusNotes.length > 5) console.log(`  ... and ${censusNotes.length - 5} more`);
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

  // Parent counties first, so a child can point at a real id.
  const order = [...entities].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
  const ids = new Map();
  for (const ent of order) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: ent.state,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name}, ${ent.state} (${ent.entityType}) -> ${data}`);
  }
  for (const ent of entities) {
    if (!ent.parentCountyKey || !ids.has(ent.parentCountyKey)) continue;
    const { error } = await db.schema('treasury').from('municipalities')
      .update({ county_id: ids.get(ent.parentCountyKey) }).eq('id', ids.get(ent.key));
    if (error) throw new Error(`county_id error (${ent.name}): ${error.message}`);
  }

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0; let conflicts = 0; let categories = 0;
  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
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
        p_source_url: SOURCE_PAGE[f.entity.key],
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
      categories += tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
    }
  }
  console.log(`\nWrote ${written} budget rows over ${categories.toLocaleString()} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  console.log('Now run:  npm run verify:frozen');
  console.log('     then npm run register:rows -- --milestone knight-s7b-co-ks --match "ACFR — General Fund"');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadCoKsAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
