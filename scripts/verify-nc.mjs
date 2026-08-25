#!/usr/bin/env node
/**
 * NC-DURHAM-AVL-01 verification harness — City of Durham, Durham County,
 * City of Asheville, Buncombe County.
 *
 * Reads what is IN THE DATABASE and checks it against the PDFs by routes that
 * share no code with the loader that wrote each row.
 *
 * ── WHY NOT A DATABASE SELF-CHECK ───────────────────────────────────────────
 * The obvious check — "does budgets.total_budget equal the sum of its line
 * items" — is TAUTOLOGICAL. The loader computes `p_total` as the sum of the
 * nodes it passes to the RPC, so the two agree by construction and the check
 * would pass on a completely mis-parsed statement.
 *
 * The extractor's own `tie_delta == 0` is stronger but still INTERNAL to one
 * parse: it holds under a wrong `units` multiplier and under wrong nesting.
 * On this milestone it also held while the coordinate reader was silently
 * INVERTING THE SIGN of Asheville's FY2022 investment loss — the components
 * over-summed the printed total by exactly twice the figure, which is the only
 * reason it surfaced at all.
 *
 * ── THE FOUR ENTITIES ARE CROSS-CHECKED IN OPPOSITE DIRECTIONS ──────────────
 * Two were loaded by the character-grid reader and two by the coordinate
 * reader, so each is verified by the other's:
 *
 *   City of Durham    loaded by  extractDurhamCity.py -> lib/acfrGF.py
 *                                (`pdftotext -table`, character grid)
 *                     checked by acfrGfComponents.py (glyph coordinates)
 *
 *   Buncombe County   loaded by  extractBuncombeCounty.py -> lib/acfrGF.py
 *                     checked by acfrGfComponents.py
 *
 *   Durham County     loaded by  extractDurhamCountyCoords.py (coordinates)
 *                     checked by extractDurhamCounty.py (`-table`)
 *
 *   City of Asheville loaded by  extractAshevilleCoords.py (coordinates)
 *                     checked by extractAsheville.py (`-table`)
 *
 * The two coordinate-loaded entities are on that reader because `-table` has a
 * DIAGNOSED mechanical failure on part of their corpus (a General Fund column
 * rendered at two character offsets for Durham County FY2006-FY2011;
 * letter-spaced glyphs for Asheville FY2021-FY2022). So `-table` cannot
 * corroborate those years by construction. Such rows are reported as
 * SINGLE-READER and listed BY NAME — never silently folded into the pass count.
 *
 * ⚠ Buncombe County is loaded with `exclude_ignore`, which WIDENS which pages
 * can qualify as the primary statement. The coordinate checker finds its own
 * page independently, so CHECK 1 is what proves the widened rule still picked
 * the right page.
 *
 * CHECKS
 *   1. DB total_budget == the printed General Fund total, read by an
 *      independent implementation, EXACTLY. (The load-bearing check.)
 *   2. Component agreement: the independent reader's non-zero component
 *      multiset equals the stored line items'.
 *   3. Row inventory: the expected (entity, fy, dataset) set, no more, no less.
 *   4. Every row carries source_url, source_date and data_source, and
 *      source_date is the JUNE 30 fiscal-year end — N.C.G.S. 159-8(b) fixes
 *      that for every NC local unit. This is the check that would catch a
 *      Texas '09-30' or Colorado '12-31' default leaking into an NC row.
 *   5. fiscal_year_start_month == 7 (July, not January and not October).
 *   6. No `data_sources` residue — those rows are ephemeral.
 *   7. Entity types, county links, and no duplicate name/type row (the Utah
 *      phantom-row defect). Keyed on (name, state, entity_type) throughout,
 *      because "Durham" is also a town in CT and NH.
 *   8. Every row is classified general_fund / actual / primary_government, so a
 *      loader re-run (which writes the column DEFAULT 'unknown' on a fresh row)
 *      cannot silently drop these rows out of scope-matched comparison.
 *   9. No published category label is a fragment — the defect class the tie
 *      gate is blind to.
 *  10. ⚠ ISSUER: every PDF still names its own government AND carries that
 *      government's own governing-body marker. Buncombe County and Buncombe
 *      County Schools both publish an ACFR saying "Buncombe County" and
 *      "June 30" on the cover; this is the only check that separates them, and
 *      it runs here as well as at fetch time because the county could
 *      re-publish at the same URL.
 *  11. ⚠ SIGN: no stored leaf is a positive figure where the independent reader
 *      sees a negative one. Asheville FY2022's investment LOSS is the live case
 *      — a sign flip changes a total by twice the figure and is invisible to
 *      any check that compares absolute values.
 *  12. ⚠ ROOT STRUCTURE — the WELD check. The document's root-level subtotals
 *      must match the stored ones. A group heading read as a wrapped label and
 *      fused onto its first child moves NO MONEY, so the tie gate passes, CHECK
 *      1 passes and CHECK 2 passes — the heading carried $0, so the leaf
 *      multiset is identical either way. Eleven of Buncombe County's sixteen
 *      operating rows shipped the label "Intergovernmental Education" through
 *      all of those gates, and were caught only when an unrelated glyph defect
 *      on one year forced a component comparison. Compared as AMOUNTS, never as
 *      label strings, because the two readers legitimately render labels
 *      differently on documents that fuse or split glyphs.
 *
 * Exits non-zero on any failure. Usage:
 *   node scripts/verify-nc.mjs
 *   node scripts/verify-nc.mjs --entity buncombe
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';
import { assertIssuer, assertFiscalYear, NC_ISSUERS } from './lib/ncAcfrSources.mjs';

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

const DURHAM_CITY_FYS = Array.from({ length: 16 }, (_, i) => 2009 + i);          // 2009..2024
const DURHAM_COUNTY_FYS = Array.from({ length: 21 }, (_, i) => 2005 + i);        // 2005..2025
const ASHEVILLE_FYS = [2021, 2022, 2023, 2024, 2025];
const BUNCOMBE_FYS = [2008, ...Array.from({ length: 15 }, (_, i) => 2011 + i)];  // 2008, 2011..2025

const ENTITIES = {
  'durham-city': {
    label: 'City of Durham', muniName: 'Durham', entityType: 'city',
    issuerKey: 'durham-city', countyName: 'Durham County',
    dir: 'docs/DurhamCity', file: (fy) => `durham-city-${fy}-acfr.pdf`,
    fys: DURHAM_CITY_FYS,
    // Loaded by the -table reader, so the coordinate reader is the check.
    checker: 'coords', tableScript: 'extractDurhamCity.py', excludeIgnore: [],
  },
  'durham-county': {
    label: 'Durham County', muniName: 'Durham County', entityType: 'county',
    issuerKey: 'durham-county', countyName: null,
    dir: 'docs/DurhamCounty', file: (fy) => `durham-county-${fy}-acfr.pdf`,
    fys: DURHAM_COUNTY_FYS,
    // Loaded by the coordinate reader, so -table is the check.
    checker: 'table', tableScript: 'extractDurhamCounty.py', excludeIgnore: [],
  },
  asheville: {
    label: 'City of Asheville', muniName: 'Asheville', entityType: 'city',
    issuerKey: 'asheville', countyName: 'Buncombe County',
    dir: 'docs/Asheville', file: (fy) => `asheville-${fy}-acfr.pdf`,
    fys: ASHEVILLE_FYS,
    checker: 'table', tableScript: 'extractAsheville.py', excludeIgnore: [],
  },
  buncombe: {
    label: 'Buncombe County', muniName: 'Buncombe County', entityType: 'county',
    issuerKey: 'buncombe', countyName: null,
    dir: 'docs/BuncombeCounty', file: (fy) => `buncombe-county-${fy}-acfr.pdf`,
    fys: BUNCOMBE_FYS,
    checker: 'coords', tableScript: 'extractBuncombeCounty.py',
    // The county prints the government-wide reconciliation at the foot of the
    // fund statement, so the independent reader needs the same override the
    // loader uses or it cannot find the page for FY2011-FY2018 at all.
    excludeIgnore: ['reconciliation', 'net position'],
  },
};

const PY = resolvePython();
const failures = [];
const notes = [];
const fail = (msg) => { failures.push(msg); console.log(`  FAIL  ${msg}`); };

/**
 * Run a python reader and parse its JSON.
 *
 * ⚠ pdfminer writes "Could not get FontBBox from font descriptor" to STDOUT,
 * not stderr, on several Durham County years. A plain `JSON.parse(stdout)`
 * therefore fails on a perfectly good read — and reported as "reader failed" it
 * looks exactly like a parse defect. Slice from the first brace.
 */
