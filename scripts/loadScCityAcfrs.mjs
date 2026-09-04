/**
 * Load the South Carolina city ACFR General Fund series into TT (wave 1).
 *
 * NO SHEBANG — tests import `sourceNameFor` and `sourcePrefixFor`.
 *
 * Usage:
 *   node scripts/extractScCitiesAll.mjs
 *   node scripts/loadScCityAcfrs.mjs --dry-run
 *   node scripts/loadScCityAcfrs.mjs --commit
 *   node scripts/loadScCityAcfrs.mjs --entity charleston --fy 2024 --dry-run
 *
 * ── THIS EXTENDS AN EXISTING FAMILY, IT DOES NOT OPEN A NEW ONE ────────────
 *
 * `sc-local-acfr-gf` already holds 38 rows — Columbia and Myrtle Beach, Knight
 * session 6a. Charleston and Mount Pleasant join it, which is why the source
 * label reproduces that family's shape EXACTLY:
 *
 *     City of Columbia ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)
 *     City of Charleston ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)
 *     Town of Mount Pleasant ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)
 *
 * ⚠⚠ THE THREE AXIS REGISTRIES ANCHOR ON `(City of Columbia|City of Myrtle
 * Beach)`, so they had to be WIDENED in the same change or every new row would
 * sit unclaimed while looking perfectly fine. Florida's third branch matched none
 * of three registries and Pennsylvania matched only auditGrade; at 38 rows that
 * is invisible, and this load nearly doubles the family.
 *
 * ⚠ `Town of` is not decoration. Mount Pleasant is a TOWN in the Census file and
 * in its own filings, and `treasury_ensure_municipality` keys on
 * (name, state, entity_type) — the type is part of the government's identity.
 *
 * ── AXES, EACH WITH ITS EVIDENCE ───────────────────────────────────────────
 *
 * fund_scope   `general_fund`. These are the General Fund column of the
 *              governmental-funds Statement of Revenues, Expenditures and
 *              Changes in Fund Balances.
 * basis        `actual`. Audited, closed fiscal years.
 * derivation   `published`. Every figure is a printed cell.
 * audit_grade  `audited_gaap`, and CHECKED rather than assumed:
 *                • `checkOpinionType.py` read the opinion PARAGRAPH of all 18
 *                  documents — 18 clean, 0 modified, 0 unreadable. That matters
 *                  because a QUALIFIED opinion contains both the fair-presentation
 *                  and the GAAP-conformity phrase, so a presence-only gate passes
 *                  it (Harrison County MS is the campaign's proof).
 *                • Every document was grepped for `modified cash basis`,
 *                  `regulatory basis` and `basis of accounting other than` —
 *                  0 hits across 18 — while the GAAP conformity phrase appears
 *                  4-6 times in each. One OCBOA entity hiding in a GAAP cohort
 *                  is exactly what Brown County SD turned out to be.
 *
 * ── ⚠⚠ THE FISCAL MONTH IS PER ENTITY AND CHARLESTON IS THE ODD ONE ────────
 *
 * Charleston starts in JANUARY; Mount Pleasant in July. Every SC county runs
 * July, so the state norm is the wrong default here. Both months are confirmed
 * twice over — by `fy_end_date` on every federal filing and by the FAC census —
 * and `censusGuard` is called per entity-year so a contradiction FAILS the load.
 * ⚠ The census covers Charleston only through audit year 2024, so FY2025 comes
 * back UNCOVERED. Silence is not disagreement: it is reported, never counted as
 * confirmation.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  SC_CITY_COVERAGE_GAPS, SC_CITY_DEFERRED, SC_CITY_STATE, scCityLoadableEntities,
  fiscalMonthFor, scCityYearsFor,
} from './data/scCityAcfrEntities.mjs';
import { KNOWN_DOCUMENT_GAPS, DEFAULT_OUT, stemFor } from './extractScCitiesAll.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';

export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
export const FUND_SCOPE = 'general_fund';

/** `City of Charleston` / `Town of Mount Pleasant` — the issuer's own styling. */
export function sourcePrefixFor(entity) {
  return `${entity.entityType === 'town' ? 'Town' : 'City'} of ${entity.name}`;
}

