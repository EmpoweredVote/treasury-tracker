#!/usr/bin/env node
/**
 * Ask every transactions file the same two questions about its PERIOD, and
 * write the registers the banners and the gate read.
 *
 *   node scripts/generateFiscalPeriodFlags.mjs            # rewrite both registers
 *   node scripts/generateFiscalPeriodFlags.mjs --check    # fail if they have drifted
 *
 * ── ⭐⭐⭐ WHY THESE ARE RULES AND NOT SIX HAND-WRITTEN ENTRIES ─────────────
 *
 * West Hollywood had five straddle banners and McKinney had an eleven-month
 * banner, and all six existed because a person spent a day on that city. So
 * "unflagged" never meant "checked and fine", only "nobody looked" — the
 * defect PR #371 corrected for bond-financed revenue, in a second place.
 *
 * ⚠⚠ ASKING ALL 43 TRANSACTION BUDGETS FOUND A YEAR NOBODY HAD FLAGGED.
 * Frisco FY2021 holds TEN months: the file stops on 2021-07-29 with no payment
 * in August or September 2021, and it is drawn beside FY2020 ($377.92M, twelve
 * months) and FY2022 ($439.87M, twelve months). A reader sees Frisco spending
 * dip. Frisco has its own anomaly register AND its own row-coverage baseline,
 * and neither of them asked this question.
 *
 * ── ⭐⭐ TWO AXES, ONE METRIC — THE SEAM RULE DISAPPEARS ────────────────────
 *
 * The hand-written West Hollywood set needed a second rule nobody could
 * compute: "both sides of a seam are flagged". FY2020 and FY2025 are nearly
 * spotless in themselves and still read wrong, because the money paid during
 * those years sits in the file before them — FY2025 shows $132.28M against
 * FY2024's $249.36M and looks like spending halved.
 *
 * Measuring the receiving side as its own share makes that fall out of ONE
 * number instead of a bookkeeping rule a human maintains:
 *
 *   ownShare        this file's dollars paid outside its own period
 *   displacedShare  dollars paid inside its period that sit in another file
 *
 * A year is flagged when EITHER crosses the threshold.
 *
 * ── ⚠ THE THRESHOLD IS A JUDGEMENT, AND IT IS PUBLISHED ────────────────────
 *
 * 10% is a choice, not a measurement. What IS measured is the spread it was
 * chosen against — every one of the 43 transaction budgets, 2026-11-11:
 *
 *     WeHo FY2025  36.93%      WeHo FY2017   6.56%
 *     WeHo FY2024  27.60%      WeHo FY2021   4.60%
 *     WeHo FY2026  25.05%      WeHo FY2022   4.05%
 *     WeHo FY2020  18.74%      WeHo FY2023   3.89%
 *     WeHo FY2019  18.57%      WeHo FY2018   1.80%
 *     ─────────────────── 10% ─────────────  Frisco FY2019 0.70%
 *                                            31 budgets at 0.000%
 *
 * ⭐ The gap between 18.57% and 6.56% is by far the widest in the
 * distribution, and 32 of 43 budgets sit at exactly zero. Any threshold inside
 * that gap emits precisely the five years that were flagged by hand, so the
 * rule replaces the judgement without changing what a reader sees. 10% was
 * picked low in the gap on purpose: the figures that can still MOVE are the
 * ones above it (West Hollywood's FY2025-26 register grows weekly), while
 * 6.56% is a closed file that cannot drift upward.
 *
 * It lives in ONE place (below), each register records the value it was built
 * at, the gate refuses to run if the two disagree, and the banner states it in
 * words a reader can apply themselves ("more than a tenth").
 *
 * ── ⛔ WHAT MAY REACH A READER ─────────────────────────────────────────────
 *
 * Only a FACT ABOUT THE FILE. Both conditions here are arithmetic over dates
 * and amounts the publisher published, against a fiscal period the publisher
 * declares, so both qualify. ⚠ Neither banner says WHY — "the city has not
 * posted September yet" is the obvious reading of McKinney's gap and is still
 * a guess about a government's internal process. Frisco's register stays
 * author-facing for exactly this reason and must not be promoted here.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * ⚠ A JUDGEMENT, published. Stated in every banner so a reader can apply
 * their own. See the spread above before changing it: this number decides
 * which entity-years carry a banner.
 */
