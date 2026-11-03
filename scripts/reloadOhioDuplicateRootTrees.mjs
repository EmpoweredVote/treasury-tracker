#!/usr/bin/env node
/**
 * Reload the category TREES of every Ohio AOS budget whose stored tree carries
 * a DUPLICATE ROOT, using the fix that already shipped in #315.
 *
 * ── WHAT IS ACTUALLY BROKEN ────────────────────────────────────────────────
 *
 * Ohio publishes a wide table under a four-row header. The pre-#315 loader read
 * only the leaf row, so it read the publisher's VERBATIM REPEATED COLUMN twice
 * (FY2024 GAAP city cols 11 and 12 are both "Rentals", identical value, in 237
 * of 237 cities). `buildOhioTree` in scripts/lib/ohioTree.mjs drops that second
 * copy and tells apart a leaf label reused under two groups.
 *
 * ⚠⚠ THE FIX SHIPPED IN #315 (c6af7719) AND THE DATA WAS NEVER RELOADED. The
 * loader has been correct for weeks; every row written before it is still
 * wrong. Measured 2026-11-03:
 *
 *   1,763 revenue budgets  — tree EXCEEDS the headline by one repeated column.
 *                            `Rentals` (895) or `Charges For Services` (868),
 *                            always exactly 2 copies, always identical amounts.
 *                            Reader-facing: the public categories endpoint
 *                            serves the name twice, so the breakdown contradicts
 *                            the headline it sits under.
 *      13 operating budgets — `Other` twice with DIFFERENT amounts. That is the
 *                            LEGITIMATE collision (Security Of Persons And
 *                            Property → Other vs Debt Service → Other). The
 *                            money is right, so it TIES and no gate ever fires,
 *                            but a reader sees two identical labels carrying two
 *                            different numbers. #315 prefixes them by group.
 *
 * 1,763 + 13 = 1,776, and #327 already repaired 2 of the original 1,778 that
 * ohioTree.mjs recorded. The arithmetic closes exactly.
 *
 * ── ⚠⚠ WHY THIS MOVES NO FIGURE, AND WHY THAT IS ASSERTED NOT ASSUMED ──────
 *
 * `total_budget` is read from the publisher's own Total column
 * (buildRevenueTree/buildExpenditureTree), NOT summed from the tree. So a tree
 * repair cannot move a published figure — and every one of these rows is inside
 * `figures_frozen`. Rather than trust that reading, PHASE 1 BELOW PARSES EVERY
 * TARGET AND REFUSES TO WRITE IF ANY PARSED TOTAL DIFFERS FROM THE STORED ONE.
 * No ledger entry, no invariant rebase, no `figureChanges.json` — but only
 * because the run proves it each time, not because this comment says so.
 *
 * ── ⚠ source_date: THE SNAPSHOT'S DATE, NOT TODAY ──────────────────────────
 *
 * `_oh-recon` holds the 2026-06-24/25 download, which is what 6,574 of these
 * rows already carry. ohioauditor.gov has been down since 2026-10-25, so
 * NOTHING is being re-fetched here — only re-parsed. Stamping today's date
 * would tell readers the figure was confirmed against the publisher today. The
 * run passes each row's EXISTING source_date straight back.
 *
 * Usage:
 *   node --env-file=.env scripts/reloadOhioDuplicateRootTrees.mjs --dry-run
 *   node --env-file=.env scripts/reloadOhioDuplicateRootTrees.mjs
 *   node --env-file=.env scripts/reloadOhioDuplicateRootTrees.mjs --verify
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import {
  enumerateCities, importCity, buildRevenueTree, buildExpenditureTree,
} from './loadOhioAOS.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECON_DIR = join(__dirname, '..', '_oh-recon');
const DATA_SOURCE_PREFIX = 'Ohio Auditor of State';

/** Measured 2026-11-03. The run refuses to proceed if it finds a different number. */
const EXPECTED_TARGET_BUDGETS = 1776;
const EXPECTED_REVENUE = 1763;
const EXPECTED_OPERATING = 13;

function client() {
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY.');
    process.exit(2);
  }
  return createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);
}

/**
 * ⚠ Page with a total order and assert distinct ids == row count. PostgREST
 * pages a result set it did not order, so an unordered read silently repeats
 * one row and drops another while the COUNT still looks right.
 */
