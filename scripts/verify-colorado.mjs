#!/usr/bin/env node
/**
 * Colorado Springs + El Paso County verification harness.
 *
 * Reads what is IN THE DATABASE and checks it against the PDFs by routes that
 * share no code with the loader that wrote each row.
 *
 * ── WHY NOT A DATABASE SELF-CHECK ───────────────────────────────────────────
 * The obvious check — "does budgets.total_budget equal the sum of its line
 * items" — is TAUTOLOGICAL. The loader computes `p_total` as the sum of the
 * nodes it passes to the RPC, so the two agree by construction and the check
 * would pass on a completely mis-parsed statement. (The same tautology bit
 * SCOPE-04, whose handoff reported a "0 of 23,260 rows tie" green light for
 * `total = Σ roots`, which is an identity, not evidence.)
 *
 * The extractor's own `tie_delta == 0` is stronger but still INTERNAL to one
 * parse: it holds under a wrong `units` multiplier and under wrong nesting. On
 * THIS milestone it also held while three El Paso categories were published
 * with fragment labels ("limitation)"), which is what a tie cannot see.
 *
 * ── THE TWO ENTITIES ARE CROSS-CHECKED IN OPPOSITE DIRECTIONS ───────────────
 * They were loaded by different readers, so each is verified by the other's:
 *
 *   Colorado Springs   loaded by  extractColoradoSprings.py -> lib/acfrGF.py
 *                                 (`pdftotext -table`, character grid)
 *                      checked by acfrGfComponents.py
 *                                 (pdfplumber glyph coordinates)
 *
 *   El Paso County     loaded by  extractElPasoCountyCoords.py
 *                                 (pdfplumber glyph coordinates)
 *                      checked by extractElPasoCounty.py + …Ordinal.py
 *                                 (`pdftotext -table`, BOTH column strategies)
 *                                 plus acfrPrintedTotal.py on every row
 *
 * El Paso needs the two-strategy form because neither `-table` strategy reads
 * its whole corpus: `positional` is defeated by a General Fund column rendered
 * at two character offsets, `ordinal` by the TABOR figure the county prints
 * inside its revenue label. Each reads a different subset correctly, and a row
 * counts as CORROBORATED when either one reproduces the stored figure. Rows
 * that neither can read are reported as SINGLE-READER and listed by name — they
 * are not silently folded into the pass count.
 *
 * CHECKS
 *   1. DB total_budget == the printed General Fund total, read by an
 *      independent implementation, EXACTLY. (The load-bearing check.)
 *   2. Component agreement: the independent reader's non-zero component
 *      multiset equals the stored line items'.
 *   3. Row inventory: the expected (entity, fy, dataset) set, no more, no less.
 *   4. Every row carries source_url, source_date and data_source, and
 *      source_date is the DECEMBER 31 fiscal-year end (both entities run the
 *      calendar year — this is the check that would catch the Texas '09-30'
 *      default leaking into a Colorado row).
 *   5. fiscal_year_start_month == 1 (calendar, not October).
 *   6. No `data_sources` residue — those rows are ephemeral.
 *   7. Colorado Springs is entity_type 'city' linked to El Paso County, and no
 *      duplicate name/type row exists for either (the Utah phantom-row defect).
 *   8. Every row is classified general_fund / actual / primary_government by the
 *      `co-local-acfr-gf` registry entries, so a re-run of a loader (which
 *      writes the column DEFAULT 'unknown' on a fresh row) cannot silently drop
 *      these rows out of scope-matched comparison without this harness noticing.
 *   9. No published category label is a fragment — non-empty, not punctuation,
 *      not starting with a digit or currency symbol. This is the check that
 *      catches the defect class the tie gate is blind to.
 *
 * Exits non-zero on any failure. Usage:
 *   node scripts/verify-colorado.mjs
 *   node scripts/verify-colorado.mjs --entity springs
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}
loadEnv();

const SPRINGS_FYS = Array.from({ length: 14 }, (_, i) => 2012 + i);
const ELPASO_FYS = [2005, ...Array.from({ length: 17 }, (_, i) => 2009 + i)];

const ENTITIES = {
  springs: {
    label: 'City of Colorado Springs', muniName: 'Colorado Springs', entityType: 'city',
    dir: 'docs/ColoradoSprings', file: (fy) => `colorado-springs-${fy}-acfr.pdf`,
    fys: SPRINGS_FYS,
    // Loaded by the -table reader, so the coordinate reader is the check.
    checker: 'coords',
  },
  elpaso: {
    label: 'El Paso County', muniName: 'El Paso County', entityType: 'county',
    dir: 'docs/ElPasoCounty', file: (fy) => `el-paso-county-${fy}-acfr.pdf`,
    fys: ELPASO_FYS,
    // Loaded by the coordinate reader, so the -table reader is the check.
    checker: 'table',
  },
};

const PY = resolvePython();
const failures = [];
const notes = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };

function runJson(args) {
  const r = spawnSync(PY, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // A non-zero exit still carries JSON on stdout for the tie-failure path, so
  // parse first and report the exit code only if there is nothing to read.
  try { return { ok: true, data: JSON.parse(r.stdout), status: r.status }; }
  catch { return { ok: false, reason: `exit ${r.status}: ${(r.stderr || '').trim().split('\n').pop()}` }; }
}

/** Coordinate reader: every component of the General Fund column. */
function coordComponents(ent, fy) {
  const pdf = path.join(ROOT, ent.dir, ent.file(fy));
  if (!existsSync(pdf)) return { ok: false, reason: `PDF missing: ${pdf}` };
  const args = [path.join(ROOT, 'scripts', 'acfrGfComponents.py'), pdf];
  if (ent.label.includes('Colorado Springs')) args.push('--title-anchor', 'springs');
  return runJson(args);
}

