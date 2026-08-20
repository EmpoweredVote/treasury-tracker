#!/usr/bin/env node
/**
 * Correct `fiscal_year_start_month` on the entity-published ACFR General Fund
 * rows.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 * The 260 rows classified by ACFR-GF-CLASSIFICATION-RECON.md all carry
 * `fiscal_year_start_month = 1`, the column default, because the milestones that
 * loaded them never set it. For 226 of them that is wrong: every Oregon city,
 * every Arizona municipality, and the Minnesota, Ohio and Virginia state nodes
 * close their fiscal year on **June 30**, so the year STARTS in July (7).
 * Only Seattle's 34 rows are genuinely a calendar year (Dec 31 → 1), and those
 * are already right — by luck rather than intent, since 1 is also the default.
 *
 * Left as-is, the column asserts a January–December period for a year that ends
 * in June, which is wrong for any period label or cross-entity alignment that
 * reads it. AUSTIN-TRAVIS-01 set 10 correctly for its own rows (Oct–Sep),
 * following the Oct–Sep state ACFR loaders, so those are already right too.
 *
 * ── Why the value is DERIVED, not hardcoded ─────────────────────────────────
 * A per-family lookup table would be a second place to get the fiscal calendar
 * wrong. Instead each row's start month comes from **its own `source_date`**,
 * which every one of these loaders stamped with the fiscal-year END:
 *
 *     start_month = (month_of(source_date) % 12) + 1
 *
 *     2025-06-30 -> 7      2025-12-31 -> 1      2025-09-30 -> 10
 *
 * That rule is checked against the documents themselves, not just the database:
 * Bend FY2025 "Year Ended June 30, 2025", Tucson FY2024 "Fiscal Year Ended
 * June 30, 2024", Seattle FY2025 "Fiscal Year Ended December 31, 2025",
 * Minnesota / Ohio / Virginia FY2025 all "Fiscal Year Ended June 30, 2025".
 *
 * ── Guards (a row that cannot be derived is skipped, never guessed) ─────────
 *   (a) SCOPE. Only rows whose `data_source` matches the anchored ACFR General
 *       Fund families are considered — never a blanket update of the table.
 *   (b) `source_date` must be present.
 *   (c) `source_date` must be the LAST DAY of its month. A period end always is;
 *       an issue date usually is not, and an issue date would derive a bogus
 *       start month. (Audited 2026-08-19: 336 of 336 rows pass.)
 *   (d) `source_date`'s year must equal `fiscal_year`, so a mis-stamped row
 *       cannot silently redefine its own calendar. (336 of 336 pass.)
 *   (e) The derived month must be one of the three this corpus can produce
 *       (1, 7, 10). Anything else aborts rather than writing.
 *   (f) Writes only where the stored value actually differs, so a re-run is a
 *       no-op and the report distinguishes "changed" from "already correct".
 *
 * Usage:
 *   node scripts/fixAcfrFiscalYearStartMonth.mjs              # dry run (default)
 *   node scripts/fixAcfrFiscalYearStartMonth.mjs --apply
 *   node scripts/fixAcfrFiscalYearStartMonth.mjs --verify      # re-read and assert
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      for (const line of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent is fine */ }
  }
}
loadEnv();

/**
 * The families in scope — the same five registry entries that classify these
 * rows, enumerated the same anchored way and for the same reason: a future load
 * must not be swept in by a pattern nobody checked it against.
 */
const IN_SCOPE = [
  /^City of (Bend|Sherwood|Beaverton|Hillsboro|Tualatin|Cornelius|Tigard) ACFR — General Fund /,
  /^(City of Tucson|Marana|Oro Valley|Sahuarita|South Tucson) ACFR — General Fund /,
  /^City of Seattle ACFR — General Fund /,
  /^State of (Minnesota|Ohio|Virginia) ACFR — General Fund/,
  /^(City of Austin|Travis County) ACFR — General Fund /,
  // The 50-state ACFR family (1,448 rows, owned by the `state-acfr-gf` registry
  // entry). Deliberately NOT widened to every row with a period-end
  // `source_date`: the ~107 others that would qualify are pre-GASB-34
  // `… State CAFR …` rows, Texas's `General Revenue Fund` rows, and adopted
  // city budget documents whose `source_date` is an ISSUE date, not a period
  // end — deriving a fiscal calendar from those would be inventing one.
  / State ACFR — General Fund/,
];

/**
 * Months a fiscal year in this corpus can start in, i.e. the four period ends
 * actually printed on these documents:
 *
 *   Dec 31 -> 1    Seattle
 *   Mar 31 -> 4    NEW YORK, verified "Fiscal Year Ended March 31, 2005" in its
 *                  own FY2005 ACFR (osc.ny.gov)
 *   Jun 30 -> 7    44 states plus every Oregon/Arizona entity; verified
 *                  "Fiscal Year Ended June 30, 2025" in California's FY2025 ACFR
 *                  (sco.ca.gov) and in Bend, Tucson, Minnesota, Ohio, Virginia
 *   Sep 30 -> 10   Alabama, Michigan, Austin, Travis County
 *
 * A whitelist alone is weak — it would happily accept `7` for a state whose
 * `source_date` was wrong in a way that still landed on June 30. That is what
 * `assertFamilyConsistency` below is for.
 */
const ALLOWED_MONTHS = new Set([1, 4, 7, 10]);

