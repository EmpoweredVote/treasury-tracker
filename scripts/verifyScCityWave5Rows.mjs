/**
 * Verify the South Carolina wave-5 rows AS STORED, independently of the loader.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * Usage:
 *   set -a && . .env && set +a && node scripts/verifyScCityWave5Rows.mjs
 *
 * ⚠⚠ `total = Σ items` read back from the DB is TAUTOLOGICAL — the loader wrote
 * both (project_austin_travis_onboarding). Every total here is checked against
 * the figure transcribed from the PRINTED STATEMENT, held in EXPECTED below, and
 * the tree is checked for the structural facts a $0 tie cannot see.
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
 * ⚠⚠ Do not regenerate these from the extractor output; that converts the only
 * independent check into a copy. They were read off the statement pages —
 * FY2017 p43, FY2018/FY2019/FY2020 p48, FY2021/FY2022 p50, FY2023 p40,
 * FY2024 p45, FY2025 p47.
 *
 * ⚠ FY2016 is deliberately ABSENT: no filing at FAC and none on the town's own
 * listing, which begins at FY2020. A declared gap, never a $0.
 *
 * ⭐ FY2020 IS THE TOWN'S OWN COPY, not a federal filing — the first year in this
 * family sourced outside FAC. It is verified here on exactly the same terms as
 * the other eight, which is the point: a document is trusted for what it can be
 * shown to be, not for who served the bytes.
 */
const EXPECTED = {
  revenue: {
    2017: 30862771, 2018: 34644613, 2019: 34168739, 2020: 33955085, 2021: 38309720,
    2022: 44022615, 2023: 44406559, 2024: 49313173, 2025: 56163870,
  },
  operating: {
    2017: 36430883, 2018: 37524918, 2019: 37671993, 2020: 39000968, 2021: 40959947,
    2022: 43092266, 2023: 48108322, 2024: 54822970, 2025: 57775830,
  },
};

/** ⚠⚠ `budgets.hierarchy` IS NULL for this family — the tree is in budget_categories. */
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

const leafRows = (cats) => {
  const parents = new Set(cats.map((c) => c.parent_id).filter(Boolean));
  return cats.filter((c) => !parents.has(c.id));
};
const rootRows = (cats) => cats.filter((c) => !c.parent_id);
const childrenOf = (cats, id) => cats.filter((c) => c.parent_id === id);

let failures = 0;
const fail = (m) => { failures += 1; console.log(`  FAIL ${m}`); };

const NAME = 'Town of Hilton Head Island';
const rows = await readAll(`${NAME} ACFR — General Fund`);
console.log(`\n=== ${NAME} — ${rows.length} rows, ${new Set(rows.map((r) => r.id)).size} distinct ids`);

// ⚠ NINE years x 2 datasets. Eight federal filings plus the town's own FY2020.
if (rows.length !== 18) fail(`expected 18 rows, got ${rows.length}`);
if (new Set(rows.map((r) => r.municipality_id)).size !== 1) {
  fail('rows span more than one municipality_id');
}
// ⚠⚠ FY2016 MUST NOT EXIST. A declared gap that quietly became a row is the
// failure mode this whole campaign is organised against.
if (rows.some((r) => r.fiscal_year === 2016)) fail('FY2016 is a declared gap but rows exist');
// ⚠ And FY2020 MUST exist — it is the year three call sites silently dropped.
for (const ds of ['revenue', 'operating']) {
  if (!rows.some((r) => r.fiscal_year === 2020 && r.dataset_type === ds)) {
    fail(`FY2020 ${ds} is missing — the self-published year did not load`);
  }
}

for (const r of rows) {
  const want = EXPECTED[r.dataset_type]?.[r.fiscal_year];
  const tag = `FY${r.fiscal_year} ${r.dataset_type}`;
  if (want === undefined) { fail(`${tag}: unexpected entity-year in the database`); continue; }
  if (Number(r.total_budget) !== want) {
    fail(`${tag}: stored ${r.total_budget} but the statement prints ${want}`);
  }
  const cats = await readCategories(r.id);
  if (!cats.length) { fail(`${tag}: NO categories stored`); continue; }
  const sum = leafRows(cats).reduce((a, n) => a + Number(n.amount || 0), 0);
  if (sum !== Number(r.total_budget)) {
    fail(`${tag}: leaves sum to ${sum}, stored total ${r.total_budget}`);
  }
  for (const c of cats) {
    const kids = childrenOf(cats, c.id);
    if (!kids.length) continue;
    const kidSum = kids.reduce((a, k) => a + Number(k.amount || 0), 0);
    if (kidSum !== Number(c.amount)) {
      fail(`${tag}: parent "${c.name}" is ${c.amount} but its ${kids.length} children sum to ${kidSum}`);
    }
  }
  if (r.fund_scope !== 'general_fund') fail(`${tag}: fund_scope=${r.fund_scope}`);
  if (r.basis !== 'actual') fail(`${tag}: basis=${r.basis}`);
  if (r.audit_grade !== 'audited_gaap') fail(`${tag}: audit_grade=${r.audit_grade}`);
  if (r.derivation !== 'published') fail(`${tag}: derivation=${r.derivation}`);
  // ⚠ JULY on every year. A wrong month moves no dollar and fails no tie gate.
  if (r.fiscal_year_start_month !== 7) {
    fail(`${tag}: fiscal_year_start_month=${r.fiscal_year_start_month}, expected 7`);
  }
  if (!r.source_url) fail(`${tag}: no source_url`);
}