/** ⚠ Reproduces the existing `sc-local-acfr-gf` label shape EXACTLY. */
export function sourceNameFor(entity, datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${sourcePrefixFor(entity)} ACFR — General Fund ${face} (FY${fiscalYear} actual, GAAP basis)`;
}

/**
 * `{n,a,c}` shape the RPC expects, from the extractor's own tree.
 *
 * ⚠⚠ RECURSES. The first version of this function hard-stopped at depth two —
 * `r.c.map((k) => ({ n: k.n, a: k.a }))` — which SILENTLY DROPPED every
 * grandchild. That was invisible while the wave held only two-level issuers, and
 * Summerville is three levels deep: `Current:` > `General Government:` >
 * `Administrative`. Its seven General Government leaves, three Public Safety
 * leaves and two Roads and drainage leaves would all have vanished, and NOTHING
 * would have failed — the tie is computed on the extractor's tree, before this
 * conversion, so it would still have been $0 while the loaded tree was missing
 * twelve categories.
 *
 * `_treasury_insert_tree` recurses on `c` with no depth limit, so the full
 * hierarchy survives into the icicle. ⚠ This is a no-op for the four entities
 * loaded before Summerville — Charleston, Mount Pleasant, Rock Hill and
 * Greenville are all two levels deep, so recursing reproduces their trees
 * byte-for-byte.
 */
function toRpcTree(tree) {
  const node = (r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map(node) }
    : { n: r.n, a: r.a });
  return (tree.c || []).map(node);
}

export function readExtracted(dir, entityKey, fiscalYear, datasetType) {
  const path = join(dir, `${stemFor(entityKey, fiscalYear)}-${datasetType}.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  // ⚠ Belt and braces: the extractor refuses to WRITE a bad tie, but a loader
  // that trusted a cached file blindly is one refactor away from a mis-parse.
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
      dir: { type: 'string', default: DEFAULT_OUT },
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
    ? scCityLoadableEntities().filter((e) => e.key === values.entity)
    : scCityLoadableEntities();
  if (!entities.length) throw new Error(`No loadable entity matched ${values.entity}`);

  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const filings = [];
  const gaps = [];
  const censusNotes = [];
  let checks = 0;
  let bad = 0;

  for (const ent of entities) {
    for (const fy of scCityYearsFor(ent)) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const stem = stemFor(ent.key, fy);
      if (KNOWN_DOCUMENT_GAPS[stem]) { gaps.push(`${stem}: ${KNOWN_DOCUMENT_GAPS[stem]}`); continue; }
      const revenue = readExtracted(values.dir, ent.key, fy, 'revenue');
      const operating = readExtracted(values.dir, ent.key, fy, 'operating');
      if (!revenue || !operating) { gaps.push(`${stem}: extraction missing`); continue; }
      checks += 2;

      // ⚠ censusGuard returns {ok:true} when it has NO evidence — silence is not
      // confirmation, so an uncovered year is reported, never counted.
      // ⚠⚠ PER ENTITY-YEAR, not per entity. Summerville moved from a December
      // to a June fiscal year INSIDE this window, so its own constant is wrong
      // for FY2018 and FY2020. Passing the constant here is not academic: this
      // guard rejected it with `month 7 contradicts the federal audit record`,
      // which is the only reason the mistake was visible — it moves no dollar
      // and fails no tie gate.
      const month = fiscalMonthFor(ent, fy);
      const guard = censusGuard(ent.censusName, SC_CITY_STATE, month, fy);
      if (guard.error) {
        console.error(`      CENSUS CONTRADICTION: ${guard.error}`);
        bad += 1;
      } else if (guard.unknown) {
        censusNotes.push(`${ent.name} FY${fy}: UNCOVERED by the census`);
      } else {
        checks += 1;
      }
      filings.push({ entity: ent, fiscalYear: fy, revenue, operating, month });
    }
  }

  for (const f of filings) {
    console.log(`  ${sourcePrefixFor(f.entity)} FY${f.fiscalYear}  `
      + `rev ${usd(f.revenue.tree.a)}   exp ${usd(f.operating.tree.a)}  (month ${f.month})`);
  }

  if (gaps.length) {
    console.log('\nDECLARED GAPS — never written as $0:');
    for (const g of gaps) console.log(`  ${g}`);
  }
  for (const [key, years] of Object.entries(SC_CITY_COVERAGE_GAPS)) {
    for (const [fy, why] of Object.entries(years)) console.log(`  coverage gap ${key} FY${fy}: ${why}`);
  }
  for (const [key, d] of Object.entries(SC_CITY_DEFERRED)) {
    console.log(`  DEFERRED ENTITY ${key}: ${d.reason}`);
  }
  if (censusNotes.length) {
    console.log('\nFiscal-month census coverage (silence is not disagreement):');
    for (const n of censusNotes) console.log(`  ${n}`);
  }

  console.log(`\n${filings.length} entity-year(s), ${checks} check(s) passed, ${bad} failed.`);

  // ⚠⚠ A gate that measured nothing must FAIL, not pass.
  if (filings.length === 0 || checks === 0) {
    console.error('REFUSING: zero filings or zero checks. Nothing was measured.');
    process.exit(1);
  }
  if (bad > 0) { console.error(`REFUSING: ${bad} check failure(s).`); process.exit(1); }

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
      p_name: ent.name, p_state: SC_CITY_STATE,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name} (${ent.entityType}) -> ${data}`);
  }

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0;
  let conflicts = 0;

  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
    for (const [datasetType, built] of [['operating', f.operating], ['revenue', f.revenue]]) {
      const label = sourceNameFor(f.entity, datasetType, f.fiscalYear);

      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', f.fiscalYear)
        .eq('dataset_type', datasetType)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').startsWith(sourcePrefixFor(f.entity))) {
        conflicts += 1;
        console.log(`  SKIP ${f.entity.name} FY${f.fiscalYear} ${datasetType} — "${existing[0].data_source}" preserved`);
        continue;
      }

      const tree = toRpcTree(built.tree);
      const { data, error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: f.fiscalYear,
        p_dataset_type: datasetType,
        p_total: built.tree.a,
        p_tree: tree,
        p_row_count: tree.length,
        p_data_source_name: label,
        p_source_url: f.entity.publicationPage,
        p_source_date: sourceDate,
        // ⚠⚠ PER ENTITY-YEAR. Charleston and Goose Creek are 1, Mount Pleasant,
        // Rock Hill and Greenville are 7 — and SUMMERVILLE IS BOTH: 1 through
        // FY2020, 7 from FY2022. `fiscalMonthFor` resolves it and `censusGuard`
        // has already checked this exact value against the federal record.
        p_fiscal_year_start_month: f.month,
        p_fund_scope: FUND_SCOPE,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as an error.
      if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success status (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${JSON.stringify(data)}`);
      }
      written += 1;
    }
  }

  console.log(`\nWrote ${written} budget rows (${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  // ⚠ The --match list must name the entities THIS run wrote and nothing else:
  // the union has to equal the frozen-invariant deficit exactly, or arbitrary
  // rows get registered. Built from the run rather than hard-coded, because a
  // stale hint here is how the wrong rows get filed.
  const matches = [...new Set(filings.map((f) => `${sourcePrefixFor(f.entity)} ACFR`))]
    .map((m) => `--match "${m}"`).join(' ');
  console.log('Now run:  npm run verify:frozen');
  console.log(`     then npm run register:rows -- --milestone <name> ${matches}`);
  console.log('     then node scripts/syncFrozenInvariantState.mjs   (NEVER --set-baseline)');
  console.log('     then node scripts/stampAuditGrade.mjs && node scripts/stampBudgetAxes.mjs');
  console.log('     then npm run verify:live-sync');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadScCityAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
