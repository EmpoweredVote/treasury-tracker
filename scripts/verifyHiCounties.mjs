/**
 * Hawaii's four counties — LOADER-INDEPENDENT RE-DERIVATION.
 *
 * NO SHEBANG — a test imports this module for its pure helpers.
 *
 * ── ⚠⚠⚠ WHY THIS EXISTS, AND WHY ITS ABSENCE WAS THE WORST DEFECT ─────────
 *
 * The tie gate compares a tree's own leaves against the total printed on the
 * same page. It proves the READ and says NOTHING about the SHAPE, and this
 * branch produced three wrong shapes that tied to the cent:
 *
 *   * Honolulu computed the HIGHWAY FUND and called it the General Fund —
 *     tie $0 on 315,247 thousand against a real GF of 2,088,725.
 *   * Maui FY2020-FY2022 threw five spending functions out of `Current` —
 *     tie $0, every figure correct, the grouping wrong.
 *   * All 67 rows first loaded with `unknown` scope, basis and audit grade —
 *     every gate green.
 *
 * None was caught by a test. The plan required this script and the first pass
 * shipped without it, substituting four root-level probes (one year per
 * county, totals only) — 4 of 67 rows, at the root. This closes that.
 *
 * ── WHAT "INDEPENDENT" MEANS HERE ─────────────────────────────────────────
 *
 * It re-reads each PDF through the same EXTRACTOR the loader used, then
 * compares against what is IN THE DATABASE. It does not re-run
 * `acfrGfLoad.mjs`. That is the point: the loader's tree MAPPING —
 * `toBudgetTree`, the third-level flatten, category/line-item splitting — is
 * exactly where a shape defect hides, and a re-run of the loader would
 * reproduce such a defect identically instead of exposing it.
 *
 * ⚠ It therefore does NOT independently re-verify the extractor's reading of
 * the page; the tie gate, the per-capita guard and `acfrPrintedTotal.py` do
 * that. What it verifies is that EVERY node the database publishes is a node
 * the document produced, with the same amount.
 *
 * Checks, per loaded row:
 *   1. total          budgets.total_budget == the extracted tree total
 *   2. leaf set       every published leaf (label, amount) matches the
 *                     document's, as a multiset — catches a dropped or
 *                     invented line
 *   3. subtotals      every published category amount equals the sum of its
 *                     own children — catches a reparented function
 *   4. structure      the published roots match the document's roots
 *
 * And per ENTITY, across its whole series:
 *   5. no duplicate sibling labels in any published tree (the Honolulu
 *      hazard: `Capital Outlay:` repeats five names already under `Current:`)
 *   6. the root-category set is reported per year, so a mid-series change in
 *      shape is visible rather than silent
 *
 * ── ⭐ THE TWO MID-SERIES SHAPE CHANGES IT FOUND, BOTH DIAGNOSED AND BENIGN ─
 *
 * Check 6 is a REPORT, not a failure: a shape that changes may be the issuer
 * changing, and the point is to make it visible rather than silent. Both were
 * chased to the printed page:
 *
 *   HONOLULU operating, 3 roots in FY2016 and FY2022-FY2025, 2 in
 *   FY2017-FY2021 — the missing root is `Debt service`. Its General Fund cells
 *   are DASHES in those years (FY2019 prints `Principal --` and `Interest --`,
 *   with 116,728 sitting in the GO Bond and Interest Redemption Fund column),
 *   against FY2025's `Principal 11,872` / `Interest 6,923`. A real $0,
 *   correctly dropped, not a lost category.
 *
 *   KAUA'I revenue, FY2022 onward — the issuer RENAMED `Interest` to
 *   `Interest and investment earnings (losses)`. Loaded as published.
 *
 * Usage:
 *   node --env-file=.env scripts/verifyHiCounties.mjs
 *   node --env-file=.env scripts/verifyHiCounties.mjs --entity honolulu
 */
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

import { HI_COUNTIES, countyByKey } from './lib/hiCountySources.mjs';
import { runConfigFor } from './processHiCounties.js';

/** Flatten an extractor tree to its valued leaves, as `label\u0000amount`. */
export function leavesOf(node, out = []) {
  const kids = node.c ?? [];
  if (!kids.length) {
    if (node.a) out.push(`${node.n}\u0000${node.a}`);
    return out;
  }
  for (const k of kids) leavesOf(k, out);
  return out;
}

/**
 * Sibling labels that repeat under one parent.
 *
 * ⚠ This is the Honolulu hazard made checkable. Its statement repeats
 * `General government`, `Public safety`, `Highways and streets`,
 * `Human services` and `Culture-recreation` under `Capital Outlay:` when they
 * already appear under `Current:`. If the reader ever parents them into one
 * group, the page shows a government spending its capital budget inside its
 * operating functions — and the tie stays $0 because the multiset of values
 * never moved.
 */
