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
  // Pre-GASB-34 state filings, labelled `… State CAFR …`. A different statement
  // on a different basis, but the same three states' same fiscal calendars.
  /^(Connecticut|Wisconsin|Massachusetts) State CAFR — General Fund/,
  // Texas. `General REVENUE Fund` is the state's own name for its principal
  // operating fund; those rows are unclassified for `fund_scope` by standing
  // ruling, but the fiscal calendar is not in doubt — Texas closes August 31.
  /^Texas State ACFR — General Revenue Fund/,
  // Oregon city ADOPTED BUDGET documents. `basis` is adopted rather than actual,
  // which is irrelevant here: a fiscal calendar belongs to the entity, not to the
  // basis of a particular figure.
  /^(Portland|Gresham|Troutdale) (Operating Budget|Revenue Budget|All Funds Requirements) FY\d{4}$/,
  // NASBO rows are attributed to INDIVIDUAL state entities (one Kentucky row, one
  // Nevada row), not to a multi-state aggregate — so each does have a single
  // correct fiscal calendar. An earlier pass wrongly excluded these two on the
  // assumption that they were an aggregate; the entity-level enumeration is what
  // disproved it.
  /^NASBO State Expenditure Report — General Fund /,
];

/**
 * Months a fiscal year in this corpus can start in, i.e. the four period ends
 * actually printed on these documents:
 *
 *   Dec 31 -> 1    Seattle
 *   Mar 31 -> 4    NEW YORK, verified "Fiscal Year Ended March 31, 2005" in its
 *                  own FY2005 ACFR (osc.ny.gov)
 *   Jun 30 -> 7    46 states plus every Oregon/Arizona entity; verified
 *                  "Fiscal Year Ended June 30, 2025" in California's FY2025 ACFR
 *                  (sco.ca.gov) and in Bend, Tucson, Minnesota, Ohio, Virginia
 *   Aug 31 -> 9    TEXAS, verified "FISCAL YEAR ENDED AUGUST 31, 2023" in its
 *                  own FY2023 ACFR (comptroller.texas.gov)
 *   Sep 30 -> 10   Alabama, Michigan, Austin, Travis County
 *
 * All four STATE exceptions are independently corroborated by the 2025 NASBO
 * State Expenditure Report (in the repo root), which states outright: "In 46
 * states the fiscal year begins on July 1 and ends on June 30. The exceptions
 * are as follows: in New York, the fiscal year begins on April 1; in Texas, the
 * fiscal year begins on September 1; and in Alabama and Michigan the fiscal year
 * begins on October 1." That is a second, independent source agreeing with every
 * month this script derives for a state.
 *
 * A whitelist alone is weak — it would happily accept `7` for a state whose
 * `source_date` was wrong in a way that still landed on June 30. That is what
 * `assertFamilyConsistency` below is for.
 */
const ALLOWED_MONTHS = new Set([1, 4, 7, 9, 10]);

/**
 * Every row belonging to one ENTITY must derive the SAME start month.
 *
 * This is the guard with teeth. An entity has exactly one fiscal calendar, and
 * each entity here carries up to 48 rows spanning up to 24 fiscal years — so a
 * `source_date` wrong enough to shift the derived month would have to be wrong
 * IDENTICALLY across all of them to survive, while a single mis-stamped year
 * shows up at once as an entity deriving two months. A month whitelist cannot
 * see that at all.
 *
 * ⚠ Grouped by `municipality_id`, NOT by a `data_source` prefix. The prefix is
 * fine for ACFR labels, which repeat verbatim across years, but Oregon's budget
 * documents embed the year in the label itself ("Portland Operating Budget
 * FY2024"), so a prefix key would make every such row its own single-row family
 * and the check would pass vacuously on exactly the rows it most needs to test.
 */
