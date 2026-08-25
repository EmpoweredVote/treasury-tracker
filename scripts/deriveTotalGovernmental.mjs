#!/usr/bin/env node
/**
 * SCOPE-04 Task 11 — write derived Total Governmental rows.
 *
 * DRY-RUN BY DEFAULT. `--write` is the only thing that touches the database.
 *
 * TG = Σ governmental roots, never all_funds − enterprise. The two are
 * algebraically identical here, but Σ-governmental is immune to enterprise-side
 * defects, which is what turns the 44 negative-enterprise rows into a disclosure
 * problem on the slice rather than a correctness problem in the figure.
 *
 * ⚠ Every check below REFUSES a row rather than warning about it. A loader that
 * warns and continues is how a wrong figure ships between two correct ones.
 *
 * Usage:
 *   node scripts/deriveTotalGovernmental.mjs            # dry run
 *   node scripts/deriveTotalGovernmental.mjs --write
 *
 * Spec: docs/superpowers/specs/2026-08-21-scope-04-design.md
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSupabase } from './lib/scopeDb.mjs';
import { deriveTotalGovernmental, isEnterpriseRoot } from './lib/derivedTotalGovernmental.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IDS_PATH = join(HERE, 'data', 'scope04CreatedIds.json');

/** Parent data_source -> the derived row's OWN label. */
const DERIVED_SOURCE = {
  'CA State Controller - Expenditures':
    'Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)',
  'CA State Controller - Revenues':
    'Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)',
  'CA State Controller - County Expenditures':
    'Treasury Tracker derived: Total Governmental (CA State Controller - County Expenditures)',
  'CA State Controller - County Revenues':
    'Treasury Tracker derived: Total Governmental (CA State Controller - County Revenues)',
};

/**
 * ⚠ A COLON, never an em-dash. The API serves `data_source` double-encoded for
 * every em-dash label (Austin's included), so an em-dash here would render as
 * mojibake in the source chip. That defect is pre-existing and lives in
 * C:\EV-Accounts; this label simply must not step on it.
 *
 * ⚠ These labels are also why classifyFundScope cannot un-derive these rows.
 * `ca-sco-expenditures` is anchored on /^CA State Controller - Expenditures$/, so
 * inheriting the parent label would have let the next stamper run overwrite
 * total_governmental back to all_funds on all 7,664 rows.
 */

/**
 * Suppressed, each for a PROVEN reason, and scoped to the exact city-year.
 *
 * ⚠ Cerritos FY2017 is deliberately ABSENT. Its all-funds total and its ISF root
 * are wrong, but its GOVERNMENTAL total ties EXACTLY to the audited
 * 69,951,331 — so its derived TG is audited-correct and suppressing it would
 * hide a figure we have proven right. The governmental tie is the discriminator,
 * not "is anything about this row wrong".
 */
