/**
 * Load the Indiana county audited ACFR series into TT (wave 1).
 *
 * NO SHEBANG — tests import `sourceNameFor` and `FUND_SCOPE`.
 *
 * Usage:
 *   node scripts/fetchInCountyAcfrs.mjs
 *   node scripts/extractInCountiesAll.mjs
 *   node scripts/loadInCountyAcfrs.mjs --dry-run
 *   node scripts/loadInCountyAcfrs.mjs --commit
 *   node scripts/loadInCountyAcfrs.mjs --entity hamilton --fy 2024 --dry-run
 *
 * ── THIS OPENS A NEW FAMILY, BESIDE THE GATEWAY ROWS RATHER THAN OVER THEM ──
 *
 * TT already holds Indiana Gateway AFR rows for these counties, labelled
 * `fund_scope = all_funds`, and Marion's are known to run ~3.3x the county's own
 * audited governmental-funds revenue on custodial pass-through. These rows are
 * the AUDITED answer to the same question at a NARROWER scope, and both stay:
 * two publishers reporting different scopes are not a conflict to be resolved by
 * overwriting.
 *
 * ⚠⚠ WHICH IS ONLY SAFE BECAUSE THE RPC KEYS ON FUND_SCOPE. `treasury_sync_city_budget`
 * keys on (municipality, fiscal_year, dataset_type, FUND_SCOPE, BASIS), so an
 * `all_funds` row and a `total_governmental` row for the same county-year are
 * different rows.
 *
 * ⚠⚠ AND BECAUSE THE NEVER-OVERWRITE GUARD BELOW FILTERS ON FUND_SCOPE TOO.
 * The guard copied from every other loader looks up (municipality, fiscal_year,
 * dataset_type) and skips when it finds another publisher's row. Here that
 * ALWAYS finds the Gateway row and would have skipped EVERY write while printing
 * a tidy "preserved" line for each — a load that refuses itself and looks
 * careful doing it.
 *
 * ── AXES, EACH WITH ITS EVIDENCE ───────────────────────────────────────────
 *
 * fund_scope   `total_governmental`, NOT `general_fund` — the one axis where
 *              this family differs from every other member of the acfrGF corpus.
 *              Gateway's General Fund figure was never the problem (0.5% from
 *              the audited one for Marion FY2025); the inflation is entirely in
 *              the non-General funds, so the governmental-funds TOTAL is the
 *              figure that answers the question.
 * basis        `actual`. Audited, closed calendar years, every fy_end 12-31.
 * derivation   `published`. Every figure is a printed cell.
 * audit_grade  `audited_gaap`, and CHECKED per document rather than assumed —
 *              `scripts/verifyInCountyOpinions.py` read the auditor's own
 *              opinion-unit headings in all 37 fetched documents, and
 *              `scripts/data/inCountyAcfrOpinions.mjs` records what each said.
 *              ⚠⚠ ELEVEN of the 31 loaded entity-years carry a MODIFIED opinion
 *              on SOME opinion unit, and ONE of those (Allen FY2020) names a
 *              FUND-LEVEL unit. They load, and every one is printed at load
 *              time. See that module for why each is or is not in scope.
 *
 * ── ⚠⚠ THE GAAP CEILING: 17 COUNTIES, NOT 89 ───────────────────────────────
 *
 * 459 of Indiana's 562 county FAC filings are State Board of Accounts
 * REGULATORY-BASIS reports with no governmental-funds statement in them. Only 17
 * counties ever file GAAP, and they are 63.4% of Indiana's county population.
 * `IN_COUNTY_BASIS_GAPS` records the six wave-1 years affected (all Lake).
 *
 * ── ⚠ POPULATION IS NOT SET BY THIS LOADER ─────────────────────────────────
 *
 * `treasury_ensure_municipality` is SELECT-then-INSERT-IF-NOT-FOUND with NO
 * UPDATE. Every wave-1 county already exists from the Gateway load carrying
 * population 0, so the measured PEP-2024 figures in the registry are recorded
 * but not written. Fixing that is the statewide population task, not this one.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  IN_COUNTY_BASIS_GAPS, IN_COUNTY_COVERAGE_GAPS, IN_COUNTY_DEFERRED, IN_COUNTY_SERIES_NOTES,
  IN_COUNTY_STATE,
  fiscalMonthFor, inCountyFilingsFor, inCountyLoadableEntities, sourceUrlFor,
} from './data/inCountyAcfrEntities.mjs';
import { opinionFor } from './data/inCountyAcfrOpinions.mjs';
import { DEFAULT_OUT, KNOWN_DOCUMENT_GAPS, loadableYearsFor, stemFor } from './extractInCountiesAll.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';

export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
/** ⚠ NOT `general_fund`. See the module docstring. */
export const FUND_SCOPE = 'total_governmental';