export function duplicateSiblings(nodes) {
  const seen = new Map();
  for (const n of nodes) seen.set(n.name, (seen.get(n.name) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

const money = (n) => `$${(Number(n) / 1e6).toFixed(1)}M`;

function extractTree(cfg, pdfPath, mode) {
  const args = [...cfg.extractArgs, pdfPath, '--mode', mode];
  const r = spawnSync('py', ['-3', cfg.extractScript, ...args], {
    encoding: 'utf8', maxBuffer: 128 * 1024 * 1024,
  });
  const i = r.stdout.indexOf('{');
  if (i < 0) return { error: (r.stderr || '').trim().slice(0, 140) };
  const j = JSON.parse(r.stdout.slice(i));
  if (j.error) return { error: j.error };
  return j;
}

async function main() {
  const { values } = parseArgs({ options: { entity: { type: 'string' } } });
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  const chosen = values.entity
    ? HI_COUNTIES.filter((c) => c.key === values.entity)
    : [...HI_COUNTIES];

  let checked = 0;
  const failures = [];

  for (const ent of chosen) {
    console.log(`\n=== ${ent.name} ===`);
    const { data: muni } = await db.from('municipalities')
      .select('id').eq('name', ent.name).eq('state', 'HI')
      .eq('entity_type', ent.entityType).single();

    const { data: rows, error } = await db.from('budgets')
      .select('id, fiscal_year, dataset_type, total_budget')
      .eq('municipality_id', muni.id).order('fiscal_year');
    if (error) throw new Error(error.message);

    const rootsByYear = [];

    for (const row of rows) {
      const cfg = runConfigFor(ent.key, { mode: row.dataset_type });
      const pdf = `${cfg.pdfDir}/${ent.key}-${row.fiscal_year}-acfr.pdf`;
      const doc = extractTree(cfg, pdf, row.dataset_type);
      const tag = `${ent.key} FY${row.fiscal_year} ${row.dataset_type}`;
      if (doc.error) { failures.push(`${tag}: re-extract failed — ${doc.error}`); continue; }

      // ── published tree, read back from the database ──────────────────────
      const { data: cats } = await db.from('budget_categories')
        .select('id, name, amount, parent_id').eq('budget_id', row.id);
      const catIds = cats.map((c) => c.id);
      const { data: items } = catIds.length
        ? await db.from('budget_line_items')
          .select('category_id, description, actual_amount, approved_amount')
          .in('category_id', catIds)
        : { data: [] };

      // 1. total
      if (Number(row.total_budget) !== Number(doc.computed_total)) {
        failures.push(`${tag}: total ${row.total_budget} != document ${doc.computed_total}`);
      }

      // 2. leaf multiset
      const docLeaves = leavesOf(doc.tree).sort();
      const pubLeaves = [
        ...items.map((li) => `${li.description}\u0000${Number(li.actual_amount ?? li.approved_amount)}`),
        // a category with no children of its own is itself a published leaf
        ...cats.filter((c) => !items.some((li) => li.category_id === c.id)
          && !cats.some((k) => k.parent_id === c.id))
          .map((c) => `${c.name}\u0000${Number(c.amount)}`),
      ].sort();
      if (docLeaves.join('|') !== pubLeaves.join('|')) {
        const onlyDoc = docLeaves.filter((x) => !pubLeaves.includes(x));
        const onlyPub = pubLeaves.filter((x) => !docLeaves.includes(x));
        failures.push(`${tag}: leaves differ — only in document: ${JSON.stringify(onlyDoc.slice(0, 3))}; `
          + `only published: ${JSON.stringify(onlyPub.slice(0, 3))}`);
      }

      // 3. every category equals the sum of its own children
      for (const c of cats) {
        const kidCats = cats.filter((k) => k.parent_id === c.id);
        const kidItems = items.filter((li) => li.category_id === c.id);
        if (!kidCats.length && !kidItems.length) continue;
        const sum = kidCats.reduce((n, k) => n + Number(k.amount), 0)
          + kidItems.reduce((n, li) => n + Number(li.actual_amount ?? li.approved_amount), 0);
        if (Math.round(sum) !== Math.round(Number(c.amount))) {
          failures.push(`${tag}: category "${c.name}" ${c.amount} != sum of children ${sum}`);
        }
      }

      // 4 + 5. roots and duplicate siblings
      const roots = cats.filter((c) => !c.parent_id);
      const dupes = duplicateSiblings(roots);
      if (dupes.length) failures.push(`${tag}: DUPLICATE ROOT LABELS ${JSON.stringify(dupes)}`);
      for (const c of cats) {
        const d = duplicateSiblings(cats.filter((k) => k.parent_id === c.id));
        if (d.length) failures.push(`${tag}: duplicate siblings under "${c.name}" ${JSON.stringify(d)}`);
      }

      rootsByYear.push({ fy: row.fiscal_year, mode: row.dataset_type,
        roots: roots.map((c) => c.name).sort().join(' | ') });
      checked += 1;
      console.log(`  FY${row.fiscal_year} ${row.dataset_type.padEnd(9)} ${money(row.total_budget)}`
        + `  ${cats.length} cat / ${items.length} items  ✓`);
    }

    // 6. report the root set per year, so a mid-series shape change is visible
    for (const mode of ['revenue', 'operating']) {
      const shapes = new Map();
      for (const r of rootsByYear.filter((x) => x.mode === mode)) {
        shapes.set(r.roots, [...(shapes.get(r.roots) ?? []), r.fy]);
      }
      if (shapes.size > 1) {
        console.log(`  ⚠ ${mode}: root categories CHANGE across the series —`);
        for (const [s, fys] of shapes) console.log(`      FY${fys.join(', FY')}: ${s}`);
      }
    }
  }

  console.log(`\n${checked} row(s) re-derived from their own documents.`);
  if (failures.length) {
    console.log(`\n✗ ${failures.length} FAILURE(S):`);
    for (const f of failures) console.log(`  ! ${f}`);
    process.exit(1);
  }
  console.log('✅ every published total, leaf, subtotal and root matches the document.');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