const QUARANTINE = [
  { name: 'Brisbane', state: 'CA', fiscal_year: 2017,
    why: 'does not reconcile under any classification; total_budget overstated 5,348,719. '
       + 'The duplication is in the SCO feed, so this is a DISCLOSURE problem — do not '
       + 'hand-subtract, that would invent a figure no government published.' },
  { name: 'Turlock', state: 'CA', fiscal_year: 2021, why: 'governmental total off 986,494' },
  { name: 'Scotts Valley', state: 'CA', fiscal_year: 2021, why: 'governmental total off 35,668' },
  { name: 'Trinidad', state: 'CA', fiscal_year: 2019,
    why: 'probable source error; ⚠ verification has failed to REACH Trinidad twice, so this '
       + 'is suppressed as unverified rather than as proven-wrong' },
];
const isQuarantined = (r) => QUARANTINE.some(
  (q) => q.name === r.name && q.state === r.state && q.fiscal_year === r.fiscal_year);

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function pageAll(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function main() {
  const { values } = parseArgs({ options: {
    write: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
  } });
  const WRITE = values.write === true;
  const LIMIT = values.limit ? Number(values.limit) : null;
  console.log(WRITE ? '*** WRITE MODE ***' : 'dry run (no database writes)');

  const supabase = await getSupabase();

  // ── municipalities ────────────────────────────────────────────────────────
  const munis = new Map();
  for (const m of await pageAll((from) => supabase.schema('treasury').from('municipalities')
    .select('id, name, state').order('id').range(from, from + 999))) munis.set(m.id, m);

  // ── era-B all_funds budgets ───────────────────────────────────────────────
  // ⚠ PRIMARY KEY ORDERED LAST. 79,840 of 79,939 rows tie on (muni, fiscal_year);
  // LIMIT/OFFSET over a non-total order is undefined, and a duplicate plus a miss
  // CANCEL — the count stays right while the row set is wrong.
  const budgets = await pageAll((from) => supabase.schema('treasury').from('budgets')
    .select('id, municipality_id, fiscal_year, dataset_type, total_budget::text, basis, '
      + 'data_source, source_url, source_date, fiscal_year_start_month, period_label, hierarchy')
    .eq('fund_scope', 'all_funds').gte('fiscal_year', 2017)
    .order('municipality_id').order('fiscal_year').order('id').range(from, from + 999));
  console.log(`era-B all_funds budgets: ${budgets.length.toLocaleString()}`);

  const byId = new Map(budgets.map((b) => {
    const m = munis.get(b.municipality_id);
    return [b.id, { ...b, name: m?.name ?? '(unknown)', state: m?.state ?? '', cats: [] }];
  }));

  // ── categories (roots + children; max_depth is 1 for this corpus) ─────────
  const ids = [...byId.keys()];
  for (const slice of chunk(ids, 150)) {
    for (const c of await pageAll((from) => supabase.schema('treasury').from('budget_categories')
      .select('id, budget_id, parent_id, name, amount::text, sort_order')
      .in('budget_id', slice).order('budget_id').order('id').range(from, from + 999))) {
      byId.get(c.budget_id)?.cats.push(c);
    }
  }

  // ── triage ────────────────────────────────────────────────────────────────
  // ⚠ TWO KINDS OF REFUSAL, and conflating them is a design error I made first time
  // round. `halt` means the loader's own assumptions are broken and NOTHING should
  // be written until a human looks. `excluded` means this ROW is defective but the
  // other 7,650 are fine — the plan says "refuse the row", not "refuse the run",
  // and the spec PREDICTED exactly 6 of these in advance, so halting on them would
  // have made the milestone unshippable by its own design.
  const rootless = [], noEnterprise = [], quarantined = [], halt = [], excluded = [];
  const negOpEx = [], negEnterpriseRoot = [];
  let candidates = [];
  for (const b of byId.values()) {
    const roots = b.cats.filter((c) => c.parent_id === null)
      .map((c) => ({ ...c, amount: Number(c.amount) }));
    if (roots.length === 0) { rootless.push(b); continue; }
    if (!roots.some((r) => isEnterpriseRoot(r.name))) { noEnterprise.push(b); continue; }
    if (isQuarantined(b)) { quarantined.push(b); continue; }

    const d = deriveTotalGovernmental(roots);
    const total = Number(b.total_budget);

    // ⚠ THE VOCABULARY GUARD. Classification is a NEGATIVE match, so an
    // enterprise-like root under a new name would be counted as governmental and
    // inflate TG with NO arithmetic gate able to see it — the era-A failure shape.
    // ── HALT conditions: the loader's assumptions are broken ────────────────
    // The vocabulary guard. Classification is a NEGATIVE match, so an
    // enterprise-like root under a new name would be counted as governmental and
    // inflate TG with NO arithmetic gate able to see it — the era-A failure shape.
    if (d.unrecognised.length) { halt.push({ b, why: `unrecognised root(s): ${d.unrecognised.join(', ')}` }); continue; }
    // ⚠ THIS GUARD USED TO ASSERT `=== 7`, AND THAT WAS THE BUG IT WAS MEANT TO
    // CATCH. All 7,664 rows passed it, which was read as confirmation; in fact it
    // only confirmed that every row matched the literal 7 the RPC hardcoded into
    // its INSERT. It validated CONFORMITY TO THE HARDCODE, NOT CORRECTNESS —
    // Inglewood closes September 30 and was 10 all along (PR #60), and Minnesota,
    // Ohio and Utah counties are calendar-year (PR #63).
    //
    // What actually matters for a derived row is that the parent states a usable
    // calendar, which is then carried through to the child below. So: require a
    // real month, never a particular one.
    const parentMonth = Number(b.fiscal_year_start_month);
    if (!Number.isInteger(parentMonth) || parentMonth < 1 || parentMonth > 12) {
      halt.push({ b, why: `fiscal_year_start_month ${b.fiscal_year_start_month} is not a month (1-12)` });
      continue;
    }
    if (!DERIVED_SOURCE[b.data_source]) { halt.push({ b, why: `no derived label for data_source "${b.data_source}"` }); continue; }

    // ── EXCLUDE conditions: this row is defective, the rest are fine ─────────
    if (!(d.totalGovernmental > 0)) { excluded.push({ b, why: `derived TG <= 0 (${d.totalGovernmental})` }); continue; }
    if (d.totalGovernmental > total) {
      // The negative-enterprise signature: if the enterprise side sums NEGATIVE
      // then Σ-governmental necessarily exceeds the stored all-funds total. The
      // spec predicted 6 of the 44 negative rows would surface here and noted the
      // gate is "not sufficient alone" — publishing a TG above its own parent
      // total would be indefensible, so the row is dropped and disclosed.
      excluded.push({ b, why: `derived TG ${d.totalGovernmental} > all_funds ${total}`
        + ` (enterprise ${d.enterprise})` });
      continue;
    }

    // ── FLAGS: recorded, never blocking. Σ-governmental is immune to
    // enterprise-side defects, so the FIGURE is right; the enterprise SLICE the
    // reader sees is what these affect.
    const entRoots = roots.filter((r) => isEnterpriseRoot(r.name));
    const entRootIds = new Set(entRoots.map((r) => r.id));
    if (entRoots.reduce((s, r) => s + r.amount, 0) < 0) negEnterpriseRoot.push(b);
    // ⚠ Narrowed to `Operating Expenses` specifically, per the spec's gate table.
    // Flagging ANY negative child under an enterprise root reported 503 rows, which
    // buries the 16 material lines the spec actually names.
    const opex = b.cats.filter((c) => c.parent_id && entRootIds.has(c.parent_id)
      && /^operating expenses$/i.test(c.name) && Number(c.amount) < 0);
    if (opex.length) negOpEx.push({ b, kids: opex.map((k) => `${k.name} ${Number(k.amount)}`) });

    // parentMonth travels with the candidate so the value WRITTEN is the same
    // one the guard above validated, rather than a second read of the field.
    candidates.push({ b, roots, derived: d.totalGovernmental, enterprise: d.enterprise, parentMonth });
  }

  if (LIMIT) candidates = candidates.slice(0, LIMIT);

  const named = (b) => `${b.name}, ${b.state} FY${b.fiscal_year} ${b.dataset_type}`;
  const eligible = candidates.length + quarantined.length + excluded.length + halt.length;
  console.log(`\neligible           ${eligible}   (expect 7,664)`);
  console.log(`  → to write       ${candidates.length}`);
  console.log(`  → quarantined    ${quarantined.length}`);
  for (const b of quarantined) console.log(`      ${named(b)}`);
  console.log(`  → excluded       ${excluded.length}`);
  for (const r of excluded) console.log(`      ${named(r.b)} — ${r.why}`);
  console.log(`skip-no-enterprise ${noEnterprise.length}   (expect 852)`);
  console.log(`skip-rootless      ${rootless.length}   (expect 12)`);
  for (const b of rootless) console.log(`      ${named(b)}  (total_budget ${b.total_budget})`);
  console.log(`flag-neg-enterprise-root ${negEnterpriseRoot.length}`);
  console.log(`flag-neg-operating-expenses ${negOpEx.length}`);
  for (const f of negOpEx.slice(0, 20)) console.log(`      ${named(f.b)} — ${f.kids.join('; ')}`);
  console.log(`HALT conditions    ${halt.length}`);
  for (const r of halt) console.log(`      ${named(r.b)} — ${r.why}`);

  if (halt.length) {
    console.error('\n❌ HALT — the loader\'s assumptions are broken. Nothing will be written.');
    console.error('   An unrecognised root means the era-B vocabulary changed and Task 1\'s');
    console.error('   guard is doing its job. Investigate before re-running.');
    process.exit(1);
  }
  if (eligible !== 7664) {
    console.error(`\n⚠ eligible is ${eligible}, expected 7,664 — the population moved. Investigate.`);
  }

  if (!WRITE) {
    console.log('\ndry run complete — nothing written. Re-run with --write.');
    return;
  }

  // ── the write ─────────────────────────────────────────────────────────────
  // Resumable: skip any (muni, fy, dataset) that already has a derived TG row, so
  // an interrupted run can be re-driven without double-writing.
  const existing = new Set((await pageAll((from) => supabase.schema('treasury').from('budgets')
    .select('id, municipality_id, fiscal_year, dataset_type')
    .eq('fund_scope', 'total_governmental').eq('derivation', 'derived')
    .order('municipality_id').order('fiscal_year').order('id').range(from, from + 999)))
    .map((r) => `${r.municipality_id}|${r.fiscal_year}|${r.dataset_type}`));
  if (existing.size) console.log(`resuming — ${existing.size} derived rows already present, skipping those`);

  const createdIds = existsSync(IDS_PATH) ? JSON.parse(readFileSync(IDS_PATH, 'utf8')) : [];
  const seen = new Set(createdIds);
  let wrote = 0, skipped = 0, failed = 0;

  for (const [i, cand] of candidates.entries()) {
    const { b, roots } = cand;
    const key = `${b.municipality_id}|${b.fiscal_year}|${b.dataset_type}`;
    if (existing.has(key)) { skipped += 1; continue; }

    // hierarchy CARRIED OVER VERBATIM — governmental roots and their children, no
    // re-nesting, no re-labelling, no re-parenting. Anything else invents structure.
    const govRoots = roots.filter((r) => !isEnterpriseRoot(r.name))
      .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
    const govRootIds = new Set(govRoots.map((r) => r.id));
    const kids = b.cats.filter((c) => c.parent_id && govRootIds.has(c.parent_id));
    const kidIds = kids.map((k) => k.id);

    const itemsByCat = new Map();
    for (const slice of chunk(kidIds, 150)) {
      for (const li of await pageAll((from) => supabase.schema('treasury').from('budget_line_items')
        .select('category_id, description, approved_amount::text, actual_amount::text, fund, expense_category')
        .in('category_id', slice).order('category_id').order('id').range(from, from + 999))) {
        if (!itemsByCat.has(li.category_id)) itemsByCat.set(li.category_id, []);
        // ⚠ THE KEYS ARE SWAPPED relative to the column names, and this is not a
        // typo: _treasury_insert_tree writes approved_amount from 'aa' and
        // actual_amount from 'a'. bulkLoadStateController sets both to the same
        // value so the swap is invisible there. Measured: 0 of 438,197 SCO line
        // items have the two differing, so this mapping is provably lossless here.
        itemsByCat.get(li.category_id).push({
          d: li.description,
          a: Number(li.actual_amount),
          aa: Number(li.approved_amount),
          f: li.fund,
          e: li.expense_category,
        });
      }
    }

    const tree = govRoots.map((r) => {
      const rk = kids.filter((k) => k.parent_id === r.id)
        .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
      return {
        n: r.name,
        a: r.amount,
        c: rk.map((k) => ({ n: k.name, a: Number(k.amount), i: itemsByCat.get(k.id) ?? [] })),
      };
    });

    const { data: result, error } = await supabase.rpc('treasury_sync_city_budget', {
      p_municipality_id: b.municipality_id,
      p_fiscal_year: b.fiscal_year,
      p_dataset_type: b.dataset_type,
      p_total: cand.derived,
      p_tree: tree,
      p_row_count: tree.length,
      p_data_source_name: DERIVED_SOURCE[b.data_source],
      p_source_url: b.source_url,
      p_source_date: b.source_date,
      p_fund_scope: 'total_governmental',
      p_basis: 'actual',
      p_derivation: 'derived',
      // A derived row describes the SAME period as the parent it was derived
      // from, so its calendar is the parent's — not a constant, and not a
      // lookup. This is the one caller that needs no external evidence at all.
      // Inglewood's parents read 10 (it closes September 30), so its derived
      // rows now read 10 too instead of the 7 the RPC used to hardcode.
      p_fiscal_year_start_month: cand.parentMonth,
    });

    // ⚠ CHECK result.error, NOT just rows_inserted. bulkLoadStateController checks
    // only the count, so the RPC's own ambiguity guard would undercount SILENTLY.
    if (error || !result || result.error) {
      failed += 1;
      console.error(`  ❌ ${named(b)} — ${error?.message ?? result?.error ?? 'no result'}`);
      if (failed > 20) { console.error('too many failures — stopping'); break; }
      continue;
    }
    if (!seen.has(result.budget_id)) { createdIds.push(result.budget_id); seen.add(result.budget_id); }
    wrote += 1;
    if (wrote % 200 === 0) {
      writeFileSync(IDS_PATH, `${JSON.stringify(createdIds, null, 2)}\n`);
      console.log(`  ... ${wrote} written (${i + 1}/${candidates.length})`);
    }
  }

  writeFileSync(IDS_PATH, `${JSON.stringify(createdIds, null, 2)}\n`);
  console.log(`\nwrote ${wrote} · skipped-existing ${skipped} · failed ${failed}`);
  console.log(`created ids recorded: ${createdIds.length} -> ${IDS_PATH}`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