/**
 * `Marion County ACFR — Total Governmental Funds Revenue by Source (FY2025 actual, GAAP basis)`
 *
 * ⚠ NO `City of` / `County of` PREFIX. The government's name IS `Marion County`
 * — the word is part of it, exactly as `Mecklenburg County` and `Travis County`
 * are already stored. Adding one would produce `County of Marion County`.
 *
 * ⚠⚠ AND THE FACE SAYS `Total Governmental Funds`, NOT `General Fund`. The label
 * is what a reader sees and what the three axis registries match on; a family
 * that reads one scope and labels itself another is the LA TRAN shape and the
 * failure mode 11 shape at once.
 */
export function sourceNameFor(entity, datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${entity.name} ACFR — Total Governmental Funds ${face} `
    + `(FY${fiscalYear} actual, GAAP basis)`;
}

/** Everything this run may write for one entity, and nothing else. */
export function sourcePrefixFor(entity) {
  return `${entity.name} ACFR — Total Governmental Funds`;
}

/**
 * `{n,a,c}` shape the RPC expects, from the extractor's own tree.
 *
 * ⚠⚠ RECURSES. Two consumers in this repo hard-stopped at depth two and SILENTLY
 * DROPPED every grandchild while the amounts still rolled up — so the total, the
 * tie and `assertProjection` all stayed green. Hamilton County is three levels
 * deep on the revenue side (`Taxes` > `Other` > `Food and beverage`), so a
 * two-level conversion would lose real categories here.
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
  // ⚠⚠ The root label must name the scope this family loads — failure mode 11.
  if (!String(data.tree.n || '').startsWith('Total Governmental Funds')) {
    throw new Error(`${path}: tree root is "${data.tree.n}", not a Total Governmental Funds `
      + 'scope. A row labelled total_governmental holding a General Fund figure ties at $0 '
      + 'and is wrong in the only way that matters.');
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
    ? inCountyLoadableEntities().filter((e) => e.key === values.entity)
    : inCountyLoadableEntities();
  if (!entities.length) throw new Error(`No loadable entity matched ${values.entity}`);

  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const filings = [];
  const gaps = [];
  const censusNotes = [];
  const opinionNotes = [];
  const fundLevelOpinions = [];
  let checks = 0;
  let bad = 0;

  for (const ent of entities) {
    // ⚠ `facEin` is EVIDENCE of which government was resolved, never a join —
    // one Indiana county can file under two EINs. Assert it against the roster
    // so a typo cannot sit there being plausible and inert.
    const rosterEins = new Set(inCountyFilingsFor(ent).map((f) => f.ein));
    if (!rosterEins.has(ent.facEin)) {
      console.error(`      EIN MISMATCH: ${ent.name} declares ${ent.facEin}, but its filings `
        + `carry ${[...rosterEins].join(', ')}`);
      bad += 1;
    } else {
      checks += 1;
    }

    for (const fy of loadableYearsFor(ent)) {
      if (values.fy && Number(values.fy) !== fy) continue;
      const stem = stemFor(ent.key, fy);
      if (KNOWN_DOCUMENT_GAPS[stem]) { gaps.push(`${stem}: ${KNOWN_DOCUMENT_GAPS[stem]}`); continue; }
      const revenue = readExtracted(values.dir, ent.key, fy, 'revenue');
      const operating = readExtracted(values.dir, ent.key, fy, 'operating');
      if (!revenue || !operating) { gaps.push(`${stem}: extraction missing`); continue; }
      checks += 2;

      // ⚠ censusGuard returns {ok:true} when it has NO evidence — silence is not
      // confirmation, so an uncovered year is reported, never counted.
      const month = fiscalMonthFor(ent, fy);
      const guard = censusGuard(ent.censusName, IN_COUNTY_STATE, month, fy);
      if (guard.error) {
        console.error(`      CENSUS CONTRADICTION: ${guard.error}`);
        bad += 1;
      } else if (guard.unknown) {
        censusNotes.push(`${ent.name} FY${fy}: UNCOVERED by the census`);
      } else {
        checks += 1;
      }

      // ⚠⚠ THROWS on an entity-year nobody recorded an opinion for. Silence is
      // not a clean opinion, and `audited_gaap` is a claim about THIS document.
      const opinion = opinionFor(ent.key, fy);
      checks += 1;
      if (opinion) {
        opinionNotes.push(`${ent.name} FY${fy}: ${opinion.kind.toUpperCase()} on `
          + `${opinion.units.join(' + ')} [${opinion.scope}]`);
        if (opinion.scope === 'fund_level') fundLevelOpinions.push(`${ent.name} FY${fy}`);
      }

      filings.push({ entity: ent, fiscalYear: fy, revenue, operating, month, opinion });
    }
  }

  for (const f of filings) {
    console.log(`  ${f.entity.name} FY${f.fiscalYear}  `
      + `rev ${usd(f.revenue.tree.a)}   exp ${usd(f.operating.tree.a)}  (month ${f.month})`);
  }

  if (gaps.length) {
    console.log('\nDECLARED DOCUMENT GAPS — never written as $0:');
    for (const g of gaps) console.log(`  ${g}`);
  }
  for (const [key, years] of Object.entries(IN_COUNTY_BASIS_GAPS)) {
    for (const fy of Object.keys(years)) {
      console.log(`  BASIS GAP ${key} FY${fy}: the filing is an SBOA REGULATORY-BASIS report — `
        + 'no governmental-funds statement exists in it');
    }
  }
  for (const [key, years] of Object.entries(IN_COUNTY_COVERAGE_GAPS)) {
    for (const fy of Object.keys(years)) console.log(`  COVERAGE GAP ${key} FY${fy}`);
  }
  for (const [key, d] of Object.entries(IN_COUNTY_DEFERRED)) {
    console.log(`  DEFERRED ENTITY ${key}: ${d.reason}`);
  }
  if (censusNotes.length) {
    console.log('\nFiscal-month census coverage (silence is not disagreement):');
    for (const n of censusNotes) console.log(`  ${n}`);
  }
  if (opinionNotes.length) {
    console.log(`\n⚠ MODIFIED AUDIT OPINIONS on ${opinionNotes.length} of ${filings.length} `
      + 'entity-years loaded — recorded in scripts/data/inCountyAcfrOpinions.mjs:');
    for (const n of opinionNotes) console.log(`  ${n}`);
  }
  if (fundLevelOpinions.length) {
    console.log(`\n⚠⚠ ${fundLevelOpinions.length} of those name a FUND-LEVEL opinion unit, i.e. `
      + `they reach the figures loaded here: ${fundLevelOpinions.join(', ')}`);
  }

  // ⚠ Printed at load time so the person running it sees what a reader will
  // eventually need to know — above all that Marion's expenditure CATEGORIES are
  // not comparable across FY2022/FY2023 even though its totals are.
  const notes = Object.entries(IN_COUNTY_SERIES_NOTES);
  console.log(`\nSeries movements of 20% or more, each traced (${notes.length}):`);
  for (const [key, note] of notes) console.log(`  ${key}: ${note.slice(0, 120)}...`);

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
    // ⚠ SELECT-then-INSERT-IF-NOT-FOUND with no UPDATE. Every wave-1 county
    // already exists from the Gateway load, so this returns the EXISTING id and
    // the population below is not applied. Recorded, not written.
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: IN_COUNTY_STATE,
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

      // ⚠⚠ `.eq('fund_scope', FUND_SCOPE)` IS LOAD-BEARING AND IS THE ONE LINE
      // THAT DIFFERS FROM EVERY OTHER LOADER'S GUARD. Without it this lookup
      // finds the county's Gateway `all_funds` row for the same
      // (municipality, fiscal_year, dataset_type), sees a different publisher,
      // and skips — every single time, on every county, printing a reassuring
      // "preserved" line while writing nothing. The guard's job is to protect
      // another publisher's row IN THIS SCOPE; the Gateway row is a different
      // row by the RPC's own key and is never at risk.
      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', f.fiscalYear)
        .eq('dataset_type', datasetType)
        .eq('fund_scope', FUND_SCOPE)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').startsWith(sourcePrefixFor(f.entity))) {
        conflicts += 1;
        console.log(`  SKIP ${f.entity.name} FY${f.fiscalYear} ${datasetType} — `
          + `"${existing[0].data_source}" preserved`);
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
        // ⚠ The EXACT filing, not a landing page — see `sourceUrlFor` for why
        // this family departs from the issuer-page convention.
        p_source_url: sourceUrlFor(f.entity, f.fiscalYear),
        p_source_date: sourceDate,
        // ⚠ Every Indiana county closes 12-31; confirmed per entity-year by
        // `censusGuard` above rather than carried as a state default. All 31 are
        // ACTIVELY confirmed — none falls back on silence.
        p_fiscal_year_start_month: f.month,
        // ⚠⚠ LOAD-BEARING. The RPC keys on these; omit them and both default to
        // 'unknown', so a re-run after the stampers matches nothing, takes the
        // INSERT branch, and silently duplicates every row.
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
  // rows get registered. Built from the run rather than hard-coded.
  const matches = [...new Set(filings.map((f) => sourcePrefixFor(f.entity)))]
    .map((m) => `--match "${m}"`).join(' ');
  console.log('Now run:  npm run verify:frozen');
  console.log(`     then npm run register:rows -- --milestone <name> ${matches}`);
  console.log('     then node scripts/syncFrozenInvariantState.mjs   (NEVER --set-baseline)');
  console.log('     then node scripts/stampAuditGrade.mjs && node scripts/stampBudgetAxes.mjs');
  console.log('     then npm run verify:live-sync');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadInCountyAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
