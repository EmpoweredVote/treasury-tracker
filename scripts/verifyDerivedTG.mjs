#!/usr/bin/env node
/**
 * SCOPE-04 Task 9 — the ACFR verification harness.
 *
 * Derived Total Governmental is arithmetic over a feed. This checks it against a
 * figure a GOVERNMENT PRINTED: each city's own audited "Total Expenditures /
 * Total Revenues, Governmental Funds". That oracle shares no code and no
 * strategy with the SCO feed, which is what makes agreement mean something.
 *
 * ⚠ THE TIE TEST HAS THREE OUTCOMES, NOT TWO.
 *
 *   ties                    derived == printed
 *   source error            they differ and the SCO feed is demonstrably wrong
 *                           -> quarantine that row, do NOT hand-correct it
 *   diverges legitimately   they differ and BOTH are right
 *
 * The third bucket is not a hedge. Placentia FY2021 misses by $51M purely
 * because it reported a pension-obligation-bond contribution as debt-service
 * expenditure where GAAP puts it below the line; signature is a `Debt Service`
 * child over ~25% of total, 26 rows database-wide. A naive "must tie" gate would
 * quarantine a CORRECT figure.
 *
 * ⚠ UNREACHABLE IS NOT A FAILURE AND IS NEVER A PASS. CA city sites 403
 * automated fetches even with full browser headers and archive.org rate-limits
 * at 429, so a chunk of any sample is simply unavailable. It is reported in its
 * own bucket and never folded into the pass count -- that discipline is the only
 * reason the earlier 6/6 was honest.
 *
 * Usage:
 *   node scripts/verifyDerivedTG.mjs --select-sample   # write the target list
 *   node scripts/verifyDerivedTG.mjs --report          # score fetched results
 *
 * Spec: docs/superpowers/specs/2026-08-21-scope-04-design.md §3
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSupabase } from './lib/scopeDb.mjs';
import { deriveTotalGovernmental, isEnterpriseRoot } from './lib/derivedTotalGovernmental.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = join(HERE, 'data', 'scope04VerificationSample.json');

/** The two figures PR #36 already proved. If the reader disagrees, the READER is wrong. */
export const CONTROLS = [
  { name: 'Cerritos', state: 'CA', fiscal_year: 2017, dataset_type: 'operating', printed: 69951331 },
  { name: 'Lakewood', state: 'CA', fiscal_year: 2017, dataset_type: 'operating', printed: 57831166 },
];

/**
 * Every era-B all_funds row with its root categories.
 *
 * ⚠ Paged reads ORDER BY THE PRIMARY KEY LAST. 79,840 of 79,939 rows tie on
 * (municipality_id, fiscal_year), and LIMIT/OFFSET over a non-total order is
 * undefined -- a row can come back twice while another is skipped, and the two
 * cancel so the COUNT stays right while the row SET is wrong. That cost an
 * investigation on 2026-08-18.
 */
export async function fetchEligible(supabase) {
  const munis = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.schema('treasury').from('municipalities')
      .select('id, name, state, entity_type').order('id').range(from, from + 999);
    if (error) throw new Error(`municipalities: ${error.message}`);
    if (!data?.length) break;
    for (const m of data) munis.set(m.id, m);
    if (data.length < 1000) break;
  }

  const budgets = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.schema('treasury').from('budgets')
      .select('id, municipality_id, fiscal_year, dataset_type, total_budget::text, basis, '
        + 'data_source, source_url, source_date, fiscal_year_start_month, period_label')
      .eq('fund_scope', 'all_funds').gte('fiscal_year', 2017)
      .order('municipality_id').order('fiscal_year').order('id')
      .range(from, from + 999);
    if (error) throw new Error(`budgets: ${error.message}`);
    if (!data?.length) break;
    budgets.push(...data);
    if (data.length < 1000) break;
  }

  const byId = new Map(budgets.map((b) => [b.id, { ...b, roots: [] }]));
  // ⚠ FILTER BY BUDGET ID. Selecting every parent_id-null row table-wide pulls the
  // roots of all 80,076 budgets (~640k rows, ~640 paged requests) to keep the 8,528
  // that matter. Chunked `.in()` keeps it to the era-B all_funds set.
  const ids = [...byId.keys()];
  const CHUNK = 150;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.schema('treasury').from('budget_categories')
        .select('budget_id, name, amount::text')
        .is('parent_id', null)
        .in('budget_id', slice)
        .order('budget_id').order('id')
        .range(from, from + 999);
      if (error) throw new Error(`categories: ${error.message}`);
      if (!data?.length) break;
      for (const c of data) {
        const b = byId.get(c.budget_id);
        if (b) b.roots.push({ name: c.name, amount: Number(c.amount) });
      }
      if (data.length < 1000) break;
    }
  }

  return [...byId.values()].map((b) => {
    const m = munis.get(b.municipality_id);
    const d = deriveTotalGovernmental(b.roots);
    const total = Number(b.total_budget);
    return {
      ...b,
      name: m?.name ?? '(unknown)',
      state: m?.state ?? '',
      entity_type: m?.entity_type ?? '',
      total,
      derived_tg: d.totalGovernmental,
      enterprise: d.enterprise,
      unrecognised: d.unrecognised,
      ent_roots: b.roots.filter((r) => isEnterpriseRoot(r.name)).length,
      ent_share: total > 0 ? d.enterprise / total : null,
    };
  });
}

