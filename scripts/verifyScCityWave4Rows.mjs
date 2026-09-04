/**
 * Verify the South Carolina wave-4 rows AS STORED, independently of the loader.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Usage:
 *   set -a && . .env && set +a && node scripts/verifyScCityWave4Rows.mjs
 *
 * ⚠⚠ `total = Σ items` read back from the DB is TAUTOLOGICAL — the loader wrote
 * both (project_austin_travis_onboarding). So every total here is checked against
 * the figure transcribed from the PRINTED STATEMENT, held in EXPECTED below, and
 * the tree is checked for the structural facts that a $0 tie cannot see.
 *
 * ⚠⚠ PAGED WITH A TOTAL ORDER, and DISTINCT ids asserted == row count — the guard
 * for the defect that has now bitten four times
 * (reference_paged_reads_need_total_order).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('No service key in the environment.'); process.exit(1); }
const s = createClient(url, key).schema('treasury');

/**
 * HAND-TRANSCRIBED from the printed General Fund column of each statement page.
 *
 * ⚠⚠ THIS TABLE IS THE WHOLE POINT OF THE SCRIPT. Reading the loaded total back
 * and comparing it to the loaded line items is TAUTOLOGICAL — the loader wrote
 * both from one tree, so it agrees with itself whatever it read
 * (project_austin_travis_onboarding). These figures come from the DOCUMENTS, so
 * they are an oracle the pipeline never touched. Do not regenerate them from the
 * extractor output; that would convert the only independent check into a copy.
 */
const EXPECTED = {
  sumter: {
    revenue: { 2016: 41249903, 2017: 39386294, 2018: 42993871, 2019: 36364171, 2020: 39815848, 2021: 39131890, 2022: 62601026, 2023: 68592155, 2024: 85437318, 2025: 69939637 },
    operating: { 2016: 42571437, 2017: 44034396, 2018: 58931899, 2019: 44090567, 2020: 45138343, 2021: 45883580, 2022: 49005129, 2023: 57621173, 2024: 64284680, 2025: 72624129 },
  },
  florence: {
    revenue: { 2016: 27961115, 2017: 32910842, 2018: 31627324, 2019: 37117134, 2020: 35633900, 2021: 38854872, 2022: 44750975, 2023: 39834645, 2024: 42342051, 2025: 47848109 },
    operating: { 2016: 33514818, 2017: 33884559, 2018: 36458899, 2019: 39704629, 2020: 46007513, 2021: 44154561, 2022: 59199871, 2023: 49072766, 2024: 58637369, 2025: 57643737 },
  },
};

/**
 * ⚠⚠ `budgets.hierarchy` IS NULL FOR THIS WHOLE FAMILY — the tree lives in
 * `treasury.budget_categories`, keyed by `budget_id` with `parent_id`/`depth`.
 * Checked against the ALREADY-LOADED Spartanburg and Charleston rows before
 * concluding anything, so this is the family's storage shape and not a defect of
 * the wave-4 write. Reading the wrong column returns null and a leaf sum of 0,
 * which would have looked exactly like a truncated tree.
 */
async function readCategories(budgetId) {
  const rows = [];
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await s.from('budget_categories')
      .select('id, parent_id, name, amount, depth')
      .eq('budget_id', budgetId)
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(JSON.stringify(error));
    rows.push(...data);
    if (data.length < page) break;
  }
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) {
    throw new Error(`PAGING DEFECT in categories: ${rows.length} rows, ${ids.size} distinct ids`);
  }
  return rows;
}

/** Read every row for one entity, PAGED, ordered by id (a total order). */
async function readAll(prefix) {
  const rows = [];
  const page = 500;
  for (let from = 0; ; from += page) {
    const { data, error } = await s.from('budgets')
      .select('id, data_source, fiscal_year, dataset_type, total_budget, hierarchy, '
        + 'fund_scope, basis, audit_grade, derivation, fiscal_year_start_month, source_url, municipality_id')
      .like('data_source', `${prefix}%`)
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(JSON.stringify(error));
    rows.push(...data);
    if (data.length < page) break;
  }
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) {
    throw new Error(`PAGING DEFECT: ${rows.length} rows but ${ids.size} distinct ids`);
  }
  return rows;
}

/** A category with no child rows pointing at it. */
const leafRows = (cats) => {
  const parents = new Set(cats.map((c) => c.parent_id).filter(Boolean));
  return cats.filter((c) => !parents.has(c.id));
};
const rootRows = (cats) => cats.filter((c) => !c.parent_id);
const childrenOf = (cats, id) => cats.filter((c) => c.parent_id === id);

let failures = 0;
const fail = (m) => { failures += 1; console.log(`  FAIL ${m}`); };