async function pageAll(query, label) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().order('id').range(from, from + 999);
    if (error) throw new Error(`${label} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const distinct = new Set(rows.map((r) => r.id));
  if (distinct.size !== rows.length) {
    throw new Error(`${label}: ${rows.length} rows but ${distinct.size} distinct ids`);
  }
  return rows;
}

/** Every Ohio budget, with the fields the reload needs. */
async function ohioBudgets(db) {
  return pageAll(() => db.schema('treasury').from('budgets')
    // ⚠ `total_budget::text` — cast in Postgres. PostgREST's JSON drops numeric scale.
    .select('id, municipality_id, fiscal_year, dataset_type, source_url, source_date, total_budget::text')
    .like('data_source', `${DATA_SOURCE_PREFIX}%`), 'budgets');
}

/**
 * Root category names per budget, read in id batches.
 *
 * ⚠ 100 ids per call, not 500: a longer `.in()` builds a URL the server rejects
 * with a bare "fetch failed".
 *
 * ⚠⚠ AND EVERY BATCH MUST BE PAGED. PostgREST caps a response at 1,000 rows.
 * 100 budgets x ~11 roots is ~1,100, so an unpaged batch comes back TRUNCATED —
 * measured: 1,000 rows covering 99 of 100 budgets, the 99th only partly. A
 * budget missing half its roots looks like a budget with no duplicate, so this
 * silently UNDERCOUNTS the defect: 1,742 of the 1,763 real targets, with no
 * error anywhere. The row count looked plausible, which is what made it
 * dangerous. Order + range to exhaustion, then assert full coverage.
 */
async function rootNamesByBudget(db, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.schema('treasury').from('budget_categories')
        .select('id, budget_id, name')
        .is('parent_id', null)
        .in('budget_id', batch)
        .order('id')
        .range(from, from + 999);
      if (error) throw new Error(`budget_categories failed: ${error.message}`);
      for (const r of data) {
        if (!out.has(r.budget_id)) out.set(r.budget_id, []);
        out.get(r.budget_id).push(r.name);
      }
      if (data.length < 1000) break;
    }
  }
  // Ohio has no rootless budget (measured 2026-11-03: 0). A budget that comes
  // back with no roots means the read lost rows, not that the tree is empty.
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length) {
    throw new Error(`${missing.length} budget(s) returned NO root categories — `
      + `the read is incomplete. First: ${missing[0]}`);
  }
  return out;
}

/** Budgets whose root categories repeat a name — the whole defect, both cohorts. */
function withDuplicateRoots(budgets, rootNames) {
  return budgets.filter((b) => {
    const names = rootNames.get(b.id) || [];
    return names.length !== new Set(names).size;
  });
}

async function municipalityNames(db, ids) {
  const out = new Map();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 100) {
    const { data, error } = await db.schema('treasury').from('municipalities')
      .select('id, name').in('id', unique.slice(i, i + 100));
    if (error) throw new Error(`municipalities failed: ${error.message}`);
    for (const m of data) out.set(m.id, m.name);
  }
  return out;
}

/** `_oh-recon/City_2024_GAAP_Summarized.XLSX` from the stored source_url. */
function workbookFor(sourceUrl) {
  const base = String(sourceUrl || '').replace(/^.*\//, '');
  if (!/^(City|County)_\d{4}_(GAAP|CASH|MOD)_Summarized\.XLSX$/.test(base)) return null;
  const path = join(RECON_DIR, base);
  return existsSync(path) ? { path, base, entityType: base.startsWith('County') ? 'county' : 'city' } : null;
}

/**
 * Group the target budgets into one reload per (workbook, entity, fiscal year).
 * importCity writes operating AND revenue together, so an entity-year appears
 * once even when both datasets are targets.
 */
function plan(targets, names) {
  const byUnit = new Map();
  for (const b of targets) {
    const wb = workbookFor(b.source_url);
    if (!wb) throw new Error(`no local workbook for ${b.source_url}`);
    const canonical = names.get(b.municipality_id);
    if (!canonical) throw new Error(`no municipality name for ${b.municipality_id}`);
    const key = `${wb.base}|${canonical}|${b.fiscal_year}`;
    if (!byUnit.has(key)) {
      byUnit.set(key, {
        wb, canonical, fiscalYear: b.fiscal_year, sourceUrl: b.source_url,
        sourceDate: b.source_date, stored: {}, ids: {},
      });
    }
    const u = byUnit.get(key);
    u.stored[b.dataset_type] = b.total_budget;
    u.ids[b.dataset_type] = b.id;
    // ⚠ A single entity-year must not carry two source_dates; if it ever does,
    // writing one of them would silently restate the other dataset's provenance.
    if (u.sourceDate !== b.source_date) {
      throw new Error(`${key}: conflicting source_date ${u.sourceDate} vs ${b.source_date}`);
    }
  }
  return [...byUnit.values()];
}

/** Workbook lookup name → canonical DB name, mirroring loadOhioAOSBatch.js. */
function canonicalise(name, entityType) {
  return (entityType === 'county' && !name.endsWith(' County')) ? `${name} County` : name;
}

/**
 * PHASE 1 — parse every target and compare the parsed total to the stored one.
 * ⚠⚠ This is the guard that lets the reload skip the frozen ledger entirely.
 * Any difference means the reload WOULD move a published figure, which needs
 * the ledger runbook, not this script. It fails closed.
 */
async function parseTargets(units) {
  const byWorkbook = new Map();
  for (const u of units) {
    if (!byWorkbook.has(u.wb.path)) byWorkbook.set(u.wb.path, []);
    byWorkbook.get(u.wb.path).push(u);
  }

  const drift = [];
  const parsed = [];
  for (const [path, group] of byWorkbook) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const { entityType } = group[0].wb;

    // Reverse the canonicalisation by enumerating the sheet, never by guessing:
    // CASH/MOD county workbooks write "Adams" where the DB holds "Adams County".
    const lookup = new Map();
    for (const name of enumerateCities(workbook, entityType)) {
      lookup.set(canonicalise(name, entityType), name);
    }

    for (const u of group) {
      const sheetName = lookup.get(u.canonical);
      if (!sheetName) { drift.push({ unit: u, why: 'entity not found in workbook' }); continue; }
      u.sheetName = sheetName;
      const rev = buildRevenueTree(workbook, sheetName, entityType);
      const exp = buildExpenditureTree(workbook, sheetName, entityType);
      u.parsed = { revenue: rev, operating: exp };

      for (const [dataset, built] of [['revenue', rev], ['operating', exp]]) {
        const stored = u.stored[dataset];
        if (stored === undefined) continue;        // not a target dataset
        if (String(built.total) !== String(stored)) {
          drift.push({ unit: u, dataset, stored, parsed: built.total });
        }
      }
      // The repair itself: no root name may repeat after the rebuild.
      for (const [dataset, built] of [['revenue', rev], ['operating', exp]]) {
        const names = built.tree.map((n) => n.n);
        if (names.length !== new Set(names).size) {
          drift.push({ unit: u, dataset, why: 'tree STILL has a duplicate root after rebuild' });
        }
      }
      parsed.push(u);
    }
  }
  return { parsed, drift };
}

async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' }, verify: { type: 'boolean' } },
  });
  const db = client();

  const budgets = await ohioBudgets(db);
  console.log(`Ohio AOS budgets          : ${budgets.length}`);
  const rootNames = await rootNamesByBudget(db, budgets.map((b) => b.id));
  const targets = withDuplicateRoots(budgets, rootNames);

  const nRev = targets.filter((b) => b.dataset_type === 'revenue').length;
  const nOp = targets.filter((b) => b.dataset_type === 'operating').length;
  console.log(`with a DUPLICATE ROOT     : ${targets.length}  (revenue ${nRev}, operating ${nOp})`);

  if (values.verify) {
    const ok = targets.length === 0;
    console.log(ok ? '\n✅ no Ohio budget carries a duplicate root category.'
      : `\n❌ ${targets.length} still carry a duplicate root.`);
    process.exit(ok ? 0 : 1);
  }

  // ⚠ MORE than the measured population is a REGRESSION — something started
  // writing duplicate roots again. Fail closed and go understand it; do NOT
  // edit these numbers to match what the database happens to hold.
  if (targets.length > EXPECTED_TARGET_BUDGETS) {
    console.error(`\n❌ ${targets.length} budgets carry a duplicate root, but only `
      + `${EXPECTED_TARGET_BUDGETS} were measured on 2026-11-03 (rev ${nRev}/${EXPECTED_REVENUE}, `
      + `op ${nOp}/${EXPECTED_OPERATING}). Something is WRITING them again.`);
    process.exit(1);
  }
  // ⚠⚠ FEWER IS NOT AN ERROR, AND TREATING IT AS ONE MADE THIS UNRESUMABLE.
  // The first draft asserted an exact match, so an interrupted run could never
  // be restarted: the rows it had already repaired were missing from the count
  // and the guard refused. A bulk repair has to be re-runnable, because the
  // reason it stopped is usually not a reason to start over.
  if (targets.length === 0) {
    console.log('\n✅ nothing to do — no Ohio budget carries a duplicate root.');
    return;
  }
  if (targets.length < EXPECTED_TARGET_BUDGETS) {
    console.log(`\n⚠ ${EXPECTED_TARGET_BUDGETS - targets.length} of the measured `
      + `${EXPECTED_TARGET_BUDGETS} are already repaired — resuming on the remaining `
      + `${targets.length}.`);
  }

  const names = await municipalityNames(db, targets.map((b) => b.municipality_id));
  const units = plan(targets, names);
  console.log(`entity-years to reload    : ${units.length}`);
  console.log(`workbooks involved        : ${new Set(units.map((u) => u.wb.base)).size}`);

  const { drift } = await parseTargets(units);
  if (drift.length) {
    console.error(`\n❌ REFUSING TO WRITE — ${drift.length} target(s) would not reload cleanly:`);
    for (const d of drift.slice(0, 20)) {
      console.error(`  ${d.unit.canonical} FY${d.unit.fiscalYear} ${d.dataset ?? ''} `
        + `${d.why ?? `stored ${d.stored} vs parsed ${d.parsed}`}`);
    }
    console.error('\nA parsed total that differs from the stored one MOVES A FROZEN FIGURE.');
    console.error('That needs the frozen-ledger runbook, not this script.');
    process.exit(1);
  }
  console.log(`\n✅ all ${units.length} entity-years parse to their STORED totals — no figure moves.`);

  if (values['dry-run']) {
    const sample = units.slice(0, 3);
    for (const u of sample) {
      console.log(`  ${u.canonical} FY${u.fiscalYear} [${u.wb.base}]  source_date=${u.sourceDate}`);
      for (const d of ['revenue', 'operating']) {
        if (u.stored[d] === undefined) continue;
        console.log(`     ${d}: total ${u.stored[d]} unchanged, ${u.parsed[d].tree.length} roots`);
      }
    }
    console.log('\n(dry run — nothing written)');
    return;
  }

  // ⚠ Open each workbook ONCE and write every entity-year that comes from it.
  // Re-reading per entity is 1,775 parses of files up to 883 KB where 48 will
  // do, which turned a few minutes into the better part of an hour.
  const byWorkbook = new Map();
  for (const u of units) {
    if (!byWorkbook.has(u.wb.path)) byWorkbook.set(u.wb.path, []);
    byWorkbook.get(u.wb.path).push(u);
  }

  let written = 0;
  const failures = [];
  for (const [path, group] of byWorkbook) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    for (const u of group) {
      try {
        await importCity(db, workbook, {
          cityName: u.sheetName,
          municipalityName: u.sheetName !== u.canonical ? u.canonical : null,
          fiscalYear: u.fiscalYear,
          basis: u.wb.base.split('_')[2],
          sourceUrl: u.sourceUrl,
          // ⚠ The SNAPSHOT's date, not today. Nothing was re-fetched.
          sourceDate: u.sourceDate,
          entityType: u.wb.entityType,
        });
        written += 1;
        if (written % 100 === 0) console.log(`  ... ${written}/${units.length}`);
      } catch (e) {
        failures.push({ unit: `${u.canonical} FY${u.fiscalYear}`, message: e.message });
      }
    }
  }

  console.log(`\nwrote ${written} entity-year(s); ${failures.length} failure(s)`);
  for (const f of failures.slice(0, 20)) console.error(`  ${f.unit}: ${f.message}`);
  if (failures.length) process.exit(1);
  console.log('\nRe-run with --verify to confirm no duplicate root survives.');
}

await main();