export const PERIOD_DISTORTION_THRESHOLD = 0.10;

const DISTORTION_REGISTER = path.join(process.cwd(), 'src', 'data', 'fiscalPeriodDistortionYears.json');
const ABSENT_REGISTER = path.join(process.cwd(), 'src', 'data', 'absentMonthYears.json');

function slugify(entity, state) {
  const slug = String(entity).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}-${String(state).toLowerCase()}`;
}

/**
 * ⚠ The id a reader-facing flag must carry, DERIVED, never typed —
 * `tests/figureFlags.test.ts` refuses any flag whose id is absent from an
 * author-facing register, so the id is the join between the two.
 *
 * ⭐ This reproduces the ids the hand-written West Hollywood entries already
 * used (`west-hollywood-ca-fy2019-fiscal-straddle`), which is deliberate:
 * `scripts/data/outOfPeriodExceptions.mjs` records the same finding for the
 * gate under those ids, and a rename would silently orphan every one of them.
 */
export function distortionFlagId(entity, state, fiscalYear) {
  return `${slugify(entity, state)}-fy${fiscalYear}-fiscal-straddle`;
}

/**
 * ⚠ NOT `-eleven-month-year`. The hand-written McKinney id spelled the count
 * into itself, so the id would have had to change when the number did — and an
 * id that changes is an id nothing can be keyed to.
 */
export function absentMonthFlagId(entity, state, fiscalYear) {
  return `${slugify(entity, state)}-fy${fiscalYear}-absent-months`;
}

/**
 * ⚠⚠ A BANNER IS KEYED entity|state|year|dataset, NOT TO ONE BUDGET.
 *
 * An entity-year carrying two transactions budgets would render the same
 * banner over a total it does not describe — the #364 defect in a new costume.
 * Measured 2026-11-11: no entity-year has two. This refuses to write a
 * register where that has stopped being true, rather than letting a reader
 * find out.
 */
export function siblingConflicts(rows) {
  return rows.filter((r) => Number(r.sibling_budgets) > 1);
}

/**
 * ⚠⚠⚠ THE FIGURE IN THE PROSE MUST BE THE FIGURE IN THE CHART.
 *
 * Every banner below states the year's total. The page draws
 * `budgets.total_budget`; these measurements are sums over
 * `treasury.transactions`. They tie on all 43 budgets today, and if they ever
 * stop, prose built from the rows would contradict the number printed beside
 * it. That is PR #364's defect exactly, so it is refused rather than rounded.
 */
export function totalMismatches(rows) {
  return rows.filter((r) => Number(r.total) !== Number(r.txn_sum));
}

export async function measureDistortion(db) {
  const { data, error } = await db.schema('treasury').rpc('transaction_period_distortion', {
    p_threshold: PERIOD_DISTORTION_THRESHOLD,
  });
  if (error) throw new Error(`transaction_period_distortion failed: ${error.message}`);
  refuse(data, 'distortion');

  return data.map((r) => ({
    id: distortionFlagId(r.entity, r.state, r.fiscal_year),
    entity: r.entity,
    state: r.state,
    fiscalYear: r.fiscal_year,
    datasetType: r.dataset_type,
    severity: 'not-comparable',
    total: Number(r.total),
    periodStart: r.period_start,
    periodEnd: r.period_end,
    outRows: Number(r.out_rows),
    outAmount: Number(r.out_amount),
    rowsBefore: Number(r.rows_before),
    amountBefore: Number(r.amount_before),
    rowsAfter: Number(r.rows_after),
    amountAfter: Number(r.amount_after),
    earliestOut: r.earliest_out,
    latestOut: r.latest_out,
    inWindow: Number(r.in_window),
    elsewhereRows: Number(r.elsewhere_rows),
    elsewhereAmount: Number(r.elsewhere_amount),
    elsewhereYears: r.elsewhere_years ?? [],
    ownShare: Number(r.own_share),
    displacedShare: Number(r.displaced_share ?? 0),
    // Which axis put this year over the line — it decides which sentence the
    // banner leads with, and a reader of the register can see it directly.
    axis: Number(r.own_share) > Number(r.displaced_share ?? 0) ? 'own' : 'displaced',
    // ⚠ An entity's earliest and latest loaded year can only see one
    // neighbour, so their displacedShare is a LOWER BOUND, not a measurement.
    hasPriorYear: r.has_prior_year === true,
    hasNextYear: r.has_next_year === true,
    stillGrowing: r.still_growing === true,
    sourceName: r.data_source,
    sourceUrl: r.source_url,
    loaded: true,
    readerFacing: true,
  }));
}

export async function measureAbsentMonths(db) {
  const { data, error } = await db.schema('treasury').rpc('transaction_absent_months');
  if (error) throw new Error(`transaction_absent_months failed: ${error.message}`);
  refuse(data, 'absent-month');

  return data.map((r) => ({
    id: absentMonthFlagId(r.entity, r.state, r.fiscal_year),
    entity: r.entity,
    state: r.state,
    fiscalYear: r.fiscal_year,
    datasetType: r.dataset_type,
    severity: 'incomplete-period',
    total: Number(r.total),
    rowCount: Number(r.row_count),
    periodStart: r.period_start,
    periodEnd: r.period_end,
    firstPayment: r.first_payment,
    lastPayment: r.last_payment,
    monthsInPeriod: Number(r.months_in_period),
    monthsCovered: Number(r.months_covered),
    absentMonths: r.absent_months ?? [],
    completeYears: r.complete_years ?? [],
    completeYearTotals: (r.complete_year_totals ?? []).map(Number),
    stillGrowing: r.still_growing === true,
    sourceName: r.data_source,
    sourceUrl: r.source_url,
    loaded: true,
    readerFacing: true,
    /**
     * ⭐⭐⭐ THE RETIREMENT CONDITION, COMPUTED RATHER THAN REMEMBERED.
     *
     * McKinney's hand-written banner stated this in prose for a human to act
     * on: "holds any payment dated 2026-09-01 or later, or covers twelve
     * distinct payment months." It was TRUE the day it shipped and becomes
     * FALSE the moment the city posts September and TT reloads — and a banner
     * telling a reader a COMPLETE year is incomplete is its own
     * misinformation. Nothing but a person remembering stood between those two
     * states.
     *
     * Here the same sentence is the rule's own condition: when the month fills
     * in, the row leaves this register on the next run and the banner goes
     * with it. The text stays so a reader of the register knows what it is
     * waiting for.
     */
    retireWhen:
      `${r.data_source} covers all ${r.months_in_period} months of `
      + `${r.period_start} – ${r.period_end}, or a sibling register of `
      + `${r.entity} comes to hold ${(r.absent_months ?? []).join(' / ')}. `
      + 'Re-run scripts/generateFiscalPeriodFlags.mjs; the row and its banner '
      + 'leave together, with no edit to make.',
  }));
}

function refuse(rows, what) {
  const clash = siblingConflicts(rows);
  if (clash.length) {
    throw new Error(
      `${clash.length} ${what} year(s) now carry more than one transactions budget, so the `
      + 'banner would render over a total it does not describe: '
      + `${clash.map((c) => `${c.entity} ${c.state} FY${c.fiscal_year} (${c.sibling_budgets})`).join(', ')}. `
      + 'Key the flag more narrowly, or exclude these years, before regenerating.');
  }
  const drift = totalMismatches(rows);
  if (drift.length) {
    throw new Error(
      `${drift.length} ${what} year(s) have a stored total that no longer equals the sum of their `
      + 'own transactions, so prose built from the rows would contradict the figure drawn beside '
      + `it: ${drift.map((d) => `${d.entity} FY${d.fiscal_year} (${d.total} vs ${d.txn_sum})`).join(', ')}.`);
  }
}

/**
 * ⚠⚠ THE TWO RULES MUST NOT BOTH CLAIM A YEAR. A flag is keyed
 * entity|state|year|dataset and only one can render, so a collision means a
 * reader silently loses whichever sentence lost the merge.
 *
 * ⭐ This is not hypothetical: West Hollywood FY2025 has no July 2024 payment
 * of its own, and WOULD be an absent-month year if the SQL did not first check
 * whether a sibling file holds that month. 1,497 payments worth $21,028,719.61
 * do, which is why that year is a distortion row instead. The check lives in
 * the SQL; this proves it held.
 */
export function ruleCollisions(distortion, absent) {
  const keyOf = (r) => `${r.entity}|${r.state}|${r.fiscalYear}|${r.datasetType}`;
  const seen = new Set(distortion.map(keyOf));
  return absent.filter((r) => seen.has(keyOf(r))).map(keyOf);
}

/** Differences that matter, in the order a reader of the output needs them. */
export function diffRegister(measured, stored, fields) {
  const byId = new Map(stored.rows.map((r) => [r.id, r]));
  const seen = new Set();
  const added = [];
  const changed = [];
  for (const m of measured) {
    seen.add(m.id);
    const s = byId.get(m.id);
    if (!s) { added.push(m); continue; }
    const same = fields.every((f) => JSON.stringify(s[f]) === JSON.stringify(m[f]));
    if (!same) changed.push({ was: s, now: m });
  }
  const removed = stored.rows.filter((r) => !seen.has(r.id));
  return { added, changed, removed, ok: !added.length && !changed.length && !removed.length };
}

const DISTORTION_FIELDS = [
  'entity', 'state', 'fiscalYear', 'datasetType', 'total',
  'outRows', 'outAmount', 'elsewhereRows', 'elsewhereAmount', 'elsewhereYears',
  'ownShare', 'displacedShare', 'axis', 'stillGrowing', 'sourceName', 'sourceUrl',
];
const ABSENT_FIELDS = [
  'entity', 'state', 'fiscalYear', 'datasetType', 'total', 'rowCount',
  'monthsCovered', 'absentMonths', 'firstPayment', 'lastPayment',
  'completeYears', 'completeYearTotals', 'stillGrowing', 'sourceName', 'sourceUrl',
];

/**
 * ⚠ THE DENOMINATOR, MEASURED. The banner tells a reader how many of the
 * series' transaction years this rule catches, and a number like that is only
 * meaningful beside the number it was asked of. Hard-coding "43" would rot the
 * first time a city is loaded — the #364 defect, one level up.
 */
export async function countTransactionBudgets(db) {
  const { count, error } = await db.schema('treasury')
    .from('budgets')
    .select('id', { count: 'exact', head: true })
    .eq('dataset_type', 'transactions');
  if (error) throw new Error(`counting transaction budgets failed: ${error.message}`);
  return count;
}

function payload(rule, rows, evaluated) {
  return {
    $comment: 'GENERATED by scripts/generateFiscalPeriodFlags.mjs — do not hand-edit. '
      + 'Re-measure with that script; `--check` is the gate.',
    rule,
    evaluated,
    // ⚠ The date a PERSON can check these against the publisher. It sits on
    // the payload, not on each row, so re-measuring does not churn every line;
    // `diffRegister` compares rows only, so it never fires on the date alone.
    measuredOn: new Date().toISOString().slice(0, 10),
    thresholdShare: PERIOD_DISTORTION_THRESHOLD,
    rows,
  };
}

function report(label, d, extra) {
  console.error(`❌ the ${label} register has drifted from the data it describes.\n`);
  for (const r of d.added) {
    console.error(`  + ${r.entity}, ${r.state} FY${r.fiscalYear} now qualifies ${extra(r)} and has NO banner.`);
  }
  for (const r of d.removed) {
    console.error(`  − ${r.entity}, ${r.state} FY${r.fiscalYear} no longer qualifies. `
      + '⚠ Its banner must be DELETED, not reworded: telling a reader a complete year is '
      + 'incomplete, or an undistorted year distorted, is its own misinformation.');
  }
  for (const { was, now } of d.changed) {
    console.error(`  ~ ${now.entity}, ${now.state} FY${now.fiscalYear}: total ${was.total} → ${now.total}`);
  }
}

async function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  const db = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );

  const distortion = await measureDistortion(db);
  const absent = await measureAbsentMonths(db);
  const evaluated = await countTransactionBudgets(db);

  const collisions = ruleCollisions(distortion, absent);
  if (collisions.length) {
    throw new Error(
      `both period rules claim ${collisions.length} key(s), and only one banner can render: `
      + `${collisions.join(', ')}. A month held by a sibling register is DISPLACED, not absent — `
      + 'fix the sibling check in treasury.transaction_absent_months() rather than picking a winner.');
  }

  if (!check) {
    writeFileSync(DISTORTION_REGISTER, `${JSON.stringify(payload('fiscal-period-distortion', distortion, evaluated), null, 2)}\n`);
    writeFileSync(ABSENT_REGISTER, `${JSON.stringify(payload('absent-months', absent, evaluated), null, 2)}\n`);
    console.log(`wrote ${distortion.length} distorted year(s) of ${evaluated} over ${PERIOD_DISTORTION_THRESHOLD * 100}% to ${DISTORTION_REGISTER}`);
    for (const r of distortion) {
      const pct = (100 * Math.max(r.ownShare, r.displacedShare)).toFixed(2);
      console.log(`  ${r.entity} FY${r.fiscalYear}  ${pct}% (${r.axis})`);
    }
    console.log(`wrote ${absent.length} incomplete year(s) to ${ABSENT_REGISTER}`);
    for (const r of absent) {
      console.log(`  ${r.entity} FY${r.fiscalYear}  ${r.monthsCovered}/${r.monthsInPeriod} months — ${r.absentMonths.join(', ')}`);
    }
    return 0;
  }

  let code = 0;
  for (const [label, file, rows, fields, extra] of [
    ['fiscal-period distortion', DISTORTION_REGISTER, distortion, DISTORTION_FIELDS,
      (r) => `(${(100 * Math.max(r.ownShare, r.displacedShare)).toFixed(2)}%, ${r.axis})`],
    ['absent-month', ABSENT_REGISTER, absent, ABSENT_FIELDS,
      (r) => `(${r.monthsCovered}/${r.monthsInPeriod} months)`],
  ]) {
    const stored = JSON.parse(readFileSync(file, 'utf8'));
    if (stored.thresholdShare !== PERIOD_DISTORTION_THRESHOLD) {
      console.error(`❌ the ${label} register was built at ${stored.thresholdShare} but the rule now says ${PERIOD_DISTORTION_THRESHOLD}.`);
      console.error('   Re-run without --check, and read the diff: changing the threshold changes who is flagged.');
      code = 1;
      continue;
    }
    // ⚠⚠ THE DENOMINATOR IS READER-FACING COPY. The banner says this rule
    // catches N of M transaction years; if M has moved, every banner is
    // quoting a fleet that no longer exists — stale in exactly the way #364
    // was stale, just one level up from the money.
    if (stored.evaluated !== evaluated) {
      console.error(`❌ the ${label} register was built over ${stored.evaluated} transaction budgets, `
        + `and there are now ${evaluated}. Every banner quotes that number.`);
      code = 1;
      continue;
    }
    const d = diffRegister(rows, stored, fields);
    if (d.ok) {
      console.log(`✅ ${rows.length} ${label} year(s) — the register matches the database exactly.`);
      continue;
    }
    report(label, d, extra);
    code = 1;
  }
  if (code) console.error('\n  Re-run `node scripts/generateFiscalPeriodFlags.mjs` and review the diff.');
  return code;
}

// ⚠⚠ `process.exitCode`, NOT `process.exit()`. Calling process.exit() here
// tears down the loop while a supabase-js keep-alive socket is still closing;
// Node aborts with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`
// AFTER printing ✅, exit code 127 — deterministic, three runs of three, when
// PR #371 hit it. A gate whose success exits non-zero reports nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => { process.exitCode = c; }).catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exitCode = 1;
  });
}