for (const [key, name] of [['sumter', 'City of Sumter'], ['florence', 'City of Florence']]) {
  const rows = await readAll(`${name} ACFR — General Fund`);
  console.log(`\n=== ${name} — ${rows.length} rows, ${new Set(rows.map((r) => r.id)).size} distinct ids`);
  if (rows.length !== 20) fail(`${name}: expected 20 rows, got ${rows.length}`);
  if (new Set(rows.map((r) => r.municipality_id)).size !== 1) {
    fail(`${name}: rows span more than one municipality_id`);
  }
  for (const r of rows) {
    const want = EXPECTED[key][r.dataset_type]?.[r.fiscal_year];
    const tag = `${name} FY${r.fiscal_year} ${r.dataset_type}`;
    // 1. The stored total against the PRINTED figure — not against its own items.
    if (want === undefined) { fail(`${tag}: unexpected entity-year in the database`); continue; }
    if (Number(r.total_budget) !== want) {
      fail(`${tag}: stored ${r.total_budget} but the statement prints ${want}`);
    }
    // 2. The stored tree must add up to the stored total (catches a truncated
    //    tree — the toRpcTree/toBudgetTree defect, which stayed green on the tie).
    const cats = await readCategories(r.id);
    if (!cats.length) { fail(`${tag}: NO categories stored`); continue; }
    const sum = leafRows(cats).reduce((a, n) => a + Number(n.amount || 0), 0);
    if (sum !== Number(r.total_budget)) {
      fail(`${tag}: leaves sum to ${sum}, stored total ${r.total_budget}`);
    }
    // ⚠ And every PARENT must equal its own children, at every level.
    for (const c of cats) {
      const kids = childrenOf(cats, c.id);
      if (!kids.length) continue;
      const kidSum = kids.reduce((a, k) => a + Number(k.amount || 0), 0);
      if (kidSum !== Number(c.amount)) {
        fail(`${tag}: parent "${c.name}" is ${c.amount} but its ${kids.length} children sum to ${kidSum}`);
      }
    }
    // 3. The axes.
    if (r.fund_scope !== 'general_fund') fail(`${tag}: fund_scope=${r.fund_scope}`);
    if (r.basis !== 'actual') fail(`${tag}: basis=${r.basis}`);
    if (r.audit_grade !== 'audited_gaap') fail(`${tag}: audit_grade=${r.audit_grade}`);
    if (r.derivation !== 'published') fail(`${tag}: derivation=${r.derivation}`);
    // 4. ⚠ JULY. A wrong month moves no dollar and fails no tie gate.
    if (r.fiscal_year_start_month !== 7) {
      fail(`${tag}: fiscal_year_start_month=${r.fiscal_year_start_month}, expected 7`);
    }
    if (!r.source_url) fail(`${tag}: no source_url`);
  }

  // 5. ⚠⚠ STRUCTURE, which a $0 tie cannot see. Sumter's Capital Outlay is a
  //    PARENT over children; Florence's is a valued ROOT LEAF. Asserted from the
  //    STORED tree, so a depth-truncating consumer would be caught here.
  const op2024 = rows.find((r) => r.fiscal_year === 2024 && r.dataset_type === 'operating');
  const cats = await readCategories(op2024.id);
  const roots = rootRows(cats);
  const capital = roots.find((n) => /capital outlay/i.test(n.name));
  console.log(`  FY2024 operating roots : ${roots.map((n) => n.name).join(' | ')}`);
  console.log(`  categories stored      : ${cats.length}, max depth ${Math.max(...cats.map((c) => c.depth))}`);
  if (!capital) fail(`${name}: no Capital Outlay root in FY2024 operating`);
  else if (key === 'sumter') {
    const kids = childrenOf(cats, capital.id);
    if (kids.length !== 5) {
      fail(`Sumter: Capital Outlay should be a PARENT over 5 children, got ${kids.length}`);
    }
    // ⚠ The same label at two paths must NOT have been merged by name.
    const cur = roots.find((n) => /^current$/i.test(n.name));
    const curKids = childrenOf(cats, cur.id).map((c) => c.name);
    const both = curKids.filter((n) => kids.some((k) => k.name === n));
    console.log(`  labels under BOTH Current and Capital Outlay: ${both.length} (${both.join(', ')})`);
    if (both.length < 3) fail('Sumter: expected repeated function labels at two paths');
  } else {
    const kids = childrenOf(cats, capital.id);
    if (kids.length) {
      fail(`Florence: Capital Outlay should be a valued ROOT LEAF, got ${kids.length} children`);
    }
    if (!Number(capital.amount)) fail('Florence: Capital Outlay root leaf carries no value');
  }
}

// 6. ⚠ And the family total, so a stray row elsewhere shows up.
const { count, error } = await s.from('budgets')
  .select('id', { count: 'exact' })
  .like('data_source', '%ACFR — General Fund%')
  .in('fund_scope', ['general_fund'])
  .limit(1);
if (error) throw new Error(JSON.stringify(error));
console.log(`\nrows matching /ACFR — General Fund/ with fund_scope=general_fund: ${count}`);

console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✅ every wave-4 row verified against the printed statement');
process.exit(failures ? 1 : 0);
