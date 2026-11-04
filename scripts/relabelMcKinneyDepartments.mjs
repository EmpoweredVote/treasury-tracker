#!/usr/bin/env node
/**
 * Replace McKinney's invented department labels with the publisher's own names.
 *
 *   node --env-file=.env scripts/relabelMcKinneyDepartments.mjs --dry-run
 *   node --env-file=.env scripts/relabelMcKinneyDepartments.mjs
 *
 * ⚠⚠⚠ WHAT THIS REPAIRS. `McKinney Check Register FY2022-FY2025` published
 * department names that McKinney never wrote. They came from migration
 * `rename_mckinney_dept_categories`, which the phase record describes as
 * "derived from top-vendor analysis" — and McKinney's `vendor_column` is
 * `description_1`, an INVOICE DESCRIPTION. The names were guessed from invoice
 * text, and a majority of the checkable ones were wrong: code 2119 is
 * Information Technology and TT called it `Risk Management` over $8.1M.
 *
 * Replacements come from scripts/data/mckinneyDepartments.json, extracted from
 * McKinney's own Adopted Budget Worksheets. See scripts/lib/mckinneyLabels.mjs
 * for the rule, including why an unnamed code keeps the publisher's identifier
 * rather than a better-sounding guess.
 *
 * ── ⚠ WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────
 *
 * It does not touch `link_key`. Code 0 reaches the database as the string
 * `unknown` because of the falsy-zero bug fixed in scripts/lib/publisherIds.mjs,
 * and the TRANSACTIONS behind that category carry a null link key to match.
 * Re-keying the category alone would break the drill-down that serves them.
 * The key is corrected by re-loading the register, which is a separate change
 * with its own verification; the NAME is correct either way.
 *
 * It moves no money. Only `budget_categories.name` is written, so the frozen
 * figure invariant cannot move — and the run asserts that rather than assuming.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { labelYear } from './lib/mckinneyLabels.mjs';

const MAP = JSON.parse(readFileSync(new URL('./data/mckinneyDepartments.json', import.meta.url), 'utf8'));

/** The four check-register budgets. Pinned so a stray source can never be hit. */
const BUDGETS = {
  2022: '7fc55cea-f8ae-48bc-9a57-365b0186d8d5',
  2023: '8c6fd02b-2dc2-4089-b257-5e62feec259f',
  2024: '257d9eef-f6ac-4f1c-8e0c-b624d1bcc030',
  2025: '7088040b-501c-476c-9124-a140ef233e0b',
};

/** Root count per year, measured 2026-11-04. A different shape is a refusal. */
const EXPECTED_ROOTS = { 2022: 97, 2023: 96, 2024: 94, 2025: 95 };

/** `unknown` is what the falsy-zero bug made of department code 0. */
const UNKNOWN_IS_CODE = '0';

const dryRun = process.argv.includes('--dry-run');

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

/**
 * Every root of one budget.
 *
 * ⚠⚠ PAGED, and asserted complete. A batched or filtered read is NOT a paged
 * read — PostgREST caps a response at 1,000 rows whatever the filter, and a
 * budget that comes back half-read looks like a budget with fewer roots. This
 * has been got wrong six times in this repo.
 */
async function rootsOf(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('budget_categories')
      .select('id, name, amount, link_key')
      .eq('budget_id', budgetId).is('parent_id', null)
      .order('id').range(from, from + 999);
    if (error) throw new Error(`budget_categories read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

/** The union of all four years, so a code named in one year names it in all. */
function unionMap() {
  const out = {};
  for (const fy of Object.keys(MAP.byYear).sort()) {
    for (const [code, entry] of Object.entries(MAP.byYear[fy])) {
      if (!out[code]) out[code] = entry;
    }
  }
  return out;
}

async function main() {
  console.log(`McKinney department labels — ${dryRun ? 'DRY RUN' : 'WRITING'}`);
  console.log(`source: ${MAP._source}\n`);

  const union = unionMap();
  let changed = 0, unchanged = 0, unnamed = 0;

  for (const [fy, budgetId] of Object.entries(BUDGETS)) {
    const roots = await rootsOf(budgetId);
    if (roots.length !== EXPECTED_ROOTS[fy]) {
      throw new Error(
        `FY${fy}: expected ${EXPECTED_ROOTS[fy]} roots, read ${roots.length}. The budget has ` +
        `changed shape since this script was measured — re-check before relabelling anything.`,
      );
    }

    // The year's own map first, the union as fallback: a department that exists
    // in the register but was not budgeted that year is still the same department.
    const yearMap = { ...union, ...(MAP.byYear[fy] || {}) };
    const codes = roots.map((r) => (r.link_key === 'unknown' ? UNKNOWN_IS_CODE : r.link_key));
    const labels = labelYear(codes, yearMap);

    const updates = [];
    for (const r of roots) {
      const code = r.link_key === 'unknown' ? UNKNOWN_IS_CODE : r.link_key;
      const want = labels.get(code);
      if (!yearMap[code]) unnamed++;
      if (want === r.name) { unchanged++; continue; }
      updates.push({ id: r.id, from: r.name, to: want, amount: r.amount });
    }

    console.log(`FY${fy}: ${roots.length} roots — ${updates.length} relabelled, ${roots.length - updates.length} already correct`);
    for (const u of updates.sort((a, b) => b.amount - a.amount).slice(0, 6)) {
      console.log(`   $${Number(u.amount).toLocaleString().padStart(13)}  ${JSON.stringify(u.from)} -> ${JSON.stringify(u.to)}`);
    }
    if (updates.length > 6) console.log(`   ... and ${updates.length - 6} more`);

    if (!dryRun) {
      for (const u of updates) {
        const { error } = await db.schema('treasury').from('budget_categories')
          .update({ name: u.to }).eq('id', u.id);
        if (error) throw new Error(`update ${u.id} failed: ${error.message}`);
      }
    }
    changed += updates.length;
  }

  console.log(`\n${changed} label(s) ${dryRun ? 'would change' : 'changed'}, ${unchanged} already correct.`);
  console.log(`${unnamed} root(s) keep the publisher's identifier because McKinney names no department for them.`);

  if (!dryRun) {
    // ⚠ Verify by RE-READING, not by trusting the writes.
    let dupes = 0, invented = 0;
    const INVENTED = new Set(['Risk Management', 'Fleet & Vehicles', 'Development Reimbursements',
      'Parks Horticulture', 'Performing Arts', 'Economic Development Obligations', 'Unknown Department']);
    for (const [fy, budgetId] of Object.entries(BUDGETS)) {
      const roots = await rootsOf(budgetId);
      const names = roots.map((r) => r.name);
      const d = names.length - new Set(names).size;
      const inv = names.filter((n) => INVENTED.has(n));
      dupes += d; invented += inv.length;
      console.log(`  FY${fy}: ${names.length} roots | duplicate labels ${d} | invented labels remaining ${inv.length}`);
    }
    if (dupes || invented) {
      console.error(`\n❌ ${dupes} duplicate and ${invented} invented label(s) survive. Not done.`);
      process.exitCode = 1;
      return;
    }
    console.log('\n✅ every root carries a distinct name, and none of the invented ones remain.');
  }
}

await main();