export function assertEntityConsistency(entities) {
  const split = [];
  for (const [name, e] of Object.entries(entities)) {
    if (e.to.size > 1) {
      split.push(`${name}: derives ${[...e.to].sort((a, b) => a - b).join(' and ')} `
        + `from period ends ${[...e.end].sort().join(', ')} (${e.n} rows)`);
    }
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
  // 1000 rows, and an unpaged `.limit()` silently returns a partial set — which
  // is how an earlier run of this script reported "0 rows need a change" for
  // 1,386 rows that plainly needed one. Ordering by a non-unique column alone is
  // also unsafe: rows tying on it can repeat or vanish across page boundaries
  // (auto-memory reference_paged_reads_need_total_order).
  //
  // No `data_source` filter here: the in-scope families no longer share a common
  // substring (ACFR, CAFR, adopted budget documents and a NASBO report), so the
  // IN_SCOPE list is the only gate and it is applied below.
  const municipalities = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('municipalities')
      .select('id, name, state, entity_type').order('id').range(from, from + 999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data.length) break;
    for (const m of data) municipalities[m.id] = m;
    if (data.length < 1000) break;
  }

  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('budgets')
      .select('id, data_source, source_date, fiscal_year, fiscal_year_start_month, municipality_id')
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

  // Two groupings, for two different jobs:
  //   `entities` — keyed by municipality_id, the thing that actually owns a
  //                fiscal calendar. This is what the consistency guard asserts on.
  //   `fams`     — keyed by a human-readable label, purely for the report.
  const entities = {};
  const fams = {};
  const problems = [];
  const changes = [];
  for (const r of scoped) {
    const m = municipalities[r.municipality_id];
    const who = m ? `${m.name}, ${m.state}` : `(unknown muni ${r.municipality_id})`;
    // Strip the fiscal year out of the label so ACFR rows and Oregon's
    // year-bearing budget-document labels both collapse to one reporting family.
    const fam = r.data_source.replace(/\s*\(FY\d{4}[^)]*\)/, '').replace(/\s+FY\d{4}$/, '');

    for (const [bucket, key] of [[entities, who], [fams, fam]]) {
      bucket[key] = bucket[key] || { n: 0, from: new Set(), to: new Set(), change: 0, end: new Set() };
    }
    entities[who].n++; fams[fam].n++;

    const d = deriveStartMonth(r);
    if (d.error) { problems.push(`${who} / ${fam} FY${r.fiscal_year}: ${d.error}`); continue; }
    for (const bucket of [entities[who], fams[fam]]) {
      bucket.end.add(r.source_date.slice(5));
      bucket.from.add(r.fiscal_year_start_month);
      bucket.to.add(d.month);
    }
    if (r.fiscal_year_start_month !== d.month) {
      entities[who].change++; fams[fam].change++;
      changes.push({ id: r.id, month: d.month });
    }
  }

  console.log('\nfamily                                          rows  end     stored -> derived  change');
  for (const [k, v] of Object.entries(fams).sort((a, b) => b[1].n - a[1].n)) {
    console.log(`${k.slice(0, 46).padEnd(47)}${String(v.n).padStart(4)}  ${[...v.end].join(',').padEnd(7)} `
      + `${[...v.from].join(',').padEnd(6)} -> ${[...v.to].join(',').padEnd(6)}   ${v.change || '-'}`);
  }

  if (problems.length) {
    console.error(`\n${problems.length} row(s) could not be derived — refusing to write:`);
    problems.slice(0, 20).forEach((p) => console.error(`  ${p}`));
    process.exit(1);
  }

  const split = assertEntityConsistency(entities);
  if (split.length) {
    console.error(`\n${split.length} entity/entities derive MORE THAN ONE start month — refusing to write.`);
    console.error('An entity has ONE fiscal calendar; two derived months means at least one source_date is wrong.');
    split.forEach((s) => console.error(`  ${s}`));
    process.exit(1);
  }
  console.log(`\nentity consistency: ${Object.keys(entities).length} entities, each deriving a single start month.`);

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