/**
 * 16 city-years: 4 size quartiles x 2 datasets x low/high enterprise share.
 *
 * ⚠ COMMITTED BEFORE ANYTHING IS FETCHED. Choosing targets after seeing results
 * is curve-fitting -- the error that got the LA-01 verdict retracted. Ordering is
 * (municipality_id, fiscal_year, id) with no runtime randomness, so anyone can
 * reproduce this exact list.
 */
export function selectSample(rows) {
  const elig = rows.filter((r) => r.ent_roots >= 1 && r.total > 0 && r.ent_share != null);
  const bySize = [...elig].sort((a, b) => a.total - b.total);
  const shares = elig.map((r) => r.ent_share).sort((a, b) => a - b);
  const median = shares[Math.floor(shares.length / 2)];

  const quartile = new Map();
  bySize.forEach((r, i) => quartile.set(r.id, Math.min(3, Math.floor(i / (bySize.length / 4)))));

  const cells = new Map();
  const ordered = [...elig].sort((a, b) =>
    a.municipality_id.localeCompare(b.municipality_id)
    || a.fiscal_year - b.fiscal_year
    || a.id.localeCompare(b.id));
  for (const r of ordered) {
    const key = `${quartile.get(r.id)}|${r.dataset_type}|${r.ent_share >= median ? 'high' : 'low'}`;
    if (!cells.has(key)) cells.set(key, r);
  }
  return [...cells.entries()]
    .map(([cell, r]) => ({
      cell,
      size_quartile: Number(cell.split('|')[0]) + 1,
      enterprise_band: cell.split('|')[2],
      municipality_id: r.municipality_id,
      name: r.name,
      state: r.state,
      entity_type: r.entity_type,
      fiscal_year: r.fiscal_year,
      dataset_type: r.dataset_type,
      budget_id: r.id,
      all_funds_total: r.total,
      derived_tg: r.derived_tg,
      enterprise: r.enterprise,
      enterprise_pct: Number((r.ent_share * 100).toFixed(1)),
      data_source: r.data_source,
      source_url: r.source_url,
    }))
    .sort((a, b) => a.municipality_id.localeCompare(b.municipality_id)
      || a.fiscal_year - b.fiscal_year
      || a.dataset_type.localeCompare(b.dataset_type));
}

async function main() {
  const { values } = parseArgs({
    options: {
      'select-sample': { type: 'boolean', default: false },
      report: { type: 'boolean', default: false },
    },
  });

  const supabase = await getSupabase();
  const rows = await fetchEligible(supabase);
  const elig = rows.filter((r) => r.ent_roots >= 1 && r.total > 0);
  console.log(`era-B all_funds rows: ${rows.length.toLocaleString()}`);
  console.log(`eligible (>=1 enterprise root, total>0): ${elig.length.toLocaleString()}`
    + ` across ${new Set(elig.map((r) => r.municipality_id)).size} entities`);

  if (values['select-sample']) {
    const sample = selectSample(rows);
    writeFileSync(SAMPLE_PATH, `${JSON.stringify({
      _what: 'SCOPE-04 Task 9 verification targets. COMMITTED BEFORE ANY FETCH — choosing '
        + 'targets after seeing results is curve-fitting, the error that retracted the LA-01 verdict.',
      _selection: '4 total_budget quartiles x {operating,revenue} x enterprise-share {low,high}, '
        + 'one row per cell, ordered by (municipality_id, fiscal_year, id). No runtime randomness.',
      _controls: 'Cerritos FY2017 (69,951,331) and Lakewood FY2017 (57,831,166) ride along as '
        + 'controls — figures PR #36 already proved. If the reader disagrees with them, the reader is wrong.',
      _stopping_rule: 'Write only if >=10 assessable city-years AND every non-tie is explained as '
        + 'either a documented source error (quarantine) or a documented legitimate divergence '
        + '(publish, signature recorded). A single unexplained miss halts the milestone.',
      generated_from: 'node scripts/verifyDerivedTG.mjs --select-sample',
      count: sample.length,
      controls: CONTROLS,
      targets: sample,
    }, null, 2)}\n`);
    console.log(`\nwrote ${SAMPLE_PATH}: ${sample.length} targets`);
    for (const t of sample) {
      console.log(`  Q${t.size_quartile} ${t.enterprise_band.padEnd(4)} ${t.dataset_type.padEnd(9)}`
        + ` ${t.name.padEnd(20)} FY${t.fiscal_year}  all_funds ${t.all_funds_total.toLocaleString().padStart(13)}`
        + `  TG ${t.derived_tg.toLocaleString().padStart(13)}  ent ${String(t.enterprise_pct).padStart(5)}%`);
    }
  }

  if (values.report) {
    if (!existsSync(SAMPLE_PATH)) throw new Error('no sample file — run --select-sample first');
    const sample = JSON.parse(readFileSync(SAMPLE_PATH, 'utf8'));
    console.log(`\nsample of ${sample.count} targets; scoring is manual per city until each ACFR is fetched.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