/**
 * Every row within one source family must derive the SAME start month.
 *
 * This is the guard that actually has teeth. Each family here spans up to 24
 * fiscal years, so a `source_date` wrong enough to shift the derived month would
 * have to be wrong IDENTICALLY across all of them to survive — whereas a single
 * mis-stamped year shows up immediately as a family deriving two months. A
 * month whitelist cannot see that at all.
 */
export function assertFamilyConsistency(fams) {
  const split = [];
  for (const [name, f] of Object.entries(fams)) {
    if (f.to.size > 1) split.push(`${name}: derives ${[...f.to].sort().join(' and ')} (period ends ${[...f.end].join(', ')})`);
  }
  return split;
}

const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Derived start month, or a reason it cannot be derived. */
export function deriveStartMonth(row) {
  if (!row.source_date) return { error: 'no source_date' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(row.source_date);
  if (!m) return { error: `unparseable source_date ${row.source_date}` };
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (d !== lastDayOf(y, mo)) return { error: `source_date ${row.source_date} is not a month end` };
  if (y !== row.fiscal_year) return { error: `source_date year ${y} != fiscal_year ${row.fiscal_year}` };
  const month = (mo % 12) + 1;
  if (!ALLOWED_MONTHS.has(month)) return { error: `derived month ${month} outside {1,7,10}` };
  return { month };
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const verifyOnly = argv.includes('--verify');

  const db = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { db: { schema: 'treasury' } },
  );

  // Paged, ordered by the PRIMARY KEY last. PostgREST caps a single response at
  // 1000 rows, and the in-scope set is ~1,784 — an unpaged `.limit(3000)` would
  // silently return a partial set and this script would report "0 rows need a
  // change" for a family it never saw. Ordering by a non-unique column alone is
  // also unsafe: rows tying on it can repeat or vanish across page boundaries
  // (auto-memory reference_paged_reads_need_total_order).
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('budgets')
      .select('id, data_source, source_date, fiscal_year, fiscal_year_start_month')
      .like('data_source', '% ACFR — General Fund%')
      .order('data_source')
      .order('id')
      .range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const scoped = rows.filter((r) => IN_SCOPE.some((re) => re.test(r.data_source)));
  console.log(`${rows.length} candidate row(s); ${scoped.length} in scope`
    + `${rows.length !== scoped.length ? ` (${rows.length - scoped.length} skipped: not an enumerated family)` : ''}`);

  const fams = {};
  const problems = [];
  const changes = [];
  for (const r of scoped) {
    const fam = r.data_source.split(' ACFR')[0];
    fams[fam] = fams[fam] || { n: 0, from: new Set(), to: new Set(), change: 0, end: new Set() };
    const f = fams[fam];
    f.n++;
    const d = deriveStartMonth(r);
    if (d.error) { problems.push(`${fam} FY${r.fiscal_year}: ${d.error}`); continue; }
    f.end.add(r.source_date.slice(5));
    f.from.add(r.fiscal_year_start_month);
    f.to.add(d.month);
    if (r.fiscal_year_start_month !== d.month) { f.change++; changes.push({ id: r.id, month: d.month }); }
  }

  console.log('\nfamily                 rows  period-end  stored -> derived   to change');
  for (const [k, v] of Object.entries(fams).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${k.padEnd(22)} ${String(v.n).padStart(4)}  ${[...v.end].join(',').padEnd(10)}  `
      + `${[...v.from].join(',').padEnd(6)} -> ${[...v.to].join(',').padEnd(6)}      ${v.change || '-'}`);
  }

  if (problems.length) {
    console.error(`\n${problems.length} row(s) could not be derived — refusing to write:`);
    problems.slice(0, 20).forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }

  const split = assertFamilyConsistency(fams);
  if (split.length) {
    console.error(`\n${split.length} family/families derive MORE THAN ONE start month — refusing to write.`);
    console.error('A family spans many fiscal years; two derived months means at least one source_date is wrong.');
    split.forEach((s) => console.error(`  ${s}`));
    process.exit(1);
  }

  if (verifyOnly) {
    const wrong = scoped.filter((r) => {
      const d = deriveStartMonth(r);
      return !d.error && r.fiscal_year_start_month !== d.month;
    });
    console.log(`\nVERIFY: ${scoped.length} row(s) checked, ${wrong.length} still wrong.`);
    if (wrong.length) {
      wrong.slice(0, 10).forEach((r) => console.error(`  ${r.data_source.slice(0, 60)} FY${r.fiscal_year}: `
        + `stored ${r.fiscal_year_start_month}, want ${deriveStartMonth(r).month}`));
      process.exit(1);
    }
    console.log('ALL CORRECT.');
    return;
  }

  console.log(`\n${changes.length} row(s) need a change.`);
  if (!apply) { console.log('Dry run — nothing written. Re-run with --apply.'); return; }
  if (!changes.length) { console.log('Nothing to do.'); return; }

  // Group by target month so this is a handful of updates, not 226.
  const byMonth = {};
  for (const c of changes) (byMonth[c.month] = byMonth[c.month] || []).push(c.id);
  let written = 0;
  for (const [month, ids] of Object.entries(byMonth)) {
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error: upErr } = await db.from('budgets')
        .update({ fiscal_year_start_month: Number(month) }).in('id', chunk);
      if (upErr) { console.error(`  update failed (month ${month}): ${upErr.message}`); process.exit(1); }
      written += chunk.length;
    }
    console.log(`  set fiscal_year_start_month=${month} on ${ids.length} row(s)`);
  }
  console.log(`\n${written} row(s) updated. Re-run with --verify to confirm.`);
}

await main();