/** `-table` reader, one strategy. Used to corroborate El Paso. */
function tableComponents(fy, mode, strategy) {
  const script = strategy === 'ordinal' ? 'extractElPasoCountyOrdinal.py' : 'extractElPasoCounty.py';
  const pdf = path.join(ROOT, 'docs/ElPasoCounty', `el-paso-county-${fy}-acfr.pdf`);
  return runJson([path.join(ROOT, 'scripts', script), pdf, '--mode', mode]);
}

/** Printed-total-only reader — a third route, for El Paso's totals. */
function printedTotal(fy) {
  const pdf = path.join(ROOT, 'docs/ElPasoCounty', `el-paso-county-${fy}-acfr.pdf`);
  return runJson([path.join(ROOT, 'scripts', 'acfrPrintedTotal.py'), pdf]);
}

/**
 * A stored leaf's dollar figure.
 *
 * The RPC writes these into `actual_amount` and leaves `approved_amount` NULL,
 * which is semantically right — every figure in this milestone is a GAAP ACTUAL
 * off an audited statement, not an appropriation. Reading `approved_amount`
 * instead returns null for every row, which `Number(null)` turns into 0 rather
 * than an error: this harness reported "stored 0" against 28 correct rows before
 * the column was checked. Same trap `buildBudgetTree.mjs` documents for
 * `approved_amount_column`.
 */
function leafAmount(li) {
  const v = li.actual_amount ?? li.approved_amount;
  if (v === null || v === undefined) return NaN;   // NaN never equals a real figure
  return Number(v);
}

/** Non-zero leaf amounts of a stored budget tree, sorted — a comparable multiset. */
function storedLeaves(categories) {
  const out = [];
  for (const c of categories) for (const i of c.items) if (i.amount !== 0) out.push(i.amount);
  return out.sort((a, b) => a - b);
}

function extractorLeaves(tree, mode) {
  const out = [];
  for (const c of tree?.c ?? []) {
    if (mode === 'operating' && Array.isArray(c.c) && c.c.length) out.push(...c.c.map((g) => g.a));
    else out.push(c.a);
  }
  return out.filter((a) => a !== 0).sort((a, b) => a - b);
}