/**
 * ⚠⚠ STRUCTURE, WHICH A $0 TIE CANNOT SEE.
 *
 * `Capital Outlay` is a PARENT here and a valued ROOT LEAF in Florence, loaded
 * one wave earlier — the Hillsboro inversion for the THIRD time inside South
 * Carolina. Asserted from the STORED tree, so a depth-truncating consumer (the
 * toRpcTree / toBudgetTree defect, which stayed green on every tie) is caught.
 *
 * ⚠⚠ AND IT IS ASSERTED ON FY2017, NOT FY2025, FOR A REASON. In FY2025 the town
 * prints a DASH against every `Capital Outlay` function in the GENERAL FUND
 * column — that money is in other funds — so the group is correctly dropped as
 * `zero_rows` and FY2025 stores only `Current | Debt Service`. Asserting the
 * inversion on a year whose column is empty would have "failed" on correct
 * behaviour, and worse, a verifier written the other way round (expecting two
 * roots) would have PASSED FY2025 while never testing the inversion at all.
 * ⭐ A structural claim has to be asserted in a year that can actually express it.
 */
const op2025 = rows.find((r) => r.fiscal_year === 2025 && r.dataset_type === 'operating');
const cats2025 = await readCategories(op2025.id);
console.log(`  FY2025 operating roots : ${rootRows(cats2025).map((n) => n.name).join(' | ')}`
  + '   (Capital Outlay is all dashes in the GF column this year — zero_rows, not a $0 category)');
if (rootRows(cats2025).some((n) => /capital outlay/i.test(n.name))) {
  fail('FY2025 stores a Capital Outlay root, but its GF column is entirely dashes');
}

const op2017 = rows.find((r) => r.fiscal_year === 2017 && r.dataset_type === 'operating');
const cats = await readCategories(op2017.id);
const roots = rootRows(cats);
console.log(`  FY2017 operating roots : ${roots.map((n) => n.name).join(' | ')}`);
console.log(`  categories stored      : ${cats.length}, max depth ${Math.max(...cats.map((c) => c.depth))}`);

const capital = roots.find((n) => /capital outlay/i.test(n.name));
if (!capital) fail('no Capital Outlay root in FY2017 operating');
else if (childrenOf(cats, capital.id).length !== 4) {
  fail('Capital outlay should be a PARENT over 4 children here (Florence\'s is a valued '
    + `ROOT LEAF), got ${childrenOf(cats, capital.id).length}`);
}
for (const label of ['current']) {
  const node = roots.find((n) => new RegExp(`^${label}$`, 'i').test(n.name));
  if (!node) fail(`no ${label} root in FY2017 operating`);
  else if (!childrenOf(cats, node.id).length) fail(`${label} has no children`);
}
if (Math.max(...cats.map((c) => c.depth)) < 1) fail('the stored tree is flat — depth was truncated');

/**
 * ⚠ The same function label appears under BOTH `Current` and `Capital Outlay` in
 * several years. Those are two distinct paths and nothing may merge them by name
 * (the Sumter assertion, re-run here because it is a property of the DOCUMENT and
 * has to be re-established per issuer).
 */
const cur = roots.find((n) => /^current$/i.test(n.name));
if (cur && capital) {
  const curKids = childrenOf(cats, cur.id).map((c) => c.name);
  const capKids = childrenOf(cats, capital.id).map((c) => c.name);
  const both = curKids.filter((n) => capKids.includes(n));
  console.log(`  labels under BOTH Current and Capital Outlay: ${both.length}`
    + (both.length ? ` (${both.join(', ')})` : ''));
}

// ⚠ Revenue is FLAT — a grouped revenue tree here would mean a config drifted.
const rev2025 = rows.find((r) => r.fiscal_year === 2025 && r.dataset_type === 'revenue');
const revCats = await readCategories(rev2025.id);
const revParents = revCats.filter((c) => childrenOf(revCats, c.id).length);
console.log(`  FY2025 revenue         : ${revCats.length} categories, ${revParents.length} parents`);
if (revParents.length) fail(`revenue should be FLAT, found ${revParents.length} parent(s)`);

// ⚠ And the family total, so a stray row elsewhere shows up.
const { count, error } = await s.from('budgets')
  .select('id', { count: 'exact' })
  .like('data_source', '%ACFR — General Fund%')
  .in('fund_scope', ['general_fund'])
  .limit(1);
if (error) throw new Error(JSON.stringify(error));
console.log(`\nrows matching /ACFR — General Fund/ with fund_scope=general_fund: ${count}`);

console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✅ every wave-5 row verified against the printed statement');
process.exit(failures ? 1 : 0);