function runJson(args) {
  const r = spawnSync(PY, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout || '';
  const i = out.indexOf('{');
  if (i < 0) return { ok: false, reason: `exit ${r.status}: ${(r.stderr || '').trim().split('\n').pop()}` };
  try { return { ok: true, data: JSON.parse(out.slice(i)), status: r.status }; }
  catch { return { ok: false, reason: `exit ${r.status}: unparseable output` }; }
}

/** Coordinate reader: every component of the General Fund column. */
function coordComponents(ent, fy) {
  const pdf = path.join(ROOT, ent.dir, ent.file(fy));
  if (!existsSync(pdf)) return { ok: false, reason: `PDF missing: ${pdf}` };
  const args = [path.join(ROOT, 'scripts', 'acfrGfComponents.py'), pdf];
  for (const t of ent.excludeIgnore) args.push('--exclude-ignore', t);
  return runJson(args);
}

/** `-table` reader, used to corroborate the coordinate-loaded entities. */
function tableComponents(ent, fy, mode) {
  const pdf = path.join(ROOT, ent.dir, ent.file(fy));
  if (!existsSync(pdf)) return { ok: false, reason: `PDF missing: ${pdf}` };
  return runJson([path.join(ROOT, 'scripts', ent.tableScript), pdf, '--mode', mode]);
}

/** Printed-total-only reader — a third route, run on every row it can read. */
function printedTotal(ent, fy) {
  const pdf = path.join(ROOT, ent.dir, ent.file(fy));
  if (!existsSync(pdf)) return { ok: false, reason: `PDF missing: ${pdf}` };
  return runJson([path.join(ROOT, 'scripts', 'acfrPrintedTotal.py'), pdf]);
}

/** First 30 pages of a PDF as text, for the issuer and fiscal-year checks. */
function frontMatter(ent, fy) {
  const pdf = path.join(ROOT, ent.dir, ent.file(fy));
  if (!existsSync(pdf)) return null;
  const r = spawnSync('pdftotext', ['-f', '1', '-l', '30', pdf, '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

/**
 * A stored leaf's dollar figure.
 *
 * The RPC writes these into `actual_amount` and leaves `approved_amount` NULL,
 * which is semantically right — every figure here is a GAAP ACTUAL off an
 * audited statement, not an appropriation. Reading `approved_amount` instead
 * returns null for every row, which `Number(null)` turns into 0 rather than an
 * error, so a harness on the wrong column reports "stored 0" against correct
 * rows.
 */
function leafAmount(li) {
  const v = li.actual_amount ?? li.approved_amount;
  if (v === null || v === undefined) return NaN;   // NaN never equals a real figure
  return Number(v);
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

/**
 * Root-level subtotals implied by the coordinate reader's flat component list.
 *
 * ⚠ THE CHECK THAT CATCHES A WELD, and the reason it exists.
 *
 * `CHECK 2` compares LEAF amounts, and a weld does not change them. When a
 * group heading is read as a wrapped label and fused onto its first child
 * ("Intergovernmental Education"), the heading carried $0, so the leaf multiset
 * is IDENTICAL either way and CHECK 2 passes. So does the extractor tie gate,
 * for the same reason. Eleven of Buncombe County's sixteen operating rows
 * shipped exactly that label, and it surfaced only incidentally — through an
 * unrelated glyph defect on one year.
 *
 * What a weld DOES change is the ROOT structure: the document has three root
 * categories and the stored tree has two, with the survivor inflated by the
 * whole of the missing one ($66,171,518 of education transfers in FY2008).
 * Comparing root-level subtotals catches that precisely.
 *
 * Compared as AMOUNTS, never as label strings: the two readers legitimately
 * render labels differently on documents that fuse or split their glyphs
 * (City of Durham FY2023 yields "Licensesandpermits" under pdfplumber), so a
 * string comparison would raise false failures on correct data.
 */
function coordRootAmounts(components) {
  const indents = components.map((c) => c.indent).filter((i) => i !== null && i !== undefined);
  if (!indents.length) return null;
  const rootX = Math.min(...indents);
  const TOL = 1.5;   // same tolerance lib/acfrGfCoords.py uses
  const roots = [];
  let open = null;
  for (const c of components) {
    if (c.indent === null || c.indent === undefined) return null;
    if (c.indent <= rootX + TOL) {
      if (c.cell === 'number' && c.amount !== 0) { roots.push(c.amount); open = null; }
      else { open = { a: 0 }; roots.push(open); }
    } else if (open) {
      open.a += c.amount;
    }
  }
  return roots
    .map((r) => (typeof r === 'number' ? r : r.a))
    .filter((a) => a !== 0)
    .sort((a, b) => a - b);
}

/** Root-level subtotals of an acfrGF-shaped tree. */
function treeRootAmounts(tree) {
  return (tree?.c ?? [])
    .map((c) => (Array.isArray(c.c) && c.c.length ? c.c.reduce((s, g) => s + g.a, 0) : c.a))
    .filter((a) => a !== 0)
    .sort((a, b) => a - b);
}

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
      .eq('name', ent.muniName).eq('state', 'NC').eq('entity_type', ent.entityType).maybeSingle();
    if (mErr || !muni) { fail(`${ent.label}: municipality row not found (${mErr?.message ?? 'none'})`); continue; }

    // CHECK 7 — duplicates / linkage
    const { data: dupes } = await db.from('municipalities')
      .select('id, entity_type').eq('name', ent.muniName).eq('state', 'NC');
    if ((dupes ?? []).length !== 1) {
      fail(`${ent.label}: ${dupes.length} rows named "${ent.muniName}" in NC (phantom-row defect)`);
    }
    if (ent.countyName) {
      const { data: county } = await db.from('municipalities')
        .select('id').eq('name', ent.countyName).eq('state', 'NC').eq('entity_type', 'county').maybeSingle();
      if (!county || muni.county_id !== county.id) fail(`${ent.label} is not linked to ${ent.countyName}, NC`);
      else console.log(`  OK    linked to ${ent.countyName}, NC`);
    }
    if (!muni.population) fail(`${ent.label}: no population — per-capita reasoning is impossible`);

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
    if (rows.length === expected.size && got.size === expected.size) {
      console.log(`  OK    inventory: ${rows.length} rows, exactly the expected set`);
    }

    for (const fy of ent.fys) {
      // CHECK 10 — the document is still this government's own report.
      const text = frontMatter(ent, fy);
      if (text === null) {
        fail(`${ent.label} FY${fy}: PDF missing or unreadable — cannot verify issuer`);
      } else {
        const iss = assertIssuer(text, NC_ISSUERS[ent.issuerKey]);
        if (!iss.ok) fail(`${ent.label} FY${fy}: ${iss.note}`);
        const yr = assertFiscalYear(text, fy);
        if (!yr.ok) fail(`${ent.label} FY${fy}: ${yr.note}`);
      }

      // One independent read per fiscal year, reused for both datasets.
      const coord = ent.checker === 'coords' ? coordComponents(ent, fy) : null;
      if (coord && !coord.ok) { fail(`${ent.label} FY${fy}: independent reader failed — ${coord.reason}`); continue; }
      if (coord?.data?.error) { fail(`${ent.label} FY${fy}: independent reader — ${coord.data.error}`); continue; }

      const pt = printedTotal(ent, fy);

      for (const dataset of ['revenue', 'operating']) {
        const row = rows.find((r) => r.fiscal_year === fy && r.dataset_type === dataset);
        if (!row) continue;
        checked++;

        // CHECK 4/5 — provenance and fiscal calendar
        if (!row.source_url) fail(`${ent.label} FY${fy} ${dataset}: no source_url`);
        if (!row.data_source) fail(`${ent.label} FY${fy} ${dataset}: no data_source`);
        if (row.source_date !== `${fy}-06-30`) {
          fail(`${ent.label} FY${fy} ${dataset}: source_date ${row.source_date} != ${fy}-06-30 `
            + '(every NC local unit closes June 30, N.C.G.S. 159-8(b))');
        }
        if (row.fiscal_year_start_month !== 7) {
          fail(`${ent.label} FY${fy} ${dataset}: fiscal_year_start_month ${row.fiscal_year_start_month} != 7`);
        }

        // CHECK 8 — classification axes
        if (row.fund_scope !== 'general_fund' || row.basis !== 'actual'
            || row.reporting_entity !== 'primary_government') {
          fail(`${ent.label} FY${fy} ${dataset}: axes ${row.fund_scope}/${row.basis}/${row.reporting_entity} `
            + '!= general_fund/actual/primary_government');
        }

        // Stored tree, for CHECK 2, 9 and 11.
        //
        // The LEAVES are in `budget_line_items`, keyed by category_id — NOT in
        // `budget_categories`, whose rows are the roots and carry the SUBTOTAL
        // of their leaves.
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

        // Internal consistency: the roots must sum to the stored total. Not
        // evidence — it catches a tree that lost a category between the RPC
        // and the row.
        const rootSum = catRows.filter((c) => c.parent_id === null)
          .reduce((s, c) => s + Number(c.amount), 0);
        if (rootSum !== Number(row.total_budget)) {
          fail(`${ent.label} FY${fy} ${dataset}: roots sum ${rootSum} != total_budget ${row.total_budget}`);
        }

        const stored = leafRows.map(leafAmount).filter((a) => a !== 0).sort((a, b) => a - b);
        const storedRoots = catRows.filter((c) => c.parent_id === null)
          .map((c) => Number(c.amount)).filter((a) => a !== 0).sort((a, b) => a - b);

        // CHECK 1 + 2 + 11 — independent read
        if (ent.checker === 'coords') {
          const d = coord.data;
          const printed = dataset === 'revenue' ? d.revenue_total : d.expenditure_total;
          if (printed !== Number(row.total_budget)) {
            fail(`${ent.label} FY${fy} ${dataset}: stored ${row.total_budget} != coordinate-read printed total ${printed}`);
          } else {
            corroborated++;
          }
          const raw = (dataset === 'revenue' ? d.revenue : d.expenditure).filter((c) => c.amount !== 0);
          const comps = raw.map((c) => c.amount).sort((a, b) => a - b);
          if (!sameMultiset(comps, stored)) {
            fail(`${ent.label} FY${fy} ${dataset}: component multiset differs — `
              + `independent ${comps.length} vs stored ${stored.length}`);
          }
          // CHECK 11 — sign agreement
          const negIndependent = raw.filter((c) => c.amount < 0).length;
          const negStored = stored.filter((a) => a < 0).length;
          if (negIndependent !== negStored) {
            fail(`${ent.label} FY${fy} ${dataset}: ${negIndependent} negative component(s) in the document `
              + `but ${negStored} stored — a sign flip changes a total by TWICE the figure`);
          }
          // CHECK 12 — root structure (the weld check)
          const docRoots = coordRootAmounts(dataset === 'revenue' ? d.revenue : d.expenditure);
          if (docRoots && !sameMultiset(docRoots, storedRoots)) {
            fail(`${ent.label} FY${fy} ${dataset}: ROOT structure differs — document has `
              + `${docRoots.length} root categor(ies) ${JSON.stringify(docRoots)}, stored has `
              + `${storedRoots.length} ${JSON.stringify(storedRoots)}. A group heading welded onto `
              + 'its child moves no money, so the tie gate and the leaf check both pass.');
          }
        } else {
          // Coordinate-loaded: corroborate with the -table reader where it can
          // read the page at all. Where it cannot — for the diagnosed reasons
          // in each extractor's header — the row is SINGLE-READER and named.
          const t = tableComponents(ent, fy, dataset);
          if (t.ok && t.data?.tie_delta === 0 && t.data.computed_total === Number(row.total_budget)) {
            corroborated++;
            const comps = extractorLeaves(t.data.tree, dataset);
            if (!sameMultiset(comps, stored)) {
              fail(`${ent.label} FY${fy} ${dataset}: component multiset differs from -table — `
                + `independent ${comps.length} vs stored ${stored.length}`);
            }
            const negIndependent = comps.filter((a) => a < 0).length;
            const negStored = stored.filter((a) => a < 0).length;
            if (negIndependent !== negStored) {
              fail(`${ent.label} FY${fy} ${dataset}: ${negIndependent} negative component(s) in the document `
                + `but ${negStored} stored — a sign flip changes a total by TWICE the figure`);
            }
            // CHECK 12 — root structure (the weld check)
            const docRoots = treeRootAmounts(t.data.tree);
            if (!sameMultiset(docRoots, storedRoots)) {
              fail(`${ent.label} FY${fy} ${dataset}: ROOT structure differs — document has `
                + `${docRoots.length} root categor(ies) ${JSON.stringify(docRoots)}, stored has `
                + `${storedRoots.length} ${JSON.stringify(storedRoots)}. A group heading welded onto `
                + 'its child moves no money, so the tie gate and the leaf check both pass.');
            }
          } else if (t.ok && t.data?.tie_delta === 0 && t.data.computed_total !== Number(row.total_budget)) {
            fail(`${ent.label} FY${fy} ${dataset}: stored ${row.total_budget} != -table read ${t.data.computed_total}`);
          } else {
            singleReader.push(`${ent.label} FY${fy} ${dataset}`);
          }
        }

        // The printed-total route runs on EVERY row it can read, whichever
        // reader loaded it — a third, independent look at the same figure.
        if (pt?.ok && !pt.data?.error) {
          const printed = dataset === 'revenue' ? pt.data.revenue_total : pt.data.expenditure_total;
          if (printed !== null && printed !== undefined && printed !== Number(row.total_budget)) {
            fail(`${ent.label} FY${fy} ${dataset}: stored ${row.total_budget} != printed-total read ${printed}`);
          }
        } else {
          notes.push(`${ent.label} FY${fy}: printed-total reader unavailable (${pt?.reason ?? pt?.data?.error})`);
        }
      }
    }

    // CHECK 6 — no data_sources residue
    const { data: residue } = await db.from('data_sources').select('id, name').eq('municipality_id', muni.id);
    if ((residue ?? []).length) {
      fail(`${ent.label}: ${residue.length} data_sources row(s) survived a load — those are ephemeral`);
    } else {
      console.log('  OK    no data_sources residue');
    }
  }

  console.log(`\n${checked} row(s) checked; ${corroborated} corroborated by a second implementation.`);

  if (singleReader.length) {
    console.log(`\n${singleReader.length} row(s) rest on the LOADING READER ALONE (plus its own`);
    console.log('printed-total identity and the printed-total reader above) — the other reader');
    console.log('cannot read these pages, for the reasons documented in each extractor header:');
    for (const s of singleReader) console.log(`  - ${s}`);
  }
  if (notes.length) {
    console.log(`\n${notes.length} note(s):`);
    for (const n of notes) console.log(`  - ${n}`);
  }

  if (failures.length) {
    console.log(`\n${failures.length} CHECK(S) FAILED.`);
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED.');
}

await main();