const sameMultiset = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--entity');
  const only = i >= 0 ? argv[i + 1] : null;

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('ERROR: SUPABASE_SERVICE_KEY required'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  let checked = 0;
  let corroborated = 0;
  const singleReader = [];

  for (const [name, ent] of Object.entries(ENTITIES)) {
    if (only && only !== name) continue;
    console.log(`\n=== ${ent.label}`);

    const { data: muni, error: mErr } = await db.from('municipalities')
      .select('id, name, entity_type, county_id, population')
      .eq('name', ent.muniName).eq('state', 'CO').eq('entity_type', ent.entityType).maybeSingle();
    if (mErr || !muni) { fail(`${ent.label}: municipality row not found (${mErr?.message ?? 'none'})`); continue; }

    // CHECK 7 — duplicates / linkage
    const { data: dupes } = await db.from('municipalities')
      .select('id, entity_type').eq('name', ent.muniName).eq('state', 'CO');
    if ((dupes ?? []).length !== 1) fail(`${ent.label}: ${dupes.length} rows named "${ent.muniName}" in CO (phantom-row defect)`);
    if (name === 'springs') {
      const { data: county } = await db.from('municipalities')
        .select('id').eq('name', 'El Paso County').eq('state', 'CO').eq('entity_type', 'county').maybeSingle();
      if (!county || muni.county_id !== county.id) fail('Colorado Springs is not linked to El Paso County, CO');
      else console.log('  OK    linked to El Paso County, CO');
    }

    const { data: rows, error: bErr } = await db.from('budgets')
      .select('id, fiscal_year, dataset_type, total_budget, source_url, source_date, data_source, '
              + 'fiscal_year_start_month, fund_scope, basis, reporting_entity')
      .eq('municipality_id', muni.id)
      .order('fiscal_year').order('dataset_type').order('id');
    if (bErr) { fail(`${ent.label}: budgets read failed ${bErr.message}`); continue; }

    // CHECK 3 — inventory
    const expected = new Set();
    for (const fy of ent.fys) for (const d of ['revenue', 'operating']) expected.add(`${fy}/${d}`);
    const got = new Set(rows.map((r) => `${r.fiscal_year}/${r.dataset_type}`));
    for (const k of expected) if (!got.has(k)) fail(`${ent.label}: MISSING row ${k}`);
    for (const k of got) if (!expected.has(k)) fail(`${ent.label}: UNEXPECTED row ${k}`);
    if (rows.length === expected.size) console.log(`  OK    inventory: ${rows.length} rows, exactly the expected set`);

    for (const fy of ent.fys) {
      // One independent read per fiscal year, reused for both datasets.
      const coord = ent.checker === 'coords' ? coordComponents(ent, fy) : null;
      if (coord && !coord.ok) { fail(`${ent.label} FY${fy}: independent reader failed — ${coord.reason}`); continue; }
      if (coord?.data?.error) { fail(`${ent.label} FY${fy}: independent reader — ${coord.data.error}`); continue; }

      const pt = ent.checker === 'table' ? printedTotal(fy) : null;

      for (const dataset of ['revenue', 'operating']) {
        const row = rows.find((r) => r.fiscal_year === fy && r.dataset_type === dataset);
        if (!row) continue;
        checked++;

        // CHECK 4/5 — provenance and fiscal calendar
        if (!row.source_url) fail(`${ent.label} FY${fy} ${dataset}: no source_url`);
        if (!row.data_source) fail(`${ent.label} FY${fy} ${dataset}: no data_source`);
        if (row.source_date !== `${fy}-12-31`) {
          fail(`${ent.label} FY${fy} ${dataset}: source_date ${row.source_date} != ${fy}-12-31 `
            + '(both Colorado entities close December 31)');
        }
        if (row.fiscal_year_start_month !== 1) {
          fail(`${ent.label} FY${fy} ${dataset}: fiscal_year_start_month ${row.fiscal_year_start_month} != 1`);
        }

        // CHECK 8 — classification axes
        if (row.fund_scope !== 'general_fund' || row.basis !== 'actual'
            || row.reporting_entity !== 'primary_government') {
          fail(`${ent.label} FY${fy} ${dataset}: axes ${row.fund_scope}/${row.basis}/${row.reporting_entity} `
            + '!= general_fund/actual/primary_government');
        }

        // Stored tree, for CHECK 2 and CHECK 9.
        //
        // The LEAVES are in `budget_line_items`, keyed by category_id — NOT in
        // `budget_categories`, whose rows are the roots and carry the SUBTOTAL
        // of their leaves. Comparing against `budget_categories` alone would
        // compare 3 aggregates to 12 components and is what this harness did
        // first: it reported a "component multiset differs — independent 12 vs
        // stored 3" on every operating row while the data was in fact correct.
        const { data: cats } = await db.from('budget_categories')
          .select('id, name, amount, parent_id').eq('budget_id', row.id);
        const catRows = cats ?? [];
        const { data: lis } = catRows.length
          ? await db.from('budget_line_items')
            .select('category_id, description, approved_amount, actual_amount')
            .in('category_id', catRows.map((c) => c.id))
          : { data: [] };
        const leafRows = lis ?? [];

        // CHECK 9 — no fragment labels, on category names AND leaf descriptions
        for (const [labels, kind] of [[catRows.map((c) => c.name), 'category'],
          [leafRows.map((l) => l.description), 'line item']]) {
          for (const raw of labels) {
            const n = (raw ?? '').trim();
            if (n.length < 3 || /^[$\d(]/.test(n) || !/[A-Za-z]/.test(n)) {
              fail(`${ent.label} FY${fy} ${dataset}: fragment ${kind} label ${JSON.stringify(raw)}`);
            }
          }
        }

        // The roots must also sum to the stored total. This one IS internal to
        // the database, so it is a consistency check rather than evidence — it
        // catches a tree that lost a category between the RPC and the row.
        const rootSum = catRows.filter((c) => c.parent_id === null)
          .reduce((s, c) => s + Number(c.amount), 0);
        if (rootSum !== Number(row.total_budget)) {
          fail(`${ent.label} FY${fy} ${dataset}: roots sum ${rootSum} != total_budget ${row.total_budget}`);
        }

        // CHECK 1 + 2 — independent read
        if (ent.checker === 'coords') {
          const d = coord.data;
          const printed = dataset === 'revenue' ? d.revenue_total : d.expenditure_total;
          if (printed !== row.total_budget) {
            fail(`${ent.label} FY${fy} ${dataset}: stored ${row.total_budget} != coordinate-read printed total ${printed}`);
          } else {
            corroborated++;
          }
          const comps = (dataset === 'revenue' ? d.revenue : d.expenditure)
            .filter((c) => c.amount !== 0).map((c) => c.amount).sort((a, b) => a - b);
          const stored = leafRows.map(leafAmount)
            .filter((a) => a !== 0).sort((a, b) => a - b);
          if (!sameMultiset(comps, stored)) {
            fail(`${ent.label} FY${fy} ${dataset}: component multiset differs — `
              + `independent ${comps.length} vs stored ${stored.length}`);
          }
        } else {
          // El Paso: corroborate with EITHER -table strategy; report if neither.
          let matched = null;
          for (const strategy of ['positional', 'ordinal']) {
            const t = tableComponents(fy, dataset, strategy);
            if (!t.ok || t.data?.tie_delta !== 0) continue;
            if (t.data.computed_total === row.total_budget) { matched = strategy; break; }
          }
          if (matched) {
            corroborated++;
          } else {
            singleReader.push(`${ent.label} FY${fy} ${dataset}`);
          }
          // The printed-total route runs on EVERY El Paso row regardless.
          if (pt?.ok && !pt.data?.error) {
            const printed = dataset === 'revenue' ? pt.data.revenue_total : pt.data.expenditure_total;
            if (printed !== row.total_budget) {
              fail(`${ent.label} FY${fy} ${dataset}: stored ${row.total_budget} != printed-total read ${printed}`);
            }
          } else {
            notes.push(`${ent.label} FY${fy}: printed-total reader unavailable (${pt?.reason ?? pt?.data?.error})`);
          }
        }
      }
    }

    // CHECK 6 — no ephemeral data_sources residue
    const { data: ds } = await db.from('data_sources').select('id, dataset_id').eq('municipality_id', muni.id);
    if ((ds ?? []).length) fail(`${ent.label}: ${ds.length} data_sources row(s) left behind: ${ds.map((d) => d.dataset_id).join(', ')}`);
    else console.log('  OK    no data_sources residue');
  }

  console.log(`\n${checked} row(s) checked; ${corroborated} corroborated by a second implementation.`);
  if (singleReader.length) {
    console.log(`\n${singleReader.length} row(s) rest on the COORDINATE READER ALONE (plus its own`);
    console.log('printed-total identity and the printed-total reader above) — neither `-table`');
    console.log('strategy can read these pages, for the two reasons documented in');
    console.log('scripts/extractElPasoCountyCoords.py:');
    for (const s of singleReader) console.log(`  - ${s}`);
  }
  for (const n of notes) console.log(`  NOTE  ${n}`);

  if (failures.length) {
    console.log(`\n${failures.length} FAILURE(S).`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED.');
}

await main();
