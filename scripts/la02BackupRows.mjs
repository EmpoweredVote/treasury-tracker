#!/usr/bin/env node
/**
 * LA-02 pre-write backup. Exports the FULL tree (budget row + categories + line
 * items) for every LA City row that LA-02 replaces or withdraws, so nothing this
 * task removes is irrecoverable.
 *
 * ⚠ Paged reads order by the PRIMARY KEY last: 79,840/79,939 budget rows tie on
 * (muni, fy), so a paged read without a total order silently duplicates one row
 * and skips another while the COUNT stays right.
 *
 * Usage: node scripts/la02BackupRows.mjs <outfile> [fromFY] [toFY]   (default 2021 2025)
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(URL, KEY);
const LA = '391bf791-1c1f-424f-a7a5-1b698c79093f';
const out = process.argv[2];
const FROM = Number(process.argv[3] || 2021), TO = Number(process.argv[4] || 2025);
if (!out) { console.error('usage: la02BackupRows.mjs <outfile> [fromFY] [toFY]'); process.exit(1); }

async function pageAll(table, select, apply) {
  const PAGE = 1000; let from = 0, all = [];
  for (;;) {
    let q = db.schema('treasury').from(table).select(select);
    q = apply(q).order('id', { ascending: true }).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

const budgets = await pageAll('budgets', '*', q => q
  .eq('municipality_id', LA)
  .in('dataset_type', ['operating', 'revenue'])
  .gte('fiscal_year', FROM).lte('fiscal_year', TO));

const ids = budgets.map(b => b.id);
const cats = ids.length ? await pageAll('budget_categories', '*', q => q.in('budget_id', ids)) : [];
const catIds = cats.map(c => c.id);

let items = [];
for (let i = 0; i < catIds.length; i += 200) {
  const chunk = catIds.slice(i, i + 200);
  items = items.concat(await pageAll('budget_line_items', '*', q => q.in('category_id', chunk)));
}

const payload = {
  exported_for: 'LA-02',
  municipality_id: LA,
  note: `LA City operating+revenue FY${FROM}-${TO} as they stood BEFORE LA-02 wrote anything.`,
  counts: { budgets: budgets.length, categories: cats.length, line_items: items.length },
  budgets, categories: cats, line_items: items,
};
writeFileSync(out, JSON.stringify(payload, null, 1));
console.log(`Backed up ${budgets.length} budget rows, ${cats.length} categories, ${items.length} line items`);
for (const b of budgets.sort((a, c) => a.fiscal_year - c.fiscal_year || a.dataset_type.localeCompare(c.dataset_type)))
  console.log(`  FY${b.fiscal_year} ${b.dataset_type.padEnd(9)} ${String(b.total_budget).padStart(18)}  ${b.data_source}`);
console.log(`\nWrote ${out}`);
